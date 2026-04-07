'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { AlertTriangle, Search, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface Creditor {
  id: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  totalCredit: number;
  creditDays: number;
  creditOpenedDate: string;
  maxCreditDays: number;
  nextPaymentDate: string;
  lastPaymentDate: string;
  status: 'Current' | 'Overdue' | 'Paid';
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

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Current' | 'Overdue' | 'Paid'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const tableRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    supplierName: '',
    contactPerson: '',
    phone: '',
    email: '',
    totalCredit: 0,
    creditOpenedDate: new Date().toISOString().split('T')[0],
    maxCreditDays: 30,
    nextPaymentDate: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('creditors').select('*').order('created_at', { ascending: false });
    if (data) {
      const mapped = data.map((r: Record<string, unknown>) => {
        const creditOpenedDate = (r.credit_opened_date || r.created_at || '') as string;
        const maxCreditDays = (r.max_credit_days || 30) as number;
        const totalCredit = (r.total_credit || 0) as number;
        const daysOutstanding = calcDays(creditOpenedDate);

        let status: Creditor['status'] = 'Current';
        let flagged = false;
        let flagReason = '';

        if (totalCredit <= 0) {
          status = 'Paid';
        } else if (daysOutstanding > maxCreditDays) {
          status = 'Overdue';
          flagged = true;
          flagReason = `${daysOutstanding} days outstanding — exceeds ${maxCreditDays} day credit limit`;
        }

        return {
          id: r.id as string,
          supplierName: (r.supplier_name || '') as string,
          contactPerson: (r.contact_person || '') as string,
          phone: (r.phone || '') as string,
          email: (r.email || '') as string,
          totalCredit,
          creditDays: daysOutstanding,
          creditOpenedDate,
          maxCreditDays,
          nextPaymentDate: (r.next_payment_date || '') as string,
          lastPaymentDate: (r.last_payment_date || '') as string,
          status,
          flagged,
          flagReason,
          notes: (r.notes || '') as string,
          createdAt: (r.created_at || '') as string,
        };
      });

      setCreditors(mapped);

      // Auto-update status and flags
      for (const c of mapped) {
        if (c.totalCredit > 0) {
          await supabase.from('creditors').update({
            credit_days: c.creditDays,
            status: c.status,
            flagged: c.flagged,
            flag_reason: c.flagReason,
          }).eq('id', c.id);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      supplier_name: formData.supplierName,
      contact_person: formData.contactPerson,
      phone: formData.phone,
      email: formData.email,
      total_credit: formData.totalCredit,
      credit_opened_date: formData.creditOpenedDate || new Date().toISOString().split('T')[0],
      max_credit_days: formData.maxCreditDays,
      next_payment_date: formData.nextPaymentDate || null,
      notes: formData.notes,
      status: 'Current',
    };
    try {
      if (editingId) {
        await supabase.from('creditors').update(row).eq('id', editingId);
        logAudit({
          action: 'UPDATE',
          module: 'Creditors',
          record_id: editingId,
          details: { supplier_name: row.supplier_name, total_credit: row.total_credit, max_credit_days: row.max_credit_days },
        });
      } else {
        const { data: inserted } = await supabase.from('creditors').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Creditors',
          record_id: inserted?.id ?? '',
          details: { supplier_name: row.supplier_name, total_credit: row.total_credit, max_credit_days: row.max_credit_days },
        });
      }
      await fetchData();
    } catch { /* */ }
    setEditingId(null);
    resetForm();
    setShowForm(false);
  };

  const handleEdit = (c: Creditor) => {
    setFormData({
      supplierName: c.supplierName,
      contactPerson: c.contactPerson,
      phone: c.phone,
      email: c.email,
      totalCredit: c.totalCredit,
      creditOpenedDate: c.creditOpenedDate,
      maxCreditDays: c.maxCreditDays,
      nextPaymentDate: c.nextPaymentDate,
      notes: c.notes,
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this creditor?')) {
      await supabase.from('creditors').delete().eq('id', id);
      logAudit({ action: 'DELETE', module: 'Creditors', record_id: id, details: {} });
      setCreditors(creditors.filter(c => c.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({ supplierName: '', contactPerson: '', phone: '', email: '', totalCredit: 0, creditOpenedDate: new Date().toISOString().split('T')[0], maxCreditDays: 30, nextPaymentDate: '', notes: '' });
    setEditingId(null);
  };

  const totalCredit = creditors.reduce((s, c) => { const n = Number(c.totalCredit); return s + (Number.isFinite(n) ? n : 0); }, 0);
  const overdueCount = creditors.filter(c => c.status === 'Overdue').length;
  const flaggedCreditors = creditors.filter(c => c.flagged && c.totalCredit > 0);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Filter / search / pagination
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

  const filtered = creditors.filter(c => {
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    if (!matchStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.supplierName.toLowerCase().includes(term) || c.contactPerson.toLowerCase().includes(term) || c.phone.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const exportPdf = async () => {
    if (!tableRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Creditors-${new Date().toISOString().split('T')[0]}.pdf`,
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
        <h1 className="mb-2">Creditors Management</h1>
        <p className="text-muted-foreground">Supplier credit tracking. Days count automatically from when credit is opened.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Credit Owed</p>
          <p className="text-2xl font-bold">{totalCredit.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Flagged for Action</p>
          <p className="text-2xl font-bold text-orange-600">{flaggedCreditors.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Active Creditors</p>
          <p className="text-2xl font-bold">{creditors.filter(c => c.totalCredit > 0).length}</p>
        </div>
      </div>

      {/* Flagged Alert */}
      {flaggedCreditors.length > 0 && (
        <div className="mb-6 border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-red-800">Creditors Exceeding Credit Days — Payment Required</h3>
          </div>
          <div className="space-y-1">
            {flaggedCreditors.map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-red-100/50">
                <span className="font-medium text-red-900">{c.supplierName}</span>
                <span className="text-red-700">{c.creditDays} days outstanding | Credit: {c.totalCredit.toLocaleString()} | Limit: {c.maxCreditDays} days</span>
                <span className="px-2 py-0.5 text-xs rounded font-semibold bg-red-100 text-red-800">Overdue</span>
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
              placeholder="Search creditors..."
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
            <option value="Paid">Paid</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">+ Add Creditor</button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
          >
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? 'Edit Creditor' : 'Add Creditor'} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Supplier Name *</label>
              <input type="text" placeholder="Supplier name" value={formData.supplierName} onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Contact Person</label>
              <input type="text" placeholder="Contact name" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input type="text" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Total Credit Owed *</label>
              <input type="number" placeholder="Amount" value={formData.totalCredit} onChange={(e) => setFormData({ ...formData, totalCredit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Credit Days (limit)</label>
              <input type="number" placeholder="e.g. 30" value={formData.maxCreditDays} onChange={(e) => setFormData({ ...formData, maxCreditDays: parseInt(e.target.value) || 30 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Credit Opened Date</label>
              <input type="date" value={formData.creditOpenedDate} onChange={(e) => setFormData({ ...formData, creditOpenedDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Next Payment Date</label>
              <input type="date" value={formData.nextPaymentDate} onChange={(e) => setFormData({ ...formData, nextPaymentDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
          </div>
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
            Days outstanding will be auto-calculated from the credit opened date. If days exceed the max credit days, the creditor will be flagged for action.
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
              <th className="px-4 py-3 text-left font-semibold">Supplier</th>
              <th className="px-4 py-3 text-right font-semibold">Total Credit</th>
              <th className="px-4 py-3 text-center font-semibold">Days Outstanding</th>
              <th className="px-4 py-3 text-center font-semibold">Credit Limit</th>
              <th className="px-4 py-3 text-left font-semibold">Next Payment</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{searchTerm || filterStatus !== 'All' ? 'No creditors match your filters' : 'No creditors'}</td></tr>
            ) : paginated.map(c => (
              <tr key={c.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${c.flagged && c.totalCredit > 0 ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.flagged && c.totalCredit > 0 && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                    <div>
                      <div className="font-medium">{c.supplierName}</div>
                      {c.contactPerson && <div className="text-xs text-muted-foreground">{c.contactPerson}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{c.totalCredit.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${c.creditDays > c.maxCreditDays && c.totalCredit > 0 ? 'text-red-600' : ''}`}>
                    {c.creditDays} days
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{c.maxCreditDays} days</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.nextPaymentDate)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded font-semibold ${
                    c.status === 'Current' ? 'bg-green-100 text-green-800' :
                    c.status === 'Paid' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(c)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
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
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} creditors
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
          <p className="text-sm text-muted-foreground">Showing {filtered.length} of {creditors.length} creditors</p>
        </div>
      )}
    </div>
  );
}
