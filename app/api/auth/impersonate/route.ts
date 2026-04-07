import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

/**
 * Server-side API route that generates a magic link for admin impersonation.
 * Uses the Supabase Admin API so no password is needed.
 * The magic link logs the target user in when visited.
 * Requires admin authentication.
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
        { success: false, message: 'Admin privileges required for impersonation' },
        { status: 403 }
      );
    }

    const { email, adminEmail, adminName, targetName } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, message: 'Target email is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, message: 'Service role key is not configured. Impersonation requires admin API access.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the target user exists in auth
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: 'No auth account found for this email. The employee may not have system access configured.' },
        { status: 404 }
      );
    }

    // Determine the redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const redirectTo = `${siteUrl}/admin`;

    // Generate a magic link (does NOT send an email)
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: { redirectTo },
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json({ success: false, message: 'Failed to generate login link' }, { status: 500 });
    }

    // Log the impersonation in the audit_log table
    try {
      await supabaseAdmin.from('audit_log').insert({
        user_name: adminName || 'Admin',
        action: 'LOGIN',
        module: 'Impersonation',
        record_id: targetUser.id,
        details: {
          type: 'admin_impersonation',
          admin_email: adminEmail,
          admin_name: adminName,
          target_email: email,
          target_name: targetName,
        },
      });
    } catch {
      // Audit log failure should not block impersonation
    }

    return NextResponse.json({ success: true, url: actionLink });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
