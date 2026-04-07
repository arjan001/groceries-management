import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/api-auth';

/**
 * Server-side API route that sends welcome emails to newly created users
 * using the Resend API. Shares login credentials (email/username and password)
 * with the new user at their email address.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an authenticated admin
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) {
      return auth.response;
    }
    if (!auth.user.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin privileges required to send emails' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { recipientEmail, recipientName, loginEmail, loginPassword, loginRole, businessName } = body;

    if (!recipientEmail || !loginEmail || !loginPassword) {
      return NextResponse.json(
        { success: false, message: 'Recipient email, login email, and password are required' },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { success: false, message: 'Email service not configured. Set RESEND_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const fromName = process.env.RESEND_FROM_NAME || businessName || 'System Admin';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Your Account Has Been Created</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${fromName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#18181b;margin:0 0 16px;font-size:20px;">Welcome${recipientName ? `, ${recipientName}` : ''}!</h2>
              <p style="color:#52525b;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Your account has been created on the ${fromName} management system. Below are your login credentials. Please keep them safe and change your password after first login.
              </p>
              <!-- Credentials Box -->
              <div style="background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:24px;margin:0 0 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;">
                      <span style="color:#71717a;font-size:13px;display:block;">Login Email / Username</span>
                      <span style="color:#18181b;font-size:16px;font-weight:600;">${loginEmail}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-top:1px solid #e4e4e7;">
                      <span style="color:#71717a;font-size:13px;display:block;">Password</span>
                      <span style="color:#18181b;font-size:16px;font-weight:600;font-family:monospace;">${loginPassword}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-top:1px solid #e4e4e7;">
                      <span style="color:#71717a;font-size:13px;display:block;">Role</span>
                      <span style="color:#18181b;font-size:16px;font-weight:600;">${loginRole || 'Viewer'}</span>
                    </td>
                  </tr>
                </table>
              </div>
              <!-- Login Button -->
              <div style="text-align:center;margin:0 0 24px;">
                <a href="${siteUrl}/auth/login" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                  Login to Your Account
                </a>
              </div>
              <p style="color:#a1a1aa;font-size:13px;line-height:1.5;margin:0;text-align:center;">
                For security, please change your password immediately after your first login. If you did not expect this email, please contact your administrator.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:20px 40px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="color:#a1a1aa;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send email using Resend REST API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `Welcome to ${fromName} - Your Login Credentials`,
        html: htmlContent,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return NextResponse.json(
        { success: false, message: result.message || 'Failed to send email' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Email sending error:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
