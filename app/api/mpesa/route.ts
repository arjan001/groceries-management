import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Helper: resolve M-Pesa config from env vars first, fallback to database backup
let _dbSettingsCache: Record<string, string> | null = null;
let _dbSettingsCacheTime = 0;
const DB_CACHE_TTL = 60_000; // 1 minute

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getMpesaConfig(): Promise<Record<string, string>> {
  const envConfig: Record<string, string> = {
    consumer_key: (process.env.MPESA_CONSUMER_KEY || '').trim(),
    consumer_secret: (process.env.MPESA_CONSUMER_SECRET || '').trim(),
    shortcode: (process.env.MPESA_SHORTCODE || '').trim(),
    passkey: (process.env.MPESA_PASSKEY || '').trim(),
    callback_url: (process.env.MPESA_CALLBACK_URL || '').trim(),
    env: (process.env.MPESA_ENV || 'sandbox').trim(),
    transaction_type: (process.env.MPESA_TRANSACTION_TYPE || '').trim(),
  };

  // If all essential env vars are set, use them directly
  if (envConfig.consumer_key && envConfig.consumer_secret && envConfig.shortcode) {
    return envConfig;
  }

  // Fallback: load missing values from database backup
  try {
    const now = Date.now();
    if (!_dbSettingsCache || now - _dbSettingsCacheTime > DB_CACHE_TTL) {
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase.from('mpesa_settings').select('setting_key, setting_value');
        if (data) {
          _dbSettingsCache = {};
          for (const row of data) {
            _dbSettingsCache[row.setting_key] = row.setting_value;
          }
          _dbSettingsCacheTime = now;
        }
      }
    }

    if (_dbSettingsCache) {
      const dbMap: Record<string, string> = {
        consumer_key: _dbSettingsCache.mpesa_consumer_key || '',
        consumer_secret: _dbSettingsCache.mpesa_consumer_secret || '',
        shortcode: _dbSettingsCache.mpesa_shortcode || '',
        passkey: _dbSettingsCache.mpesa_passkey || '',
        callback_url: _dbSettingsCache.mpesa_callback_url || '',
        env: _dbSettingsCache.mpesa_env || 'sandbox',
        transaction_type: _dbSettingsCache.mpesa_transaction_type || '',
      };

      // Merge: env vars take precedence, DB fills gaps
      for (const key of Object.keys(envConfig)) {
        if (!envConfig[key] && dbMap[key]) {
          envConfig[key] = dbMap[key];
        }
      }
    }
  } catch {
    // DB fallback failed, continue with env vars only
  }

  return envConfig;
}

// M-Pesa Daraja API URL helpers
function getAuthUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
}

function getStkUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
}

function getQueryUrl(env: string) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
}

// Safely parse JSON from a fetch response, handling empty or non-JSON bodies
async function safeJsonParse(response: Response): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const status = response.status;
  const text = await response.text();

  if (!text || text.trim().length === 0) {
    return {
      ok: response.ok,
      status,
      data: { error: `Empty response from API (HTTP ${status})` },
    };
  }

  try {
    const data = JSON.parse(text);
    return { ok: response.ok, status, data };
  } catch {
    return {
      ok: false,
      status,
      data: { error: `Invalid JSON response from API (HTTP ${status}): ${text.substring(0, 200)}` },
    };
  }
}

// Token cache to reduce auth calls
let _tokenCache: { token: string; expiry: number } | null = null;

async function getAccessToken(config: Record<string, string>): Promise<string> {
  if (!config.consumer_key || !config.consumer_secret) {
    throw new Error('M-Pesa consumer key and secret are not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in your environment variables or admin settings.');
  }

  // Return cached token if still valid (with 60s buffer)
  if (_tokenCache && Date.now() < _tokenCache.expiry - 60_000) {
    return _tokenCache.token;
  }

  const auth = Buffer.from(
    `${config.consumer_key}:${config.consumer_secret}`
  ).toString('base64');

  const response = await fetch(getAuthUrl(config.env), {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });

  const result = await safeJsonParse(response);

  if (!result.ok || !result.data.access_token) {
    const errMsg = result.data.error || result.data.errorMessage || result.data.error_description || `Authentication failed (HTTP ${result.status})`;
    throw new Error(`M-Pesa auth failed: ${errMsg}`);
  }

  const token = result.data.access_token as string;
  const expiresIn = (result.data.expires_in as number) || 3599;
  _tokenCache = { token, expiry: Date.now() + expiresIn * 1000 };

  return token;
}

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function formatPhone(phone: string): string {
  let formatted = phone.replace(/\s/g, '');
  if (formatted.startsWith('+')) formatted = formatted.substring(1);
  if (formatted.startsWith('0')) formatted = '254' + formatted.substring(1);
  if (!formatted.startsWith('254')) formatted = '254' + formatted;
  return formatted;
}

