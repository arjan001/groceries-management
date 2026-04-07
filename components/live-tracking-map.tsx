'use client';

import { useEffect, useRef, useState } from 'react';
import { useRiderLocationSubscribe, RiderLocation } from '@/lib/use-delivery-tracking';
import { Navigation, MapPin, Phone, Clock, Truck, CheckCircle, User } from 'lucide-react';

interface LiveTrackingMapProps {
  deliveryId: string;
  customerLat: number;
  customerLng: number;
  customerName: string;
  customerPhone?: string;
  riderName?: string;
  status: string;
  estimatedTime?: string;
}

// Calculate distance between two points in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatETA(meters: number, speedMs: number | undefined): string {
  const speed = speedMs && speedMs > 0 ? speedMs : 8.33; // default ~30km/h
  const seconds = meters / speed;
  const mins = Math.ceil(seconds / 60);
  if (mins < 1) return 'Arriving';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// SVG marker for rider (motorcycle icon)
const RIDER_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="24" r="22" fill="#1a1a1a" stroke="#fff" stroke-width="3"/>
  <circle cx="24" cy="24" r="18" fill="#2563eb"/>
  <path d="M16 28c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="19" r="4" fill="#fff"/>
  <circle cx="24" cy="24" r="3" fill="#60a5fa">
    <animate attributeName="r" values="3;4;3" dur="1.5s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite"/>
  </circle>
</svg>`;

// SVG marker for customer destination
const DESTINATION_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
  <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#ef4444"/>
  <circle cx="16" cy="16" r="8" fill="#fff"/>
  <circle cx="16" cy="16" r="4" fill="#ef4444"/>
</svg>`;

