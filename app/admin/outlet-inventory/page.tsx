'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  ArrowUpDown,
  AlertTriangle,
  Store,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  X,
  RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
}

interface OutletInventoryItem {
  id: string;
  outlet_id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  selling_price: number;
  reorder_level: number;
  supplier: string;
  source: 'main_branch' | 'external' | 'self';
  last_restocked: string;
  status: 'Active' | 'Inactive';
  notes: string;
  created_at: string;
  updated_at: string;
}

interface OutletInventoryTransaction {
  id: string;
  outlet_id: string;
  item_id: string;
  type: 'intake' | 'output' | 'adjustment' | 'requisition_received' | 'sale' | 'waste';
  quantity: number;
  reference: string;
  notes: string;
  performed_by: string;
  created_at: string;
}

type SortField = 'item_name' | 'category' | 'quantity' | 'unit_cost' | 'selling_price' | 'source' | 'status' | 'last_restocked';
type SortDirection = 'asc' | 'desc';

const CATEGORIES = ['Baked Goods', 'Beverages', 'Pastries', 'Snacks', 'Supplies', 'General'] as const;
const UNITS = ['pieces', 'kg', 'liters', 'boxes', 'packets'] as const;
const SOURCES = ['main_branch', 'external', 'self'] as const;
const STATUSES = ['Active', 'Inactive'] as const;
const TRANSACTION_TYPES = ['intake', 'output', 'adjustment', 'requisition_received', 'sale', 'waste'] as const;

const SOURCE_LABELS: Record<string, string> = {
  main_branch: 'Main Branch',
  external: 'External',
  self: 'Self',
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  intake: 'Intake',
  output: 'Output',
  adjustment: 'Adjustment',
  requisition_received: 'Requisition Received',
  sale: 'Sale',
  waste: 'Waste',
};

const ITEMS_PER_PAGE = 10;

// ─── Default Form Data ──────────────────────────────────────────────────────

const defaultFormData = {
  item_name: '',
  category: 'General' as string,
  quantity: 0,
  unit: 'pieces' as string,
  unit_cost: 0,
  selling_price: 0,
  reorder_level: 0,
  supplier: '',
  source: 'main_branch' as 'main_branch' | 'external' | 'self',
  last_restocked: new Date().toISOString().split('T')[0],
  status: 'Active' as 'Active' | 'Inactive',
  notes: '',
};

