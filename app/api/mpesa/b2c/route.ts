import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper: get Supabase admin client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// B2C config from env vars, fallback to database
let _dbCache: Record<string, string> | null = null;
let _dbCacheTime = 0;
const CACHE_TTL = 60_000;

async function getB2CConfig(): Promise<Record<string, string>> {
  const envConfig: Record<string, string> = {
    shortcode: (process.env.MPESA_B2C_SHORTCODE || '').trim(),
    initiator_name: (process.env.MPESA_B2C_INITIATOR_NAME || '').trim(),
    security_credential: (process.env.MPESA_B2C_SECURITY_CREDENTIAL || '').trim(),
    consumer_key: (process.env.MPESA_B2C_CONSUMER_KEY || '').trim(),
    consumer_secret: (process.env.MPESA_B2C_CONSUMER_SECRET || '').trim(),
    result_url: (process.env.MPESA_B2C_RESULT_URL || '').trim(),
    timeout_url: (process.env.MPESA_B2C_TIMEOUT_URL || '').trim(),
    env: (process.env.MPESA_ENV || 'sandbox').trim(),
  };

  if (envConfig.shortcode && envConfig.consumer_key && envConfig.consumer_secret && envConfig.security_credential) {
    return envConfig;
  }

  // Fallback: load from database
  try {
    const now = Date.now();
    if (!_dbCache || now - _dbCacheTime > CACHE_TTL) {
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase.from('mpesa_settings').select('setting_key, setting_value');
        if (data) {
          _dbCache = {};
          for (const row of data) {
            _dbCache[row.setting_key] = row.setting_value;
          }
          _dbCacheTime = now;
        }
      }
    }

    if (_dbCache) {
      const dbMap: Record<string, string> = {
        shortcode: _dbCache.mpesa_b2c_shortcode || '',
        initiator_name: _dbCache.mpesa_b2c_initiator_name || '',
        security_credential: _dbCache.mpesa_b2c_security_credential || '',
        consumer_key: _dbCache.mpesa_b2c_consumer_key || '',
        consumer_secret: _dbCache.mpesa_b2c_consumer_secret || '',
        result_url: _dbCache.mpesa_b2c_result_url || '',
        timeout_url: _dbCache.mpesa_b2c_timeout_url || '',
        env: _dbCache.mpesa_env || 'sandbox',
      };

      for (const key of Object.keys(envConfig)) {
        if (!envConfig[key] && dbMap[key]) {
          envConfig[key] = dbMap[key];
        }
      }
    }
  } catch {
    // DB fallback failed
  }

  return envConfig;
}

function getAuthUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
}

function getB2CUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest';
}

async function getAccessToken(config: Record<string, string>): Promise<string> {
  if (!config.consumer_key || !config.consumer_secret) {
    throw new Error('B2C consumer key and secret are not configured.');
  }

  const auth = Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64');
  const response = await fetch(getAuthUrl(config.env), {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });

  const text = await response.text();
  if (!text) throw new Error('Empty response from M-Pesa auth endpoint');

  const data = JSON.parse(text);
  if (!data.access_token) {
    throw new Error(`B2C auth failed: ${data.errorMessage || data.error_description || 'Unknown error'}`);
  }

  return data.access_token;
}

function formatPhone(phone: string): string {
  let formatted = phone.replace(/\s/g, '');
  if (formatted.startsWith('+')) formatted = formatted.substring(1);
  if (formatted.startsWith('0')) formatted = '254' + formatted.substring(1);
  if (!formatted.startsWith('254')) formatted = '254' + formatted;
  return formatted;
}

