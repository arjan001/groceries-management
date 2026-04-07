'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

// Tables to clean, in dependency order (children first, then parents)
const CLEANUP_TABLES = [
  // Child / junction tables first
  'order_items',
  'pos_sale_items',
  'debtor_transactions',
  'creditor_transactions',
  'picking_list_items',
  'purchase_order_items',
  'recipe_ingredients',
  'inventory_transactions',
  'outlet_return_items',
  'outlet_inventory_transactions',
  'outlet_requisition_items',
  'outlet_transfer_items',
  'credit_invoice_payments',
  'store_requisition_items',
  'asset_maintenance_log',
  'asset_cost_log',
  'asset_assignments',
  // Main transactional tables
  'pl_reports',
  'cost_entries',
  'revenue_entries',
  'ledger_entries',
  'orders',
  'pos_sales',
  'mpesa_transactions',
  'card_payments',
  'deliveries',
  'production_runs',
  'picking_lists',
  'lot_tracking',
  'waste_records',
  'purchase_orders',
  'debtors',
  'creditors',
  'assets',
  'inventory_items',
  'inventory_categories',
  'asset_categories',
  'pricing_tiers',
  'recipes',
  'food_info',
  'outlet_returns',
  'outlet_waste_records',
  'outlet_inventory',
  'outlet_requisitions',
  'outlet_transfers',
  'outlet_products',
  'outlet_employees',
  'outlet_settings',
  'distribution_records',
  'distribution_agents',
  'distributors',
  'distributor_categories',
  'rider_damage_reports',
  'credit_invoices',
  'store_requisitions',
  'employee_productivity',
  'employee_productivity_summary',
  'stock_requisitions',
  'pos_sessions',
  'expenses',
  'newsletter_subscribers',
  'offers',
];

// Tables to preserve (system config, users & access control)
const PRESERVED_TABLES = [
  'roles',
  'permissions',
  'role_permissions',
  'users',
  'employees',
  'employee_categories',
  'employee_certificates',
  'audit_log',
  'business_settings',
  'mpesa_settings',
  'outlets',
  'settings_categories',
  'settings_ingredients',
  'settings_menu_items',
  'product_categories',
];