const defaultStockAdjustment = {
  type: 'intake' as typeof TRANSACTION_TYPES[number],
  quantity: 0,
  reference: '',
  notes: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OutletInventoryPage() {
  // ─── Core State ─────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [inventory, setInventory] = useState<OutletInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<OutletInventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Search, Filter, Sort ──────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSource, setFilterSource] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('item_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Selection ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Modals ─────────────────────────────────────────────────────────────────
  const [showItemModal, setShowItemModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showStockModal, setShowStockModal] = useState<string | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...defaultFormData });
  const [stockAdjustment, setStockAdjustment] = useState({ ...defaultStockAdjustment });

  // ─── Data Fetching ─────────────────────────────────────────────────────────

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
        showToast('Failed to load outlets: ' + error.message, 'error');
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
      showToast('Failed to load outlets: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!selectedOutletId) {
      setInventory([]);
      return;
    }

    setLoadingInventory(true);
    try {
      const { data, error } = await supabase
        .from('outlet_inventory')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });

      if (error) {
        showToast('Failed to load inventory: ' + error.message, 'error');
        return;
      }

      const items = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        item_name: (r.item_name || '') as string,
        category: (r.category || 'General') as string,
        quantity: Number(r.quantity) || 0,
        unit: (r.unit || 'pieces') as string,
        unit_cost: Number(r.unit_cost) || 0,
        selling_price: Number(r.selling_price) || 0,
        reorder_level: Number(r.reorder_level) || 0,
        supplier: (r.supplier || '') as string,
        source: (r.source || 'main_branch') as 'main_branch' | 'external' | 'self',
        last_restocked: (r.last_restocked || '') as string,
        status: (r.status || 'Active') as 'Active' | 'Inactive',
        notes: (r.notes || '') as string,
        created_at: (r.created_at || '') as string,
        updated_at: (r.updated_at || '') as string,
      }));

      setInventory(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load inventory: ' + msg, 'error');
    } finally {
      setLoadingInventory(false);
    }
  }, [selectedOutletId]);

  const fetchTransactionsForItem = useCallback(async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('outlet_inventory_transactions')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        showToast('Failed to load transactions: ' + error.message, 'error');
        return;
      }

      const txns = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        item_id: (r.item_id || '') as string,
        type: (r.type || 'intake') as OutletInventoryTransaction['type'],
        quantity: Number(r.quantity) || 0,
        reference: (r.reference || '') as string,
        notes: (r.notes || '') as string,
        performed_by: (r.performed_by || '') as string,
        created_at: (r.created_at || '') as string,
      }));

      setTransactions(txns);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load transactions: ' + msg, 'error');
    }
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────────

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
      fetchInventory();
      setCurrentPage(1);
      setSelectedIds(new Set());
      setSearchTerm('');
      setFilterCategory('All');
      setFilterSource('All');
    }
  }, [selectedOutletId, fetchInventory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterSource]);

  // ─── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-primary" />
    ) : (
      <ArrowDown size={14} className="text-primary" />
    );
  };

  // ─── Filtering, Sorting, Pagination ────────────────────────────────────────

  const filteredInventory = inventory
    .filter(item => {
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      const matchesSource = filterSource === 'All' || item.source === filterSource;
      if (!matchesCategory || !matchesSource) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.item_name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.supplier.toLowerCase().includes(term) ||
        item.notes.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * dir;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      return String(valA || '').localeCompare(String(valB || '')) * dir;
    });

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / ITEMS_PER_PAGE));
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(i => i.reorder_level > 0 && i.quantity <= i.reorder_level);
  const lowStockCount = lowStockItems.length;
  const totalValue = inventory.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const mainBranchItemCount = inventory.filter(i => i.source === 'main_branch').length;

  // ─── Selection Logic ──────────────────────────────────────────────────────

  const allPageSelected = paginatedInventory.length > 0 && paginatedInventory.every(item => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedInventory.forEach(item => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedInventory.forEach(item => next.add(item.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Form Helpers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({ ...defaultFormData });
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowItemModal(true);
  };

  const openEditModal = (item: OutletInventoryItem) => {
    setFormData({
      item_name: item.item_name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      selling_price: item.selling_price,
      reorder_level: item.reorder_level,
      supplier: item.supplier,
      source: item.source,
      last_restocked: item.last_restocked ? item.last_restocked.split('T')[0] : '',
      status: item.status,
      notes: item.notes,
    });
    setEditingId(item.id);
    setShowItemModal(true);
  };

  const openStockModal = (itemId: string) => {
    setStockAdjustment({ ...defaultStockAdjustment });
    setShowStockModal(itemId);
  };

  const openTransactionModal = (itemId: string) => {
    setShowTransactionModal(itemId);
    fetchTransactionsForItem(itemId);
  };

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_name.trim()) {
      showToast('Item name is required', 'error');
      return;
    }

    if (!selectedOutletId) {
      showToast('Please select an outlet first', 'error');
      return;
    }

    setSaving(true);

    const row = {
      outlet_id: selectedOutletId,
      item_name: formData.item_name.trim(),
      category: formData.category,
      quantity: formData.quantity,
      unit: formData.unit,
      unit_cost: formData.unit_cost,
      selling_price: formData.selling_price,
      reorder_level: formData.reorder_level,
      supplier: formData.supplier.trim() || null,
      source: formData.source,
      last_restocked: formData.last_restocked || null,
      status: formData.status,
      notes: formData.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('outlet_inventory')
          .update(row)
          .eq('id', editingId);
        if (error) throw error;

        logAudit({
          action: 'UPDATE',
          module: 'Outlet Inventory',
          record_id: editingId,
          details: { item_name: formData.item_name, outlet_id: selectedOutletId },
        });
        showToast('Item updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('outlet_inventory')
          .insert(row);
        if (error) throw error;

        logAudit({
          action: 'CREATE',
          module: 'Outlet Inventory',
          record_id: formData.item_name,
          details: { item_name: formData.item_name, outlet_id: selectedOutletId },
        });
        showToast('Item added successfully', 'success');
      }

      await fetchInventory();
      resetForm();
      setShowItemModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to save item: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('outlet_inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;

      const deletedItem = inventory.find(i => i.id === id);
      logAudit({
        action: 'DELETE',
        module: 'Outlet Inventory',
        record_id: id,
        details: { item_name: deletedItem?.item_name, outlet_id: selectedOutletId },
      });

      setInventory(prev => prev.filter(i => i.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setShowDeleteConfirm(null);
      showToast('Item deleted', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete item: ${msg}`, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase
        .from('outlet_inventory')
        .delete()
        .in('id', ids);
      if (error) throw error;

      ids.forEach(id => {
        const deletedItem = inventory.find(i => i.id === id);
        logAudit({
          action: 'DELETE',
          module: 'Outlet Inventory',
          record_id: id,
          details: { item_name: deletedItem?.item_name, outlet_id: selectedOutletId },
        });
      });

      setInventory(prev => prev.filter(i => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      showToast(`${ids.length} item(s) deleted`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete items: ${msg}`, 'error');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showStockModal) return;
    if (stockAdjustment.quantity <= 0) {
      showToast('Quantity must be greater than zero', 'error');
      return;
    }

    const item = inventory.find(i => i.id === showStockModal);
    if (!item) return;

    setSaving(true);

    try {
      // Insert the transaction
      const { error: txnError } = await supabase
        .from('outlet_inventory_transactions')
        .insert({
          outlet_id: selectedOutletId,
          item_id: item.id,
          type: stockAdjustment.type,
          quantity: stockAdjustment.quantity,
          reference: stockAdjustment.reference.trim() || null,
          notes: stockAdjustment.notes.trim() || null,
          performed_by: null,
        });
      if (txnError) throw txnError;

      // Calculate new quantity
      let newQuantity = item.quantity;
      if (stockAdjustment.type === 'intake' || stockAdjustment.type === 'requisition_received') {
        newQuantity = item.quantity + stockAdjustment.quantity;
      } else if (stockAdjustment.type === 'output' || stockAdjustment.type === 'sale' || stockAdjustment.type === 'waste') {
        newQuantity = Math.max(0, item.quantity - stockAdjustment.quantity);
      } else if (stockAdjustment.type === 'adjustment') {
        // Adjustment sets quantity directly
        newQuantity = stockAdjustment.quantity;
      }

      const updateData: Record<string, unknown> = {
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      };

      if (stockAdjustment.type === 'intake' || stockAdjustment.type === 'requisition_received') {
        updateData.last_restocked = new Date().toISOString().split('T')[0];
      }

      const { error: updateError } = await supabase
        .from('outlet_inventory')
        .update(updateData)
        .eq('id', item.id);
      if (updateError) throw updateError;

      logAudit({
        action: 'CREATE',
        module: 'Outlet Inventory Transactions',
        record_id: item.id,
        details: {
          item_name: item.item_name,
          type: stockAdjustment.type,
          quantity: stockAdjustment.quantity,
          outlet_id: selectedOutletId,
        },
      });

      await fetchInventory();
      setShowStockModal(null);
      setStockAdjustment({ ...defaultStockAdjustment });
      showToast('Stock adjustment recorded successfully', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Stock adjustment failed: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getSelectedOutlet = (): Outlet | undefined => {
    return outlets.find(o => o.id === selectedOutletId);
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getTransactionTypeColor = (type: string): string => {
    switch (type) {
      case 'intake':
      case 'requisition_received':
        return 'bg-green-100 text-green-800';
      case 'output':
      case 'sale':
        return 'bg-orange-100 text-orange-800';
      case 'waste':
        return 'bg-red-100 text-red-800';
      case 'adjustment':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string): string => {
    switch (source) {
      case 'main_branch':
        return 'bg-indigo-100 text-indigo-800';
      case 'external':
        return 'bg-amber-100 text-amber-800';
      case 'self':
        return 'bg-teal-100 text-teal-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockItem = (id: string): OutletInventoryItem | undefined => {
    return inventory.find(i => i.id === id);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading outlets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Store size={28} className="text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Outlet Inventory Management</h1>
        </div>
        <p className="text-muted-foreground">
          Manage inventory for individual outlets. Outlet stock is separate from main bakery inventory.
        </p>
      </div>

      {/* Outlet Selector */}
      <div className="mb-6 p-4 border border-border rounded-lg bg-secondary/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-muted-foreground" />
            <label className="text-sm font-semibold text-foreground">Select Outlet:</label>
          </div>
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm min-w-[250px]"
          >
            {outlets.length === 0 && <option value="">No outlets available</option>}
            {outlets.map(outlet => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} {outlet.code ? `(${outlet.code})` : ''} &mdash; {outlet.outlet_type}
              </option>
            ))}
          </select>
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

      {/* No Outlets Message */}
      {outlets.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Store size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Outlets Found</h3>
          <p className="text-muted-foreground text-sm">
            There are no active non-main-branch outlets configured. Please add outlets in the Outlet Management section first.
          </p>
        </div>
      )}

      {/* Main Content - Only show when outlet is selected */}
      {selectedOutletId && outlets.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold text-foreground">{totalItems}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${lowStockCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <AlertTriangle size={20} className={lowStockCount > 0 ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {lowStockCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <ArrowUpDown size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Store size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">From Main Branch</p>
                  <p className="text-2xl font-bold text-foreground">{mainBranchItemCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {lowStockItems.length > 0 && (
            <div className="mb-6 border-2 border-red-200 bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600" />
                <h3 className="font-bold text-red-800">Low Stock Alerts</h3>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {lowStockItems.length} item(s)
                </span>
              </div>
              <div className="space-y-2">
                {lowStockItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-white border border-red-100 rounded-lg px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-red-800">{item.item_name}</span>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{item.category}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getSourceColor(item.source)}`}>
                          {SOURCE_LABELS[item.source]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                        <span>
                          Current: <strong className="text-red-700">{item.quantity} {item.unit}</strong>
                        </span>
                        <span>
                          Reorder Level: <strong>{item.reorder_level} {item.unit}</strong>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => openStockModal(item.id)}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium ml-4"
                    >
                      Adjust Stock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search / Filter / Actions Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search items, categories, suppliers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Sources</option>
                {SOURCES.map(src => (
                  <option key={src} value={src}>{SOURCE_LABELS[src]}</option>
                ))}
              </select>

              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <Trash2 size={14} /> Delete {selectedIds.size} selected
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchInventory()}
                className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Refresh inventory"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          {loadingInventory ? (
            <div className="flex items-center justify-center py-16 border border-border rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Loading inventory...</p>
              </div>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {inventory.length === 0
                  ? 'No Inventory Items'
                  : 'No Items Match Your Filters'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {inventory.length === 0
                  ? `Add your first inventory item for ${getSelectedOutlet()?.name || 'this outlet'}.`
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {inventory.length === 0 && (
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
                >
                  <Plus size={16} /> Add First Item
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">
                        <button type="button" onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                          {allPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('item_name')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Item Name {renderSortIcon('item_name')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('category')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Category {renderSortIcon('category')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('quantity')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Quantity {renderSortIcon('quantity')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('unit_cost')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Unit Cost {renderSortIcon('unit_cost')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('selling_price')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Selling Price {renderSortIcon('selling_price')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('source')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Source {renderSortIcon('source')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('status')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Status {renderSortIcon('status')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('last_restocked')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Last Restocked {renderSortIcon('last_restocked')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInventory.map(item => {
                      const isLowStock = item.reorder_level > 0 && item.quantity <= item.reorder_level;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                            isLowStock ? 'bg-red-50/50' : ''
                          } ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}
                        >
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelect(item.id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {selectedIds.has(item.id) ? (
                                <CheckSquare size={16} className="text-primary" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.item_name}</span>
                              {isLowStock && (
                                <span title="Low stock"><AlertTriangle size={14} className="text-red-500" /></span>
                              )}
                            </div>
                            {item.supplier && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.supplier}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isLowStock ? 'text-red-600' : ''}`}>
                              {item.quantity} {item.unit}
                            </span>
                            {isLowStock && (
                              <p className="text-[10px] text-red-500 mt-0.5">
                                Below reorder level ({item.reorder_level})
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-4 py-3">{formatCurrency(item.selling_price)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getSourceColor(item.source)}`}>
                              {SOURCE_LABELS[item.source]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                item.status === 'Active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(item.last_restocked)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => openStockModal(item.id)}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium"
                                title="Stock adjustment"
                              >
                                <ArrowUpDown size={12} className="inline mr-1" />
                                Adjust
                              </button>
                              <button
                                onClick={() => openTransactionModal(item.id)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
                                title="View transaction history"
                              >
                                History
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 font-medium"
                                title="Edit item"
                              >
                                <Edit size={12} className="inline mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(item.id)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                                title="Delete item"
                              >
                                <Trash2 size={12} className="inline mr-1" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}&ndash;
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredInventory.length)} of{' '}
                    {filteredInventory.length} items
                  </p>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            currentPage === page
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border hover:bg-secondary'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ────────────────────────────────────────────────────────────────────── */}
          {/* MODALS                                                                 */}
          {/* ────────────────────────────────────────────────────────────────────── */}

          {/* Add / Edit Item Modal */}
          <Modal
            isOpen={showItemModal}
            onClose={() => {
              setShowItemModal(false);
              resetForm();
            }}
            title={editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}
            size="lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {editingId
                  ? 'Update the item details below.'
                  : `Adding item to ${getSelectedOutlet()?.name || 'selected outlet'}. Fields marked with * are required.`}
              </p>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Espresso Beans, Croissant, Paper Cups"
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                />
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity + Reorder Level */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Alert when stock falls below"
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Unit Cost + Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Unit Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Selling Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Margin Preview */}
              {formData.unit_cost > 0 && formData.selling_price > 0 && (
                <div className="px-3 py-2 bg-secondary rounded-lg text-xs">
                  <span className="text-muted-foreground">Margin: </span>
                  <span className={`font-semibold ${formData.selling_price > formData.unit_cost ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(formData.selling_price - formData.unit_cost)} (
                    {((formData.selling_price - formData.unit_cost) / formData.unit_cost * 100).toFixed(1)}%)
                  </span>
                </div>
              )}

              {/* Source + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) =>
                      setFormData({ ...formData, source: e.target.value as 'main_branch' | 'external' | 'self' })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {SOURCES.map(src => (
                      <option key={src} value={src}>{SOURCE_LABELS[src]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supplier + Last Restocked */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Supplier</label>
                  <input
                    type="text"
                    placeholder="Supplier name"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Last Restocked</label>
                  <input
                    type="date"
                    value={formData.last_restocked}
                    onChange={(e) => setFormData({ ...formData, last_restocked: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  placeholder="Any additional notes about this item..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={!!showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(null)}
            title="Delete Item"
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Are you sure?</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will permanently delete{' '}
                    <strong>{inventory.find(i => i.id === showDeleteConfirm)?.item_name}</strong> and all its
                    transaction history. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete Item
                </button>
              </div>
            </div>
          </Modal>

          {/* Bulk Delete Confirmation Modal */}
          <Modal
            isOpen={showBulkDeleteConfirm}
            onClose={() => setShowBulkDeleteConfirm(false)}
            title="Delete Selected Items"
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Delete {selectedIds.size} selected item(s)?
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    This will permanently delete all selected items and their transaction history. This action cannot
                    be undone.
                  </p>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2">
                {Array.from(selectedIds).map(id => {
                  const item = inventory.find(i => i.id === id);
                  return (
                    <div key={id} className="text-xs text-muted-foreground py-0.5">
                      {item?.item_name || id}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete {selectedIds.size} Item(s)
                </button>
              </div>
            </div>
          </Modal>

          {/* Stock Adjustment Modal */}
          <Modal
            isOpen={!!showStockModal}
            onClose={() => {
              setShowStockModal(null);
              setStockAdjustment({ ...defaultStockAdjustment });
            }}
            title={`Stock Adjustment: ${getStockItem(showStockModal || '')?.item_name || ''}`}
            size="md"
          >
            {showStockModal && getStockItem(showStockModal) && (
              <form onSubmit={handleStockAdjustment} className="space-y-4">
                {/* Current Stock Info */}
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Current Stock</p>
                      <p className="font-bold">
                        {getStockItem(showStockModal)!.quantity} {getStockItem(showStockModal)!.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-medium">{getStockItem(showStockModal)!.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reorder Level</p>
                      <p className="font-medium">
                        {getStockItem(showStockModal)!.reorder_level} {getStockItem(showStockModal)!.unit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Transaction Type */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Transaction Type *</label>
                  <select
                    value={stockAdjustment.type}
                    onChange={(e) =>
                      setStockAdjustment({
                        ...stockAdjustment,
                        type: e.target.value as typeof TRANSACTION_TYPES[number],
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {TRANSACTION_TYPES.map(t => (
                      <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {stockAdjustment.type === 'intake' && 'Stock received into the outlet.'}
                    {stockAdjustment.type === 'output' && 'Stock sent out or used.'}
                    {stockAdjustment.type === 'adjustment' && 'Manually set the quantity (e.g. after stock count).'}
                    {stockAdjustment.type === 'requisition_received' && 'Items received from main branch requisition.'}
                    {stockAdjustment.type === 'sale' && 'Items sold to customers.'}
                    {stockAdjustment.type === 'waste' && 'Items discarded due to waste, damage, or expiry.'}
                  </p>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    {stockAdjustment.type === 'adjustment' ? 'New Quantity *' : 'Quantity *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockAdjustment.quantity}
                    onChange={(e) =>
                      setStockAdjustment({ ...stockAdjustment, quantity: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  />
                </div>

                {/* Resulting Stock Preview */}
                {stockAdjustment.quantity > 0 && (
                  <div className="px-3 py-2 rounded-lg text-xs">
                    {(stockAdjustment.type === 'intake' || stockAdjustment.type === 'requisition_received') && (
                      <p className="text-green-600">
                        New stock will be:{' '}
                        <strong>
                          {(getStockItem(showStockModal)!.quantity + stockAdjustment.quantity).toFixed(2)}{' '}
                          {getStockItem(showStockModal)!.unit}
                        </strong>
                      </p>
                    )}
                    {(stockAdjustment.type === 'output' || stockAdjustment.type === 'sale' || stockAdjustment.type === 'waste') && (
                      <p className="text-orange-600">
                        Remaining stock will be:{' '}
                        <strong>
                          {Math.max(0, getStockItem(showStockModal)!.quantity - stockAdjustment.quantity).toFixed(2)}{' '}
                          {getStockItem(showStockModal)!.unit}
                        </strong>
                        {stockAdjustment.quantity > getStockItem(showStockModal)!.quantity && (
                          <span className="text-red-600 ml-2">(exceeds current stock!)</span>
                        )}
                      </p>
                    )}
                    {stockAdjustment.type === 'adjustment' && (
                      <p className="text-blue-600">
                        Stock will be set to:{' '}
                        <strong>
                          {stockAdjustment.quantity.toFixed(2)} {getStockItem(showStockModal)!.unit}
                        </strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Reference */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Invoice #, Requisition #, PO #"
                    value={stockAdjustment.reference}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                  <textarea
                    placeholder="Additional details..."
                    value={stockAdjustment.notes}
                    onChange={(e) => setStockAdjustment({ ...stockAdjustment, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStockModal(null);
                      setStockAdjustment({ ...defaultStockAdjustment });
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || stockAdjustment.quantity <= 0}
                    className={`px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 ${
                      stockAdjustment.type === 'intake' || stockAdjustment.type === 'requisition_received'
                        ? 'bg-green-600'
                        : stockAdjustment.type === 'waste'
                        ? 'bg-red-600'
                        : stockAdjustment.type === 'adjustment'
                        ? 'bg-blue-600'
                        : 'bg-orange-600'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Record Adjustment'}
                  </button>
                </div>
              </form>
            )}
          </Modal>

          {/* Transaction History Modal */}
          <Modal
            isOpen={!!showTransactionModal}
            onClose={() => {
              setShowTransactionModal(null);
              setTransactions([]);
            }}
            title={`Transaction History: ${getStockItem(showTransactionModal || '')?.item_name || ''}`}
            size="xl"
          >
            {showTransactionModal && (
              <div className="space-y-4">
                {/* Item Summary */}
                {getStockItem(showTransactionModal) && (
                  <div className="p-3 bg-secondary rounded-lg">
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Stock</p>
                        <p className="font-bold">
                          {getStockItem(showTransactionModal)!.quantity}{' '}
                          {getStockItem(showTransactionModal)!.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p className="font-medium">{getStockItem(showTransactionModal)!.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Source</p>
                        <p className="font-medium">
                          {SOURCE_LABELS[getStockItem(showTransactionModal)!.source]}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Restocked</p>
                        <p className="font-medium">
                          {formatDate(getStockItem(showTransactionModal)!.last_restocked)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction List */}
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <ArrowUpDown size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm">No transactions recorded for this item yet.</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary border-b border-border sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold">Date</th>
                          <th className="px-4 py-2 text-left font-semibold">Type</th>
                          <th className="px-4 py-2 text-left font-semibold">Quantity</th>
                          <th className="px-4 py-2 text-left font-semibold">Reference</th>
                          <th className="px-4 py-2 text-left font-semibold">Notes</th>
                          <th className="px-4 py-2 text-left font-semibold">Performed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(txn => (
                          <tr key={txn.id} className="border-b border-border hover:bg-secondary/50">
                            <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(txn.created_at)}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${getTransactionTypeColor(
                                  txn.type
                                )}`}
                              >
                                {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
                              </span>
                            </td>
                            <td className="px-4 py-2 font-medium">
                              <span
                                className={
                                  txn.type === 'intake' || txn.type === 'requisition_received'
                                    ? 'text-green-600'
                                    : txn.type === 'waste'
                                    ? 'text-red-600'
                                    : txn.type === 'adjustment'
                                    ? 'text-blue-600'
                                    : 'text-orange-600'
                                }
                              >
                                {txn.type === 'intake' || txn.type === 'requisition_received' ? '+' : txn.type === 'adjustment' ? '=' : '-'}
                                {txn.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{txn.reference || '--'}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                              {txn.notes || '--'}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{txn.performed_by || '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Transaction Summary */}
                {transactions.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-secondary/50 rounded-lg text-xs">
                    <div>
                      <p className="text-muted-foreground">Total Intake</p>
                      <p className="font-bold text-green-600">
                        +{transactions
                          .filter(t => t.type === 'intake' || t.type === 'requisition_received')
                          .reduce((sum, t) => sum + t.quantity, 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Output</p>
                      <p className="font-bold text-orange-600">
                        -{transactions
                          .filter(t => t.type === 'output' || t.type === 'sale' || t.type === 'waste')
                          .reduce((sum, t) => sum + t.quantity, 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Transactions</p>
                      <p className="font-bold">{transactions.length}</p>
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <div className="flex justify-end pt-2 border-t border-border">
                  <button
                    onClick={() => {
                      setShowTransactionModal(null);
                      setTransactions([]);
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
