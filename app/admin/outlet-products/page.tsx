'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  ShoppingBag,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  Store,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  X,
  RefreshCw,
  Package,
  Download,
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

interface OutletProduct {
  id: string;
  outlet_id: string;
  product_name: string;
  product_code: string;
  category: string;
  description: string;
  image_url: string;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  current_stock: number;
  stock_unit: string;
  reorder_level: number;
  shelf_life_days: number;
  is_from_bakery: boolean;
  bakery_product_id: string | null;
  is_active: boolean;
  barcode: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface BakeryProduct {
  id: string;
  name: string;
  code: string;
}

type ActiveTab = 'all' | 'bakery' | 'own' | 'low_stock';
type SortField = 'product_code' | 'product_name' | 'category' | 'retail_price' | 'current_stock' | 'shelf_life_days' | 'is_from_bakery' | 'is_active';
type SortDirection = 'asc' | 'desc';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'Baked Goods', 'Beverages', 'Pastries', 'Snacks', 'Supplies'] as const;
const STOCK_UNITS = ['pieces', 'kg', 'liters', 'boxes', 'packets'] as const;
const ITEMS_PER_PAGE = 10;

// ─── Default Form Data ──────────────────────────────────────────────────────

const defaultFormData = {
  product_name: '',
  category: 'General' as string,
  description: '',
  image_url: '',
  retail_price: 0,
  wholesale_price: 0,
  cost_price: 0,
  current_stock: 0,
  stock_unit: 'pieces' as string,
  reorder_level: 0,
  shelf_life_days: 0,
  is_from_bakery: false,
  bakery_product_id: '' as string,
  is_active: true,
  barcode: '',
  notes: '',
};

