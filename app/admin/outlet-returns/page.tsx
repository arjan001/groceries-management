'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  RotateCcw,
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
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  DollarSign,
  Thermometer,
  ShieldCheck,
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

interface ReturnItem {
  id: string;
  return_id: string;
  product_name: string;
  product_code: string;
  quantity_sent: number;
  quantity_sold: number;
  quantity_returning: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  batch_number: string;
  date_received_at_branch: string;
  days_at_branch: number;
  shelf_life_remaining: number;
  quality_on_return: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Waste';
  notes: string;
  created_at: string;
}

interface OutletReturn {
  id: string;
  return_number: string;
  outlet_id: string;
  outlet_name: string;
  returned_by: string;
  returned_by_id: string;
  received_by: string;
  received_by_id: string;
  status: 'Pending' | 'In_Transit' | 'Received' | 'Inspected' | 'Processed' | 'Rejected';
  return_reason: 'Freshness Policy' | 'Overstock' | 'Quality Issue' | 'Damaged' | 'Expired' | 'Other';
  total_items: number;
  total_value: number;
  wholesale_value: number;
  return_date: string;
  received_date: string;
  inspection_notes: string;
  quality_grade: 'A - Fresh (3+ days left)' | 'B - Good (2 days left)' | 'C - Sell Today' | 'D - Waste' | '';
  destination: 'wholesale' | 'discount_sale' | 'waste' | 'redistribution' | '';
  notes: string;
  created_at: string;
  updated_at: string;
  items: ReturnItem[];
}

interface PricingTierProduct {
  id: string;
  product_name: string;
  product_code: string;
  wholesale_price: number;
  retail_price: number;
  cost: number;
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
  last_restocked: string;
  status: string;
}

