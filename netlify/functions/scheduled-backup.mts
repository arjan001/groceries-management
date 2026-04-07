import type { Config, Context } from "@netlify/functions";

/**
 * Netlify Scheduled Function: Daily Backup
 * Runs every day at midnight (00:00 UTC) to trigger a full database backup.
 *
 * This function calls the /api/backup/run endpoint with a shared secret
 * to authenticate the scheduled request.
 */
export default async function handler(req: Request, context: Context) {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:3000';
  const backupSecret = process.env.BACKUP_SECRET;

  if (!backupSecret) {
    console.error('BACKUP_SECRET environment variable is not set. Skipping scheduled backup.');
    return new Response(JSON.stringify({ success: false, message: 'BACKUP_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`[Scheduled Backup] Starting daily backup at ${new Date().toISOString()}`);

    const response = await fetch(`${siteUrl}/api/backup/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-backup-secret': backupSecret,
      },
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[Scheduled Backup] Completed successfully. Tables: ${result.backup?.tableCount}, Rows: ${result.backup?.totalRows}`);
    } else {
      console.error(`[Scheduled Backup] Failed: ${result.message}`);
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduled Backup] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Run daily at midnight UTC
export const config: Config = {
  schedule: "0 0 * * *",
};
