import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      console.error('B2C timeout callback received empty body');
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      console.error('B2C timeout callback received invalid JSON:', text.substring(0, 200));
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const result = body.Result as Record<string, unknown> | undefined;
    if (!result) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { OriginatorConversationID, ConversationID, ResultDesc } = result;

    console.log('B2C Timeout Callback:', { OriginatorConversationID, ConversationID, ResultDesc });

    // Update the transaction as timed out
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from('b2c_transactions')
        .update({
          result_desc: (ResultDesc as string) || 'Transaction timed out',
          status: 'timeout',
          updated_at: new Date().toISOString(),
        })
        .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('B2C timeout callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Error' });
  }
}
