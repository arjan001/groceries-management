'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Check,
  X,
  Truck,
  AlertCircle,
  Store,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Package,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
}

interface RequisitionItem {
  id: string;
  requisition_id: string;
  product_name: string;
  product_code: string;
  quantity_requested: number;
  quantity_approved: number;
  quantity_fulfilled: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string;
  created_at: string;
}

interface Requisition {
  id: string;
  requisition_number: string;
  outlet_id: string;
  outlet_name: string;
  requested_by: string;
  requested_by_id: string;
  status: 'Pending' | 'Approved' | 'Partially_Fulfilled' | 'Fulfilled' | 'Rejected' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  needed_by: string;
  approved_by: string;
  approved_by_id: string;
  approved_at: string;
  fulfilled_at: string;
  total_items: number;
  total_cost: number;
  delivery_notes: string;
  notes: string;
  created_at: string;
  updated_at: string;
  items: RequisitionItem[];
}

interface PricingTierProduct {
  id: string;
  product_name: string;
  product_code: string;
  wholesale_price: number;
  retail_price: number;
  cost: number;
}

interface FormItem {
  temp_id: string;
  product_name: string;
  product_code: string;
  quantity_requested: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

const STATUS_OPTIONS: Requisition['status'][] = ['Pending', 'Approved', 'Partially_Fulfilled', 'Fulfilled', 'Rejected', 'Cancelled'];
const PRIORITY_OPTIONS: Requisition['priority'][] = ['Low', 'Normal', 'High', 'Urgent'];
const UNIT_OPTIONS = ['pieces', 'kg', 'boxes', 'trays', 'liters'];

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getStatusColor(status: Requisition['status']): string {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Approved': return 'bg-blue-100 text-blue-800';
    case 'Partially_Fulfilled': return 'bg-purple-100 text-purple-800';
    case 'Fulfilled': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    case 'Cancelled': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(status: Requisition['status']) {
  switch (status) {
    case 'Pending': return <Clock className="w-3 h-3" />;
    case 'Approved': return <CheckCircle className="w-3 h-3" />;
    case 'Partially_Fulfilled': return <Package className="w-3 h-3" />;
    case 'Fulfilled': return <Truck className="w-3 h-3" />;
    case 'Rejected': return <XCircle className="w-3 h-3" />;
    case 'Cancelled': return <X className="w-3 h-3" />;
    default: return null;
  }
}

function getPriorityColor(priority: Requisition['priority']): string {
  switch (priority) {
    case 'Low': return 'bg-gray-100 text-gray-800';
    case 'Normal': return 'bg-blue-100 text-blue-800';
    case 'High': return 'bg-orange-100 text-orange-800';
    case 'Urgent': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityIcon(priority: Requisition['priority']) {
  switch (priority) {
    case 'Urgent': return <AlertCircle className="w-3 h-3" />;
    case 'High': return <AlertCircle className="w-3 h-3" />;
    default: return null;
  }
}

function formatDisplayStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function generateRequisitionNumber(): string {
  return `REQ-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '---';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '---';
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
}

// ─── Empty Form State ────────────────────────────────────────────────────────

const emptyFormData = {
  outlet_id: '',
  priority: 'Normal' as Requisition['priority'],
  needed_by: '',
  delivery_notes: '',
  notes: '',
  requested_by: '',
};

const emptyFormItem: FormItem = {
  temp_id: '',
  product_name: '',
  product_code: '',
  quantity_requested: 1,
  unit: 'pieces',
  unit_cost: 0,
  total_cost: 0,
  notes: '',
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function OutletRequisitionsPage() {
  // ── Data State ──
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [pricingProducts, setPricingProducts] = useState<PricingTierProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Toast State ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Create Modal State ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ ...emptyFormData });
  const [formItems, setFormItems] = useState<FormItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Edit Modal State ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRequisition, setEditRequisition] = useState<Requisition | null>(null);
  const [editFormData, setEditFormData] = useState({ ...emptyFormData });
  const [editFormItems, setEditFormItems] = useState<FormItem[]>([]);
  const [editProductSearch, setEditProductSearch] = useState('');
  const [showEditProductDropdown, setShowEditProductDropdown] = useState(false);
  const [editActiveItemIndex, setEditActiveItemIndex] = useState<number | null>(null);

  // ── Detail Modal State ──
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRequisition, setDetailRequisition] = useState<Requisition | null>(null);

  // ── Approve Modal State ──
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveRequisition, setApproveRequisition] = useState<Requisition | null>(null);
  const [approveItems, setApproveItems] = useState<{ id: string; quantity_approved: number }[]>([]);
  const [approveNotes, setApproveNotes] = useState('');

  // ── Reject Modal State ──
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRequisition, setRejectRequisition] = useState<Requisition | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Fulfill Modal State ──
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillRequisition, setFulfillRequisition] = useState<Requisition | null>(null);
  const [fulfillItems, setFulfillItems] = useState<{ id: string; quantity_fulfilled: number }[]>([]);
  const [fulfillNotes, setFulfillNotes] = useState('');

  // ── Filter & Search State ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOutlet, setFilterOutlet] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    const { data, error } = await supabase
      .from('outlets')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.error('Fetch outlets:', error.message);
      return;
    }
    if (data) {
      setOutlets(data as Outlet[]);
    }
  }, []);

  const fetchPricingProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('pricing_tiers')
      .select('*')
      .order('product_name', { ascending: true });
    if (error) {
      console.error('Fetch pricing_tiers:', error.message);
      return;
    }
    if (data) {
      setPricingProducts(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          product_name: (r.product_name || '') as string,
          product_code: (r.product_code || '') as string,
          wholesale_price: (r.wholesale_price || 0) as number,
          retail_price: (r.retail_price || 0) as number,
          cost: (r.cost || 0) as number,
        }))
      );
    }
  }, []);

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('outlet_requisitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to load requisitions: ' + error.message, 'error');
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setRequisitions([]);
      setLoading(false);
      return;
    }

    const mapped = await Promise.all(
      data.map(async (r: Record<string, unknown>) => {
        const { data: items } = await supabase
          .from('outlet_requisition_items')
          .select('*')
          .eq('requisition_id', r.id)
          .order('created_at', { ascending: true });

        return {
          id: r.id as string,
          requisition_number: (r.requisition_number || '') as string,
          outlet_id: (r.outlet_id || '') as string,
          outlet_name: (r.outlet_name || '') as string,
          requested_by: (r.requested_by || '') as string,
          requested_by_id: (r.requested_by_id || '') as string,
          status: (r.status || 'Pending') as Requisition['status'],
          priority: (r.priority || 'Normal') as Requisition['priority'],
          needed_by: (r.needed_by || '') as string,
          approved_by: (r.approved_by || '') as string,
          approved_by_id: (r.approved_by_id || '') as string,
          approved_at: (r.approved_at || '') as string,
          fulfilled_at: (r.fulfilled_at || '') as string,
          total_items: (r.total_items || 0) as number,
          total_cost: (r.total_cost || 0) as number,
          delivery_notes: (r.delivery_notes || '') as string,
          notes: (r.notes || '') as string,
          created_at: (r.created_at || '') as string,
          updated_at: (r.updated_at || '') as string,
          items: (items || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            requisition_id: (i.requisition_id || '') as string,
            product_name: (i.product_name || '') as string,
            product_code: (i.product_code || '') as string,
            quantity_requested: (i.quantity_requested || 0) as number,
            quantity_approved: (i.quantity_approved || 0) as number,
            quantity_fulfilled: (i.quantity_fulfilled || 0) as number,
            unit: (i.unit || 'pieces') as string,
            unit_cost: (i.unit_cost || 0) as number,
            total_cost: (i.total_cost || 0) as number,
            notes: (i.notes || '') as string,
            created_at: (i.created_at || '') as string,
          })),
        };
      })
    );

    setRequisitions(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOutlets();
    fetchPricingProducts();
    fetchRequisitions();
  }, [fetchOutlets, fetchPricingProducts, fetchRequisitions]);

  // ── Filtering & Pagination ─────────────────────────────────────────────────

  const nonMainOutlets = outlets.filter((o) => !o.is_main_branch && o.status === 'Active');

  const filteredRequisitions = requisitions.filter((req) => {
    const matchesStatus = filterStatus === 'All' || req.status === filterStatus;
    const matchesOutlet = filterOutlet === 'All' || req.outlet_id === filterOutlet;
    const matchesPriority = filterPriority === 'All' || req.priority === filterPriority;
    if (!matchesStatus || !matchesOutlet || !matchesPriority) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      req.requisition_number.toLowerCase().includes(term) ||
      req.outlet_name.toLowerCase().includes(term) ||
      req.requested_by.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequisitions.length / ITEMS_PER_PAGE));
  const paginatedRequisitions = filteredRequisitions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterOutlet, filterPriority]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRequisitions = requisitions.length;
  const pendingCount = requisitions.filter((r) => r.status === 'Pending').length;
  const approvedCount = requisitions.filter((r) => r.status === 'Approved').length;
  const totalValue = requisitions.reduce((sum, r) => sum + (r.total_cost || 0), 0);

  // ── Product Search for Form ────────────────────────────────────────────────

  const getFilteredProducts = (search: string): PricingTierProduct[] => {
    if (!search.trim()) return pricingProducts.slice(0, 20);
    const term = search.toLowerCase();
    return pricingProducts.filter(
      (p) =>
        p.product_name.toLowerCase().includes(term) ||
        p.product_code.toLowerCase().includes(term)
    ).slice(0, 20);
  };

  // ── Form Item Management (Create) ─────────────────────────────────────────

  const addFormItem = () => {
    setFormItems([
      ...formItems,
      {
        ...emptyFormItem,
        temp_id: Date.now().toString() + Math.random().toString(36).slice(2),
      },
    ]);
  };

  const updateFormItem = (index: number, updates: Partial<FormItem>) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], ...updates };
    if (updates.quantity_requested !== undefined || updates.unit_cost !== undefined) {
      const qty = updates.quantity_requested ?? updated[index].quantity_requested;
      const cost = updates.unit_cost ?? updated[index].unit_cost;
      updated[index].total_cost = qty * cost;
    }
    setFormItems(updated);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const selectProduct = (product: PricingTierProduct, index: number) => {
    updateFormItem(index, {
      product_name: product.product_name,
      product_code: product.product_code,
      unit_cost: product.wholesale_price,
      total_cost: formItems[index].quantity_requested * product.wholesale_price,
    });
    setProductSearch('');
    setShowProductDropdown(false);
    setActiveItemIndex(null);
  };

  const calculateFormTotals = (items: FormItem[]) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity_requested, 0);
    const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0);
    return { totalItems, totalCost };
  };

  // ── Form Item Management (Edit) ───────────────────────────────────────────

  const addEditFormItem = () => {
    setEditFormItems([
      ...editFormItems,
      {
        ...emptyFormItem,
        temp_id: Date.now().toString() + Math.random().toString(36).slice(2),
      },
    ]);
  };

  const updateEditFormItem = (index: number, updates: Partial<FormItem>) => {
    const updated = [...editFormItems];
    updated[index] = { ...updated[index], ...updates };
    if (updates.quantity_requested !== undefined || updates.unit_cost !== undefined) {
      const qty = updates.quantity_requested ?? updated[index].quantity_requested;
      const cost = updates.unit_cost ?? updated[index].unit_cost;
      updated[index].total_cost = qty * cost;
    }
    setEditFormItems(updated);
  };

  const removeEditFormItem = (index: number) => {
    setEditFormItems(editFormItems.filter((_, i) => i !== index));
  };

  const selectEditProduct = (product: PricingTierProduct, index: number) => {
    updateEditFormItem(index, {
      product_name: product.product_name,
      product_code: product.product_code,
      unit_cost: product.wholesale_price,
      total_cost: editFormItems[index].quantity_requested * product.wholesale_price,
    });
    setEditProductSearch('');
    setShowEditProductDropdown(false);
    setEditActiveItemIndex(null);
  };

  // ── Create Requisition ─────────────────────────────────────────────────────

  const openCreateModal = () => {
    setFormData({ ...emptyFormData });
    setFormItems([]);
    setProductSearch('');
    setShowProductDropdown(false);
    setActiveItemIndex(null);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formItems.length === 0) {
      showToast('Please add at least one item to the requisition', 'error');
      return;
    }

    if (!formData.outlet_id) {
      showToast('Please select an outlet', 'error');
      return;
    }

    const hasEmptyProducts = formItems.some((item) => !item.product_name.trim());
    if (hasEmptyProducts) {
      showToast('All items must have a product name', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const selectedOutlet = outlets.find((o) => o.id === formData.outlet_id);
      const { totalItems, totalCost } = calculateFormTotals(formItems);
      const requisitionNumber = generateRequisitionNumber();

      const requisitionRow = {
        requisition_number: requisitionNumber,
        outlet_id: formData.outlet_id,
        outlet_name: selectedOutlet?.name || '',
        requested_by: formData.requested_by || 'Admin',
        status: 'Pending',
        priority: formData.priority,
        needed_by: formData.needed_by || null,
        total_items: totalItems,
        total_cost: totalCost,
        delivery_notes: formData.delivery_notes,
        notes: formData.notes,
      };

      const { data: created, error: createError } = await supabase
        .from('outlet_requisitions')
        .insert(requisitionRow)
        .select()
        .single();

      if (createError) throw createError;

      if (created) {
        const itemRows = formItems.map((item) => ({
          requisition_id: created.id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity_requested: item.quantity_requested,
          quantity_approved: 0,
          quantity_fulfilled: 0,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          notes: item.notes,
        }));

        const { error: itemsError } = await supabase
          .from('outlet_requisition_items')
          .insert(itemRows);

        if (itemsError) throw itemsError;

        logAudit({
          action: 'CREATE',
          module: 'Outlet Requisitions',
          record_id: created.id,
          details: {
            requisition_number: requisitionNumber,
            outlet: selectedOutlet?.name,
            total_items: totalItems,
            total_cost: totalCost,
            priority: formData.priority,
          },
        });

        showToast(`Requisition ${requisitionNumber} created successfully`, 'success');
        setShowCreateModal(false);
        await fetchRequisitions();
      }
    } catch (err) {
      console.error('Create requisition error:', err);
      showToast('Failed to create requisition. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit Requisition ───────────────────────────────────────────────────────

  const openEditModal = (req: Requisition) => {
    if (req.status !== 'Pending') {
      showToast('Only pending requisitions can be edited', 'error');
      return;
    }
    setEditRequisition(req);
    setEditFormData({
      outlet_id: req.outlet_id,
      priority: req.priority,
      needed_by: req.needed_by ? req.needed_by.split('T')[0] : '',
      delivery_notes: req.delivery_notes,
      notes: req.notes,
      requested_by: req.requested_by,
    });
    setEditFormItems(
      req.items.map((item) => ({
        temp_id: item.id,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity_requested: item.quantity_requested,
        unit: item.unit,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        notes: item.notes,
      }))
    );
    setEditProductSearch('');
    setShowEditProductDropdown(false);
    setEditActiveItemIndex(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editRequisition) return;

    if (editFormItems.length === 0) {
      showToast('Please add at least one item to the requisition', 'error');
      return;
    }

    const hasEmptyProducts = editFormItems.some((item) => !item.product_name.trim());
    if (hasEmptyProducts) {
      showToast('All items must have a product name', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const selectedOutlet = outlets.find((o) => o.id === editFormData.outlet_id);
      const { totalItems, totalCost } = calculateFormTotals(editFormItems);

      const updateRow = {
        outlet_id: editFormData.outlet_id,
        outlet_name: selectedOutlet?.name || editRequisition.outlet_name,
        requested_by: editFormData.requested_by || editRequisition.requested_by,
        priority: editFormData.priority,
        needed_by: editFormData.needed_by || null,
        total_items: totalItems,
        total_cost: totalCost,
        delivery_notes: editFormData.delivery_notes,
        notes: editFormData.notes,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('outlet_requisitions')
        .update(updateRow)
        .eq('id', editRequisition.id);

      if (updateError) throw updateError;

      // Delete old items and insert new ones
      await supabase
        .from('outlet_requisition_items')
        .delete()
        .eq('requisition_id', editRequisition.id);

      const itemRows = editFormItems.map((item) => ({
        requisition_id: editRequisition.id,
        product_name: item.product_name,
        product_code: item.product_code,
        quantity_requested: item.quantity_requested,
        quantity_approved: 0,
        quantity_fulfilled: 0,
        unit: item.unit,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from('outlet_requisition_items')
        .insert(itemRows);

      if (itemsError) throw itemsError;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Requisitions',
        record_id: editRequisition.id,
        details: {
          requisition_number: editRequisition.requisition_number,
          outlet: selectedOutlet?.name,
          total_items: totalItems,
          total_cost: totalCost,
          priority: editFormData.priority,
        },
      });

      showToast(`Requisition ${editRequisition.requisition_number} updated successfully`, 'success');
      setShowEditModal(false);
      setEditRequisition(null);
      await fetchRequisitions();
    } catch (err) {
      console.error('Update requisition error:', err);
      showToast('Failed to update requisition. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete Requisition ─────────────────────────────────────────────────────

  const handleDelete = async (req: Requisition) => {
    if (req.status !== 'Pending' && req.status !== 'Cancelled') {
      showToast('Only pending or cancelled requisitions can be deleted', 'error');
      return;
    }

    if (!confirm(`Delete requisition ${req.requisition_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      await supabase
        .from('outlet_requisition_items')
        .delete()
        .eq('requisition_id', req.id);

      const { error } = await supabase
        .from('outlet_requisitions')
        .delete()
        .eq('id', req.id);

      if (error) throw error;

      logAudit({
        action: 'DELETE',
        module: 'Outlet Requisitions',
        record_id: req.id,
        details: {
          requisition_number: req.requisition_number,
          outlet: req.outlet_name,
        },
      });

      showToast(`Requisition ${req.requisition_number} deleted`, 'success');
      setRequisitions(requisitions.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error('Delete requisition error:', err);
      showToast('Failed to delete requisition', 'error');
    }
  };

  // ── Cancel Requisition ─────────────────────────────────────────────────────

  const handleCancel = async (req: Requisition) => {
    if (req.status !== 'Pending') {
      showToast('Only pending requisitions can be cancelled', 'error');
      return;
    }

    if (!confirm(`Cancel requisition ${req.requisition_number}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('outlet_requisitions')
        .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
        .eq('id', req.id);

      if (error) throw error;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Requisitions',
        record_id: req.id,
        details: {
          requisition_number: req.requisition_number,
          action: 'Cancelled',
        },
      });

      showToast(`Requisition ${req.requisition_number} cancelled`, 'success');
      await fetchRequisitions();
    } catch (err) {
      console.error('Cancel requisition error:', err);
      showToast('Failed to cancel requisition', 'error');
    }
  };

  // ── View Detail ────────────────────────────────────────────────────────────

  const openDetailModal = (req: Requisition) => {
    setDetailRequisition(req);
    setShowDetailModal(true);
  };

  // ── Approve Requisition ────────────────────────────────────────────────────

  const openApproveModal = (req: Requisition) => {
    if (req.status !== 'Pending') {
      showToast('Only pending requisitions can be approved', 'error');
      return;
    }
    setApproveRequisition(req);
    setApproveItems(
      req.items.map((item) => ({
        id: item.id,
        quantity_approved: item.quantity_requested,
      }))
    );
    setApproveNotes('');
    setShowApproveModal(true);
  };

  const handleApproveSubmit = async () => {
    if (!approveRequisition) return;
    setSubmitting(true);

    try {
      // Update each item with approved quantities
      for (const approveItem of approveItems) {
        await supabase
          .from('outlet_requisition_items')
          .update({ quantity_approved: approveItem.quantity_approved })
          .eq('id', approveItem.id);
      }

      // Calculate new total cost based on approved quantities
      const updatedItems = approveRequisition.items.map((item) => {
        const approved = approveItems.find((a) => a.id === item.id);
        const qtyApproved = approved?.quantity_approved ?? item.quantity_requested;
        return qtyApproved * item.unit_cost;
      });
      const newTotalCost = updatedItems.reduce((sum, cost) => sum + cost, 0);
      const newTotalItems = approveItems.reduce((sum, a) => sum + a.quantity_approved, 0);

      const { error } = await supabase
        .from('outlet_requisitions')
        .update({
          status: 'Approved',
          approved_by: 'Admin',
          approved_at: new Date().toISOString(),
          total_items: newTotalItems,
          total_cost: newTotalCost,
          notes: approveNotes ? `${approveRequisition.notes ? approveRequisition.notes + '\n' : ''}Approval notes: ${approveNotes}` : approveRequisition.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approveRequisition.id);

      if (error) throw error;

      logAudit({
        action: 'APPROVE',
        module: 'Outlet Requisitions',
        record_id: approveRequisition.id,
        details: {
          requisition_number: approveRequisition.requisition_number,
          outlet: approveRequisition.outlet_name,
          total_items_approved: newTotalItems,
          total_cost: newTotalCost,
        },
      });

      showToast(`Requisition ${approveRequisition.requisition_number} approved`, 'success');
      setShowApproveModal(false);
      setApproveRequisition(null);
      await fetchRequisitions();
    } catch (err) {
      console.error('Approve requisition error:', err);
      showToast('Failed to approve requisition', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reject Requisition ─────────────────────────────────────────────────────

  const openRejectModal = (req: Requisition) => {
    if (req.status !== 'Pending') {
      showToast('Only pending requisitions can be rejected', 'error');
      return;
    }
    setRejectRequisition(req);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectRequisition) return;
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('outlet_requisitions')
        .update({
          status: 'Rejected',
          notes: `${rejectRequisition.notes ? rejectRequisition.notes + '\n' : ''}Rejection reason: ${rejectReason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectRequisition.id);

      if (error) throw error;

      logAudit({
        action: 'REJECT',
        module: 'Outlet Requisitions',
        record_id: rejectRequisition.id,
        details: {
          requisition_number: rejectRequisition.requisition_number,
          outlet: rejectRequisition.outlet_name,
          reason: rejectReason,
        },
      });

      showToast(`Requisition ${rejectRequisition.requisition_number} rejected`, 'success');
      setShowRejectModal(false);
      setRejectRequisition(null);
      await fetchRequisitions();
    } catch (err) {
      console.error('Reject requisition error:', err);
      showToast('Failed to reject requisition', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Fulfill Requisition ────────────────────────────────────────────────────

  const openFulfillModal = (req: Requisition) => {
    if (req.status !== 'Approved' && req.status !== 'Partially_Fulfilled') {
      showToast('Only approved or partially fulfilled requisitions can be fulfilled', 'error');
      return;
    }
    setFulfillRequisition(req);
    setFulfillItems(
      req.items.map((item) => ({
        id: item.id,
        quantity_fulfilled: item.quantity_approved - item.quantity_fulfilled,
      }))
    );
    setFulfillNotes('');
    setShowFulfillModal(true);
  };

  const handleFulfillSubmit = async () => {
    if (!fulfillRequisition) return;
    setSubmitting(true);

    try {
      let allFullyFulfilled = true;

      for (const fulfillItem of fulfillItems) {
        const originalItem = fulfillRequisition.items.find((i) => i.id === fulfillItem.id);
        if (!originalItem) continue;

        const newFulfilled = originalItem.quantity_fulfilled + fulfillItem.quantity_fulfilled;

        await supabase
          .from('outlet_requisition_items')
          .update({ quantity_fulfilled: newFulfilled })
          .eq('id', fulfillItem.id);

        if (newFulfilled < originalItem.quantity_approved) {
          allFullyFulfilled = false;
        }
      }

      const newStatus = allFullyFulfilled ? 'Fulfilled' : 'Partially_Fulfilled';

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (allFullyFulfilled) {
        updateData.fulfilled_at = new Date().toISOString();
      }

      if (fulfillNotes) {
        updateData.notes = `${fulfillRequisition.notes ? fulfillRequisition.notes + '\n' : ''}Fulfillment notes: ${fulfillNotes}`;
      }

      const { error } = await supabase
        .from('outlet_requisitions')
        .update(updateData)
        .eq('id', fulfillRequisition.id);

      if (error) throw error;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Requisitions',
        record_id: fulfillRequisition.id,
        details: {
          requisition_number: fulfillRequisition.requisition_number,
          action: allFullyFulfilled ? 'Fulfilled' : 'Partially Fulfilled',
          outlet: fulfillRequisition.outlet_name,
          items_fulfilled: fulfillItems.map((fi) => {
            const orig = fulfillRequisition.items.find((i) => i.id === fi.id);
            return {
              product: orig?.product_name,
              quantity_fulfilled: fi.quantity_fulfilled,
            };
          }),
        },
      });

      showToast(
        `Requisition ${fulfillRequisition.requisition_number} ${allFullyFulfilled ? 'fully fulfilled' : 'partially fulfilled'}`,
        'success'
      );
      setShowFulfillModal(false);
      setFulfillRequisition(null);
      await fetchRequisitions();
    } catch (err) {
      console.error('Fulfill requisition error:', err);
      showToast('Failed to fulfill requisition', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render: Product Search Dropdown ────────────────────────────────────────

  const renderProductDropdown = (
    search: string,
    setSearch: (v: string) => void,
    showDropdown: boolean,
    setShowDropdown: (v: boolean) => void,
    onSelect: (product: PricingTierProduct, index: number) => void,
    itemIndex: number
  ) => {
    const filtered = getFilteredProducts(search);
    return (
      <div className="relative">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search products..."
            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-3" />
        </div>
        {showDropdown && filtered.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product, itemIndex)}
                className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors text-sm border-b border-border last:border-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{product.product_name}</span>
                    {product.product_code && (
                      <span className="text-xs text-muted-foreground ml-2">({product.product_code})</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    KES {product.wholesale_price.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Render: Item Form Rows ─────────────────────────────────────────────────

  const renderItemRows = (
    items: FormItem[],
    updateItem: (index: number, updates: Partial<FormItem>) => void,
    removeItem: (index: number) => void,
    searchState: string,
    setSearchState: (v: string) => void,
    dropdownState: boolean,
    setDropdownState: (v: boolean) => void,
    activeIndex: number | null,
    setActiveIndex: (v: number | null) => void,
    onSelectProduct: (product: PricingTierProduct, index: number) => void
  ) => {
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.temp_id} className="border border-border rounded-lg p-3 bg-secondary/20">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2">
              {/* Product Name with Search */}
              <div className="col-span-4">
                <label className="block text-xs text-muted-foreground mb-1">Product *</label>
                {item.product_name ? (
                  <div className="flex items-center gap-1">
                    <div className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      <span className="font-medium">{item.product_name}</span>
                      {item.product_code && (
                        <span className="text-xs text-muted-foreground ml-1">({item.product_code})</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateItem(index, { product_name: '', product_code: '', unit_cost: 0, total_cost: 0 });
                        setActiveIndex(index);
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Change product"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setTimeout(() => {
                          setDropdownState(false);
                          setActiveIndex(null);
                        }, 200);
                      }
                    }}
                  >
                    {renderProductDropdown(
                      activeIndex === index ? searchState : '',
                      (v) => {
                        setSearchState(v);
                        setActiveIndex(index);
                      },
                      activeIndex === index && dropdownState,
                      setDropdownState,
                      onSelectProduct,
                      index
                    )}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity_requested}
                  onChange={(e) =>
                    updateItem(index, { quantity_requested: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                />
              </div>

              {/* Unit */}
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                <select
                  value={item.unit}
                  onChange={(e) => updateItem(index, { unit: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Cost */}
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Unit Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_cost}
                  onChange={(e) =>
                    updateItem(index, { unit_cost: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                />
              </div>

              {/* Line Total */}
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Total</label>
                <div className="px-3 py-2 border border-border rounded-lg bg-secondary text-sm font-semibold">
                  KES {item.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Item Notes */}
            <div className="mt-2">
              <input
                type="text"
                value={item.notes}
                onChange={(e) => updateItem(index, { notes: e.target.value })}
                placeholder="Item notes (optional)"
                className="w-full px-3 py-1.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-xs"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Outlet Requisitions</h1>
        </div>
        <p className="text-muted-foreground">
          Manage product requisitions from outlet branches. Create, approve, and fulfill requisition requests.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Requisitions</p>
              <p className="text-2xl font-bold">{totalRequisitions}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-green-600">KES {totalValue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search requisition #, outlet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64 bg-background"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
          >
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {formatDisplayStatus(s)}
              </option>
            ))}
          </select>

          {/* Outlet Filter */}
          <select
            value={filterOutlet}
            onChange={(e) => setFilterOutlet(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
          >
            <option value="All">All Outlets</option>
            {nonMainOutlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
          >
            <option value="All">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading requisitions...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRequisitions.length === 0 && (
        <div className="border border-border rounded-lg p-12 bg-card text-center">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Requisitions Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterStatus !== 'All' || filterOutlet !== 'All' || filterPriority !== 'All'
              ? 'No requisitions match your current filters. Try adjusting your search criteria.'
              : 'No outlet requisitions have been created yet. Create your first requisition to get started.'}
          </p>
          {!searchTerm && filterStatus === 'All' && filterOutlet === 'All' && filterPriority === 'All' && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Requisition
            </button>
          )}
        </div>
      )}

      {/* Requisitions Table */}
      {!loading && filteredRequisitions.length > 0 && (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Requisition #</th>
                <th className="px-4 py-3 text-left font-semibold">Outlet</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Priority</th>
                <th className="px-4 py-3 text-left font-semibold">Needed By</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Total Cost</th>
                <th className="px-4 py-3 text-left font-semibold">Requested By</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequisitions.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => openDetailModal(req)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-primary">{req.requisition_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{req.outlet_name || '---'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        req.status
                      )}`}
                    >
                      {getStatusIcon(req.status)}
                      {formatDisplayStatus(req.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(
                        req.priority
                      )}`}
                    >
                      {getPriorityIcon(req.priority)}
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {req.needed_by ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{formatDate(req.needed_by)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">---</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{req.total_items}</td>
                  <td className="px-4 py-3 text-right font-semibold">KES {req.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{req.requested_by || '---'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(req.created_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => openDetailModal(req)}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {req.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => openEditModal(req)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openApproveModal(req)}
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openRejectModal(req)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancel(req)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {(req.status === 'Approved' || req.status === 'Partially_Fulfilled') && (
                        <button
                          onClick={() => openFulfillModal(req)}
                          className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                          title="Fulfill"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      {(req.status === 'Pending' || req.status === 'Cancelled') && (
                        <button
                          onClick={() => handleDelete(req)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
      {!loading && filteredRequisitions.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}--
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequisitions.length)} of{' '}
            {filteredRequisitions.length} requisitions
          </p>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 7) return true;
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => {
                const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                return (
                  <span key={page} className="flex items-center">
                    {showEllipsis && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm border rounded-lg font-medium transition-colors ${
                        page === currentPage
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                );
              })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── CREATE REQUISITION MODAL ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Requisition"
        size="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Requisition Details */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Requisition Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Outlet *</label>
                <select
                  value={formData.outlet_id}
                  onChange={(e) => setFormData({ ...formData, outlet_id: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="">Select Outlet</option>
                  {nonMainOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} {outlet.code ? `(${outlet.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as Requisition['priority'],
                    })
                  }
                  className={inputClass}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Needed By</label>
                <input
                  type="date"
                  value={formData.needed_by}
                  onChange={(e) => setFormData({ ...formData, needed_by: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Requested By</label>
                <input
                  type="text"
                  value={formData.requested_by}
                  onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
                  placeholder="Name of requester"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Delivery Notes</label>
                <textarea
                  value={formData.delivery_notes}
                  onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })}
                  placeholder="Special delivery instructions..."
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Internal Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes (optional)"
                  className={inputClass}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Product Catalog - Browse & Select */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Select Products
              </p>
              <span className="text-xs text-muted-foreground">Click products to add them</span>
            </div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name or code..."
                className="w-full pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {getFilteredProducts(productSearch).map((product) => {
                const alreadyAdded = formItems.some((fi) => fi.product_name === product.product_name);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      if (alreadyAdded) return;
                      const newItem: FormItem = {
                        temp_id: Date.now().toString() + Math.random().toString(36).slice(2),
                        product_name: product.product_name,
                        product_code: product.product_code,
                        quantity_requested: 1,
                        unit: 'pieces',
                        unit_cost: product.wholesale_price,
                        total_cost: product.wholesale_price,
                        notes: '',
                      };
                      setFormItems([...formItems, newItem]);
                    }}
                    className={`text-left p-2.5 rounded-lg border transition-colors text-sm ${
                      alreadyAdded
                        ? 'bg-green-50 border-green-300 text-green-800 cursor-default'
                        : 'border-border hover:bg-primary/10 hover:border-primary/40'
                    }`}
                  >
                    <div className="font-medium text-xs truncate">{product.product_name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{product.product_code || '---'}</span>
                      <span className="text-xs font-semibold">KES {product.wholesale_price.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {alreadyAdded && <span className="text-[10px] text-green-600 font-medium">Added</span>}
                  </button>
                );
              })}
              {getFilteredProducts(productSearch).length === 0 && (
                <div className="col-span-3 text-center py-4 text-muted-foreground text-sm">
                  No products found. Try a different search.
                </div>
              )}
            </div>
          </div>

          {/* Selected Items - Adjust Quantities */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Requisition Items ({formItems.length})
              </p>
              <button
                type="button"
                onClick={addFormItem}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Custom Item
              </button>
            </div>

            {formItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items selected. Browse and click products above to add them.</p>
              </div>
            ) : (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/70 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-28">Qty</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-24">Unit</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold w-24">Unit Cost</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold w-24">Total</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, index) => (
                        <tr key={item.temp_id} className="border-b border-border/50">
                          <td className="px-3 py-2">
                            {item.product_name ? (
                              <div>
                                <span className="font-medium">{item.product_name}</span>
                                {item.product_code && (
                                  <span className="text-xs text-muted-foreground ml-1">({item.product_code})</span>
                                )}
                              </div>
                            ) : (
                              <input
                                type="text"
                                placeholder="Product name..."
                                value={item.product_name}
                                onChange={(e) => updateFormItem(index, { product_name: e.target.value })}
                                className="w-full px-2 py-1 border border-border rounded text-sm bg-background"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateFormItem(index, { quantity_requested: Math.max(1, item.quantity_requested - 1) })}
                                className="w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 text-xs font-bold"
                              >-</button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity_requested}
                                onChange={(e) => updateFormItem(index, { quantity_requested: parseInt(e.target.value) || 1 })}
                                className="w-14 text-center px-1 py-1 border border-border rounded text-sm bg-background"
                              />
                              <button
                                type="button"
                                onClick={() => updateFormItem(index, { quantity_requested: item.quantity_requested + 1 })}
                                className="w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 text-xs font-bold"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={item.unit}
                              onChange={(e) => updateFormItem(index, { unit: e.target.value })}
                              className="px-1 py-1 border border-border rounded text-xs bg-background"
                            >
                              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right text-sm">KES {item.unit_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-semibold text-sm">KES {item.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFormItem(index)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex justify-end gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Items:</span>{' '}
                      <span className="font-bold">{calculateFormTotals(formItems).totalItems}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost:</span>{' '}
                      <span className="font-bold text-lg">
                        KES {calculateFormTotals(formItems).totalCost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || formItems.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Requisition
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── EDIT REQUISITION MODAL ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditRequisition(null);
        }}
        title={`Edit Requisition ${editRequisition?.requisition_number || ''}`}
        size="4xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Requisition Details */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Requisition Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Outlet *</label>
                <select
                  value={editFormData.outlet_id}
                  onChange={(e) => setEditFormData({ ...editFormData, outlet_id: e.target.value })}
                  className={inputClass}
                  required
                >
                  <option value="">Select Outlet</option>
                  {nonMainOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name} {outlet.code ? `(${outlet.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                <select
                  value={editFormData.priority}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      priority: e.target.value as Requisition['priority'],
                    })
                  }
                  className={inputClass}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Needed By</label>
                <input
                  type="date"
                  value={editFormData.needed_by}
                  onChange={(e) => setEditFormData({ ...editFormData, needed_by: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Requested By</label>
                <input
                  type="text"
                  value={editFormData.requested_by}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, requested_by: e.target.value })
                  }
                  placeholder="Name of requester"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Delivery Notes</label>
                <textarea
                  value={editFormData.delivery_notes}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, delivery_notes: e.target.value })
                  }
                  placeholder="Special delivery instructions..."
                  className={inputClass}
                  rows={2}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Internal Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Internal notes (optional)"
                  className={inputClass}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items ({editFormItems.length})
              </p>
              <button
                type="button"
                onClick={addEditFormItem}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>

            {editFormItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No items. Click &quot;Add Item&quot; to start.</p>
              </div>
            ) : (
              <>
                {renderItemRows(
                  editFormItems,
                  updateEditFormItem,
                  removeEditFormItem,
                  editProductSearch,
                  setEditProductSearch,
                  showEditProductDropdown,
                  setShowEditProductDropdown,
                  editActiveItemIndex,
                  setEditActiveItemIndex,
                  selectEditProduct
                )}

                {/* Totals Summary */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex justify-end gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Items:</span>{' '}
                      <span className="font-bold">{calculateFormTotals(editFormItems).totalItems}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost:</span>{' '}
                      <span className="font-bold text-lg">
                        KES {calculateFormTotals(editFormItems).totalCost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditRequisition(null);
              }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || editFormItems.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Update Requisition
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW DETAIL MODAL ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailRequisition(null);
        }}
        title={`Requisition ${detailRequisition?.requisition_number || ''}`}
        size="3xl"
      >
        {detailRequisition && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Status & Priority Header */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(
                  detailRequisition.status
                )}`}
              >
                {getStatusIcon(detailRequisition.status)}
                {formatDisplayStatus(detailRequisition.status)}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-semibold ${getPriorityColor(
                  detailRequisition.priority
                )}`}
              >
                {getPriorityIcon(detailRequisition.priority)}
                {detailRequisition.priority} Priority
              </span>
            </div>

            {/* General Info */}
            <div className="border border-border rounded-lg p-4 bg-secondary/20">
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                General Information
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Requisition #:</span>{' '}
                  <span className="font-mono font-semibold ml-2">
                    {detailRequisition.requisition_number}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{' '}
                  <span className="font-medium ml-2">{detailRequisition.outlet_name || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested By:</span>{' '}
                  <span className="font-medium ml-2">{detailRequisition.requested_by || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Needed By:</span>{' '}
                  <span className="font-medium ml-2">
                    {detailRequisition.needed_by ? formatDate(detailRequisition.needed_by) : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  <span className="font-medium ml-2">{formatDateTime(detailRequisition.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>{' '}
                  <span className="font-medium ml-2">
                    {detailRequisition.updated_at
                      ? formatDateTime(detailRequisition.updated_at)
                      : '---'}
                  </span>
                </div>
                {detailRequisition.approved_by && (
                  <div>
                    <span className="text-muted-foreground">Approved By:</span>{' '}
                    <span className="font-medium ml-2">{detailRequisition.approved_by}</span>
                  </div>
                )}
                {detailRequisition.approved_at && (
                  <div>
                    <span className="text-muted-foreground">Approved At:</span>{' '}
                    <span className="font-medium ml-2">
                      {formatDateTime(detailRequisition.approved_at)}
                    </span>
                  </div>
                )}
                {detailRequisition.fulfilled_at && (
                  <div>
                    <span className="text-muted-foreground">Fulfilled At:</span>{' '}
                    <span className="font-medium ml-2">
                      {formatDateTime(detailRequisition.fulfilled_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Items</p>
                <p className="text-xl font-bold">{detailRequisition.total_items}</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-xl font-bold">KES {detailRequisition.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" />
                Requisition Items ({detailRequisition.items.length})
              </h4>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Code</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Requested</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Approved</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Fulfilled</th>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Unit Cost</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRequisition.items.map((item) => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-3 py-2 font-medium">{item.product_name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                          {item.product_code || '---'}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity_requested}</td>
                        <td className="px-3 py-2 text-right">
                          {item.quantity_approved > 0 ? (
                            <span
                              className={
                                item.quantity_approved < item.quantity_requested
                                  ? 'text-orange-600 font-semibold'
                                  : 'text-green-600 font-semibold'
                              }
                            >
                              {item.quantity_approved}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">---</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.quantity_fulfilled > 0 ? (
                            <span
                              className={
                                item.quantity_fulfilled < item.quantity_approved
                                  ? 'text-purple-600 font-semibold'
                                  : 'text-green-600 font-semibold'
                              }
                            >
                              {item.quantity_fulfilled}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">---</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{item.unit}</td>
                        <td className="px-3 py-2 text-right">KES {item.unit_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          KES {item.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/50">
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-right font-semibold text-sm">
                        Grand Total:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-sm">
                        KES {detailRequisition.items
                          .reduce((sum, i) => sum + i.total_cost, 0)
                          .toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Delivery Notes */}
            {detailRequisition.delivery_notes && (
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Delivery Notes
                </h4>
                <p className="text-sm whitespace-pre-wrap">{detailRequisition.delivery_notes}</p>
              </div>
            )}

            {/* Notes */}
            {detailRequisition.notes && (
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Notes
                </h4>
                <p className="text-sm whitespace-pre-wrap">{detailRequisition.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {detailRequisition.status === 'Pending' && (
                <>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openEditModal(detailRequisition);
                    }}
                    className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 font-medium flex items-center gap-2 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openApproveModal(detailRequisition);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openRejectModal(detailRequisition);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
              {(detailRequisition.status === 'Approved' ||
                detailRequisition.status === 'Partially_Fulfilled') && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openFulfillModal(detailRequisition);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  Fulfill
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailRequisition(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── APPROVE MODAL ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setApproveRequisition(null);
        }}
        title={`Approve Requisition ${approveRequisition?.requisition_number || ''}`}
        size="2xl"
      >
        {approveRequisition && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Requisition Info */}
            <div className="border border-border rounded-lg p-3 bg-secondary/20">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{' '}
                  <span className="font-medium ml-1">{approveRequisition.outlet_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>{' '}
                  <span
                    className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(
                      approveRequisition.priority
                    )}`}
                  >
                    {approveRequisition.priority}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Needed By:</span>{' '}
                  <span className="font-medium ml-1">
                    {approveRequisition.needed_by
                      ? formatDate(approveRequisition.needed_by)
                      : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested By:</span>{' '}
                  <span className="font-medium ml-1">{approveRequisition.requested_by || '---'}</span>
                </div>
              </div>
            </div>

            {/* Items with Approval Qty */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Adjust Approved Quantities
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                You may adjust the approved quantity for each item. Set to 0 to deny specific items.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Requested</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Approved Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Unit Cost</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approveRequisition.items.map((item) => {
                      const approveItem = approveItems.find((a) => a.id === item.id);
                      const approvedQty = approveItem?.quantity_approved ?? item.quantity_requested;
                      return (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{item.product_name}</td>
                          <td className="px-3 py-2 text-right">{item.quantity_requested}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity_requested}
                              value={approvedQty}
                              onChange={(e) => {
                                const val = Math.min(
                                  parseInt(e.target.value) || 0,
                                  item.quantity_requested
                                );
                                setApproveItems(
                                  approveItems.map((a) =>
                                    a.id === item.id ? { ...a, quantity_approved: val } : a
                                  )
                                );
                              }}
                              className="w-20 px-2 py-1 border border-border rounded text-right text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-xs">{item.unit}</td>
                          <td className="px-3 py-2 text-right">KES {item.unit_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-right font-semibold">
                            KES {(approvedQty * item.unit_cost).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-secondary/50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold text-sm">
                        Approved Total:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-sm">
                        KES{' '}
                        {approveRequisition.items
                          .reduce((sum, item) => {
                            const approveItem = approveItems.find((a) => a.id === item.id);
                            const qty = approveItem?.quantity_approved ?? item.quantity_requested;
                            return sum + qty * item.unit_cost;
                          }, 0)
                          .toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Approval Notes */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Approval Notes (optional)</label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Add notes about the approval..."
                className={inputClass}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setApproveRequisition(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve Requisition
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REJECT MODAL ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectRequisition(null);
        }}
        title={`Reject Requisition ${rejectRequisition?.requisition_number || ''}`}
        size="lg"
      >
        {rejectRequisition && (
          <div className="space-y-5">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Reject this requisition?</p>
                <p className="text-xs text-red-700 mt-1">
                  This will reject the requisition from{' '}
                  <strong>{rejectRequisition.outlet_name}</strong> with{' '}
                  {rejectRequisition.total_items} items totaling KES{' '}
                  {rejectRequisition.total_cost.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This action cannot be easily undone.
                </p>
              </div>
            </div>

            {/* Rejection Reason */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this requisition..."
                className={inputClass}
                rows={3}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectRequisition(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={submitting || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Reject Requisition
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── FULFILL MODAL ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showFulfillModal}
        onClose={() => {
          setShowFulfillModal(false);
          setFulfillRequisition(null);
        }}
        title={`Fulfill Requisition ${fulfillRequisition?.requisition_number || ''}`}
        size="2xl"
      >
        {fulfillRequisition && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Requisition Info */}
            <div className="border border-border rounded-lg p-3 bg-secondary/20">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{' '}
                  <span className="font-medium ml-1">{fulfillRequisition.outlet_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span
                    className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(
                      fulfillRequisition.status
                    )}`}
                  >
                    {formatDisplayStatus(fulfillRequisition.status)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Approved By:</span>{' '}
                  <span className="font-medium ml-1">{fulfillRequisition.approved_by || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Needed By:</span>{' '}
                  <span className="font-medium ml-1">
                    {fulfillRequisition.needed_by
                      ? formatDate(fulfillRequisition.needed_by)
                      : '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items with Fulfill Qty */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Enter Fulfillment Quantities
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the quantity being fulfilled for each item. Partial fulfillment is supported.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Approved</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Previously Fulfilled</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Remaining</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Fulfill Now</th>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fulfillRequisition.items.map((item) => {
                      const fulfillItem = fulfillItems.find((f) => f.id === item.id);
                      const remaining = item.quantity_approved - item.quantity_fulfilled;
                      return (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{item.product_name}</td>
                          <td className="px-3 py-2 text-right">{item.quantity_approved}</td>
                          <td className="px-3 py-2 text-right">
                            {item.quantity_fulfilled > 0 ? (
                              <span className="text-green-600 font-medium">{item.quantity_fulfilled}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={remaining > 0 ? 'text-orange-600 font-semibold' : 'text-green-600'}
                            >
                              {remaining}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={fulfillItem?.quantity_fulfilled ?? 0}
                              onChange={(e) => {
                                const val = Math.min(parseInt(e.target.value) || 0, remaining);
                                setFulfillItems(
                                  fulfillItems.map((f) =>
                                    f.id === item.id ? { ...f, quantity_fulfilled: val } : f
                                  )
                                );
                              }}
                              className="w-20 px-2 py-1 border border-border rounded text-right text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                              disabled={remaining <= 0}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs">{item.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fulfillment Notes */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Fulfillment Notes (optional)
              </label>
              <textarea
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                placeholder="Notes about this fulfillment batch..."
                className={inputClass}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowFulfillModal(false);
                  setFulfillRequisition(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFulfillSubmit}
                disabled={
                  submitting || fulfillItems.every((f) => f.quantity_fulfilled === 0)
                }
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Confirm Fulfillment
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