interface FormReturnItem {
  temp_id: string;
  product_name: string;
  product_code: string;
  quantity_sent: number;
  quantity_sold: number;
  quantity_returning: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  batch_number: string;
  date_received_at_branch: string;
  days_at_branch: number;
  shelf_life_remaining: number;
  quality_on_return: ReturnItem['quality_on_return'];
  notes: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;
const DEFAULT_SHELF_LIFE_DAYS = 5;
const MAX_BRANCH_STAY_DAYS = 2;

const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

const STATUS_OPTIONS: OutletReturn['status'][] = ['Pending', 'In_Transit', 'Received', 'Inspected', 'Processed', 'Rejected'];
const RETURN_REASON_OPTIONS: OutletReturn['return_reason'][] = ['Freshness Policy', 'Overstock', 'Quality Issue', 'Damaged', 'Expired', 'Other'];
const QUALITY_ON_RETURN_OPTIONS: ReturnItem['quality_on_return'][] = ['Excellent', 'Good', 'Fair', 'Poor', 'Waste'];
const QUALITY_GRADE_OPTIONS: OutletReturn['quality_grade'][] = ['A - Fresh (3+ days left)', 'B - Good (2 days left)', 'C - Sell Today', 'D - Waste'];
const DESTINATION_OPTIONS: { value: OutletReturn['destination']; label: string }[] = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'discount_sale', label: 'Discount Sale' },
  { value: 'waste', label: 'Waste / Disposal' },
  { value: 'redistribution', label: 'Redistribution' },
];
const UNIT_OPTIONS = ['pieces', 'kg', 'boxes', 'trays', 'liters'];

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getStatusColor(status: OutletReturn['status']): string {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'In_Transit': return 'bg-blue-100 text-blue-800';
    case 'Received': return 'bg-indigo-100 text-indigo-800';
    case 'Inspected': return 'bg-purple-100 text-purple-800';
    case 'Processed': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusIcon(status: OutletReturn['status']) {
  switch (status) {
    case 'Pending': return <Clock className="w-3 h-3" />;
    case 'In_Transit': return <Truck className="w-3 h-3" />;
    case 'Received': return <Package className="w-3 h-3" />;
    case 'Inspected': return <ClipboardCheck className="w-3 h-3" />;
    case 'Processed': return <CheckCircle className="w-3 h-3" />;
    case 'Rejected': return <XCircle className="w-3 h-3" />;
    default: return null;
  }
}

function getQualityGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-100 text-green-800';
  if (grade.startsWith('B')) return 'bg-yellow-100 text-yellow-800';
  if (grade.startsWith('C')) return 'bg-orange-100 text-orange-800';
  if (grade.startsWith('D')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

function getQualityOnReturnColor(quality: ReturnItem['quality_on_return']): string {
  switch (quality) {
    case 'Excellent': return 'bg-green-100 text-green-800';
    case 'Good': return 'bg-blue-100 text-blue-800';
    case 'Fair': return 'bg-yellow-100 text-yellow-800';
    case 'Poor': return 'bg-orange-100 text-orange-800';
    case 'Waste': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getFreshnessColor(daysRemaining: number): string {
  if (daysRemaining >= 3) return 'text-green-600';
  if (daysRemaining === 2) return 'text-yellow-600';
  if (daysRemaining === 1) return 'text-orange-600';
  return 'text-red-600';
}

function getFreshnessBgColor(daysRemaining: number): string {
  if (daysRemaining >= 3) return 'bg-green-100 text-green-800';
  if (daysRemaining === 2) return 'bg-yellow-100 text-yellow-800';
  if (daysRemaining === 1) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

function getDestinationLabel(dest: string): string {
  const found = DESTINATION_OPTIONS.find((d) => d.value === dest);
  return found ? found.label : dest || '---';
}

function formatDisplayStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function generateReturnNumber(): string {
  return `RTN-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
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

function calculateDaysAtBranch(dateReceivedAtBranch: string): number {
  if (!dateReceivedAtBranch) return 0;
  const received = new Date(dateReceivedAtBranch);
  const today = new Date();
  const diffMs = today.getTime() - received.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateShelfLifeRemaining(dateReceivedAtBranch: string): number {
  const daysAtBranch = calculateDaysAtBranch(dateReceivedAtBranch);
  return Math.max(0, DEFAULT_SHELF_LIFE_DAYS - daysAtBranch);
}

// ─── Empty Form State ────────────────────────────────────────────────────────

const emptyFormData = {
  outlet_id: '',
  return_reason: 'Freshness Policy' as OutletReturn['return_reason'],
  returned_by: '',
  notes: '',
  return_date: new Date().toISOString().split('T')[0],
};

const emptyFormItem: FormReturnItem = {
  temp_id: '',
  product_name: '',
  product_code: '',
  quantity_sent: 0,
  quantity_sold: 0,
  quantity_returning: 1,
  unit: 'pieces',
  unit_cost: 0,
  total_cost: 0,
  batch_number: '',
  date_received_at_branch: '',
  days_at_branch: 0,
  shelf_life_remaining: DEFAULT_SHELF_LIFE_DAYS,
  quality_on_return: 'Good',
  notes: '',
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function OutletReturnsPage() {
  // ── Data State ──
  const [returns, setReturns] = useState<OutletReturn[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [pricingProducts, setPricingProducts] = useState<PricingTierProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Freshness Alert State ──
  const [freshnessAlertCount, setFreshnessAlertCount] = useState(0);

  // ── Toast State ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Create Modal State ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ ...emptyFormData });
  const [formItems, setFormItems] = useState<FormReturnItem[]>([]);
  const [outletInventory, setOutletInventory] = useState<OutletInventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Detail Modal State ──
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailReturn, setDetailReturn] = useState<OutletReturn | null>(null);

  // ── Process Modal State ──
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processReturn, setProcessReturn] = useState<OutletReturn | null>(null);
  const [processQualityGrade, setProcessQualityGrade] = useState<OutletReturn['quality_grade']>('');
  const [processDestination, setProcessDestination] = useState<OutletReturn['destination']>('');
  const [processInspectionNotes, setProcessInspectionNotes] = useState('');
  const [processItemQualities, setProcessItemQualities] = useState<{ id: string; quality_on_return: ReturnItem['quality_on_return'] }[]>([]);

  // ── Reject Modal State ──
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReturn, setRejectReturn] = useState<OutletReturn | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Filter & Search State ──
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterOutlet, setFilterOutlet] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
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

  const fetchFreshnessAlerts = useCallback(async () => {
    try {
      const alertDate = new Date();
      alertDate.setDate(alertDate.getDate() - (MAX_BRANCH_STAY_DAYS - 1));
      const dateStr = alertDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('outlet_inventory')
        .select('id, last_restocked')
        .lte('last_restocked', dateStr)
        .eq('status', 'Active');

      if (error) {
        console.error('Fetch freshness alerts:', error.message);
        return;
      }

      setFreshnessAlertCount(data?.length || 0);
    } catch (err) {
      console.error('Freshness alert check failed:', err);
    }
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('outlet_returns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to load returns: ' + error.message, 'error');
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setReturns([]);
      setLoading(false);
      return;
    }

    const mapped = await Promise.all(
      data.map(async (r: Record<string, unknown>) => {
        const { data: items } = await supabase
          .from('outlet_return_items')
          .select('*')
          .eq('return_id', r.id)
          .order('created_at', { ascending: true });

        return {
          id: r.id as string,
          return_number: (r.return_number || '') as string,
          outlet_id: (r.outlet_id || '') as string,
          outlet_name: (r.outlet_name || '') as string,
          returned_by: (r.returned_by || '') as string,
          returned_by_id: (r.returned_by_id || '') as string,
          received_by: (r.received_by || '') as string,
          received_by_id: (r.received_by_id || '') as string,
          status: (r.status || 'Pending') as OutletReturn['status'],
          return_reason: (r.return_reason || 'Freshness Policy') as OutletReturn['return_reason'],
          total_items: (r.total_items || 0) as number,
          total_value: (r.total_value || 0) as number,
          wholesale_value: (r.wholesale_value || 0) as number,
          return_date: (r.return_date || '') as string,
          received_date: (r.received_date || '') as string,
          inspection_notes: (r.inspection_notes || '') as string,
          quality_grade: (r.quality_grade || '') as OutletReturn['quality_grade'],
          destination: (r.destination || '') as OutletReturn['destination'],
          notes: (r.notes || '') as string,
          created_at: (r.created_at || '') as string,
          updated_at: (r.updated_at || '') as string,
          items: (items || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            return_id: (i.return_id || '') as string,
            product_name: (i.product_name || '') as string,
            product_code: (i.product_code || '') as string,
            quantity_sent: (i.quantity_sent || 0) as number,
            quantity_sold: (i.quantity_sold || 0) as number,
            quantity_returning: (i.quantity_returning || 0) as number,
            unit: (i.unit || 'pieces') as string,
            unit_cost: (i.unit_cost || 0) as number,
            total_cost: (i.total_cost || 0) as number,
            batch_number: (i.batch_number || '') as string,
            date_received_at_branch: (i.date_received_at_branch || '') as string,
            days_at_branch: (i.days_at_branch || 0) as number,
            shelf_life_remaining: (i.shelf_life_remaining || 0) as number,
            quality_on_return: (i.quality_on_return || 'Good') as ReturnItem['quality_on_return'],
            notes: (i.notes || '') as string,
            created_at: (i.created_at || '') as string,
          })),
        };
      })
    );

    setReturns(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOutlets();
    fetchPricingProducts();
    fetchReturns();
    fetchFreshnessAlerts();
  }, [fetchOutlets, fetchPricingProducts, fetchReturns, fetchFreshnessAlerts]);

  // ── Filtering & Pagination ─────────────────────────────────────────────────

  const nonMainOutlets = outlets.filter((o) => !o.is_main_branch && o.status === 'Active');

  const filteredReturns = returns.filter((ret) => {
    const matchesStatus = filterStatus === 'All' || ret.status === filterStatus;
    const matchesOutlet = filterOutlet === 'All' || ret.outlet_id === filterOutlet;
    if (!matchesStatus || !matchesOutlet) return false;

    if (filterDateFrom) {
      const returnDate = new Date(ret.return_date || ret.created_at);
      const fromDate = new Date(filterDateFrom);
      if (returnDate < fromDate) return false;
    }
    if (filterDateTo) {
      const returnDate = new Date(ret.return_date || ret.created_at);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (returnDate > toDate) return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ret.return_number.toLowerCase().includes(term) ||
      ret.outlet_name.toLowerCase().includes(term) ||
      ret.returned_by.toLowerCase().includes(term) ||
      ret.return_reason.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / ITEMS_PER_PAGE));
  const paginatedReturns = filteredReturns.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterOutlet, filterDateFrom, filterDateTo]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalReturns = returns.length;
  const pendingCount = returns.filter((r) => r.status === 'Pending' || r.status === 'In_Transit').length;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const itemsReturnedThisMonth = returns
    .filter((r) => {
      const d = new Date(r.return_date || r.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, r) => sum + (r.total_items || 0), 0);
  const wholesaleRecoveryValue = returns
    .filter((r) => r.status === 'Processed' && r.destination === 'wholesale')
    .reduce((sum, r) => sum + (r.wholesale_value || 0), 0);

  // ── Outlet Inventory Loading for Create Modal ──────────────────────────────

  const fetchOutletInventory = async (outletId: string) => {
    if (!outletId) {
      setOutletInventory([]);
      setFormItems([]);
      return;
    }

    setLoadingInventory(true);
    try {
      const { data, error } = await supabase
        .from('outlet_inventory')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('status', 'Active')
        .order('item_name', { ascending: true });

      if (error) {
        console.error('Fetch outlet inventory:', error.message);
        setOutletInventory([]);
        setLoadingInventory(false);
        return;
      }

      const items = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        outlet_id: (r.outlet_id || '') as string,
        item_name: (r.item_name || '') as string,
        category: (r.category || '') as string,
        quantity: (r.quantity || 0) as number,
        unit: (r.unit || 'pieces') as string,
        unit_cost: (r.unit_cost || 0) as number,
        selling_price: (r.selling_price || 0) as number,
        last_restocked: (r.last_restocked || '') as string,
        status: (r.status || '') as string,
      }));

      setOutletInventory(items);

      // Auto-populate items that have been at branch >= 1 day
      const eligibleItems: FormReturnItem[] = items
        .filter((item) => {
          if (!item.last_restocked) return false;
          const daysAtBranch = calculateDaysAtBranch(item.last_restocked);
          return daysAtBranch >= 1 && item.quantity > 0;
        })
        .map((item) => {
          const daysAtBranch = calculateDaysAtBranch(item.last_restocked);
          const shelfLifeRemaining = Math.max(0, DEFAULT_SHELF_LIFE_DAYS - daysAtBranch);
          const pricingProduct = pricingProducts.find(
            (p) => p.product_name.toLowerCase() === item.item_name.toLowerCase()
          );
          const unitCost = pricingProduct?.wholesale_price || item.unit_cost || 0;

          return {
            temp_id: Date.now().toString() + Math.random().toString(36).slice(2) + item.id,
            product_name: item.item_name,
            product_code: pricingProduct?.product_code || '',
            quantity_sent: item.quantity,
            quantity_sold: 0,
            quantity_returning: item.quantity,
            unit: item.unit,
            unit_cost: unitCost,
            total_cost: item.quantity * unitCost,
            batch_number: '',
            date_received_at_branch: item.last_restocked,
            days_at_branch: daysAtBranch,
            shelf_life_remaining: shelfLifeRemaining,
            quality_on_return: (shelfLifeRemaining >= 3 ? 'Excellent' : shelfLifeRemaining >= 2 ? 'Good' : shelfLifeRemaining >= 1 ? 'Fair' : 'Poor') as ReturnItem['quality_on_return'],
            notes: '',
          };
        });

      setFormItems(eligibleItems);
    } catch (err) {
      console.error('Error fetching outlet inventory:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  // ── Form Item Management ──────────────────────────────────────────────────

  const updateFormItem = (index: number, updates: Partial<FormReturnItem>) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], ...updates };

    if (updates.quantity_returning !== undefined || updates.unit_cost !== undefined) {
      const qty = updates.quantity_returning ?? updated[index].quantity_returning;
      const cost = updates.unit_cost ?? updated[index].unit_cost;
      updated[index].total_cost = qty * cost;
    }

    if (updates.date_received_at_branch !== undefined) {
      const daysAtBranch = calculateDaysAtBranch(updates.date_received_at_branch);
      updated[index].days_at_branch = daysAtBranch;
      updated[index].shelf_life_remaining = Math.max(0, DEFAULT_SHELF_LIFE_DAYS - daysAtBranch);
    }

    setFormItems(updated);
  };

  const removeFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const addManualItem = () => {
    setFormItems([
      ...formItems,
      {
        ...emptyFormItem,
        temp_id: Date.now().toString() + Math.random().toString(36).slice(2),
      },
    ]);
  };

  const calculateFormTotals = (items: FormReturnItem[]) => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity_returning, 0);
    const totalValue = items.reduce((sum, item) => sum + item.total_cost, 0);
    return { totalItems, totalValue };
  };

  // ── Create Return ─────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setFormData({ ...emptyFormData });
    setFormItems([]);
    setOutletInventory([]);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formItems.length === 0) {
      showToast('Please add at least one item to the return', 'error');
      return;
    }

    if (!formData.outlet_id) {
      showToast('Please select an outlet', 'error');
      return;
    }

    const hasZeroQty = formItems.some((item) => item.quantity_returning <= 0);
    if (hasZeroQty) {
      showToast('All items must have a return quantity greater than 0', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const selectedOutlet = outlets.find((o) => o.id === formData.outlet_id);
      const { totalItems, totalValue } = calculateFormTotals(formItems);
      const returnNumber = generateReturnNumber();

      // Calculate wholesale value based on pricing tiers
      const wholesaleValue = formItems.reduce((sum, item) => {
        const pricingProduct = pricingProducts.find(
          (p) => p.product_name.toLowerCase() === item.product_name.toLowerCase()
        );
        const wPrice = pricingProduct?.wholesale_price || item.unit_cost;
        return sum + item.quantity_returning * wPrice;
      }, 0);

      const returnRow = {
        return_number: returnNumber,
        outlet_id: formData.outlet_id,
        outlet_name: selectedOutlet?.name || '',
        returned_by: formData.returned_by || 'Admin',
        status: 'Pending',
        return_reason: formData.return_reason,
        total_items: totalItems,
        total_value: totalValue,
        wholesale_value: wholesaleValue,
        return_date: formData.return_date || new Date().toISOString().split('T')[0],
        notes: formData.notes,
      };

      const { data: created, error: createError } = await supabase
        .from('outlet_returns')
        .insert(returnRow)
        .select()
        .single();

      if (createError) throw createError;

      if (created) {
        const itemRows = formItems.map((item) => ({
          return_id: created.id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity_sent: item.quantity_sent,
          quantity_sold: item.quantity_sold,
          quantity_returning: item.quantity_returning,
          unit: item.unit,
          unit_cost: item.unit_cost,
          total_cost: item.total_cost,
          batch_number: item.batch_number,
          date_received_at_branch: item.date_received_at_branch || null,
          days_at_branch: item.days_at_branch,
          shelf_life_remaining: item.shelf_life_remaining,
          quality_on_return: item.quality_on_return,
          notes: item.notes,
        }));

        const { error: itemsError } = await supabase
          .from('outlet_return_items')
          .insert(itemRows);

        if (itemsError) throw itemsError;

        logAudit({
          action: 'CREATE',
          module: 'Outlet Returns',
          record_id: created.id,
          details: {
            return_number: returnNumber,
            outlet: selectedOutlet?.name,
            total_items: totalItems,
            total_value: totalValue,
            return_reason: formData.return_reason,
          },
        });

        showToast(`Return ${returnNumber} created successfully`, 'success');
        setShowCreateModal(false);
        await fetchReturns();
      }
    } catch (err) {
      console.error('Create return error:', err);
      showToast('Failed to create return. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── View Detail ────────────────────────────────────────────────────────────

  const openDetailModal = (ret: OutletReturn) => {
    setDetailReturn(ret);
    setShowDetailModal(true);
  };

  // ── Status Transitions ─────────────────────────────────────────────────────

  const handleStatusTransition = async (ret: OutletReturn, newStatus: OutletReturn['status']) => {
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'Received') {
        updateData.received_date = new Date().toISOString();
        updateData.received_by = 'Admin';
      }

      const { error } = await supabase
        .from('outlet_returns')
        .update(updateData)
        .eq('id', ret.id);

      if (error) throw error;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Returns',
        record_id: ret.id,
        details: {
          return_number: ret.return_number,
          action: `Status changed to ${newStatus}`,
          outlet: ret.outlet_name,
        },
      });

      showToast(`Return ${ret.return_number} marked as ${formatDisplayStatus(newStatus)}`, 'success');
      await fetchReturns();
    } catch (err) {
      console.error('Status transition error:', err);
      showToast('Failed to update status', 'error');
    }
  };

  // ── Process Return (Inspect + Destination) ─────────────────────────────────

  const openProcessModal = (ret: OutletReturn) => {
    if (ret.status !== 'Received' && ret.status !== 'Inspected') {
      showToast('Only received or inspected returns can be processed', 'error');
      return;
    }
    setProcessReturn(ret);
    setProcessQualityGrade(ret.quality_grade || '');
    setProcessDestination(ret.destination || '');
    setProcessInspectionNotes(ret.inspection_notes || '');
    setProcessItemQualities(
      ret.items.map((item) => ({
        id: item.id,
        quality_on_return: item.quality_on_return,
      }))
    );
    setShowProcessModal(true);
  };

  const handleProcessSubmit = async () => {
    if (!processReturn) return;
    if (!processQualityGrade) {
      showToast('Please assign a quality grade', 'error');
      return;
    }
    if (!processDestination) {
      showToast('Please select a destination', 'error');
      return;
    }

    setSubmitting(true);

    try {
      // Update individual item qualities
      for (const itemQuality of processItemQualities) {
        await supabase
          .from('outlet_return_items')
          .update({ quality_on_return: itemQuality.quality_on_return })
          .eq('id', itemQuality.id);
      }

      // Calculate wholesale value based on quality grade
      let wholesaleMultiplier = 1;
      if (processQualityGrade.startsWith('B')) wholesaleMultiplier = 0.8;
      if (processQualityGrade.startsWith('C')) wholesaleMultiplier = 0.5;
      if (processQualityGrade.startsWith('D')) wholesaleMultiplier = 0;

      const newWholesaleValue = processReturn.total_value * wholesaleMultiplier;

      const updateData: Record<string, unknown> = {
        status: 'Processed',
        quality_grade: processQualityGrade,
        destination: processDestination,
        inspection_notes: processInspectionNotes,
        wholesale_value: newWholesaleValue,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('outlet_returns')
        .update(updateData)
        .eq('id', processReturn.id);

      if (error) throw error;

      logAudit({
        action: 'UPDATE',
        module: 'Outlet Returns',
        record_id: processReturn.id,
        details: {
          return_number: processReturn.return_number,
          action: 'Processed',
          quality_grade: processQualityGrade,
          destination: processDestination,
          wholesale_value: newWholesaleValue,
        },
      });

      showToast(`Return ${processReturn.return_number} processed successfully`, 'success');
      setShowProcessModal(false);
      setProcessReturn(null);
      await fetchReturns();
    } catch (err) {
      console.error('Process return error:', err);
      showToast('Failed to process return', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reject Return ──────────────────────────────────────────────────────────

  const openRejectModal = (ret: OutletReturn) => {
    setRejectReturn(ret);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectReturn) return;
    if (!rejectReason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('outlet_returns')
        .update({
          status: 'Rejected',
          notes: `${rejectReturn.notes ? rejectReturn.notes + '\n' : ''}Rejection reason: ${rejectReason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectReturn.id);

      if (error) throw error;

      logAudit({
        action: 'REJECT',
        module: 'Outlet Returns',
        record_id: rejectReturn.id,
        details: {
          return_number: rejectReturn.return_number,
          outlet: rejectReturn.outlet_name,
          reason: rejectReason,
        },
      });

      showToast(`Return ${rejectReturn.return_number} rejected`, 'success');
      setShowRejectModal(false);
      setRejectReturn(null);
      await fetchReturns();
    } catch (err) {
      console.error('Reject return error:', err);
      showToast('Failed to reject return', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete Return ──────────────────────────────────────────────────────────

  const handleDelete = async (ret: OutletReturn) => {
    if (ret.status !== 'Pending' && ret.status !== 'Rejected') {
      showToast('Only pending or rejected returns can be deleted', 'error');
      return;
    }

    if (!confirm(`Delete return ${ret.return_number}? This action cannot be undone.`)) {
      return;
    }

    try {
      await supabase
        .from('outlet_return_items')
        .delete()
        .eq('return_id', ret.id);

      const { error } = await supabase
        .from('outlet_returns')
        .delete()
        .eq('id', ret.id);

      if (error) throw error;

      logAudit({
        action: 'DELETE',
        module: 'Outlet Returns',
        record_id: ret.id,
        details: {
          return_number: ret.return_number,
          outlet: ret.outlet_name,
        },
      });

      showToast(`Return ${ret.return_number} deleted`, 'success');
      setReturns(returns.filter((r) => r.id !== ret.id));
    } catch (err) {
      console.error('Delete return error:', err);
      showToast('Failed to delete return', 'error');
    }
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <RotateCcw className="w-7 h-7 text-primary" />
              <h1 className="text-2xl font-bold">Outlet Returns</h1>
            </div>
            <p className="text-muted-foreground">
              Manage product returns from branch outlets. Track freshness, inspect quality, and route items to wholesale or other channels.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Return
          </button>
        </div>
      </div>

      {/* Freshness Alert Banner */}
      {freshnessAlertCount > 0 && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Freshness Alert</p>
            <p className="text-xs text-orange-700 mt-1">
              <strong>{freshnessAlertCount.toLocaleString()}</strong> item{freshnessAlertCount !== 1 ? 's' : ''} at branch outlets
              {freshnessAlertCount === 1 ? ' is' : ' are'} approaching or have exceeded the {MAX_BRANCH_STAY_DAYS}-day freshness limit.
              Consider initiating returns to preserve product quality and wholesale recovery value.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <RotateCcw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Returns</p>
              <p className="text-2xl font-bold">{totalReturns.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Returns</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Items Returned This Month</p>
              <p className="text-2xl font-bold text-indigo-600">{itemsReturnedThisMonth.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wholesale Recovery Value</p>
              <p className="text-2xl font-bold text-green-600">KES {wholesaleRecoveryValue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search return #, outlet..."
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

          {/* Date Range */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              title="From date"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Loading returns...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredReturns.length === 0 && (
        <div className="border border-border rounded-lg p-12 bg-card text-center">
          <RotateCcw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Returns Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterStatus !== 'All' || filterOutlet !== 'All' || filterDateFrom || filterDateTo
              ? 'No returns match your current filters. Try adjusting your search criteria.'
              : 'No outlet returns have been created yet. Create your first return to get started.'}
          </p>
          {!searchTerm && filterStatus === 'All' && filterOutlet === 'All' && !filterDateFrom && !filterDateTo && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Return
            </button>
          )}
        </div>
      )}

      {/* Returns Table */}
      {!loading && filteredReturns.length > 0 && (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Return #</th>
                <th className="px-4 py-3 text-left font-semibold">Outlet</th>
                <th className="px-4 py-3 text-right font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Value</th>
                <th className="px-4 py-3 text-center font-semibold">Quality Grade</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReturns.map((ret) => (
                <tr
                  key={ret.id}
                  className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => openDetailModal(ret)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-primary">{ret.return_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{ret.outlet_name || '---'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{ret.total_items.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold">KES {ret.total_value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center">
                    {ret.quality_grade ? (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getQualityGradeColor(ret.quality_grade)}`}>
                        {ret.quality_grade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">---</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(ret.status)}`}
                    >
                      {getStatusIcon(ret.status)}
                      {formatDisplayStatus(ret.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {ret.return_date ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{formatDate(ret.return_date)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">---</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => openDetailModal(ret)}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Pending -> In Transit */}
                      {ret.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatusTransition(ret, 'In_Transit')}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Mark In Transit"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openRejectModal(ret)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* In Transit -> Received */}
                      {ret.status === 'In_Transit' && (
                        <>
                          <button
                            onClick={() => handleStatusTransition(ret, 'Received')}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                            title="Mark Received"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openRejectModal(ret)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Received / Inspected -> Process */}
                      {(ret.status === 'Received' || ret.status === 'Inspected') && (
                        <>
                          <button
                            onClick={() => openProcessModal(ret)}
                            className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                            title="Process Return"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openRejectModal(ret)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Delete for Pending / Rejected */}
                      {(ret.status === 'Pending' || ret.status === 'Rejected') && (
                        <button
                          onClick={() => handleDelete(ret)}
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
      {!loading && filteredReturns.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}--
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredReturns.length)} of{' '}
            {filteredReturns.length} returns
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
      {/* ── CREATE RETURN MODAL ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Outlet Return"
        size="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Return Details */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Return Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Outlet *</label>
                <select
                  value={formData.outlet_id}
                  onChange={(e) => {
                    setFormData({ ...formData, outlet_id: e.target.value });
                    fetchOutletInventory(e.target.value);
                  }}
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
                <label className="block text-xs text-muted-foreground mb-1">Return Reason</label>
                <select
                  value={formData.return_reason}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      return_reason: e.target.value as OutletReturn['return_reason'],
                    })
                  }
                  className={inputClass}
                >
                  {RETURN_REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Return Date</label>
                <input
                  type="date"
                  value={formData.return_date}
                  onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Returned By</label>
                <input
                  type="text"
                  value={formData.returned_by}
                  onChange={(e) => setFormData({ ...formData, returned_by: e.target.value })}
                  placeholder="Name of person returning"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this return..."
                  className={inputClass}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Loading Inventory */}
          {loadingInventory && (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading outlet inventory...</span>
              </div>
            </div>
          )}

          {/* Auto-populated Items Info */}
          {formData.outlet_id && !loadingInventory && formItems.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Thermometer className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <strong>{formItems.length}</strong> item{formItems.length !== 1 ? 's' : ''} auto-populated from outlet inventory
                (items at branch for 1+ days). Adjust quantities and remove items as needed.
              </div>
            </div>
          )}

          {/* Return Items */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Return Items ({formItems.length})
              </p>
              <button
                type="button"
                onClick={addManualItem}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>

            {formItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {formData.outlet_id
                    ? 'No eligible items found for return. Add items manually if needed.'
                    : 'Select an outlet above to auto-populate returnable items.'}
                </p>
              </div>
            ) : (
              <>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/70 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-20">Sent</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-20">Sold</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-24">Returning</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-20">Days</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-20">Shelf Life</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold w-24">Quality</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold w-24">Value</th>
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
                            <input
                              type="number"
                              min="0"
                              value={item.quantity_sent}
                              onChange={(e) => updateFormItem(index, { quantity_sent: parseInt(e.target.value) || 0 })}
                              className="w-16 text-center px-1 py-1 border border-border rounded text-sm bg-background"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity_sold}
                              onChange={(e) => updateFormItem(index, { quantity_sold: parseInt(e.target.value) || 0 })}
                              className="w-16 text-center px-1 py-1 border border-border rounded text-sm bg-background"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateFormItem(index, { quantity_returning: Math.max(1, item.quantity_returning - 1) })}
                                className="w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 text-xs font-bold"
                              >-</button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity_returning}
                                onChange={(e) => updateFormItem(index, { quantity_returning: parseInt(e.target.value) || 1 })}
                                className="w-14 text-center px-1 py-1 border border-border rounded text-sm bg-background"
                              />
                              <button
                                type="button"
                                onClick={() => updateFormItem(index, { quantity_returning: item.quantity_returning + 1 })}
                                className="w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 text-xs font-bold"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs font-semibold ${getFreshnessColor(item.shelf_life_remaining)}`}>
                              {item.days_at_branch}d
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${getFreshnessBgColor(item.shelf_life_remaining)}`}>
                              {item.shelf_life_remaining}d left
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={item.quality_on_return}
                              onChange={(e) => updateFormItem(index, { quality_on_return: e.target.value as ReturnItem['quality_on_return'] })}
                              className="px-1 py-1 border border-border rounded text-xs bg-background"
                            >
                              {QUALITY_ON_RETURN_OPTIONS.map((q) => (
                                <option key={q} value={q}>{q}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold">
                            ${item.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
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
                      <span className="font-bold">{calculateFormTotals(formItems).totalItems.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Value:</span>{' '}
                      <span className="font-bold text-lg">
                        ${calculateFormTotals(formItems).totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  Create Return
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW RETURN DETAIL MODAL ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setDetailReturn(null);
        }}
        title={`Return ${detailReturn?.return_number || ''}`}
        size="4xl"
      >
        {detailReturn && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Return Info */}
            <div className="border border-border rounded-lg p-4 bg-secondary/20">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{' '}
                  <span className="font-medium ml-2">{detailReturn.outlet_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span
                    className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(detailReturn.status)}`}
                  >
                    {getStatusIcon(detailReturn.status)}
                    {formatDisplayStatus(detailReturn.status)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reason:</span>{' '}
                  <span className="font-medium ml-2">{detailReturn.return_reason}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Return Date:</span>{' '}
                  <span className="font-medium ml-2">{formatDate(detailReturn.return_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Returned By:</span>{' '}
                  <span className="font-medium ml-2">{detailReturn.returned_by || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received By:</span>{' '}
                  <span className="font-medium ml-2">{detailReturn.received_by || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Received Date:</span>{' '}
                  <span className="font-medium ml-2">
                    {detailReturn.received_date ? formatDateTime(detailReturn.received_date) : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  <span className="font-medium ml-2">{formatDateTime(detailReturn.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>{' '}
                  <span className="font-medium ml-2">
                    {detailReturn.updated_at ? formatDateTime(detailReturn.updated_at) : '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quality & Destination (if processed) */}
            {(detailReturn.quality_grade || detailReturn.destination) && (
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Inspection Results
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {detailReturn.quality_grade && (
                    <div>
                      <span className="text-muted-foreground">Quality Grade:</span>{' '}
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getQualityGradeColor(detailReturn.quality_grade)}`}>
                        {detailReturn.quality_grade}
                      </span>
                    </div>
                  )}
                  {detailReturn.destination && (
                    <div>
                      <span className="text-muted-foreground">Destination:</span>{' '}
                      <span className="font-medium ml-2">{getDestinationLabel(detailReturn.destination)}</span>
                    </div>
                  )}
                  {detailReturn.wholesale_value > 0 && (
                    <div>
                      <span className="text-muted-foreground">Wholesale Value:</span>{' '}
                      <span className="font-semibold text-green-600 ml-2">
                        ${detailReturn.wholesale_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
                {detailReturn.inspection_notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <span className="text-muted-foreground text-xs">Inspection Notes:</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{detailReturn.inspection_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Items</p>
                <p className="text-xl font-bold">{detailReturn.total_items.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">KES {detailReturn.total_value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Wholesale Value</p>
                <p className="text-xl font-bold text-green-600">KES {detailReturn.wholesale_value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Package className="w-4 h-4" />
                Return Items ({detailReturn.items.length})
              </h4>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Sent</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Sold</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Returning</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Days at Branch</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Shelf Life</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Quality</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailReturn.items.map((item) => {
                      const currentDays = item.date_received_at_branch
                        ? calculateDaysAtBranch(item.date_received_at_branch)
                        : item.days_at_branch;
                      const currentShelfLife = item.date_received_at_branch
                        ? calculateShelfLifeRemaining(item.date_received_at_branch)
                        : item.shelf_life_remaining;
                      return (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.product_code && <span className="font-mono">{item.product_code}</span>}
                              {item.batch_number && <span className="ml-2">Batch: {item.batch_number}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{item.quantity_sent.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{item.quantity_sold.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-semibold">{item.quantity_returning.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-semibold ${getFreshnessColor(currentShelfLife)}`}>
                              {currentDays}d
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${getFreshnessBgColor(currentShelfLife)}`}>
                              {currentShelfLife}d left
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getQualityOnReturnColor(item.quality_on_return)}`}>
                              {item.quality_on_return}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            ${item.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-secondary/50">
                    <tr>
                      <td colSpan={7} className="px-3 py-2 text-right font-semibold text-sm">
                        Grand Total:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-sm">
                        ${detailReturn.items
                          .reduce((sum, i) => sum + i.total_cost, 0)
                          .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            {detailReturn.notes && (
              <div className="border border-border rounded-lg p-4 bg-secondary/20">
                <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                  Notes
                </h4>
                <p className="text-sm whitespace-pre-wrap">{detailReturn.notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {detailReturn.status === 'Pending' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleStatusTransition(detailReturn, 'In_Transit');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <Truck className="w-4 h-4" />
                  Mark In Transit
                </button>
              )}
              {detailReturn.status === 'In_Transit' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleStatusTransition(detailReturn, 'Received');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Mark Received
                </button>
              )}
              {(detailReturn.status === 'Received' || detailReturn.status === 'Inspected') && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openProcessModal(detailReturn);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Process Return
                </button>
              )}
              {detailReturn.status !== 'Processed' && detailReturn.status !== 'Rejected' && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openRejectModal(detailReturn);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              )}
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailReturn(null);
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
      {/* ── PROCESS RETURN MODAL ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showProcessModal}
        onClose={() => {
          setShowProcessModal(false);
          setProcessReturn(null);
        }}
        title={`Process Return ${processReturn?.return_number || ''}`}
        size="3xl"
      >
        {processReturn && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Return Info */}
            <div className="border border-border rounded-lg p-3 bg-secondary/20">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Outlet:</span>{' '}
                  <span className="font-medium ml-1">{processReturn.outlet_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Return Reason:</span>{' '}
                  <span className="font-medium ml-1">{processReturn.return_reason}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Items:</span>{' '}
                  <span className="font-medium ml-1">{processReturn.total_items.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Value:</span>{' '}
                  <span className="font-medium ml-1">KES {processReturn.total_value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Item Quality Inspection */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Inspect Item Quality
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Assess the quality of each returned item. This will help determine the overall quality grade and destination.
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-xs">Product</th>
                      <th className="px-3 py-2 text-right font-semibold text-xs">Qty</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Days at Branch</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Shelf Life</th>
                      <th className="px-3 py-2 text-center font-semibold text-xs">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processReturn.items.map((item) => {
                      const itemQuality = processItemQualities.find((q) => q.id === item.id);
                      const currentShelfLife = item.date_received_at_branch
                        ? calculateShelfLifeRemaining(item.date_received_at_branch)
                        : item.shelf_life_remaining;
                      const currentDays = item.date_received_at_branch
                        ? calculateDaysAtBranch(item.date_received_at_branch)
                        : item.days_at_branch;
                      return (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{item.product_name}</td>
                          <td className="px-3 py-2 text-right">{item.quantity_returning.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-semibold ${getFreshnessColor(currentShelfLife)}`}>
                              {currentDays}d
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${getFreshnessBgColor(currentShelfLife)}`}>
                              {currentShelfLife}d left
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={itemQuality?.quality_on_return || item.quality_on_return}
                              onChange={(e) => {
                                setProcessItemQualities(
                                  processItemQualities.map((q) =>
                                    q.id === item.id
                                      ? { ...q, quality_on_return: e.target.value as ReturnItem['quality_on_return'] }
                                      : q
                                  )
                                );
                              }}
                              className="px-2 py-1 border border-border rounded text-xs bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                              {QUALITY_ON_RETURN_OPTIONS.map((q) => (
                                <option key={q} value={q}>{q}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quality Grade & Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quality Grade <span className="text-red-500">*</span>
                </label>
                <select
                  value={processQualityGrade}
                  onChange={(e) => setProcessQualityGrade(e.target.value as OutletReturn['quality_grade'])}
                  className={inputClass}
                  required
                >
                  <option value="">Select Quality Grade</option>
                  {QUALITY_GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {processQualityGrade && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {processQualityGrade.startsWith('A') && 'Fresh products suitable for wholesale at full value.'}
                    {processQualityGrade.startsWith('B') && 'Good quality, suitable for wholesale at 80% value.'}
                    {processQualityGrade.startsWith('C') && 'Must be sold today at discount (50% value).'}
                    {processQualityGrade.startsWith('D') && 'Not suitable for sale. Will be marked as waste.'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Destination <span className="text-red-500">*</span>
                </label>
                <select
                  value={processDestination}
                  onChange={(e) => setProcessDestination(e.target.value as OutletReturn['destination'])}
                  className={inputClass}
                  required
                >
                  <option value="">Select Destination</option>
                  {DESTINATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Wholesale Value Preview */}
            {processQualityGrade && (
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <DollarSign className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <strong>Estimated Wholesale Recovery:</strong>{' '}
                  ${(
                    processReturn.total_value *
                    (processQualityGrade.startsWith('A') ? 1 : processQualityGrade.startsWith('B') ? 0.8 : processQualityGrade.startsWith('C') ? 0.5 : 0)
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs text-green-600">
                    ({processQualityGrade.startsWith('A') ? '100%' : processQualityGrade.startsWith('B') ? '80%' : processQualityGrade.startsWith('C') ? '50%' : '0%'} of ${processReturn.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
              </div>
            )}

            {/* Inspection Notes */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Inspection Notes</label>
              <textarea
                value={processInspectionNotes}
                onChange={(e) => setProcessInspectionNotes(e.target.value)}
                placeholder="Notes about the inspection and quality assessment..."
                className={inputClass}
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setShowProcessModal(false);
                  setProcessReturn(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessSubmit}
                disabled={submitting || !processQualityGrade || !processDestination}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Process Return
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REJECT RETURN MODAL ───────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReturn(null);
        }}
        title={`Reject Return ${rejectReturn?.return_number || ''}`}
        size="lg"
      >
        {rejectReturn && (
          <div className="space-y-5">
            {/* Warning Banner */}
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Reject this return?</p>
                <p className="text-xs text-red-700 mt-1">
                  This will reject the return from{' '}
                  <strong>{rejectReturn.outlet_name}</strong> with{' '}
                  {rejectReturn.total_items.toLocaleString()} items valued at KES{' '}
                  {rejectReturn.total_value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Items will remain at the outlet.
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
                placeholder="Please provide a reason for rejecting this return..."
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
                  setRejectReturn(null);
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
                    Reject Return
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
