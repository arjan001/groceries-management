// Snackoh Bakers Admin — Service Worker
// Only caches /admin routes. Network-first strategy with app shell caching.
// Includes background location tracking for delivery riders.

const CACHE_NAME = 'snackoh-admin-v4';

const APP_SHELL_URLS = [
  '/admin',
  '/company-logo.jpeg',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// ── Background Location Tracking State ──
let locationTrackingActive = false;
let locationTrackingInterval = null;
let trackingConfig = null; // { deliveryId, riderName, supabaseUrl, supabaseKey }

// ── Install: pre-cache the admin app shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_URLS);
    })
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('snackoh-admin-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Message handler: start/stop background location tracking ──
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  if (type === 'START_LOCATION_TRACKING') {
    trackingConfig = data; // { deliveryId, riderName, supabaseUrl, supabaseKey }
    locationTrackingActive = true;
    startBackgroundTracking();
    // Notify all clients that tracking started
    notifyClients({ type: 'TRACKING_STATUS', active: true, deliveryId: data.deliveryId });
  }

  if (type === 'STOP_LOCATION_TRACKING') {
    locationTrackingActive = false;
    trackingConfig = null;
    if (locationTrackingInterval) {
      clearInterval(locationTrackingInterval);
      locationTrackingInterval = null;
    }
    notifyClients({ type: 'TRACKING_STATUS', active: false });
  }

  if (type === 'GET_TRACKING_STATUS') {
    event.source.postMessage({
      type: 'TRACKING_STATUS',
      active: locationTrackingActive,
      deliveryId: trackingConfig?.deliveryId || null,
    });
  }
});

// ── Background Location Tracking ──
function startBackgroundTracking() {
  if (locationTrackingInterval) {
    clearInterval(locationTrackingInterval);
  }

  // Send location updates every 10 seconds
  locationTrackingInterval = setInterval(async () => {
    if (!locationTrackingActive || !trackingConfig) {
      clearInterval(locationTrackingInterval);
      locationTrackingInterval = null;
      return;
    }

    try {
      // Request location from the active client
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
      for (const client of clients) {
        client.postMessage({ type: 'REQUEST_LOCATION', deliveryId: trackingConfig.deliveryId });
      }
    } catch (err) {
      // Silent fail — location tracking is non-critical in the background
    }
  }, 10000);
}

// ── Handle location data sent back from clients ──
self.addEventListener('message', (event) => {
  const { type, location } = event.data || {};

  if (type === 'LOCATION_UPDATE' && trackingConfig && location) {
    // Send location to Supabase REST API directly from the service worker
    sendLocationToSupabase(location);
  }
});

async function sendLocationToSupabase(location) {
  if (!trackingConfig || !trackingConfig.supabaseUrl || !trackingConfig.supabaseKey) return;

  try {
    const url = `${trackingConfig.supabaseUrl}/rest/v1/deliveries?id=eq.${trackingConfig.deliveryId}`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': trackingConfig.supabaseKey,
        'Authorization': `Bearer ${trackingConfig.supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        rider_lat: location.lat,
        rider_lng: location.lng,
        rider_heading: location.heading,
        rider_speed: location.speed,
        rider_location_updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    // Silent fail — will retry on next interval
  }
}

function notifyClients(message) {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// ── Periodic background sync for location (if supported) ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'rider-location-sync' && locationTrackingActive) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'REQUEST_LOCATION', deliveryId: trackingConfig?.deliveryId });
        }
      })
    );
  }
});

// ── Fetch: network-first for /admin routes, ignore everything else ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests scoped to /admin paths and same-origin static assets
  const isAdminRoute = url.pathname.startsWith('/admin');
  const isAppShellAsset =
    url.origin === self.location.origin &&
    APP_SHELL_URLS.includes(url.pathname);

  if (!isAdminRoute && !isAppShellAsset) {
    return; // Let the browser handle non-admin requests normally
  }

  // Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') {
    return;
  }

  // Network-first strategy: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Only cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache if available
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests (HTML pages), return the cached admin shell
          if (event.request.mode === 'navigate') {
            return caches.match('/admin');
          }
          // Nothing in cache — return a basic offline response
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' }),
          });
        });
      })
  );
});
