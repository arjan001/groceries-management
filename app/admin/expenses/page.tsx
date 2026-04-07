'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Search,
  Plus,
  Download,
  Filter,
  X,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  Tag,
  CreditCard,
  FileText,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Receipt,
  Layers,
  Palette,
  ToggleLeft,
  ToggleRight,
  Hash,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  category_id: string | null;
  category_name: string;
  expense_date: string;
  payment_method: string;
  receipt_number: string;
  approved_by: string;
  status: string;
  notes: string;
  created_by: string;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ['Cash', 'M-Pesa', 'Bank Transfer', 'Card', 'Petty Cash'];
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];
const ITEMS_PER_PAGE = 15;

const emptyExpense = {
  title: '',
  description: '',
  amount: 0,
  category_id: '' as string | null,
  category_name: '',
  expense_date: new Date().toISOString().split('T')[0],
  payment_method: 'Cash',
  receipt_number: '',
  approved_by: '',
  status: 'Pending',
  notes: '',
  created_by: '',
};

const emptyCategoryForm = {
  name: '',
  description: '',
  color: '#6b7280',
  is_active: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '---';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    case 'Pending':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ExpensesPage() {
  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  // Expense modal states
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState<Expense | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);

  // Category modal states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name', { ascending: true });
    if (data) {
      setCategories(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name || '') as string,
          description: (r.description || '') as string,
          color: (r.color || '#6b7280') as string,
          is_active: r.is_active !== false,
          created_at: (r.created_at || '') as string,
        }))
      );
    } else {
      setCategories([]);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setExpenses(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          title: (r.title || '') as string,
          description: (r.description || '') as string,
          amount: (r.amount || 0) as number,
          category_id: (r.category_id || null) as string | null,
          category_name: (r.category_name || '') as string,
          expense_date: (r.expense_date || '') as string,
          payment_method: (r.payment_method || 'Cash') as string,
          receipt_number: (r.receipt_number || '') as string,
          approved_by: (r.approved_by || '') as string,
          status: (r.status || 'Pending') as string,
          notes: (r.notes || '') as string,
          created_by: (r.created_by || '') as string,
          created_at: (r.created_at || '') as string,
        }))
      );
    } else {
      setExpenses([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchExpenses();
  }, [fetchCategories, fetchExpenses]);

  // ─── Filtering & Pagination ──────────────────────────────────────────────

  const filteredExpenses = useMemo(() => {
    let result = expenses;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.receipt_number.toLowerCase().includes(q)
      );
    }

    if (filterCategory !== 'All') {
      result = result.filter((e) => e.category_name === filterCategory);
    }

    if (filterStatus !== 'All') {
      result = result.filter((e) => e.status === filterStatus);
    }

    if (filterPaymentMethod !== 'All') {
      result = result.filter((e) => e.payment_method === filterPaymentMethod);
    }

    if (dateFrom) {
      result = result.filter((e) => e.expense_date >= dateFrom);
    }

    if (dateTo) {
      result = result.filter((e) => e.expense_date <= dateTo);
    }

    return result;
  }, [expenses, searchQuery, filterCategory, filterStatus, filterPaymentMethod, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const paginatedExpenses = filteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterStatus, filterPaymentMethod, dateFrom, dateTo]);

  // ─── Stats ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const safeAmount = (val: unknown): number => { const n = Number(val); return Number.isFinite(n) ? n : 0; };
    const totalExpenses = expenses.reduce((sum, e) => sum + safeAmount(e.amount), 0);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const thisMonthExpenses = expenses
      .filter((e) => e.expense_date >= thisMonthStart && e.expense_date <= thisMonthEnd)
      .reduce((sum, e) => sum + safeAmount(e.amount), 0);

    const pendingCount = expenses.filter((e) => e.status === 'Pending').length;

    const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;

    return { totalExpenses, thisMonthExpenses, pendingCount, avgExpense };
  }, [expenses]);

  // ─── Category Helpers ────────────────────────────────────────────────────

  const getCategoryById = (id: string | null): ExpenseCategory | undefined => {
    if (!id) return undefined;
    return categories.find((c) => c.id === id);
  };

  const getCategoryColor = (categoryId: string | null, categoryName: string): string => {
    const cat = getCategoryById(categoryId);
    if (cat) return cat.color;
    const catByName = categories.find((c) => c.name === categoryName);
    return catByName?.color || '#6b7280';
  };

  const getExpensesCountForCategory = (categoryId: string): number => {
    return expenses.filter((e) => e.category_id === categoryId).length;
  };

  // ─── Expense CRUD ────────────────────────────────────────────────────────

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedCategory = categories.find((c) => c.id === expenseForm.category_id);
    const row = {
      title: expenseForm.title,
      description: expenseForm.description,
      amount: expenseForm.amount,
      category_id: expenseForm.category_id || null,
      category_name: selectedCategory?.name || expenseForm.category_name,
      expense_date: expenseForm.expense_date || null,
      payment_method: expenseForm.payment_method,
      receipt_number: expenseForm.receipt_number,
      approved_by: expenseForm.approved_by,
      status: expenseForm.status,
      notes: expenseForm.notes,
      created_by: expenseForm.created_by,
    };

    try {
      if (editingExpenseId) {
        await supabase.from('expenses').update(row).eq('id', editingExpenseId);
        logAudit({
          action: 'UPDATE',
          module: 'Expenses',
          record_id: editingExpenseId,
          details: { title: row.title, amount: row.amount, category: row.category_name, payment_method: row.payment_method },
        });
      } else {
        const { data: inserted } = await supabase.from('expenses').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Expenses',
          record_id: inserted?.id || undefined,
          details: { title: row.title, amount: row.amount, category: row.category_name, payment_method: row.payment_method, status: row.status },
        });
      }
      await fetchExpenses();
    } catch {
      /* handled by supabase logging */
    }

    setEditingExpenseId(null);
    setExpenseForm(emptyExpense);
    setShowExpenseForm(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setExpenseForm({
      title: expense.title,
      description: expense.description,
      amount: expense.amount,
      category_id: expense.category_id,
      category_name: expense.category_name,
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      receipt_number: expense.receipt_number,
      approved_by: expense.approved_by,
      status: expense.status,
      notes: expense.notes,
      created_by: expense.created_by,
    });
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Delete this expense? This action cannot be undone.')) {
      const expense = expenses.find((e) => e.id === id);
      try {
        await supabase.from('expenses').delete().eq('id', id);
        logAudit({
          action: 'DELETE',
          module: 'Expenses',
          record_id: id,
          details: { title: expense?.title, amount: expense?.amount, category: expense?.category_name },
        });
        setExpenses(expenses.filter((e) => e.id !== id));
      } catch {
        /* handled by supabase logging */
      }
    }
  };

  const handleApproveReject = async (expense: Expense, newStatus: 'Approved' | 'Rejected') => {
    try {
      await supabase
        .from('expenses')
        .update({ status: newStatus, approved_by: newStatus === 'Approved' ? 'Admin' : '' })
        .eq('id', expense.id);
      logAudit({
        action: newStatus === 'Approved' ? 'APPROVE' : 'REJECT',
        module: 'Expenses',
        record_id: expense.id,
        details: { title: expense.title, amount: expense.amount, previous_status: expense.status, new_status: newStatus },
      });
      await fetchExpenses();
    } catch {
      /* handled by supabase logging */
    }
  };

  // ─── Category CRUD ───────────────────────────────────────────────────────

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      name: categoryForm.name,
      description: categoryForm.description,
      color: categoryForm.color,
      is_active: categoryForm.is_active,
    };

    try {
      if (editingCategoryId) {
        await supabase.from('expense_categories').update(row).eq('id', editingCategoryId);
        logAudit({
          action: 'UPDATE',
          module: 'Expense Categories',
          record_id: editingCategoryId,
          details: { name: row.name, is_active: row.is_active },
        });
      } else {
        const { data: inserted } = await supabase.from('expense_categories').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Expense Categories',
          record_id: inserted?.id || undefined,
          details: { name: row.name, color: row.color },
        });
      }
      await fetchCategories();
      await fetchExpenses();
    } catch {
      /* handled by supabase logging */
    }

    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryForm(false);
  };

  const handleEditCategory = (cat: ExpenseCategory) => {
    setCategoryForm({
      name: cat.name,
      description: cat.description,
      color: cat.color,
      is_active: cat.is_active,
    });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Delete this category? Expenses linked to it will have their category unlinked.')) {
      const cat = categories.find((c) => c.id === id);
      try {
        await supabase.from('expense_categories').delete().eq('id', id);
        logAudit({
          action: 'DELETE',
          module: 'Expense Categories',
          record_id: id,
          details: { name: cat?.name },
        });
        setCategories(categories.filter((c) => c.id !== id));
        await fetchExpenses();
      } catch {
        /* handled by supabase logging */
      }
    }
  };

  // ─── CSV Download ────────────────────────────────────────────────────────

  const handleDownloadCSV = () => {
    const headers = [
      'Date',
      'Title',
      'Description',
      'Category',
      'Amount (KES)',
      'Payment Method',
      'Status',
      'Receipt #',
      'Approved By',
      'Notes',
      'Created By',
    ];
    const rows = filteredExpenses.map((e) => [
      formatDate(e.expense_date),
      e.title,
      e.description,
      e.category_name,
      String(e.amount),
      e.payment_method,
      e.status,
      e.receipt_number,
      e.approved_by,
      e.notes,
      e.created_by,
    ]);
    exportCSV('expense_report', headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Expenses',
      details: { format: 'CSV', record_count: filteredExpenses.length },
    });
  };

  // ─── Clear Filters ───────────────────────────────────────────────────────

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('All');
    setFilterStatus('All');
    setFilterPaymentMethod('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchQuery || filterCategory !== 'All' || filterStatus !== 'All' || filterPaymentMethod !== 'All' || dateFrom || dateTo;

  // ─── Styling helpers ─────────────────────────────────────────────────────

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground';
  const selectClass =
    'px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground text-sm';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Receipt className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Expense Management</h1>
            <p className="text-muted-foreground text-sm">Track, categorize, and approve bakery expenses</p>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatKES(stats.totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">{expenses.length} records</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">This Month</p>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatKES(stats.thisMonthExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-1">Current month total</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Pending Approval</p>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Average Expense</p>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold text-green-600">{formatKES(stats.avgExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'expenses'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expenses
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Categories
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ══  EXPENSES TAB  ═══════════════════════════════════════════════════= */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <>
          {/* ── Filter Bar ── */}
          <div className="border border-border rounded-lg p-4 bg-card mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Filters</span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* Search */}
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search title, description, receipt #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Categories</option>
                {categories
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Payment Method Filter */}
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className={selectClass}
              >
                <option value="All">All Payment Methods</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Placeholder for alignment */}
              <div className="hidden xl:block" />
            </div>

            {/* Date Range Row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground font-medium">Date Range:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground text-sm"
                placeholder="From"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground text-sm"
                placeholder="To"
              />
            </div>
          </div>

          {/* ── Action Bar ── */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <p className="text-sm text-muted-foreground">
              Showing <strong>{filteredExpenses.length}</strong> of <strong>{expenses.length}</strong> expenses
              {hasActiveFilters && (
                <span className="ml-1 text-primary">(filtered)</span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Report
              </button>
              <button
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseForm(emptyExpense);
                  setShowExpenseForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Expense
              </button>
            </div>
          </div>

          {/* ── Expenses Table ── */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Loading expenses...</span>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto shadow-sm bg-card">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Category</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Payment</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Receipt #</th>
                    <th className="px-4 py-3 text-center font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <AlertCircle className="w-8 h-8" />
                          <p className="text-sm font-medium">No expenses found</p>
                          <p className="text-xs">
                            {hasActiveFilters
                              ? 'Try adjusting your filters'
                              : 'Click "Add Expense" to record your first expense'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((expense) => {
                      const catColor = getCategoryColor(expense.category_id, expense.category_name);
                      return (
                        <tr
                          key={expense.id}
                          className="border-b border-border hover:bg-secondary/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(expense.expense_date)}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <div>
                              <p>{expense.title}</p>
                              {expense.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                  {expense.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {expense.category_name ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `${catColor}18`,
                                  color: catColor,
                                  border: `1px solid ${catColor}30`,
                                }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: catColor }}
                                />
                                {expense.category_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">---</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                            {formatKES(Number(expense.amount))}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard className="w-3 h-3" />
                              {expense.payment_method}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(expense.status)}`}
                            >
                              {expense.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                              {expense.status === 'Rejected' && <XCircle className="w-3 h-3" />}
                              {expense.status === 'Pending' && <Clock className="w-3 h-3" />}
                              {expense.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {expense.receipt_number || '---'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setShowExpenseDetail(expense)}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditExpense(expense)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {expense.status === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleApproveReject(expense, 'Approved')}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleApproveReject(expense, 'Rejected')}
                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                    title="Reject"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ── */}
          {filteredExpenses.length > ITEMS_PER_PAGE && (
            <div className="flex flex-wrap items-center justify-between mt-4 gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)} of{' '}
                {filteredExpenses.length} expenses
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => (
                    <span key={page} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-1 text-muted-foreground text-sm">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border hover:bg-secondary'
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Add / Edit Expense Modal ── */}
          <Modal
            isOpen={showExpenseForm}
            onClose={() => {
              setShowExpenseForm(false);
              setEditingExpenseId(null);
              setExpenseForm(emptyExpense);
            }}
            title={editingExpenseId ? 'Edit Expense' : 'Add New Expense'}
            size="2xl"
          >
            <form onSubmit={handleExpenseSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
              {/* Basic Info */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Basic Information</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Title *</label>
                    <input
                      type="text"
                      value={expenseForm.title}
                      onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Flour Purchase - January Batch"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Description</label>
                    <textarea
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className={inputClass}
                      rows={2}
                      placeholder="Brief description of the expense..."
                    />
                  </div>
                </div>
              </div>

              {/* Financial */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Financial Details</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Amount (KES) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={expenseForm.amount || ''}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })
                      }
                      className={inputClass}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Category</label>
                    <select
                      value={expenseForm.category_id || ''}
                      onChange={(e) => {
                        const catId = e.target.value;
                        const cat = categories.find((c) => c.id === catId);
                        setExpenseForm({
                          ...expenseForm,
                          category_id: catId || null,
                          category_name: cat?.name || '',
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="">Select Category</option>
                      {categories
                        .filter((c) => c.is_active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Payment Method</label>
                    <select
                      value={expenseForm.payment_method}
                      onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                      className={inputClass}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Expense Date</label>
                    <input
                      type="date"
                      value={expenseForm.expense_date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Additional Details</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Receipt Number</label>
                    <input
                      type="text"
                      value={expenseForm.receipt_number}
                      onChange={(e) => setExpenseForm({ ...expenseForm, receipt_number: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. RCP-2024-001"
                    />
                  </div>
                  {editingExpenseId && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Status</label>
                      <select
                        value={expenseForm.status}
                        onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value })}
                        className={inputClass}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={editingExpenseId ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                    <textarea
                      value={expenseForm.notes}
                      onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                      className={inputClass}
                      rows={2}
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseForm(false);
                    setEditingExpenseId(null);
                    setExpenseForm(emptyExpense);
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium transition-colors"
                >
                  {editingExpenseId ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </Modal>

          {/* ── Expense Detail Modal ── */}
          <Modal
            isOpen={!!showExpenseDetail}
            onClose={() => setShowExpenseDetail(null)}
            title="Expense Details"
            size="lg"
          >
            {showExpenseDetail && (() => {
              const expense = showExpenseDetail;
              const catColor = getCategoryColor(expense.category_id, expense.category_name);
              return (
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                  {/* Title & Amount Banner */}
                  <div className="border border-border rounded-lg p-5 bg-secondary/30">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{expense.title}</h3>
                        {expense.description && (
                          <p className="text-sm text-muted-foreground mt-1">{expense.description}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(expense.status)}`}
                      >
                        {expense.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                        {expense.status === 'Rejected' && <XCircle className="w-3 h-3" />}
                        {expense.status === 'Pending' && <Clock className="w-3 h-3" />}
                        {expense.status}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">{formatKES(Number(expense.amount))}</p>
                  </div>

                  {/* Detail Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Expense Date</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatDate(expense.expense_date)}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Category</span>
                      </div>
                      {expense.category_name ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${catColor}18`,
                            color: catColor,
                            border: `1px solid ${catColor}30`,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: catColor }}
                          />
                          {expense.category_name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">---</span>
                      )}
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Payment Method</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{expense.payment_method}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Receipt Number</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {expense.receipt_number || '---'}
                      </p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(expense.approved_by || expense.notes || expense.created_by) && (
                    <div className="border border-border rounded-lg p-4 bg-card">
                      <p className="text-sm font-semibold text-foreground mb-3">Additional Information</p>
                      <div className="space-y-2 text-sm">
                        {expense.approved_by && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Approved By:</span>
                            <span className="font-medium text-foreground">{expense.approved_by}</span>
                          </div>
                        )}
                        {expense.created_by && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Created By:</span>
                            <span className="font-medium text-foreground">{expense.created_by}</span>
                          </div>
                        )}
                        {expense.notes && (
                          <div>
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="mt-1 text-foreground bg-secondary/50 p-2 rounded">{expense.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detail Actions */}
                  <div className="flex gap-2 justify-end pt-4 border-t border-border">
                    {expense.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => {
                            handleApproveReject(expense, 'Rejected');
                            setShowExpenseDetail(null);
                          }}
                          className="flex items-center gap-1 px-4 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 font-medium transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            handleApproveReject(expense, 'Approved');
                            setShowExpenseDetail(null);
                          }}
                          className="flex items-center gap-1 px-4 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-medium transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        handleEditExpense(expense);
                        setShowExpenseDetail(null);
                      }}
                      className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setShowExpenseDetail(null)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ══  CATEGORIES TAB  ════════════════════════════════════════════════== */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'categories' && (
        <>
          {/* ── Category Action Bar ── */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">
                <strong>{categories.length}</strong> expense categories configured
              </p>
            </div>
            <button
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryForm(emptyCategoryForm);
                setShowCategoryForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          {/* ── Categories Table ── */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Color</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Description</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Expenses</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Layers className="w-8 h-8" />
                        <p className="text-sm font-medium">No categories yet</p>
                        <p className="text-xs">Click &ldquo;Add Category&rdquo; to create your first expense category</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const expCount = getExpensesCountForCategory(cat.id);
                    return (
                      <tr
                        key={cat.id}
                        className="border-b border-border hover:bg-secondary/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-8 h-8 rounded-lg border border-border"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-xs text-muted-foreground font-mono">{cat.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: `${cat.color}18`,
                              color: cat.color,
                              border: `1px solid ${cat.color}30`,
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-sm">
                          {cat.description || '---'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {expCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {cat.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <ToggleRight className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              <ToggleLeft className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Category Summary Cards ── */}
          {categories.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground mb-3">Category Breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {categories.map((cat) => {
                  const catExpenses = expenses.filter((e) => e.category_id === cat.id);
                  const totalAmount = catExpenses.reduce((sum, e) => { const n = Number(e.amount); return sum + (Number.isFinite(n) ? n : 0); }, 0);
                  const pendingCount = catExpenses.filter((e) => e.status === 'Pending').length;
                  return (
                    <div
                      key={cat.id}
                      className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground text-sm truncate">{cat.name}</h4>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                          )}
                        </div>
                        {!cat.is_active && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-secondary/50 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Expenses</p>
                          <p className="text-sm font-bold text-foreground">{catExpenses.length}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-sm font-bold text-foreground">
                            {formatKES(totalAmount)}
                          </p>
                        </div>
                      </div>
                      {pendingCount > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 rounded-lg px-2 py-1">
                          <Clock className="w-3 h-3" />
                          {pendingCount} pending approval
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Add / Edit Category Modal ── */}
          <Modal
            isOpen={showCategoryForm}
            onClose={() => {
              setShowCategoryForm(false);
              setEditingCategoryId(null);
              setCategoryForm(emptyCategoryForm);
            }}
            title={editingCategoryId ? 'Edit Category' : 'Add Expense Category'}
            size="md"
          >
            <form onSubmit={handleCategorySubmit} className="space-y-5">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Ingredients, Utilities, Equipment"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className={inputClass}
                  rows={3}
                  placeholder="Brief description of what this category covers..."
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-2">Color</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-28 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-foreground text-sm font-mono"
                    placeholder="#6b7280"
                  />
                  <span
                    className="w-10 h-10 rounded-lg border border-border"
                    style={{ backgroundColor: categoryForm.color }}
                  />
                </div>
                {/* Quick color picks */}
                <div className="flex gap-2 mt-2">
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#0d9488', '#a855f7'].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoryForm({ ...categoryForm, color })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                          categoryForm.color === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground">Status:</label>
                <button
                  type="button"
                  onClick={() =>
                    setCategoryForm({ ...categoryForm, is_active: !categoryForm.is_active })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    categoryForm.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      categoryForm.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-sm font-medium ${categoryForm.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {categoryForm.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-lg p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-2">Preview</p>
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${categoryForm.color}18`,
                    color: categoryForm.color,
                    border: `1px solid ${categoryForm.color}30`,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: categoryForm.color }}
                  />
                  {categoryForm.name || 'Category Name'}
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategoryId(null);
                    setCategoryForm(emptyCategoryForm);
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium transition-colors"
                >
                  {editingCategoryId ? 'Update Category' : 'Add Category'}
                </button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </div>
  );
}
