'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface LotTracking {
  id: string;
  lotNumber: string;
  productCode: string;
  productName: string;
  batchDate: string;
  quantity: number;
  unit: string;
  expirationDate: string;
  location: string;
  status: 'active' | 'expired' | 'recalled' | 'quality-hold';
  supplier: string;
  batchNotes: string;
  receivedFrom: string;
  qualityCheckDate: string;
  qualityCheckBy: string;
  temperatureLog: string;
}

type TabKey = 'overview' | 'active' | 'expired-recalled' | 'all';

const ITEMS_PER_PAGE = 10;

const emptyForm = {
  lotNumber: '',
  productCode: '',
  productName: '',
  batchDate: '',
  quantity: '',
  unit: 'units',
  expirationDate: '',
  location: '',
  status: 'active' as LotTracking['status'],
  supplier: '',
  batchNotes: '',
  receivedFrom: '',
  qualityCheckDate: '',
  qualityCheckBy: '',
  temperatureLog: '',
};

interface ProductOption {
  id: string;
  productName: string;
  code: string;
}

interface DistributorOption {
  id: string;
  name: string;
  companyName: string;
  status: string;
}

export default function LotTrackingPage() {
  const [lots, setLots] = useState<LotTracking[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailLot, setDetailLot] = useState<LotTracking | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('food_info').select('id, product_name, code').order('product_name', { ascending: true });
    if (data) {
      setProducts(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        productName: (r.product_name || '') as string,
        code: (r.code || '') as string,
      })));
    }
  }, []);

  const fetchDistributors = useCallback(async () => {
    const { data } = await supabase.from('distributors').select('id, name, company_name, status').order('name', { ascending: true });
    if (data) {
      setDistributors(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        companyName: (r.company_name || '') as string,
        status: (r.status || '') as string,
      })));
    }
  }, []);

  const fetchLots = useCallback(async () => {
    const { data } = await supabase
      .from('lot_tracking')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0)
      setLots(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          lotNumber: (r.lot_number || '') as string,
          productCode: (r.product_code || '') as string,
          productName: (r.product_name || '') as string,
          batchDate: (r.batch_date || '') as string,
          quantity: (r.quantity || 0) as number,
          unit: (r.unit || 'units') as string,
          expirationDate: (r.expiration_date || '') as string,
          location: (r.location || '') as string,
          status: (r.status || 'active') as LotTracking['status'],
          supplier: (r.supplier || '') as string,
          batchNotes: (r.batch_notes || '') as string,
          receivedFrom: (r.received_from || '') as string,
          qualityCheckDate: (r.quality_check_date || '') as string,
          qualityCheckBy: (r.quality_check_by || '') as string,
          temperatureLog: (r.temperature_log || '') as string,
        }))
      );
    else setLots([]);
  }, []);

  useEffect(() => {
    fetchLots();
    fetchProducts();
    fetchDistributors();
  }, [fetchLots, fetchProducts, fetchDistributors]);

  // --- Helpers ---
  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const exp = new Date(date);
    const now = new Date();
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 7;
  };

  const isExpired = (date: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const daysUntilExpiry = (date: string) => {
    if (!date) return null;
    const diff = (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  };

  const getStatusColor = (status: LotTracking['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border border-green-300';
      case 'expired':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'recalled':
        return 'bg-orange-100 text-orange-800 border border-orange-300';
      case 'quality-hold':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    }
  };

  const getStatusLabel = (status: LotTracking['status']) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'expired':
        return 'Expired';
      case 'recalled':
        return 'Recalled';
      case 'quality-hold':
        return 'Quality Hold';
    }
  };

  // --- Stats ---
  const stats = useMemo(() => {
    const totalLots = lots.length;
    const activeLots = lots.filter((l) => l.status === 'active').length;
    const expiredLots = lots.filter((l) => l.status === 'expired').length;
    const qualityHoldLots = lots.filter((l) => l.status === 'quality-hold').length;
    const totalInventory = lots.reduce((sum, l) => sum + l.quantity, 0);
    const recalledLots = lots.filter((l) => l.status === 'recalled').length;
    const expiringSoon = lots.filter((l) => l.status === 'active' && isExpiringSoon(l.expirationDate)).length;
    return { totalLots, activeLots, expiredLots, qualityHoldLots, totalInventory, recalledLots, expiringSoon };
  }, [lots]);

  // --- Filtering ---
  const getFilteredLots = useCallback(() => {
    let filtered = [...lots];

    // Tab-based pre-filter
    if (activeTab === 'active') {
      filtered = filtered.filter((l) => l.status === 'active');
    } else if (activeTab === 'expired-recalled') {
      filtered = filtered.filter((l) => l.status === 'expired' || l.status === 'recalled');
    }
    // 'all' tab and 'overview' show everything (overview won't use the table)

    // Status dropdown filter (only on 'all' tab)
    if (activeTab === 'all' && statusFilter !== 'all') {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.lotNumber.toLowerCase().includes(q) ||
          l.productName.toLowerCase().includes(q) ||
          l.productCode.toLowerCase().includes(q) ||
          l.supplier.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q) ||
          l.receivedFrom.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [lots, activeTab, statusFilter, searchQuery]);

  const filteredLots = useMemo(() => getFilteredLots(), [getFilteredLots]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filteredLots.length / ITEMS_PER_PAGE));
  const paginatedLots = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLots.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLots, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, searchQuery]);

  // --- Form ---
  const resetForm = () => {
    setFormData({ ...emptyForm });
  };

  const openCreateForm = () => {
    setEditId(null);
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (lot: LotTracking) => {
    setEditId(lot.id);
    setFormData({
      lotNumber: lot.lotNumber,
      productCode: lot.productCode,
      productName: lot.productName,
      batchDate: lot.batchDate,
      quantity: lot.quantity.toString(),
      unit: lot.unit,
      expirationDate: lot.expirationDate,
      location: lot.location,
      status: lot.status,
      supplier: lot.supplier,
      batchNotes: lot.batchNotes,
      receivedFrom: lot.receivedFrom,
      qualityCheckDate: lot.qualityCheckDate,
      qualityCheckBy: lot.qualityCheckBy,
      temperatureLog: lot.temperatureLog,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      lot_number: formData.lotNumber,
      product_code: formData.productCode,
      product_name: formData.productName,
      batch_date: formData.batchDate || null,
      quantity: parseFloat(formData.quantity) || 0,
      unit: formData.unit,
      expiration_date: formData.expirationDate || null,
      location: formData.location,
      status: formData.status,
      supplier: formData.supplier,
      batch_notes: formData.batchNotes,
      received_from: formData.receivedFrom,
      quality_check_date: formData.qualityCheckDate || null,
      quality_check_by: formData.qualityCheckBy,
      temperature_log: formData.temperatureLog,
    };
    try {
      if (editId) {
        await supabase.from('lot_tracking').update(row).eq('id', editId);
        logAudit({
          action: 'UPDATE',
          module: 'Lot Tracking',
          record_id: editId,
          details: { lot_number: row.lot_number, product_name: row.product_name, status: row.status },
        });
      } else {
        await supabase.from('lot_tracking').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Lot Tracking',
          record_id: row.lot_number,
          details: { lot_number: row.lot_number, product_name: row.product_name, status: row.status },
        });
      }
      await fetchLots();
    } catch {
      /* fallback */
    }
    setEditId(null);
    resetForm();
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this lot? This action cannot be undone.')) {
      const lotToDelete = lots.find((lot) => lot.id === id);
      await supabase.from('lot_tracking').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Lot Tracking',
        record_id: id,
        details: { lot_number: lotToDelete?.lotNumber, product_name: lotToDelete?.productName },
      });
      setLots(lots.filter((lot) => lot.id !== id));
    }
  };

  // --- Tab definitions ---
  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'active', label: 'Active Lots', count: stats.activeLots },
    { key: 'expired-recalled', label: 'Expired / Recalled', count: stats.expiredLots + stats.recalledLots },
    { key: 'all', label: 'All Lots', count: stats.totalLots },
  ];

  // --- Render helpers ---
  const renderExpirationCell = (lot: LotTracking) => {
    const days = daysUntilExpiry(lot.expirationDate);
    const expired = isExpired(lot.expirationDate);
    const expSoon = isExpiringSoon(lot.expirationDate);
    return (
      <div>
        <p className={`text-sm ${expired ? 'text-red-600 font-semibold' : expSoon ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
          {lot.expirationDate || 'N/A'}
        </p>
        {expired && lot.status !== 'expired' && (
          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white animate-pulse">
            EXPIRED
          </span>
        )}
        {expSoon && !expired && (
          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
            {days}d left
          </span>
        )}
      </div>
    );
  };

  const renderTable = (lotsToRender: LotTracking[]) => (
    <div className="border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Lot Number</th>
              <th className="px-4 py-3 text-left font-semibold">Product</th>
              <th className="px-4 py-3 text-left font-semibold">Supplier</th>
              <th className="px-4 py-3 text-left font-semibold">Batch Date</th>
              <th className="px-4 py-3 text-left font-semibold">Expiration</th>
              <th className="px-4 py-3 text-left font-semibold">Qty</th>
              <th className="px-4 py-3 text-left font-semibold">Location</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lotsToRender.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-base font-medium">No lots found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                </td>
              </tr>
            ) : (
              lotsToRender.map((lot) => (
                <tr
                  key={lot.id}
                  className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setDetailLot(lot)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-primary">{lot.lotNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{lot.productName}</p>
                      <p className="text-xs text-muted-foreground">{lot.productCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{lot.supplier || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lot.batchDate || '-'}</td>
                  <td className="px-4 py-3">{renderExpirationCell(lot)}</td>
                  <td className="px-4 py-3 font-medium">
                    {lot.quantity} <span className="text-xs text-muted-foreground">{lot.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{lot.location || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(lot.status)}`}>
                      {getStatusLabel(lot.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-center">
                      <button
                        onClick={() => setDetailLot(lot)}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(lot)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(lot.id)}
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
  );

  const renderPagination = () => {
    if (filteredLots.length <= ITEMS_PER_PAGE) return null;
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between mt-4 px-1">
        <p className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredLots.length)} of {filteredLots.length} lots
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                p === currentPage
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'border border-border hover:bg-secondary'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // --- Overview Tab ---
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Module description */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <svg className="w-8 h-8 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-blue-900 mb-2">Lot Tracking & Traceability</h2>
            <p className="text-blue-800 leading-relaxed">
              The Lot Tracking module provides end-to-end traceability for all product batches in your bakery operations.
              Every ingredient and finished product is assigned a unique lot number, enabling you to trace products from
              supplier receipt through production to final delivery. This is critical for food safety compliance,
              quality assurance, and rapid response to any recall situations.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                <p className="font-semibold text-blue-900 text-sm">Food Safety</p>
                <p className="text-xs text-blue-700 mt-1">Track batch origins, storage conditions, and expiration dates to maintain the highest safety standards.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                <p className="font-semibold text-blue-900 text-sm">Recall Management</p>
                <p className="text-xs text-blue-700 mt-1">Instantly identify affected lots and trace the full distribution chain during recall events.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                <p className="font-semibold text-blue-900 text-sm">Quality Control</p>
                <p className="text-xs text-blue-700 mt-1">Record quality checks, temperature logs, and hold lots for inspection before release.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="border border-border rounded-xl p-4 bg-card shadow-sm">
            <p className="text-sm text-muted-foreground">Total Lots</p>
            <p className="text-3xl font-bold mt-1">{stats.totalLots}</p>
          </div>
          <div className="border border-green-200 rounded-xl p-4 bg-green-50 shadow-sm">
            <p className="text-sm text-green-700">Active Lots</p>
            <p className="text-3xl font-bold text-green-700 mt-1">{stats.activeLots}</p>
          </div>
          <div className="border border-red-200 rounded-xl p-4 bg-red-50 shadow-sm">
            <p className="text-sm text-red-700">Expired</p>
            <p className="text-3xl font-bold text-red-700 mt-1">{stats.expiredLots}</p>
          </div>
          <div className="border border-yellow-200 rounded-xl p-4 bg-yellow-50 shadow-sm">
            <p className="text-sm text-yellow-700">Quality Hold</p>
            <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.qualityHoldLots}</p>
          </div>
          <div className="border border-border rounded-xl p-4 bg-card shadow-sm">
            <p className="text-sm text-muted-foreground">Total Inventory</p>
            <p className="text-3xl font-bold mt-1">{stats.totalInventory.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Expiration Warnings */}
      {stats.expiringSoon > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="font-semibold text-amber-800">Expiration Warnings</h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            {stats.expiringSoon} active lot{stats.expiringSoon > 1 ? 's' : ''} will expire within the next 7 days. Review and take action promptly.
          </p>
          <div className="space-y-2">
            {lots
              .filter((l) => l.status === 'active' && isExpiringSoon(l.expirationDate))
              .map((lot) => (
                <div
                  key={lot.id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
                  onClick={() => setDetailLot(lot)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm">{lot.lotNumber}</span>
                    <span className="text-sm text-muted-foreground">{lot.productName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-700">
                      Expires in {daysUntilExpiry(lot.expirationDate)} day{(daysUntilExpiry(lot.expirationDate) ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">{lot.expirationDate}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recalled lots warning */}
      {stats.recalledLots > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <h3 className="font-semibold text-orange-800">Active Recalls</h3>
          </div>
          <p className="text-sm text-orange-700 mb-3">
            {stats.recalledLots} lot{stats.recalledLots > 1 ? 's are' : ' is'} currently under recall. Ensure affected products have been removed from distribution.
          </p>
          <div className="space-y-2">
            {lots
              .filter((l) => l.status === 'recalled')
              .slice(0, 5)
              .map((lot) => (
                <div
                  key={lot.id}
                  className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-orange-200 cursor-pointer hover:bg-orange-50 transition-colors"
                  onClick={() => setDetailLot(lot)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm">{lot.lotNumber}</span>
                    <span className="text-sm text-muted-foreground">{lot.productName}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor('recalled')}`}>Recalled</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick summary of recent lots */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Lots</h3>
        {renderTable(lots.slice(0, 5))}
      </div>
    </div>
  );

  // --- Tab content with search/filter bar ---
  const renderTabContent = () => {
    if (activeTab === 'overview') return renderOverview();

    const tabDescriptions: Record<TabKey, string> = {
      overview: '',
      active: 'Showing all currently active lots in your inventory. These lots are within their shelf life and cleared for use in production or sale.',
      'expired-recalled': 'Showing lots that have expired or been recalled. These lots should not be used in production and must be disposed of or returned according to your procedures.',
      all: 'Comprehensive view of all lots across every status. Use the search bar and status filter to quickly find specific lots.',
    };

    return (
      <div className="space-y-4">
        {/* Tab description */}
        <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3">
          <p className="text-sm text-muted-foreground">{tabDescriptions[activeTab]}</p>
        </div>

        {/* Search & Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search lots, products, suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-card"
              />
            </div>
            {activeTab === 'all' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-card"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="recalled">Recalled</option>
                <option value="quality-hold">Quality Hold</option>
              </select>
            )}
          </div>
          <button
            onClick={openCreateForm}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm whitespace-nowrap shadow-sm"
          >
            + New Lot
          </button>
        </div>

        {/* Table */}
        {renderTable(paginatedLots)}

        {/* Pagination */}
        {renderPagination()}
      </div>
    );
  };

  // --- Main Return ---
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Lot Tracking & Traceability</h1>
        <p className="text-muted-foreground">
          Track product lots, batches, expiration dates, quality checks, and full supply chain traceability
        </p>
      </div>

      {/* Stats bar (always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="border border-border rounded-lg p-3 bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Total Lots</p>
          <p className="text-2xl font-bold">{stats.totalLots}</p>
        </div>
        <div className="border border-green-200 rounded-lg p-3 bg-green-50 shadow-sm">
          <p className="text-xs text-green-700">Active</p>
          <p className="text-2xl font-bold text-green-700">{stats.activeLots}</p>
        </div>
        <div className="border border-red-200 rounded-lg p-3 bg-red-50 shadow-sm">
          <p className="text-xs text-red-700">Expired</p>
          <p className="text-2xl font-bold text-red-700">{stats.expiredLots}</p>
        </div>
        <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50 shadow-sm">
          <p className="text-xs text-yellow-700">Quality Hold</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.qualityHoldLots}</p>
        </div>
        <div className="border border-border rounded-lg p-3 bg-card shadow-sm">
          <p className="text-xs text-muted-foreground">Total Inventory</p>
          <p className="text-2xl font-bold">{stats.totalInventory.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* ========== Create/Edit Modal ========== */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditId(null);
        }}
        title={editId ? 'Edit Lot' : 'Create New Lot'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Section: Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lot Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lotNumber}
                  onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  placeholder="LOT-2026-001-BRD"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.productCode}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-muted"
                  placeholder="Auto-filled from product"
                  readOnly
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.productName}
                  onChange={(e) => {
                    const selected = products.find(p => p.productName === e.target.value);
                    setFormData({
                      ...formData,
                      productName: e.target.value,
                      productCode: selected?.code || '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  required
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.productName}>{p.productName} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as LotTracking['status'] })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="recalled">Recalled</option>
                  <option value="quality-hold">Quality Hold</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Supply Chain */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Supply Chain</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  required
                >
                  <option value="">Select a supplier</option>
                  {distributors
                    .filter(d => d.status === 'Active')
                    .map((d) => (
                    <option key={d.id} value={d.name}>{d.name}{d.companyName ? ` - ${d.companyName}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Received From (Distributor)</label>
                <select
                  value={formData.receivedFrom}
                  onChange={(e) => setFormData({ ...formData, receivedFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                >
                  <option value="">Select a distributor (optional)</option>
                  {distributors
                    .filter(d => d.status === 'Active')
                    .map((d) => (
                    <option key={d.id} value={d.name}>{d.name}{d.companyName ? ` - ${d.companyName}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  placeholder="Warehouse A, Shelf 3"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section: Dates & Quantities */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dates & Quantities</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Batch Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.batchDate}
                  onChange={(e) => setFormData({ ...formData, batchDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Expiration Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  placeholder="0"
                  min="0"
                  step="any"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                >
                  <option value="units">Units</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="L">Litres (L)</option>
                  <option value="mL">Millilitres (mL)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="boxes">Boxes</option>
                  <option value="bags">Bags</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Quality Control */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quality Control</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quality Check Date</label>
                <input
                  type="date"
                  value={formData.qualityCheckDate}
                  onChange={(e) => setFormData({ ...formData, qualityCheckDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quality Check By</label>
                <input
                  type="text"
                  value={formData.qualityCheckBy}
                  onChange={(e) => setFormData({ ...formData, qualityCheckBy: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  placeholder="Inspector name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Temperature Log</label>
                <textarea
                  value={formData.temperatureLog}
                  onChange={(e) => setFormData({ ...formData, temperatureLog: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                  rows={2}
                  placeholder="e.g., Received at 4C, stored at 2-4C, checked 3C on 2026-02-20"
                />
              </div>
            </div>
          </div>

          {/* Section: Notes */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Batch Notes</label>
              <textarea
                value={formData.batchNotes}
                onChange={(e) => setFormData({ ...formData, batchNotes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                rows={3}
                placeholder="Any additional notes about this batch..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border sticky bottom-0 bg-card pb-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
              className="px-5 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm shadow-sm"
            >
              {editId ? 'Update Lot' : 'Create Lot'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========== Detail View Modal ========== */}
      <Modal
        isOpen={!!detailLot}
        onClose={() => setDetailLot(null)}
        title="Lot Details"
        size="2xl"
      >
        {detailLot && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header with status */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xl font-bold text-primary">{detailLot.lotNumber}</p>
                <p className="text-lg font-medium mt-1">{detailLot.productName}</p>
                <p className="text-sm text-muted-foreground">{detailLot.productCode}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(detailLot.status)}`}>
                  {getStatusLabel(detailLot.status)}
                </span>
                {isExpired(detailLot.expirationDate) && detailLot.status !== 'expired' && (
                  <div className="mt-2">
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-red-500 text-white animate-pulse">
                      PAST EXPIRATION
                    </span>
                  </div>
                )}
                {isExpiringSoon(detailLot.expirationDate) && !isExpired(detailLot.expirationDate) && (
                  <div className="mt-2">
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-amber-500 text-white">
                      Expires in {daysUntilExpiry(detailLot.expirationDate)} day{(daysUntilExpiry(detailLot.expirationDate) ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lot Information Grid */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lot Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-secondary/30 rounded-lg p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Batch Date</p>
                  <p className="text-sm font-medium">{detailLot.batchDate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expiration Date</p>
                  <p className={`text-sm font-medium ${isExpired(detailLot.expirationDate) ? 'text-red-600' : isExpiringSoon(detailLot.expirationDate) ? 'text-amber-600' : ''}`}>
                    {detailLot.expirationDate || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="text-sm font-medium">{detailLot.quantity} {detailLot.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="text-sm font-medium">{detailLot.location || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Supply Chain / Traceability */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Supply Chain & Traceability</h3>
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {/* Traceability chain visualization */}
                  <div className="flex items-center gap-0 flex-wrap">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-medium mt-1 text-center max-w-[80px] truncate">{detailLot.supplier || 'N/A'}</p>
                      <p className="text-[9px] text-muted-foreground">Supplier</p>
                    </div>
                    <div className="w-8 h-0.5 bg-border mx-1" />
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-400 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-medium mt-1 text-center max-w-[80px] truncate">{detailLot.receivedFrom || 'Direct'}</p>
                      <p className="text-[9px] text-muted-foreground">Distributor</p>
                    </div>
                    <div className="w-8 h-0.5 bg-border mx-1" />
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-medium mt-1 text-center max-w-[80px] truncate">{detailLot.location || 'N/A'}</p>
                      <p className="text-[9px] text-muted-foreground">Storage</p>
                    </div>
                    <div className="w-8 h-0.5 bg-border mx-1" />
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        detailLot.status === 'active' ? 'bg-green-100 border-2 border-green-400' :
                        detailLot.status === 'expired' ? 'bg-red-100 border-2 border-red-400' :
                        detailLot.status === 'recalled' ? 'bg-orange-100 border-2 border-orange-400' :
                        'bg-yellow-100 border-2 border-yellow-400'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          detailLot.status === 'active' ? 'text-green-600' :
                          detailLot.status === 'expired' ? 'text-red-600' :
                          detailLot.status === 'recalled' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-medium mt-1">{getStatusLabel(detailLot.status)}</p>
                      <p className="text-[9px] text-muted-foreground">Current</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Control */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quality Control</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-secondary/30 rounded-lg p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Quality Check Date</p>
                  <p className="text-sm font-medium">{detailLot.qualityCheckDate || 'Not checked'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Checked By</p>
                  <p className="text-sm font-medium">{detailLot.qualityCheckBy || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Temperature Log</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{detailLot.temperatureLog || 'No temperature data recorded'}</p>
                </div>
              </div>
            </div>

            {/* History / Timeline */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Lot History</h3>
              <div className="border border-border rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Batch Created</p>
                      <p className="text-xs text-muted-foreground">Batch date: {detailLot.batchDate || 'N/A'} | Supplier: {detailLot.supplier || 'N/A'}</p>
                    </div>
                  </div>
                  {detailLot.receivedFrom && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Received from Distributor</p>
                        <p className="text-xs text-muted-foreground">Distributor: {detailLot.receivedFrom}</p>
                      </div>
                    </div>
                  )}
                  {detailLot.location && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Stored at Location</p>
                        <p className="text-xs text-muted-foreground">Location: {detailLot.location}</p>
                      </div>
                    </div>
                  )}
                  {detailLot.qualityCheckDate && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Quality Check Performed</p>
                        <p className="text-xs text-muted-foreground">
                          Date: {detailLot.qualityCheckDate} | Inspector: {detailLot.qualityCheckBy || 'N/A'}
                        </p>
                      </div>
                    </div>
                  )}
                  {detailLot.temperatureLog && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Temperature Recorded</p>
                        <p className="text-xs text-muted-foreground">{detailLot.temperatureLog}</p>
                      </div>
                    </div>
                  )}
                  {detailLot.status === 'expired' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-700">Lot Expired</p>
                        <p className="text-xs text-muted-foreground">Expiration date: {detailLot.expirationDate}</p>
                      </div>
                    </div>
                  )}
                  {detailLot.status === 'recalled' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-700">Lot Recalled</p>
                        <p className="text-xs text-muted-foreground">This lot has been recalled and should be removed from distribution.</p>
                      </div>
                    </div>
                  )}
                  {detailLot.status === 'quality-hold' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-700">Placed on Quality Hold</p>
                        <p className="text-xs text-muted-foreground">This lot is held pending quality review.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Batch Notes */}
            {detailLot.batchNotes && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Batch Notes</h3>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{detailLot.batchNotes}</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-border">
              <button
                onClick={() => {
                  setDetailLot(null);
                  handleEdit(detailLot);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Edit Lot
              </button>
              <button
                onClick={() => {
                  setDetailLot(null);
                  handleDelete(detailLot.id);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete Lot
              </button>
              <button
                onClick={() => setDetailLot(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
