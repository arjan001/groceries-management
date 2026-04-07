'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface BackgroundTrackingConfig {
  deliveryId: string;
  riderName: string;
}

/**
 * Hook for background location tracking via the service worker.
 * The rider's PWA will continue broadcasting location even when the app
 * tab is in the background, using the service worker as a coordinator.
 */
export function useBackgroundLocationTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDeliveryId, setTrackingDeliveryId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Listen for messages from the service worker
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      const { type } = event.data || {};

      if (type === 'TRACKING_STATUS') {
        setIsTracking(event.data.active);
        setTrackingDeliveryId(event.data.deliveryId || null);
      }

      if (type === 'REQUEST_LOCATION') {
        // Service worker is requesting current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              navigator.serviceWorker.controller?.postMessage({
                type: 'LOCATION_UPDATE',
                location: {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  heading: pos.coords.heading,
                  speed: pos.coords.speed,
                },
              });
            },
            () => {}, // silently fail
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
          );
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check current tracking status on mount
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'GET_TRACKING_STATUS' });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Also maintain a foreground watchPosition to keep location flowing
  useEffect(() => {
    if (!isTracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          navigator.serviceWorker?.controller?.postMessage({
            type: 'LOCATION_UPDATE',
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
            },
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
      watchIdRef.current = id;
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTracking]);

  const startTracking = useCallback(async (config: BackgroundTrackingConfig) => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'START_LOCATION_TRACKING',
      data: {
        deliveryId: config.deliveryId,
        riderName: config.riderName,
        supabaseUrl,
        supabaseKey,
      },
    });

    // Register periodic background sync if available
    if ('periodicSync' in reg) {
      try {
        await (reg as unknown as { periodicSync: { register: (tag: string, options: { minInterval: number }) => Promise<void> } }).periodicSync.register('rider-location-sync', {
          minInterval: 15000, // 15 seconds minimum
        });
      } catch {
        // Periodic sync not available or not permitted
      }
    }

    setIsTracking(true);
    setTrackingDeliveryId(config.deliveryId);
  }, []);

  const stopTracking = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: 'STOP_LOCATION_TRACKING' });

    setIsTracking(false);
    setTrackingDeliveryId(null);
  }, []);

  return { isTracking, trackingDeliveryId, startTracking, stopTracking };
}
