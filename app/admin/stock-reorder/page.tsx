'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { Search, ChevronLeft, ChevronRight, AlertTriangle, Package, Clock, CheckCircle, XCircle, Plus, RefreshCw } from 'lucide-react';
import { logAudit } from '@/lib/audit-logger';

// ── Interfaces ──

interface PricingTier {
  id: string;
  productCode: string;
  productName: string;
  recipeId: string;
  recipeName: string;
  retailPrice: number;
  wholesalePrice: number;
  active: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  reorderQty: number;
  lastRestocked: string;
}

interface StockProduct {
  id: string;
  productName: string;
  productCode: string;
  recipeId: string;
  recipeName: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  retailPrice: number;
  status: 'In Stock' | 'Low' | 'Out of Stock';
  salesVelocity: number;
  soldOutToday: boolean;
  inventoryItemId: string;
}

interface Requisition {
  id: string;
  productName: string;
  productId: string;
  quantityRequested: number;
  quantityApproved: number;
  priority: 'Urgent' | 'Normal' | 'Low';
  status: 'Pending' | 'Approved' | 'In Production' | 'Completed' | 'Rejected';
  requestedBy: string;
  approvedBy: string;
  notes: string;
  linkedProductionRunId: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductionQueueItem {
  id: string;
  requisitionId: string;
  productName: string;
  recipeCode: string;
  recipeName: string;
  batchSize: number;
  prepTime: number;
  bakeTime: number;
  status: string;
  operator: string;
  startTime: string;
  createdAt: string;
}

interface RecipeLookup {
  id: string;
  name: string;
  code: string;
  batchSize: number;
  expectedOutput: number;
  outputUnit: string;
  prepTime: number;
  bakeTime: number;
}

type TabType = 'stock-levels' | 'requisitions' | 'production-queue';

const ITEMS_PER_PAGE = 10;

// ── Page Component ──

export default function StockReorderPage() {
  // Data state
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [productionQueue, setProductionQueue] = useState<ProductionQueueItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeLookup[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('stock-levels');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'In Stock' | 'Low' | 'Out of Stock'>('All');
  const [reqStatusFilter, setReqStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'In Production' | 'Completed' | 'Rejected'>('All');

  // Pagination
  const [stockPage, setStockPage] = useState(1);
  const [reqPage, setReqPage] = useState(1);
  const [prodPage, setProdPage] = useState(1);

  // Modals
  const [showRequisitionForm, setShowRequisitionForm] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<Requisition | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Requisition | null>(null);
  const [showProductionDetail, setShowProductionDetail] = useState<ProductionQueueItem | null>(null);

  // Form state
  const [reqFormData, setReqFormData] = useState({
    productId: '',
    productName: '',
    quantityRequested: 0,
    priority: 'Normal' as 'Urgent' | 'Normal' | 'Low',
    notes: '',
    requestedBy: '',
  });
  const [approveQty, setApproveQty] = useState(0);
  const [rejectReason, setRejectReason] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Data Fetching ──

  const fetchStockData = useCallback(async () => {
    try {
      // Fetch active products from pricing_tiers
      const { data: tierData } = await supabase
        .from('pricing_tiers')
        .select('*')
        .eq('active', true)
        .order('product_name');

      // Fetch inventory items
      const { data: invData } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');

      // Fetch recent POS sales (last 7 days) for sales velocity
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: salesData } = await supabase
        .from('pos_sales')
        .select('id, created_at')
        .gte('created_at', sevenDaysAgo)
        .neq('customer_name', 'SHIFT CLOSE');

      // Fetch POS sale items for velocity calculation
      const saleIds = (salesData || []).map((s: Record<string, unknown>) => s.id as string);
      let saleItemsMap: Record<string, number> = {};
      if (saleIds.length > 0) {
        const { data: saleItemsData } = await supabase
          .from('pos_sale_items')
          .select('product_name, quantity')
          .in('sale_id', saleIds);
        if (saleItemsData) {
          for (const item of saleItemsData) {
            const name = ((item as Record<string, unknown>).product_name || '') as string;
            const qty = ((item as Record<string, unknown>).quantity || 0) as number;
            saleItemsMap[name.toLowerCase()] = (saleItemsMap[name.toLowerCase()] || 0) + qty;
          }
        }
      }

      // Fetch today's sales to detect sold-out items
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todaySalesData } = await supabase
        .from('pos_sales')
        .select('id')
        .gte('created_at', todayStart.toISOString())
        .neq('customer_name', 'SHIFT CLOSE');

      const todaySaleIds = (todaySalesData || []).map((s: Record<string, unknown>) => s.id as string);
      let todaySoldItems: Set<string> = new Set();
      if (todaySaleIds.length > 0) {
        const { data: todayItemsData } = await supabase
          .from('pos_sale_items')
          .select('product_name')
          .in('sale_id', todaySaleIds);
        if (todayItemsData) {
          for (const item of todayItemsData) {
            todaySoldItems.add(((item as Record<string, unknown>).product_name || '') as string);
          }
        }
      }

      // Fetch recent orders for additional velocity data
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .gte('created_at', sevenDaysAgo);

      const orderIds = (orderData || []).map((o: Record<string, unknown>) => o.id as string);
      if (orderIds.length > 0) {
        const { data: orderItemsData } = await supabase
          .from('order_items')
          .select('product_name, quantity')
          .in('order_id', orderIds);
        if (orderItemsData) {
          for (const item of orderItemsData) {
            const name = ((item as Record<string, unknown>).product_name || '') as string;
            const qty = ((item as Record<string, unknown>).quantity || 0) as number;
            saleItemsMap[name.toLowerCase()] = (saleItemsMap[name.toLowerCase()] || 0) + qty;
          }
        }
      }

      // Build inventory lookup by name (lowercase)
      const invLookup: Record<string, InventoryItem> = {};
      if (invData) {
        for (const r of invData) {
          const rec = r as Record<string, unknown>;
          const item: InventoryItem = {
            id: rec.id as string,
            name: (rec.name || '') as string,
            type: (rec.type || 'Consumable') as string,
            category: (rec.category || '') as string,
            quantity: (rec.quantity || 0) as number,
            unit: (rec.unit || 'pieces') as string,
            unitCost: (rec.unit_cost || 0) as number,
            reorderLevel: (rec.reorder_level || 0) as number,
            reorderQty: (rec.reorder_qty || 0) as number,
            lastRestocked: (rec.last_restocked || '') as string,
          };
          invLookup[item.name.toLowerCase()] = item;
        }
      }

      // Combine pricing tiers with inventory data
      const stockProducts: StockProduct[] = [];
      if (tierData) {
        for (const r of tierData) {
          const rec = r as Record<string, unknown>;
          const productName = (rec.product_name || '') as string;
          const inv = invLookup[productName.toLowerCase()];

          const currentStock = inv ? inv.quantity : 0;
          const reorderLevel = inv ? inv.reorderLevel : 5;
          const unit = inv ? inv.unit : 'pieces';
          const dailyVelocity = Math.round(((saleItemsMap[productName.toLowerCase()] || 0) / 7) * 10) / 10;
          const isSoldOutToday = todaySoldItems.has(productName) && currentStock <= 0;

          let status: StockProduct['status'] = 'In Stock';
          if (currentStock <= 0) status = 'Out of Stock';
          else if (reorderLevel > 0 && currentStock <= reorderLevel) status = 'Low';

          stockProducts.push({
            id: rec.id as string,
            productName,
            productCode: (rec.product_code || '') as string,
            recipeId: (rec.recipe_id || '') as string,
            recipeName: (rec.recipe_name || '') as string,
            currentStock,
            reorderLevel,
            unit,
            retailPrice: (rec.retail_price || 0) as number,
            status,
            salesVelocity: dailyVelocity,
            soldOutToday: isSoldOutToday,
            inventoryItemId: inv ? inv.id : '',
          });
        }
      }

      setProducts(stockProducts);
    } catch (err) {
      console.error('Failed to fetch stock data:', err);
    }
  }, []);

  const fetchRequisitions = useCallback(async () => {
    const { data, error } = await supabase
      .from('stock_requisitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch requisitions:', error.message);
      setRequisitions([]);
      return;
    }

    if (data && data.length > 0) {
      setRequisitions(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        productName: (r.product_name || '') as string,
        productId: (r.product_id || '') as string,
        quantityRequested: (r.quantity_requested || 0) as number,
        quantityApproved: (r.quantity_approved || 0) as number,
        priority: (r.priority || 'Normal') as Requisition['priority'],
        status: (r.status || 'Pending') as Requisition['status'],
        requestedBy: (r.requested_by || '') as string,
        approvedBy: (r.approved_by || '') as string,
        notes: (r.notes || '') as string,
        linkedProductionRunId: (r.linked_production_run_id || '') as string,
        createdAt: (r.created_at || '') as string,
        updatedAt: (r.updated_at || '') as string,
      })));
    } else {
      setRequisitions([]);
    }
  }, []);

  const fetchProductionQueue = useCallback(async () => {
    // Fetch production runs that are linked to requisitions (or recently scheduled)
    const { data } = await supabase
      .from('production_runs')
      .select('*')
      .in('status', ['scheduled', 'in-progress'])
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      // Get linked requisitions for these runs
      const runIds = data.map((r: Record<string, unknown>) => r.id as string);
      const { data: linkedReqs } = await supabase
        .from('stock_requisitions')
        .select('id, product_name, linked_production_run_id')
        .in('linked_production_run_id', runIds);

      const reqMap: Record<string, { id: string; productName: string }> = {};
      if (linkedReqs) {
        for (const req of linkedReqs) {
          const rec = req as Record<string, unknown>;
          const runId = (rec.linked_production_run_id || '') as string;
          if (runId) {
            reqMap[runId] = {
              id: rec.id as string,
              productName: (rec.product_name || '') as string,
            };
          }
        }
      }

      setProductionQueue(data.map((r: Record<string, unknown>) => {
        const runId = r.id as string;
        const linked = reqMap[runId];
        return {
          id: runId,
          requisitionId: linked ? linked.id : '',
          productName: linked ? linked.productName : (r.recipe_code || '') as string,
          recipeCode: (r.recipe_code || '') as string,
          recipeName: '',
          batchSize: (r.batch_size || 0) as number,
          prepTime: 0,
          bakeTime: 0,
          status: (r.status || 'scheduled') as string,
          operator: (r.operator || '') as string,
          startTime: (r.start_time || '') as string,
          createdAt: (r.created_at || '') as string,
        };
      }));
    } else {
      setProductionQueue([]);
    }
  }, []);

  const fetchRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('id, name, code, batch_size, expected_output, output_unit, prep_time, bake_time')
      .eq('status', 'active')
      .order('name');

    if (data) {
      setRecipes(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        code: (r.code || '') as string,
        batchSize: (r.batch_size || 0) as number,
        expectedOutput: (r.expected_output || 0) as number,
        outputUnit: (r.output_unit || 'pieces') as string,
        prepTime: (r.prep_time || 0) as number,
        bakeTime: (r.bake_time || 0) as number,
      })));
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchStockData(), fetchRequisitions(), fetchProductionQueue(), fetchRecipes()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchStockData, fetchRequisitions, fetchProductionQueue, fetchRecipes]);

  // Reset pagination on filter/search changes
  useEffect(() => { setStockPage(1); }, [searchTerm, statusFilter]);
  useEffect(() => { setReqPage(1); }, [reqStatusFilter]);

  // ── Dashboard Metrics ──

  const itemsBelowReorder = products.filter(p => p.status === 'Low').length;
  const activeRequisitions = requisitions.filter(r => ['Pending', 'Approved', 'In Production'].includes(r.status)).length;
  const batchesPendingProduction = productionQueue.filter(q => q.status === 'scheduled').length;
  const itemsOutOfStock = products.filter(p => p.status === 'Out of Stock').length;

  // ── Stock Level Filtering ──

  const filteredProducts = products.filter(p => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.productName.toLowerCase().includes(term) ||
      p.productCode.toLowerCase().includes(term) ||
      p.recipeName.toLowerCase().includes(term)
    );
  });

  const stockTotalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((stockPage - 1) * ITEMS_PER_PAGE, stockPage * ITEMS_PER_PAGE);

  // ── Requisition Filtering ──

  const filteredRequisitions = requisitions.filter(r => {
    if (reqStatusFilter === 'All') return true;
    return r.status === reqStatusFilter;
  });

  const reqTotalPages = Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE);
  const paginatedRequisitions = filteredRequisitions.slice((reqPage - 1) * ITEMS_PER_PAGE, reqPage * ITEMS_PER_PAGE);

  // ── Production Queue Pagination ──

  const prodTotalPages = Math.ceil(productionQueue.length / ITEMS_PER_PAGE);
  const paginatedProductionQueue = productionQueue.slice((prodPage - 1) * ITEMS_PER_PAGE, prodPage * ITEMS_PER_PAGE);

  // ── Handlers ──

  const handleRequestRestock = (product: StockProduct) => {
    setReqFormData({
      productId: product.id,
      productName: product.productName,
      quantityRequested: product.reorderLevel > 0 ? product.reorderLevel * 2 : 50,
      priority: product.status === 'Out of Stock' ? 'Urgent' : 'Normal',
      notes: '',
      requestedBy: '',
    });
    setShowRequisitionForm(true);
  };

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqFormData.productName.trim()) {
      showToast('Product name is required', 'error');
      return;
    }
    if (reqFormData.quantityRequested <= 0) {
      showToast('Quantity must be greater than zero', 'error');
      return;
    }
    if (!reqFormData.requestedBy.trim()) {
      showToast('Requested by is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const { data: reqData, error } = await supabase.from('stock_requisitions').insert({
        product_name: reqFormData.productName.trim(),
        product_id: reqFormData.productId || null,
        quantity_requested: reqFormData.quantityRequested,
        quantity_approved: 0,
        priority: reqFormData.priority,
        status: 'Pending',
        requested_by: reqFormData.requestedBy.trim(),
        approved_by: null,
        notes: reqFormData.notes.trim() || null,
        linked_production_run_id: null,
      }).select().single();
      if (error) throw error;
      logAudit({
        action: 'CREATE',
        module: 'Stock Reorder',
        record_id: reqData?.id || '',
        details: {
          product_name: reqFormData.productName.trim(),
          quantity_requested: reqFormData.quantityRequested,
          priority: reqFormData.priority,
          requested_by: reqFormData.requestedBy.trim(),
        },
      });
      showToast('Requisition created successfully', 'success');
      await fetchRequisitions();
      setShowRequisitionForm(false);
      resetReqForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to create requisition: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetReqForm = () => {
    setReqFormData({
      productId: '',
      productName: '',
      quantityRequested: 0,
      priority: 'Normal',
      notes: '',
      requestedBy: '',
    });
  };

  const handleApproveRequisition = async () => {
    if (!showApproveModal) return;
    if (approveQty <= 0) {
      showToast('Approved quantity must be greater than zero', 'error');
      return;
    }

    setSaving(true);
    try {
      // Find the matching recipe for this product
      const product = products.find(p => p.productName === showApproveModal.productName);
      let recipeMatch: RecipeLookup | undefined;
      if (product && product.recipeId) {
        recipeMatch = recipes.find(r => r.id === product.recipeId);
      }
      if (!recipeMatch) {
        // Try to match by name
        recipeMatch = recipes.find(r =>
          r.name.toLowerCase().includes(showApproveModal.productName.toLowerCase()) ||
          showApproveModal.productName.toLowerCase().includes(r.name.toLowerCase())
        );
      }

      let linkedRunId: string | null = null;

      // Create a production run if recipe is found
      if (recipeMatch) {
        const { data: runData, error: runError } = await supabase
          .from('production_runs')
          .insert({
            recipe_code: recipeMatch.code,
            recipe_id: recipeMatch.id,
            batch_size: approveQty,
            status: 'scheduled',
            notes: `Auto-created from requisition #${showApproveModal.id.slice(0, 8)} for ${showApproveModal.productName}`,
          })
          .select()
          .single();

        if (runError) throw runError;
        if (runData) linkedRunId = (runData as Record<string, unknown>).id as string;
      }

      // Update the requisition
      const { error } = await supabase
        .from('stock_requisitions')
        .update({
          status: 'Approved',
          quantity_approved: approveQty,
          approved_by: 'Admin',
          linked_production_run_id: linkedRunId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', showApproveModal.id);

      if (error) throw error;

      showToast(`Requisition approved${recipeMatch ? ' and production run created' : ''}`, 'success');
      await Promise.all([fetchRequisitions(), fetchProductionQueue()]);
      setShowApproveModal(null);
      setApproveQty(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to approve: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectRequisition = async () => {
    if (!showRejectModal) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('stock_requisitions')
        .update({
          status: 'Rejected',
          notes: rejectReason ? `${showRejectModal.notes ? showRejectModal.notes + ' | ' : ''}Rejection reason: ${rejectReason}` : showRejectModal.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', showRejectModal.id);

      if (error) throw error;
      showToast('Requisition rejected', 'success');
      await fetchRequisitions();
      setShowRejectModal(null);
      setRejectReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to reject: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInProduction = async (req: Requisition) => {
    try {
      const { error } = await supabase
        .from('stock_requisitions')
        .update({ status: 'In Production', updated_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;
      showToast('Requisition marked as In Production', 'success');
      await fetchRequisitions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to update: ${msg}`, 'error');
    }
  };

  const handleMarkCompleted = async (req: Requisition) => {
    try {
      const { error } = await supabase
        .from('stock_requisitions')
        .update({ status: 'Completed', updated_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;

      // If there is a linked production run, mark it as completed too
      if (req.linkedProductionRunId) {
        await supabase
          .from('production_runs')
          .update({ status: 'completed', end_time: new Date().toISOString() })
          .eq('id', req.linkedProductionRunId);
      }

      showToast('Requisition completed', 'success');
      await Promise.all([fetchRequisitions(), fetchProductionQueue(), fetchStockData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to update: ${msg}`, 'error');
    }
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchStockData(), fetchRequisitions(), fetchProductionQueue()]);
    setLoading(false);
    showToast('Data refreshed', 'success');
  };

  // ── Helper Functions ──

  const getStatusBadge = (status: StockProduct['status']) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Low': return 'bg-yellow-100 text-yellow-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
    }
  };

  const getRowBg = (status: StockProduct['status'], soldOutToday: boolean) => {
    if (soldOutToday) return 'bg-red-50/70';
    switch (status) {
      case 'Out of Stock': return 'bg-red-50/50';
      case 'Low': return 'bg-yellow-50/50';
      default: return '';
    }
  };

  const getReqStatusBadge = (status: Requisition['status']) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-blue-100 text-blue-800';
      case 'In Production': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
    }
  };

  const getPriorityBadge = (priority: Requisition['priority']) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-600 text-white';
      case 'Normal': return 'bg-gray-100 text-gray-800';
      case 'Low': return 'bg-gray-50 text-gray-500';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getRecipeForProduct = (productName: string, recipeId: string): RecipeLookup | undefined => {
    if (recipeId) {
      const match = recipes.find(r => r.id === recipeId);
      if (match) return match;
    }
    return recipes.find(r =>
      r.name.toLowerCase().includes(productName.toLowerCase()) ||
      productName.toLowerCase().includes(r.name.toLowerCase())
    );
  };

  const estimateProductionTime = (recipe: RecipeLookup | undefined): string => {
    if (!recipe) return 'N/A';
    const totalMinutes = recipe.prepTime + recipe.bakeTime;
    if (totalMinutes <= 0) return 'N/A';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // ── Pagination Component ──

  const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, label }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    label: string;
  }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} {label}
        </p>
        <div className="flex gap-1 items-center">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                onClick={() => onPageChange(page)}
                className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}
              >
                {page}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading stock reorder data...</p>
        </div>
      </div>
    );
  }

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

      {/* Page Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2">Stock Reordering &amp; Requisitions</h1>
          <p className="text-muted-foreground">Monitor stock levels, create requisitions, and trigger batch production when items sell out</p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Sold Out Today Alert */}
      {products.filter(p => p.soldOutToday).length > 0 && (
        <div className="mb-6 border-2 border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-bold text-red-800">Items Sold Out Today</h3>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">
              {products.filter(p => p.soldOutToday).length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {products.filter(p => p.soldOutToday).map(p => (
              <button
                key={p.id}
                onClick={() => handleRequestRestock(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm text-red-800 hover:bg-red-100 transition-colors"
              >
                <span className="font-semibold">{p.productName}</span>
                <span className="text-xs text-red-500">&mdash; Request Restock</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <AlertTriangle size={20} className="text-yellow-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Below Reorder Level</p>
              <p className={`text-2xl font-bold ${itemsBelowReorder > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{itemsBelowReorder}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Package size={20} className="text-blue-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Requisitions</p>
              <p className="text-2xl font-bold">{activeRequisitions}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Clock size={20} className="text-purple-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Production</p>
              <p className="text-2xl font-bold">{batchesPendingProduction}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <XCircle size={20} className="text-red-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Out of Stock</p>
              <p className={`text-2xl font-bold ${itemsOutOfStock > 0 ? 'text-red-600' : 'text-green-600'}`}>{itemsOutOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('stock-levels')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'stock-levels'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Stock Levels
        </button>
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors relative ${
            activeTab === 'requisitions'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Requisitions
          {activeRequisitions > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeRequisitions}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('production-queue')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors relative ${
            activeTab === 'production-queue'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Production Queue
          {batchesPendingProduction > 0 && (
            <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {batchesPendingProduction}
            </span>
          )}
        </button>
      </div>

      {/* ─── Tab: Stock Levels ─── */}
      {activeTab === 'stock-levels' && (
        <div>
          {/* Search / Filter / Actions Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products, SKU codes..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Low">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
            <button
              onClick={() => {
                resetReqForm();
                setShowRequisitionForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              <Plus size={16} />
              New Requisition
            </button>
          </div>

          {/* Stock Monitor Table */}
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product Name</th>
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold">Current Stock</th>
                  <th className="px-4 py-3 text-left font-semibold">Reorder Level</th>
                  <th className="px-4 py-3 text-left font-semibold">Sales/Day</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Recipe</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'No products match your search.' : 'No active products found. Add products in Pricing to see them here.'}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map(product => {
                    const recipe = getRecipeForProduct(product.productName, product.recipeId);
                    return (
                      <tr key={product.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${getRowBg(product.status, product.soldOutToday)}`}>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {product.productName}
                            {product.soldOutToday && (
                              <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">SOLD OUT TODAY</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{product.productCode || '--'}</td>
                        <td className="px-4 py-3 font-medium">
                          <span className={product.currentStock <= 0 ? 'text-red-600 font-bold' : ''}>
                            {product.currentStock} {product.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{product.reorderLevel} {product.unit}</td>
                        <td className="px-4 py-3">
                          {product.salesVelocity > 0 ? (
                            <span className="text-sm">{product.salesVelocity}/day</span>
                          ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(product.status)}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {recipe ? (
                            <div>
                              <span className="font-medium text-foreground">{recipe.code}</span>
                              <span className="block text-[10px]">{estimateProductionTime(recipe)} est.</span>
                            </div>
                          ) : (
                            <span>&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(product.status === 'Low' || product.status === 'Out of Stock') ? (
                            <button
                              onClick={() => handleRequestRestock(product)}
                              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
                            >
                              Request Restock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRequestRestock(product)}
                              className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary font-medium text-muted-foreground"
                            >
                              Request
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={stockPage}
            totalPages={stockTotalPages}
            onPageChange={setStockPage}
            totalItems={filteredProducts.length}
            label="products"
          />
        </div>
      )}

      {/* ─── Tab: Requisitions ─── */}
      {activeTab === 'requisitions' && (
        <div>
          {/* Filter / Actions Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value as typeof reqStatusFilter)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="In Production">In Production</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <button
              onClick={() => {
                resetReqForm();
                setShowRequisitionForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              <Plus size={16} />
              New Requisition
            </button>
          </div>

          {/* Requisitions Table */}
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Qty Requested</th>
                  <th className="px-4 py-3 text-left font-semibold">Qty Approved</th>
                  <th className="px-4 py-3 text-left font-semibold">Priority</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Requested By</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No requisitions found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  paginatedRequisitions.map(req => (
                    <tr key={req.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {req.productName}
                        {req.notes && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate" title={req.notes}>
                            {req.notes}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{req.quantityRequested}</td>
                      <td className="px-4 py-3">
                        {req.quantityApproved > 0 ? (
                          <span className="font-medium text-green-700">{req.quantityApproved}</span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityBadge(req.priority)}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getReqStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{req.requestedBy}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(req.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {req.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => { setShowApproveModal(req); setApproveQty(req.quantityRequested); }}
                                className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setShowRejectModal(req)}
                                className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'Approved' && (
                            <button
                              onClick={() => handleMarkInProduction(req)}
                              className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200 font-medium"
                            >
                              Start Production
                            </button>
                          )}
                          {req.status === 'In Production' && (
                            <button
                              onClick={() => handleMarkCompleted(req)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium"
                            >
                              Mark Completed
                            </button>
                          )}
                          {req.linkedProductionRunId && (
                            <span className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded font-medium" title={`Production Run: ${req.linkedProductionRunId.slice(0, 8)}`}>
                              Linked Run
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={reqPage}
            totalPages={reqTotalPages}
            onPageChange={setReqPage}
            totalItems={filteredRequisitions.length}
            label="requisitions"
          />
        </div>
      )}

      {/* ─── Tab: Production Queue ─── */}
      {activeTab === 'production-queue' && (
        <div>
          {productionQueue.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Clock size={40} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No batches in the production queue</p>
              <p className="text-sm text-muted-foreground">Approve a requisition to trigger a production run.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {paginatedProductionQueue.map(item => {
                  const recipe = recipes.find(r => r.code === item.recipeCode);
                  return (
                    <div
                      key={item.id}
                      className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setShowProductionDetail(item)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-sm">{item.productName || item.recipeCode}</h3>
                          <p className="text-xs text-muted-foreground">Recipe: {item.recipeCode || 'N/A'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                          item.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status === 'in-progress' ? 'In Progress' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Batch Size:</span>
                          <span className="font-medium">{item.batchSize}</span>
                        </div>
                        {recipe && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Expected Output:</span>
                              <span className="font-medium">{recipe.expectedOutput} {recipe.outputUnit}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Prep + Bake Time:</span>
                              <span className="font-medium">{estimateProductionTime(recipe)}</span>
                            </div>
                          </>
                        )}
                        {item.operator && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Operator:</span>
                            <span className="font-medium">{item.operator}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">{formatDate(item.createdAt)}</span>
                        </div>
                      </div>

                      {item.startTime && (
                        <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
                          Started: {formatDateTime(item.startTime)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={prodPage}
                totalPages={prodTotalPages}
                onPageChange={setProdPage}
                totalItems={productionQueue.length}
                label="batches"
              />
            </>
          )}
        </div>
      )}

      {/* ─── Create Requisition Modal ─── */}
      <Modal
        isOpen={showRequisitionForm}
        onClose={() => { setShowRequisitionForm(false); resetReqForm(); }}
        title="Create Stock Requisition"
        size="lg"
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Request a new batch production for low-stock or out-of-stock items.
          </p>

          {/* Product selection - if there are low/out-of-stock items, show as quick picks */}
          {products.filter(p => p.status === 'Low' || p.status === 'Out of Stock').length > 0 && !reqFormData.productName && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800 mb-2">Quick Pick &mdash; Items Needing Restock:</p>
              <div className="flex flex-wrap gap-1.5">
                {products.filter(p => p.status === 'Low' || p.status === 'Out of Stock').map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReqFormData({
                      ...reqFormData,
                      productId: p.id,
                      productName: p.productName,
                      quantityRequested: p.reorderLevel > 0 ? p.reorderLevel * 2 : 50,
                      priority: p.status === 'Out of Stock' ? 'Urgent' : 'Normal',
                    })}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                      p.status === 'Out of Stock'
                        ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                        : 'border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
                    }`}
                  >
                    {p.productName} ({p.currentStock} left)
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Product Name *</label>
            <input
              type="text"
              value={reqFormData.productName}
              onChange={(e) => setReqFormData({ ...reqFormData, productName: e.target.value })}
              placeholder="Select from quick picks above or type a product name"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Quantity Needed *</label>
              <input
                type="number"
                min="1"
                value={reqFormData.quantityRequested}
                onChange={(e) => setReqFormData({ ...reqFormData, quantityRequested: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={reqFormData.priority}
                onChange={(e) => setReqFormData({ ...reqFormData, priority: e.target.value as Requisition['priority'] })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Requested By *</label>
            <input
              type="text"
              value={reqFormData.requestedBy}
              onChange={(e) => setReqFormData({ ...reqFormData, requestedBy: e.target.value })}
              placeholder="Baker / Manager name"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={reqFormData.notes}
              onChange={(e) => setReqFormData({ ...reqFormData, notes: e.target.value })}
              placeholder="e.g. Morning batch sold out by 10 AM, need second batch for afternoon"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={3}
            />
          </div>

          {/* Recipe preview */}
          {reqFormData.productName && (() => {
            const product = products.find(p => p.productName === reqFormData.productName);
            const recipe = product ? getRecipeForProduct(product.productName, product.recipeId) : undefined;
            if (!recipe) return null;
            return (
              <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1">Matching Recipe Found:</p>
                <div className="text-xs text-blue-700 space-y-0.5">
                  <p><strong>{recipe.name}</strong> (Code: {recipe.code})</p>
                  <p>Batch Size: {recipe.batchSize} &mdash; Expected Output: {recipe.expectedOutput} {recipe.outputUnit}</p>
                  <p>Estimated Time: Prep {recipe.prepTime}m + Bake {recipe.bakeTime}m = {estimateProductionTime(recipe)}</p>
                </div>
              </div>
            );
          })()}

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowRequisitionForm(false); resetReqForm(); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Requisition'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Approve Requisition Modal ─── */}
      <Modal
        isOpen={!!showApproveModal}
        onClose={() => { setShowApproveModal(null); setApproveQty(0); }}
        title={`Approve Requisition: ${showApproveModal?.productName || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-3 bg-secondary/50">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Requested:</span>
                <span className="ml-2 font-medium">{showApproveModal?.quantityRequested}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${getPriorityBadge(showApproveModal?.priority || 'Normal')}`}>
                  {showApproveModal?.priority}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Requested By:</span>
                <span className="ml-2 font-medium">{showApproveModal?.requestedBy}</span>
              </div>
              {showApproveModal?.notes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Notes:</span>
                  <span className="ml-2 text-sm">{showApproveModal.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Show matched recipe info */}
          {showApproveModal && (() => {
            const product = products.find(p => p.productName === showApproveModal.productName);
            const recipe = product ? getRecipeForProduct(product.productName, product.recipeId) : undefined;
            if (!recipe) return (
              <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 text-xs text-yellow-800">
                No matching recipe found. A production run will not be auto-created. You can manually create one in the Production module.
              </div>
            );
            return (
              <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-800 mb-1">Production Run Will Be Created:</p>
                <div className="text-xs text-green-700 space-y-0.5">
                  <p>Recipe: <strong>{recipe.name}</strong> ({recipe.code})</p>
                  <p>Estimated Time: {estimateProductionTime(recipe)}</p>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium mb-1">Approved Quantity</label>
            <input
              type="number"
              min="1"
              value={approveQty}
              onChange={(e) => setApproveQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowApproveModal(null); setApproveQty(0); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveRequisition}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {saving ? 'Approving...' : 'Approve & Schedule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Reject Requisition Modal ─── */}
      <Modal
        isOpen={!!showRejectModal}
        onClose={() => { setShowRejectModal(null); setRejectReason(''); }}
        title={`Reject Requisition: ${showRejectModal?.productName || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to reject the requisition for <strong>{showRejectModal?.quantityRequested}</strong> units of <strong>{showRejectModal?.productName}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Rejection Reason (optional)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient raw materials, not needed today"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectRequisition}
              disabled={saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
            >
              {saving ? 'Rejecting...' : 'Reject Requisition'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Production Detail Modal ─── */}
      <Modal
        isOpen={!!showProductionDetail}
        onClose={() => setShowProductionDetail(null)}
        title="Production Run Details"
        size="md"
      >
        {showProductionDetail && (() => {
          const recipe = recipes.find(r => r.code === showProductionDetail.recipeCode);
          return (
            <div className="space-y-4">
              <div className="border border-border rounded-lg p-4 bg-secondary/50 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Product</span>
                    <span className="font-medium">{showProductionDetail.productName || showProductionDetail.recipeCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Status</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      showProductionDetail.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {showProductionDetail.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Batch Size</span>
                    <span className="font-medium">{showProductionDetail.batchSize}</span>
                  </div>
                  {showProductionDetail.operator && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Operator</span>
                      <span className="font-medium">{showProductionDetail.operator}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block text-xs">Created</span>
                    <span className="font-medium">{formatDateTime(showProductionDetail.createdAt)}</span>
                  </div>
                  {showProductionDetail.startTime && (
                    <div>
                      <span className="text-muted-foreground block text-xs">Started</span>
                      <span className="font-medium">{formatDateTime(showProductionDetail.startTime)}</span>
                    </div>
                  )}
                </div>
              </div>

              {recipe && (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Recipe Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div>
                      <span className="text-blue-500">Recipe Name:</span>
                      <span className="ml-1 font-medium">{recipe.name}</span>
                    </div>
                    <div>
                      <span className="text-blue-500">Code:</span>
                      <span className="ml-1 font-medium">{recipe.code}</span>
                    </div>
                    <div>
                      <span className="text-blue-500">Batch Size:</span>
                      <span className="ml-1 font-medium">{recipe.batchSize}</span>
                    </div>
                    <div>
                      <span className="text-blue-500">Expected Output:</span>
                      <span className="ml-1 font-medium">{recipe.expectedOutput} {recipe.outputUnit}</span>
                    </div>
                    <div>
                      <span className="text-blue-500">Prep Time:</span>
                      <span className="ml-1 font-medium">{recipe.prepTime} min</span>
                    </div>
                    <div>
                      <span className="text-blue-500">Bake Time:</span>
                      <span className="ml-1 font-medium">{recipe.bakeTime} min</span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-blue-200">
                      <span className="text-blue-500">Total Estimated Time:</span>
                      <span className="ml-1 font-semibold">{estimateProductionTime(recipe)}</span>
                    </div>
                  </div>
                </div>
              )}

              {showProductionDetail.requisitionId && (
                <p className="text-xs text-muted-foreground">
                  Linked Requisition ID: {showProductionDetail.requisitionId.slice(0, 8)}...
                </p>
              )}

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={() => setShowProductionDetail(null)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}