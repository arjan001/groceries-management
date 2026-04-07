import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      console.error('M-Pesa callback received empty body');
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      console.error('M-Pesa callback received invalid JSON:', text.substring(0, 200));
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { Body } = body as { Body?: { stkCallback?: Record<string, unknown> } };

    if (Body?.stkCallback) {
      const { ResultCode, ResultDesc, CallbackMetadata, CheckoutRequestID } = Body.stkCallback;

      if (ResultCode === 0) {
        const metadata = (CallbackMetadata as { Item?: Array<{ Name: string; Value: unknown }> })?.Item || [];
        const amount = metadata.find((item: { Name: string }) => item.Name === 'Amount')?.Value;
        const mpesaRef = metadata.find((item: { Name: string }) => item.Name === 'MpesaReceiptNumber')?.Value;
        const phone = metadata.find((item: { Name: string }) => item.Name === 'PhoneNumber')?.Value;

        console.log('M-Pesa Payment Success:', {
          checkoutRequestId: CheckoutRequestID,
          amount,
          mpesaRef,
          phone,
        });

        // Update payment record in Supabase
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Update pos_sales where mpesa_phone matches and status is pending
          await supabase
            .from('mpesa_transactions')
            .update({
              mpesa_receipt: mpesaRef,
              phone: String(phone),
              amount,
              result_code: ResultCode,
              result_desc: ResultDesc,
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('checkout_request_id', CheckoutRequestID);
        }
      } else {
        console.log('M-Pesa Payment Failed:', { ResultCode, ResultDesc, CheckoutRequestID });

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          await supabase
            .from('mpesa_transactions')
            .update({
              result_code: ResultCode,
              result_desc: ResultDesc,
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('checkout_request_id', CheckoutRequestID);
        }
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Error' });
  }
}
