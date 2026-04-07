'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPermissions } from '@/lib/user-permissions';

interface DailySales {
  date: string;
  total: number;
  cash: number;
  mpesa: number;
  card: number;
  credit: number;
  count: number;
}

export default function Dashboard() {
  const { isAdmin } = useUserPermissions();
  const [stats, setStats] = useState({ recipes: 0, products: 0, employees: 0, revenue: 0, orders: 0, inventory: 0, outlets: 0, pendingRequisitions: 0 });
  const [recentSales, setRecentSales] = useState<{ receipt: string; customer: string; total: number; method: string; date: string }[]>([]);
  const [outletsList, setOutletsList] = useState<{ name: string; type: string; status: string; is_main: boolean }[]>([]);
  const [salesBreakdown, setSalesBreakdown] = useState({ totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, creditSales: 0, totalTransactions: 0 });
  const [todaySales, setTodaySales] = useState<DailySales>({ date: '', total: 0, cash: 0, mpesa: 0, card: 0, credit: 0, count: 0 });
  const [productionStats, setProductionStats] = useState({ totalRuns: 0, completedRuns: 0, pendingRuns: 0 });
  const [stockAlerts, setStockAlerts] = useState({ lowStock: 0, outOfStock: 0, totalValue: 0 });
  const [expenses, setExpenses] = useState({ today: 0, month: 0 });
  const [activeShifts, setActiveShifts] = useState(0);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    setLoading(true);

    Promise.all([
      // Basic counts
      supabase.from('recipes').select('id', { count: 'exact', head: true }),
      supabase.from('food_info').select('id', { count: 'exact', head: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('inventory_items').select('id, quantity, unit_cost, reorder_level'),
      supabase.from('outlets').select('id', { count: 'exact', head: true }).eq('status', 'Active').then(r => r).catch(() => ({ count: 0, data: null, error: null })),
      supabase.from('outlet_requisitions').select('id', { count: 'exact', head: true }).eq('status', 'Pending').then(r => r).catch(() => ({ count: 0, data: null, error: null })),
      // POS sales with payment method breakdown
      supabase.from('pos_sales').select('total, payment_method, created_at').eq('status', 'Completed'),
      // Recent sales
      supabase.from('pos_sales').select('*').eq('status', 'Completed').order('created_at', { ascending: false }).limit(8),
      // Outlets list
      supabase.from('outlets').select('name, outlet_type, status, is_main_branch').eq('status', 'Active').order('is_main_branch', { ascending: false }).then(r => r).catch(() => ({ data: null, error: null })),
      // Production runs
      supabase.from('production_runs').select('status').then(r => r).catch(() => ({ data: null, error: null })),
      // Today's expenses
      supabase.from('cost_entries').select('amount, date').then(r => r).catch(() => ({ data: null, error: null })),
      // Active shifts
      supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'Active').then(r => r).catch(() => ({ count: 0, data: null, error: null })),
      // Pending deliveries
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).in('status', ['Pending', 'Assigned', 'In Transit']).then(r => r).catch(() => ({ count: 0, data: null, error: null })),
    ]).then(([recipes, products, employees, orders, inventory, outlets, requisitions, allSales, recentSalesData, outletsData, productionData, expensesData, shiftsData, deliveriesData]) => {
      // Inventory stats
      const invItems = inventory.data || [];
      const totalInvValue = invItems.reduce((s: number, r: Record<string, unknown>) => s + ((r.quantity as number || 0) * (r.unit_cost as number || 0)), 0);
      const lowStockCount = invItems.filter((r: Record<string, unknown>) => (r.quantity as number || 0) <= (r.reorder_level as number || 0) && (r.quantity as number || 0) > 0).length;
      const outOfStockCount = invItems.filter((r: Record<string, unknown>) => (r.quantity as number || 0) <= 0).length;
      setStockAlerts({ lowStock: lowStockCount, outOfStock: outOfStockCount, totalValue: totalInvValue });

      // Sales breakdown
      const salesData = allSales.data || [];
      const totalRev = salesData.reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const cashTotal = salesData.filter((r: Record<string, unknown>) => r.payment_method === 'Cash').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const mpesaTotal = salesData.filter((r: Record<string, unknown>) => r.payment_method === 'Mpesa' || r.payment_method === 'M-Pesa').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const cardTotal = salesData.filter((r: Record<string, unknown>) => r.payment_method === 'Card').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const creditTotal = salesData.filter((r: Record<string, unknown>) => r.payment_method === 'Credit').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      setSalesBreakdown({ totalSales: totalRev, cashSales: cashTotal, mpesaSales: mpesaTotal, cardSales: cardTotal, creditSales: creditTotal, totalTransactions: salesData.length });

      // Today's sales
      const todayData = salesData.filter((r: Record<string, unknown>) => ((r.created_at || '') as string).startsWith(today));
      const todayTotal = todayData.reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const todayCash = todayData.filter((r: Record<string, unknown>) => r.payment_method === 'Cash').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const todayMpesa = todayData.filter((r: Record<string, unknown>) => r.payment_method === 'Mpesa' || r.payment_method === 'M-Pesa').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const todayCard = todayData.filter((r: Record<string, unknown>) => r.payment_method === 'Card').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      const todayCredit = todayData.filter((r: Record<string, unknown>) => r.payment_method === 'Credit').reduce((s: number, r: Record<string, unknown>) => s + ((r.total || 0) as number), 0);
      setTodaySales({ date: today, total: todayTotal, cash: todayCash, mpesa: todayMpesa, card: todayCard, credit: todayCredit, count: todayData.length });

      // Production stats
      const prodData = productionData.data || [];
      const completedRuns = prodData.filter((r: Record<string, unknown>) => r.status === 'Completed').length;
      const pendingRuns = prodData.filter((r: Record<string, unknown>) => r.status !== 'Completed' && r.status !== 'Cancelled').length;
      setProductionStats({ totalRuns: prodData.length, completedRuns, pendingRuns });

      // Expenses
      const expData = expensesData.data || [];
      const todayExp = expData.filter((r: Record<string, unknown>) => (r.date as string || '') === today).reduce((s: number, r: Record<string, unknown>) => s + ((r.amount || 0) as number), 0);
      const monthExp = expData.filter((r: Record<string, unknown>) => (r.date as string || '') >= monthStart).reduce((s: number, r: Record<string, unknown>) => s + ((r.amount || 0) as number), 0);
      setExpenses({ today: todayExp, month: monthExp });

      setActiveShifts(shiftsData.count || 0);
      setPendingDeliveries(deliveriesData.count || 0);

      setStats({
        recipes: recipes.count || 0,
        products: products.count || 0,
        employees: employees.count || 0,
        revenue: totalRev,
        orders: orders.count || 0,
        inventory: invItems.length,
        outlets: outlets.count || 0,
        pendingRequisitions: requisitions.count || 0,
      });

      // Recent sales
      if (recentSalesData.data) {
        setRecentSales(recentSalesData.data.map((r: Record<string, unknown>) => ({
          receipt: (r.receipt_number || '') as string,
          customer: (r.customer_name || 'Walk-in') as string,
          total: (r.total || 0) as number,
          method: (r.payment_method || 'Cash') as string,
          date: new Date((r.created_at || '') as string).toLocaleString(),
        })));
      }

      // Outlets
      if (outletsData.data) {
        setOutletsList(outletsData.data.map((r: Record<string, unknown>) => ({
          name: (r.name || '') as string,
          type: (r.outlet_type || '') as string,
          status: (r.status || '') as string,
          is_main: (r.is_main_branch || false) as boolean,
        })));
      }

      setLoading(false);
    });
  }, []);

  const fmt = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-4 md:mb-6">
        <h1 className="text-lg md:text-xl font-bold mb-1">Snackoh Bakers Dashboard</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Welcome to Snackoh Bakers Management System</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── Today's Sales Highlight ── */}
          <div className="mb-6 border-2 border-primary/20 rounded-xl p-4 md:p-5 bg-primary/5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h2 className="text-sm md:text-base font-bold">Today&apos;s Sales</h2>
                <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="text-right">
                <p className="text-xl md:text-2xl font-bold text-primary">{fmt(todaySales.total)}</p>
                <p className="text-xs text-muted-foreground">{todaySales.count} transactions</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
              <div className="bg-white/80 rounded-lg p-2.5 md:p-3 border border-green-200">
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Cash Sales</p>
                <p className="text-sm md:text-lg font-bold text-green-700">{fmt(todaySales.cash)}</p>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 md:p-3 border border-blue-200">
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">M-Pesa Sales</p>
                <p className="text-sm md:text-lg font-bold text-blue-700">{fmt(todaySales.mpesa)}</p>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 md:p-3 border border-purple-200">
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Card Sales</p>
                <p className="text-sm md:text-lg font-bold text-purple-700">{fmt(todaySales.card)}</p>
              </div>
              <div className="bg-white/80 rounded-lg p-2.5 md:p-3 border border-amber-200">
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Credit Sales</p>
                <p className="text-sm md:text-lg font-bold text-amber-700">{fmt(todaySales.credit)}</p>
              </div>
            </div>
          </div>

          {/* ── Key Stats Grid ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
            <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Total Revenue</p>
              <p className="text-sm md:text-lg font-bold text-green-600">{fmt(salesBreakdown.totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">{salesBreakdown.totalTransactions} sales</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Cash Sales</p>
              <p className="text-sm md:text-lg font-bold text-green-700">{fmt(salesBreakdown.cashSales)}</p>
              <p className="text-[10px] text-muted-foreground">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.cashSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">M-Pesa Sales</p>
              <p className="text-sm md:text-lg font-bold text-blue-700">{fmt(salesBreakdown.mpesaSales)}</p>
              <p className="text-[10px] text-muted-foreground">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.mpesaSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Total Orders</p>
              <p className="text-sm md:text-lg font-bold">{stats.orders}</p>
            </div>
            <a href="/admin/employees" className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow block">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Employees</p>
              <p className="text-sm md:text-lg font-bold">{stats.employees}</p>
              <p className="text-[10px] text-primary">View Employee Management</p>
            </a>
            <div className="border border-border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Active Outlets</p>
              <p className="text-sm md:text-lg font-bold text-orange-600">{stats.outlets}</p>
            </div>
          </div>

          {/* ── Operations Overview ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3 mb-6">
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Recipes</p>
              <p className="text-sm md:text-lg font-bold">{stats.recipes}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Products</p>
              <p className="text-sm md:text-lg font-bold">{stats.products}</p>
            </div>
            <div className="border border-border rounded-lg p-3 bg-card">
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Production Runs</p>
              <p className="text-sm md:text-lg font-bold">{productionStats.completedRuns}<span className="text-xs text-muted-foreground">/{productionStats.totalRuns}</span></p>
            </div>
            <div className={`border rounded-lg p-3 bg-card ${stockAlerts.lowStock > 0 ? 'border-amber-300' : 'border-border'}`}>
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Low Stock Alerts</p>
              <p className={`text-sm md:text-lg font-bold ${stockAlerts.lowStock > 0 ? 'text-amber-600' : ''}`}>{stockAlerts.lowStock}</p>
            </div>
            <div className={`border rounded-lg p-3 bg-card ${pendingDeliveries > 0 ? 'border-blue-300' : 'border-border'}`}>
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Pending Deliveries</p>
              <p className={`text-sm md:text-lg font-bold ${pendingDeliveries > 0 ? 'text-blue-600' : ''}`}>{pendingDeliveries}</p>
            </div>
            <div className={`border rounded-lg p-3 bg-card ${stats.pendingRequisitions > 0 ? 'border-amber-300' : 'border-border'}`}>
              <p className="text-[10px] md:text-xs text-muted-foreground mb-0.5">Pending Requisitions</p>
              <p className={`text-sm md:text-lg font-bold ${stats.pendingRequisitions > 0 ? 'text-amber-600' : ''}`}>{stats.pendingRequisitions}</p>
            </div>
          </div>

          {/* ── Financial Overview ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="border border-green-200 rounded-lg p-4 bg-green-50/50">
              <p className="text-xs text-green-800 font-medium mb-1">Inventory Value</p>
              <p className="text-lg font-bold text-green-700">{fmt(stockAlerts.totalValue)}</p>
              <p className="text-[10px] text-green-600">{stats.inventory} items tracked</p>
            </div>
            <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
              <p className="text-xs text-red-800 font-medium mb-1">Today&apos;s Expenses</p>
              <p className="text-lg font-bold text-red-700">{fmt(expenses.today)}</p>
              <p className="text-[10px] text-red-600">Month: {fmt(expenses.month)}</p>
            </div>
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/50">
              <p className="text-xs text-blue-800 font-medium mb-1">Today&apos;s Net (Sales - Expenses)</p>
              <p className={`text-lg font-bold ${todaySales.total - expenses.today >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(todaySales.total - expenses.today)}</p>
              <p className="text-[10px] text-blue-600">Active shifts: {activeShifts}</p>
            </div>
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/50">
              <p className="text-xs text-purple-800 font-medium mb-1">Cash in Hand (Today)</p>
              <p className="text-lg font-bold text-purple-700">{fmt(todaySales.cash - expenses.today)}</p>
              <p className="text-[10px] text-purple-600">Cash sales minus expenses</p>
            </div>
          </div>

          {/* ── All-Time Sales Breakdown ── */}
          <div className="border border-border rounded-xl p-4 md:p-5 mb-6 bg-card">
            <h2 className="text-sm md:text-base font-bold mb-3">All-Time Sales Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-secondary rounded-lg text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">Total Sales</p>
                <p className="text-sm md:text-lg font-bold">{fmt(salesBreakdown.totalSales)}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center border border-green-200">
                <p className="text-[10px] md:text-xs text-green-700">Cash</p>
                <p className="text-sm md:text-lg font-bold text-green-700">{fmt(salesBreakdown.cashSales)}</p>
                <p className="text-[10px] text-green-600">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.cashSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-200">
                <p className="text-[10px] md:text-xs text-blue-700">M-Pesa</p>
                <p className="text-sm md:text-lg font-bold text-blue-700">{fmt(salesBreakdown.mpesaSales)}</p>
                <p className="text-[10px] text-blue-600">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.mpesaSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg text-center border border-purple-200">
                <p className="text-[10px] md:text-xs text-purple-700">Card</p>
                <p className="text-sm md:text-lg font-bold text-purple-700">{fmt(salesBreakdown.cardSales)}</p>
                <p className="text-[10px] text-purple-600">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.cardSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-center border border-amber-200">
                <p className="text-[10px] md:text-xs text-amber-700">Credit</p>
                <p className="text-sm md:text-lg font-bold text-amber-700">{fmt(salesBreakdown.creditSales)}</p>
                <p className="text-[10px] text-amber-600">{salesBreakdown.totalSales > 0 ? ((salesBreakdown.creditSales / salesBreakdown.totalSales) * 100).toFixed(1) : 0}%</p>
              </div>
            </div>
          </div>

          {/* ── Recent Sales & Quick Actions ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2 border border-border rounded-lg p-4 md:p-6">
              <h2 className="mb-3 md:mb-4 font-semibold text-sm md:text-base">Recent Sales</h2>
              <div className="space-y-2 md:space-y-3">
                {recentSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No sales recorded yet</p>
                ) : recentSales.map((sale, idx) => (
                  <div key={idx} className="flex items-start justify-between pb-2 md:pb-3 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs md:text-sm truncate">{sale.receipt}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{sale.customer} &bull; <span className={sale.method === 'Cash' ? 'text-green-600' : sale.method === 'Mpesa' || sale.method === 'M-Pesa' ? 'text-blue-600' : 'text-purple-600'}>{sale.method}</span></p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="text-xs md:text-sm font-bold">{fmt(sale.total)}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">{sale.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="border border-border rounded-lg p-4 md:p-6">
                <h2 className="mb-3 md:mb-4 font-semibold text-sm md:text-base">Quick Actions</h2>
                <div className="space-y-1.5 md:space-y-2">
                  {isAdmin && (
                    <>
                      <a href="/admin/roles-permissions" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium">User Creation</a>
                      <a href="/admin/employees" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium border border-green-200">Employee Management</a>
                    </>
                  )}
                  <a href="/admin/pos" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium">Open POS</a>
                  <a href="/admin/reports" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium border border-green-200">View Reports</a>
                  <a href="/admin/shifts" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Shift Management</a>
                  <a href="/admin/stock-take" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Stock Take</a>
                  <a href="/admin/orders" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Create Order</a>
                  <a href="/admin/production" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Start Production</a>
                  <a href="/admin/insurance" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Insurance</a>
                  <a href="/admin/outlets" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors font-medium border border-orange-200">Manage Branches</a>
                  <a href="/admin/settings" className="block px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm bg-secondary rounded-lg hover:bg-muted transition-colors">Settings</a>
                </div>
              </div>

              {/* Outlets Overview */}
              {outletsList.length > 0 && (
                <div className="border border-border rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h2 className="font-semibold text-sm md:text-base">Outlets</h2>
                    <a href="/admin/outlets" className="text-[10px] md:text-xs text-primary hover:underline">View All</a>
                  </div>
                  <div className="space-y-2">
                    {outletsList.slice(0, 5).map((outlet, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 md:py-2 border-b border-border last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-medium truncate">{outlet.name}</p>
                          <p className="text-[10px] md:text-xs text-muted-foreground capitalize">{outlet.type.replace('_', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 ml-2">
                          {outlet.is_main && <span className="px-1 md:px-1.5 py-0.5 text-[8px] md:text-[10px] font-bold bg-blue-100 text-blue-800 rounded">MAIN</span>}
                          <span className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${outlet.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{outlet.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
