import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';
import { exportAllTables } from '@/lib/backup';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * POST /api/backup/run - Run a manual backup
 * Exports all Supabase tables to JSON and stores the backup in the backups table.
 */
export async function POST(req: NextRequest) {
  try {
    // Check for scheduled function secret OR admin auth
    const scheduledSecret = req.headers.get('x-backup-secret');
    const isScheduled = scheduledSecret === process.env.BACKUP_SECRET;

    if (!isScheduled) {
      const auth = await verifyAdminAuth(req);
      if (!auth.authenticated) return auth.response;
    }

    const trigger = isScheduled ? 'scheduled' : 'manual';

    // Export all tables
    const { jsonStr, metadata } = await exportAllTables(trigger);

    // Store backup in Supabase storage or as a record in a backups table
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 }
      );
    }

    // Store the backup data in a dedicated backups table
    const { error: insertError } = await supabase
      .from('backups')
      .insert({
        backup_id: metadata.id,
        filename: metadata.filename,
        backup_data: jsonStr,
        size_bytes: metadata.sizeBytes,
        table_count: metadata.tableCount,
        total_rows: metadata.totalRows,
        trigger: metadata.trigger,
        status: metadata.status,
        errors: metadata.errors || null,
        created_at: metadata.createdAt,
      });

    if (insertError) {
      console.error('Failed to store backup:', insertError.message);
      return NextResponse.json(
        { success: false, message: `Backup created but storage failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Clean up old backups beyond retention period
    try {
      const { data: settings } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'backup')
        .single();

      let retentionDays = 30;
      if (settings?.value) {
        const parsed = typeof settings.value === 'string' ? JSON.parse(settings.value) : settings.value;
        if (parsed.retentionDays) {
          retentionDays = parsed.retentionDays;
        }
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await supabase
        .from('backups')
        .delete()
        .lt('created_at', cutoffDate.toISOString());
    } catch (cleanupErr) {
      console.error('Backup cleanup failed (non-critical):', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      message: `Backup completed successfully (${trigger})`,
      backup: metadata,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Backup run error:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
