'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface DistributionAgent {
  id: string;
  name: string;
  phone: string;
  email: string;
  idNumber: string;
  address: string;
  location: string;
  gpsLat: number;
  gpsLng: number;
  territory: string;
  commissionRate: number;
  commissionType: 'percentage' | 'fixed';
  status: 'Active' | 'Inactive' | 'Suspended';
  joiningDate: string;
  vehicleType: string;
  vehicleRegistration: string;
  bankName: string;
  bankAccount: string;
  totalDistributed: number;
  totalCommission: number;
  rating: number;
  notes: string;
}

interface DistributionRecord {
  id: string;
  agentId: string;
  agentName: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  commissionAmount: number;
  distributionDate: string;
  status: 'Pending' | 'Dispatched' | 'Delivered' | 'Returned';
  returnQuantity: number;
  notes: string;
}

// ─── Empty Forms ─────────────────────────────────────────────────────────────

const emptyAgentForm = {
  name: '',
  phone: '',
  email: '',
  idNumber: '',
  address: '',
  location: '',
  gpsLat: 0,
  gpsLng: 0,
  territory: '',
  commissionRate: 0,
  commissionType: 'percentage' as DistributionAgent['commissionType'],
  status: 'Active' as DistributionAgent['status'],
  joiningDate: new Date().toISOString().split('T')[0],
  vehicleType: '',
  vehicleRegistration: '',
  bankName: '',
  bankAccount: '',
  totalDistributed: 0,
  totalCommission: 0,
  rating: 3,
  notes: '',
};

