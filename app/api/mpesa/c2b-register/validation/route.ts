import { NextRequest, NextResponse } from 'next/server';

// C2B Validation URL - M-Pesa calls this before processing a payment
// Return ResultCode 0 to accept, non-zero to reject
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
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const {
      TransactionType,
      TransID,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      MSISDN,
      FirstName,
    } = body;

    console.log('C2B Validation Request:', {
      TransactionType,
      TransID,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      MSISDN,
      FirstName,
    });

    // Validation logic: Accept all payments by default
    // Add custom validation rules here if needed, e.g.:
    // - Reject payments below minimum amount
    // - Reject unknown bill reference numbers
    // - Reject payments to wrong shortcode

    const amount = Number(TransAmount);
    if (amount <= 0) {
      return NextResponse.json({ ResultCode: 'C2B00012', ResultDesc: 'Invalid amount' });
    }

    // Accept the payment
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('C2B validation error:', error);
    // Accept on error to avoid blocking payments
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