const defaultStockAdjustment = {
  adjustment: 0,
  notes: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OutletProductsPage() {
  // ─── Core State ─────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [products, setProducts] = useState<OutletProduct[]>([]);
  const [bakeryProducts, setBakeryProducts] = useState<BakeryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');

  // ─── Search, Filter, Sort ──────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Modals ─────────────────────────────────────────────────────────────────
  const [showProductModal, setShowProductModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState<string | null>(null);

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...defaultFormData });
  const [stockAdjustment, setStockAdjustment] = useState({ ...defaultStockAdjustment });

  // ─── Import State ───────────────────────────────────────────────────────────
  const [importSearch, setImportSearch] = useState('');
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [importingProducts, setImportingProducts] = useState(false);

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

  const fetchProducts = useCallback(async () => {
    if (!selectedOutletId) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('outlet_products')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });

      if (error) {
        showToast('Failed to load products: ' + error.message, 'error');
        return;
      }

      const items = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        product_name: (r.product_name || '') as string,
        product_code: (r.product_code || '') as string,
        category: (r.category || 'General') as string,
        description: (r.description || '') as string,
        image_url: (r.image_url || '') as string,
        retail_price: Number(r.retail_price) || 0,
        wholesale_price: Number(r.wholesale_price) || 0,
        cost_price: Number(r.cost_price) || 0,
        current_stock: Number(r.current_stock) || 0,
        stock_unit: (r.stock_unit || 'pieces') as string,
        reorder_level: Number(r.reorder_level) || 0,
        shelf_life_days: Number(r.shelf_life_days) || 0,
        is_from_bakery: Boolean(r.is_from_bakery),
        bakery_product_id: (r.bakery_product_id || null) as string | null,
        is_active: r.is_active !== false,
        barcode: (r.barcode || '') as string,
        notes: (r.notes || '') as string,
        created_at: (r.created_at || '') as string,
        updated_at: (r.updated_at || '') as string,
      }));

      setProducts(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load products: ' + msg, 'error');
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedOutletId]);

  const fetchBakeryProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('food_info')
        .select('id, product_name, code')
        .order('product_name', { ascending: true });

      if (error) {
        console.error('Failed to load bakery products:', error.message);
        return;
      }

      const items = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.product_name || r.name || '') as string,
        code: (r.code || '') as string,
      }));

      setBakeryProducts(items);
    } catch (err: unknown) {
      console.error('Failed to load bakery products:', err);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchOutlets();
    fetchBakeryProducts();
  }, [fetchOutlets, fetchBakeryProducts]);

  // Auto-select first outlet once outlets are loaded
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  useEffect(() => {
    if (selectedOutletId) {
      fetchProducts();
      setCurrentPage(1);
      setSearchTerm('');
      setFilterCategory('All');
      setFilterStatus('All');
      setActiveTab('all');
    }
  }, [selectedOutletId, fetchProducts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStatus, activeTab]);

  // ─── Sorting ──────────────────────────────────────────────────────────────

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

  // ─── Filtering, Sorting, Pagination ───────────────────────────────────────

  const filteredProducts = products
    .filter(product => {
      // Tab filter
      if (activeTab === 'bakery' && !product.is_from_bakery) return false;
      if (activeTab === 'own' && product.is_from_bakery) return false;
      if (activeTab === 'low_stock' && !(product.reorder_level > 0 && product.current_stock <= product.reorder_level)) return false;

      // Category filter
      if (filterCategory !== 'All' && product.category !== filterCategory) return false;

      // Status filter
      if (filterStatus === 'Active' && !product.is_active) return false;
      if (filterStatus === 'Inactive' && product.is_active) return false;

      // Search filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        product.product_name.toLowerCase().includes(term) ||
        product.product_code.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term) ||
        product.barcode.toLowerCase().includes(term) ||
        product.description.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (valA === valB ? 0 : valA ? 1 : -1) * dir;
      }
      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * dir;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      return String(valA || '').localeCompare(String(valB || '')) * dir;
    });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.is_active).length;
  const lowStockProducts = products.filter(p => p.reorder_level > 0 && p.current_stock <= p.reorder_level);
  const lowStockCount = lowStockProducts.length;
  const bakeryProductCount = products.filter(p => p.is_from_bakery).length;

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  const generateProductCode = async (): Promise<string> => {
    const outlet = getSelectedOutlet();
    const prefix = outlet?.code || 'OUT';

    // Get the highest existing sequential number for this outlet
    const outletProducts = products.filter(p => p.product_code.startsWith(prefix + '-'));
    let maxSeq = 0;
    outletProducts.forEach(p => {
      const parts = p.product_code.split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}-${nextSeq.toString().padStart(3, '0')}`;
  };

  const getProductById = (id: string): OutletProduct | undefined => {
    return products.find(p => p.id === id);
  };

  // ─── Form Helpers ─────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData({ ...defaultFormData });
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowProductModal(true);
  };

  const openEditModal = (product: OutletProduct) => {
    setFormData({
      product_name: product.product_name,
      category: product.category,
      description: product.description,
      image_url: product.image_url,
      retail_price: product.retail_price,
      wholesale_price: product.wholesale_price,
      cost_price: product.cost_price,
      current_stock: product.current_stock,
      stock_unit: product.stock_unit,
      reorder_level: product.reorder_level,
      shelf_life_days: product.shelf_life_days,
      is_from_bakery: product.is_from_bakery,
      bakery_product_id: product.bakery_product_id || '',
      is_active: product.is_active,
      barcode: product.barcode,
      notes: product.notes,
    });
    setEditingId(product.id);
    setShowProductModal(true);
  };

  const openStockModal = (productId: string) => {
    setStockAdjustment({ ...defaultStockAdjustment });
    setShowStockModal(productId);
  };

  const openImportModal = () => {
    setImportSearch('');
    setSelectedImportIds(new Set());
    setShowImportModal(true);
  };

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product_name.trim()) {
      showToast('Product name is required', 'error');
      return;
    }

    if (!selectedOutletId) {
      showToast('Please select an outlet first', 'error');
      return;
    }

    setSaving(true);

    try {
      let productCode = '';
      if (!editingId) {
        productCode = await generateProductCode();
      }

      const row: Record<string, unknown> = {
        outlet_id: selectedOutletId,
        product_name: formData.product_name.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        retail_price: formData.retail_price,
        wholesale_price: formData.wholesale_price,
        cost_price: formData.cost_price,
        current_stock: formData.current_stock,
        stock_unit: formData.stock_unit,
        reorder_level: formData.reorder_level,
        shelf_life_days: formData.shelf_life_days,
        is_from_bakery: formData.is_from_bakery,
        bakery_product_id: formData.is_from_bakery && formData.bakery_product_id ? formData.bakery_product_id : null,
        is_active: formData.is_active,
        barcode: formData.barcode.trim() || null,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (!editingId) {
        row.product_code = productCode;
      }

      if (editingId) {
        const { error } = await supabase
          .from('outlet_products')
          .update(row)
          .eq('id', editingId);
        if (error) throw error;

        logAudit({
          action: 'UPDATE',
          module: 'Outlet Products',
          record_id: editingId,
          details: { product_name: formData.product_name, outlet_id: selectedOutletId },
        });
        showToast('Product updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('outlet_products')
          .insert(row);
        if (error) throw error;

        logAudit({
          action: 'CREATE',
          module: 'Outlet Products',
          record_id: productCode,
          details: { product_name: formData.product_name, outlet_id: selectedOutletId },
        });
        showToast('Product added successfully', 'success');
      }

      await fetchProducts();
      resetForm();
      setShowProductModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to save product: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const deletedProduct = products.find(p => p.id === id);

      const { error } = await supabase
        .from('outlet_products')
        .delete()
        .eq('id', id);
      if (error) throw error;

      logAudit({
        action: 'DELETE',
        module: 'Outlet Products',
        record_id: id,
        details: { product_name: deletedProduct?.product_name, outlet_id: selectedOutletId },
      });

      setProducts(prev => prev.filter(p => p.id !== id));
      setShowDeleteConfirm(null);
      showToast('Product deleted', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete product: ${msg}`, 'error');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showStockModal) return;

    const product = products.find(p => p.id === showStockModal);
    if (!product) return;

    const newStock = product.current_stock + stockAdjustment.adjustment;
    if (newStock < 0) {
      showToast('Stock cannot be negative', 'error');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('outlet_products')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      if (error) throw error;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Products',
        record_id: product.id,
        details: {
          product_name: product.product_name,
          stock_adjustment: stockAdjustment.adjustment,
          previous_stock: product.current_stock,
          new_stock: newStock,
          notes: stockAdjustment.notes,
          outlet_id: selectedOutletId,
        },
      });

      await fetchProducts();
      setShowStockModal(null);
      setStockAdjustment({ ...defaultStockAdjustment });
      showToast('Stock updated successfully', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Stock adjustment failed: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImportBakeryProducts = async () => {
    if (selectedImportIds.size === 0) {
      showToast('Please select at least one product to import', 'error');
      return;
    }

    if (!selectedOutletId) {
      showToast('Please select an outlet first', 'error');
      return;
    }

    setImportingProducts(true);

    try {
      const outlet = getSelectedOutlet();
      const prefix = outlet?.code || 'OUT';

      // Get existing max sequence number
      const outletProducts = products.filter(p => p.product_code.startsWith(prefix + '-'));
      let maxSeq = 0;
      outletProducts.forEach(p => {
        const parts = p.product_code.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      });

      // Already imported bakery product IDs for this outlet
      const existingBakeryIds = new Set(
        products.filter(p => p.is_from_bakery && p.bakery_product_id).map(p => p.bakery_product_id)
      );

      const importIds = Array.from(selectedImportIds).filter(id => !existingBakeryIds.has(id));

      if (importIds.length === 0) {
        showToast('All selected products are already imported for this outlet', 'error');
        setImportingProducts(false);
        return;
      }

      const rows = importIds.map((bakeryId, index) => {
        const bakeryProduct = bakeryProducts.find(bp => bp.id === bakeryId);
        const seq = maxSeq + index + 1;
        return {
          outlet_id: selectedOutletId,
          product_name: bakeryProduct?.name || 'Bakery Product',
          product_code: `${prefix}-${seq.toString().padStart(3, '0')}`,
          category: 'Baked Goods',
          description: `Imported from bakery catalog: ${bakeryProduct?.code || ''}`,
          retail_price: 0,
          wholesale_price: 0,
          cost_price: 0,
          current_stock: 0,
          stock_unit: 'pieces',
          reorder_level: 0,
          shelf_life_days: 0,
          is_from_bakery: true,
          bakery_product_id: bakeryId,
          is_active: true,
          barcode: null,
          notes: `Linked to bakery product: ${bakeryProduct?.name} (${bakeryProduct?.code})`,
        };
      });

      const { error } = await supabase.from('outlet_products').insert(rows);
      if (error) throw error;

      logAudit({
        action: 'CREATE',
        module: 'Outlet Products',
        record_id: selectedOutletId,
        details: {
          action: 'bulk_import_bakery_products',
          count: importIds.length,
          outlet_id: selectedOutletId,
        },
      });

      await fetchProducts();
      setShowImportModal(false);
      setSelectedImportIds(new Set());
      setImportSearch('');
      showToast(`${importIds.length} bakery product(s) imported successfully`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Import failed: ${msg}`, 'error');
    } finally {
      setImportingProducts(false);
    }
  };

  // ─── Import Helpers ───────────────────────────────────────────────────────

  const existingBakeryIds = new Set(
    products.filter(p => p.is_from_bakery && p.bakery_product_id).map(p => p.bakery_product_id)
  );

  const filteredBakeryProducts = bakeryProducts.filter(bp => {
    if (!importSearch) return true;
    const term = importSearch.toLowerCase();
    return bp.name.toLowerCase().includes(term) || bp.code.toLowerCase().includes(term);
  });

  const toggleImportSelect = (id: string) => {
    setSelectedImportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Tab Counts ───────────────────────────────────────────────────────────

  const tabCounts = {
    all: products.length,
    bakery: bakeryProductCount,
    own: products.filter(p => !p.is_from_bakery).length,
    low_stock: lowStockCount,
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag size={28} className="text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Outlet Products</h1>
            </div>
            <p className="text-muted-foreground">
              Manage branch-specific product catalogs. Each outlet can have their own products in addition to items requisitioned from the main bakery.
            </p>
          </div>
          {selectedOutletId && outlets.length > 0 && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              <Plus size={16} /> Add Product
            </button>
          )}
        </div>
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

      {/* Main Content */}
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
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground">{totalProducts.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShoppingBag size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Products</p>
                  <p className="text-2xl font-bold text-green-600">{activeProducts.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${lowStockCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <AlertTriangle size={20} className={lowStockCount > 0 ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock Items</p>
                  <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {lowStockCount.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Store size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bakery Products</p>
                  <p className="text-2xl font-bold text-foreground">{bakeryProductCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 border-b border-border">
            <div className="flex gap-0">
              {(
                [
                  { key: 'all', label: 'All Products' },
                  { key: 'bakery', label: 'Bakery Products' },
                  { key: 'own', label: 'Own Products' },
                  { key: 'low_stock', label: 'Low Stock' },
                ] as { key: ActiveTab; label: string }[]
              ).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                      activeTab === tab.key
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {tabCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products, codes, barcodes..."
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchProducts()}
                className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Refresh products"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm"
              >
                <Download size={16} /> Import from Bakery
              </button>
            </div>
          </div>

          {/* Products Table */}
          {loadingProducts ? (
            <div className="flex items-center justify-center py-16 border border-border rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Loading products...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {products.length === 0
                  ? 'No Products Yet'
                  : 'No Products Match Your Filters'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {products.length === 0
                  ? `Add your first product for ${getSelectedOutlet()?.name || 'this outlet'}, or import products from the bakery catalog.`
                  : 'Try adjusting your search, filter, or tab criteria.'}
              </p>
              {products.length === 0 && (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
                  >
                    <Plus size={16} /> Add Product
                  </button>
                  <button
                    onClick={openImportModal}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium"
                  >
                    <Download size={16} /> Import from Bakery
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('product_code')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Product Code {renderSortIcon('product_code')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('product_name')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Name {renderSortIcon('product_name')}
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
                          onClick={() => handleSort('retail_price')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Price {renderSortIcon('retail_price')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('current_stock')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Stock {renderSortIcon('current_stock')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('shelf_life_days')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Shelf Life {renderSortIcon('shelf_life_days')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('is_from_bakery')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Source {renderSortIcon('is_from_bakery')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          onClick={() => handleSort('is_active')}
                          className="flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          Status {renderSortIcon('is_active')}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map(product => {
                      const isLowStock = product.reorder_level > 0 && product.current_stock <= product.reorder_level;
                      return (
                        <tr
                          key={product.id}
                          className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                            isLowStock ? 'bg-red-50/50' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">
                              {product.product_code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{product.product_name}</span>
                              {isLowStock && (
                                <span title="Low stock">
                                  <AlertTriangle size={14} className="text-red-500" />
                                </span>
                              )}
                            </div>
                            {product.barcode && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Barcode: {product.barcode}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {formatCurrency(product.retail_price)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isLowStock ? 'text-red-600' : ''}`}>
                              {product.current_stock.toLocaleString()} {product.stock_unit}
                            </span>
                            {isLowStock && (
                              <p className="text-[10px] text-red-500 mt-0.5">
                                Below reorder level ({product.reorder_level.toLocaleString()})
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {product.shelf_life_days > 0
                              ? `${product.shelf_life_days} day${product.shelf_life_days !== 1 ? 's' : ''}`
                              : '--'}
                          </td>
                          <td className="px-4 py-3">
                            {product.is_from_bakery ? (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                Bakery
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                Own
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                product.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => setShowDetailModal(product.id)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
                                title="View details"
                              >
                                <Eye size={12} className="inline mr-1" />
                                View
                              </button>
                              <button
                                onClick={() => openStockModal(product.id)}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium"
                                title="Adjust stock"
                              >
                                <ArrowUpDown size={12} className="inline mr-1" />
                                Stock
                              </button>
                              <button
                                onClick={() => openEditModal(product)}
                                className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 font-medium"
                                title="Edit product"
                              >
                                <Edit size={12} className="inline mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(product.id)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                                title="Delete product"
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
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of{' '}
                    {filteredProducts.length.toLocaleString()} products
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

          {/* Add / Edit Product Modal */}
          <Modal
            isOpen={showProductModal}
            onClose={() => {
              setShowProductModal(false);
              resetForm();
            }}
            title={editingId ? 'Edit Product' : 'Add Product'}
            size="xl"
          >
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <p className="text-xs text-muted-foreground">
                {editingId
                  ? 'Update the product details below.'
                  : `Adding product to ${getSelectedOutlet()?.name || 'selected outlet'}. Product code will be auto-generated. Fields marked with * are required.`}
              </p>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Chocolate Croissant, Iced Latte, Paper Napkins"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                />
              </div>

              {/* Category + Stock Unit */}
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
                  <label className="block text-xs font-semibold text-foreground mb-1">Stock Unit</label>
                  <select
                    value={formData.stock_unit}
                    onChange={(e) => setFormData({ ...formData, stock_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {STOCK_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea
                  placeholder="Brief product description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Retail Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.retail_price}
                    onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Wholesale Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.wholesale_price}
                    onChange={(e) => setFormData({ ...formData, wholesale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Cost Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Margin Preview */}
              {formData.cost_price > 0 && formData.retail_price > 0 && (
                <div className="px-3 py-2 bg-secondary rounded-lg text-xs">
                  <span className="text-muted-foreground">Retail Margin: </span>
                  <span className={`font-semibold ${formData.retail_price > formData.cost_price ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(formData.retail_price - formData.cost_price)} (
                    {((formData.retail_price - formData.cost_price) / formData.cost_price * 100).toFixed(1)}%)
                  </span>
                </div>
              )}

              {/* Stock + Reorder Level */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
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
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Shelf Life (days)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.shelf_life_days}
                    onChange={(e) => setFormData({ ...formData, shelf_life_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Bakery Source */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_from_bakery"
                    checked={formData.is_from_bakery}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_from_bakery: e.target.checked,
                        bakery_product_id: e.target.checked ? formData.bakery_product_id : '',
                      })
                    }
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="is_from_bakery" className="text-sm font-medium text-foreground">
                    This product is from the main bakery
                  </label>
                </div>
                {formData.is_from_bakery && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Link to Bakery Product
                    </label>
                    <select
                      value={formData.bakery_product_id}
                      onChange={(e) => setFormData({ ...formData, bakery_product_id: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                    >
                      <option value="">-- Select Bakery Product --</option>
                      {bakeryProducts.map(bp => (
                        <option key={bp.id} value={bp.id}>
                          {bp.name} {bp.code ? `(${bp.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Status + Barcode + Image */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={formData.is_active ? 'Active' : 'Inactive'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'Active' })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="Product barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/product-image.jpg"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  placeholder="Any additional notes about this product..."
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
                    setShowProductModal(false);
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
                  {saving ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={!!showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(null)}
            title="Delete Product"
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Are you sure?</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will permanently delete{' '}
                    <strong>{products.find(p => p.id === showDeleteConfirm)?.product_name}</strong>.
                    This action cannot be undone.
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
                  Delete Product
                </button>
              </div>
            </div>
          </Modal>

          {/* Product Detail Modal */}
          <Modal
            isOpen={!!showDetailModal}
            onClose={() => setShowDetailModal(null)}
            title="Product Details"
            size="xl"
          >
            {showDetailModal && getProductById(showDetailModal) && (() => {
              const product = getProductById(showDetailModal)!;
              const isLowStock = product.reorder_level > 0 && product.current_stock <= product.reorder_level;
              const linkedBakeryProduct = product.bakery_product_id
                ? bakeryProducts.find(bp => bp.id === product.bakery_product_id)
                : null;

              return (
                <div className="space-y-6">
                  {/* Product Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{product.product_name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-mono bg-secondary px-2 py-0.5 rounded text-xs">
                          {product.product_code}
                        </span>
                        {product.barcode && (
                          <span className="ml-2 text-xs">Barcode: {product.barcode}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {product.is_from_bakery ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          Bakery Product
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                          Own Product
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <div className="p-3 bg-secondary/50 rounded-lg">
                      <p className="text-sm text-foreground">{product.description}</p>
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Category</p>
                      <p className="font-semibold text-sm mt-1">{product.category}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Retail Price</p>
                      <p className="font-semibold text-sm mt-1">{formatCurrency(product.retail_price)}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Wholesale Price</p>
                      <p className="font-semibold text-sm mt-1">{formatCurrency(product.wholesale_price)}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cost Price</p>
                      <p className="font-semibold text-sm mt-1">{formatCurrency(product.cost_price)}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Current Stock</p>
                      <p className={`font-semibold text-sm mt-1 ${isLowStock ? 'text-red-600' : ''}`}>
                        {product.current_stock.toLocaleString()} {product.stock_unit}
                        {isLowStock && (
                          <span className="ml-1">
                            <AlertTriangle size={12} className="inline text-red-500" />
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Reorder Level</p>
                      <p className="font-semibold text-sm mt-1">
                        {product.reorder_level > 0
                          ? `${product.reorder_level.toLocaleString()} ${product.stock_unit}`
                          : 'Not set'}
                      </p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Shelf Life</p>
                      <p className="font-semibold text-sm mt-1">
                        {product.shelf_life_days > 0
                          ? `${product.shelf_life_days} day${product.shelf_life_days !== 1 ? 's' : ''}`
                          : 'Not set'}
                      </p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-semibold text-sm mt-1">{formatDateTime(product.created_at)}</p>
                    </div>
                    <div className="border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="font-semibold text-sm mt-1">{formatDateTime(product.updated_at)}</p>
                    </div>
                  </div>

                  {/* Margin Info */}
                  {product.cost_price > 0 && product.retail_price > 0 && (
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Retail Margin: </span>
                          <span className={`font-semibold ${product.retail_price > product.cost_price ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(product.retail_price - product.cost_price)} (
                            {((product.retail_price - product.cost_price) / product.cost_price * 100).toFixed(1)}%)
                          </span>
                        </div>
                        {product.wholesale_price > 0 && (
                          <div>
                            <span className="text-muted-foreground">Wholesale Margin: </span>
                            <span className={`font-semibold ${product.wholesale_price > product.cost_price ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(product.wholesale_price - product.cost_price)} (
                              {((product.wholesale_price - product.cost_price) / product.cost_price * 100).toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Linked Bakery Product */}
                  {product.is_from_bakery && linkedBakeryProduct && (
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Linked Bakery Product</h4>
                      <div className="flex items-center gap-3 text-sm">
                        <Store size={16} className="text-blue-600" />
                        <span className="font-medium text-blue-900">{linkedBakeryProduct.name}</span>
                        {linkedBakeryProduct.code && (
                          <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            {linkedBakeryProduct.code}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {product.notes && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                        {product.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 justify-end pt-4 border-t border-border">
                    <button
                      onClick={() => {
                        setShowDetailModal(null);
                        openStockModal(product.id);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                    >
                      <ArrowUpDown size={14} className="inline mr-1" /> Adjust Stock
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailModal(null);
                        openEditModal(product);
                      }}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                    >
                      <Edit size={14} className="inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => setShowDetailModal(null)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </Modal>

          {/* Import from Bakery Modal */}
          <Modal
            isOpen={showImportModal}
            onClose={() => {
              setShowImportModal(false);
              setSelectedImportIds(new Set());
              setImportSearch('');
            }}
            title="Import Products from Bakery"
            size="xl"
          >
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Select bakery products to add to {getSelectedOutlet()?.name || 'this outlet'}. Products already imported are marked.
              </p>

              {/* Import Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search bakery products..."
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
                {importSearch && (
                  <button
                    onClick={() => setImportSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Selection count */}
              {selectedImportIds.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <CheckSquare size={16} />
                  {selectedImportIds.size} product(s) selected for import
                </div>
              )}

              {/* Product List */}
              <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
                {filteredBakeryProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package size={32} className="mx-auto mb-2" />
                    <p className="text-sm">
                      {bakeryProducts.length === 0
                        ? 'No bakery products found in the catalog.'
                        : 'No products match your search.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary border-b border-border sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-center w-10"></th>
                        <th className="px-4 py-2 text-left font-semibold">Product Name</th>
                        <th className="px-4 py-2 text-left font-semibold">Code</th>
                        <th className="px-4 py-2 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBakeryProducts.map(bp => {
                        const alreadyImported = existingBakeryIds.has(bp.id);
                        const isSelected = selectedImportIds.has(bp.id);
                        return (
                          <tr
                            key={bp.id}
                            className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                              alreadyImported ? 'opacity-50' : ''
                            } ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            <td className="px-3 py-2 text-center">
                              {alreadyImported ? (
                                <span className="text-green-600" title="Already imported">
                                  <CheckSquare size={16} />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleImportSelect(bp.id)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {isSelected ? (
                                    <CheckSquare size={16} className="text-primary" />
                                  ) : (
                                    <Square size={16} />
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2 font-medium">{bp.name}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                                {bp.code || '--'}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {alreadyImported ? (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                                  Imported
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                                  Available
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Import Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedImportIds(new Set());
                    setImportSearch('');
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportBakeryProducts}
                  disabled={importingProducts || selectedImportIds.size === 0}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {importingProducts
                    ? 'Importing...'
                    : `Import ${selectedImportIds.size} Product${selectedImportIds.size !== 1 ? 's' : ''}`}
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
            title={`Stock Adjustment: ${getProductById(showStockModal || '')?.product_name || ''}`}
            size="md"
          >
            {showStockModal && getProductById(showStockModal) && (() => {
              const product = getProductById(showStockModal)!;
              const newStock = product.current_stock + stockAdjustment.adjustment;
              const isLowStock = product.reorder_level > 0 && product.current_stock <= product.reorder_level;

              return (
                <form onSubmit={handleStockAdjustment} className="space-y-4">
                  {/* Current Stock Info */}
                  <div className="p-3 bg-secondary rounded-lg">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Stock</p>
                        <p className={`font-bold ${isLowStock ? 'text-red-600' : ''}`}>
                          {product.current_stock.toLocaleString()} {product.stock_unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p className="font-medium">{product.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reorder Level</p>
                        <p className="font-medium">
                          {product.reorder_level > 0
                            ? `${product.reorder_level.toLocaleString()} ${product.stock_unit}`
                            : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Adjustment */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Stock Adjustment *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Positive to add, negative to subtract"
                      value={stockAdjustment.adjustment || ''}
                      onChange={(e) =>
                        setStockAdjustment({ ...stockAdjustment, adjustment: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Use positive values to increase stock, negative values to decrease stock.
                    </p>
                  </div>

                  {/* Preview */}
                  {stockAdjustment.adjustment !== 0 && (
                    <div className={`px-3 py-2 rounded-lg text-xs ${newStock < 0 ? 'bg-red-50' : 'bg-secondary'}`}>
                      <span className="text-muted-foreground">New stock will be: </span>
                      <span className={`font-bold ${
                        newStock < 0
                          ? 'text-red-600'
                          : stockAdjustment.adjustment > 0
                          ? 'text-green-600'
                          : 'text-orange-600'
                      }`}>
                        {newStock.toLocaleString()} {product.stock_unit}
                      </span>
                      {newStock < 0 && (
                        <span className="text-red-600 ml-2">(cannot be negative!)</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                    <textarea
                      placeholder="Reason for stock adjustment..."
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
                      disabled={saving || stockAdjustment.adjustment === 0 || newStock < 0}
                      className={`px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 ${
                        stockAdjustment.adjustment > 0 ? 'bg-green-600' : 'bg-orange-600'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Update Stock'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </Modal>
        </>
      )}
    </div>
  );
}
