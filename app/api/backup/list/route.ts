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
 * GET /api/backup/list - List all available backups
 * Returns metadata for all stored backups, sorted by newest first.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('backups')
      .select('backup_id, filename, size_bytes, table_count, total_rows, trigger, status, errors, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      backups: data || [],
      count: data?.length || 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
