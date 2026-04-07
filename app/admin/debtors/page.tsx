'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { AlertTriangle, Search, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface Debtor {
  id: string;
  name: string;
  phone: string;
  totalDebt: number;
  debtDays: number;
  debtOpenedDate: string;
  creditLimitDays: number;
  lastPayment: string;
  lastPaymentAmount: number;
  status: 'Current' | 'Overdue' | 'Defaulted';
  flagged: boolean;
  flagReason: string;
  notes: string;
  createdAt: string;
}

function calcDays(dateStr: string): number {
  if (!dateStr) return 0;
  const opened = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Current' | 'Overdue' | 'Defaulted'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const tableRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    totalDebt: 0,
    debtOpenedDate: new Date().toISOString().split('T')[0],
    creditLimitDays: 30,
    lastPayment: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('debtors').select('*').order('created_at', { ascending: false });
    if (data) {
      const now = new Date();
      const mapped = data.map((r: Record<string, unknown>) => {
        const debtOpenedDate = (r.debt_opened_date || r.created_at || '') as string;
        const creditLimitDays = (r.credit_limit_days || 30) as number;
        const totalDebt = (r.total_debt || 0) as number;
        const daysOutstanding = calcDays(debtOpenedDate);

        // Auto-determine status based on days and debt
        let status: Debtor['status'] = 'Current';
        let flagged = false;
        let flagReason = '';

        if (totalDebt <= 0) {
          status = 'Current';
        } else if (daysOutstanding > creditLimitDays * 2) {
          status = 'Defaulted';
          flagged = true;
          flagReason = `${daysOutstanding} days outstanding — exceeds ${creditLimitDays * 2} day default threshold`;
        } else if (daysOutstanding > creditLimitDays) {
          status = 'Overdue';
          flagged = true;
          flagReason = `${daysOutstanding} days outstanding — exceeds ${creditLimitDays} day credit limit`;
        }

        return {
          id: r.id as string,
          name: (r.name || '') as string,
          phone: (r.phone || '') as string,
          totalDebt,
          debtDays: daysOutstanding,
          debtOpenedDate,
          creditLimitDays,
          lastPayment: (r.last_payment_date || '') as string,
          lastPaymentAmount: (r.last_payment_amount || 0) as number,
          status,
          flagged,
          flagReason,
          notes: (r.notes || '') as string,
          createdAt: (r.created_at || '') as string,
        };
      });

      setDebtors(mapped);

      // Auto-update status and flags in database
      for (const d of mapped) {
        if (d.totalDebt > 0) {
          await supabase.from('debtors').update({
            debt_days: d.debtDays,
            status: d.status,
            flagged: d.flagged,
            flag_reason: d.flagReason,
          }).eq('id', d.id);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      name: formData.name,
      phone: formData.phone,
      total_debt: formData.totalDebt,
      debt_opened_date: formData.debtOpenedDate || new Date().toISOString().split('T')[0],
      credit_limit_days: formData.creditLimitDays,
      last_payment_date: formData.lastPayment || null,
      notes: formData.notes,
      status: 'Current',
    };
    try {
      if (editingId) {
        await supabase.from('debtors').update(row).eq('id', editingId);
        logAudit({
          action: 'UPDATE',
          module: 'Debtors',
          record_id: editingId,
          details: { name: formData.name, total_debt: formData.totalDebt, credit_limit_days: formData.creditLimitDays },
        });
      } else {
        await supabase.from('debtors').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Debtors',
          record_id: '',
          details: { name: formData.name, total_debt: formData.totalDebt, credit_limit_days: formData.creditLimitDays },
        });
      }
      await fetchData();
    } catch { /* */ }
    setEditingId(null);
    setFormData({ name: '', phone: '', totalDebt: 0, debtOpenedDate: new Date().toISOString().split('T')[0], creditLimitDays: 30, lastPayment: '', notes: '' });
    setShowForm(false);
  };

  const handleEdit = (d: Debtor) => {
    setFormData({
      name: d.name,
      phone: d.phone,
      totalDebt: d.totalDebt,
      debtOpenedDate: d.debtOpenedDate,
      creditLimitDays: d.creditLimitDays,
      lastPayment: d.lastPayment,
      notes: d.notes,
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this debtor?')) {
      await supabase.from('debtors').delete().eq('id', id);
      logAudit({ action: 'DELETE', module: 'Debtors', record_id: id, details: { entity: 'debtor' } });
      setDebtors(debtors.filter(d => d.id !== id));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', phone: '', totalDebt: 0, debtOpenedDate: new Date().toISOString().split('T')[0], creditLimitDays: 30, lastPayment: '', notes: '' });
  };

  const totalDebt = debtors.reduce((s, d) => { const n = Number(d.totalDebt); return s + (Number.isFinite(n) ? n : 0); }, 0);
  const overdueCount = debtors.filter(d => d.status === 'Overdue' || d.status === 'Defaulted').length;
  const flaggedDebtors = debtors.filter(d => d.flagged && d.totalDebt > 0);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Filter / search / pagination
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

  const filtered = debtors.filter(d => {
    const matchStatus = filterStatus === 'All' || d.status === filterStatus;
    if (!matchStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return d.name.toLowerCase().includes(term) || d.phone.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportPdf = async () => {
    if (!tableRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Debtors-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(tableRef.current).save();
    } catch { /* */ }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Debtors Management</h1>
        <p className="text-muted-foreground">Credit sales collection and debtor tracking. Days count automatically from when debt is opened.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Debt</p>
          <p className="text-2xl font-bold">{totalDebt.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Overdue / Defaulted</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Flagged for Action</p>
          <p className="text-2xl font-bold text-orange-600">{flaggedDebtors.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Active Debtors</p>
          <p className="text-2xl font-bold">{debtors.filter(d => d.totalDebt > 0).length}</p>
        </div>
      </div>

      {/* Flagged Alert */}
      {flaggedDebtors.length > 0 && (
        <div className="mb-6 border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-red-800">Debtors Exceeding Credit Days — Action Required</h3>
          </div>
          <div className="space-y-1">
            {flaggedDebtors.map(d => (
              <div key={d.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-red-100/50">
                <span className="font-medium text-red-900">{d.name}</span>
                <span className="text-red-700">{d.debtDays} days outstanding | Debt: {d.totalDebt.toLocaleString()} | Limit: {d.creditLimitDays} days</span>
                <span className={`px-2 py-0.5 text-xs rounded font-semibold ${d.status === 'Defaulted' ? 'bg-red-600 text-white' : 'bg-yellow-100 text-yellow-800'}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 flex-wrap flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search debtors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
          >
            <option value="All">All Status</option>
            <option value="Current">Current</option>
            <option value="Overdue">Overdue</option>
            <option value="Defaulted">Defaulted</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            + Add Debtor
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
          >
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? 'Edit Debtor' : 'Add Debtor'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Debtor Name *</label>
              <input type="text" placeholder="Full name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input type="text" placeholder="Phone number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Total Debt *</label>
              <input type="number" placeholder="Amount owed" value={formData.totalDebt} onChange={(e) => setFormData({ ...formData, totalDebt: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Credit Limit (days)</label>
              <input type="number" placeholder="Max days to pay" value={formData.creditLimitDays} onChange={(e) => setFormData({ ...formData, creditLimitDays: parseInt(e.target.value) || 30 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Debt Opened Date</label>
              <input type="date" value={formData.debtOpenedDate} onChange={(e) => setFormData({ ...formData, debtOpenedDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Last Payment Date</label>
              <input type="date" value={formData.lastPayment} onChange={(e) => setFormData({ ...formData, lastPayment: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
          </div>
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            Days outstanding will be auto-calculated from the debt opened date. If days exceed the credit limit, the debtor will be flagged automatically.
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>}
      <div ref={tableRef}>
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Phone</th>
              <th className="px-4 py-3 text-right font-semibold">Total Debt</th>
              <th className="px-4 py-3 text-center font-semibold">Days Outstanding</th>
              <th className="px-4 py-3 text-center font-semibold">Credit Limit</th>
              <th className="px-4 py-3 text-left font-semibold">Last Payment</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{searchTerm || filterStatus !== 'All' ? 'No debtors match your filters' : 'No debtors'}</td></tr>
            ) : paginated.map(d => (
              <tr key={d.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${d.flagged && d.totalDebt > 0 ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    {d.flagged && d.totalDebt > 0 && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                    {d.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.phone || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold">{d.totalDebt.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${d.debtDays > d.creditLimitDays && d.totalDebt > 0 ? 'text-red-600' : ''}`}>
                    {d.debtDays} days
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{d.creditLimitDays} days</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.lastPayment)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded font-semibold ${
                    d.status === 'Current' ? 'bg-green-100 text-green-800' :
                    d.status === 'Overdue' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(d)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                    <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} debtors
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) page = i + 1;
              else if (currentPage <= 4) page = i + 1;
              else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
              else page = currentPage - 3 + i;
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>
                  {page}
                </button>
              );
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      {filtered.length > 0 && totalPages <= 1 && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Showing {filtered.length} of {debtors.length} debtors</p>
        </div>
      )}
    </div>
  );
}
