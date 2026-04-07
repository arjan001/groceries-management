import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface BugReport {
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  module: string;
  source: string;
  error_code?: string;
  endpoint?: string;
  http_status?: number;
  request_details?: Record<string, unknown>;
  stack_trace?: string;
}

/**
 * POST /api/bugs/scan - Run a comprehensive system scan
 * Can be triggered manually by admin or by the scheduled function.
 * Accepts optional header x-scan-secret for scheduled function auth.
 */
export async function POST(req: NextRequest) {
  const scanSecret = req.headers.get('x-scan-secret');
  const isCronTrigger = scanSecret && scanSecret === process.env.BUG_SCAN_SECRET;

  // Allow either admin auth or cron secret
  if (!isCronTrigger) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authenticated) return auth.response;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 });
  }

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const bugs: BugReport[] = [];
  const scanStart = Date.now();

  try {
    // ─── 1. Database Connectivity & Table Health ─────────────────────────────
    await scanDatabaseHealth(supabase, bugs);

    // ─── 2. API Endpoint Health Checks ───────────────────────────────────────
    await scanApiEndpoints(supabase, bugs);

    // ─── 3. Data Integrity Checks ────────────────────────────────────────────
    await scanDataIntegrity(supabase, bugs);

    // ─── 4. Security Audit ───────────────────────────────────────────────────
    await scanSecurityIssues(supabase, bugs);

    // ─── 5. Configuration Checks ─────────────────────────────────────────────
    await scanConfigurationIssues(supabase, bugs);

    // ─── 6. Performance & Resource Checks ────────────────────────────────────
    await scanPerformanceIssues(supabase, bugs);

    // ─── 7. Stale Data & Cleanup Checks ──────────────────────────────────────
    await scanStaleData(supabase, bugs);

    // ─── Store discovered bugs ──────────────────────────────────────────────
    let newBugs = 0;
    let updatedBugs = 0;

    for (const bug of bugs) {
      // Check if this bug already exists (by title + module + category)
      const { data: existing } = await supabase
        .from('system_bugs')
        .select('id, occurrence_count, status')
        .eq('title', bug.title)
        .eq('module', bug.module)
        .eq('category', bug.category)
        .neq('status', 'resolved')
        .limit(1)
        .single();

      if (existing) {
        // Update occurrence count and last detected time
        await supabase
          .from('system_bugs')
          .update({
            occurrence_count: (existing.occurrence_count || 1) + 1,
            detected_at: new Date().toISOString(),
            scan_id: scanId,
            description: bug.description,
            severity: bug.severity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updatedBugs++;
      } else {
        // Insert new bug
        await supabase.from('system_bugs').insert({
          ...bug,
          status: 'open',
          scan_id: scanId,
          first_detected_at: new Date().toISOString(),
          detected_at: new Date().toISOString(),
        });
        newBugs++;
      }
    }

    // Auto-resolve bugs that were previously open but not found in this scan
    const { data: openBugs } = await supabase
      .from('system_bugs')
      .select('id, title, module, category')
      .eq('status', 'open')
      .eq('source', 'auto_scan')
      .neq('scan_id', scanId);

    let autoResolved = 0;
    if (openBugs) {
      for (const ob of openBugs) {
        const stillExists = bugs.some(
          b => b.title === ob.title && b.module === ob.module && b.category === ob.category
        );
        if (!stillExists) {
          await supabase
            .from('system_bugs')
            .update({ status: 'resolved', resolved_at: new Date().toISOString(), notes: 'Auto-resolved: issue no longer detected in latest scan', updated_at: new Date().toISOString() })
            .eq('id', ob.id);
          autoResolved++;
        }
      }
    }

    // Store scan metadata
    await supabase.from('business_settings').upsert({
      key: 'last_bug_scan',
      value: {
        scan_id: scanId,
        timestamp: new Date().toISOString(),
        duration_ms: Date.now() - scanStart,
        issues_found: bugs.length,
        new_bugs: newBugs,
        updated_bugs: updatedBugs,
        auto_resolved: autoResolved,
        trigger: isCronTrigger ? 'scheduled' : 'manual',
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      duration_ms: Date.now() - scanStart,
      issues_found: bugs.length,
      new_bugs: newBugs,
      updated_bugs: updatedBugs,
      auto_resolved: autoResolved,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

// ─── Scan Functions ──────────────────────────────────────────────────────────

async function scanDatabaseHealth(supabase: SupabaseClient, bugs: BugReport[]) {
  const criticalTables = [
    'users', 'employees', 'products', 'orders', 'order_items', 'customers',
    'inventory', 'outlets', 'audit_log', 'business_settings', 'backups',
  ];

  for (const table of criticalTables) {
    try {
      const { error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (error) {
        bugs.push({
          title: `Database table "${table}" is inaccessible`,
          description: `Failed to query the "${table}" table: ${error.message}. This could indicate the table is missing, has permission issues, or the database connection is degraded.`,
          category: 'database',
          severity: 'critical',
          module: 'Database',
          source: 'auto_scan',
          error_code: error.code,
        });
      }
    } catch (err) {
      bugs.push({
        title: `Database connection error for "${table}"`,
        description: `Exception when querying "${table}": ${err instanceof Error ? err.message : 'Unknown error'}`,
        category: 'database',
        severity: 'critical',
        module: 'Database',
        source: 'auto_scan',
      });
    }
  }

  // Check for tables with zero rows that should have data
  const shouldHaveData = ['users', 'products', 'outlets'];
  for (const table of shouldHaveData) {
    try {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (!error && count === 0) {
        bugs.push({
          title: `Table "${table}" has no records`,
          description: `The "${table}" table is empty. This may indicate missing seed data or a data loss event.`,
          category: 'data_integrity',
          severity: 'high',
          module: 'Database',
          source: 'auto_scan',
        });
      }
    } catch { /* skip */ }
  }
}

async function scanApiEndpoints(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check for recent failed API-related entries in audit log
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentErrors } = await supabase
      .from('audit_log')
      .select('action, module, details, created_at')
      .gte('created_at', oneDayAgo)
      .or('action.eq.ERROR,details->>error.neq.null')
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentErrors && recentErrors.length > 10) {
      bugs.push({
        title: `High error rate in audit logs (${recentErrors.length} errors in 24h)`,
        description: `Detected ${recentErrors.length} error entries in the audit log within the last 24 hours. This may indicate systemic issues with API operations or database writes.`,
        category: 'api',
        severity: recentErrors.length > 30 ? 'critical' : 'high',
        module: 'API',
        source: 'auto_scan',
        request_details: { error_count: recentErrors.length, sample: recentErrors.slice(0, 3) },
      });
    }
  } catch { /* audit_log may not exist */ }

  // Check if essential environment variables are configured
  const requiredEnvVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key' },
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar.key]) {
      bugs.push({
        title: `Missing environment variable: ${envVar.label}`,
        description: `The ${envVar.key} environment variable is not set. This is required for ${envVar.label} functionality.`,
        category: 'configuration',
        severity: 'critical',
        module: 'Environment',
        source: 'auto_scan',
        error_code: 'ENV_MISSING',
      });
    }
  }
}

async function scanDataIntegrity(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check for orphaned order items (order_items without valid order)
  try {
    const { data: orphanedItems } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT COUNT(*) as cnt FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL`,
      });
    if (orphanedItems && Array.isArray(orphanedItems) && orphanedItems[0]?.cnt > 0) {
      bugs.push({
        title: `${orphanedItems[0].cnt} orphaned order items detected`,
        description: `Found order_items records that reference non-existent orders. This indicates a data integrity issue, possibly from incomplete order deletions.`,
        category: 'data_integrity',
        severity: 'medium',
        module: 'Orders',
        source: 'auto_scan',
        request_details: { orphaned_count: orphanedItems[0].cnt },
      });
    }
  } catch { /* RPC may not exist */ }

  // Check for employees without login emails
  try {
    const { data: noEmail, error } = await supabase
      .from('employees')
      .select('id, full_name')
      .or('login_email.is.null,login_email.eq.')
      .eq('system_access', true);

    if (!error && noEmail && noEmail.length > 0) {
      bugs.push({
        title: `${noEmail.length} employee(s) with system access but no login email`,
        description: `Found employees who have system_access enabled but no login_email configured. These users cannot log in to the admin panel.`,
        category: 'data_integrity',
        severity: 'medium',
        module: 'Employees',
        source: 'auto_scan',
        request_details: { affected: noEmail.map(e => e.full_name) },
      });
    }
  } catch { /* table may not exist */ }

  // Check for duplicate product names
  try {
    const { data: products } = await supabase.from('products').select('name');
    if (products) {
      const nameCount: Record<string, number> = {};
      products.forEach(p => { nameCount[p.name] = (nameCount[p.name] || 0) + 1; });
      const duplicates = Object.entries(nameCount).filter(([, c]) => c > 1);
      if (duplicates.length > 0) {
        bugs.push({
          title: `${duplicates.length} duplicate product name(s) found`,
          description: `Found products with identical names: ${duplicates.map(([n, c]) => `"${n}" (${c}x)`).join(', ')}. This may cause confusion in POS and ordering.`,
          category: 'data_integrity',
          severity: 'low',
          module: 'Products',
          source: 'auto_scan',
          request_details: { duplicates },
        });
      }
    }
  } catch { /* table may not exist */ }
}

async function scanSecurityIssues(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check for excessive failed login attempts
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: failedLogins } = await supabase
      .from('audit_log')
      .select('user_name, ip_address, created_at')
      .eq('action', 'LOGIN')
      .gte('created_at', oneHourAgo)
      .ilike('details->>status', '%fail%');

    if (failedLogins && failedLogins.length > 10) {
      bugs.push({
        title: `Excessive failed login attempts (${failedLogins.length} in 1 hour)`,
        description: `Detected ${failedLogins.length} failed login attempts in the past hour. This could indicate a brute-force attack or repeated credential issues.`,
        category: 'security',
        severity: 'critical',
        module: 'Authentication',
        source: 'auto_scan',
        request_details: { failed_count: failedLogins.length },
      });
    }
  } catch { /* audit_log may not exist */ }

  // Check for users with suspiciously high privilege
  try {
    const { data: admins } = await supabase
      .from('employees')
      .select('id, full_name, login_role')
      .in('login_role', ['Super Admin', 'Administrator']);

    if (admins && admins.length > 5) {
      bugs.push({
        title: `High number of admin-level users (${admins.length})`,
        description: `Found ${admins.length} users with Super Admin or Administrator roles. Consider reviewing access levels to follow the principle of least privilege.`,
        category: 'security',
        severity: 'medium',
        module: 'User Management',
        source: 'auto_scan',
        request_details: { admin_count: admins.length },
      });
    }
  } catch { /* table may not exist */ }

  // Check backup health
  try {
    const { data: latestBackup } = await supabase
      .from('backups')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestBackup) {
      const backupAge = Date.now() - new Date(latestBackup.created_at).getTime();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (backupAge > threeDays) {
        bugs.push({
          title: 'Database backup is overdue',
          description: `The last backup was ${Math.round(backupAge / (24 * 60 * 60 * 1000))} days ago. Backups should run daily. Check the scheduled backup function and BACKUP_SECRET configuration.`,
          category: 'security',
          severity: 'high',
          module: 'Backup',
          source: 'auto_scan',
        });
      }
      if (latestBackup.status === 'failed') {
        bugs.push({
          title: 'Last database backup failed',
          description: `The most recent backup attempt has a "failed" status. Data may be at risk if not addressed.`,
          category: 'security',
          severity: 'critical',
          module: 'Backup',
          source: 'auto_scan',
        });
      }
    } else {
      bugs.push({
        title: 'No database backups found',
        description: 'No backup records exist in the database. Set up and verify the scheduled backup function to protect against data loss.',
        category: 'security',
        severity: 'critical',
        module: 'Backup',
        source: 'auto_scan',
      });
    }
  } catch { /* backups table may not exist */ }
}

async function scanConfigurationIssues(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check business settings for critical missing configuration
  try {
    const { data: settings } = await supabase
      .from('business_settings')
      .select('key, value');

    if (settings) {
      const settingsMap = new Map(settings.map(s => [s.key, s.value]));

      // Check if general settings exist
      if (!settingsMap.has('general')) {
        bugs.push({
          title: 'Business general settings not configured',
          description: 'The general business settings (business name, contact, currency, etc.) have not been saved to the database. Default values are being used.',
          category: 'configuration',
          severity: 'low',
          module: 'Settings',
          source: 'auto_scan',
        });
      }

      // Check maintenance mode stuck on
      const maintenance = settingsMap.get('maintenance_mode') as Record<string, unknown> | undefined;
      if (maintenance && maintenance.enabled) {
        const startedAt = maintenance.started_at as string | null;
        if (startedAt) {
          const modeAge = Date.now() - new Date(startedAt).getTime();
          const sixHours = 6 * 60 * 60 * 1000;
          if (modeAge > sixHours) {
            bugs.push({
              title: 'Maintenance mode has been active for over 6 hours',
              description: `Maintenance mode was activated ${Math.round(modeAge / (60 * 60 * 1000))} hours ago. This may have been left on accidentally, blocking staff access to the admin panel.`,
              category: 'configuration',
              severity: 'high',
              module: 'Maintenance',
              source: 'auto_scan',
            });
          }
        }
      }
    }
  } catch { /* table may not exist */ }
}

async function scanPerformanceIssues(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check for tables with excessive row counts that might need cleanup
  const largeTables = [
    { name: 'audit_log', threshold: 100000, label: 'Audit Log' },
    { name: 'order_items', threshold: 500000, label: 'Order Items' },
  ];

  for (const table of largeTables) {
    try {
      const { count, error } = await supabase
        .from(table.name)
        .select('id', { count: 'exact', head: true });

      if (!error && count && count > table.threshold) {
        bugs.push({
          title: `${table.label} table has ${count.toLocaleString()} rows`,
          description: `The ${table.name} table has grown to ${count.toLocaleString()} rows (threshold: ${table.threshold.toLocaleString()}). Consider archiving old records to maintain query performance.`,
          category: 'performance',
          severity: 'medium',
          module: 'Database',
          source: 'auto_scan',
          request_details: { row_count: count, threshold: table.threshold },
        });
      }
    } catch { /* table may not exist */ }
  }
}

async function scanStaleData(supabase: SupabaseClient, bugs: BugReport[]) {
  // Check for orders stuck in pending/processing for too long
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stuckOrders, error } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .in('status', ['pending', 'processing'])
      .lt('created_at', twoDaysAgo);

    if (!error && stuckOrders && stuckOrders.length > 0) {
      bugs.push({
        title: `${stuckOrders.length} order(s) stuck in pending/processing`,
        description: `Found ${stuckOrders.length} orders older than 2 days still in pending or processing status. These may need manual review or status updates.`,
        category: 'workflow',
        severity: 'medium',
        module: 'Orders',
        source: 'auto_scan',
        request_details: { stuck_count: stuckOrders.length, order_ids: stuckOrders.slice(0, 10).map(o => o.id) },
      });
    }
  } catch { /* table may not exist */ }

  // Check for expired offers still marked as active
  try {
    const now = new Date().toISOString();
    const { data: expiredOffers, error } = await supabase
      .from('offers')
      .select('id, title, end_date')
      .eq('is_active', true)
      .lt('end_date', now)
      .not('end_date', 'is', null);

    if (!error && expiredOffers && expiredOffers.length > 0) {
      bugs.push({
        title: `${expiredOffers.length} expired offer(s) still active`,
        description: `Found active offers with expired end dates: ${expiredOffers.map(o => `"${o.title}"`).join(', ')}. These should be deactivated.`,
        category: 'workflow',
        severity: 'low',
        module: 'Offers',
        source: 'auto_scan',
        request_details: { expired_offers: expiredOffers.map(o => ({ id: o.id, title: o.title, end_date: o.end_date })) },
      });
    }
  } catch { /* table may not exist */ }

  // Check for inactive inventory items with stock
  try {
    const { data: inactiveWithStock, error } = await supabase
      .from('inventory')
      .select('id, item_name, quantity')
      .eq('is_active', false)
      .gt('quantity', 0);

    if (!error && inactiveWithStock && inactiveWithStock.length > 0) {
      bugs.push({
        title: `${inactiveWithStock.length} inactive inventory item(s) with remaining stock`,
        description: `Found deactivated inventory items that still have stock quantities. This stock may be going untracked.`,
        category: 'workflow',
        severity: 'low',
        module: 'Inventory',
        source: 'auto_scan',
        request_details: { items: inactiveWithStock.slice(0, 10).map(i => ({ name: i.item_name, qty: i.quantity })) },
      });
    }
  } catch { /* table may not exist */ }
}
