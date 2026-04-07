import { createClient } from '@supabase/supabase-js';

// All Supabase tables to back up
export const BACKUP_TABLES = [
  'asset_assignments', 'asset_categories', 'asset_maintenance_log', 'assets',
  'audit_log', 'business_settings', 'cost_entries', 'credit_invoice_payments',
  'credit_invoices', 'creditors', 'customers', 'debtors', 'debtor_transactions',
  'deliveries', 'distribution_agents', 'distribution_records', 'distributor_categories',
  'distributors', 'employee_categories', 'employee-documents', 'employee_productivity',
  'employees', 'expense_categories', 'expenses', 'food_info', 'insurance_claims',
  'insurance_policies', 'inventory_categories', 'inventory_items', 'inventory_transactions',
  'ledger_entries', 'logos', 'lot_tracking', 'mpesa_settings', 'mpesa_transactions',
  'newsletter_subscribers', 'offers', 'order_items', 'orders', 'outlet_employees',
  'outlet_inventory', 'outlet_inventory_transactions', 'outlet_products',
  'outlet_requisition_items', 'outlet_requisitions', 'outlet_return_items',
  'outlet_returns', 'outlets', 'outlet_settings', 'outlet_waste_records',
  'permissions', 'picking_list_items', 'picking_lists', 'pl_reports',
  'pos_sale_items', 'pos_sales', 'pricing_tiers', 'production_runs', 'products',
  'purchase_order_items', 'purchase_orders', 'recipe_ingredients', 'recipes',
  'rider_damage_reports', 'role_permissions', 'roles', 'sales', 'shift_expenses',
  'shifts', 'stock_requisitions', 'stock_take_items', 'stock_takes',
  'store_requisition_items', 'store_requisitions', 'users', 'waste_records',
];

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tableCount: number;
  totalRows: number;
  trigger: 'manual' | 'scheduled';
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

/**
 * Create a Supabase admin client using the service role key.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Export all tables from Supabase and return a JSON backup object.
 */
export async function exportAllTables(trigger: 'manual' | 'scheduled' = 'manual') {
  const admin = createAdminClient();
  const errors: string[] = [];
  const tables: Record<string, unknown[]> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    try {
      // Fetch all rows (paginate in chunks of 1000)
      let allRows: unknown[] = [];
      let from = 0;
      const chunkSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await admin
          .from(table)
          .select('*')
          .range(from, from + chunkSize - 1);

        if (error) {
          errors.push(`${table}: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          from += chunkSize;
          hasMore = data.length === chunkSize;
        } else {
          hasMore = false;
        }
      }

      tables[table] = allRows;
      totalRows += allRows.length;
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const now = new Date();
  const id = `backup_${now.toISOString().replace(/[:.]/g, '-')}`;
  const filename = `${id}.json`;

  const backupData = {
    metadata: {
      id,
      filename,
      createdAt: now.toISOString(),
      tableCount: Object.keys(tables).length,
      totalRows,
      trigger,
      status: errors.length === 0 ? 'success' : errors.length < BACKUP_TABLES.length ? 'partial' : 'failed',
      errors: errors.length > 0 ? errors : undefined,
    } as BackupMetadata,
    tables,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  backupData.metadata.sizeBytes = new Blob([jsonStr]).size;

  return { backupData, jsonStr, metadata: backupData.metadata };
}