// Validate Kenyan phone number format
function isValidKenyanPhone(phone: string): boolean {
  const formatted = formatPhone(phone);
  return /^254[17]\d{8}$/.test(formatted);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle STK query
    if (body.action === 'query') {
      return handleStkQuery(body.checkoutRequestId);
    }

    // Match latest completed payment by amount (no STK)
    if (body.action === 'match') {
      return handleMpesaMatch(body.amount, body.phone);
    }

    // Handle retry of a failed/expired STK push
    if (body.action === 'retry') {
      return handleStkRetry(body.checkoutRequestId);
    }

    // Handle STK push
    const { phone, amount, accountReference, description, transactionType } = body;

    if (!phone || !amount) {
      return NextResponse.json(
        { success: false, message: 'Phone number and amount are required' },
        { status: 400 }
      );
    }

    // Validate phone number
    if (!isValidKenyanPhone(phone)) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number. Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (amount > 150000) {
      return NextResponse.json(
        { success: false, message: 'Amount cannot exceed KES 150,000 per transaction' },
        { status: 400 }
      );
    }

    const config = await getMpesaConfig();

    if (!config.consumer_key || !config.consumer_secret) {
      return NextResponse.json(
        { success: false, message: 'M-Pesa API credentials are not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in your environment variables or configure them in Admin Settings > M-Pesa API.' },
        { status: 500 }
      );
    }

    const formattedPhone = formatPhone(phone);
    const accessToken = await getAccessToken(config);
    const timestamp = generateTimestamp();
    const shortcode = config.shortcode || '174379';
    const passkey = config.passkey || '';
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const callbackUrl = config.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/mpesa/callback`;

    // Determine transaction type: Paybill (CustomerPayBillOnline) or Till (CustomerBuyGoodsOnline)
    const txnType = transactionType || config.transaction_type || 'CustomerPayBillOnline';

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: txnType,
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: (accountReference || 'SNACKOH').substring(0, 12),
      TransactionDesc: (description || 'Payment').substring(0, 13),
    };

    const response = await fetch(getStkUrl(config.env), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const result = await safeJsonParse(response);
    const data = result.data;

    if (!result.ok && data.error) {
      return NextResponse.json(
        { success: false, message: `M-Pesa API error: ${data.error}` },
        { status: 502 }
      );
    }

    if (data.ResponseCode === '0') {
      // Store the transaction in Supabase for tracking
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('mpesa_transactions').insert({
            checkout_request_id: data.CheckoutRequestID,
            merchant_request_id: data.MerchantRequestID,
            phone: formattedPhone,
            amount: Math.ceil(amount),
            account_reference: accountReference || 'SNACKOH',
            status: 'pending',
          });
        } catch (e) {
          console.error('Failed to store mpesa transaction:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'STK Push sent successfully. Check your phone.',
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
      });
    } else {
      // Map common error codes to user-friendly messages
      const errorMsg = mapStkErrorMessage(data);
      return NextResponse.json(
        { success: false, message: errorMsg, data },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `M-Pesa error: ${message}` },
      { status: 500 }
    );
  }
}

// Map M-Pesa error codes to user-friendly messages
function mapStkErrorMessage(data: Record<string, unknown>): string {
  const errorCode = data.errorCode as string || data.ResponseCode as string || '';
  const defaultMsg = (data.errorMessage || data.CustomerMessage || 'STK Push failed') as string;

  const errorMap: Record<string, string> = {
    '1': 'Insufficient balance on the M-Pesa account.',
    '1032': 'Payment request was cancelled by the user.',
    '1037': 'STK Push timeout. The user did not respond in time. Please try again.',
    '2001': 'Wrong M-Pesa PIN entered. Please try again.',
    '1001': 'Unable to reach the phone. Please check the number and ensure the phone is on.',
    '1019': 'Transaction expired. Please initiate a new payment.',
    '1025': 'An STK push is already pending for this number. Please wait or try again shortly.',
    '500.001.1001': 'A duplicate STK push request was detected. Please wait a moment before retrying.',
  };

  return errorMap[errorCode] || defaultMsg;
}

async function handleMpesaMatch(amount: number, phone?: string) {
  if (!amount) {
    return NextResponse.json(
      { success: false, status: 'invalid', message: 'Amount is required' },
      { status: 400 }
    );
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, status: 'unavailable', message: 'Payment verification not available' },
      { status: 503 }
    );
  }

  const amountRounded = Math.ceil(amount);
  const windowMinutes = Number(process.env.MPESA_MATCH_WINDOW_MINUTES || 10);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Search in both mpesa_transactions (STK) and c2b_payments (direct paybill/till)
  let query = supabase
    .from('mpesa_transactions')
    .select('*')
    .in('status', ['completed', 'Completed', 'COMPLETED'])
    .eq('amount', amountRounded)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);

  if (phone) {
    query = query.eq('phone', formatPhone(phone));
  }

  const { data } = await query;
  const txn = Array.isArray(data) ? data[0] : null;

  if (txn) {
    return NextResponse.json({
      success: true,
      status: 'matched',
      source: 'stk',
      amount: txn.amount,
      phone: txn.phone,
      checkoutRequestId: txn.checkout_request_id,
      mpesaRef: txn.mpesa_receipt || null,
    });
  }

  // Also check C2B direct payments (paybill/till confirmations)
  try {
    let c2bQuery = supabase
      .from('c2b_payments')
      .select('*')
      .eq('amount', amountRounded)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);

    if (phone) {
      c2bQuery = c2bQuery.eq('phone', formatPhone(phone));
    }

    const { data: c2bData } = await c2bQuery;
    const c2bTxn = Array.isArray(c2bData) ? c2bData[0] : null;

    if (c2bTxn) {
      return NextResponse.json({
        success: true,
        status: 'matched',
        source: 'c2b',
        amount: c2bTxn.amount,
        phone: c2bTxn.phone,
        mpesaRef: c2bTxn.transaction_id || null,
        billRefNumber: c2bTxn.bill_ref_number,
        customerName: [c2bTxn.first_name, c2bTxn.middle_name, c2bTxn.last_name].filter(Boolean).join(' '),
      });
    }
  } catch {
    // c2b_payments table may not exist yet
  }

  return NextResponse.json({
    success: false,
    status: 'not_found',
    message: 'No matching payment found',
  });
}

// Retry a failed or expired STK push using the original transaction details
async function handleStkRetry(checkoutRequestId: string) {
  if (!checkoutRequestId) {
    return NextResponse.json(
      { success: false, message: 'checkoutRequestId is required for retry' },
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

  // Find the original transaction
  const { data: txn } = await supabase
    .from('mpesa_transactions')
    .select('*')
    .eq('checkout_request_id', checkoutRequestId)
    .single();

  if (!txn) {
    return NextResponse.json(
      { success: false, message: 'Original transaction not found' },
      { status: 404 }
    );
  }

  if (txn.status === 'completed') {
    return NextResponse.json({
      success: true,
      status: 'already_completed',
      message: 'This payment was already completed',
      mpesaRef: txn.mpesa_receipt,
    });
  }

  // Mark original as retried
  await supabase
    .from('mpesa_transactions')
    .update({ status: 'retried', updated_at: new Date().toISOString() })
    .eq('checkout_request_id', checkoutRequestId);

  // Re-initiate the STK push with the same details
  const config = await getMpesaConfig();
  const accessToken = await getAccessToken(config);
  const timestamp = generateTimestamp();
  const shortcode = config.shortcode || '174379';
  const passkey = config.passkey || '';
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const callbackUrl = config.callback_url || `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/mpesa/callback`;

  const txnType = config.transaction_type || 'CustomerPayBillOnline';

  const stkPayload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: txnType,
    Amount: txn.amount,
    PartyA: txn.phone,
    PartyB: shortcode,
    PhoneNumber: txn.phone,
    CallBackURL: callbackUrl,
    AccountReference: txn.account_reference || 'SNACKOH',
    TransactionDesc: 'Payment Retry',
  };

  const response = await fetch(getStkUrl(config.env), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(stkPayload),
  });

  const result = await safeJsonParse(response);
  const data = result.data;

  if (data.ResponseCode === '0') {
    // Store the new retry transaction
    try {
      await supabase.from('mpesa_transactions').insert({
        checkout_request_id: data.CheckoutRequestID,
        merchant_request_id: data.MerchantRequestID,
        phone: txn.phone,
        amount: txn.amount,
        account_reference: txn.account_reference || 'SNACKOH',
        status: 'pending',
      });
    } catch (e) {
      console.error('Failed to store retry transaction:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'STK Push re-sent. Check your phone.',
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      retriedFrom: checkoutRequestId,
    });
  } else {
    const errorMsg = mapStkErrorMessage(data);
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 400 }
    );
  }
}

async function handleStkQuery(checkoutRequestId: string) {
  try {
    // First check our database
    const supabase = getSupabase();

    if (supabase) {
      const { data: txn } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', checkoutRequestId)
        .single();

      if (txn && txn.status === 'completed') {
        return NextResponse.json({
          success: true,
          status: 'completed',
          mpesaRef: txn.mpesa_receipt,
          amount: txn.amount,
        });
      }

      if (txn && txn.status === 'failed') {
        return NextResponse.json({
          success: false,
          status: 'failed',
          message: txn.result_desc || 'Payment failed or cancelled',
        });
      }

      // Auto-expire pending transactions older than 2 minutes
      if (txn && txn.status === 'pending') {
        const createdAt = new Date(txn.created_at).getTime();
        const elapsed = Date.now() - createdAt;
        if (elapsed > 120_000) {
          // Mark as expired and return
          await supabase
            .from('mpesa_transactions')
            .update({ status: 'expired', result_desc: 'STK push expired (no response within 2 minutes)', updated_at: new Date().toISOString() })
            .eq('checkout_request_id', checkoutRequestId);

          return NextResponse.json({
            success: false,
            status: 'expired',
            message: 'Payment request expired. The customer did not respond in time. You can retry the payment.',
            canRetry: true,
          });
        }
      }
    }

    // Fall back to querying M-Pesa API directly
    const config = await getMpesaConfig();
    const accessToken = await getAccessToken(config);
    const timestamp = generateTimestamp();
    const shortcode = config.shortcode || '174379';
    const passkey = config.passkey || '';
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const response = await fetch(getQueryUrl(config.env), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });

    const result = await safeJsonParse(response);
    const data = result.data;

    if (!result.ok && data.error) {
      return NextResponse.json({
        success: false,
        status: 'pending',
        message: `Unable to verify payment: ${data.error}`,
      });
    }

    if (data.ResultCode === '0' || data.ResultCode === 0) {
      // Update DB if we have supabase
      if (supabase) {
        await supabase
          .from('mpesa_transactions')
          .update({ status: 'completed', result_desc: data.ResultDesc as string, updated_at: new Date().toISOString() })
          .eq('checkout_request_id', checkoutRequestId);
      }

      return NextResponse.json({
        success: true,
        status: 'completed',
        message: data.ResultDesc,
      });
    } else {
      const resultCode = String(data.ResultCode);
      const statusMap: Record<string, string> = {
        '1032': 'cancelled',
        '1037': 'expired',
        '1': 'failed',
        '2001': 'failed',
      };
      const status = statusMap[resultCode] || 'pending';
      const canRetry = status === 'expired' || status === 'cancelled';

      return NextResponse.json({
        success: false,
        status,
        message: mapStkErrorMessage(data),
        canRetry,
      });
    }
  } catch (error) {
    console.error('STK query error:', error);
    return NextResponse.json({
      success: false,
      status: 'pending',
      message: 'Unable to verify payment status',
    });
  }
}
