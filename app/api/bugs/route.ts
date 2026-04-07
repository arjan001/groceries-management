import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/bugs - List all tracked bugs/errors
 * Supports query params: ?status=open&severity=critical&limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 });
    }

    // Ensure the table exists
    await ensureBugTable(supabase);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    let query = supabase
      .from('system_bugs')
      .select('*', { count: 'exact' })
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') query = query.eq('status', status);
    if (severity && severity !== 'all') query = query.eq('severity', severity);
    if (category && category !== 'all') query = query.eq('category', category);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,module.ilike.%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Also fetch summary stats
    const { data: allBugs } = await supabase.from('system_bugs').select('status, severity');
    const stats = {
      total: allBugs?.length || 0,
      open: allBugs?.filter(b => b.status === 'open').length || 0,
      in_progress: allBugs?.filter(b => b.status === 'in_progress').length || 0,
      resolved: allBugs?.filter(b => b.status === 'resolved').length || 0,
      critical: allBugs?.filter(b => b.severity === 'critical').length || 0,
      high: allBugs?.filter(b => b.severity === 'high').length || 0,
    };

    return NextResponse.json({
      success: true,
      bugs: data || [],
      count: count || 0,
      stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * PATCH /api/bugs - Update a bug's status or details
 * Body: { id, status?, severity?, notes? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 });
    }

    const body = await req.json();
    const { id, status, severity, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: 'Bug ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (severity) updates.severity = severity;
    if (notes !== undefined) updates.notes = notes;
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('system_bugs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bug: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * Ensure the system_bugs table exists. Creates it if missing.
 */
async function ensureBugTable(supabase: ReturnType<typeof createClient>) {
  const { error } = await supabase.from('system_bugs').select('id').limit(1);
  if (error && error.code === '42P01') {
    // Table doesn't exist, create it
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS system_bugs (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL DEFAULT 'error',
          severity TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'open',
          module TEXT,
          source TEXT DEFAULT 'auto_scan',
          error_code TEXT,
          stack_trace TEXT,
          endpoint TEXT,
          http_status INTEGER,
          request_details JSONB,
          occurrence_count INTEGER DEFAULT 1,
          first_detected_at TIMESTAMPTZ DEFAULT NOW(),
          detected_at TIMESTAMPTZ DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          notes TEXT,
          scan_id TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_system_bugs_status ON system_bugs(status);
        CREATE INDEX IF NOT EXISTS idx_system_bugs_severity ON system_bugs(severity);
        CREATE INDEX IF NOT EXISTS idx_system_bugs_category ON system_bugs(category);
        CREATE INDEX IF NOT EXISTS idx_system_bugs_detected ON system_bugs(detected_at);
      `,
    });
  }
}