export default function CleanupDataPage() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ table: string; status: 'success' | 'error' | 'skipped'; message: string }[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [done, setDone] = useState(false);

  const runCleanup = async () => {
    if (confirmText !== 'DELETE ALL DATA') return;
    setRunning(true);
    setResults([]);
    setDone(false);

    const newResults: typeof results = [];

    // Delete customers except Walk-in Customer separately
    for (const table of CLEANUP_TABLES) {
      try {
        let query;
        if (table === 'customers') {
          // Keep Walk-in Customer
          query = supabase.from(table).delete().neq('name', 'Walk-in Customer');
        } else {
          // Delete all rows - use a filter that matches everything
          query = supabase.from(table).delete().gte('created_at', '1970-01-01');
        }

        const { error } = await query;

        if (error) {
          // Table might not exist yet (migration not run) — that's OK
          if (error.message.includes('does not exist') || error.code === '42P01') {
            newResults.push({ table, status: 'skipped', message: 'Table does not exist' });
          } else {
            newResults.push({ table, status: 'error', message: error.message });
          }
        } else {
          newResults.push({ table, status: 'success', message: 'Cleared' });
        }
      } catch (err) {
        newResults.push({ table, status: 'skipped', message: 'Table may not exist' });
      }

      setResults([...newResults]);
    }

    // Also handle customers
    try {
      const { error } = await supabase.from('customers').delete().neq('name', 'Walk-in Customer');
      if (error) {
        newResults.push({ table: 'customers (non-walk-in)', status: 'error', message: error.message });
      } else {
        newResults.push({ table: 'customers (non-walk-in)', status: 'success', message: 'Cleared (kept Walk-in Customer)' });
      }
    } catch {
      newResults.push({ table: 'customers (non-walk-in)', status: 'skipped', message: 'Skipped' });
    }

    setResults([...newResults]);

    // Log the cleanup
    try {
      await logAudit({
        action: 'CLEANUP',
        module: 'System',
        record_id: 'all_data',
        details: {
          description: 'Full data cleanup - removed all dummy/test data',
          tables_cleaned: newResults.filter(r => r.status === 'success').length,
          tables_skipped: newResults.filter(r => r.status === 'skipped').length,
          tables_errored: newResults.filter(r => r.status === 'error').length,
        },
      });
    } catch { /* audit might have been cleared too */ }

    setRunning(false);
    setDone(true);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  return (
    <div className="p-4 md:p-8 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Data Cleanup</h1>
        <p className="text-muted-foreground">
          Remove all dummy/test data and start with a clean slate. System configuration (roles, permissions, outlets) will be preserved.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-bold text-red-800 mb-2">WARNING: Irreversible Action</h2>
        <p className="text-sm text-red-700 mb-3">
          This will permanently delete ALL transactional and report data including:
        </p>
        <ul className="text-sm text-red-700 space-y-1 mb-4 list-disc pl-5">
          <li>All P&L reports, ledger entries, cost/revenue entries</li>
          <li>All orders, POS sales, and delivery records</li>
          <li>All inventory items and transaction history</li>
          <li>All debtor and creditor records</li>
          <li>All recipes, pricing tiers, and food info</li>
          <li>All asset records and maintenance logs</li>
          <li>All waste records, returns, and requisitions</li>
          <li>All outlet-specific data (inventory, sales, returns, waste)</li>
          <li>All production runs, picking lists, and lot tracking</li>
        </ul>
        <p className="text-sm font-bold text-red-800 mb-2">
          The following will be PRESERVED (never deleted):
        </p>
        <ul className="text-sm text-green-700 space-y-1 list-disc pl-5">
          <li>Roles, Permissions & Role Assignments</li>
          <li>Users & Auth Accounts</li>
          <li>All Employee Records & Certificates</li>
          <li>Audit Logs (full history retained)</li>
          <li>Outlets, Employee Categories, Business Settings</li>
          <li>M-Pesa Settings, Product Categories, Menu/Ingredient Settings</li>
        </ul>
      </div>

      {/* Confirmation */}
      {!done && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4">Confirm Cleanup</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Type <strong className="text-red-600">DELETE ALL DATA</strong> below to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
              setConfirmed(e.target.value === 'DELETE ALL DATA');
            }}
            placeholder="Type DELETE ALL DATA"
            className="w-full px-4 py-3 border-2 border-border rounded-lg focus:ring-2 focus:ring-red-500/50 outline-none text-sm font-mono mb-4"
            disabled={running}
          />
          <button
            onClick={runCleanup}
            disabled={!confirmed || running}
            className={`w-full px-6 py-3 rounded-lg font-bold text-sm transition-colors ${
              confirmed && !running
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {running ? 'Cleaning up...' : 'Start Cleanup'}
          </button>
        </div>
      )}

      {/* Progress */}
      {results.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">
              {done ? 'Cleanup Complete' : 'Progress...'}
            </h3>
            {done && (
              <div className="flex gap-3 text-sm">
                <span className="text-emerald-600 font-semibold">{successCount} cleared</span>
                <span className="text-gray-500 font-semibold">{skippedCount} skipped</span>
                {errorCount > 0 && <span className="text-red-600 font-semibold">{errorCount} errors</span>}
              </div>
            )}
          </div>

          {running && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(results.length / (CLEANUP_TABLES.length + 1)) * 100}%` }}
              />
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between px-3 py-2 rounded text-xs ${
                  r.status === 'success'
                    ? 'bg-emerald-50 text-emerald-800'
                    : r.status === 'error'
                    ? 'bg-red-50 text-red-800'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="font-mono">{r.table}</span>
                <span className="font-semibold">{r.message}</span>
              </div>
            ))}
          </div>

          {done && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-emerald-700 font-medium">
                Cleanup complete. Your system is now ready for fresh data entry.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preserved Tables Reference */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-2">Preserved System Tables</h3>
        <div className="flex flex-wrap gap-2">
          {PRESERVED_TABLES.map(t => (
            <span key={t} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
