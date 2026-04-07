import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      console.error('B2C result callback received empty body');
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      console.error('B2C result callback received invalid JSON:', text.substring(0, 200));
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const result = body.Result as Record<string, unknown> | undefined;
    if (!result) {
      console.error('B2C result callback missing Result object');
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const {
      ResultType,
      ResultCode,
      ResultDesc,
      OriginatorConversationID,
      ConversationID,
      TransactionID,
      ResultParameters,
    } = result;

    console.log('B2C Result Callback:', {
      ResultType,
      ResultCode,
      ResultDesc,
      OriginatorConversationID,
      ConversationID,
      TransactionID,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (ResultCode === 0) {
      // Payment successful - extract metadata
      const params = (ResultParameters as { ResultParameter?: Array<{ Key: string; Value: unknown }> })?.ResultParameter || [];
      const getParam = (key: string) => params.find(p => p.Key === key)?.Value;

      const transactionAmount = getParam('TransactionAmount');
      const transactionReceipt = getParam('TransactionReceipt');
      const receiverPartyPublicName = getParam('ReceiverPartyPublicName');
      const transactionCompletedDateTime = getParam('TransactionCompletedDateTime');
      const b2cUtilityAccountAvailableFunds = getParam('B2CUtilityAccountAvailableFunds');
      const b2cWorkingAccountAvailableFunds = getParam('B2CWorkingAccountAvailableFunds');

      console.log('B2C Payment Success:', {
        transactionReceipt,
        transactionAmount,
        receiverPartyPublicName,
        transactionCompletedDateTime,
      });

      await supabase
        .from('b2c_transactions')
        .update({
          mpesa_receipt: transactionReceipt as string,
          transaction_id: TransactionID as string,
          result_code: ResultCode,
          result_desc: ResultDesc as string,
          receiver_name: receiverPartyPublicName as string,
          completed_at: transactionCompletedDateTime as string,
          utility_balance: b2cUtilityAccountAvailableFunds as number,
          working_balance: b2cWorkingAccountAvailableFunds as number,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`);
    } else {
      // Payment failed
      console.log('B2C Payment Failed:', { ResultCode, ResultDesc, ConversationID });

      await supabase
        .from('b2c_transactions')
        .update({
          transaction_id: TransactionID as string,
          result_code: ResultCode as number,
          result_desc: ResultDesc as string,
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('B2C result callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Error' });
  }
}
