import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// C2B Confirmation URL - M-Pesa calls this after a successful payment
export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      console.error('C2B confirmation received invalid JSON:', text.substring(0, 200));
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const {
      TransactionType,
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
      MiddleName,
      LastName,
    } = body;

    console.log('C2B Payment Confirmation:', {
      TransactionType,
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      FirstName,
      LastName,
    });

    // Store the payment in the database
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      try {
        await supabase.from('c2b_payments').insert({
          transaction_type: TransactionType as string,
          transaction_id: TransID as string,
          transaction_time: TransTime as string,
          amount: Number(TransAmount),
          business_shortcode: BusinessShortCode as string,
          bill_ref_number: BillRefNumber as string,
          invoice_number: InvoiceNumber as string,
          org_account_balance: Number(OrgAccountBalance) || null,
          third_party_trans_id: ThirdPartyTransID as string,
          phone: String(MSISDN),
          first_name: FirstName as string,
          middle_name: MiddleName as string,
          last_name: LastName as string,
        });
      } catch (e) {
        console.error('Failed to store C2B payment:', e);
      }

      // Also try to match with any pending mpesa_transactions by phone and amount
      try {
        const formatted = String(MSISDN);
        const amount = Number(TransAmount);
        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();

        const { data: pendingTxn } = await supabase
          .from('mpesa_transactions')
          .select('id')
          .eq('phone', formatted)
          .eq('amount', Math.ceil(amount))
          .eq('status', 'pending')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (pendingTxn) {
          await supabase
            .from('mpesa_transactions')
            .update({
              mpesa_receipt: TransID as string,
              status: 'completed',
              result_code: 0,
              result_desc: 'Confirmed via C2B',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingTxn.id);
        }
      } catch {
        // No matching pending transaction - that's OK
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B confirmation error:', error);
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
