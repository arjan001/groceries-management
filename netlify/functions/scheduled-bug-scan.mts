import type { Config, Context } from "@netlify/functions";

/**
 * Netlify Scheduled Function: Automatic Bug Scanner
 * Runs every 6 hours to scan the system for bugs, errors, and issues.
 *
 * This function calls the /api/bugs/scan endpoint with a shared secret
 * to authenticate the scheduled request.
 */
export default async function handler(req: Request, context: Context) {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:3000';
  const scanSecret = process.env.BUG_SCAN_SECRET;

  if (!scanSecret) {
    console.error('[Bug Scanner] BUG_SCAN_SECRET environment variable is not set. Skipping scheduled scan.');
    return new Response(JSON.stringify({ success: false, message: 'BUG_SCAN_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`[Bug Scanner] Starting scheduled system scan at ${new Date().toISOString()}`);

    const response = await fetch(`${siteUrl}/api/bugs/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scan-secret': scanSecret,
      },
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[Bug Scanner] Scan completed. Issues found: ${result.issues_found}, New: ${result.new_bugs}, Updated: ${result.updated_bugs}, Auto-resolved: ${result.auto_resolved}`);
    } else {
      console.error(`[Bug Scanner] Scan failed: ${result.message}`);
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Bug Scanner] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Run every 6 hours (at 00:00, 06:00, 12:00, 18:00 UTC)
export const config: Config = {
  schedule: "0 */6 * * *",
};
