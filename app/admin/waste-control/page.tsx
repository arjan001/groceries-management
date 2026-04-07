'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { FileDown } from 'lucide-react';

interface WasteRecord {
  id: string;
  date: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: string;
  category: string;
  cost: number;
  batchNumber: string;
  notes: string;
  reportedBy: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  approvedBy: string;
  approvalDate: string;
  approvalNotes: string;
}

type ApprovalStatus = 'All' | 'Pending' | 'Approved' | 'Rejected';

const WASTE_REASONS = [
  'Quality defect',
  'Packaging damage',
  'Expiration',
  'Production error',
  'Damaged in transit',
  'Customer return',
  'Testing',
  'Spillage',
  'Contamination',
  'Overproduction',
];

const WASTE_CATEGORIES = [
  'Raw Materials',
  'Finished Goods',
  'Packaging',
  'In-Process',
  'Returns',
  'Equipment Related',
];

const UNITS = ['units', 'kg', 'g', 'liters', 'ml', 'boxes', 'trays', 'packs', 'dozens'];

const ITEMS_PER_PAGE = 10;

export default function WasteControlPage() {
  const [records, setRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<WasteRecord | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus>('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterReason, setFilterReason] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Approval form
  const [approvalAction, setApprovalAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedByName, setApprovedByName] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    productCode: '',
    productName: '',
    quantity: 0,
    unit: 'units',
    reason: WASTE_REASONS[0],
    category: WASTE_CATEGORIES[0],
    cost: 0,
    batchNumber: '',
    notes: '',
    reportedBy: '',
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('waste_records')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setRecords(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          date: (r.date || '') as string,
          productCode: (r.product_code || '') as string,
          productName: (r.product_name || '') as string,
          quantity: (r.quantity || 0) as number,
          unit: (r.unit || 'units') as string,
          reason: (r.reason || '') as string,
          category: (r.category || 'Raw Materials') as string,
          cost: (r.cost || 0) as number,
          batchNumber: (r.batch_number || '') as string,
          notes: (r.notes || '') as string,
          reportedBy: (r.reported_by || '') as string,
          approvalStatus: (r.approval_status || r.status || 'Pending') as WasteRecord['approvalStatus'],
          approvedBy: (r.approved_by || '') as string,
          approvalDate: (r.approval_date || '') as string,
          approvalNotes: (r.approval_notes || '') as string,
        }))
      );
    } else {
      setRecords([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filtered and searched records
  const filteredRecords = useMemo(() => {
    let result = records;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.batchNumber.toLowerCase().includes(q) ||
          r.reportedBy.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== 'All') {
      result = result.filter((r) => r.approvalStatus === filterStatus);
    }

    // Category filter
    if (filterCategory !== 'All') {
      result = result.filter((r) => r.category === filterCategory);
    }

    // Reason filter
    if (filterReason !== 'All') {
      result = result.filter((r) => r.reason === filterReason);
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((r) => r.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((r) => r.date <= dateTo);
    }

    return result;
  }, [records, searchQuery, filterStatus, filterCategory, filterReason, dateFrom, dateTo]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterCategory, filterReason, dateFrom, dateTo]);

  // Stats calculations
  const totalWasteCost = records.reduce((sum, r) => sum + r.cost, 0);
  const pendingCount = records.filter((r) => r.approvalStatus === 'Pending').length;
  const pendingCost = records
    .filter((r) => r.approvalStatus === 'Pending')
    .reduce((sum, r) => sum + r.cost, 0);
  const approvedCount = records.filter((r) => r.approvalStatus === 'Approved').length;
  const approvedCost = records
    .filter((r) => r.approvalStatus === 'Approved')
    .reduce((sum, r) => sum + r.cost, 0);
  const rejectedCount = records.filter((r) => r.approvalStatus === 'Rejected').length;
  const rejectedCost = records
    .filter((r) => r.approvalStatus === 'Rejected')
    .reduce((sum, r) => sum + r.cost, 0);

  // Waste by category for impact tracking
  const wasteByCategory = useMemo(() => {
    return WASTE_CATEGORIES.map((cat) => {
      const catRecords = records.filter((r) => r.category === cat && r.approvalStatus === 'Approved');
      return {
        category: cat,
        count: catRecords.length,
        cost: catRecords.reduce((sum, r) => sum + r.cost, 0),
        quantity: catRecords.reduce((sum, r) => sum + r.quantity, 0),
      };
    }).filter((c) => c.count > 0);
  }, [records]);

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      productCode: '',
      productName: '',
      quantity: 0,
      unit: 'units',
      reason: WASTE_REASONS[0],
      category: WASTE_CATEGORIES[0],
      cost: 0,
      batchNumber: '',
      notes: '',
      reportedBy: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      date: formData.date || null,
      product_code: formData.productCode,
      product_name: formData.productName,
      quantity: formData.quantity,
      unit: formData.unit,
      reason: formData.reason,
      category: formData.category,
      cost: formData.cost,
      batch_number: formData.batchNumber,
      notes: formData.notes,
      reported_by: formData.reportedBy,
      approval_status: 'Pending',
    };
    try {
      if (editId) {
        // When editing, keep the current approval status unless it was rejected
        const existing = records.find((r) => r.id === editId);
        const updateRow = {
          ...row,
          approval_status: existing?.approvalStatus === 'Rejected' ? 'Pending' : existing?.approvalStatus || 'Pending',
        };
        await supabase.from('waste_records').update(updateRow).eq('id', editId);
        logAudit({
          action: 'UPDATE',
          module: 'Waste Control',
          record_id: editId,
          details: { product_name: formData.productName, product_code: formData.productCode, quantity: formData.quantity, cost: formData.cost, reason: formData.reason },
        });
      } else {
        await supabase.from('waste_records').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Waste Control',
          record_id: '',
          details: { product_name: formData.productName, product_code: formData.productCode, quantity: formData.quantity, cost: formData.cost, reason: formData.reason },
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

  const handleEdit = (record: WasteRecord) => {
    setFormData({
      date: record.date,
      productCode: record.productCode,
      productName: record.productName,
      quantity: record.quantity,
      unit: record.unit,
      reason: record.reason,
      category: record.category,
      cost: record.cost,
      batchNumber: record.batchNumber,
      notes: record.notes,
      reportedBy: record.reportedBy,
    });
    setEditId(record.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this waste record? This action cannot be undone.')) {
      await supabase.from('waste_records').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Waste Control',
        record_id: id,
        details: { entity: 'waste_record' },
      });
      setRecords(records.filter((r) => r.id !== id));
    }
  };

  const openApprovalModal = (record: WasteRecord, action: 'Approved' | 'Rejected') => {
    setSelectedRecord(record);
    setApprovalAction(action);
    setApprovalNotes('');
    setApprovedByName('');
    setShowApprovalModal(true);
  };

  const handleApproval = async () => {
    if (!selectedRecord || !approvedByName.trim()) return;
    const now = new Date().toISOString().split('T')[0];
    try {
      await supabase
        .from('waste_records')
        .update({
          approval_status: approvalAction,
          approved_by: approvedByName,
          approval_date: now,
          approval_notes: approvalNotes,
        })
        .eq('id', selectedRecord.id);
      logAudit({
        action: 'UPDATE',
        module: 'Waste Control',
        record_id: selectedRecord.id,
        details: { approval_status: approvalAction, approved_by: approvedByName, approval_notes: approvalNotes },
      });
      await fetchRecords();
    } catch {
      /* fallback */
    }
    setShowApprovalModal(false);
    setSelectedRecord(null);
  };

  const openDetailModal = (record: WasteRecord) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const getStatusColor = (status: WasteRecord['approvalStatus']) => {
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
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('All');
    setFilterCategory('All');
    setFilterReason('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchQuery || filterStatus !== 'All' || filterCategory !== 'All' || filterReason !== 'All' || dateFrom || dateTo;

  const tableRef = useRef<HTMLDivElement>(null);

  const exportPdf = async () => {
    if (!tableRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Waste-Control-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(tableRef.current).save();
    } catch { /* */ }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Production Waste Control</h1>
        <p className="text-muted-foreground">
          Track, manage, and approve production waste records with impact analysis
        </p>
      </div>

      {/* Waste Impact Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Total Waste Cost</p>
            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
              {records.length} records
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground">KES {totalWasteCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">All-time waste expenditure</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
            <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 font-medium">
              {pendingCount}
            </span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">KES {pendingCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting admin review</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Approved Waste</p>
            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium">
              {approvedCount}
            </span>
          </div>
          <p className="text-3xl font-bold text-green-600">KES {approvedCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Confirmed inventory impact</p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Rejected Waste</p>
            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 font-medium">
              {rejectedCount}
            </span>
          </div>
          <p className="text-3xl font-bold text-red-600">KES {rejectedCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Disputed or invalid entries</p>
        </div>
      </div>

      {/* Waste Impact by Category */}
      {wasteByCategory.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Waste Impact by Category (Approved)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wasteByCategory.map((item) => (
              <div key={item.category} className="border border-border rounded-lg p-4 bg-card">
                <p className="text-sm font-medium text-foreground">{item.category}</p>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-2xl font-bold">KES {item.cost.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.count} records / {item.quantity.toLocaleString()} total units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-500">
                      {totalWasteCost > 0
                        ? ((item.cost / totalWasteCost) * 100).toFixed(1)
                        : '0'}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground">of total</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filters, and Add Button */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[250px] max-w-md">
            <input
              type="text"
              placeholder="Search by product, code, batch, reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditId(null);
              resetForm();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold"
          >
            + Record Waste
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
          >
            <FileDown size={14} /> Export PDF
          </button>
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

          <div className="flex items-center gap-2">
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
              className="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
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

      {/* Add / Edit Waste Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
          resetForm();
        }}
        title={editId ? 'Edit Waste Record' : 'Record Production Waste'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Product Code</label>
              <input
                type="text"
                placeholder="e.g. PRD-001"
                value={formData.productCode}
                onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Product Name</label>
              <input
                type="text"
                placeholder="Product name"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
              <input
                type="number"
                placeholder="0"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
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
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cost (KES)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.cost || ''}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                min="0"
                step="any"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Batch Number</label>
              <input
                type="text"
                placeholder="e.g. B-2024-001"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Waste Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {WASTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {WASTE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reported By</label>
              <input
                type="text"
                placeholder="Reporter name"
                value={formData.reportedBy}
                onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Additional Notes</label>
            <textarea
              placeholder="Describe the waste incident in detail..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-full h-20"
            />
          </div>

          {!editId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                This waste record will be submitted with a <strong>Pending</strong> status and requires admin approval before it impacts inventory and cost tracking.
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

      {/* Approval Modal */}
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
                <span className="text-sm text-muted-foreground">Product:</span>
                <span className="text-sm font-medium">{selectedRecord.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Quantity:</span>
                <span className="text-sm font-medium">
                  {selectedRecord.quantity} {selectedRecord.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cost:</span>
                <span className="text-sm font-bold">KES {selectedRecord.cost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reason:</span>
                <span className="text-sm font-medium">{selectedRecord.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reported By:</span>
                <span className="text-sm font-medium">{selectedRecord.reportedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Batch:</span>
                <span className="text-sm font-medium">{selectedRecord.batchNumber || '-'}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Admin Name (Approver)
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
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
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none h-20"
              />
            </div>

            {approvalAction === 'Approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  Approving this record will confirm <strong>KES {selectedRecord.cost.toLocaleString()}</strong> as a verified waste cost impacting inventory and production budgets.
                </p>
              </div>
            )}

            {approvalAction === 'Rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Rejecting this record means the waste entry will not count toward inventory adjustments or cost tracking.
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

      {/* Detail Modal */}
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
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  selectedRecord.approvalStatus
                )}`}
              >
                {selectedRecord.approvalStatus}
              </span>
              <span className="text-sm text-muted-foreground">
                Recorded on {selectedRecord.date}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Product Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Product Name:</span>
                    <span className="text-sm font-medium">{selectedRecord.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Product Code:</span>
                    <span className="text-sm font-medium">{selectedRecord.productCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Batch Number:</span>
                    <span className="text-sm font-medium">{selectedRecord.batchNumber || '-'}</span>
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
                      {selectedRecord.quantity} {selectedRecord.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Cost:</span>
                    <span className="text-sm font-bold">KES {selectedRecord.cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Reason:</span>
                    <span className="text-sm font-medium">{selectedRecord.reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Reported By:</span>
                    <span className="text-sm font-medium">{selectedRecord.reportedBy}</span>
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

            {selectedRecord.approvalStatus !== 'Pending' && (
              <div
                className={`rounded-lg p-4 ${
                  selectedRecord.approvalStatus === 'Approved'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <h3 className="text-sm font-semibold mb-2">
                  {selectedRecord.approvalStatus === 'Approved' ? 'Approval' : 'Rejection'} Information
                </h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Reviewed by:</span>{' '}
                    <span className="font-medium">{selectedRecord.approvedBy}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Date:</span>{' '}
                    <span className="font-medium">{selectedRecord.approvalDate}</span>
                  </p>
                  {selectedRecord.approvalNotes && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Notes:</span>{' '}
                      <span className="font-medium">{selectedRecord.approvalNotes}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {selectedRecord.approvalStatus === 'Approved' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Inventory Impact</h3>
                <p className="text-sm text-blue-700">
                  This approved waste record of{' '}
                  <strong>
                    {selectedRecord.quantity} {selectedRecord.unit}
                  </strong>{' '}
                  of <strong>{selectedRecord.productName}</strong> has been deducted from inventory, representing a confirmed loss of{' '}
                  <strong>KES {selectedRecord.cost.toLocaleString()}</strong> in production costs.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
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

      {/* Records Table */}
      <div ref={tableRef}>
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Product</th>
              <th className="px-4 py-3 text-left font-semibold">Quantity</th>
              <th className="px-4 py-3 text-left font-semibold">Unit</th>
              <th className="px-4 py-3 text-left font-semibold">Reason</th>
              <th className="px-4 py-3 text-left font-semibold">Cost</th>
              <th className="px-4 py-3 text-left font-semibold">Batch</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Reported By</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  Loading waste records...
                </td>
              </tr>
            ) : paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  {hasActiveFilters
                    ? 'No waste records match the current filters'
                    : 'No waste records found'}
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
                      <p className="font-medium text-foreground">{record.productName}</p>
                      <p className="text-xs text-muted-foreground">{record.productCode}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">{record.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.unit}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{record.reason}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    KES {record.cost.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {record.batchNumber || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        record.approvalStatus
                      )}`}
                    >
                      {record.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{record.reportedBy || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {record.approvalStatus === 'Pending' && (
                        <>
                          <button
                            onClick={() => openApprovalModal(record, 'Approved')}
                            className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openApprovalModal(record, 'Rejected')}
                            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleEdit(record)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
              Previous
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
              Next
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
    </div>
  );
}
