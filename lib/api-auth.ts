import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify that the request is coming from an authenticated user with a valid employee record.
 * Queries the employees table for the actual role and system_access status,
 * rather than relying on user metadata which can be stale.
 *
 * Use this in API routes that modify sensitive data.
 */
export async function verifyAdminAuth(req: NextRequest): Promise<
  | { authenticated: true; user: { id: string; email: string; role: string; permissions: string[]; isAdmin: boolean } }
  | { authenticated: false; response: NextResponse }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, message: 'Server configuration missing' },
        { status: 500 }
      ),
    };
  }

  // Extract the auth token from the Authorization header
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, message: 'Invalid or expired session' },
        { status: 401 }
      ),
    };
  }

  const email = user.email || '';

  // Query the employees table for the actual role and system_access status
  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('login_role, permissions, system_access')
    .eq('login_email', email)
    .single();

  if (emp && !emp.system_access) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, message: 'System access is disabled for this account' },
        { status: 403 }
      ),
    };
  }

  // Determine role from employees table, falling back to user metadata
  const role = emp?.login_role || (user.user_metadata?.role as string) || 'Viewer';
  const isAdmin = role === 'Admin' || role === 'Super Admin' || role === 'Administrator';

  // Parse permissions from employee record
  let permissions: string[] = [];
  if (emp?.permissions) {
    try {
      permissions = typeof emp.permissions === 'string'
        ? JSON.parse(emp.permissions)
        : (emp.permissions || []);
    } catch {
      permissions = [];
    }
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      email,
      role,
      permissions,
      isAdmin,
    },
  };
}