// Valid B2C command IDs
const VALID_COMMANDS = ['SalaryPayment', 'BusinessPayment', 'PromotionPayment'] as const;
type B2CCommand = typeof VALID_COMMANDS[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle status query
    if (body.action === 'query') {
      return handleB2CQuery(body.conversationId);
    }

    // Handle list recent B2C transactions
    if (body.action === 'list') {
      return handleB2CList(body.limit || 20, body.status);
    }

    const {
      phone,
      amount,
      commandId = 'BusinessPayment',
      remarks = 'Payment',
      occasion = '',
    } = body;

    if (!phone || !amount) {
      return NextResponse.json(
        { success: false, message: 'Phone number and amount are required' },
        { status: 400 }
      );
    }

    if (amount <= 0 || amount > 150000) {
      return NextResponse.json(
        { success: false, message: 'Amount must be between 1 and 150,000 KES' },
        { status: 400 }
      );
    }

    if (!VALID_COMMANDS.includes(commandId as B2CCommand)) {
      return NextResponse.json(
        { success: false, message: `Invalid command. Use: ${VALID_COMMANDS.join(', ')}` },
        { status: 400 }
      );
    }

    const config = await getB2CConfig();

    if (!config.shortcode || !config.consumer_key || !config.consumer_secret || !config.security_credential) {
      return NextResponse.json(
        { success: false, message: 'B2C credentials are not configured. Please set them in Admin Settings > M-Pesa API > B2C Configuration.' },
        { status: 500 }
      );
    }

    const formattedPhone = formatPhone(phone);
    const accessToken = await getAccessToken(config);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const resultUrl = config.result_url || `${siteUrl}/api/mpesa/b2c/result`;
    const timeoutUrl = config.timeout_url || `${siteUrl}/api/mpesa/b2c/timeout`;

    const payload = {
      OriginatorConversationID: `b2c_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      InitiatorName: config.initiator_name,
      SecurityCredential: config.security_credential,
      CommandID: commandId,
      Amount: Math.floor(amount),
      PartyA: config.shortcode,
      PartyB: formattedPhone,
      Remarks: remarks.substring(0, 100),
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
      Occasion: occasion.substring(0, 100),
    };

    const response = await fetch(getB2CUrl(config.env), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!text) {
      return NextResponse.json(
        { success: false, message: 'Empty response from M-Pesa B2C API' },
        { status: 502 }
      );
    }

    const data = JSON.parse(text);

    if (data.ResponseCode === '0') {
      // Store transaction in database
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('b2c_transactions').insert({
            conversation_id: data.ConversationID || payload.OriginatorConversationID,
            originator_conversation_id: data.OriginatorConversationID || payload.OriginatorConversationID,
            phone: formattedPhone,
            amount: Math.floor(amount),
            command_id: commandId,
            remarks: remarks,
            occasion: occasion,
            status: 'pending',
          });
        } catch (e) {
          console.error('Failed to store B2C transaction:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'B2C payment initiated successfully',
        conversationId: data.ConversationID,
        originatorConversationId: data.OriginatorConversationID || payload.OriginatorConversationID,
        responseDescription: data.ResponseDescription,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: data.errorMessage || data.ResponseDescription || 'B2C payment request failed',
          responseCode: data.ResponseCode,
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `B2C error: ${message}` },
      { status: 500 }
    );
  }
}

// Query a specific B2C transaction status
async function handleB2CQuery(conversationId: string) {
  if (!conversationId) {
    return NextResponse.json(
      { success: false, message: 'conversationId is required' },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 }
    );
  }

  const { data: txn } = await supabase
    .from('b2c_transactions')
    .select('*')
    .or(`conversation_id.eq.${conversationId},originator_conversation_id.eq.${conversationId}`)
    .single();

  if (!txn) {
    return NextResponse.json({ success: false, status: 'not_found', message: 'Transaction not found' });
  }

  return NextResponse.json({
    success: txn.status === 'completed',
    status: txn.status,
    transaction: {
      id: txn.id,
      phone: txn.phone,
      amount: txn.amount,
      commandId: txn.command_id,
      mpesaRef: txn.mpesa_receipt,
      resultDesc: txn.result_desc,
      completedAt: txn.updated_at,
    },
  });
}

// List recent B2C transactions
async function handleB2CList(limit: number, status?: string) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 }
    );
  }

  let query = supabase
    .from('b2c_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    transactions: data || [],
    count: data?.length || 0,
  });
}
