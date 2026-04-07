'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { useUserPermissions } from '@/lib/user-permissions';
import {
  AlertTriangle,
  Plus,
  Search,
  Eye,
  Trash2,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileWarning,
  ShieldAlert,
} from 'lucide-react';

// ── Interfaces ───────────────────────────────────────────────────────────────

interface WasteReport {
  id: string;
  date: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit: string;
  reason: string;
  cost: number;
  batch_number: string;
  notes: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string;
  reported_by: string;
  created_at: string;
}

interface DamageReport {
  id: string;
  report_number: string;
  reported_by: string;
  reported_by_id: string;
  delivery_id: string;
  tracking_number: string;
  damage_type: string;
  description: string;
  items_affected: string;
  estimated_cost: number;
  photos: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string;
  admin_notes: string;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const WASTE_REASONS = [
  'Expired',
  'Damaged in Transit',
  'Dropped/Broken',
  'Customer Refused',
  'Spoiled',
  'Quality Issue',
  'Overproduction',
  'Other',
];

const DAMAGE_TYPES = [
  'Product Damage',
  'Packaging Damage',
  'Vehicle Damage',
  'Equipment Damage',
  'Customer Property',
  'Other',
];

function getStatusColor(s: string) {
  switch (s) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Approved': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(s: string) {
  switch (s) {
    case 'Pending': return <Clock className="w-3 h-3" />;
    case 'Approved': return <CheckCircle className="w-3 h-3" />;
    case 'Rejected': return <XCircle className="w-3 h-3" />;
    default: return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RiderReportsPage() {
  const { fullName, isAdmin, role } = useUserPermissions();
  const isRider = role === 'Driver' || role === 'Rider';

  const [activeTab, setActiveTab] = useState<'waste' | 'damage'>('waste');
  const [wasteReports, setWasteReports] = useState<WasteReport[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // ── Toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Waste Report Form ──
  const [showWasteForm, setShowWasteForm] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    product_name: '',
    product_code: '',
    quantity: 1,
    unit: 'pieces',
    reason: 'Damaged in Transit',
    cost: 0,
    batch_number: '',
    notes: '',
  });

  // ── Damage Report Form ──
  const [showDamageForm, setShowDamageForm] = useState(false);
  const [damageForm, setDamageForm] = useState({
    delivery_id: '',
    tracking_number: '',
    damage_type: 'Product Damage',
    description: '',
    items_affected: '',
    estimated_cost: 0,
    photos: '',
  });

  // ── Detail Modals ──
  const [showWasteDetail, setShowWasteDetail] = useState<WasteReport | null>(null);
  const [showDamageDetail, setShowDamageDetail] = useState<DamageReport | null>(null);

  // ── Products for autocomplete ──
  const [products, setProducts] = useState<{ product_name: string; product_code: string; wholesale_price: number }[]>([]);

  // ── Data Fetching ──

  const fetchWasteReports = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('waste_records')
      .select('*')
      .order('created_at', { ascending: false });

    const { data } = await query;
    if (data) {
      setWasteReports(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        date: (r.date || '') as string,
        product_name: (r.product_name || '') as string,
        product_code: (r.product_code || '') as string,
        quantity: (r.quantity || 0) as number,
        unit: (r.unit || 'pieces') as string,
        reason: (r.reason || '') as string,
        cost: (r.cost || 0) as number,
        batch_number: (r.batch_number || '') as string,
        notes: (r.notes || '') as string,
        status: (r.status || 'Pending') as WasteReport['status'],
        approved_by: (r.approved_by || '') as string,
        reported_by: (r.reported_by || '') as string,
        created_at: (r.created_at || '') as string,
      })));
    }
    setLoading(false);
  }, []);

  const fetchDamageReports = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('rider_damage_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        setDamageReports(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          report_number: (r.report_number || '') as string,
          reported_by: (r.reported_by || '') as string,
          reported_by_id: (r.reported_by_id || '') as string,
          delivery_id: (r.delivery_id || '') as string,
          tracking_number: (r.tracking_number || '') as string,
          damage_type: (r.damage_type || '') as string,
          description: (r.description || '') as string,
          items_affected: (r.items_affected || '') as string,
          estimated_cost: (r.estimated_cost || 0) as number,
          photos: (r.photos || '') as string,
          status: (r.status || 'Pending') as DamageReport['status'],
          approved_by: (r.approved_by || '') as string,
          admin_notes: (r.admin_notes || '') as string,
          created_at: (r.created_at || '') as string,
        })));
      }
    } catch {
      // Table may not exist yet
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('pricing_tiers')
      .select('product_name, product_code, wholesale_price')
      .order('product_name', { ascending: true });
    if (data) {
      setProducts(data.map((r: Record<string, unknown>) => ({
        product_name: (r.product_name || '') as string,
        product_code: (r.product_code || '') as string,
        wholesale_price: (r.wholesale_price || 0) as number,
      })));
    }
  }, []);

  useEffect(() => {
    fetchWasteReports();
    fetchDamageReports();
    fetchProducts();
  }, [fetchWasteReports, fetchDamageReports, fetchProducts]);

  // ── Submit Waste Report ──

  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteForm.product_name.trim()) {
      showToast('Please enter a product name', 'error');
      return;
    }

    try {
      const row = {
        date: new Date().toISOString().split('T')[0],
        product_name: wasteForm.product_name,
        product_code: wasteForm.product_code,
        quantity: wasteForm.quantity,
        unit: wasteForm.unit,
        reason: wasteForm.reason,
        cost: wasteForm.cost,
        batch_number: wasteForm.batch_number,
        notes: wasteForm.notes,
        status: 'Pending',
        reported_by: fullName || 'Rider',
      };

      const { data, error } = await supabase.from('waste_records').insert(row).select('id').single();
      if (error) throw error;

      logAudit({
        action: 'CREATE',
        module: 'Rider Waste Report',
        record_id: data?.id || '',
        details: { product: wasteForm.product_name, quantity: wasteForm.quantity, reason: wasteForm.reason },
      });

      showToast('Waste report submitted for admin approval', 'success');
      setShowWasteForm(false);
      setWasteForm({ product_name: '', product_code: '', quantity: 1, unit: 'pieces', reason: 'Damaged in Transit', cost: 0, batch_number: '', notes: '' });
      fetchWasteReports();
    } catch (err) {
      console.error('Submit waste report error:', err);
      showToast('Failed to submit waste report', 'error');
    }
  };

  // ── Submit Damage Report ──

  const handleDamageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageForm.description.trim()) {
      showToast('Please describe the damage', 'error');
      return;
    }

    try {
      const reportNumber = `DMG-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

      const row = {
        report_number: reportNumber,
        reported_by: fullName || 'Rider',
        delivery_id: damageForm.delivery_id || null,
        tracking_number: damageForm.tracking_number,
        damage_type: damageForm.damage_type,
        description: damageForm.description,
        items_affected: damageForm.items_affected,
        estimated_cost: damageForm.estimated_cost,
        photos: damageForm.photos,
        status: 'Pending',
      };

      const { data, error } = await supabase.from('rider_damage_reports').insert(row).select('id').single();
      if (error) throw error;

      logAudit({
        action: 'CREATE',
        module: 'Rider Damage Report',
        record_id: data?.id || '',
        details: { report_number: reportNumber, type: damageForm.damage_type, delivery: damageForm.tracking_number },
      });

      showToast('Damage report submitted for admin approval', 'success');
      setShowDamageForm(false);
      setDamageForm({ delivery_id: '', tracking_number: '', damage_type: 'Product Damage', description: '', items_affected: '', estimated_cost: 0, photos: '' });
      fetchDamageReports();
    } catch (err) {
      console.error('Submit damage report error:', err);
      showToast('Failed to submit damage report. The table may not exist yet — run the migration SQL.', 'error');
    }
  };

  // ── Admin: Approve / Reject ──

  const handleApproveWaste = async (report: WasteReport) => {
    try {
      await supabase.from('waste_records').update({ status: 'Approved', approved_by: fullName || 'Admin' }).eq('id', report.id);
      logAudit({ action: 'APPROVE', module: 'Rider Waste Report', record_id: report.id, details: { product: report.product_name } });
      showToast('Waste report approved', 'success');
      fetchWasteReports();
    } catch { showToast('Failed to approve', 'error'); }
  };

  const handleRejectWaste = async (report: WasteReport) => {
    try {
      await supabase.from('waste_records').update({ status: 'Rejected', approved_by: fullName || 'Admin' }).eq('id', report.id);
      logAudit({ action: 'REJECT', module: 'Rider Waste Report', record_id: report.id, details: { product: report.product_name } });
      showToast('Waste report rejected', 'success');
      fetchWasteReports();
    } catch { showToast('Failed to reject', 'error'); }
  };

  const handleApproveDamage = async (report: DamageReport) => {
    try {
      await supabase.from('rider_damage_reports').update({ status: 'Approved', approved_by: fullName || 'Admin' }).eq('id', report.id);
      logAudit({ action: 'APPROVE', module: 'Rider Damage Report', record_id: report.id, details: { type: report.damage_type } });
      showToast('Damage report approved', 'success');
      fetchDamageReports();
    } catch { showToast('Failed to approve', 'error'); }
  };

  const handleRejectDamage = async (report: DamageReport) => {
    try {
      await supabase.from('rider_damage_reports').update({ status: 'Rejected', approved_by: fullName || 'Admin' }).eq('id', report.id);
      logAudit({ action: 'REJECT', module: 'Rider Damage Report', record_id: report.id, details: { type: report.damage_type } });
      showToast('Damage report rejected', 'success');
      fetchDamageReports();
    } catch { showToast('Failed to reject', 'error'); }
  };

  const handleDeleteWaste = async (id: string) => {
    if (!confirm('Delete this waste report?')) return;
    await supabase.from('waste_records').delete().eq('id', id);
    showToast('Waste report deleted', 'success');
    fetchWasteReports();
  };

  const handleDeleteDamage = async (id: string) => {
    if (!confirm('Delete this damage report?')) return;
    await supabase.from('rider_damage_reports').delete().eq('id', id);
    showToast('Damage report deleted', 'success');
    fetchDamageReports();
  };

  // ── Filter ──

  const filteredWaste = wasteReports.filter((r) => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    if (!matchStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return r.product_name.toLowerCase().includes(term) || r.reason.toLowerCase().includes(term) || r.reported_by.toLowerCase().includes(term);
  });

  const filteredDamage = damageReports.filter((r) => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    if (!matchStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return r.description.toLowerCase().includes(term) || r.damage_type.toLowerCase().includes(term) || r.tracking_number.toLowerCase().includes(term) || r.reported_by.toLowerCase().includes(term);
  });

  // ── Stats ──

  const wasteCount = wasteReports.length;
  const wastePending = wasteReports.filter(r => r.status === 'Pending').length;
  const damageCount = damageReports.length;
  const damagePending = damageReports.filter(r => r.status === 'Pending').length;

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

  return (
    <div className="p-6 md:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-7 h-7 text-orange-500" />
          <h1 className="text-2xl font-bold">Rider Reports</h1>
        </div>
        <p className="text-muted-foreground">Report waste and damage incidents during deliveries. All reports require admin approval.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-50 rounded-lg"><FileWarning className="w-4 h-4 text-orange-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Waste Reports</p>
              <p className="text-xl font-bold">{wasteCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 rounded-lg"><Clock className="w-4 h-4 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Waste Pending</p>
              <p className="text-xl font-bold text-yellow-600">{wastePending}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 rounded-lg"><ShieldAlert className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Damage Reports</p>
              <p className="text-xl font-bold">{damageCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-xl p-4 bg-card">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-50 rounded-lg"><Clock className="w-4 h-4 text-yellow-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Damage Pending</p>
              <p className="text-xl font-bold text-yellow-600">{damagePending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => { setActiveTab('waste'); setSearchTerm(''); setFilterStatus('All'); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'waste' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-2"><FileWarning className="w-4 h-4" /> Waste Reports</span>
        </button>
        <button
          onClick={() => { setActiveTab('damage'); setSearchTerm(''); setFilterStatus('All'); }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'damage' ? 'border-red-500 text-red-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Damage Reports</span>
        </button>
      </div>

      {/* Actions Bar */}
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-56 bg-background text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <button
          onClick={() => activeTab === 'waste' ? setShowWasteForm(true) : setShowDamageForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Report {activeTab === 'waste' ? 'Waste' : 'Damage'}
        </button>
      </div>

      {/* ═══ WASTE TAB ═══ */}
      {activeTab === 'waste' && (
        <>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading waste reports...</div>
          ) : filteredWaste.length === 0 ? (
            <div className="border border-border rounded-xl p-12 bg-card text-center">
              <FileWarning className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Waste Reports</h3>
              <p className="text-sm text-muted-foreground">No waste reports found. Submit a report when waste occurs during delivery.</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Qty</th>
                    <th className="px-4 py-3 text-left font-semibold">Reason</th>
                    <th className="px-4 py-3 text-right font-semibold">Cost</th>
                    <th className="px-4 py-3 text-left font-semibold">Reported By</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWaste.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.product_name}</div>
                        {r.product_code && <div className="text-xs text-muted-foreground">{r.product_code}</div>}
                      </td>
                      <td className="px-4 py-3 text-right">{r.quantity} {r.unit}</td>
                      <td className="px-4 py-3 text-sm">{r.reason}</td>
                      <td className="px-4 py-3 text-right font-medium">KES {(r.cost || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.reported_by || '---'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(r.status)}`}>
                          {getStatusIcon(r.status)} {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.date || r.created_at?.split('T')[0]}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setShowWasteDetail(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="View"><Eye className="w-4 h-4" /></button>
                          {isAdmin && r.status === 'Pending' && (
                            <>
                              <button onClick={() => handleApproveWaste(r)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                              <button onClick={() => handleRejectWaste(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {(isAdmin || (r.status === 'Pending' && isRider)) && (
                            <button onClick={() => handleDeleteWaste(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ DAMAGE TAB ═══ */}
      {activeTab === 'damage' && (
        <>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading damage reports...</div>
          ) : filteredDamage.length === 0 ? (
            <div className="border border-border rounded-xl p-12 bg-card text-center">
              <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-semibold mb-1">No Damage Reports</h3>
              <p className="text-sm text-muted-foreground">No damage reports found. Submit a report when damage occurs during delivery.</p>
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Report #</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Delivery</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Est. Cost</th>
                    <th className="px-4 py-3 text-left font-semibold">Reported By</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDamage.map((r) => (
                    <tr key={r.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{r.report_number}</td>
                      <td className="px-4 py-3 text-sm">{r.damage_type}</td>
                      <td className="px-4 py-3 text-sm font-mono">{r.tracking_number || '---'}</td>
                      <td className="px-4 py-3 text-sm max-w-[200px] truncate">{r.description}</td>
                      <td className="px-4 py-3 text-right font-medium">KES {(r.estimated_cost || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.reported_by}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(r.status)}`}>
                          {getStatusIcon(r.status)} {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setShowDamageDetail(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="View"><Eye className="w-4 h-4" /></button>
                          {isAdmin && r.status === 'Pending' && (
                            <>
                              <button onClick={() => handleApproveDamage(r)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                              <button onClick={() => handleRejectDamage(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle className="w-4 h-4" /></button>
                            </>
                          )}
                          {(isAdmin || (r.status === 'Pending' && isRider)) && (
                            <button onClick={() => handleDeleteDamage(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══ WASTE REPORT FORM MODAL ═══ */}
      <Modal isOpen={showWasteForm} onClose={() => setShowWasteForm(false)} title="Report Waste" size="xl">
        <form onSubmit={handleWasteSubmit} className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-sm text-orange-800 font-medium">This report will be submitted for admin approval.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Product *</label>
              <input
                type="text"
                list="waste-products"
                value={wasteForm.product_name}
                onChange={(e) => {
                  setWasteForm({ ...wasteForm, product_name: e.target.value });
                  const match = products.find(p => p.product_name === e.target.value);
                  if (match) {
                    setWasteForm(f => ({ ...f, product_code: match.product_code, cost: match.wholesale_price * f.quantity }));
                  }
                }}
                className={inputClass}
                placeholder="Enter or select product"
                required
              />
              <datalist id="waste-products">
                {products.map((p) => <option key={p.product_name} value={p.product_name}>{p.product_code}</option>)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Product Code</label>
              <input type="text" value={wasteForm.product_code} onChange={(e) => setWasteForm({ ...wasteForm, product_code: e.target.value })} className={inputClass} placeholder="Auto-filled" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Quantity *</label>
              <input type="number" min="1" value={wasteForm.quantity} onChange={(e) => setWasteForm({ ...wasteForm, quantity: parseInt(e.target.value) || 1 })} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Unit</label>
              <select value={wasteForm.unit} onChange={(e) => setWasteForm({ ...wasteForm, unit: e.target.value })} className={inputClass}>
                <option value="pieces">Pieces</option>
                <option value="kg">Kilograms</option>
                <option value="boxes">Boxes</option>
                <option value="trays">Trays</option>
                <option value="liters">Liters</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Estimated Cost</label>
              <input type="number" min="0" step="0.01" value={wasteForm.cost} onChange={(e) => setWasteForm({ ...wasteForm, cost: parseFloat(e.target.value) || 0 })} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Reason *</label>
            <select value={wasteForm.reason} onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })} className={inputClass} required>
              {WASTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={wasteForm.notes} onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })} className={inputClass} rows={3} placeholder="Describe what happened..." />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button type="button" onClick={() => setShowWasteForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm">Submit Waste Report</button>
          </div>
        </form>
      </Modal>

      {/* ═══ DAMAGE REPORT FORM MODAL ═══ */}
      <Modal isOpen={showDamageForm} onClose={() => setShowDamageForm(false)} title="Report Damage" size="xl">
        <form onSubmit={handleDamageSubmit} className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-800 font-medium">This report will be submitted for admin approval.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Damage Type *</label>
              <select value={damageForm.damage_type} onChange={(e) => setDamageForm({ ...damageForm, damage_type: e.target.value })} className={inputClass} required>
                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Delivery Tracking #</label>
              <input type="text" value={damageForm.tracking_number} onChange={(e) => setDamageForm({ ...damageForm, tracking_number: e.target.value })} className={inputClass} placeholder="DEL-XXXXXX (optional)" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Description *</label>
            <textarea value={damageForm.description} onChange={(e) => setDamageForm({ ...damageForm, description: e.target.value })} className={inputClass} rows={3} placeholder="Describe the damage in detail..." required />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Items Affected</label>
            <input type="text" value={damageForm.items_affected} onChange={(e) => setDamageForm({ ...damageForm, items_affected: e.target.value })} className={inputClass} placeholder="e.g. 5 loaves white bread, 2 cakes" />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Estimated Cost</label>
            <input type="number" min="0" step="0.01" value={damageForm.estimated_cost} onChange={(e) => setDamageForm({ ...damageForm, estimated_cost: parseFloat(e.target.value) || 0 })} className={inputClass} />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button type="button" onClick={() => setShowDamageForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm">Submit Damage Report</button>
          </div>
        </form>
      </Modal>

      {/* ═══ WASTE DETAIL MODAL ═══ */}
      <Modal isOpen={!!showWasteDetail} onClose={() => setShowWasteDetail(null)} title="Waste Report Details" size="lg">
        {showWasteDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(showWasteDetail.status)}`}>
                {getStatusIcon(showWasteDetail.status)} {showWasteDetail.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border border-border rounded-lg p-4">
              <div><span className="text-muted-foreground">Product:</span> <strong className="ml-1">{showWasteDetail.product_name}</strong></div>
              <div><span className="text-muted-foreground">Code:</span> <strong className="ml-1">{showWasteDetail.product_code || '---'}</strong></div>
              <div><span className="text-muted-foreground">Quantity:</span> <strong className="ml-1">{showWasteDetail.quantity} {showWasteDetail.unit}</strong></div>
              <div><span className="text-muted-foreground">Cost:</span> <strong className="ml-1">KES {(showWasteDetail.cost || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div><span className="text-muted-foreground">Reason:</span> <strong className="ml-1">{showWasteDetail.reason}</strong></div>
              <div><span className="text-muted-foreground">Reported By:</span> <strong className="ml-1">{showWasteDetail.reported_by || '---'}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> <strong className="ml-1">{showWasteDetail.date || showWasteDetail.created_at?.split('T')[0]}</strong></div>
              {showWasteDetail.approved_by && <div><span className="text-muted-foreground">Approved By:</span> <strong className="ml-1">{showWasteDetail.approved_by}</strong></div>}
            </div>
            {showWasteDetail.notes && (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{showWasteDetail.notes}</p>
              </div>
            )}
            {isAdmin && showWasteDetail.status === 'Pending' && (
              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button onClick={() => { handleRejectWaste(showWasteDetail); setShowWasteDetail(null); }} className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm">Reject</button>
                <button onClick={() => { handleApproveWaste(showWasteDetail); setShowWasteDetail(null); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Approve</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ DAMAGE DETAIL MODAL ═══ */}
      <Modal isOpen={!!showDamageDetail} onClose={() => setShowDamageDetail(null)} title="Damage Report Details" size="lg">
        {showDamageDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-medium">{showDamageDetail.report_number}</span>
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(showDamageDetail.status)}`}>
                {getStatusIcon(showDamageDetail.status)} {showDamageDetail.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm border border-border rounded-lg p-4">
              <div><span className="text-muted-foreground">Type:</span> <strong className="ml-1">{showDamageDetail.damage_type}</strong></div>
              <div><span className="text-muted-foreground">Delivery:</span> <strong className="ml-1 font-mono">{showDamageDetail.tracking_number || '---'}</strong></div>
              <div><span className="text-muted-foreground">Est. Cost:</span> <strong className="ml-1">KES {(showDamageDetail.estimated_cost || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              <div><span className="text-muted-foreground">Reported By:</span> <strong className="ml-1">{showDamageDetail.reported_by}</strong></div>
              <div className="col-span-2"><span className="text-muted-foreground">Items Affected:</span> <strong className="ml-1">{showDamageDetail.items_affected || '---'}</strong></div>
            </div>
            <div className="border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{showDamageDetail.description}</p>
            </div>
            {showDamageDetail.admin_notes && (
              <div className="border border-border rounded-lg p-3 bg-secondary/30">
                <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
                <p className="text-sm">{showDamageDetail.admin_notes}</p>
              </div>
            )}
            {isAdmin && showDamageDetail.status === 'Pending' && (
              <div className="flex gap-2 justify-end pt-3 border-t border-border">
                <button onClick={() => { handleRejectDamage(showDamageDetail); setShowDamageDetail(null); }} className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm">Reject</button>
                <button onClick={() => { handleApproveDamage(showDamageDetail); setShowDamageDetail(null); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Approve</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
