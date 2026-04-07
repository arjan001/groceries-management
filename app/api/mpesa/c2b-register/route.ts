import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// Load config from env first, then DB fallback
let _dbCache: Record<string, string> | null = null;
let _dbCacheTime = 0;

async function getConfig(): Promise<Record<string, string>> {
  const config: Record<string, string> = {
    consumer_key: (process.env.MPESA_CONSUMER_KEY || '').trim(),
    consumer_secret: (process.env.MPESA_CONSUMER_SECRET || '').trim(),
    shortcode: (process.env.MPESA_SHORTCODE || '').trim(),
    env: (process.env.MPESA_ENV || 'sandbox').trim(),
  };

  if (config.consumer_key && config.consumer_secret && config.shortcode) {
    return config;
  }

  try {
    const now = Date.now();
    if (!_dbCache || now - _dbCacheTime > 60_000) {
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase.from('mpesa_settings').select('setting_key, setting_value');
        if (data) {
          _dbCache = {};
          for (const row of data) _dbCache[row.setting_key] = row.setting_value;
          _dbCacheTime = now;
        }
      }
    }
    if (_dbCache) {
      if (!config.consumer_key) config.consumer_key = _dbCache.mpesa_consumer_key || '';
      if (!config.consumer_secret) config.consumer_secret = _dbCache.mpesa_consumer_secret || '';
      if (!config.shortcode) config.shortcode = _dbCache.mpesa_shortcode || '';
      if (!config.env) config.env = _dbCache.mpesa_env || 'sandbox';
    }
  } catch { /* ignore */ }

  return config;
}

function getAuthUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
}

function getRegisterUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl'
    : 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl';
}

async function getAccessToken(config: Record<string, string>): Promise<string> {
  const auth = Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');
  const res = await fetch(getAuthUrl(config.env), {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${data.errorMessage || 'Unknown'}`);
  return data.access_token;
}

// POST: Register C2B validation & confirmation URLs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = await getConfig();

    if (!config.consumer_key || !config.consumer_secret || !config.shortcode) {
      return NextResponse.json(
        { success: false, message: 'M-Pesa credentials not configured' },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const shortcode = body.shortcode || config.shortcode;
    const responseType = body.responseType || 'Completed';
    const confirmationUrl = body.confirmationUrl || `${siteUrl}/api/mpesa/c2b-register/confirmation`;
    const validationUrl = body.validationUrl || `${siteUrl}/api/mpesa/c2b-register/validation`;

    if (!confirmationUrl || !validationUrl) {
      return NextResponse.json(
        { success: false, message: 'Confirmation URL and Validation URL are required. Set NEXT_PUBLIC_SITE_URL or provide them explicitly.' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(config);

    const payload = {
      ShortCode: shortcode,
      ResponseType: responseType,
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    };

    const response = await fetch(getRegisterUrl(config.env), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Store registration in database
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('c2b_registered_urls').insert({
          shortcode,
          response_type: responseType,
          confirmation_url: confirmationUrl,
          validation_url: validationUrl,
          registration_status: data.ResponseDescription?.includes('success') ? 'registered' : 'failed',
        });
      } catch (e) {
        console.error('Failed to store C2B registration:', e);
      }
    }

    if (data.ResponseCode === '0' || data.ResponseDescription?.toLowerCase().includes('success')) {
      return NextResponse.json({
        success: true,
        message: 'C2B URLs registered successfully',
        confirmationUrl,
        validationUrl,
        responseDescription: data.ResponseDescription,
      });
    } else {
      return NextResponse.json(
        { success: false, message: data.errorMessage || data.ResponseDescription || 'Registration failed', data },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `C2B Register URL error: ${message}` },
      { status: 500 }
    );
  }
}
