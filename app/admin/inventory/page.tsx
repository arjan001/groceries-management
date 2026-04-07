'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { Search, Trash2, CheckSquare, Square, ChevronLeft, ChevronRight, FileDown, Pencil } from 'lucide-react';
import { logAudit } from '@/lib/audit-logger';

interface Distributor {
  id: string;
  name: string;
  category: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: 'Consumable' | 'Non-Consumable';
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  reorderQty: number;
  autoReorder: boolean;
  supplier: string;
  distributorId: string;
  lastRestocked: string;
}

interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'intake' | 'output';
  quantity: number;
  reference: string;
  createdAt: string;
}

interface InventoryCategory {
  id: string;
  name: string;
  type: 'Consumable' | 'Non-Consumable';
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showStockModal, setShowStockModal] = useState<{ item: InventoryItem; type: 'intake' | 'output' } | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockRef, setStockRef] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  // Datatable states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInventory = useCallback(async () => {
    const { data, error } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false });
    if (error) { showToast('Failed to load inventory: ' + error.message, 'error'); return; }
    if (data && data.length > 0) setInventory(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, type: (r.type || 'Consumable') as InventoryItem['type'], category: (r.category || '') as string, quantity: (r.quantity || 0) as number, unit: (r.unit || 'kg') as string, unitCost: (r.unit_cost || 0) as number, reorderLevel: (r.reorder_level || 0) as number, reorderQty: (r.reorder_qty || 0) as number, autoReorder: Boolean(r.auto_reorder), supplier: (r.supplier || '') as string, distributorId: (r.distributor_id || '') as string, lastRestocked: (r.last_restocked || '') as string })));
    else setInventory([]);
  }, []);

  const fetchDistributors = useCallback(async () => {
    const { data } = await supabase.from('distributors').select('id, name, category').order('name');
    if (data) setDistributors(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, category: (r.category || '') as string })));
  }, []);

  const fetchTransactions = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    if (data) setTransactions(data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      itemId: (r.item_id || '') as string,
      type: (r.type || 'output') as 'intake' | 'output',
      quantity: (r.quantity || 0) as number,
      reference: (r.reference || '') as string,
      createdAt: (r.created_at || '') as string,
    })));
  }, []);

  useEffect(() => { fetchInventory(); fetchDistributors(); fetchTransactions(); }, [fetchInventory, fetchDistributors, fetchTransactions]);

  const [categories, setCategories] = useState<InventoryCategory[]>([]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('inventory_categories').select('*').order('name');
    if (data && data.length > 0) setCategories(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, type: (r.type || 'Consumable') as InventoryCategory['type'] })));
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inventory' | 'categories'>('inventory');
  const [filterType, setFilterType] = useState<'All' | 'Consumable' | 'Non-Consumable'>('All');
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [catFilterType, setCatFilterType] = useState<'All' | 'Consumable' | 'Non-Consumable'>('All');
  const [catCurrentPage, setCatCurrentPage] = useState(1);
  const [catSelectedIds, setCatSelectedIds] = useState<Set<string>>(new Set());
  const catItemsPerPage = 10;
  const inventoryTableRef = useRef<HTMLDivElement>(null);
  const categoryTableRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<InventoryItem>({
    id: '',
    name: '',
    type: 'Consumable',
    category: '',
    quantity: 0,
    unit: 'kg',
    unitCost: 0,
    reorderLevel: 0,
    reorderQty: 0,
    autoReorder: false,
    supplier: '',
    distributorId: '',
    lastRestocked: new Date().toISOString().split('T')[0],
  });

  const [categoryForm, setCategoryForm] = useState<InventoryCategory>({
    id: '',
    name: '',
    type: 'Consumable',
  });

  const getDailyUsage = (itemId: string): number => {
    const itemTxns = transactions.filter(t => t.itemId === itemId && t.type === 'output');
    if (itemTxns.length === 0) return 0;
    const totalUsed = itemTxns.reduce((sum, t) => sum + t.quantity, 0);
    return Math.round((totalUsed / 30) * 10) / 10;
  };

  const getDaysRemaining = (item: InventoryItem): number | null => {
    const dailyUsage = getDailyUsage(item.id);
    if (dailyUsage <= 0) return null;
    return Math.floor(item.quantity / dailyUsage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('Item name is required', 'error');
      return;
    }

    setSaving(true);
    const row = {
      name: formData.name.trim(),
      type: formData.type,
      category: formData.category || null,
      quantity: formData.quantity,
      unit: formData.unit,
      unit_cost: formData.unitCost,
      reorder_level: formData.reorderLevel,
      reorder_qty: formData.reorderQty,
      auto_reorder: formData.autoReorder,
      supplier: formData.supplier,
      distributor_id: formData.distributorId || null,
      last_restocked: formData.lastRestocked || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('inventory_items').update(row).eq('id', editingId);
        if (error) throw error;
        logAudit({
          action: 'UPDATE',
          module: 'Inventory',
          record_id: editingId,
          details: { name: formData.name, quantity: formData.quantity },
        });
        showToast('Item updated successfully', 'success');
      } else {
        const { error } = await supabase.from('inventory_items').insert(row);
        if (error) throw error;
        logAudit({
          action: 'CREATE',
          module: 'Inventory',
          record_id: formData.name,
          details: { name: formData.name, quantity: formData.quantity },
        });
        showToast('Item added successfully', 'success');
      }
      await fetchInventory();
      resetForm();
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Unknown error';
      showToast(`Failed to save item: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    try {
      if (editingCategoryId) {
        const { error } = await supabase.from('inventory_categories').update({
          name: categoryForm.name.trim(),
          type: categoryForm.type,
        }).eq('id', editingCategoryId);
        if (error) throw error;
        logAudit({
          action: 'UPDATE',
          module: 'Inventory Categories',
          record_id: editingCategoryId,
          details: { name: categoryForm.name, type: categoryForm.type },
        });
        showToast('Category updated successfully', 'success');
      } else {
        const { error } = await supabase.from('inventory_categories').insert({
          name: categoryForm.name.trim(),
          type: categoryForm.type,
        });
        if (error) throw error;
        logAudit({
          action: 'CREATE',
          module: 'Inventory Categories',
          record_id: categoryForm.name,
          details: { name: categoryForm.name, type: categoryForm.type },
        });
        showToast('Category added successfully', 'success');
      }
      await fetchCategories();
      setCategoryForm({ id: '', name: '', type: 'Consumable' });
      setEditingCategoryId(null);
      setShowCategoryForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Unknown error';
      showToast(`Failed to save category: ${msg}`, 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      type: 'Consumable',
      category: '',
      quantity: 0,
      unit: 'kg',
      unitCost: 0,
      reorderLevel: 0,
      reorderQty: 0,
      autoReorder: false,
      supplier: '',
      distributorId: '',
      lastRestocked: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setFormData(item);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this inventory item?')) return;
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete: ' + error.message, 'error');
      return;
    }
    const deletedItem = inventory.find(i => i.id === id);
    logAudit({
      action: 'DELETE',
      module: 'Inventory',
      record_id: id,
      details: { name: deletedItem?.name },
    });
    setInventory(prev => prev.filter(i => i.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    showToast('Item deleted', 'success');
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item(s)?`)) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('inventory_items').delete().in('id', ids);
    if (error) {
      showToast('Failed to delete: ' + error.message, 'error');
      return;
    }
    ids.forEach(id => {
      const deletedItem = inventory.find(i => i.id === id);
      logAudit({
        action: 'DELETE',
        module: 'Inventory',
        record_id: id,
        details: { name: deletedItem?.name },
      });
    });
    setInventory(prev => prev.filter(i => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
    showToast(`${ids.length} item(s) deleted`, 'success');
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const { error } = await supabase.from('inventory_categories').delete().eq('id', id);
    if (error) {
      showToast('Failed to delete category: ' + error.message, 'error');
      return;
    }
    const deletedCategory = categories.find(c => c.id === id);
    logAudit({
      action: 'DELETE',
      module: 'Inventory Categories',
      record_id: id,
      details: { name: deletedCategory?.name, type: deletedCategory?.type },
    });
    setCategories(prev => prev.filter(c => c.id !== id));
    setCatSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    showToast('Category deleted', 'success');
  };

  const handleEditCategory = (cat: InventoryCategory) => {
    setCategoryForm({ id: cat.id, name: cat.name, type: cat.type });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  const handleBulkDeleteCategories = async () => {
    if (catSelectedIds.size === 0) return;
    if (!confirm(`Delete ${catSelectedIds.size} selected categor${catSelectedIds.size === 1 ? 'y' : 'ies'}?`)) return;
    const ids = Array.from(catSelectedIds);
    const { error } = await supabase.from('inventory_categories').delete().in('id', ids);
    if (error) {
      showToast('Failed to delete: ' + error.message, 'error');
      return;
    }
    ids.forEach(id => {
      const deletedCat = categories.find(c => c.id === id);
      logAudit({ action: 'DELETE', module: 'Inventory Categories', record_id: id, details: { name: deletedCat?.name } });
    });
    setCategories(prev => prev.filter(c => !catSelectedIds.has(c.id)));
    setCatSelectedIds(new Set());
    showToast(`${ids.length} categor${ids.length === 1 ? 'y' : 'ies'} deleted`, 'success');
  };

  const exportPdf = async (title: string, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(ref.current).save();
      showToast('PDF exported successfully', 'success');
    } catch {
      showToast('Failed to export PDF', 'error');
    }
  };

  const handleStockTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showStockModal || stockQty <= 0) return;

    const item = showStockModal.item;
    const txnType = showStockModal.type;
    const newQty = txnType === 'intake' ? item.quantity + stockQty : Math.max(0, item.quantity - stockQty);

    try {
      const { error: txnError } = await supabase.from('inventory_transactions').insert({
        item_id: item.id,
        type: txnType,
        quantity: stockQty,
        reference: stockRef || (txnType === 'intake' ? 'Stock replenishment' : 'Production usage'),
      });
      if (txnError) throw txnError;

      const updateData: Record<string, unknown> = { quantity: newQty };
      if (txnType === 'intake') {
        updateData.last_restocked = new Date().toISOString().split('T')[0];
      }
      const { error: updateError } = await supabase.from('inventory_items').update(updateData).eq('id', item.id);
      if (updateError) throw updateError;

      logAudit({
        action: 'CREATE',
        module: 'Inventory Transactions',
        record_id: item.id,
        details: { name: item.name, quantity: stockQty, type: txnType },
      });

      await fetchInventory();
      await fetchTransactions();
      showToast(txnType === 'intake' ? 'Stock added successfully' : 'Usage recorded', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Unknown error';
      showToast(`Transaction failed: ${msg}`, 'error');
    }

    setShowStockModal(null);
    setStockQty(0);
    setStockRef('');
  };

  // Filter and search
  const filteredInventory = inventory.filter(item => {
    const matchesType = filterType === 'All' || item.type === filterType;
    if (!matchesType) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.supplier.toLowerCase().includes(term) ||
      item.unit.toLowerCase().includes(term)
    );
  });

  // Reset to page 1 on search/filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType]);
  useEffect(() => { setCatCurrentPage(1); }, [catSearchTerm, catFilterType]);

  const lowStockConsumables = inventory.filter(i => i.type === 'Consumable' && i.reorderLevel > 0 && i.quantity <= i.reorderLevel);
  const lowStockCount = inventory.filter(i => i.quantity <= i.reorderLevel && i.reorderLevel > 0).length;
  const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const getDistributorName = (id: string) => distributors.find(d => d.id === id)?.name || '';

  // Category filter/search/pagination
  const filteredCategories = categories.filter(cat => {
    const matchType = catFilterType === 'All' || cat.type === catFilterType;
    if (!matchType) return false;
    if (!catSearchTerm) return true;
    return cat.name.toLowerCase().includes(catSearchTerm.toLowerCase());
  });
  const catTotalPages = Math.max(1, Math.ceil(filteredCategories.length / catItemsPerPage));
  const paginatedCategories = filteredCategories.slice((catCurrentPage - 1) * catItemsPerPage, catCurrentPage * catItemsPerPage);
  const catItemCount = (type: string) => inventory.filter(i => i.category === type).length;

  // Category select all logic
  const allCatPageSelected = paginatedCategories.length > 0 && paginatedCategories.every(c => catSelectedIds.has(c.id));
  const toggleCatSelectAll = () => {
    if (allCatPageSelected) {
      setCatSelectedIds(prev => { const n = new Set(prev); paginatedCategories.forEach(c => n.delete(c.id)); return n; });
    } else {
      setCatSelectedIds(prev => { const n = new Set(prev); paginatedCategories.forEach(c => n.add(c.id)); return n; });
    }
  };
  const toggleCatSelect = (id: string) => {
    setCatSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  // Select all logic
  const allPageSelected = paginatedInventory.length > 0 && paginatedInventory.every(item => selectedIds.has(item.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const n = new Set(prev);
        paginatedInventory.forEach(item => n.delete(item.id));
        return n;
      });
    } else {
      setSelectedIds(prev => {
        const n = new Set(prev);
        paginatedInventory.forEach(item => n.add(item.id));
        return n;
      });
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2">Inventory Management</h1>
        <p className="text-muted-foreground">Track consumable and non-consumable inventory with categories</p>
      </div>

      {/* Reorder Alert Banner for Consumables */}
      {lowStockConsumables.filter(i => !dismissedAlerts.has(i.id)).length > 0 && (
        <div className="mb-6 border-2 border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-lg">!!!</span>
              <h3 className="font-bold text-red-800">Reorder Alert &mdash; Consumable Items Low on Stock</h3>
            </div>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {lowStockConsumables.filter(i => !dismissedAlerts.has(i.id)).length} item(s)
            </span>
          </div>
          <div className="space-y-2">
            {lowStockConsumables.filter(i => !dismissedAlerts.has(i.id)).map(item => {
              const dailyUsage = getDailyUsage(item.id);
              const daysLeft = getDaysRemaining(item);
              return (
                <div key={item.id} className="flex items-center justify-between bg-white border border-red-100 rounded-lg px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-red-800">{item.name}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                      <span>Current: <strong className="text-red-700">{item.quantity} {item.unit}</strong></span>
                      <span>Reorder Level: <strong>{item.reorderLevel} {item.unit}</strong></span>
                      {dailyUsage > 0 && <span>Avg Daily Usage: <strong>{dailyUsage} {item.unit}/day</strong></span>}
                      {daysLeft !== null && (
                        <span className={`font-semibold ${daysLeft <= 3 ? 'text-red-700' : daysLeft <= 7 ? 'text-orange-600' : 'text-gray-700'}`}>
                          ~{daysLeft} days remaining
                        </span>
                      )}
                      {item.autoReorder && <span className="text-blue-600 font-semibold">Auto-reorder ON</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => { setShowStockModal({ item, type: 'intake' }); setStockQty(item.reorderQty || item.reorderLevel); }}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Restock Now
                    </button>
                    <button
                      onClick={() => setDismissedAlerts(prev => new Set([...prev, item.id]))}
                      className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600"
                      title="Dismiss"
                    >
                      x
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Items</p>
          <p className="text-2xl font-bold">{inventory.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Stock Value</p>
          <p className="text-2xl font-bold">{totalValue.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Low Stock Items</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{lowStockCount}</p>
          {lowStockCount > 0 && (
            <p className="text-xs text-red-500 mt-1">{lowStockConsumables.length} consumable(s) need reorder</p>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'inventory'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div>
          {/* Search / Filter / Actions Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search items, categories, suppliers..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'All' | 'Consumable' | 'Non-Consumable')}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option>All</option>
                <option>Consumable</option>
                <option>Non-Consumable</option>
              </select>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <Trash2 size={14} /> Delete {selectedIds.size} selected
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                resetForm();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              + Add Item
            </button>
            <button
              onClick={() => exportPdf('Inventory-Items', inventoryTableRef)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
            >
              <FileDown size={14} /> Export PDF
            </button>
          </div>

          {/* Add/Edit Inventory Item Modal */}
          <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? 'Edit Item' : 'Add Inventory Item'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-muted-foreground">Only item name is required. Fill other fields as needed.</p>
              <input
                type="text"
                placeholder="Item Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Consumable' | 'Non-Consumable' })}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option>Consumable</option>
                  <option>Non-Consumable</option>
                </select>

                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">Select Category (optional)</option>
                  {categories.filter(c => c.type === formData.type).map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <input
                  type="number"
                  placeholder="Quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                  <option value="pieces">pieces</option>
                  <option value="dozen">dozen</option>
                  <option value="boxes">boxes</option>
                  <option value="rolls">rolls</option>
                  <option value="packs">packs</option>
                  <option value="bags">bags</option>
                  <option value="bottles">bottles</option>
                  <option value="tins">tins</option>
                  <option value="units">units</option>
                  <option value="sheets">sheets</option>
                  <option value="trays">trays</option>
                </select>
                <input
                  type="number"
                  placeholder="Unit Cost"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {/* Reorder Settings */}
              {formData.type === 'Consumable' ? (
                <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-blue-800">Consumable Reorder Settings</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.autoReorder}
                        onChange={(e) => setFormData({ ...formData, autoReorder: e.target.checked })}
                        className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-blue-700">Auto-Reorder Alert</span>
                    </label>
                  </div>
                  <p className="text-xs text-blue-600">
                    Set the reorder level to get alerts when stock falls below the threshold.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-blue-800 mb-1">Reorder Level ({formData.unit})</label>
                      <input
                        type="number"
                        placeholder="Min stock before alert"
                        value={formData.reorderLevel}
                        onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-blue-800 mb-1">Reorder Quantity ({formData.unit})</label>
                      <input
                        type="number"
                        placeholder="How much to reorder"
                        value={formData.reorderQty}
                        onChange={(e) => setFormData({ ...formData, reorderQty: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                      />
                    </div>
                  </div>
                  {formData.autoReorder && formData.reorderLevel > 0 && (
                    <p className="text-xs text-blue-700 bg-blue-100 px-3 py-2 rounded">
                      Alert will trigger when stock drops to or below <strong>{formData.reorderLevel} {formData.unit}</strong>.
                      {formData.reorderQty > 0 && <> Suggested reorder: <strong>{formData.reorderQty} {formData.unit}</strong>.</>}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="number"
                    placeholder="Reorder Level"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                    className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Received From Distributor</label>
                <select
                  value={formData.distributorId}
                  onChange={(e) => setFormData({ ...formData, distributorId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">Select Distributor (optional)</option>
                  {distributors.map(d => <option key={d.id} value={d.id}>{d.name} &mdash; {d.category}</option>)}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50">
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Add')} {!saving && 'Item'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Stock Intake/Output Modal */}
          <Modal isOpen={!!showStockModal} onClose={() => { setShowStockModal(null); setStockQty(0); setStockRef(''); }} title={showStockModal?.type === 'intake' ? `Restock: ${showStockModal?.item.name}` : `Record Usage: ${showStockModal?.item.name}`} size="sm">
            <form onSubmit={handleStockTransaction} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Current stock: <strong>{showStockModal?.item.quantity} {showStockModal?.item.unit}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  {showStockModal?.type === 'intake' ? 'Quantity to Add' : 'Quantity Used'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={stockQty}
                  onChange={(e) => setStockQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Reference / Notes</label>
                <input
                  type="text"
                  value={stockRef}
                  onChange={(e) => setStockRef(e.target.value)}
                  placeholder={showStockModal?.type === 'intake' ? 'e.g. Supplier delivery' : 'e.g. Morning production batch'}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              {showStockModal?.type === 'intake' && (
                <p className="text-xs text-green-600">
                  New stock will be: <strong>{(showStockModal?.item.quantity || 0) + stockQty} {showStockModal?.item.unit}</strong>
                </p>
              )}
              {showStockModal?.type === 'output' && (
                <p className="text-xs text-orange-600">
                  Remaining stock will be: <strong>{Math.max(0, (showStockModal?.item.quantity || 0) - stockQty)} {showStockModal?.item.unit}</strong>
                </p>
              )}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowStockModal(null); setStockQty(0); setStockRef(''); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" className={`px-4 py-2 text-white rounded-lg hover:opacity-90 ${showStockModal?.type === 'intake' ? 'bg-green-600' : 'bg-orange-600'}`}>
                  {showStockModal?.type === 'intake' ? 'Add Stock' : 'Record Usage'}
                </button>
              </div>
            </form>
          </Modal>

          <div ref={inventoryTableRef}>
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <button type="button" onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                      {allPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Item Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Usage/Day</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit Cost</th>
                  <th className="px-4 py-3 text-left font-semibold">Distributor</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'No items match your search.' : 'No inventory items found'}
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map(item => {
                    const isLowStock = item.reorderLevel > 0 && item.quantity <= item.reorderLevel;
                    const dailyUsage = getDailyUsage(item.id);
                    const daysLeft = getDaysRemaining(item);
                    return (
                      <tr key={item.id} className={`border-b border-border hover:bg-secondary/50 ${isLowStock ? 'bg-red-50/50' : ''} ${selectedIds.has(item.id) ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <button type="button" onClick={() => toggleSelect(item.id)} className="text-muted-foreground hover:text-foreground">
                            {selectedIds.has(item.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {item.name}
                          {item.autoReorder && item.type === 'Consumable' && (
                            <span className="ml-1 text-[10px] text-blue-600 font-semibold" title="Auto-reorder enabled">AUTO</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            item.type === 'Consumable' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.category || '--'}</td>
                        <td className="px-4 py-3 font-medium">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {isLowStock ? 'Low Stock' : 'OK'}
                          </span>
                          {isLowStock && daysLeft !== null && (
                            <span className="block text-[10px] text-red-600 mt-0.5">~{daysLeft}d left</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {item.type === 'Consumable' && dailyUsage > 0 ? (
                            <span>{dailyUsage} {item.unit}/day</span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{item.unitCost}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{getDistributorName(item.distributorId) || item.supplier || '\u2014'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {item.type === 'Consumable' && (
                              <>
                                <button
                                  onClick={() => { setShowStockModal({ item, type: 'intake' }); setStockQty(item.reorderQty || 0); }}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                                  title="Record stock intake"
                                >
                                  +In
                                </button>
                                <button
                                  onClick={() => setShowStockModal({ item, type: 'output' })}
                                  className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200"
                                  title="Record stock output/usage"
                                >
                                  -Out
                                </button>
                              </>
                            )}
                            <button onClick={() => handleEdit(item)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">
                              Delete
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1}&ndash;{Math.min(currentPage * itemsPerPage, filteredInventory.length)} of {filteredInventory.length} items
              </p>
              <div className="flex gap-1 items-center">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
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
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>
                      {page}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div>
          {/* Category Search / Filter / Actions Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={catSearchTerm}
                  onChange={e => setCatSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <select
                value={catFilterType}
                onChange={(e) => setCatFilterType(e.target.value as 'All' | 'Consumable' | 'Non-Consumable')}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option>All</option>
                <option>Consumable</option>
                <option>Non-Consumable</option>
              </select>
              {catSelectedIds.size > 0 && (
                <button
                  onClick={handleBulkDeleteCategories}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <Trash2 size={14} /> Delete {catSelectedIds.size} selected
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingCategoryId(null); setCategoryForm({ id: '', name: '', type: 'Consumable' }); setShowCategoryForm(true); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                + Add Category
              </button>
              <button
                onClick={() => exportPdf('Inventory-Categories', categoryTableRef)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
              >
                <FileDown size={14} /> Export PDF
              </button>
            </div>
          </div>

          <Modal isOpen={showCategoryForm} onClose={() => { setShowCategoryForm(false); setEditingCategoryId(null); }} title={editingCategoryId ? 'Edit Category' : 'Add Inventory Category'} size="sm">
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="Category Name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type</label>
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value as 'Consumable' | 'Non-Consumable' })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option>Consumable</option>
                  <option>Non-Consumable</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowCategoryForm(false); setEditingCategoryId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                  {editingCategoryId ? 'Update' : 'Add'} Category
                </button>
              </div>
            </form>
          </Modal>

          <div ref={categoryTableRef}>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
              {catSearchTerm || catFilterType !== 'All' ? 'No categories match your filters.' : 'No categories found. Add your first category to organize inventory items.'}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">
                      <button type="button" onClick={toggleCatSelectAll} className="text-muted-foreground hover:text-foreground">
                        {allCatPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Category Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-center font-semibold">Items Using</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map(cat => (
                    <tr key={cat.id} className={`border-b border-border hover:bg-secondary/50 ${catSelectedIds.has(cat.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-3 text-center">
                        <button type="button" onClick={() => toggleCatSelect(cat.id)} className="text-muted-foreground hover:text-foreground">
                          {catSelectedIds.has(cat.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium">{cat.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          cat.type === 'Consumable' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {cat.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{catItemCount(cat.name)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleEditCategory(cat)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium flex items-center gap-1">
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {/* Category Pagination */}
          {catTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((catCurrentPage - 1) * catItemsPerPage) + 1}&ndash;{Math.min(catCurrentPage * catItemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
              </p>
              <div className="flex gap-1 items-center">
                <button onClick={() => setCatCurrentPage(p => Math.max(1, p - 1))} disabled={catCurrentPage === 1}
                  className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(catTotalPages, 7) }, (_, i) => {
                  let page: number;
                  if (catTotalPages <= 7) page = i + 1;
                  else if (catCurrentPage <= 4) page = i + 1;
                  else if (catCurrentPage >= catTotalPages - 3) page = catTotalPages - 6 + i;
                  else page = catCurrentPage - 3 + i;
                  return (
                    <button key={page} onClick={() => setCatCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${catCurrentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}>
                      {page}
                    </button>
                  );
                })}
                <button onClick={() => setCatCurrentPage(p => Math.min(catTotalPages, p + 1))} disabled={catCurrentPage === catTotalPages}
                  className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {filteredCategories.length > 0 && catTotalPages <= 1 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Showing {filteredCategories.length} of {categories.length} categories</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
