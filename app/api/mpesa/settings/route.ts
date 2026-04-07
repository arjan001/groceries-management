import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// Mapping between DB setting keys and env var names
const ENV_KEY_MAP: Record<string, string> = {
  mpesa_consumer_key: 'MPESA_CONSUMER_KEY',
  mpesa_consumer_secret: 'MPESA_CONSUMER_SECRET',
  mpesa_shortcode: 'MPESA_SHORTCODE',
  mpesa_passkey: 'MPESA_PASSKEY',
  mpesa_callback_url: 'MPESA_CALLBACK_URL',
  mpesa_env: 'MPESA_ENV',
  mpesa_transaction_type: 'MPESA_TRANSACTION_TYPE',
  mpesa_b2c_shortcode: 'MPESA_B2C_SHORTCODE',
  mpesa_b2c_initiator_name: 'MPESA_B2C_INITIATOR_NAME',
  mpesa_b2c_security_credential: 'MPESA_B2C_SECURITY_CREDENTIAL',
  mpesa_b2c_consumer_key: 'MPESA_B2C_CONSUMER_KEY',
  mpesa_b2c_consumer_secret: 'MPESA_B2C_CONSUMER_SECRET',
  mpesa_b2c_result_url: 'MPESA_B2C_RESULT_URL',
  mpesa_b2c_timeout_url: 'MPESA_B2C_TIMEOUT_URL',
  mpesa_c2b_confirmation_url: 'MPESA_C2B_CONFIRMATION_URL',
  mpesa_c2b_validation_url: 'MPESA_C2B_VALIDATION_URL',
  family_bank_paybill: 'FAMILY_BANK_PAYBILL',
  family_bank_account: 'FAMILY_BANK_ACCOUNT',
};

// Sensitive fields that should be masked when reading
const SENSITIVE_KEYS = new Set([
  'mpesa_consumer_key',
  'mpesa_consumer_secret',
  'mpesa_passkey',
  'mpesa_b2c_security_credential',
  'mpesa_b2c_consumer_key',
  'mpesa_b2c_consumer_secret',
]);

function maskValue(value: string): string {
  if (!value || value.length < 8) return value ? '****' : '';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

// GET: Fetch current M-Pesa settings (env vars primary, DB backup shown alongside)
export async function GET(request: NextRequest) {
  try {
    // Verify the caller is an authenticated admin
    const auth = await verifyAdminAuth(request);
    if (!auth.authenticated) {
      return auth.response;
    }
    if (!auth.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin privileges required to view M-Pesa settings' },
        { status: 403 }
      );
    }

    // Read from environment variables (primary source)
    const envSettings: Record<string, { value: string; masked: string; source: string }> = {};
    for (const [dbKey, envKey] of Object.entries(ENV_KEY_MAP)) {
      const rawVal = (process.env[envKey] || '').trim();
      const isSensitive = SENSITIVE_KEYS.has(dbKey);
      envSettings[dbKey] = {
        value: rawVal ? 'set' : '',
        masked: isSensitive ? maskValue(rawVal) : rawVal,
        source: rawVal ? 'env' : 'none',
      };
    }

    // Read from database (backup)
    const supabase = getSupabaseAdmin();
    let dbSettings: Record<string, { value: string; masked: string; updated_at: string }> = {};
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('mpesa_settings')
          .select('setting_key, setting_value, is_sensitive, updated_at');
        if (!error && data) {
          for (const row of data) {
            const isSensitive = row.is_sensitive || SENSITIVE_KEYS.has(row.setting_key);
            dbSettings[row.setting_key] = {
              value: row.setting_value ? 'set' : '',
              masked: isSensitive ? maskValue(row.setting_value) : row.setting_value,
              updated_at: row.updated_at,
            };
          }
        }
      } catch {
        // Table may not exist yet
      }
    }

    return NextResponse.json({
      success: true,
      env: envSettings,
      db: dbSettings,
      source_info: 'Environment variables are the primary source. Database stores a backup copy.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// POST: Save M-Pesa settings to database (backup) and update runtime env
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is an authenticated admin
    const auth = await verifyAdminAuth(request);
    if (!auth.authenticated) {
      return auth.response;
    }
    if (!auth.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin privileges required to modify M-Pesa settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, message: 'Settings object is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 }
      );
    }

    const results: { key: string; saved: boolean }[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!ENV_KEY_MAP[key]) continue; // Skip unknown keys

      // Save to database (backup)
      try {
        const { error } = await supabase
          .from('mpesa_settings')
          .upsert(
            {
              setting_key: key,
              setting_value: value || '',
              is_sensitive: SENSITIVE_KEYS.has(key),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'setting_key' }
          );

        if (error) throw error;

        // Update runtime environment variable so changes take effect immediately
        const envKey = ENV_KEY_MAP[key];
        if (envKey && value !== undefined) {
          process.env[envKey] = value;
        }

        results.push({ key, saved: true });
      } catch (err) {
        console.error(`Failed to save ${key}:`, err);
        results.push({ key, saved: false });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'M-Pesa settings saved to database backup and applied to runtime',
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