const emptyRecordForm = {
  agentId: '',
  productName: '',
  quantity: 0,
  unit: 'pcs',
  unitPrice: 0,
  distributionDate: new Date().toISOString().split('T')[0],
  notes: '',
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none';
const inputBgClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

// ─── Export Utilities ────────────────────────────────────────────────────────

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportPDF(title: string, headers: string[], rows: string[][]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const tableRows = rows.map(row => `<tr>${row.map(cell => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${cell}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#333}h1{font-size:20px;margin-bottom:5px}.subtitle{color:#666;font-size:12px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th{background:#f8f9fa;padding:8px 10px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #dee2e6}.footer{margin-top:30px;padding-top:15px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center}@media print{body{padding:15px}.no-print{display:none}}</style></head><body><h1>${title}</h1><p class="subtitle">Generated on ${new Date().toLocaleString()}</p><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table><p class="footer">Distribution Report</p><script>window.onload=function(){window.print()}</script></body></html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function DistributionPage() {
  // Data state
  const [agents, setAgents] = useState<DistributionAgent[]>([]);
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<'agents' | 'records'>('agents');

  // Agent form state
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [showAgentDetail, setShowAgentDetail] = useState<DistributionAgent | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentFormData, setAgentFormData] = useState(emptyAgentForm);

  // Record form state
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordFormData, setRecordFormData] = useState(emptyRecordForm);

  // Return quantity modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnRecordId, setReturnRecordId] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState(0);

  // Search, filter, pagination for agents
  const [agentSearch, setAgentSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('All');
  const [agentPage, setAgentPage] = useState(1);

  // Search, filter, pagination for records
  const [recordSearch, setRecordSearch] = useState('');
  const [recordFilter, setRecordFilter] = useState('All');
  const [recordPage, setRecordPage] = useState(1);

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('distribution_agents').select('*').order('created_at', { ascending: false });
    if (data) {
      setAgents(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
        idNumber: (r.id_number || '') as string,
        address: (r.address || '') as string,
        location: (r.location || '') as string,
        gpsLat: (r.gps_lat || 0) as number,
        gpsLng: (r.gps_lng || 0) as number,
        territory: (r.territory || '') as string,
        commissionRate: (r.commission_rate || 0) as number,
        commissionType: (r.commission_type || 'percentage') as DistributionAgent['commissionType'],
        status: (r.status || 'Active') as DistributionAgent['status'],
        joiningDate: (r.joining_date || '') as string,
        vehicleType: (r.vehicle_type || '') as string,
        vehicleRegistration: (r.vehicle_registration || '') as string,
        bankName: (r.bank_name || '') as string,
        bankAccount: (r.bank_account || '') as string,
        totalDistributed: (r.total_distributed || 0) as number,
        totalCommission: (r.total_commission || 0) as number,
        rating: (r.rating || 0) as number,
        notes: (r.notes || '') as string,
      })));
    }
    setLoading(false);
  }, []);

  const fetchRecords = useCallback(async () => {
    const { data } = await supabase.from('distribution_records').select('*').order('created_at', { ascending: false });
    if (data) {
      setRecords(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        agentId: (r.agent_id || '') as string,
        agentName: '', // will be resolved below
        productName: (r.product_name || '') as string,
        quantity: (r.quantity || 0) as number,
        unit: (r.unit || 'pcs') as string,
        unitPrice: (r.unit_price || 0) as number,
        totalAmount: (r.total_amount || 0) as number,
        commissionAmount: (r.commission_amount || 0) as number,
        distributionDate: (r.distribution_date || '') as string,
        status: (r.status || 'Pending') as DistributionRecord['status'],
        returnQuantity: (r.return_quantity || 0) as number,
        notes: (r.notes || '') as string,
      })));
    }
  }, []);

  useEffect(() => { fetchAgents(); fetchRecords(); }, [fetchAgents, fetchRecords]);

  // Resolve agent names for records
  const resolvedRecords: DistributionRecord[] = records.map(rec => {
    const agent = agents.find(a => a.id === rec.agentId);
    return { ...rec, agentName: agent ? agent.name : 'Unknown Agent' };
  });

  // ─── Agent CRUD ──────────────────────────────────────────────────────────

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      name: agentFormData.name,
      phone: agentFormData.phone,
      email: agentFormData.email,
      id_number: agentFormData.idNumber,
      address: agentFormData.address,
      location: agentFormData.location,
      gps_lat: agentFormData.gpsLat || null,
      gps_lng: agentFormData.gpsLng || null,
      territory: agentFormData.territory,
      commission_rate: agentFormData.commissionRate,
      commission_type: agentFormData.commissionType,
      status: agentFormData.status,
      joining_date: agentFormData.joiningDate || null,
      vehicle_type: agentFormData.vehicleType,
      vehicle_registration: agentFormData.vehicleRegistration,
      bank_name: agentFormData.bankName,
      bank_account: agentFormData.bankAccount,
      total_distributed: agentFormData.totalDistributed,
      total_commission: agentFormData.totalCommission,
      rating: agentFormData.rating,
      notes: agentFormData.notes,
    };
    try {
      if (editingAgentId) {
        await supabase.from('distribution_agents').update(row).eq('id', editingAgentId);
        logAudit({
          action: 'UPDATE',
          module: 'Distribution',
          record_id: editingAgentId,
          details: { name: row.name, territory: row.territory, status: row.status },
        });
      } else {
        await supabase.from('distribution_agents').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Distribution',
          record_id: row.name,
          details: { name: row.name, territory: row.territory, status: row.status },
        });
      }
      await fetchAgents();
    } catch { /* fallback */ }
    setEditingAgentId(null);
    setAgentFormData({ ...emptyAgentForm });
    setShowAgentForm(false);
  };

  const handleEditAgent = (agent: DistributionAgent) => {
    setAgentFormData({
      name: agent.name,
      phone: agent.phone,
      email: agent.email,
      idNumber: agent.idNumber,
      address: agent.address,
      location: agent.location,
      gpsLat: agent.gpsLat,
      gpsLng: agent.gpsLng,
      territory: agent.territory,
      commissionRate: agent.commissionRate,
      commissionType: agent.commissionType,
      status: agent.status,
      joiningDate: agent.joiningDate,
      vehicleType: agent.vehicleType,
      vehicleRegistration: agent.vehicleRegistration,
      bankName: agent.bankName,
      bankAccount: agent.bankAccount,
      totalDistributed: agent.totalDistributed,
      totalCommission: agent.totalCommission,
      rating: agent.rating,
      notes: agent.notes,
    });
    setEditingAgentId(agent.id);
    setShowAgentForm(true);
  };

  const handleDeleteAgent = async (id: string) => {
    if (confirm('Delete this distribution agent?')) {
      const agentToDelete = agents.find(a => a.id === id);
      await supabase.from('distribution_agents').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Distribution',
        record_id: id,
        details: { name: agentToDelete?.name, territory: agentToDelete?.territory },
      });
      setAgents(agents.filter(a => a.id !== id));
    }
  };

  // ─── Record CRUD ─────────────────────────────────────────────────────────

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const agent = agents.find(a => a.id === recordFormData.agentId);
    const totalAmount = recordFormData.quantity * recordFormData.unitPrice;
    let commissionAmount = 0;
    if (agent) {
      commissionAmount = agent.commissionType === 'percentage'
        ? totalAmount * (agent.commissionRate / 100)
        : agent.commissionRate;
    }
    const row = {
      agent_id: recordFormData.agentId,
      product_name: recordFormData.productName,
      quantity: recordFormData.quantity,
      unit: recordFormData.unit,
      unit_price: recordFormData.unitPrice,
      total_amount: totalAmount,
      commission_amount: commissionAmount,
      distribution_date: recordFormData.distributionDate || null,
      status: 'Pending',
      return_quantity: 0,
      notes: recordFormData.notes,
    };
    try {
      if (editingRecordId) {
        await supabase.from('distribution_records').update(row).eq('id', editingRecordId);
        logAudit({
          action: 'UPDATE',
          module: 'Distribution',
          record_id: editingRecordId,
          details: { product_name: row.product_name, quantity: row.quantity, total_amount: totalAmount },
        });
      } else {
        await supabase.from('distribution_records').insert(row);
        logAudit({
          action: 'CREATE',
          module: 'Distribution',
          record_id: row.product_name,
          details: { agent_id: row.agent_id, product_name: row.product_name, quantity: row.quantity, total_amount: totalAmount },
        });
        // Update agent totals
        if (agent) {
          await supabase.from('distribution_agents').update({
            total_distributed: (agent.totalDistributed || 0) + totalAmount,
            total_commission: (agent.totalCommission || 0) + commissionAmount,
          }).eq('id', agent.id);
        }
      }
      await fetchRecords();
      await fetchAgents();
    } catch { /* fallback */ }
    setEditingRecordId(null);
    setRecordFormData({ ...emptyRecordForm });
    setShowRecordForm(false);
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Delete this distribution record?')) {
      const recordToDelete = records.find(r => r.id === id);
      await supabase.from('distribution_records').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Distribution',
        record_id: id,
        details: { product_name: recordToDelete?.productName, quantity: recordToDelete?.quantity },
      });
      setRecords(records.filter(r => r.id !== id));
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: DistributionRecord['status']) => {
    if (newStatus === 'Returned') {
      setReturnRecordId(recordId);
      setReturnQty(0);
      setShowReturnModal(true);
      return;
    }
    try {
      await supabase.from('distribution_records').update({ status: newStatus }).eq('id', recordId);
      await fetchRecords();
    } catch { /* fallback */ }
  };

  const handleReturnSubmit = async () => {
    if (!returnRecordId) return;
    try {
      await supabase.from('distribution_records').update({ status: 'Returned', return_quantity: returnQty }).eq('id', returnRecordId);
      await fetchRecords();
    } catch { /* fallback */ }
    setShowReturnModal(false);
    setReturnRecordId(null);
    setReturnQty(0);
  };

  // ─── Filtering & Pagination (Agents) ─────────────────────────────────────

  const filteredAgents = agents.filter(a => {
    const matchSearch = `${a.name} ${a.phone} ${a.territory}`.toLowerCase().includes(agentSearch.toLowerCase());
    const matchFilter = agentFilter === 'All' || a.status === agentFilter;
    return matchSearch && matchFilter;
  });

  const agentTotalPages = Math.max(1, Math.ceil(filteredAgents.length / ITEMS_PER_PAGE));
  const paginatedAgents = filteredAgents.slice((agentPage - 1) * ITEMS_PER_PAGE, agentPage * ITEMS_PER_PAGE);

  useEffect(() => { setAgentPage(1); }, [agentSearch, agentFilter]);

  // ─── Filtering & Pagination (Records) ────────────────────────────────────

  const filteredRecords = resolvedRecords.filter(r => {
    const matchSearch = `${r.agentName} ${r.productName}`.toLowerCase().includes(recordSearch.toLowerCase());
    const matchFilter = recordFilter === 'All' || r.status === recordFilter;
    return matchSearch && matchFilter;
  });

  const recordTotalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice((recordPage - 1) * ITEMS_PER_PAGE, recordPage * ITEMS_PER_PAGE);

  useEffect(() => { setRecordPage(1); }, [recordSearch, recordFilter]);

  // ─── Stats ───────────────────────────────────────────────────────────────

  const totalAgents = agents.length;
  const totalDistributed = agents.reduce((sum, a) => sum + (a.totalDistributed || 0), 0);
  const totalCommission = agents.reduce((sum, a) => sum + (a.totalCommission || 0), 0);
  const activeAgents = agents.filter(a => a.status === 'Active').length;

  // ─── Rating Stars ────────────────────────────────────────────────────────

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-500' : 'text-gray-300'}>*</span>
    ));
  };

  // ─── Export Handlers ─────────────────────────────────────────────────────

  const handleExportAgentsCSV = () => {
    const headers = ['Name', 'Phone', 'Territory', 'Vehicle', 'Commission Rate', 'Total Distributed', 'Rating', 'Status'];
    const rows = filteredAgents.map(a => [
      a.name,
      a.phone,
      a.territory,
      a.vehicleType ? `${a.vehicleType} (${a.vehicleRegistration})` : '',
      a.commissionType === 'percentage' ? `${a.commissionRate}%` : `KES ${a.commissionRate.toLocaleString()}`,
      `KES ${a.totalDistributed.toLocaleString()}`,
      String(a.rating),
      a.status,
    ]);
    exportCSV('distribution_agents', headers, rows);
  };

  const handleExportAgentsPDF = () => {
    const headers = ['Name', 'Phone', 'Territory', 'Vehicle', 'Commission Rate', 'Total Distributed', 'Rating', 'Status'];
    const rows = filteredAgents.map(a => [
      a.name,
      a.phone,
      a.territory,
      a.vehicleType ? `${a.vehicleType} (${a.vehicleRegistration})` : '',
      a.commissionType === 'percentage' ? `${a.commissionRate}%` : `KES ${a.commissionRate.toLocaleString()}`,
      `KES ${a.totalDistributed.toLocaleString()}`,
      String(a.rating),
      a.status,
    ]);
    exportPDF('Distribution Agents Report', headers, rows);
  };

  const handleExportRecordsCSV = () => {
    const headers = ['Date', 'Agent', 'Product', 'Qty', 'Unit Price', 'Total', 'Commission', 'Status'];
    const rows = filteredRecords.map(r => [
      r.distributionDate,
      r.agentName,
      r.productName,
      `${r.quantity} ${r.unit}`,
      `KES ${r.unitPrice.toLocaleString()}`,
      `KES ${r.totalAmount.toLocaleString()}`,
      `KES ${r.commissionAmount.toLocaleString()}`,
      r.status,
    ]);
    exportCSV('distribution_records', headers, rows);
  };

  const handleExportRecordsPDF = () => {
    const headers = ['Date', 'Agent', 'Product', 'Qty', 'Unit Price', 'Total', 'Commission', 'Status'];
    const rows = filteredRecords.map(r => [
      r.distributionDate,
      r.agentName,
      r.productName,
      `${r.quantity} ${r.unit}`,
      `KES ${r.unitPrice.toLocaleString()}`,
      `KES ${r.totalAmount.toLocaleString()}`,
      `KES ${r.commissionAmount.toLocaleString()}`,
      r.status,
    ]);
    exportPDF('Distribution Records Report', headers, rows);
  };

  // ─── Agent Distribution History (for detail modal) ───────────────────────

  const getAgentRecords = (agentId: string): DistributionRecord[] => {
    return resolvedRecords.filter(r => r.agentId === agentId);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold">Distributor Management</h1>
        <p className="text-muted-foreground">Manage distribution agents who sell and distribute baked products on your behalf</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Agents</p>
          <p className="text-2xl font-bold">{totalAgents}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Distributed</p>
          <p className="text-2xl font-bold text-blue-600">KES {totalDistributed.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Commission</p>
          <p className="text-2xl font-bold text-amber-600">KES {totalCommission.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Active Agents</p>
          <p className="text-2xl font-bold text-green-600">{activeAgents}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'agents'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Agents
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'records'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Distribution Records
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── AGENTS TAB ────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'agents' && (
        <div>
          {/* Actions Bar */}
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by name, phone, territory..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-72"
              />
              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportAgentsCSV}
                className="px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportAgentsPDF}
                className="px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
              >
                Export PDF
              </button>
              <button
                onClick={() => { setEditingAgentId(null); setAgentFormData({ ...emptyAgentForm }); setShowAgentForm(true); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                + Add Agent
              </button>
            </div>
          </div>

          {/* Agent Form Modal */}
          <Modal isOpen={showAgentForm} onClose={() => { setShowAgentForm(false); setEditingAgentId(null); }} title={editingAgentId ? 'Edit Distribution Agent' : 'New Distribution Agent'} size="2xl">
            <form onSubmit={handleAgentSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Section: Personal Info */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-medium mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Full Name *</label>
                    <input type="text" value={agentFormData.name} onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Phone *</label>
                    <input type="tel" value={agentFormData.phone} onChange={(e) => setAgentFormData({ ...agentFormData, phone: e.target.value })} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Email</label>
                    <input type="email" value={agentFormData.email} onChange={(e) => setAgentFormData({ ...agentFormData, email: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">ID Number</label>
                    <input type="text" value={agentFormData.idNumber} onChange={(e) => setAgentFormData({ ...agentFormData, idNumber: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Address</label>
                    <input type="text" value={agentFormData.address} onChange={(e) => setAgentFormData({ ...agentFormData, address: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Location</label>
                    <input type="text" value={agentFormData.location} onChange={(e) => setAgentFormData({ ...agentFormData, location: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Section: Distribution Details */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-medium mb-3">Distribution Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Territory</label>
                    <input type="text" value={agentFormData.territory} onChange={(e) => setAgentFormData({ ...agentFormData, territory: e.target.value })} className={inputBgClass} placeholder="e.g. Westlands, Nairobi" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Commission Rate</label>
                    <div className="flex gap-2">
                      <input type="number" step="0.01" min="0" value={agentFormData.commissionRate} onChange={(e) => setAgentFormData({ ...agentFormData, commissionRate: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                      <select value={agentFormData.commissionType} onChange={(e) => setAgentFormData({ ...agentFormData, commissionType: e.target.value as DistributionAgent['commissionType'] })} className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background w-36">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (KES)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Vehicle Type</label>
                    <input type="text" value={agentFormData.vehicleType} onChange={(e) => setAgentFormData({ ...agentFormData, vehicleType: e.target.value })} className={inputBgClass} placeholder="e.g. Motorcycle, Van, Bicycle" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Vehicle Registration</label>
                    <input type="text" value={agentFormData.vehicleRegistration} onChange={(e) => setAgentFormData({ ...agentFormData, vehicleRegistration: e.target.value })} className={inputBgClass} placeholder="e.g. KCA 123X" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Joining Date</label>
                    <input type="date" value={agentFormData.joiningDate} onChange={(e) => setAgentFormData({ ...agentFormData, joiningDate: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
              </div>

              {/* Section: Banking */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-medium mb-3">Banking Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Bank Name</label>
                    <input type="text" value={agentFormData.bankName} onChange={(e) => setAgentFormData({ ...agentFormData, bankName: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Bank Account</label>
                    <input type="text" value={agentFormData.bankAccount} onChange={(e) => setAgentFormData({ ...agentFormData, bankAccount: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
              </div>

              {/* Section: Status */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-medium mb-3">Status &amp; Rating</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Status</label>
                    <select value={agentFormData.status} onChange={(e) => setAgentFormData({ ...agentFormData, status: e.target.value as DistributionAgent['status'] })} className={inputBgClass}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Rating (1-5)</label>
                    <select value={agentFormData.rating} onChange={(e) => setAgentFormData({ ...agentFormData, rating: parseInt(e.target.value) })} className={inputBgClass}>
                      <option value={1}>1 - Poor</option>
                      <option value={2}>2 - Below Average</option>
                      <option value={3}>3 - Average</option>
                      <option value={4}>4 - Good</option>
                      <option value={5}>5 - Excellent</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                  <textarea value={agentFormData.notes} onChange={(e) => setAgentFormData({ ...agentFormData, notes: e.target.value })} className={inputClass} rows={2} />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowAgentForm(false); setEditingAgentId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingAgentId ? 'Update' : 'Create'} Agent</button>
              </div>
            </form>
          </Modal>

          {/* Agent Detail Modal */}
          <Modal isOpen={!!showAgentDetail} onClose={() => setShowAgentDetail(null)} title={showAgentDetail?.name || ''} size="2xl">
            {showAgentDetail && (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        showAgentDetail.status === 'Active' ? 'bg-green-100 text-green-800' :
                        showAgentDetail.status === 'Suspended' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>{showAgentDetail.status}</span>
                      {showAgentDetail.territory && <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">{showAgentDetail.territory}</span>}
                      <span className="text-sm">{renderStars(showAgentDetail.rating)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAgentDetail(null); handleEditAgent(showAgentDetail); }} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium">Edit</button>
                    <button onClick={() => { setShowAgentDetail(null); handleDeleteAgent(showAgentDetail.id); }} className="px-3 py-1.5 text-xs bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium">Delete</button>
                  </div>
                </div>

                {/* Personal Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-2">{showAgentDetail.phone}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-2">{showAgentDetail.email || '---'}</span></div>
                    <div><span className="text-muted-foreground">ID Number:</span> <span className="font-medium ml-2">{showAgentDetail.idNumber || '---'}</span></div>
                    <div><span className="text-muted-foreground">Location:</span> <span className="font-medium ml-2">{showAgentDetail.location || '---'}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-2">{showAgentDetail.address || '---'}</span></div>
                  </div>
                </div>

                {/* Distribution Details */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Distribution Details</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><span className="text-muted-foreground">Territory:</span> <span className="font-medium ml-2">{showAgentDetail.territory || '---'}</span></div>
                    <div><span className="text-muted-foreground">Commission:</span> <span className="font-medium ml-2">{showAgentDetail.commissionType === 'percentage' ? `${showAgentDetail.commissionRate}%` : `KES ${showAgentDetail.commissionRate.toLocaleString()}`}</span></div>
                    <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium ml-2">{showAgentDetail.vehicleType ? `${showAgentDetail.vehicleType} (${showAgentDetail.vehicleRegistration})` : '---'}</span></div>
                    <div><span className="text-muted-foreground">Joining Date:</span> <span className="font-medium ml-2">{showAgentDetail.joiningDate || '---'}</span></div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Financial Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Distributed</p>
                      <p className="text-lg font-bold">KES {showAgentDetail.totalDistributed.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Commission Earned</p>
                      <p className="text-lg font-bold">KES {showAgentDetail.totalCommission.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Banking */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Banking Details</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium ml-2">{showAgentDetail.bankName || '---'}</span></div>
                    <div><span className="text-muted-foreground">Account:</span> <span className="font-medium ml-2">{showAgentDetail.bankAccount || '---'}</span></div>
                  </div>
                </div>

                {/* Distribution History */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Recent Distribution History</h4>
                  {(() => {
                    const agentRecs = getAgentRecords(showAgentDetail.id);
                    if (agentRecs.length === 0) {
                      return <p className="text-sm text-muted-foreground">No distribution records found for this agent.</p>;
                    }
                    return (
                      <div className="border border-border rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary border-b border-border">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-xs">Date</th>
                              <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                              <th className="px-3 py-2 text-right font-semibold text-xs">Qty</th>
                              <th className="px-3 py-2 text-right font-semibold text-xs">Total</th>
                              <th className="px-3 py-2 text-left font-semibold text-xs">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agentRecs.slice(0, 10).map(rec => (
                              <tr key={rec.id} className="border-b border-border">
                                <td className="px-3 py-2 text-xs">{rec.distributionDate}</td>
                                <td className="px-3 py-2 text-xs">{rec.productName}</td>
                                <td className="px-3 py-2 text-xs text-right">{rec.quantity} {rec.unit}</td>
                                <td className="px-3 py-2 text-xs text-right">KES {rec.totalAmount.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                    rec.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                    rec.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                                    rec.status === 'Returned' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>{rec.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Notes */}
                {showAgentDetail.notes && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{showAgentDetail.notes}</p>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Agents Table */}
          {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Territory</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Commission Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Distributed</th>
                  <th className="px-4 py-3 text-center font-semibold">Rating</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAgents.length === 0 && !loading ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No distribution agents found</td></tr>
                ) : (
                  paginatedAgents.map((agent) => (
                    <tr key={agent.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium">{agent.name}</td>
                      <td className="px-4 py-3 text-sm">{agent.phone}</td>
                      <td className="px-4 py-3 text-sm">{agent.territory || '---'}</td>
                      <td className="px-4 py-3 text-sm">{agent.vehicleType ? `${agent.vehicleType}` : '---'}</td>
                      <td className="px-4 py-3 text-sm">
                        {agent.commissionType === 'percentage'
                          ? `${agent.commissionRate}%`
                          : `KES ${agent.commissionRate.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">KES {agent.totalDistributed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center text-sm">{renderStars(agent.rating)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          agent.status === 'Active' ? 'bg-green-100 text-green-800' :
                          agent.status === 'Suspended' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>{agent.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setShowAgentDetail(agent)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                          <button onClick={() => handleEditAgent(agent)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                          <button onClick={() => handleDeleteAgent(agent.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Agent Pagination */}
          {filteredAgents.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((agentPage - 1) * ITEMS_PER_PAGE) + 1}--{Math.min(agentPage * ITEMS_PER_PAGE, filteredAgents.length)} of {filteredAgents.length} agents
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setAgentPage(p => Math.max(1, p - 1))}
                  disabled={agentPage === 1}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: agentTotalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setAgentPage(page)}
                    className={`px-3 py-1.5 text-sm border rounded-lg font-medium ${
                      page === agentPage
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setAgentPage(p => Math.min(agentTotalPages, p + 1))}
                  disabled={agentPage === agentTotalPages}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── DISTRIBUTION RECORDS TAB ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <div>
          {/* Actions Bar */}
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by agent, product..."
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
              />
              <select
                value={recordFilter}
                onChange={(e) => setRecordFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Delivered">Delivered</option>
                <option value="Returned">Returned</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportRecordsCSV}
                className="px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportRecordsPDF}
                className="px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
              >
                Export PDF
              </button>
              <button
                onClick={() => { setEditingRecordId(null); setRecordFormData({ ...emptyRecordForm }); setShowRecordForm(true); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                + New Distribution
              </button>
            </div>
          </div>

          {/* Record Form Modal */}
          <Modal isOpen={showRecordForm} onClose={() => { setShowRecordForm(false); setEditingRecordId(null); }} title={editingRecordId ? 'Edit Distribution Record' : 'New Distribution Record'} size="lg">
            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Agent *</label>
                <select value={recordFormData.agentId} onChange={(e) => setRecordFormData({ ...recordFormData, agentId: e.target.value })} className={inputBgClass} required>
                  <option value="">Select Agent</option>
                  {agents.filter(a => a.status === 'Active').map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.territory || 'No territory'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Product Name *</label>
                  <input type="text" value={recordFormData.productName} onChange={(e) => setRecordFormData({ ...recordFormData, productName: e.target.value })} className={inputClass} required placeholder="e.g. White Bread 400g" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                  <select value={recordFormData.unit} onChange={(e) => setRecordFormData({ ...recordFormData, unit: e.target.value })} className={inputBgClass}>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilograms</option>
                    <option value="loaves">Loaves</option>
                    <option value="packs">Packs</option>
                    <option value="crates">Crates</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Quantity *</label>
                  <input type="number" min="1" value={recordFormData.quantity} onChange={(e) => setRecordFormData({ ...recordFormData, quantity: parseInt(e.target.value) || 0 })} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unit Price (KES) *</label>
                  <input type="number" step="0.01" min="0" value={recordFormData.unitPrice} onChange={(e) => setRecordFormData({ ...recordFormData, unitPrice: parseFloat(e.target.value) || 0 })} className={inputClass} required />
                </div>
              </div>

              {/* Auto-calculated preview */}
              {recordFormData.quantity > 0 && recordFormData.unitPrice > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-bold ml-2">KES {(recordFormData.quantity * recordFormData.unitPrice).toLocaleString()}</span></div>
                    <div>
                      <span className="text-muted-foreground">Commission:</span>
                      <span className="font-bold ml-2">
                        {(() => {
                          const agent = agents.find(a => a.id === recordFormData.agentId);
                          if (!agent) return 'Select agent first';
                          const total = recordFormData.quantity * recordFormData.unitPrice;
                          const comm = agent.commissionType === 'percentage'
                            ? total * (agent.commissionRate / 100)
                            : agent.commissionRate;
                          return `KES ${comm.toLocaleString()} (${agent.commissionType === 'percentage' ? `${agent.commissionRate}%` : 'Fixed'})`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Distribution Date</label>
                <input type="date" value={recordFormData.distributionDate} onChange={(e) => setRecordFormData({ ...recordFormData, distributionDate: e.target.value })} className={inputBgClass} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <textarea value={recordFormData.notes} onChange={(e) => setRecordFormData({ ...recordFormData, notes: e.target.value })} className={inputClass} rows={2} />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowRecordForm(false); setEditingRecordId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingRecordId ? 'Update' : 'Create'} Record</button>
              </div>
            </form>
          </Modal>

          {/* Return Quantity Modal */}
          <Modal isOpen={showReturnModal} onClose={() => { setShowReturnModal(false); setReturnRecordId(null); }} title="Record Return Quantity" size="sm">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the quantity that was returned by the distribution agent.</p>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Return Quantity *</label>
                <input type="number" min="0" value={returnQty} onChange={(e) => setReturnQty(parseInt(e.target.value) || 0)} className={inputClass} required />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowReturnModal(false); setReturnRecordId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="button" onClick={handleReturnSubmit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">Confirm Return</button>
              </div>
            </div>
          </Modal>

          {/* Records Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Agent</th>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Commission</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No distribution records found</td></tr>
                ) : (
                  paginatedRecords.map((rec) => (
                    <tr key={rec.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-4 py-3 text-sm">{rec.distributionDate}</td>
                      <td className="px-4 py-3 font-medium">{rec.agentName}</td>
                      <td className="px-4 py-3 text-sm">{rec.productName}</td>
                      <td className="px-4 py-3 text-sm text-right">{rec.quantity} {rec.unit}</td>
                      <td className="px-4 py-3 text-sm text-right">KES {rec.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">KES {rec.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right">KES {rec.commissionAmount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          rec.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                          rec.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                          rec.status === 'Returned' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>{rec.status}{rec.status === 'Returned' && rec.returnQuantity > 0 ? ` (${rec.returnQuantity})` : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {rec.status === 'Pending' && (
                            <button onClick={() => handleStatusChange(rec.id, 'Dispatched')} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Dispatch</button>
                          )}
                          {rec.status === 'Dispatched' && (
                            <>
                              <button onClick={() => handleStatusChange(rec.id, 'Delivered')} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium">Delivered</button>
                              <button onClick={() => handleStatusChange(rec.id, 'Returned')} className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 font-medium">Return</button>
                            </>
                          )}
                          <button onClick={() => handleDeleteRecord(rec.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Record Pagination */}
          {filteredRecords.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((recordPage - 1) * ITEMS_PER_PAGE) + 1}--{Math.min(recordPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length} records
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setRecordPage(p => Math.max(1, p - 1))}
                  disabled={recordPage === 1}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: recordTotalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setRecordPage(page)}
                    className={`px-3 py-1.5 text-sm border rounded-lg font-medium ${
                      page === recordPage
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setRecordPage(p => Math.min(recordTotalPages, p + 1))}
                  disabled={recordPage === recordTotalPages}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
