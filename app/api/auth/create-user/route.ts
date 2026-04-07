import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

/**
 * Server-side API route that creates a Supabase Auth user using the service role key.
 * This bypasses email confirmation and does NOT affect the calling user's session.
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
        { success: false, message: 'Admin privileges required to create users' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, fullName, role } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'Invalid email format' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Fall back to anon key sign-up if service role key is not available
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        return NextResponse.json({ success: false, message: 'Server configuration missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.' }, { status: 500 });
      }
      const supabaseAnon = createClient(supabaseUrl, anonKey);
      const { data, error } = await supabaseAnon.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '', role: role || 'Viewer' },
        },
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      // Also insert into users table
      if (data.user) {
        try {
          await supabaseAnon.from('users').upsert({
            id: data.user.id,
            email,
            full_name: fullName || '',
            is_active: true,
            last_login: null,
          }, { onConflict: 'id' });
        } catch {
          // users table may not exist yet
        }
      }
      return NextResponse.json({ success: true, userId: data.user?.id, emailConfirmationRequired: true });
    }

    // Use admin API to create user with confirmed email
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || '', role: role || 'Viewer' },
    });

    if (error) {
      // If user already exists, try updating their password
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        try {
          // Find the user and update password
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = userList?.users?.find(u => u.email === email);
          if (existingUser) {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName || '', role: role || 'Viewer' },
            });
            // Also upsert into users table
            try {
              await supabaseAdmin.from('users').upsert({
                id: existingUser.id,
                email,
                full_name: fullName || '',
                is_active: true,
              }, { onConflict: 'id' });
            } catch {
              // users table may not exist
            }
            return NextResponse.json({ success: true, userId: existingUser.id, updated: true });
          }
        } catch (updateErr) {
          const msg = updateErr instanceof Error ? updateErr.message : 'Failed to update existing user';
          return NextResponse.json({ success: false, message: msg }, { status: 400 });
        }
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    // Insert into users table so the user can be tracked
    if (data.user) {
      try {
        await supabaseAdmin.from('users').upsert({
          id: data.user.id,
          email,
          full_name: fullName || '',
          is_active: true,
          last_login: null,
        }, { onConflict: 'id' });
      } catch {
        // users table may not exist yet
      }
    }

    return NextResponse.json({ success: true, userId: data.user?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
