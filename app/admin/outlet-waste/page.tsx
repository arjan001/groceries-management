'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Trash2,
  Plus,
  Search,
  Eye,
  Edit,
  Store,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Calendar,
  AlertTriangle,
  X,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
}

interface OutletWasteRecord {
  id: string;
  outlet_id: string;
  outlet_name: string;
  date: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit: string;
  reason: string;
  category: string;
  cost: number;
  batch_number: string;
  reported_by: string;
  reported_by_id: string;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string;
  approved_at: string;
  approval_notes: string;
  notes: string;
  created_at: string;
}

type ApprovalStatus = 'All' | 'Pending' | 'Approved' | 'Rejected';

// ─── Constants ───────────────────────────────────────────────────────────────

const WASTE_REASONS = [
  'Quality defect',
  'Expiration',
  'Damaged',
  'Customer return',
  'Overproduction',
  'Spillage',
  'Contamination',
];

const WASTE_CATEGORIES = [
  'Finished Goods',
  'Returns',
  'Packaging',
  'Supplies',
];

const UNITS = ['units', 'kg', 'g', 'liters', 'ml', 'boxes', 'trays', 'packs', 'dozens'];

const ITEMS_PER_PAGE = 10;

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getStatusColor(status: OutletWasteRecord['approval_status']): string {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getReasonColor(reason: string): string {
  switch (reason) {
    case 'Expiration':
      return 'bg-red-100 text-red-800';
    case 'Quality defect':
      return 'bg-orange-100 text-orange-800';
    case 'Damaged':
      return 'bg-amber-100 text-amber-800';
    case 'Customer return':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// ─── Default Form Data ──────────────────────────────────────────────────────

const defaultFormData = {
  date: new Date().toISOString().split('T')[0],
  product_name: '',
  product_code: '',
  quantity: 0,
  unit: 'units',
  reason: WASTE_REASONS[0],
  category: WASTE_CATEGORIES[0],
  cost: 0,
  batch_number: '',
  reported_by: '',
  notes: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OutletWastePage() {
  // ─── Core State ─────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [records, setRecords] = useState<OutletWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // ─── Modal States ─────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<OutletWasteRecord | null>(null);

  // ─── Filter States ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus>('All');
  const [filterReason, setFilterReason] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ─── Pagination ───────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Approval Form ────────────────────────────────────────────────────────
  const [approvalAction, setApprovalAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedByName, setApprovedByName] = useState('');

  // ─── Waste Form ───────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({ ...defaultFormData });

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, code, outlet_type, is_main_branch, status')
        .eq('is_main_branch', false)
        .eq('status', 'Active')
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load outlets:', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!selectedOutletId) {
      setRecords([]);
      return;
    }

    setLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from('outlet_waste_records')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load waste records:', error.message);
        setRecords([]);
        return;
      }

      const items = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        outlet_name: (r.outlet_name || '') as string,
        date: (r.date || '') as string,
        product_name: (r.product_name || '') as string,
        product_code: (r.product_code || '') as string,
        quantity: Number(r.quantity) || 0,
        unit: (r.unit || 'units') as string,
        reason: (r.reason || '') as string,
        category: (r.category || 'Finished Goods') as string,
        cost: Number(r.cost) || 0,
        batch_number: (r.batch_number || '') as string,
        reported_by: (r.reported_by || '') as string,
        reported_by_id: (r.reported_by_id || '') as string,
        approval_status: (r.approval_status || 'Pending') as OutletWasteRecord['approval_status'],
        approved_by: (r.approved_by || '') as string,
        approved_at: (r.approved_at || '') as string,
        approval_notes: (r.approval_notes || '') as string,
        notes: (r.notes || '') as string,
        created_at: (r.created_at || '') as string,
      }));

      setRecords(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load waste records:', msg);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedOutletId]);

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
      fetchRecords();
    }
  }, [selectedOutletId, fetchRecords]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getSelectedOutlet = (): Outlet | undefined => {
    return outlets.find((o) => o.id === selectedOutletId);
  };

  // ─── Filtered Records ─────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    let result = records;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.product_name.toLowerCase().includes(q) ||
          r.product_code.toLowerCase().includes(q) ||
          r.batch_number.toLowerCase().includes(q) ||
          r.reported_by.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'All') {
      result = result.filter((r) => r.approval_status === filterStatus);
    }

    if (filterReason !== 'All') {
      result = result.filter((r) => r.reason === filterReason);
    }

    if (filterCategory !== 'All') {
      result = result.filter((r) => r.category === filterCategory);
    }

    if (dateFrom) {
      result = result.filter((r) => r.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((r) => r.date <= dateTo);
    }

    return result;
  }, [records, searchQuery, filterStatus, filterReason, filterCategory, dateFrom, dateTo]);

  // ─── Pagination ───────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterReason, filterCategory, dateFrom, dateTo]);

  // ─── Stats Calculations ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthRecords = records.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalRecords = records.length;
    const pendingCount = records.filter((r) => r.approval_status === 'Pending').length;
    const thisMonthCost = thisMonthRecords.reduce((sum, r) => sum + r.cost, 0);

    // Top waste reason
    const reasonCounts: Record<string, number> = {};
    records.forEach((r) => {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    });
    const topReason =
      Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return { totalRecords, pendingCount, thisMonthCost, topReason };
  }, [records]);

  // ─── Form Handlers ────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({ ...defaultFormData });
  };

  const openAddForm = () => {
    setEditId(null);
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (record: OutletWasteRecord) => {
    if (record.approval_status !== 'Pending') return;
    setFormData({
      date: record.date,
      product_name: record.product_name,
      product_code: record.product_code,
      quantity: record.quantity,
      unit: record.unit,
      reason: record.reason,
      category: record.category,
      cost: record.cost,
      batch_number: record.batch_number,
      reported_by: record.reported_by,
      notes: record.notes,
    });
    setEditId(record.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const outlet = getSelectedOutlet();
    if (!outlet) return;

    const row = {
      outlet_id: selectedOutletId,
      outlet_name: outlet.name,
      date: formData.date || null,
      product_name: formData.product_name,
      product_code: formData.product_code,
      quantity: formData.quantity,
      unit: formData.unit,
      reason: formData.reason,
      category: formData.category,
      cost: formData.cost,
      batch_number: formData.batch_number,
      reported_by: formData.reported_by,
      notes: formData.notes,
      approval_status: 'Pending',
    };

    try {
      if (editId) {
        const existing = records.find((r) => r.id === editId);
        const updateRow = {
          ...row,
          approval_status:
            existing?.approval_status === 'Rejected'
              ? 'Pending'
              : existing?.approval_status || 'Pending',
        };
        await supabase.from('outlet_waste_records').update(updateRow).eq('id', editId);
        logAudit({
          action: 'UPDATE',
          module: 'Outlet Waste Management',
          record_id: editId,
          details: {
            outlet_name: outlet.name,
            product_name: formData.product_name,
            product_code: formData.product_code,
            quantity: formData.quantity,
            cost: formData.cost,
            reason: formData.reason,
          },
        });
      } else {
        await supabase.from('outlet_waste_records').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Outlet Waste Management',
          record_id: '',
          details: {
            outlet_name: outlet.name,
            product_name: formData.product_name,
            product_code: formData.product_code,
            quantity: formData.quantity,
            cost: formData.cost,
            reason: formData.reason,
          },
        });
      }
      await fetchRecords();
    } catch {
      /* fallback */
    }
    setEditId(null);
    resetForm();
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('outlet_waste_records').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Outlet Waste Management',
        record_id: id,
        details: { entity: 'outlet_waste_record' },
      });
      setRecords(records.filter((r) => r.id !== id));
    } catch {
      /* fallback */
    }
    setShowDeleteConfirm(null);
  };

  // ─── Approval Handlers ────────────────────────────────────────────────────

  const openApprovalModal = (record: OutletWasteRecord, action: 'Approved' | 'Rejected') => {
    setSelectedRecord(record);
    setApprovalAction(action);
    setApprovalNotes('');
    setApprovedByName('');
    setShowApprovalModal(true);
  };

  const handleApproval = async () => {
    if (!selectedRecord || !approvedByName.trim()) return;
    const now = new Date().toISOString();
    try {
      await supabase
        .from('outlet_waste_records')
        .update({
          approval_status: approvalAction,
          approved_by: approvedByName,
          approved_at: now,
          approval_notes: approvalNotes,
        })
        .eq('id', selectedRecord.id);
      logAudit({
        action: approvalAction === 'Approved' ? 'APPROVE' : 'REJECT',
        module: 'Outlet Waste Management',
        record_id: selectedRecord.id,
        details: {
          approval_status: approvalAction,
          approved_by: approvedByName,
          approval_notes: approvalNotes,
          outlet_name: selectedRecord.outlet_name,
          product_name: selectedRecord.product_name,
        },
      });
      await fetchRecords();
    } catch {
      /* fallback */
    }
    setShowApprovalModal(false);
    setSelectedRecord(null);
  };

  // ─── Detail Modal ─────────────────────────────────────────────────────────

  const openDetailModal = (record: OutletWasteRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  // ─── Filter Helpers ───────────────────────────────────────────────────────

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('All');
    setFilterReason('All');
    setFilterCategory('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchQuery ||
    filterStatus !== 'All' ||
    filterReason !== 'All' ||
    filterCategory !== 'All' ||
    dateFrom ||
    dateTo;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branch Waste Management</h1>
            <p className="text-muted-foreground text-sm">
              Track, manage, and approve waste records for each branch outlet
            </p>
          </div>
        </div>
        <button
          onClick={openAddForm}
          disabled={!selectedOutletId}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={18} />
          Record Waste
        </button>
      </div>

      {/* Outlet Selector */}
      <div className="mb-6 p-4 border border-border rounded-lg bg-secondary/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-muted-foreground" />
            <label className="text-sm font-semibold text-foreground">Select Outlet:</label>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading outlets...</p>
          ) : (
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm min-w-[250px]"
            >
              {outlets.length === 0 && <option value="">No outlets available</option>}
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} {outlet.code ? `(${outlet.code})` : ''} &mdash; {outlet.outlet_type}
                </option>
              ))}
            </select>
          )}
          {getSelectedOutlet() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  getSelectedOutlet()?.outlet_type === 'coffee_shop'
                    ? 'bg-amber-100 text-amber-800'
                    : getSelectedOutlet()?.outlet_type === 'restaurant'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {getSelectedOutlet()?.outlet_type?.replace('_', ' ')}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                {getSelectedOutlet()?.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Total Waste Records</p>
            <span className="p-1.5 bg-gray-100 rounded">
              <Trash2 size={16} className="text-gray-600" />
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.totalRecords.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">All records for this branch</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
            <span className="p-1.5 bg-yellow-100 rounded">
              <Clock size={16} className="text-yellow-600" />
            </span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{stats.pendingCount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Total Waste Cost</p>
            <span className="p-1.5 bg-red-100 rounded">
              <AlertTriangle size={16} className="text-red-600" />
            </span>
          </div>
          <p className="text-3xl font-bold text-red-600">KES {stats.thisMonthCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Top Waste Reason</p>
            <span className="p-1.5 bg-orange-100 rounded">
              <Filter size={16} className="text-orange-600" />
            </span>
          </div>
          <p className="text-xl font-bold text-foreground truncate">{stats.topReason}</p>
          <p className="text-xs text-muted-foreground mt-1">Most frequent cause</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[250px] max-w-md relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search by product, code, batch, reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ApprovalStatus)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
          >
            <option value="All">All Reasons</option>
            {WASTE_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
          >
            <option value="All">All Categories</option>
            {WASTE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-muted-foreground" />
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredRecords.length} of {records.length} records
          </p>
        )}
      </div>

      {/* Waste Records Table */}
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Product</th>
              <th className="px-4 py-3 text-left font-semibold">Qty</th>
              <th className="px-4 py-3 text-left font-semibold">Unit</th>
              <th className="px-4 py-3 text-left font-semibold">Reason</th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-left font-semibold">Cost</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingRecords ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Loading waste records...
                </td>
              </tr>
            ) : !selectedOutletId ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Please select an outlet to view waste records
                </td>
              </tr>
            ) : paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {hasActiveFilters
                    ? 'No waste records match the current filters'
                    : 'No waste records found for this outlet'}
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-border hover:bg-secondary/50 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {record.date}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetailModal(record)}
                      className="text-left hover:underline"
                    >
                      <p className="font-medium text-foreground">{record.product_name}</p>
                      <p className="text-xs text-muted-foreground">{record.product_code}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{record.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.unit}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(
                        record.reason
                      )}`}
                    >
                      {record.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{record.category}</td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    KES {record.cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        record.approval_status
                      )}`}
                    >
                      {record.approval_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => openDetailModal(record)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-medium"
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      {record.approval_status === 'Pending' && (
                        <>
                          <button
                            onClick={() => openApprovalModal(record, 'Approved')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors font-medium"
                            title="Approve"
                          >
                            <CheckCircle size={14} />
                          </button>
                          <button
                            onClick={() => openApprovalModal(record, 'Rejected')}
                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                          <button
                            onClick={() => handleEdit(record)}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(record.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredRecords.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of{' '}
            {filteredRecords.length} records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 5) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, idx, arr) => {
                  const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                  return (
                    <span key={page} className="flex items-center gap-1">
                      {showEllipsis && (
                        <span className="px-1 text-muted-foreground">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'border border-border hover:bg-secondary'
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  );
                })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* ─── Record Waste Modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
          resetForm();
        }}
        title={editId ? 'Edit Waste Record' : 'Record Branch Waste'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outlet info banner */}
          {getSelectedOutlet() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Store size={16} className="text-blue-600" />
              <p className="text-sm text-blue-800">
                Recording waste for <strong>{getSelectedOutlet()?.name}</strong>
                {getSelectedOutlet()?.code ? ` (${getSelectedOutlet()?.code})` : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Product Code *
              </label>
              <input
                type="text"
                placeholder="e.g. PRD-001"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Product Name *
              </label>
              <input
                type="text"
                placeholder="Product name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Quantity *
              </label>
              <input
                type="number"
                placeholder="0"
                value={formData.quantity || ''}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
                }
                className={inputClass}
                min="0"
                step="any"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={inputClass}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cost (KES) *
              </label>
              <input
                type="number"
                placeholder="0"
                value={formData.cost || ''}
                onChange={(e) =>
                  setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })
                }
                className={inputClass}
                min="0"
                step="any"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Batch Number
              </label>
              <input
                type="text"
                placeholder="e.g. B-2024-001"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Reason *
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className={inputClass}
              >
                {WASTE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={inputClass}
              >
                {WASTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Reported By *
              </label>
              <input
                type="text"
                placeholder="Reporter name"
                value={formData.reported_by}
                onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Additional Notes
            </label>
            <textarea
              placeholder="Describe the waste incident in detail..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={`${inputClass} h-20`}
            />
          </div>

          {!editId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                This waste record will be submitted with a <strong>Pending</strong> status and
                requires admin approval before it impacts cost tracking.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
                resetForm();
              }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold"
            >
              {editId ? 'Update' : 'Submit'} Waste Record
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── View Detail Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedRecord(null);
        }}
        title="Waste Record Details"
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Status and date header */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  selectedRecord.approval_status
                )}`}
              >
                {selectedRecord.approval_status}
              </span>
              <span className="text-sm text-muted-foreground">
                Recorded on {selectedRecord.date}
              </span>
            </div>

            {/* Outlet info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
              <Store size={16} className="text-blue-600" />
              <p className="text-sm text-blue-800">
                Branch: <strong>{selectedRecord.outlet_name}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Product Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Product Name:</span>
                    <span className="text-sm font-medium">{selectedRecord.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Product Code:</span>
                    <span className="text-sm font-medium">{selectedRecord.product_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Batch Number:</span>
                    <span className="text-sm font-medium">
                      {selectedRecord.batch_number || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Category:</span>
                    <span className="text-sm font-medium">{selectedRecord.category}</span>
                  </div>
                </div>
              </div>

              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Waste Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Quantity:</span>
                    <span className="text-sm font-medium">
                      {selectedRecord.quantity.toLocaleString()} {selectedRecord.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Cost:</span>
                    <span className="text-sm font-bold">
                      KES {selectedRecord.cost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Reason:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReasonColor(
                        selectedRecord.reason
                      )}`}
                    >
                      {selectedRecord.reason}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Reported By:</span>
                    <span className="text-sm font-medium">{selectedRecord.reported_by}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedRecord.notes && (
              <div className="bg-secondary rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{selectedRecord.notes}</p>
              </div>
            )}

            {selectedRecord.approval_status !== 'Pending' && (
              <div
                className={`rounded-lg p-4 ${
                  selectedRecord.approval_status === 'Approved'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <h3 className="text-sm font-semibold mb-2">
                  {selectedRecord.approval_status === 'Approved' ? 'Approval' : 'Rejection'}{' '}
                  Information
                </h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Reviewed by:</span>{' '}
                    <span className="font-medium">{selectedRecord.approved_by}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Date:</span>{' '}
                    <span className="font-medium">
                      {selectedRecord.approved_at
                        ? new Date(selectedRecord.approved_at).toLocaleDateString()
                        : '-'}
                    </span>
                  </p>
                  {selectedRecord.approval_notes && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Notes:</span>{' '}
                      <span className="font-medium">{selectedRecord.approval_notes}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {selectedRecord.approval_status === 'Pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      openApprovalModal(selectedRecord, 'Approved');
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      openApprovalModal(selectedRecord, 'Rejected');
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRecord(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Approval Modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedRecord(null);
        }}
        title={`${approvalAction === 'Approved' ? 'Approve' : 'Reject'} Waste Record`}
        size="md"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Branch:</span>
                <span className="text-sm font-medium">{selectedRecord.outlet_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Product:</span>
                <span className="text-sm font-medium">{selectedRecord.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Quantity:</span>
                <span className="text-sm font-medium">
                  {selectedRecord.quantity.toLocaleString()} {selectedRecord.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cost:</span>
                <span className="text-sm font-bold">
                  KES {selectedRecord.cost.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reason:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getReasonColor(
                    selectedRecord.reason
                  )}`}
                >
                  {selectedRecord.reason}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reported By:</span>
                <span className="text-sm font-medium">{selectedRecord.reported_by}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Batch:</span>
                <span className="text-sm font-medium">
                  {selectedRecord.batch_number || '-'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Admin Name (Approver) *
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {approvalAction === 'Approved' ? 'Approval' : 'Rejection'} Notes
              </label>
              <textarea
                placeholder={
                  approvalAction === 'Approved'
                    ? 'Optional approval notes...'
                    : 'Please provide a reason for rejection...'
                }
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className={`${inputClass} h-20`}
              />
            </div>

            {approvalAction === 'Approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Approving this record will confirm{' '}
                  <strong>KES {selectedRecord.cost.toLocaleString()}</strong> as a verified waste
                  cost for <strong>{selectedRecord.outlet_name}</strong>.
                </p>
              </div>
            )}

            {approvalAction === 'Rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Rejecting this record means the waste entry will not count toward cost tracking
                  for <strong>{selectedRecord.outlet_name}</strong>.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedRecord(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproval}
                disabled={!approvedByName.trim()}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  approvalAction === 'Approved'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {approvalAction === 'Approved' ? 'Approve' : 'Reject'} Record
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Delete Confirmation Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirm Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              Are you sure you want to delete this waste record? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
            >
              Delete Record
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
