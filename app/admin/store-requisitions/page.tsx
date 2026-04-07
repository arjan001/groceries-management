'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { useUserPermissions } from '@/lib/user-permissions';
import { ClipboardList, Plus, Search, CheckCircle, XCircle, Package, Clock, AlertTriangle, Truck } from 'lucide-react';

interface StoreRequisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  requestedById: string;
  department: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Issued' | 'Partially Issued';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  approvedBy: string;
  approvedAt: string;
  issuedBy: string;
  issuedAt: string;
  notes: string;
  createdAt: string;
  items: RequisitionItem[];
}

interface RequisitionItem {
  id: string;
  requisitionId: string;
  inventoryItemId: string;
  itemName: string;
  quantityRequested: number;
  quantityApproved: number;
  quantityIssued: number;
  unit: string;
  notes: string;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

function generateReqNumber(): string {
  const prefix = 'SRQ';
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

export default function StoreRequisitionsPage() {
  const { fullName, isAdmin, role } = useUserPermissions();
  const [requisitions, setRequisitions] = useState<StoreRequisition[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<StoreRequisition | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<StoreRequisition | null>(null);
  const [showIssueModal, setShowIssueModal] = useState<StoreRequisition | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Form state
  const [formItems, setFormItems] = useState<{ inventoryItemId: string; itemName: string; quantityRequested: number; unit: string; notes: string }[]>([
    { inventoryItemId: '', itemName: '', quantityRequested: 0, unit: 'kg', notes: '' },
  ]);
  const [formData, setFormData] = useState({
    department: 'Production',
    priority: 'Normal' as StoreRequisition['priority'],
    notes: '',
  });

  // Approve modal state
  const [approveItems, setApproveItems] = useState<{ id: string; itemName: string; quantityRequested: number; quantityApproved: number }[]>([]);

  // Issue modal state
  const [issueItems, setIssueItems] = useState<{ id: string; itemName: string; inventoryItemId: string; quantityApproved: number; quantityIssued: number; unit: string }[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: reqData } = await supabase
        .from('store_requisitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqData && reqData.length > 0) {
        const reqIds = reqData.map((r: Record<string, unknown>) => r.id as string);
        const { data: itemsData } = await supabase
          .from('store_requisition_items')
          .select('*')
          .in('requisition_id', reqIds);

        const itemsByReq: Record<string, RequisitionItem[]> = {};
        if (itemsData) {
          for (const r of itemsData) {
            const rec = r as Record<string, unknown>;
            const reqId = (rec.requisition_id || '') as string;
            if (!itemsByReq[reqId]) itemsByReq[reqId] = [];
            itemsByReq[reqId].push({
              id: rec.id as string,
              requisitionId: reqId,
              inventoryItemId: (rec.inventory_item_id || '') as string,
              itemName: (rec.item_name || '') as string,
              quantityRequested: (rec.quantity_requested || 0) as number,
              quantityApproved: (rec.quantity_approved || 0) as number,
              quantityIssued: (rec.quantity_issued || 0) as number,
              unit: (rec.unit || 'kg') as string,
              notes: (rec.notes || '') as string,
            });
          }
        }

        setRequisitions(reqData.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          requisitionNumber: (r.requisition_number || '') as string,
          requestedBy: (r.requested_by || '') as string,
          requestedById: (r.requested_by_id || '') as string,
          department: (r.department || 'Production') as string,
          status: (r.status || 'Pending') as StoreRequisition['status'],
          priority: (r.priority || 'Normal') as StoreRequisition['priority'],
          approvedBy: (r.approved_by || '') as string,
          approvedAt: (r.approved_at || '') as string,
          issuedBy: (r.issued_by || '') as string,
          issuedAt: (r.issued_at || '') as string,
          notes: (r.notes || '') as string,
          createdAt: (r.created_at || '') as string,
          items: itemsByReq[r.id as string] || [],
        })));
      } else {
        setRequisitions([]);
      }
    } catch {
      setRequisitions([]);
    }
    setLoading(false);
  }, []);

  const fetchInventory = useCallback(async () => {
    const { data } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, unit, category')
      .eq('type', 'Consumable')
      .order('name');
    if (data) {
      setInventoryItems(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        quantity: (r.quantity || 0) as number,
        unit: (r.unit || 'kg') as string,
        category: (r.category || '') as string,
      })));
    }
  }, []);

  useEffect(() => { fetchRequisitions(); fetchInventory(); }, [fetchRequisitions, fetchInventory]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

  // Create requisition
  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = formItems.filter(i => i.itemName.trim() && i.quantityRequested > 0);
    if (validItems.length === 0) {
      showToast('Add at least one item with quantity', 'error');
      return;
    }

    setSaving(true);
    try {
      const reqNumber = generateReqNumber();
      const { data: reqData, error: reqError } = await supabase.from('store_requisitions').insert({
        requisition_number: reqNumber,
        requested_by: fullName || 'Unknown',
        department: formData.department,
        status: 'Pending',
        priority: formData.priority,
        notes: formData.notes,
      }).select().single();

      if (reqError) throw reqError;

      const reqId = (reqData as Record<string, unknown>).id as string;

      // Insert items
      const itemRows = validItems.map(item => ({
        requisition_id: reqId,
        inventory_item_id: item.inventoryItemId || null,
        item_name: item.itemName,
        quantity_requested: item.quantityRequested,
        quantity_approved: 0,
        quantity_issued: 0,
        unit: item.unit,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase.from('store_requisition_items').insert(itemRows);
      if (itemsError) throw itemsError;

      logAudit({
        action: 'CREATE',
        module: 'Store Requisition',
        record_id: reqId,
        details: { requisition_number: reqNumber, requested_by: fullName, items_count: validItems.length, priority: formData.priority },
      });

      showToast('Requisition submitted successfully', 'success');
      await fetchRequisitions();
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to create requisition: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Approve requisition
  const handleApprove = async () => {
    if (!showApproveModal) return;
    setSaving(true);
    try {
      // Update each item's approved quantity
      for (const item of approveItems) {
        await supabase.from('store_requisition_items').update({
          quantity_approved: item.quantityApproved,
        }).eq('id', item.id);
      }

      await supabase.from('store_requisitions').update({
        status: 'Approved',
        approved_by: fullName || 'Admin',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', showApproveModal.id);

      logAudit({
        action: 'UPDATE',
        module: 'Store Requisition',
        record_id: showApproveModal.id,
        details: { action: 'Approved', approved_by: fullName, requisition_number: showApproveModal.requisitionNumber },
      });

      showToast('Requisition approved', 'success');
      await fetchRequisitions();
      setShowApproveModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to approve: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reject requisition
  const handleReject = async (req: StoreRequisition) => {
    if (!confirm('Reject this requisition?')) return;
    try {
      await supabase.from('store_requisitions').update({
        status: 'Rejected',
        approved_by: fullName || 'Admin',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', req.id);

      logAudit({
        action: 'UPDATE',
        module: 'Store Requisition',
        record_id: req.id,
        details: { action: 'Rejected', rejected_by: fullName },
      });

      showToast('Requisition rejected', 'success');
      await fetchRequisitions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to reject: ${msg}`, 'error');
    }
  };

  // Issue items (deduct from inventory)
  const handleIssue = async () => {
    if (!showIssueModal) return;
    setSaving(true);
    try {
      let allIssued = true;

      for (const item of issueItems) {
        if (item.quantityIssued <= 0) {
          allIssued = false;
          continue;
        }

        // Update the item's issued quantity
        await supabase.from('store_requisition_items').update({
          quantity_issued: item.quantityIssued,
        }).eq('id', item.id);

        // Deduct from inventory
        if (item.inventoryItemId) {
          const { data: invItem } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', item.inventoryItemId)
            .single();

          if (invItem) {
            const currentQty = (invItem as Record<string, unknown>).quantity as number;
            const newQty = Math.max(0, currentQty - item.quantityIssued);
            await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', item.inventoryItemId);

            // Record transaction
            await supabase.from('inventory_transactions').insert({
              item_id: item.inventoryItemId,
              type: 'Output',
              quantity: item.quantityIssued,
              reference: `Store Requisition ${showIssueModal.requisitionNumber}`,
              notes: `Issued to ${showIssueModal.requestedBy} (${showIssueModal.department})`,
              performed_by: fullName || 'Store',
            });
          }
        }

        if (item.quantityIssued < item.quantityApproved) {
          allIssued = false;
        }
      }

      const newStatus = allIssued ? 'Issued' : 'Partially Issued';
      await supabase.from('store_requisitions').update({
        status: newStatus,
        issued_by: fullName || 'Store',
        issued_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', showIssueModal.id);

      logAudit({
        action: 'UPDATE',
        module: 'Store Requisition',
        record_id: showIssueModal.id,
        details: { action: 'Issued', issued_by: fullName, status: newStatus, requisition_number: showIssueModal.requisitionNumber },
      });

      showToast(`Items issued. Inventory updated automatically.`, 'success');
      await Promise.all([fetchRequisitions(), fetchInventory()]);
      setShowIssueModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to issue items: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormItems([{ inventoryItemId: '', itemName: '', quantityRequested: 0, unit: 'kg', notes: '' }]);
    setFormData({ department: 'Production', priority: 'Normal', notes: '' });
  };

  const addFormItem = () => {
    setFormItems([...formItems, { inventoryItemId: '', itemName: '', quantityRequested: 0, unit: 'kg', notes: '' }]);
  };

  const removeFormItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const updateFormItem = (idx: number, field: string, value: string | number) => {
    setFormItems(formItems.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      // Auto-fill name and unit from inventory selection
      if (field === 'inventoryItemId' && value) {
        const invItem = inventoryItems.find(inv => inv.id === value);
        if (invItem) {
          updated.itemName = invItem.name;
          updated.unit = invItem.unit;
        }
      }
      return updated;
    }));
  };

  const openApproveModal = (req: StoreRequisition) => {
    setApproveItems(req.items.map(item => ({
      id: item.id,
      itemName: item.itemName,
      quantityRequested: item.quantityRequested,
      quantityApproved: item.quantityRequested, // Default to full approval
    })));
    setShowApproveModal(req);
  };

  const openIssueModal = (req: StoreRequisition) => {
    setIssueItems(req.items.map(item => ({
      id: item.id,
      itemName: item.itemName,
      inventoryItemId: item.inventoryItemId,
      quantityApproved: item.quantityApproved,
      quantityIssued: item.quantityApproved, // Default to full issue
      unit: item.unit,
    })));
    setShowIssueModal(req);
  };

  // Filters
  const filtered = requisitions.filter(r => {
    const matchSearch = `${r.requisitionNumber} ${r.requestedBy} ${r.department}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Stats
  const pendingCount = requisitions.filter(r => r.status === 'Pending').length;
  const approvedCount = requisitions.filter(r => r.status === 'Approved').length;
  const issuedCount = requisitions.filter(r => r.status === 'Issued' || r.status === 'Partially Issued').length;

  const getStatusBadge = (s: StoreRequisition['status']) => {
    switch (s) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-blue-100 text-blue-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Issued': return 'bg-green-100 text-green-800';
      case 'Partially Issued': return 'bg-purple-100 text-purple-800';
    }
  };

  const getPriorityBadge = (p: StoreRequisition['priority']) => {
    switch (p) {
      case 'Urgent': return 'bg-red-600 text-white';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Normal': return 'bg-gray-100 text-gray-800';
      case 'Low': return 'bg-gray-50 text-gray-500';
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const canApprove = isAdmin || role === 'Manager' || role === 'Administrator';

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2">Store Requisitions</h1>
        <p className="text-muted-foreground">Request ingredients from the store. Once approved and issued, inventory updates automatically.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Issued</p>
              <p className="text-2xl font-bold text-green-600">{issuedCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{requisitions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search requisitions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Issued">Issued</option>
            <option value="Partially Issued">Partially Issued</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">
          <Plus className="w-4 h-4" /> New Requisition
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading requisitions...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Req #</th>
                <th className="px-4 py-3 text-left font-semibold">Requested By</th>
                <th className="px-4 py-3 text-left font-semibold">Department</th>
                <th className="px-4 py-3 text-center font-semibold">Items</th>
                <th className="px-4 py-3 text-center font-semibold">Priority</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No requisitions found</td></tr>
              ) : paginated.map(req => (
                <tr key={req.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${req.priority === 'Urgent' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{req.requisitionNumber}</td>
                  <td className="px-4 py-3 font-medium">{req.requestedBy}</td>
                  <td className="px-4 py-3 text-muted-foreground">{req.department}</td>
                  <td className="px-4 py-3 text-center">{req.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-semibold ${getPriorityBadge(req.priority)}`}>{req.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-semibold ${getStatusBadge(req.status)}`}>{req.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(req.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setShowDetail(req)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                      {req.status === 'Pending' && canApprove && (
                        <>
                          <button onClick={() => openApproveModal(req)} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium">Approve</button>
                          <button onClick={() => handleReject(req)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Reject</button>
                        </>
                      )}
                      {req.status === 'Approved' && canApprove && (
                        <button onClick={() => openIssueModal(req)} className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200 font-medium">Issue</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length}</p>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${page === currentPage ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}>{page}</button>
            ))}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {/* Create Requisition Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Request Ingredients from Store" size="3xl">
        <form onSubmit={handleCreateRequisition} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-800 font-medium">Select ingredients you need from the store. This request will be sent for approval. Once approved and issued, the store inventory will be deducted automatically.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Department</label>
              <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background">
                <option>Production</option>
                <option>Kitchen</option>
                <option>Packaging</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Priority</label>
              <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as StoreRequisition['priority'] })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background">
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Items Requested</p>
              <button type="button" onClick={addFormItem} className="text-xs text-primary hover:text-primary/80 font-medium">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {formItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Ingredient (from inventory)</label>}
                    <select
                      value={item.inventoryItemId}
                      onChange={(e) => updateFormItem(idx, 'inventoryItemId', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    >
                      <option value="">Select ingredient...</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} — {inv.quantity} {inv.unit} available
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Quantity</label>}
                    <input type="number" min={0} step="0.1" value={item.quantityRequested || ''} onChange={(e) => updateFormItem(idx, 'quantityRequested', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Unit</label>}
                    <input type="text" value={item.unit} readOnly className="w-full px-3 py-2 border border-border rounded-lg outline-none bg-muted text-sm" />
                  </div>
                  <div className="col-span-2 flex justify-center gap-1">
                    {formItems.length > 1 && (
                      <button type="button" onClick={() => removeFormItem(idx)} className="px-2 py-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded">X</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. Needed for morning batch production" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">{saving ? 'Submitting...' : 'Submit Requisition'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail ? `Requisition ${showDetail.requisitionNumber}` : ''} size="3xl">
        {showDetail && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getStatusBadge(showDetail.status)}`}>{showDetail.status}</span>
              <span className={`px-2 py-1 text-xs rounded font-semibold ${getPriorityBadge(showDetail.priority)}`}>{showDetail.priority}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border border-border rounded-lg p-4">
              <div><span className="text-muted-foreground">Requested By:</span> <strong className="ml-2">{showDetail.requestedBy}</strong></div>
              <div><span className="text-muted-foreground">Department:</span> <strong className="ml-2">{showDetail.department}</strong></div>
              <div><span className="text-muted-foreground">Created:</span> <strong className="ml-2">{formatDateTime(showDetail.createdAt)}</strong></div>
              {showDetail.approvedBy && <div><span className="text-muted-foreground">Approved By:</span> <strong className="ml-2">{showDetail.approvedBy}</strong> <span className="text-xs text-muted-foreground">({formatDateTime(showDetail.approvedAt)})</span></div>}
              {showDetail.issuedBy && <div><span className="text-muted-foreground">Issued By:</span> <strong className="ml-2">{showDetail.issuedBy}</strong> <span className="text-xs text-muted-foreground">({formatDateTime(showDetail.issuedAt)})</span></div>}
            </div>

            <div className="border border-border rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">Items</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="text-left py-2 text-muted-foreground font-medium">#</th><th className="text-left py-2 text-muted-foreground font-medium">Item</th><th className="text-right py-2 text-muted-foreground font-medium">Requested</th><th className="text-right py-2 text-muted-foreground font-medium">Approved</th><th className="text-right py-2 text-muted-foreground font-medium">Issued</th><th className="text-left py-2 text-muted-foreground font-medium pl-3">Unit</th></tr></thead>
                <tbody>
                  {showDetail.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 font-medium">{item.itemName}</td>
                      <td className="py-2 text-right">{item.quantityRequested}</td>
                      <td className="py-2 text-right text-blue-700 font-medium">{item.quantityApproved || '—'}</td>
                      <td className="py-2 text-right text-green-700 font-medium">{item.quantityIssued || '—'}</td>
                      <td className="py-2 pl-3 text-muted-foreground">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {showDetail.notes && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">Notes</p>
                <p className="text-sm text-muted-foreground">{showDetail.notes}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {showDetail.status === 'Pending' && canApprove && (
                <>
                  <button onClick={() => { setShowDetail(null); openApproveModal(showDetail); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Approve</button>
                  <button onClick={() => { setShowDetail(null); handleReject(showDetail); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm">Reject</button>
                </>
              )}
              {showDetail.status === 'Approved' && canApprove && (
                <button onClick={() => { setShowDetail(null); openIssueModal(showDetail); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm">Issue Items</button>
              )}
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal isOpen={!!showApproveModal} onClose={() => setShowApproveModal(null)} title={`Approve: ${showApproveModal?.requisitionNumber || ''}`} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Review and adjust quantities to approve for each item.</p>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary"><tr><th className="px-4 py-2 text-left font-semibold">Item</th><th className="px-4 py-2 text-right font-semibold">Requested</th><th className="px-4 py-2 text-right font-semibold">Approve</th></tr></thead>
              <tbody>
                {approveItems.map((item, idx) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-4 py-2 font-medium">{item.itemName}</td>
                    <td className="px-4 py-2 text-right">{item.quantityRequested}</td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={0} step="0.1" value={item.quantityApproved} onChange={(e) => { const updated = [...approveItems]; updated[idx].quantityApproved = parseFloat(e.target.value) || 0; setApproveItems(updated); }} className="w-24 px-2 py-1 border border-border rounded text-right text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button onClick={() => setShowApproveModal(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button onClick={handleApprove} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">{saving ? 'Approving...' : 'Approve Requisition'}</button>
          </div>
        </div>
      </Modal>

      {/* Issue Modal */}
      <Modal isOpen={!!showIssueModal} onClose={() => setShowIssueModal(null)} title={`Issue Items: ${showIssueModal?.requisitionNumber || ''}`} size="lg">
        <div className="space-y-4">
          <div className="border border-green-200 bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-800 font-medium">Issuing items will automatically deduct the quantities from store inventory. Verify quantities before proceeding.</p>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary"><tr><th className="px-4 py-2 text-left font-semibold">Item</th><th className="px-4 py-2 text-right font-semibold">Approved</th><th className="px-4 py-2 text-right font-semibold">Issue Qty</th><th className="px-4 py-2 text-left font-semibold pl-3">Unit</th></tr></thead>
              <tbody>
                {issueItems.map((item, idx) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="px-4 py-2 font-medium">{item.itemName}</td>
                    <td className="px-4 py-2 text-right">{item.quantityApproved}</td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" min={0} step="0.1" value={item.quantityIssued} onChange={(e) => { const updated = [...issueItems]; updated[idx].quantityIssued = parseFloat(e.target.value) || 0; setIssueItems(updated); }} className="w-24 px-2 py-1 border border-border rounded text-right text-sm" />
                    </td>
                    <td className="px-4 py-2 pl-3 text-muted-foreground">{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button onClick={() => setShowIssueModal(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button onClick={handleIssue} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">{saving ? 'Issuing...' : 'Issue & Deduct Inventory'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
