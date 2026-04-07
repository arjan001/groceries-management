'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  BarChart3,
  Store,
  Calendar,
  Download,
  TrendingUp,
  ShoppingCart,
  Package,
  RotateCcw,
  Trash2,
  Users,
  DollarSign,
  AlertTriangle,
  Clock,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
}

interface PosSale {
  id: string;
  outlet_id: string;
  total: number;
  payment_method: string;
  cashier_name: string;
  created_at: string;
  sale_type: string;
}

interface PosSaleItem {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OutletInventoryItem {
  id: string;
  outlet_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  selling_price: number;
  category: string;
  status: string;
  received_date: string;
  shelf_life_days: number;
  reorder_level: number;
  unit: string;
}

interface OutletInventoryTransaction {
  id: string;
  outlet_id: string;
  item_id: string;
  type: string;
  quantity: number;
  created_at: string;
}

interface OutletReturn {
  id: string;
  outlet_id: string;
  status: string;
  total_items: number;
  total_value: number;
  wholesale_value: number;
  return_date: string;
}

interface OutletReturnItem {
  id: string;
  return_id: string;
  product_name: string;
  quantity_returning: number;
  quality_on_return: string;
  unit_cost: number;
  total_cost: number;
}

interface OutletWasteRecord {
  id: string;
  outlet_id: string;
  date: string;
  product_name: string;
  quantity: number;
  cost: number;
  reason: string;
  category: string;
  approval_status: string;
}

interface OutletEmployee {
  id: string;
  outlet_id: string;
  employee_id: string;
  outlet_role: string;
  status: string;
}

interface OutletRequisition {
  id: string;
  outlet_id: string;
  status: string;
  total_cost: number;
  created_at: string;
  requisition_number: string;
  requested_by: string;
  priority: string;
}

interface OutletExpense {
  id: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  cost_type: string;
}

interface OutletRequisitionItem {
  id: string;
  requisition_id: string;
  product_name: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_fulfilled: number;
  unit_price: number;
  total_cost: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'sales' | 'pnl' | 'expenses' | 'requisitions' | 'inventory' | 'returns' | 'waste';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'sales', label: 'Sales', icon: <ShoppingCart className="w-4 h-4" /> },
  { key: 'pnl', label: 'P&L', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'expenses', label: 'Expenses', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'requisitions', label: 'Requisitions', icon: <Layers className="w-4 h-4" /> },
  { key: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
  { key: 'returns', label: 'Returns', icon: <RotateCcw className="w-4 h-4" /> },
  { key: 'waste', label: 'Waste', icon: <Trash2 className="w-4 h-4" /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Safe number: guards against NaN, undefined, null, Infinity
function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Safe division: prevents division by zero and NaN results
function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

// Round to 2 decimal places for currency precision
function round2(val: number): number {
  return Math.round((safeNum(val) + Number.EPSILON) * 100) / 100;
}

function formatKES(amount: number): string {
  return `KES ${safeNum(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
}

// ─── CSV Export Helper ────────────────────────────────────────────────────────

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Stat Card Component ──────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon, borderColor }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  borderColor: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function OutletReportsPage() {
  const defaultRange = getDefaultDateRange();

  // ─── Core State ─────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [dateFrom, setDateFrom] = useState(defaultRange.start);
  const [dateTo, setDateTo] = useState(defaultRange.end);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Data State ─────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<PosSale[]>([]);
  const [saleItems, setSaleItems] = useState<PosSaleItem[]>([]);
  const [inventory, setInventory] = useState<OutletInventoryItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<OutletInventoryTransaction[]>([]);
  const [returns, setReturns] = useState<OutletReturn[]>([]);
  const [returnItems, setReturnItems] = useState<OutletReturnItem[]>([]);
  const [wasteRecords, setWasteRecords] = useState<OutletWasteRecord[]>([]);
  const [employees, setEmployees] = useState<OutletEmployee[]>([]);
  const [requisitions, setRequisitions] = useState<OutletRequisition[]>([]);
  const [requisitionItems, setRequisitionItems] = useState<OutletRequisitionItem[]>([]);
  const [expenses, setExpenses] = useState<OutletExpense[]>([]);

  // ─── Selected Outlet ────────────────────────────────────────────────────────
  const selectedOutlet = useMemo(() => outlets.find(o => o.id === selectedOutletId), [outlets, selectedOutletId]);

  // ─── Fetch Outlets ──────────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    const { data, error } = await supabase
      .from('outlets')
      .select('id, name, code, outlet_type, is_main_branch, status')
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load outlets:', error.message);
      return;
    }

    const outletList = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.name || '') as string,
      code: (r.code || '') as string,
      outlet_type: (r.outlet_type || 'retail') as string,
      is_main_branch: Boolean(r.is_main_branch),
      status: (r.status || 'Active') as string,
    }));

    setOutlets(outletList);
  }, []);

  // ─── Fetch Report Data ──────────────────────────────────────────────────────

  const fetchReportData = useCallback(async () => {
    if (!selectedOutletId) return;
    setRefreshing(true);

    try {
      // Fetch POS Sales
      let salesQuery = supabase
        .from('pos_sales')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });
      if (dateFrom) salesQuery = salesQuery.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) salesQuery = salesQuery.lte('created_at', `${dateTo}T23:59:59`);
      const { data: salesData } = await salesQuery;

      const mappedSales = (salesData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        total: (r.total || 0) as number,
        payment_method: (r.payment_method || 'Cash') as string,
        cashier_name: (r.cashier_name || '') as string,
        created_at: (r.created_at || '') as string,
        sale_type: (r.sale_type || 'Retail') as string,
      }));
      setSales(mappedSales);

      // Fetch Sale Items for the sales
      if (mappedSales.length > 0) {
        const saleIds = mappedSales.map(s => s.id);
        const { data: itemsData } = await supabase
          .from('pos_sale_items')
          .select('*')
          .in('sale_id', saleIds);

        setSaleItems((itemsData || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          sale_id: (r.sale_id || '') as string,
          product_name: (r.product_name || '') as string,
          quantity: (r.quantity || 0) as number,
          unit_price: (r.unit_price || 0) as number,
          total: (r.total || 0) as number,
        })));
      } else {
        setSaleItems([]);
      }

      // Fetch Inventory
      const { data: invData } = await supabase
        .from('outlet_inventory')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('item_name', { ascending: true });

      setInventory((invData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        item_name: (r.item_name || '') as string,
        quantity: (r.quantity || 0) as number,
        unit_cost: (r.unit_cost || 0) as number,
        selling_price: (r.selling_price || 0) as number,
        category: (r.category || 'General') as string,
        status: (r.status || 'Active') as string,
        received_date: (r.received_date || '') as string,
        shelf_life_days: (r.shelf_life_days || 5) as number,
        reorder_level: (r.reorder_level || 0) as number,
        unit: (r.unit || 'pieces') as string,
      })));

      // Fetch Inventory Transactions
      let txnQuery = supabase
        .from('outlet_inventory_transactions')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });
      if (dateFrom) txnQuery = txnQuery.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) txnQuery = txnQuery.lte('created_at', `${dateTo}T23:59:59`);
      const { data: txnData } = await txnQuery;

      setInventoryTransactions((txnData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        item_id: (r.item_id || '') as string,
        type: (r.type || '') as string,
        quantity: (r.quantity || 0) as number,
        created_at: (r.created_at || '') as string,
      })));

      // Fetch Returns
      let returnsQuery = supabase
        .from('outlet_returns')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('return_date', { ascending: false });
      if (dateFrom) returnsQuery = returnsQuery.gte('return_date', dateFrom);
      if (dateTo) returnsQuery = returnsQuery.lte('return_date', dateTo);
      const { data: returnsData } = await returnsQuery;

      const mappedReturns = (returnsData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        status: (r.status || 'Pending') as string,
        total_items: (r.total_items || 0) as number,
        total_value: (r.total_value || 0) as number,
        wholesale_value: (r.wholesale_value || 0) as number,
        return_date: (r.return_date || '') as string,
      }));
      setReturns(mappedReturns);

      // Fetch Return Items
      if (mappedReturns.length > 0) {
        const returnIds = mappedReturns.map(r => r.id);
        const { data: returnItemsData } = await supabase
          .from('outlet_return_items')
          .select('*')
          .in('return_id', returnIds);

        setReturnItems((returnItemsData || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          return_id: (r.return_id || '') as string,
          product_name: (r.product_name || '') as string,
          quantity_returning: (r.quantity_returning || 0) as number,
          quality_on_return: (r.quality_on_return || 'Good') as string,
          unit_cost: (r.unit_cost || 0) as number,
          total_cost: (r.total_cost || 0) as number,
        })));
      } else {
        setReturnItems([]);
      }

      // Fetch Waste Records
      let wasteQuery = supabase
        .from('outlet_waste_records')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('date', { ascending: false });
      if (dateFrom) wasteQuery = wasteQuery.gte('date', dateFrom);
      if (dateTo) wasteQuery = wasteQuery.lte('date', dateTo);
      const { data: wasteData } = await wasteQuery;

      setWasteRecords((wasteData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        date: (r.date || '') as string,
        product_name: (r.product_name || '') as string,
        quantity: (r.quantity || 0) as number,
        cost: (r.cost || 0) as number,
        reason: (r.reason || '') as string,
        category: (r.category || 'Finished Goods') as string,
        approval_status: (r.approval_status || 'Pending') as string,
      })));

      // Fetch Employees
      const { data: empData } = await supabase
        .from('outlet_employees')
        .select('*')
        .eq('outlet_id', selectedOutletId);

      setEmployees((empData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        employee_id: (r.employee_id || '') as string,
        outlet_role: (r.outlet_role || 'Staff') as string,
        status: (r.status || 'Active') as string,
      })));

      // Fetch Requisitions
      let reqQuery = supabase
        .from('outlet_requisitions')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });
      if (dateFrom) reqQuery = reqQuery.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) reqQuery = reqQuery.lte('created_at', `${dateTo}T23:59:59`);
      const { data: reqData } = await reqQuery;

      setRequisitions((reqData || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        status: (r.status || 'Pending') as string,
        total_cost: (r.total_cost || 0) as number,
        created_at: (r.created_at || '') as string,
        requisition_number: (r.requisition_number || '') as string,
        requested_by: (r.requested_by || '') as string,
        priority: (r.priority || 'Normal') as string,
      })));

      // Fetch Requisition Items for the requisitions
      const mappedReqs = (reqData || []).map((r: Record<string, unknown>) => r.id as string);
      if (mappedReqs.length > 0) {
        try {
          const { data: reqItemsData } = await supabase
            .from('outlet_requisition_items')
            .select('*')
            .in('requisition_id', mappedReqs);

          setRequisitionItems((reqItemsData || []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            requisition_id: (r.requisition_id || '') as string,
            product_name: (r.product_name || '') as string,
            quantity_requested: (r.quantity_requested || 0) as number,
            quantity_approved: (r.quantity_approved || 0) as number,
            quantity_fulfilled: (r.quantity_fulfilled || 0) as number,
            unit_price: (r.unit_price || 0) as number,
            total_cost: (r.total_cost || 0) as number,
          })));
        } catch { setRequisitionItems([]); }
      } else {
        setRequisitionItems([]);
      }

      // Fetch Expenses (cost_entries)
      try {
        let expQuery = supabase.from('cost_entries').select('*').order('created_at', { ascending: false });
        if (dateFrom) expQuery = expQuery.gte('created_at', `${dateFrom}T00:00:00`);
        if (dateTo) expQuery = expQuery.lte('created_at', `${dateTo}T23:59:59`);
        const { data: expData } = await expQuery;

        setExpenses((expData || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          category: (r.category || 'General') as string,
          amount: (r.amount || 0) as number,
          description: (r.description || '') as string,
          expense_date: (r.created_at || '') as string,
          cost_type: (r.cost_type || 'general_expense') as string,
        })));
      } catch { setExpenses([]); }

    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedOutletId, dateFrom, dateTo]);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  // Auto-select first outlet once outlets are loaded
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  useEffect(() => {
    if (selectedOutletId) {
      setLoading(true);
      fetchReportData();
    }
  }, [selectedOutletId, dateFrom, dateTo, fetchReportData]);

  // ─── Computed: Overview Metrics ─────────────────────────────────────────────

  const overviewMetrics = useMemo(() => {
    const totalSales = round2(sales.reduce((sum, s) => sum + safeNum(s.total), 0));
    const totalOrders = sales.length;
    const avgOrderValue = round2(safeDiv(totalSales, totalOrders, 0));
    const totalReturnsCount = returns.length;
    const totalReturnsValue = round2(returns.reduce((sum, r) => sum + safeNum(r.total_value), 0));
    const totalWasteCost = round2(wasteRecords.reduce((sum, w) => sum + safeNum(w.cost), 0));
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const inventoryValue = round2(inventory.reduce((sum, i) => sum + round2(safeNum(i.quantity) * safeNum(i.unit_cost)), 0));
    const totalRequisitions = requisitions.length;
    const totalRequisitionsCost = round2(requisitions.reduce((sum, r) => sum + safeNum(r.total_cost), 0));

    return {
      totalSales,
      totalOrders,
      avgOrderValue,
      totalReturnsCount,
      totalReturnsValue,
      totalWasteCost,
      activeEmployees,
      inventoryValue,
      totalRequisitions,
      totalRequisitionsCost,
    };
  }, [sales, returns, wasteRecords, employees, inventory, requisitions]);

  // ─── Computed: Sales Breakdown ──────────────────────────────────────────────

  const salesByPaymentMethod = useMemo(() => {
    const grouped: Record<string, { count: number; total: number }> = {};
    sales.forEach(s => {
      const method = s.payment_method || 'Cash';
      if (!grouped[method]) grouped[method] = { count: 0, total: 0 };
      grouped[method].count += 1;
      grouped[method].total += s.total;
    });
    return Object.entries(grouped).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    })).sort((a, b) => b.total - a.total);
  }, [sales]);

  const salesBySaleType = useMemo(() => {
    const grouped: Record<string, { count: number; total: number }> = {};
    sales.forEach(s => {
      const saleType = s.sale_type || 'Retail';
      if (!grouped[saleType]) grouped[saleType] = { count: 0, total: 0 };
      grouped[saleType].count += 1;
      grouped[saleType].total += s.total;
    });
    return Object.entries(grouped).map(([saleType, data]) => ({
      saleType,
      count: data.count,
      total: data.total,
    })).sort((a, b) => b.total - a.total);
  }, [sales]);

  const topSellingProducts = useMemo(() => {
    const grouped: Record<string, { quantity: number; total: number }> = {};
    saleItems.forEach(item => {
      const name = item.product_name || 'Unknown';
      if (!grouped[name]) grouped[name] = { quantity: 0, total: 0 };
      grouped[name].quantity += item.quantity;
      grouped[name].total += item.total;
    });
    return Object.entries(grouped)
      .map(([product, data]) => ({ product, quantity: data.quantity, total: data.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [saleItems]);

  const dailySales = useMemo(() => {
    const grouped: Record<string, { count: number; total: number }> = {};
    sales.forEach(s => {
      const day = s.created_at ? s.created_at.split('T')[0] : 'Unknown';
      if (!grouped[day]) grouped[day] = { count: 0, total: 0 };
      grouped[day].count += 1;
      grouped[day].total += s.total;
    });
    return Object.entries(grouped)
      .map(([date, data]) => ({ date, count: data.count, total: data.total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  // ─── Computed: Inventory Breakdown ──────────────────────────────────────────

  const inventoryByCategory = useMemo(() => {
    const grouped: Record<string, { count: number; totalQuantity: number; totalValue: number }> = {};
    inventory.forEach(item => {
      const cat = item.category || 'General';
      if (!grouped[cat]) grouped[cat] = { count: 0, totalQuantity: 0, totalValue: 0 };
      grouped[cat].count += 1;
      grouped[cat].totalQuantity += item.quantity;
      grouped[cat].totalValue += item.quantity * item.unit_cost;
    });
    return Object.entries(grouped)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [inventory]);

  const lowStockItems = useMemo(() => {
    return inventory.filter(i => i.reorder_level > 0 && i.quantity <= i.reorder_level);
  }, [inventory]);

  const freshnessAlerts = useMemo(() => {
    const today = new Date();
    return inventory
      .filter(item => {
        if (!item.received_date) return false;
        const received = new Date(item.received_date);
        const daysSinceReceived = Math.floor((today.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));
        // Branch limit is 2 days; alert if approaching or exceeding
        return daysSinceReceived >= 1;
      })
      .map(item => {
        const received = new Date(item.received_date);
        const daysSinceReceived = Math.floor((today.getTime() - received.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = 2 - daysSinceReceived;
        return { ...item, daysSinceReceived, daysRemaining };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [inventory]);

  const inventoryMovementSummary = useMemo(() => {
    const summary = { intake: 0, output: 0, waste: 0, sale: 0, adjustment: 0, requisition_received: 0 };
    inventoryTransactions.forEach(txn => {
      const type = txn.type as keyof typeof summary;
      if (summary[type] !== undefined) {
        summary[type] += txn.quantity;
      }
    });
    return summary;
  }, [inventoryTransactions]);

  // ─── Computed: Returns Breakdown ────────────────────────────────────────────

  const returnsByStatus = useMemo(() => {
    const grouped: Record<string, { count: number; totalValue: number }> = {};
    returns.forEach(r => {
      const status = r.status || 'Pending';
      if (!grouped[status]) grouped[status] = { count: 0, totalValue: 0 };
      grouped[status].count += 1;
      grouped[status].totalValue += r.total_value;
    });
    return Object.entries(grouped)
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [returns]);

  const returnsByQuality = useMemo(() => {
    const grouped: Record<string, { count: number; quantity: number }> = {};
    returnItems.forEach(item => {
      const quality = item.quality_on_return || 'Good';
      if (!grouped[quality]) grouped[quality] = { count: 0, quantity: 0 };
      grouped[quality].count += 1;
      grouped[quality].quantity += item.quantity_returning;
    });
    return Object.entries(grouped)
      .map(([quality, data]) => ({ quality, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [returnItems]);

  const topReturnedProducts = useMemo(() => {
    const grouped: Record<string, { count: number; quantity: number; value: number }> = {};
    returnItems.forEach(item => {
      const name = item.product_name || 'Unknown';
      if (!grouped[name]) grouped[name] = { count: 0, quantity: 0, value: 0 };
      grouped[name].count += 1;
      grouped[name].quantity += item.quantity_returning;
      grouped[name].value += item.total_cost;
    });
    return Object.entries(grouped)
      .map(([product, data]) => ({ product, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);
  }, [returnItems]);

  const recoveryRate = useMemo(() => {
    const totalValue = round2(returns.reduce((sum, r) => sum + safeNum(r.total_value), 0));
    const wholesaleValue = round2(returns.reduce((sum, r) => sum + safeNum(r.wholesale_value), 0));
    return round2(safeDiv(wholesaleValue, totalValue, 0) * 100);
  }, [returns]);

  // ─── Computed: Waste Breakdown ──────────────────────────────────────────────

  const wasteByReason = useMemo(() => {
    const grouped: Record<string, { count: number; totalCost: number; totalQuantity: number }> = {};
    wasteRecords.forEach(w => {
      const reason = w.reason || 'Unknown';
      if (!grouped[reason]) grouped[reason] = { count: 0, totalCost: 0, totalQuantity: 0 };
      grouped[reason].count += 1;
      grouped[reason].totalCost += w.cost;
      grouped[reason].totalQuantity += w.quantity;
    });
    return Object.entries(grouped)
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [wasteRecords]);

  const wasteByCategory = useMemo(() => {
    const grouped: Record<string, { count: number; totalCost: number; totalQuantity: number }> = {};
    wasteRecords.forEach(w => {
      const category = w.category || 'General';
      if (!grouped[category]) grouped[category] = { count: 0, totalCost: 0, totalQuantity: 0 };
      grouped[category].count += 1;
      grouped[category].totalCost += w.cost;
      grouped[category].totalQuantity += w.quantity;
    });
    return Object.entries(grouped)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [wasteRecords]);

  const wasteTrend = useMemo(() => {
    const grouped: Record<string, { count: number; totalCost: number }> = {};
    wasteRecords.forEach(w => {
      const day = w.date || 'Unknown';
      if (!grouped[day]) grouped[day] = { count: 0, totalCost: 0 };
      grouped[day].count += 1;
      grouped[day].totalCost += w.cost;
    });
    return Object.entries(grouped)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [wasteRecords]);

  const totalWasteCost = useMemo(() => round2(wasteRecords.reduce((sum, w) => sum + safeNum(w.cost), 0)), [wasteRecords]);

  // ─── Computed: Expenses Breakdown ──────────────────────────────────────────

  const expensesByCategory = useMemo(() => {
    const grouped: Record<string, { count: number; totalAmount: number }> = {};
    expenses.forEach(e => {
      const cat = e.category || 'General';
      if (!grouped[cat]) grouped[cat] = { count: 0, totalAmount: 0 };
      grouped[cat].count += 1;
      grouped[cat].totalAmount += e.amount;
    });
    return Object.entries(grouped)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenses]);

  const expensesByCostType = useMemo(() => {
    const grouped: Record<string, { count: number; totalAmount: number }> = {};
    expenses.forEach(e => {
      const type = e.cost_type || 'general_expense';
      if (!grouped[type]) grouped[type] = { count: 0, totalAmount: 0 };
      grouped[type].count += 1;
      grouped[type].totalAmount += e.amount;
    });
    return Object.entries(grouped)
      .map(([costType, data]) => ({ costType, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenses]);

  const totalExpenses = useMemo(() => round2(expenses.reduce((sum, e) => sum + safeNum(e.amount), 0)), [expenses]);

  // ─── Computed: Requisitions Breakdown ──────────────────────────────────────

  const requisitionsByStatus = useMemo(() => {
    const grouped: Record<string, { count: number; totalCost: number }> = {};
    requisitions.forEach(r => {
      const status = r.status || 'Pending';
      if (!grouped[status]) grouped[status] = { count: 0, totalCost: 0 };
      grouped[status].count += 1;
      grouped[status].totalCost += r.total_cost;
    });
    return Object.entries(grouped)
      .map(([status, data]) => ({ status, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [requisitions]);

  const topRequisitionItems = useMemo(() => {
    const grouped: Record<string, { quantity: number; totalCost: number }> = {};
    requisitionItems.forEach(item => {
      const name = item.product_name || 'Unknown';
      if (!grouped[name]) grouped[name] = { quantity: 0, totalCost: 0 };
      grouped[name].quantity += item.quantity_requested;
      grouped[name].totalCost += item.total_cost;
    });
    return Object.entries(grouped)
      .map(([product, data]) => ({ product, ...data }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 15);
  }, [requisitionItems]);

  const totalRequisitionsCost = useMemo(() => round2(requisitions.reduce((sum, r) => sum + safeNum(r.total_cost), 0)), [requisitions]);

  // ─── Computed: P&L Metrics ─────────────────────────────────────────────────

  const pnlMetrics = useMemo(() => {
    const totalSales = round2(sales.reduce((sum, s) => sum + safeNum(s.total), 0));

    // Classify expenses into mutually exclusive buckets using cost_type first, then category fallback
    const classifyExpense = (e: OutletExpense): 'direct' | 'indirect' | 'general' => {
      const ct = e.cost_type || '';
      const cat = (e.category || '').toLowerCase();
      // Direct costs by cost_type
      if (ct === 'direct_cost' || ct === 'raw_materials') return 'direct';
      // Direct costs by category (only if cost_type doesn't already classify it)
      if (cat.includes('raw') || cat.includes('ingredient') || cat.includes('production') || cat.includes('labor') || cat.includes('packaging')) return 'direct';
      // Indirect costs
      if (ct === 'indirect_cost') return 'indirect';
      if (cat.includes('utility') || cat.includes('rent') || cat.includes('maintenance')) return 'indirect';
      // Everything else is general
      return 'general';
    };

    // Direct costs from cost_entries
    const directCosts = round2(expenses.filter(e => classifyExpense(e) === 'direct').reduce((sum, e) => sum + safeNum(e.amount), 0));

    // Also count requisitions cost as direct costs (purchases from main bakery)
    const requisitionsCost = round2(requisitions
      .filter(r => r.status !== 'Cancelled' && r.status !== 'Rejected')
      .reduce((sum, r) => sum + safeNum(r.total_cost), 0));

    const totalDirectCosts = round2(directCosts + requisitionsCost);
    const grossProfit = round2(totalSales - totalDirectCosts);

    // Indirect costs
    const indirectCosts = round2(expenses.filter(e => classifyExpense(e) === 'indirect').reduce((sum, e) => sum + safeNum(e.amount), 0));

    // General expenses
    const generalExpenses = round2(expenses.filter(e => classifyExpense(e) === 'general').reduce((sum, e) => sum + safeNum(e.amount), 0));

    const wasteCost = round2(wasteRecords.reduce((sum, w) => sum + safeNum(w.cost), 0));
    const totalIndirectAndGeneral = round2(indirectCosts + generalExpenses + wasteCost);
    const netProfit = round2(grossProfit - totalIndirectAndGeneral);
    const grossMargin = round2(safeDiv(grossProfit, totalSales, 0) * 100);
    const netMargin = round2(safeDiv(netProfit, totalSales, 0) * 100);

    return {
      totalSales,
      totalDirectCosts,
      requisitionsCost,
      directCosts,
      grossProfit,
      indirectCosts,
      generalExpenses,
      wasteCost,
      totalIndirectAndGeneral,
      netProfit,
      grossMargin,
      netMargin,
    };
  }, [sales, expenses, requisitions, wasteRecords]);

  // ─── Export Handlers ────────────────────────────────────────────────────────

  const handleExportOverview = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Sales', formatKES(overviewMetrics.totalSales)],
      ['Total Orders', String(overviewMetrics.totalOrders)],
      ['Average Order Value', formatKES(overviewMetrics.avgOrderValue)],
      ['Total Returns', String(overviewMetrics.totalReturnsCount)],
      ['Returns Value', formatKES(overviewMetrics.totalReturnsValue)],
      ['Total Waste Cost', formatKES(overviewMetrics.totalWasteCost)],
      ['Active Employees', String(overviewMetrics.activeEmployees)],
      ['Inventory Value', formatKES(overviewMetrics.inventoryValue)],
      ['Requisitions', String(overviewMetrics.totalRequisitions)],
      ['Requisitions Cost', formatKES(overviewMetrics.totalRequisitionsCost)],
    ];
    exportCSV(`outlet_overview_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'overview', outlet: selectedOutlet?.name } });
  };

  const handleExportSales = () => {
    const headers = ['Date', 'Payment Method', 'Sale Type', 'Cashier', 'Total'];
    const rows = sales.map(s => [
      formatDate(s.created_at),
      s.payment_method,
      s.sale_type,
      s.cashier_name,
      formatKES(s.total),
    ]);
    exportCSV(`outlet_sales_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'sales', outlet: selectedOutlet?.name } });
  };

  const handleExportInventory = () => {
    const headers = ['Item', 'Category', 'Quantity', 'Unit', 'Unit Cost', 'Selling Price', 'Value', 'Status'];
    const rows = inventory.map(i => [
      i.item_name,
      i.category,
      String(i.quantity),
      i.unit,
      formatKES(i.unit_cost),
      formatKES(i.selling_price),
      formatKES(i.quantity * i.unit_cost),
      i.status,
    ]);
    exportCSV(`outlet_inventory_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'inventory', outlet: selectedOutlet?.name } });
  };

  const handleExportReturns = () => {
    const headers = ['Date', 'Status', 'Total Items', 'Total Value', 'Wholesale Value'];
    const rows = returns.map(r => [
      formatDate(r.return_date),
      r.status,
      String(r.total_items),
      formatKES(r.total_value),
      formatKES(r.wholesale_value),
    ]);
    exportCSV(`outlet_returns_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'returns', outlet: selectedOutlet?.name } });
  };

  const handleExportWaste = () => {
    const headers = ['Date', 'Product', 'Quantity', 'Reason', 'Category', 'Cost', 'Status'];
    const rows = wasteRecords.map(w => [
      formatDate(w.date),
      w.product_name,
      String(w.quantity),
      w.reason,
      w.category,
      formatKES(w.cost),
      w.approval_status,
    ]);
    exportCSV(`outlet_waste_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'waste', outlet: selectedOutlet?.name } });
  };

  const handleExportExpenses = () => {
    const headers = ['Date', 'Category', 'Cost Type', 'Description', 'Amount'];
    const rows = expenses.map(e => [
      formatDate(e.expense_date),
      e.category,
      e.cost_type.replace(/_/g, ' '),
      e.description,
      formatKES(e.amount),
    ]);
    exportCSV(`outlet_expenses_${selectedOutlet?.code || 'report'}`, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Outlet Reports', record_id: selectedOutletId, details: { type: 'expenses', outlet: selectedOutlet?.name } });
  };

  const handleExportRequisitions = () => {
    const headers = ['Date', 'Req #', 'Requested By', 'Status', 'Priority', 'Total Cost'];
    const rows = requisitions.map(r => [
      formatDate(r.created_at),
      r.requisition_number,
      r.requested_by,
      r.status,
      r.priority,
      formatKES(r.total_cost),
    ]);
    exportCSV(`outlet_requisitions_${selectedOutlet?.code || 'report'}`, headers, rows);
  };

  const handleExportPnl = () => {
    const headers = ['Metric', 'Amount'];
    const rows = [
      ['Total Sales', formatKES(pnlMetrics.totalSales)],
      ['Direct Costs (Purchases/Materials)', formatKES(pnlMetrics.totalDirectCosts)],
      ['Gross Profit', formatKES(pnlMetrics.grossProfit)],
      ['Gross Margin', `${pnlMetrics.grossMargin.toFixed(1)}%`],
      ['Indirect Costs', formatKES(pnlMetrics.indirectCosts)],
      ['General Expenses', formatKES(pnlMetrics.generalExpenses)],
      ['Waste Cost', formatKES(pnlMetrics.wasteCost)],
      ['Net Profit', formatKES(pnlMetrics.netProfit)],
      ['Net Margin', `${pnlMetrics.netMargin.toFixed(1)}%`],
    ];
    exportCSV(`outlet_pnl_${selectedOutlet?.code || 'report'}`, headers, rows);
  };

  // ─── Tab Content Renderers ──────────────────────────────────────────────────

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportOverview} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Sales"
          value={formatKES(overviewMetrics.totalSales)}
          subtitle={`${overviewMetrics.totalOrders} orders`}
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Total Orders"
          value={overviewMetrics.totalOrders.toLocaleString()}
          subtitle="In selected period"
          icon={<ShoppingCart className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Average Order Value"
          value={formatKES(overviewMetrics.avgOrderValue)}
          subtitle="Per transaction"
          icon={<TrendingUp className="w-5 h-5" />}
          borderColor="border-l-purple-500"
        />
        <StatCard
          title="Total Returns"
          value={String(overviewMetrics.totalReturnsCount)}
          subtitle={formatKES(overviewMetrics.totalReturnsValue)}
          icon={<RotateCcw className="w-5 h-5" />}
          borderColor="border-l-amber-500"
        />
        <StatCard
          title="Total Waste Cost"
          value={formatKES(overviewMetrics.totalWasteCost)}
          subtitle={`${wasteRecords.length} records`}
          icon={<Trash2 className="w-5 h-5" />}
          borderColor="border-l-red-500"
        />
        <StatCard
          title="Active Employees"
          value={String(overviewMetrics.activeEmployees)}
          subtitle={`${employees.length} total assigned`}
          icon={<Users className="w-5 h-5" />}
          borderColor="border-l-indigo-500"
        />
        <StatCard
          title="Inventory Value"
          value={formatKES(overviewMetrics.inventoryValue)}
          subtitle={`${inventory.length} items`}
          icon={<Package className="w-5 h-5" />}
          borderColor="border-l-teal-500"
        />
        <StatCard
          title="Requisitions"
          value={String(overviewMetrics.totalRequisitions)}
          subtitle={formatKES(overviewMetrics.totalRequisitionsCost)}
          icon={<Layers className="w-5 h-5" />}
          borderColor="border-l-orange-500"
        />
      </div>

      {/* Quick Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Payment Method */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Sales by Payment Method</h3>
          {salesByPaymentMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales data</p>
          ) : (
            <div className="space-y-2">
              {salesByPaymentMethod.map(item => (
                <div key={item.method} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground font-medium">{item.method}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{formatKES(item.total)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.count})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Selling Products</h3>
          {topSellingProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales data</p>
          ) : (
            <div className="space-y-2">
              {topSellingProducts.slice(0, 5).map((item, idx) => (
                <div key={item.product} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="text-sm text-foreground">{item.product}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{formatKES(item.total)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({item.quantity} qty)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSalesTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportSales} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Sales Revenue"
          value={formatKES(overviewMetrics.totalSales)}
          subtitle={`${sales.length} transactions`}
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Average Order Value"
          value={formatKES(overviewMetrics.avgOrderValue)}
          subtitle="Per transaction"
          icon={<TrendingUp className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Unique Products Sold"
          value={String(topSellingProducts.length)}
          subtitle="In selected period"
          icon={<Package className="w-5 h-5" />}
          borderColor="border-l-purple-500"
        />
      </div>

      {/* Sales by Payment Method */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Sales by Payment Method</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Count</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Sales</th>
              </tr>
            </thead>
            <tbody>
              {salesByPaymentMethod.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No sales data for selected period</td></tr>
              ) : (
                salesByPaymentMethod.map(item => (
                  <tr key={item.method} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.method}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.total)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {(safeDiv(item.total, overviewMetrics.totalSales) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales by Sale Type */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Sales by Type (Retail vs Wholesale)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sale Type</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Count</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Sales</th>
              </tr>
            </thead>
            <tbody>
              {salesBySaleType.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No sales data for selected period</td></tr>
              ) : (
                salesBySaleType.map(item => (
                  <tr key={item.saleType} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.saleType}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.total)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {(safeDiv(item.total, overviewMetrics.totalSales) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Selling Products */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Top Selling Products</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty Sold</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topSellingProducts.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No product sales data</td></tr>
              ) : (
                topSellingProducts.map((item, idx) => (
                  <tr key={item.product} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{item.product}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.quantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Sales */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Daily Sales Totals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Orders</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Sales</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg per Order</th>
              </tr>
            </thead>
            <tbody>
              {dailySales.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No daily sales data</td></tr>
              ) : (
                dailySales.map(day => (
                  <tr key={day.date} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{formatDate(day.date)}</td>
                    <td className="px-5 py-3 text-right text-foreground">{day.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(day.total)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{formatKES(safeDiv(day.total, day.count, 0))}</td>
                  </tr>
                ))
              )}
            </tbody>
            {dailySales.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/50 font-semibold">
                  <td className="px-5 py-3 text-foreground">Total</td>
                  <td className="px-5 py-3 text-right text-foreground">{dailySales.reduce((s, d) => s + d.count, 0)}</td>
                  <td className="px-5 py-3 text-right text-foreground">{formatKES(dailySales.reduce((s, d) => s + d.total, 0))}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportInventory} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Items"
          value={String(inventory.length)}
          subtitle={`${inventory.filter(i => i.status === 'Active').length} active`}
          icon={<Package className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Total Inventory Value"
          value={formatKES(round2(inventory.reduce((s, i) => s + round2(safeNum(i.quantity) * safeNum(i.unit_cost)), 0)))}
          subtitle="Cost basis"
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Low Stock Items"
          value={String(lowStockItems.length)}
          subtitle="Below reorder level"
          icon={<AlertTriangle className="w-5 h-5" />}
          borderColor="border-l-amber-500"
        />
        <StatCard
          title="Freshness Alerts"
          value={String(freshnessAlerts.length)}
          subtitle="Approaching 2-day limit"
          icon={<Clock className="w-5 h-5" />}
          borderColor="border-l-red-500"
        />
      </div>

      {/* Stock Levels by Category */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Stock Levels by Category</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Qty</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {inventoryByCategory.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No inventory data</td></tr>
              ) : (
                inventoryByCategory.map(cat => (
                  <tr key={cat.category} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{cat.category}</td>
                    <td className="px-5 py-3 text-right text-foreground">{cat.count}</td>
                    <td className="px-5 py-3 text-right text-foreground">{cat.totalQuantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(cat.totalValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Items */}
      {lowStockItems.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Low Stock Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Qty</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reorder Level</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deficit</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.item_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-3 text-right text-red-600 font-semibold">{item.quantity} {item.unit}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.reorder_level} {item.unit}</td>
                    <td className="px-5 py-3 text-right text-red-600">{(item.reorder_level - item.quantity).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Freshness Alerts */}
      {freshnessAlerts.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Freshness Alerts (2-Day Branch Limit)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Received</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days at Branch</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {freshnessAlerts.map(item => (
                  <tr key={item.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.item_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.quantity} {item.unit}</td>
                    <td className="px-5 py-3 text-foreground">{formatDate(item.received_date)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{item.daysSinceReceived}</td>
                    <td className="px-5 py-3">
                      {item.daysRemaining <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Overdue</span>
                      ) : item.daysRemaining <= 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Expiring Soon</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inventory Movement Summary */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Inventory Movement Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Movement Type</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Quantity</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(inventoryMovementSummary).map(([type, qty]) => (
                <tr key={type} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground capitalize">{type.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-right text-foreground">
                    <span className={type === 'intake' || type === 'requisition_received' ? 'text-emerald-600 font-semibold' : type === 'waste' ? 'text-red-600 font-semibold' : 'font-semibold'}>
                      {type === 'intake' || type === 'requisition_received' ? '+' : type === 'output' || type === 'sale' || type === 'waste' ? '-' : ''}{qty.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderReturnsTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportReturns} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Returns"
          value={String(returns.length)}
          subtitle="In selected period"
          icon={<RotateCcw className="w-5 h-5" />}
          borderColor="border-l-amber-500"
        />
        <StatCard
          title="Total Return Value"
          value={formatKES(returns.reduce((s, r) => s + r.total_value, 0))}
          subtitle="At retail prices"
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-red-500"
        />
        <StatCard
          title="Wholesale Recovery"
          value={formatKES(returns.reduce((s, r) => s + r.wholesale_value, 0))}
          subtitle="Estimated recovery"
          icon={<TrendingUp className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Recovery Rate"
          value={`${recoveryRate.toFixed(1)}%`}
          subtitle="Wholesale / Retail value"
          icon={<ArrowUpDown className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
      </div>

      {/* Returns by Status */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Returns by Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Count</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {returnsByStatus.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">No returns data</td></tr>
              ) : (
                returnsByStatus.map(item => (
                  <tr key={item.status} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'Processed' || item.status === 'Received' ? 'bg-green-100 text-green-800' :
                        item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'In_Transit' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-foreground font-medium">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.totalValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns by Quality Grade */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Returns by Quality Grade</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quality</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Items</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Qty</th>
              </tr>
            </thead>
            <tbody>
              {returnsByQuality.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">No return items data</td></tr>
              ) : (
                returnsByQuality.map(item => (
                  <tr key={item.quality} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.quality === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                        item.quality === 'Good' ? 'bg-green-100 text-green-800' :
                        item.quality === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                        item.quality === 'Poor' ? 'bg-orange-100 text-orange-800' :
                        item.quality === 'Waste' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.quality}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-foreground font-medium">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{item.quantity.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Returned Products */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Top Returned Products</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Returns</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty Returned</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody>
              {topReturnedProducts.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No return items data</td></tr>
              ) : (
                topReturnedProducts.map((item, idx) => (
                  <tr key={item.product} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{item.product}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.quantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderWasteTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportWaste} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Waste Records"
          value={String(wasteRecords.length)}
          subtitle="In selected period"
          icon={<Trash2 className="w-5 h-5" />}
          borderColor="border-l-red-500"
        />
        <StatCard
          title="Total Waste Cost"
          value={formatKES(totalWasteCost)}
          subtitle="Total loss"
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-amber-500"
        />
        <StatCard
          title="Approved Waste"
          value={String(wasteRecords.filter(w => w.approval_status === 'Approved').length)}
          subtitle={formatKES(wasteRecords.filter(w => w.approval_status === 'Approved').reduce((s, w) => s + w.cost, 0))}
          icon={<Layers className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Pending Approval"
          value={String(wasteRecords.filter(w => w.approval_status === 'Pending').length)}
          subtitle={formatKES(wasteRecords.filter(w => w.approval_status === 'Pending').reduce((s, w) => s + w.cost, 0))}
          icon={<Clock className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
      </div>

      {/* Waste by Reason */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Waste by Reason</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Records</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Qty</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Waste</th>
              </tr>
            </thead>
            <tbody>
              {wasteByReason.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No waste data</td></tr>
              ) : (
                wasteByReason.map(item => (
                  <tr key={item.reason} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.reason}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.totalQuantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(item.totalCost)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {totalWasteCost > 0 ? ((item.totalCost / totalWasteCost) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waste by Category */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Waste by Category</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Records</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Qty</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {wasteByCategory.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No waste data</td></tr>
              ) : (
                wasteByCategory.map(item => (
                  <tr key={item.category} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.category}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.totalQuantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(item.totalCost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waste Trend (Daily) */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Waste Trend (Daily)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Records</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Cost/Record</th>
              </tr>
            </thead>
            <tbody>
              {wasteTrend.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No waste trend data</td></tr>
              ) : (
                wasteTrend.map(day => (
                  <tr key={day.date} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{formatDate(day.date)}</td>
                    <td className="px-5 py-3 text-right text-foreground">{day.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(day.totalCost)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{formatKES(day.count > 0 ? day.totalCost / day.count : 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {wasteTrend.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/50 font-semibold">
                  <td className="px-5 py-3 text-foreground">Total</td>
                  <td className="px-5 py-3 text-right text-foreground">{wasteTrend.reduce((s, d) => s + d.count, 0)}</td>
                  <td className="px-5 py-3 text-right text-red-600">{formatKES(wasteTrend.reduce((s, d) => s + d.totalCost, 0))}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );

  const renderPnlTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportPnl} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* P&L Flow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-card border-2 border-emerald-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-emerald-600">{formatKES(pnlMetrics.totalSales)}</p>
          <p className="text-xs text-muted-foreground mt-1">POS revenue this period</p>
        </div>
        <div className="bg-card border-2 border-red-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Direct Costs</p>
          <p className="text-2xl font-bold text-red-600">{formatKES(pnlMetrics.totalDirectCosts)}</p>
          <p className="text-xs text-muted-foreground mt-1">Purchases + materials</p>
        </div>
        <div className="bg-card border-2 border-blue-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Gross Profit</p>
          <p className={`text-2xl font-bold ${pnlMetrics.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatKES(pnlMetrics.grossProfit)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pnlMetrics.grossMargin.toFixed(1)}% margin</p>
        </div>
        <div className="bg-card border-2 border-purple-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Indirect + Expenses</p>
          <p className="text-2xl font-bold text-purple-600">{formatKES(pnlMetrics.totalIndirectAndGeneral)}</p>
          <p className="text-xs text-muted-foreground mt-1">Overhead + waste</p>
        </div>
        <div className={`bg-card border-2 rounded-xl p-5 shadow-sm ${pnlMetrics.netProfit >= 0 ? 'border-emerald-300' : 'border-red-300'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-muted-foreground">Net Profit</p>
          <p className={`text-2xl font-bold ${pnlMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(pnlMetrics.netProfit)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pnlMetrics.netMargin.toFixed(1)}% margin</p>
        </div>
      </div>

      {/* Net Profit Card - Full Width */}
      <div className={`border-2 rounded-xl p-6 shadow-sm ${pnlMetrics.netProfit >= 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profit & Loss Summary</p>
            <p className={`text-3xl font-bold ${pnlMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(pnlMetrics.netProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Net Margin</p>
            <p className={`text-2xl font-bold ${pnlMetrics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{pnlMetrics.netMargin.toFixed(1)}%</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2 text-xs">
          <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">Total Sales</p><p className="font-bold text-emerald-600">{formatKES(pnlMetrics.totalSales)}</p></div>
          <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">- Direct Costs</p><p className="font-bold text-red-600">{formatKES(pnlMetrics.totalDirectCosts)}</p></div>
          <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">= Gross Profit</p><p className="font-bold text-blue-600">{formatKES(pnlMetrics.grossProfit)}</p></div>
          <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">- Indirect + Expenses</p><p className="font-bold text-purple-600">{formatKES(pnlMetrics.totalIndirectAndGeneral)}</p></div>
          <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">= Net Profit</p><p className={`font-bold ${pnlMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(pnlMetrics.netProfit)}</p></div>
        </div>
      </div>

      {/* P&L Breakdown Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Detailed P&L Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Item</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-emerald-50/30">
                <td className="px-5 py-3 font-semibold text-emerald-700">Total Sales Revenue</td>
                <td className="px-5 py-3 text-right font-bold text-emerald-700">{formatKES(pnlMetrics.totalSales)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-5 py-3 text-muted-foreground pl-8">Less: Raw Materials / Purchases</td>
                <td className="px-5 py-3 text-right text-red-600">({formatKES(pnlMetrics.directCosts)})</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-5 py-3 text-muted-foreground pl-8">Less: Requisitions from Main Bakery</td>
                <td className="px-5 py-3 text-right text-red-600">({formatKES(pnlMetrics.requisitionsCost)})</td>
              </tr>
              <tr className="border-b-2 border-border bg-blue-50/30">
                <td className="px-5 py-3 font-semibold text-blue-700">Gross Profit</td>
                <td className={`px-5 py-3 text-right font-bold ${pnlMetrics.grossProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatKES(pnlMetrics.grossProfit)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-5 py-3 text-muted-foreground pl-8">Less: Indirect Costs (Utilities, Rent, etc.)</td>
                <td className="px-5 py-3 text-right text-red-600">({formatKES(pnlMetrics.indirectCosts)})</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-5 py-3 text-muted-foreground pl-8">Less: General Expenses</td>
                <td className="px-5 py-3 text-right text-red-600">({formatKES(pnlMetrics.generalExpenses)})</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-5 py-3 text-muted-foreground pl-8">Less: Waste Costs</td>
                <td className="px-5 py-3 text-right text-red-600">({formatKES(pnlMetrics.wasteCost)})</td>
              </tr>
              <tr className={`${pnlMetrics.netProfit >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                <td className="px-5 py-4 font-bold text-lg">Net Profit / (Loss)</td>
                <td className={`px-5 py-4 text-right font-bold text-lg ${pnlMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(pnlMetrics.netProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderExpensesTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportExpenses} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Expenses"
          value={formatKES(totalExpenses)}
          subtitle={`${expenses.length} entries`}
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-red-500"
        />
        <StatCard
          title="Expense Categories"
          value={String(expensesByCategory.length)}
          subtitle="Unique categories"
          icon={<Layers className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Avg per Entry"
          value={formatKES(expenses.length > 0 ? totalExpenses / expenses.length : 0)}
          subtitle="Average expense"
          icon={<TrendingUp className="w-5 h-5" />}
          borderColor="border-l-purple-500"
        />
      </div>

      {/* Expenses by Category */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Expenses by Category</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entries</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Amount</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {expensesByCategory.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No expense data for selected period</td></tr>
              ) : (
                expensesByCategory.map(item => (
                  <tr key={item.category} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{item.category}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(item.totalAmount)}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {totalExpenses > 0 ? ((item.totalAmount / totalExpenses) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expensesByCategory.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/50 font-semibold">
                  <td className="px-5 py-3 text-foreground">Total</td>
                  <td className="px-5 py-3 text-right text-foreground">{expenses.length}</td>
                  <td className="px-5 py-3 text-right text-red-600">{formatKES(totalExpenses)}</td>
                  <td className="px-5 py-3 text-right text-foreground">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Expenses by Cost Type */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Expenses by Cost Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost Type</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entries</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {expensesByCostType.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">No expense data</td></tr>
              ) : (
                expensesByCostType.map(item => (
                  <tr key={item.costType} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground capitalize">{item.costType.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(item.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRequisitionsTab = () => (
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <button onClick={handleExportRequisitions} className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Requisitions"
          value={String(requisitions.length)}
          subtitle="In selected period"
          icon={<Layers className="w-5 h-5" />}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Total Requisitions Cost"
          value={formatKES(totalRequisitionsCost)}
          subtitle="All requisitions"
          icon={<DollarSign className="w-5 h-5" />}
          borderColor="border-l-amber-500"
        />
        <StatCard
          title="Fulfilled"
          value={String(requisitions.filter(r => r.status === 'Fulfilled' || r.status === 'Partially_Fulfilled').length)}
          subtitle={formatKES(requisitions.filter(r => r.status === 'Fulfilled' || r.status === 'Partially_Fulfilled').reduce((s, r) => s + r.total_cost, 0))}
          icon={<Package className="w-5 h-5" />}
          borderColor="border-l-emerald-500"
        />
        <StatCard
          title="Pending"
          value={String(requisitions.filter(r => r.status === 'Pending' || r.status === 'Approved').length)}
          subtitle={formatKES(requisitions.filter(r => r.status === 'Pending' || r.status === 'Approved').reduce((s, r) => s + r.total_cost, 0))}
          icon={<Clock className="w-5 h-5" />}
          borderColor="border-l-orange-500"
        />
      </div>

      {/* Requisitions by Status */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Requisitions by Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Count</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {requisitionsByStatus.length === 0 ? (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">No requisitions data</td></tr>
              ) : (
                requisitionsByStatus.map(item => (
                  <tr key={item.status} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'Fulfilled' ? 'bg-green-100 text-green-800' :
                        item.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'Rejected' || item.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-foreground">{item.count}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.totalCost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Requested Items */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Top Requested Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty Requested</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {topRequisitionItems.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">No requisition items data</td></tr>
              ) : (
                topRequisitionItems.map((item, idx) => (
                  <tr key={item.product} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{item.product}</td>
                    <td className="px-5 py-3 text-right text-foreground">{item.quantity.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(item.totalCost)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requisitions List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Requisitions Detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Req #</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requested By</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No requisitions in selected period</td></tr>
              ) : (
                requisitions.map(req => (
                  <tr key={req.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-foreground">{formatDate(req.created_at)}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{req.requisition_number || '-'}</td>
                    <td className="px-5 py-3 text-foreground">{req.requested_by || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        req.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                        req.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{req.priority}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        req.status === 'Fulfilled' ? 'bg-green-100 text-green-800' :
                        req.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{req.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-foreground">{formatKES(req.total_cost)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {requisitions.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/50 font-semibold">
                  <td className="px-5 py-3 text-foreground" colSpan={5}>Total</td>
                  <td className="px-5 py-3 text-right text-foreground">{formatKES(totalRequisitionsCost)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Branch Reports</h1>
              <p className="text-sm text-muted-foreground">Branch-specific analytics and reporting dashboard. Select an outlet and date range to view detailed reports.</p>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            {/* Outlet Selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Store className="w-3.5 h-3.5 inline mr-1" />
                Branch
              </label>
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select a branch...</option>
                {outlets.map(outlet => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code}) {outlet.is_main_branch ? '- Main' : ''} - {outlet.outlet_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="min-w-[160px]">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* Date To */}
            <div className="min-w-[160px]">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={fetchReportData}
              disabled={!selectedOutletId || refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Selected Outlet Info */}
          {selectedOutlet && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Viewing: <strong className="text-foreground">{selectedOutlet.name}</strong> ({selectedOutlet.code})
                {' | '}Type: <strong className="text-foreground capitalize">{selectedOutlet.outlet_type}</strong>
                {' | '}Status: <span className={`font-medium ${selectedOutlet.status === 'Active' ? 'text-emerald-600' : 'text-red-600'}`}>{selectedOutlet.status}</span>
                {selectedOutlet.is_main_branch && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Main Branch</span>}
              </p>
            </div>
          )}
        </div>

        {/* No Outlet Selected */}
        {!selectedOutletId && (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Select a Branch</h2>
            <p className="text-sm text-muted-foreground">Choose a branch from the dropdown above to view its reports and analytics.</p>
          </div>
        )}

        {/* Loading State */}
        {selectedOutletId && loading && (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading report data...</p>
          </div>
        )}

        {/* Report Content */}
        {selectedOutletId && !loading && (
          <>
            {/* Tabs */}
            <div className="mb-6 border-b border-border">
              <div className="flex gap-1 overflow-x-auto">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'sales' && renderSalesTab()}
            {activeTab === 'pnl' && renderPnlTab()}
            {activeTab === 'expenses' && renderExpensesTab()}
            {activeTab === 'requisitions' && renderRequisitionsTab()}
            {activeTab === 'inventory' && renderInventoryTab()}
            {activeTab === 'returns' && renderReturnsTab()}
            {activeTab === 'waste' && renderWasteTab()}
          </>
        )}
      </div>
    </div>
  );
}
