import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getGoogleMapsApiKey(): Promise<string> {
  // Check env var first
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return process.env.GOOGLE_MAPS_API_KEY;
  }
  // Fall back to business_settings in database
  const supabase = getSupabaseAdmin();
  if (!supabase) return '';
  try {
    const { data } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'delivery')
      .single();
    if (data?.value) {
      const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return settings.googleMapsApiKey || '';
    }
  } catch {
    // ignore
  }
  return '';
}

// POST: Calculate distance between two locations using Google Distance Matrix API
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is authenticated
    const auth = await verifyAdminAuth(request);
    if (!auth.authenticated) {
      return auth.response;
    }

    const body = await request.json();
    const { origin, destination } = body as { origin: string; destination: string };

    if (!origin || !destination) {
      return NextResponse.json(
        { success: false, message: 'Both origin and destination are required' },
        { status: 400 }
      );
    }

    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'Google Maps API key not configured. Add it in Settings → Delivery.' },
        { status: 503 }
      );
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}&units=metric`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') {
      return NextResponse.json(
        { success: false, message: `Google API error: ${data.status} - ${data.error_message || 'Unknown error'}` },
        { status: 502 }
      );
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return NextResponse.json(
        { success: false, message: `Could not calculate distance: ${element?.status || 'No route found'}` },
        { status: 404 }
      );
    }

    const distanceKm = parseFloat((element.distance.value / 1000).toFixed(1));
    const durationMins = Math.round(element.duration.value / 60);

    return NextResponse.json({
      success: true,
      distanceKm,
      distanceText: element.distance.text,
      durationMins,
      durationText: element.duration.text,
      origin: data.origin_addresses?.[0] || origin,
      destination: data.destination_addresses?.[0] || destination,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
