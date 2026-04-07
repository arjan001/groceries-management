'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RiderLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  deliveryId: string;
  riderName: string;
}

/**
 * Hook for rider to broadcast their live location via Supabase Realtime.
 * Used in the delivery/rider view to push GPS updates.
 */
export function useRiderLocationBroadcast(deliveryId: string | null, riderName: string) {
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const startBroadcast = useCallback(() => {
    if (!deliveryId || !navigator.geolocation) {
      setError(!navigator.geolocation ? 'Geolocation not supported' : '');
      return;
    }

    // Create/join a Supabase Realtime channel for this delivery
    const channel = supabase.channel(`delivery-tracking-${deliveryId}`);
    channel.subscribe();
    channelRef.current = channel;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const location: RiderLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          timestamp: Date.now(),
          deliveryId,
          riderName,
        };

        // Broadcast via Supabase Realtime
        channel.send({
          type: 'broadcast',
          event: 'rider-location',
          payload: location,
        });

        // Also update the deliveries table with latest rider position
        supabase.from('deliveries').update({
          rider_lat: location.lat,
          rider_lng: location.lng,
          rider_heading: location.heading,
          rider_speed: location.speed,
          rider_location_updated_at: new Date().toISOString(),
        }).eq('id', deliveryId).then(() => {});

        setError('');
        setIsTracking(true);
      },
      (err) => {
        setError(err.message);
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    watchIdRef.current = id;
  }, [deliveryId, riderName]);

  const stopBroadcast = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    if (deliveryId) {
      startBroadcast();
    }
    return () => stopBroadcast();
  }, [deliveryId, startBroadcast, stopBroadcast]);

  return { isTracking, error, startBroadcast, stopBroadcast };
}

/**
 * Hook for customers/admins to subscribe to a rider's live location
 * via Supabase Realtime broadcast channel.
 */
export function useRiderLocationSubscribe(deliveryId: string | null) {
  const [riderLocation, setRiderLocation] = useState<RiderLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!deliveryId) return;

    const channel = supabase.channel(`delivery-tracking-${deliveryId}`);

    channel
      .on('broadcast', { event: 'rider-location' }, (payload) => {
        setRiderLocation(payload.payload as RiderLocation);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Also fetch the last known position from DB
    supabase.from('deliveries')
      .select('rider_lat, rider_lng, rider_heading, rider_speed, rider_location_updated_at, driver_name, driver')
      .eq('id', deliveryId)
      .single()
      .then(({ data }) => {
        if (data && (data.rider_lat || data.rider_lng)) {
          setRiderLocation({
            lat: data.rider_lat || 0,
            lng: data.rider_lng || 0,
            heading: data.rider_heading,
            speed: data.rider_speed,
            timestamp: data.rider_location_updated_at ? new Date(data.rider_location_updated_at).getTime() : Date.now(),
            deliveryId,
            riderName: data.driver_name || data.driver || 'Rider',
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  return { riderLocation, isConnected };
}
