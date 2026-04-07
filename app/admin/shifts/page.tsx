'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/modal';
import { logAudit } from '@/lib/audit-logger';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Shift {
  id: string;
  shift_number: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  outlet_id: string;
  outlet_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  scheduled_start: string;
  scheduled_end: string;
  opening_balance: number;
  closing_balance: number;
  total_sales: number;
  cash_sales: number;
  mpesa_sales: number;
  card_sales: number;
  credit_sales: number;
  total_transactions: number;
  total_expenses: number;
  net_cash: number;
  cash_variance: number;
  status: string;
  notes: string;
  closed_by: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
}

interface ShiftExpense {
  id: string;
  shift_id: string;
  description: string;
  amount: number;
  category: string;
  approved_by: string;
  receipt_url: string;
  created_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  category: string;
  status: string;
  primary_outlet_id: string;
  primary_outlet_name: string;
}

interface Outlet {
  id: string;
  name: string;
  outlet_type: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;
const SHIFT_TYPES = ['Morning', 'Afternoon', 'Evening', 'Night', 'Full Day'];
const SHIFT_STATUSES = ['Active', 'Closed', 'Approved', 'Disputed'];
const EXPENSE_CATEGORIES = ['Transport', 'Supplies', 'Maintenance', 'Food', 'Utilities', 'Other'];

type TabKey = 'active' | 'history' | 'reports' | 'branch';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active Shifts' },
  { key: 'history', label: 'Shift History' },
  { key: 'reports', label: 'Shift Reports' },
  { key: 'branch', label: 'Branch Shifts' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Safe number: guards against NaN, undefined, null, Infinity
function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : 0;
}

function formatKES(amount: number): string {
  return `KES ${safeNum(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '---';
  try {
    return new Date(dateStr).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '---';
  try {
    return new Date(dateStr).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return '---';
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return '---';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  } catch {
    return '---';
  }
}

function generateShiftNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SH-${datePart}-${rand}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-800';
    case 'Closed': return 'bg-gray-100 text-gray-800';
    case 'Approved': return 'bg-blue-100 text-blue-800';
    case 'Disputed': return 'bg-red-100 text-red-800';
    default: return 'bg-yellow-100 text-yellow-800';
  }
}

function getVarianceColor(variance: number): string {
  if (variance === 0) return 'text-green-600';
  if (Math.abs(variance) <= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
}

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

function exportPDF(title: string, headers: string[], rows: string[][]) {
  const style = `<style>
    body{font-family:Arial,sans-serif;margin:20px}
    h1{font-size:18px;margin-bottom:10px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    th{background:#f4f4f4;font-weight:bold}
    tr:nth-child(even){background:#f9f9f9}
    .meta{font-size:11px;color:#666;margin-bottom:15px}
  </style>`;
  const tableRows = rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title>${style}</head><body>
    <h1>${title}</h1>
    <p class="meta">Generated: ${new Date().toLocaleString('en-KE')}</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table></body></html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, borderColor }: {
  title: string;
  value: string;
  subtitle?: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border-l-4 ${borderColor}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const defaultRange = getDefaultDateRange();

  // Core state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftExpenses, setShiftExpenses] = useState<ShiftExpense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [filterOutlet, setFilterOutlet] = useState('All');
  const [dateFrom, setDateFrom] = useState(defaultRange.start);
  const [dateTo, setDateTo] = useState(defaultRange.end);

  // Branch tab filter
  const [branchOutletId, setBranchOutletId] = useState('');

  // Reports tab
  const [reportType, setReportType] = useState<'employee' | 'outlet' | 'daily' | 'weekly' | 'monthly'>('daily');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [showDetail, setShowDetail] = useState<Shift | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: 0, category: 'Other' });
  const [showCloseModal, setShowCloseModal] = useState<Shift | null>(null);
  const [closingBalance, setClosingBalance] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching shifts:', error.message);
      setShifts([]);
    } else {
      setShifts((data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        shift_number: (r.shift_number || '') as string,
        employee_id: (r.employee_id || '') as string,
        employee_name: (r.employee_name || '') as string,
        employee_role: (r.employee_role || '') as string,
        outlet_id: (r.outlet_id || '') as string,
        outlet_name: (r.outlet_name || '') as string,
        shift_type: (r.shift_type || 'Full Day') as string,
        start_time: (r.start_time || '') as string,
        end_time: (r.end_time || '') as string,
        scheduled_start: (r.scheduled_start || '') as string,
        scheduled_end: (r.scheduled_end || '') as string,
        opening_balance: (r.opening_balance || 0) as number,
        closing_balance: (r.closing_balance || 0) as number,
        total_sales: (r.total_sales || 0) as number,
        cash_sales: (r.cash_sales || 0) as number,
        mpesa_sales: (r.mpesa_sales || 0) as number,
        card_sales: (r.card_sales || 0) as number,
        credit_sales: (r.credit_sales || 0) as number,
        total_transactions: (r.total_transactions || 0) as number,
        total_expenses: (r.total_expenses || 0) as number,
        net_cash: (r.net_cash || 0) as number,
        cash_variance: (r.cash_variance || 0) as number,
        status: (r.status || 'Active') as string,
        notes: (r.notes || '') as string,
        closed_by: (r.closed_by || '') as string,
        approved_by: (r.approved_by || '') as string,
        approved_at: (r.approved_at || '') as string,
        created_at: (r.created_at || '') as string,
      })));
    }
    setLoading(false);
  }, []);

  const fetchShiftExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('shift_expenses')
      .select('*')
      .order('created_at', { ascending: false });
    setShiftExpenses((data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      shift_id: (r.shift_id || '') as string,
      description: (r.description || '') as string,
      amount: (r.amount || 0) as number,
      category: (r.category || 'Other') as string,
      approved_by: (r.approved_by || '') as string,
      receipt_url: (r.receipt_url || '') as string,
      created_at: (r.created_at || '') as string,
    })));
  }, []);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, category, status, primary_outlet_id, primary_outlet_name')
      .order('first_name', { ascending: true });
    setEmployees((data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      first_name: (r.first_name || '') as string,
      last_name: (r.last_name || '') as string,
      category: (r.category || '') as string,
      status: (r.status || 'Active') as string,
      primary_outlet_id: (r.primary_outlet_id || '') as string,
      primary_outlet_name: (r.primary_outlet_name || '') as string,
    })));
  }, []);

  const fetchOutlets = useCallback(async () => {
    const { data } = await supabase
      .from('outlets')
      .select('id, name, outlet_type, status')
      .order('name', { ascending: true });
    setOutlets((data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.name || '') as string,
      outlet_type: (r.outlet_type || '') as string,
      status: (r.status || 'Active') as string,
    })));
  }, []);

  useEffect(() => {
    fetchShifts();
    fetchShiftExpenses();
    fetchEmployees();
    fetchOutlets();
  }, [fetchShifts, fetchShiftExpenses, fetchEmployees, fetchOutlets]);

  // ─── Computed Data ─────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().split('T')[0];

  const activeShifts = useMemo(() => shifts.filter(s => s.status === 'Active'), [shifts]);

  const todayShifts = useMemo(() =>
    shifts.filter(s => s.created_at && s.created_at.startsWith(todayStr)),
    [shifts, todayStr]
  );

  const todayTotalSales = useMemo(() =>
    todayShifts.reduce((sum, s) => sum + safeNum(s.total_sales), 0),
    [todayShifts]
  );

  const avgShiftDuration = useMemo(() => {
    const closedShifts = shifts.filter(s => s.start_time && s.end_time && s.status !== 'Active');
    if (closedShifts.length === 0) return '---';
    const totalMs = closedShifts.reduce((sum, s) => {
      return sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime());
    }, 0);
    const avgMs = totalMs / closedShifts.length;
    const hours = Math.floor(avgMs / 3600000);
    const minutes = Math.floor((avgMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }, [shifts]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const applyFilters = useCallback((list: Shift[]) => {
    let result = list;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.shift_number.toLowerCase().includes(q) ||
        s.employee_name.toLowerCase().includes(q) ||
        s.outlet_name.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'All') result = result.filter(s => s.status === filterStatus);
    if (filterEmployee !== 'All') result = result.filter(s => s.employee_id === filterEmployee);
    if (filterOutlet !== 'All') result = result.filter(s => s.outlet_id === filterOutlet);
    if (dateFrom) result = result.filter(s => s.created_at >= `${dateFrom}T00:00:00`);
    if (dateTo) result = result.filter(s => s.created_at <= `${dateTo}T23:59:59`);
    return result;
  }, [searchQuery, filterStatus, filterEmployee, filterOutlet, dateFrom, dateTo]);

  const filteredHistory = useMemo(() => applyFilters(shifts), [applyFilters, shifts]);

  const branchShifts = useMemo(() => {
    if (!branchOutletId) return [];
    let result = shifts.filter(s => s.outlet_id === branchOutletId);
    if (dateFrom) result = result.filter(s => s.created_at >= `${dateFrom}T00:00:00`);
    if (dateTo) result = result.filter(s => s.created_at <= `${dateTo}T23:59:59`);
    return result;
  }, [shifts, branchOutletId, dateFrom, dateTo]);

  // Pagination
  const totalPages = useMemo(() => {
    const list = activeTab === 'history' ? filteredHistory : activeTab === 'branch' ? branchShifts : [];
    return Math.max(1, Math.ceil(list.length / ITEMS_PER_PAGE));
  }, [activeTab, filteredHistory, branchShifts]);

  const paginatedList = useMemo(() => {
    const list = activeTab === 'history' ? filteredHistory : activeTab === 'branch' ? branchShifts : [];
    return list.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [activeTab, filteredHistory, branchShifts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterEmployee, filterOutlet, dateFrom, dateTo, activeTab, branchOutletId]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleCloseShift = async () => {
    if (!showCloseModal) return;
    const shift = showCloseModal;
    const expectedCash = shift.opening_balance + shift.cash_sales - shift.total_expenses;
    const variance = closingBalance - expectedCash;

    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'Closed',
        end_time: new Date().toISOString(),
        closing_balance: closingBalance,
        net_cash: shift.cash_sales - shift.total_expenses,
        cash_variance: variance,
        notes: closingNotes || shift.notes,
      })
      .eq('id', shift.id);

    if (!error) {
      await logAudit({ action: 'UPDATE', module: 'Shifts', record_id: shift.id, details: { action: 'close_shift', closing_balance: closingBalance, variance } });
      fetchShifts();
      setShowCloseModal(null);
      setClosingBalance(0);
      setClosingNotes('');
    }
  };

  const handleApproveShift = async (shift: Shift) => {
    const { error } = await supabase
      .from('shifts')
      .update({ status: 'Approved', approved_at: new Date().toISOString() })
      .eq('id', shift.id);
    if (!error) {
      await logAudit({ action: 'APPROVE', module: 'Shifts', record_id: shift.id });
      fetchShifts();
    }
  };

  const handleAddExpense = async () => {
    if (!showExpenseModal || !expenseForm.description || expenseForm.amount <= 0) return;
    const { error } = await supabase
      .from('shift_expenses')
      .insert({
        shift_id: showExpenseModal,
        description: expenseForm.description,
        amount: expenseForm.amount,
        category: expenseForm.category,
      });
    if (!error) {
      // Update total_expenses on the shift
      const currentShift = shifts.find(s => s.id === showExpenseModal);
      if (currentShift) {
        const newTotal = currentShift.total_expenses + expenseForm.amount;
        await supabase.from('shifts').update({ total_expenses: newTotal, net_cash: currentShift.cash_sales - newTotal }).eq('id', showExpenseModal);
      }
      await logAudit({ action: 'CREATE', module: 'Shift Expenses', record_id: showExpenseModal, details: { amount: expenseForm.amount, category: expenseForm.category } });
      fetchShifts();
      fetchShiftExpenses();
      setShowExpenseModal(null);
      setExpenseForm({ description: '', amount: 0, category: 'Other' });
    }
  };

  // ─── Export Helpers ────────────────────────────────────────────────────────

  const exportShiftsCSV = (list: Shift[], filename: string) => {
    const headers = ['Shift #', 'Employee', 'Outlet', 'Type', 'Start', 'End', 'Duration', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Credit', 'Expenses', 'Net Cash', 'Variance', 'Status'];
    const rows = list.map(s => [
      s.shift_number, s.employee_name, s.outlet_name, s.shift_type,
      formatDateTime(s.start_time), formatDateTime(s.end_time),
      s.end_time ? formatDuration(s.start_time, s.end_time) : 'Active',
      s.total_sales.toString(), s.cash_sales.toString(), s.mpesa_sales.toString(),
      s.card_sales.toString(), s.credit_sales.toString(), s.total_expenses.toString(),
      s.net_cash.toString(), s.cash_variance.toString(), s.status,
    ]);
    exportCSV(filename, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Shifts', details: { format: 'csv', count: list.length } });
  };

  const exportShiftsPDF = (list: Shift[], title: string) => {
    const headers = ['Shift #', 'Employee', 'Outlet', 'Start', 'Sales', 'Cash', 'M-Pesa', 'Variance', 'Status'];
    const rows = list.map(s => [
      s.shift_number, s.employee_name, s.outlet_name,
      formatDateTime(s.start_time), formatKES(s.total_sales), formatKES(s.cash_sales),
      formatKES(s.mpesa_sales), formatKES(s.cash_variance), s.status,
    ]);
    exportPDF(title, headers, rows);
    logAudit({ action: 'EXPORT', module: 'Shifts', details: { format: 'pdf', count: list.length } });
  };

  // ─── Reports Data ──────────────────────────────────────────────────────────

  const reportShifts = useMemo(() => {
    let result = shifts;
    if (dateFrom) result = result.filter(s => s.created_at >= `${dateFrom}T00:00:00`);
    if (dateTo) result = result.filter(s => s.created_at <= `${dateTo}T23:59:59`);
    return result;
  }, [shifts, dateFrom, dateTo]);

  const employeeReport = useMemo(() => {
    const map: Record<string, { name: string; totalShifts: number; totalSales: number; cashSales: number; mpesaSales: number; cardSales: number; totalExpenses: number; avgDuration: number; totalVariance: number }> = {};
    reportShifts.forEach(s => {
      if (!map[s.employee_id]) {
        map[s.employee_id] = { name: s.employee_name, totalShifts: 0, totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, totalExpenses: 0, avgDuration: 0, totalVariance: 0 };
      }
      const e = map[s.employee_id];
      e.totalShifts++;
      e.totalSales += s.total_sales;
      e.cashSales += s.cash_sales;
      e.mpesaSales += s.mpesa_sales;
      e.cardSales += s.card_sales;
      e.totalExpenses += s.total_expenses;
      e.totalVariance += s.cash_variance;
      if (s.start_time && s.end_time) {
        e.avgDuration += new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
      }
    });
    return Object.entries(map).map(([id, data]) => ({
      id,
      ...data,
      avgDuration: data.totalShifts > 0 ? data.avgDuration / data.totalShifts : 0,
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [reportShifts]);

  const outletReport = useMemo(() => {
    const map: Record<string, { name: string; totalShifts: number; totalSales: number; cashSales: number; mpesaSales: number; cardSales: number; totalExpenses: number; totalVariance: number }> = {};
    reportShifts.forEach(s => {
      if (!map[s.outlet_id]) {
        map[s.outlet_id] = { name: s.outlet_name, totalShifts: 0, totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, totalExpenses: 0, totalVariance: 0 };
      }
      const o = map[s.outlet_id];
      o.totalShifts++;
      o.totalSales += s.total_sales;
      o.cashSales += s.cash_sales;
      o.mpesaSales += s.mpesa_sales;
      o.cardSales += s.card_sales;
      o.totalExpenses += s.total_expenses;
      o.totalVariance += s.cash_variance;
    });
    return Object.entries(map).map(([id, data]) => ({
      id,
      ...data,
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [reportShifts]);

  const periodReport = useMemo(() => {
    const map: Record<string, { label: string; totalShifts: number; totalSales: number; cashSales: number; mpesaSales: number; cardSales: number; totalExpenses: number; totalVariance: number }> = {};
    reportShifts.forEach(s => {
      let key: string;
      const d = new Date(s.created_at);
      if (reportType === 'daily') {
        key = s.created_at.split('T')[0];
      } else if (reportType === 'weekly') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = startOfWeek.toISOString().split('T')[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!map[key]) {
        map[key] = {
          label: reportType === 'monthly'
            ? new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
            : reportType === 'weekly' ? `Week of ${formatDate(key)}` : formatDate(key),
          totalShifts: 0, totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, totalExpenses: 0, totalVariance: 0,
        };
      }
      const p = map[key];
      p.totalShifts++;
      p.totalSales += s.total_sales;
      p.cashSales += s.cash_sales;
      p.mpesaSales += s.mpesa_sales;
      p.cardSales += s.card_sales;
      p.totalExpenses += s.total_expenses;
      p.totalVariance += s.cash_variance;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, data]) => data);
  }, [reportShifts, reportType]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shift data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Shift Management</h1>
        <p className="text-muted-foreground mt-1">Track shifts, sales, expenses, and cash variance across outlets</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Shifts Today"
          value={String(todayShifts.length)}
          subtitle={`${activeShifts.length} currently active`}
          borderColor="border-l-blue-500"
        />
        <StatCard
          title="Active Now"
          value={String(activeShifts.length)}
          subtitle={activeShifts.length > 0 ? `Across ${new Set(activeShifts.map(s => s.outlet_id)).size} outlet(s)` : 'No active shifts'}
          borderColor="border-l-green-500"
        />
        <StatCard
          title="Total Sales Today"
          value={formatKES(todayTotalSales)}
          subtitle={`From ${todayShifts.reduce((s, sh) => s + safeNum(sh.total_transactions), 0)} transactions`}
          borderColor="border-l-purple-500"
        />
        <StatCard
          title="Avg Shift Duration"
          value={avgShiftDuration}
          subtitle="Across all closed shifts"
          borderColor="border-l-orange-500"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex space-x-0 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Active Shifts                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'active' && (
        <div>
          {activeShifts.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-lg">No active shifts right now</p>
              <p className="text-sm text-muted-foreground mt-1">Active shifts will appear here in real-time</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeShifts.map(shift => {
                const expenses = shiftExpenses.filter(e => e.shift_id === shift.id);
                const expenseTotal = expenses.reduce((s, e) => s + safeNum(e.amount), 0);
                const elapsedMs = Date.now() - new Date(shift.start_time).getTime();
                const elapsedHrs = Math.floor(elapsedMs / 3600000);
                const elapsedMins = Math.floor((elapsedMs % 3600000) / 60000);

                return (
                  <div key={shift.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-semibold text-foreground">{shift.shift_number}</p>
                        <p className="text-sm text-muted-foreground">{shift.employee_name}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 animate-pulse">
                        LIVE
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Outlet</span>
                        <span className="font-medium text-foreground">{shift.outlet_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="text-foreground">{shift.shift_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Started</span>
                        <span className="text-foreground">{formatDateTime(shift.start_time)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Elapsed</span>
                        <span className="font-medium text-foreground">{elapsedHrs}h {elapsedMins}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Opening Balance</span>
                        <span className="text-foreground">{formatKES(shift.opening_balance)}</span>
                      </div>

                      <hr className="border-border" />

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Sales</span>
                        <span className="font-bold text-foreground">{formatKES(shift.total_sales)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cash / M-Pesa / Card</span>
                        <span className="text-foreground text-xs">
                          {formatKES(shift.cash_sales)} / {formatKES(shift.mpesa_sales)} / {formatKES(shift.card_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transactions</span>
                        <span className="text-foreground">{shift.total_transactions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expenses</span>
                        <span className="text-red-600">{formatKES(expenseTotal)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => setShowDetail(shift)}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-secondary text-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => setShowExpenseModal(shift.id)}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors"
                      >
                        + Expense
                      </button>
                      <button
                        onClick={() => { setShowCloseModal(shift); setClosingBalance(0); setClosingNotes(''); }}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Close Shift
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Shift History                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Search shifts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Statuses</option>
                {SHIFT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={filterEmployee}
                onChange={e => setFilterEmployee(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
              <select
                value={filterOutlet}
                onChange={e => setFilterOutlet(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Outlets</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => exportShiftsCSV(filteredHistory, 'shift_history')}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => exportShiftsPDF(filteredHistory, 'Shift History Report')}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Export PDF
                </button>
              </div>
              <div className="text-sm text-muted-foreground flex items-center">
                Showing {filteredHistory.length} shift(s)
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Shift #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Employee</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Start</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Duration</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Sales</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">M-Pesa</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Card</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Net Cash</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Variance</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedList.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-12 text-muted-foreground">No shifts found matching your filters</td>
                    </tr>
                  ) : paginatedList.map(shift => (
                    <tr key={shift.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{shift.shift_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{shift.employee_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{shift.outlet_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{shift.shift_type}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(shift.start_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {shift.end_time ? formatDuration(shift.start_time, shift.end_time) : <span className="text-green-600 font-medium">Active</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap font-medium">{formatKES(shift.total_sales)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.cash_sales)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.mpesa_sales)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.card_sales)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.net_cash)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${getVarianceColor(shift.cash_variance)}`}>
                        {shift.cash_variance > 0 ? '+' : ''}{formatKES(shift.cash_variance)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shift.status)}`}>
                          {shift.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setShowDetail(shift)}
                            className="px-2 py-1 text-xs bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                          >
                            View
                          </button>
                          {shift.status === 'Closed' && (
                            <button
                              onClick={() => handleApproveShift(shift)}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredHistory.length} total)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-secondary transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm border rounded-lg transition-colors ${
                          currentPage === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-secondary transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Shift Reports                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div>
          {/* Report Controls */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value as typeof reportType)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="daily">Daily Summary</option>
                <option value="weekly">Weekly Summary</option>
                <option value="monthly">Monthly Summary</option>
                <option value="employee">By Employee</option>
                <option value="outlet">By Outlet</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (reportType === 'employee') {
                      exportCSV('shift_report_employee', ['Employee', 'Shifts', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Expenses', 'Variance'],
                        employeeReport.map(r => [r.name, String(r.totalShifts), r.totalSales.toFixed(2), r.cashSales.toFixed(2), r.mpesaSales.toFixed(2), r.cardSales.toFixed(2), r.totalExpenses.toFixed(2), r.totalVariance.toFixed(2)]));
                    } else if (reportType === 'outlet') {
                      exportCSV('shift_report_outlet', ['Outlet', 'Shifts', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Expenses', 'Variance'],
                        outletReport.map(r => [r.name, String(r.totalShifts), r.totalSales.toFixed(2), r.cashSales.toFixed(2), r.mpesaSales.toFixed(2), r.cardSales.toFixed(2), r.totalExpenses.toFixed(2), r.totalVariance.toFixed(2)]));
                    } else {
                      exportCSV(`shift_report_${reportType}`, ['Period', 'Shifts', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Expenses', 'Variance'],
                        periodReport.map(r => [r.label, String(r.totalShifts), r.totalSales.toFixed(2), r.cashSales.toFixed(2), r.mpesaSales.toFixed(2), r.cardSales.toFixed(2), r.totalExpenses.toFixed(2), r.totalVariance.toFixed(2)]));
                    }
                    logAudit({ action: 'EXPORT', module: 'Shift Reports', details: { reportType, dateFrom, dateTo } });
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  CSV
                </button>
                <button
                  onClick={() => {
                    const headers = reportType === 'employee' || reportType === 'outlet'
                      ? [reportType === 'employee' ? 'Employee' : 'Outlet', 'Shifts', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Expenses', 'Variance']
                      : ['Period', 'Shifts', 'Total Sales', 'Cash', 'M-Pesa', 'Card', 'Expenses', 'Variance'];
                    const rows = reportType === 'employee'
                      ? employeeReport.map(r => [r.name, String(r.totalShifts), formatKES(r.totalSales), formatKES(r.cashSales), formatKES(r.mpesaSales), formatKES(r.cardSales), formatKES(r.totalExpenses), formatKES(r.totalVariance)])
                      : reportType === 'outlet'
                      ? outletReport.map(r => [r.name, String(r.totalShifts), formatKES(r.totalSales), formatKES(r.cashSales), formatKES(r.mpesaSales), formatKES(r.cardSales), formatKES(r.totalExpenses), formatKES(r.totalVariance)])
                      : periodReport.map(r => [r.label, String(r.totalShifts), formatKES(r.totalSales), formatKES(r.cashSales), formatKES(r.mpesaSales), formatKES(r.cardSales), formatKES(r.totalExpenses), formatKES(r.totalVariance)]);
                    exportPDF(`Shift Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, headers, rows);
                    logAudit({ action: 'EXPORT', module: 'Shift Reports', details: { reportType, format: 'pdf' } });
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard title="Report Period Shifts" value={String(reportShifts.length)} borderColor="border-l-blue-500" />
            <StatCard title="Total Sales" value={formatKES(reportShifts.reduce((s, sh) => s + safeNum(sh.total_sales), 0))} borderColor="border-l-green-500" />
            <StatCard title="Total Expenses" value={formatKES(reportShifts.reduce((s, sh) => s + safeNum(sh.total_expenses), 0))} borderColor="border-l-red-500" />
            <StatCard
              title="Total Variance"
              value={formatKES(reportShifts.reduce((s, sh) => s + safeNum(sh.cash_variance), 0))}
              subtitle={reportShifts.filter(s => Math.abs(s.cash_variance) > 50).length > 0 ? `${reportShifts.filter(s => Math.abs(s.cash_variance) > 50).length} alert(s)` : 'All clear'}
              borderColor="border-l-yellow-500"
            />
          </div>

          {/* Employee Report */}
          {reportType === 'employee' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="font-semibold text-foreground">Per-Employee Shift Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Employee</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Shifts</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Sales</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">M-Pesa</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Card</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Expenses</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Avg Duration</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {employeeReport.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No data for selected period</td></tr>
                    ) : employeeReport.map(row => {
                      const avgH = Math.floor(row.avgDuration / 3600000);
                      const avgM = Math.floor((row.avgDuration % 3600000) / 60000);
                      return (
                        <tr key={row.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{row.name}</td>
                          <td className="px-4 py-3 text-right">{row.totalShifts}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatKES(row.totalSales)}</td>
                          <td className="px-4 py-3 text-right">{formatKES(row.cashSales)}</td>
                          <td className="px-4 py-3 text-right">{formatKES(row.mpesaSales)}</td>
                          <td className="px-4 py-3 text-right">{formatKES(row.cardSales)}</td>
                          <td className="px-4 py-3 text-right">{formatKES(row.totalExpenses)}</td>
                          <td className="px-4 py-3 text-right">{avgH}h {avgM}m</td>
                          <td className={`px-4 py-3 text-right font-medium ${getVarianceColor(row.totalVariance)}`}>
                            {row.totalVariance > 0 ? '+' : ''}{formatKES(row.totalVariance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Outlet Report */}
          {reportType === 'outlet' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="font-semibold text-foreground">Per-Outlet Shift Totals</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Outlet</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Shifts</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Sales</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">M-Pesa</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Card</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Expenses</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {outletReport.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No data for selected period</td></tr>
                    ) : outletReport.map(row => (
                      <tr key={row.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{row.name}</td>
                        <td className="px-4 py-3 text-right">{row.totalShifts}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatKES(row.totalSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.cashSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.mpesaSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.cardSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.totalExpenses)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${getVarianceColor(row.totalVariance)}`}>
                          {row.totalVariance > 0 ? '+' : ''}{formatKES(row.totalVariance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Period Report (Daily / Weekly / Monthly) */}
          {(reportType === 'daily' || reportType === 'weekly' || reportType === 'monthly') && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="font-semibold text-foreground">
                  {reportType === 'daily' ? 'Daily' : reportType === 'weekly' ? 'Weekly' : 'Monthly'} Summary
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Period</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Shifts</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Sales</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">M-Pesa</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Card</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Expenses</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {periodReport.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No data for selected period</td></tr>
                    ) : periodReport.map((row, idx) => (
                      <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{row.label}</td>
                        <td className="px-4 py-3 text-right">{row.totalShifts}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatKES(row.totalSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.cashSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.mpesaSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.cardSales)}</td>
                        <td className="px-4 py-3 text-right">{formatKES(row.totalExpenses)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${getVarianceColor(row.totalVariance)}`}>
                          {row.totalVariance > 0 ? '+' : ''}{formatKES(row.totalVariance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variance Alerts */}
          {reportShifts.filter(s => Math.abs(s.cash_variance) > 50).length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-800 mb-3">Variance Alerts</h3>
              <div className="space-y-2">
                {reportShifts.filter(s => Math.abs(s.cash_variance) > 50).map(s => (
                  <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                    <div>
                      <span className="font-mono text-xs text-red-700">{s.shift_number}</span>
                      <span className="mx-2 text-sm text-red-800">{s.employee_name}</span>
                      <span className="text-xs text-red-600">at {s.outlet_name}</span>
                    </div>
                    <div className="mt-1 sm:mt-0">
                      <span className={`text-sm font-bold ${s.cash_variance > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {s.cash_variance > 0 ? 'Over' : 'Short'}: {formatKES(Math.abs(s.cash_variance))}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Branch Shifts                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'branch' && (
        <div>
          {/* Branch selector */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={branchOutletId}
                onChange={e => setBranchOutletId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select an Outlet</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.outlet_type})</option>)}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => exportShiftsCSV(branchShifts, `branch_shifts_${branchOutletId}`)}
                  disabled={!branchOutletId}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  CSV
                </button>
                <button
                  onClick={() => {
                    const outletName = outlets.find(o => o.id === branchOutletId)?.name || 'Branch';
                    exportShiftsPDF(branchShifts, `${outletName} - Shift Report`);
                  }}
                  disabled={!branchOutletId}
                  className="flex-1 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  PDF
                </button>
              </div>
            </div>
          </div>

          {!branchOutletId ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <p className="text-muted-foreground text-lg">Select an outlet to view branch shifts</p>
            </div>
          ) : (
            <>
              {/* Branch summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard title="Branch Shifts" value={String(branchShifts.length)} borderColor="border-l-blue-500" />
                <StatCard title="Branch Sales" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.total_sales), 0))} borderColor="border-l-green-500" />
                <StatCard title="Branch Expenses" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.total_expenses), 0))} borderColor="border-l-red-500" />
                <StatCard
                  title="Branch Variance"
                  value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.cash_variance), 0))}
                  borderColor="border-l-yellow-500"
                />
              </div>

              {/* Branch payment breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard title="Cash Sales" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.cash_sales), 0))} borderColor="border-l-emerald-500" />
                <StatCard title="M-Pesa Sales" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.mpesa_sales), 0))} borderColor="border-l-lime-500" />
                <StatCard title="Card Sales" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.card_sales), 0))} borderColor="border-l-indigo-500" />
                <StatCard title="Credit Sales" value={formatKES(branchShifts.reduce((s, sh) => s + safeNum(sh.credit_sales), 0))} borderColor="border-l-pink-500" />
              </div>

              {/* Branch shifts table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Shift #</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Employee</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Start</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Duration</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Sales</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">M-Pesa</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Net Cash</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Variance</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedList.length === 0 ? (
                        <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">No shifts found for this outlet</td></tr>
                      ) : paginatedList.map(shift => (
                        <tr key={shift.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{shift.shift_number}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{shift.employee_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{shift.shift_type}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(shift.start_time)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {shift.end_time ? formatDuration(shift.start_time, shift.end_time) : <span className="text-green-600 font-medium">Active</span>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-medium">{formatKES(shift.total_sales)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.cash_sales)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.mpesa_sales)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatKES(shift.net_cash)}</td>
                          <td className={`px-4 py-3 text-right whitespace-nowrap font-medium ${getVarianceColor(shift.cash_variance)}`}>
                            {shift.cash_variance > 0 ? '+' : ''}{formatKES(shift.cash_variance)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shift.status)}`}>{shift.status}</span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setShowDetail(shift)}
                              className="px-2 py-1 text-xs bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for branch tab */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages} ({branchShifts.length} total)
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-secondary transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-border rounded-lg disabled:opacity-50 hover:bg-secondary transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Shift Detail                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Shift Details" size="3xl">
        {showDetail && (
          <div className="max-h-[70vh] overflow-y-auto space-y-6">
            {/* Shift info header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Shift Number</p>
                <p className="font-mono font-semibold text-foreground">{showDetail.shift_number}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(showDetail.status)}`}>
                  {showDetail.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Employee</p>
                <p className="text-foreground">{showDetail.employee_name} <span className="text-xs text-muted-foreground">({showDetail.employee_role})</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outlet</p>
                <p className="text-foreground">{showDetail.outlet_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shift Type</p>
                <p className="text-foreground">{showDetail.shift_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-foreground">
                  {showDetail.end_time ? formatDuration(showDetail.start_time, showDetail.end_time) : 'In Progress'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Time</p>
                <p className="text-foreground">{formatDateTime(showDetail.start_time)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End Time</p>
                <p className="text-foreground">{showDetail.end_time ? formatDateTime(showDetail.end_time) : '---'}</p>
              </div>
            </div>

            {/* Financial summary */}
            <div className="bg-secondary/30 rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3">Sales Breakdown</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="text-lg font-bold text-foreground">{formatKES(showDetail.total_sales)}</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Cash</p>
                  <p className="text-lg font-bold text-green-700">{formatKES(showDetail.cash_sales)}</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">M-Pesa</p>
                  <p className="text-lg font-bold text-lime-700">{formatKES(showDetail.mpesa_sales)}</p>
                </div>
                <div className="bg-card rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Card</p>
                  <p className="text-lg font-bold text-blue-700">{formatKES(showDetail.card_sales)}</p>
                </div>
              </div>
              {showDetail.credit_sales > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Credit Sales: {formatKES(showDetail.credit_sales)}
                </div>
              )}
            </div>

            {/* Cash reconciliation */}
            <div className="bg-secondary/30 rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3">Cash Reconciliation</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="font-semibold text-foreground">{formatKES(showDetail.opening_balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Closing Balance</p>
                  <p className="font-semibold text-foreground">{showDetail.closing_balance ? formatKES(showDetail.closing_balance) : '---'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
                  <p className="font-semibold text-red-600">{formatKES(showDetail.total_expenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Cash (Cash Sales - Expenses)</p>
                  <p className="font-semibold text-foreground">{formatKES(showDetail.net_cash)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Cash</p>
                  <p className="font-semibold text-foreground">{formatKES(showDetail.opening_balance + showDetail.cash_sales - showDetail.total_expenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cash Variance</p>
                  <p className={`font-bold ${getVarianceColor(showDetail.cash_variance)}`}>
                    {showDetail.cash_variance > 0 ? '+' : ''}{formatKES(showDetail.cash_variance)}
                    {Math.abs(showDetail.cash_variance) > 50 && <span className="ml-1 text-xs font-normal text-red-600">(Alert)</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Shift expenses */}
            {(() => {
              const thisExpenses = shiftExpenses.filter(e => e.shift_id === showDetail.id);
              if (thisExpenses.length === 0) return null;
              return (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Shift Expenses ({thisExpenses.length})</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/50">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {thisExpenses.map(exp => (
                          <tr key={exp.id}>
                            <td className="px-3 py-2">{exp.description}</td>
                            <td className="px-3 py-2">{exp.category}</td>
                            <td className="px-3 py-2 text-right font-medium text-red-600">{formatKES(exp.amount)}</td>
                            <td className="px-3 py-2">{formatDateTime(exp.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Additional info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total Transactions</p>
                <p className="text-foreground">{showDetail.total_transactions}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Closed By</p>
                <p className="text-foreground">{showDetail.closed_by || '---'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Approved By</p>
                <p className="text-foreground">{showDetail.approved_by || '---'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Approved At</p>
                <p className="text-foreground">{showDetail.approved_at ? formatDateTime(showDetail.approved_at) : '---'}</p>
              </div>
              {showDetail.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-foreground bg-secondary/30 rounded-lg p-2 mt-1">{showDetail.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Close Shift                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!showCloseModal} onClose={() => setShowCloseModal(null)} title="Close Shift" size="lg">
        {showCloseModal && (() => {
          const expectedCash = showCloseModal.opening_balance + showCloseModal.cash_sales - showCloseModal.total_expenses;
          const variance = closingBalance - expectedCash;
          return (
            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Shift</p>
                    <p className="font-semibold">{showCloseModal.shift_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee</p>
                    <p className="font-semibold">{showCloseModal.employee_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opening Balance</p>
                    <p className="font-semibold">{formatKES(showCloseModal.opening_balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cash Sales</p>
                    <p className="font-semibold">{formatKES(showCloseModal.cash_sales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Expenses</p>
                    <p className="font-semibold text-red-600">{formatKES(showCloseModal.total_expenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Cash in Drawer</p>
                    <p className="font-bold text-foreground">{formatKES(expectedCash)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Closing Balance (Actual Cash Count)</label>
                <input
                  type="number"
                  value={closingBalance || ''}
                  onChange={e => setClosingBalance(Number(e.target.value))}
                  placeholder="Enter actual cash counted..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {closingBalance > 0 && (
                <div className={`p-3 rounded-lg ${Math.abs(variance) <= 50 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-sm font-medium">
                    Variance: <span className={getVarianceColor(variance)}>
                      {variance > 0 ? '+' : ''}{formatKES(variance)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.abs(variance) <= 50 ? 'Within acceptable range' : variance > 0 ? 'Cash over - verify source' : 'Cash short - investigate discrepancy'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Closing Notes</label>
                <textarea
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  rows={3}
                  placeholder="Any notes about this shift..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCloseModal(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseShift}
                  disabled={closingBalance <= 0}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Close Shift
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Add Expense                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!showExpenseModal} onClose={() => setShowExpenseModal(null)} title="Add Shift Expense" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <input
              type="text"
              value={expenseForm.description}
              onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Expense description..."
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Amount (KES)</label>
            <input
              type="number"
              value={expenseForm.amount || ''}
              onChange={e => setExpenseForm(f => ({ ...f, amount: Number(e.target.value) }))}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              value={expenseForm.category}
              onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowExpenseModal(null)}
              className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExpense}
              disabled={!expenseForm.description || expenseForm.amount <= 0}
              className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Add Expense
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