export default function LiveTrackingMap({
  deliveryId,
  customerLat,
  customerLng,
  customerName,
  customerPhone,
  riderName,
  status,
  estimatedTime,
}: LiveTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [LModule, setLModule] = useState<typeof L | null>(null);

  const { riderLocation, isConnected } = useRiderLocationSubscribe(deliveryId);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<string>('');

  // Dynamically load Leaflet CSS + JS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    import('leaflet').then((mod) => {
      setLModule(mod.default);
      setLeafletLoaded(true);
    }).catch(() => {
      // Fallback: load from CDN
      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          setLModule((window as unknown as { L: typeof L }).L);
          setLeafletLoaded(true);
        };
        document.head.appendChild(script);
      }
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !LModule || !mapRef.current || mapInstanceRef.current) return;

    const map = LModule.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([customerLat || -1.2864, customerLng || 36.8172], 14);

    LModule.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control to bottom-right
    LModule.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    // Add customer destination marker
    if (customerLat && customerLng) {
      const destIcon = LModule.divIcon({
        html: DESTINATION_MARKER_SVG,
        className: 'leaflet-destination-marker',
        iconSize: [32, 44],
        iconAnchor: [16, 44],
      });

      customerMarkerRef.current = LModule.marker([customerLat, customerLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<strong>${customerName}</strong><br/>Delivery destination`);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, LModule, customerLat, customerLng, customerName]);

  // Update rider marker on location change
  useEffect(() => {
    if (!leafletLoaded || !LModule || !mapInstanceRef.current || !riderLocation) return;

    const map = mapInstanceRef.current;

    // Create rider icon
    const riderIcon = LModule.divIcon({
      html: RIDER_MARKER_SVG,
      className: 'leaflet-rider-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([riderLocation.lat, riderLocation.lng]);
    } else {
      riderMarkerRef.current = LModule.marker([riderLocation.lat, riderLocation.lng], { icon: riderIcon })
        .addTo(map)
        .bindPopup(`<strong>${riderLocation.riderName || riderName || 'Rider'}</strong><br/>Delivery in progress`);
    }

    // Draw route line between rider and destination
    if (customerLat && customerLng) {
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([
          [riderLocation.lat, riderLocation.lng],
          [customerLat, customerLng],
        ]);
      } else {
        routeLineRef.current = LModule.polyline(
          [[riderLocation.lat, riderLocation.lng], [customerLat, customerLng]],
          { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8, 12' }
        ).addTo(map);
      }

      // Fit bounds to show both markers
      const bounds = LModule.latLngBounds(
        [riderLocation.lat, riderLocation.lng],
        [customerLat, customerLng]
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });

      // Calculate distance and ETA
      const dist = haversineDistance(riderLocation.lat, riderLocation.lng, customerLat, customerLng);
      setDistance(dist);
      setEta(formatETA(dist, riderLocation.speed ?? undefined));
    }
  }, [riderLocation, leafletLoaded, LModule, customerLat, customerLng, riderName]);

  const isActive = status === 'In Transit' || status === 'Assigned';
  const isDelivered = status === 'Delivered';

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card">
      {/* Bolt Food-style header bar */}
      <div className="bg-foreground text-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-blue-600' : isDelivered ? 'bg-green-600' : 'bg-gray-600'}`}>
              {isDelivered ? <CheckCircle size={20} className="text-white" /> : <Truck size={20} className="text-white" />}
            </div>
            <div>
              <p className="text-sm font-bold">
                {isDelivered ? 'Delivered' : isActive ? 'On the way' : 'Preparing your order'}
              </p>
              <p className="text-xs opacity-70">
                {isActive && eta ? `Estimated arrival: ${eta}` : isDelivered ? 'Order has been delivered' : estimatedTime || 'Waiting for rider'}
              </p>
            </div>
          </div>
          {isConnected && isActive && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-600 rounded-full text-xs font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          )}
        </div>

        {/* Progress steps */}
        <div className="flex gap-1 mt-3">
          {['Confirmed', 'Preparing', 'On the way', 'Delivered'].map((step, i) => {
            const stepMap: Record<string, number> = { 'Pending': 0, 'Confirmed': 0, 'Assigned': 1, 'Processing': 1, 'Ready': 1, 'In Transit': 2, 'Shipped': 2, 'Delivered': 3 };
            const currentStep = stepMap[status] ?? 0;
            return (
              <div key={step} className="flex-1">
                <div className={`h-1 rounded-full ${i <= currentStep ? 'bg-green-400' : 'bg-white/20'}`} />
                <p className={`text-[9px] mt-1 text-center ${i <= currentStep ? 'text-green-400 font-medium' : 'opacity-40'}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map container */}
      <div className="relative">
        <div ref={mapRef} className="w-full h-[300px] md:h-[400px] bg-gray-900" />

        {/* Overlay: rider info card (Bolt Food style) */}
        {riderLocation && isActive && (
          <div className="absolute bottom-3 left-3 right-3 bg-card/95 backdrop-blur-sm rounded-xl border border-border shadow-lg p-3 z-[1000]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <User size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{riderLocation.riderName || riderName || 'Rider'}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {distance !== null && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin size={10} /> {formatDistance(distance)} away
                    </span>
                  )}
                  {riderLocation.speed && riderLocation.speed > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Navigation size={10} /> {Math.round(riderLocation.speed * 3.6)} km/h
                    </span>
                  )}
                </div>
              </div>
              {customerPhone && (
                <a
                  href={`tel:${customerPhone}`}
                  className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center shrink-0 hover:bg-green-700 transition-colors"
                >
                  <Phone size={18} className="text-white" />
                </a>
              )}
            </div>
            {eta && (
              <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
                <Clock size={12} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Estimated arrival: <strong className="text-foreground">{eta}</strong></p>
              </div>
            )}
          </div>
        )}

        {/* Loading state */}
        {!riderLocation && isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-[1000]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-white font-medium">Waiting for rider location...</p>
              <p className="text-xs text-white/60 mt-1">Live tracking will appear once the rider is on the way</p>
            </div>
          </div>
        )}
      </div>

      {/* Destination info */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <MapPin size={16} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Delivery to</p>
            <p className="text-sm font-semibold truncate">{customerName}</p>
          </div>
          {customerLat && customerLng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}&travelmode=driving`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
            >
              <Navigation size={12} /> Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
