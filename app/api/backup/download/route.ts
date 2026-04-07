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
 * GET /api/backup/download?id=backup_2024-01-01T00-00-00-000Z
 * Downloads a specific backup file as JSON.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;

    const backupId = req.nextUrl.searchParams.get('id');
    if (!backupId) {
      return NextResponse.json(
        { success: false, message: 'Backup ID is required (use ?id=...)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase
      .from('backups')
      .select('backup_data, filename')
      .eq('backup_id', backupId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Backup not found' },
        { status: 404 }
      );
    }

    // Return as a downloadable JSON file
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Content-Disposition', `attachment; filename="${data.filename}"`);

    return new NextResponse(data.backup_data, { status: 200, headers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * DELETE /api/backup/download?id=backup_2024-01-01T00-00-00-000Z
 * Delete a specific backup.
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;

    const backupId = req.nextUrl.searchParams.get('id');
    if (!backupId) {
      return NextResponse.json(
        { success: false, message: 'Backup ID is required (use ?id=...)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 }
      );
    }

    const { error } = await supabase
      .from('backups')
      .delete()
      .eq('backup_id', backupId);

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Backup deleted' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
