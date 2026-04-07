import { supabase } from '@/lib/supabase';
import { logChangelog, type ChangeCategory } from '@/lib/changelog-logger';

// ─── Audit Logger ─────────────────────────────────────────────────────────────
// Reusable utility to log actions to the audit_log table.
// Call this from any module after a successful CRUD operation.
// Set trackChangelog: true to also auto-log significant changes to the changelog.

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'APPROVE' | 'REJECT' | 'CLEANUP' | 'ASSIGN';

interface AuditLogParams {
  action: AuditAction;
  module: string;
  record_id?: string;
  details?: Record<string, unknown>;
  /** Set to true to also log this action to the auto-updating changelog */
  trackChangelog?: boolean;
  /** Override the changelog title (default: auto-generated from action + module) */
  changelogTitle?: string;
  /** Override the changelog description */
  changelogDescription?: string;
  /** Override the changelog category (default: auto-detected from module/action) */
  changelogCategory?: ChangeCategory;
}

/**
 * Get the current authenticated user's info for audit logging.
 */
async function getCurrentUser(): Promise<{ id: string; name: string } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const meta = user.user_metadata || {};
    const name = meta.full_name || user.email?.split('@')[0] || 'Unknown';
    return { id: user.id, name };
  } catch {
    return null;
  }
}

/**
 * Check if the given user ID belongs to the main super admin
 * (the first registered user in the system, ordered by created_at).
 */
async function isMainSuperAdmin(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    return data?.id === userId;
  } catch {
    return false;
  }
}

/**
 * Log an action to the audit_log table.
 * This is fire-and-forget — errors are silently logged to console.
 * The main super admin (first registered user) is excluded from audit logging.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const user = await getCurrentUser();

    // Skip audit logging for the main super admin — fully hidden from audit trails
    if (user?.id && await isMainSuperAdmin(user.id)) {
      return;
    }

    const row = {
      user_id: user?.id || null,
      user_name: user?.name || 'System',
      action: params.action,
      module: params.module,
      record_id: params.record_id || null,
      details: params.details || null,
      ip_address: null, // Client-side; IP not directly available
    };

    const { error } = await supabase.from('audit_log').insert(row);
    if (error) {
      console.error('Audit log insert error:', error.message);
    }

    // ─── Auto-Changelog Tracking ─────────────────────────────────────────
    // If trackChangelog is set, also log this action to the changelog database.
    // This allows the changelog page to auto-update when significant changes happen.
    if (params.trackChangelog) {
      const actionLabels: Record<string, string> = {
        CREATE: 'Added',
        UPDATE: 'Updated',
        DELETE: 'Removed',
        APPROVE: 'Approved',
        REJECT: 'Rejected',
        ASSIGN: 'Assigned',
        EXPORT: 'Exported',
      };
      const actionLabel = actionLabels[params.action] || params.action;

      // Auto-detect changelog category from module name
      const moduleToCategory: Record<string, ChangeCategory> = {
        Settings: 'infrastructure',
        Security: 'security',
        'Maintenance Mode': 'infrastructure',
        Employees: 'feature',
        Inventory: 'feature',
        'Stock Reorder': 'feature',
        Orders: 'feature',
        Delivery: 'feature',
        POS: 'feature',
        'Audit Logs': 'security',
        Payments: 'integration',
        'M-Pesa': 'integration',
        'Family Bank': 'integration',
        Reports: 'feature',
        Backup: 'infrastructure',
      };

      const category = params.changelogCategory
        || moduleToCategory[params.module]
        || 'feature';

      const title = params.changelogTitle
        || `${actionLabel} — ${params.module}`;

      const description = params.changelogDescription
        || `${actionLabel} ${params.module.toLowerCase()}${params.details?.name ? ': ' + params.details.name : ''}.`;

      // Extract detail strings from the details object
      const detailsList: string[] = [];
      if (params.details) {
        for (const [key, val] of Object.entries(params.details)) {
          if (key !== 'name' && val !== null && val !== undefined) {
            detailsList.push(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
          }
        }
      }

      logChangelog({
        title,
        description,
        details: detailsList.length > 0 ? detailsList : undefined,
        category,
        status: 'completed',
      }).catch(err => console.error('Auto-changelog failed:', err));
    }
  } catch (err) {
    console.error('Audit logger failed:', err);
  }
}
