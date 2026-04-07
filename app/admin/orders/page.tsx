'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Globe, PhoneCall, CheckCircle, XCircle, CreditCard, Truck, Clock, Eye, MapPin, ExternalLink, Search, Trash2, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { logAudit } from '@/lib/audit-logger';

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  isNonInventory?: boolean;
  unitCost?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  status: 'Pending' | 'Confirmed' | 'Processing' | 'Ready' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Rejected' | 'On Hold';
  source: 'Regular' | 'Online' | 'OnCall';
  orderDate: string;
  dueDate: string;
  assignedDriver?: string;
  deliveryNotes: string;
  paymentStatus: 'Unpaid' | 'Pay on Delivery' | 'Paid' | 'M-Pesa Pending';
  fulfillment: 'Delivery' | 'Pickup';
  rejectionReason?: string;
}

interface CustomerLocation {
  name: string;
  phone: string;
  location: string;
  address: string;
  gpsLat: number;
  gpsLng: number;
  landmark: string;
  deliveryInstructions: string;
  type: string;
  isRegistered: boolean;
}

type Tab = 'regular' | 'online' | 'oncall';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('regular');

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<Order | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<Order | null>(null);
  const [detailCustomerLocation, setDetailCustomerLocation] = useState<CustomerLocation | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterOnlineStatus, setFilterOnlineStatus] = useState<string>('All');
  const [rejectReason, setRejectReason] = useState('');

  // Enhanced datatable states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const itemsPerPage = 10;

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const [confirmPayment, setConfirmPayment] = useState<Order['paymentStatus']>('Pay on Delivery');
  const [confirmFulfillment, setConfirmFulfillment] = useState<Order['fulfillment']>('Delivery');

  const [formData, setFormData] = useState<Omit<Order, 'id' | 'total'>>({
    orderNumber: '',
    customerName: '',
    customerPhone: '',
    items: [{ productName: '', quantity: 1, unitPrice: 0, isNonInventory: false, unitCost: 0 }],
    status: 'Pending',
    source: 'Regular',
    orderDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    assignedDriver: '',
    deliveryNotes: '',
    paymentStatus: 'Unpaid',
    fulfillment: 'Delivery',
  });

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) {
      if (data.length === 0) {
        setOrders([]);
        return;
      }
      const mapped = await Promise.all(data.map(async (r: Record<string, unknown>) => {
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', r.id);
        return {
          id: r.id as string,
          orderNumber: (r.order_number || '') as string,
          customerName: (r.customer_name || '') as string,
          customerPhone: (r.customer_phone || '') as string,
          items: (items || []).map((i: Record<string, unknown>) => ({
            productName: i.product_name as string,
            quantity: i.quantity as number,
            unitPrice: i.unit_price as number,
            isNonInventory: Boolean(i.is_non_inventory),
            unitCost: (i.unit_cost as number) || 0,
          })),
          total: (r.total_amount || 0) as number,
          status: (r.status || 'Pending') as Order['status'],
          source: (r.source || 'Regular') as Order['source'],
          orderDate: (r.order_date || '') as string,
          dueDate: (r.due_date || '') as string,
          assignedDriver: (r.assigned_driver || '') as string,
          deliveryNotes: (r.delivery_notes || '') as string,
          paymentStatus: (r.payment_status || 'Unpaid') as Order['paymentStatus'],
          fulfillment: (r.fulfillment || 'Delivery') as Order['fulfillment'],
          rejectionReason: (r.rejection_reason || '') as string,
        };
      }));
      setOrders(mapped);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    supabase.from('employees').select('first_name, last_name').eq('category', 'Driver').eq('status', 'Active').then(({ data }) => {
      if (data) setDrivers(data.map((d: Record<string, unknown>) => `${d.first_name} ${d.last_name}`));
    });
  }, []);

  // Computed lists per tab
  const regularOrders = orders.filter(o => o.source === 'Regular' || !o.source);
  const onlineOrders  = orders.filter(o => o.source === 'Online');
  const onCallOrders  = orders.filter(o => o.source === 'OnCall');

  const pendingOnline = onlineOrders.filter(o => o.status === 'Pending').length;

  // Fetch customer location for detail modal
  const fetchCustomerLocation = useCallback(async (order: Order) => {
    if (!order.customerPhone && !order.customerName) {
      setDetailCustomerLocation(null);
      return;
    }
    // Try to find by phone first, then by name
    let customer = null;
    if (order.customerPhone) {
      const { data } = await supabase.from('customers').select('*').eq('phone', order.customerPhone).limit(1).single();
      customer = data;
    }
    if (!customer && order.customerName) {
      const { data } = await supabase.from('customers').select('*').eq('name', order.customerName).limit(1).single();
      customer = data;
    }

    if (customer) {
      setDetailCustomerLocation({
        name: (customer.name || '') as string,
        phone: (customer.phone || '') as string,
        location: (customer.location || '') as string,
        address: (customer.address || '') as string,
        gpsLat: (customer.gps_lat || 0) as number,
        gpsLng: (customer.gps_lng || 0) as number,
        landmark: (customer.landmark || '') as string,
        deliveryInstructions: (customer.delivery_instructions || '') as string,
        type: (customer.type || '') as string,
        isRegistered: true,
      });
    } else {
      // Walk-in customer — only delivery notes available
      setDetailCustomerLocation({
        name: order.customerName,
        phone: order.customerPhone,
        location: '',
        address: '',
        gpsLat: 0,
        gpsLng: 0,
        landmark: '',
        deliveryInstructions: order.deliveryNotes || '',
        type: 'Walk-in',
        isRegistered: false,
      });
    }
  }, []);

  const openDetailModal = (order: Order) => {
    setShowDetailModal(order);
    fetchCustomerLocation(order);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const calculatedTotal = formData.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const row = {
      order_number: formData.orderNumber,
      customer_name: formData.customerName,
      customer_phone: formData.customerPhone,
      total_amount: calculatedTotal,
      status: formData.status,
      source: formData.source,
      order_date: formData.orderDate || null,
      due_date: formData.dueDate || null,
      assigned_driver: formData.assignedDriver,
      delivery_notes: formData.deliveryNotes,
      payment_status: formData.paymentStatus,
      fulfillment: formData.fulfillment,
    };
    const syncNonInventoryCosts = async (orderNumber: string, items: OrderItem[]) => {
      const ref = `ORDER:${orderNumber}`;
      const entries = items
        .filter(i => i.isNonInventory && (i.unitCost || 0) > 0)
        .map(i => ({
          date: formData.orderDate || null,
          category: 'Non-Inventory',
          description: `${orderNumber} - ${i.productName || 'Custom Item'}`,
          amount: (i.unitCost || 0) * i.quantity,
          payment_status: formData.paymentStatus === 'Paid' ? 'Paid' : 'Pending',
          reference: ref,
          notes: 'Auto: non-inventory order item',
          cost_type: 'direct_cost',
        }));
      try {
        await supabase.from('cost_entries').delete().eq('reference', ref);
        if (entries.length > 0) {
          await supabase.from('cost_entries').insert(entries);
        }
      } catch {
        try {
          await supabase.from('cost_entries').delete().eq('reference', ref);
          if (entries.length > 0) {
            const fallback = entries.map(({ cost_type, ...rest }) => rest);
            await supabase.from('cost_entries').insert(fallback);
          }
        } catch { /* ignore */ }
      }
    };

    const buildOrderItems = (orderId: string) => (
      formData.items.map(i => ({
        order_id: orderId,
        product_name: i.productName,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total: i.quantity * i.unitPrice,
        is_non_inventory: !!i.isNonInventory,
        unit_cost: i.unitCost || 0,
        cost_total: (i.unitCost || 0) * i.quantity,
      }))
    );

    const insertOrderItems = async (orderId: string) => {
      if (formData.items.length === 0) return;
      const payload = buildOrderItems(orderId);
      try {
        await supabase.from('order_items').insert(payload);
      } catch {
        const fallback = payload.map(({ is_non_inventory, unit_cost, cost_total, ...rest }) => rest);
        await supabase.from('order_items').insert(fallback);
      }
    };

    try {
      if (editingId) {
        await supabase.from('orders').update(row).eq('id', editingId);
        await supabase.from('order_items').delete().eq('order_id', editingId);
        await insertOrderItems(editingId);
        await syncNonInventoryCosts(formData.orderNumber, formData.items);
        logAudit({
          action: 'UPDATE',
          module: 'Orders',
          record_id: editingId,
          details: { orderNumber: formData.orderNumber, customer: formData.customerName, total: calculatedTotal, status: formData.status },
        });
      } else {
        const { data: created } = await supabase.from('orders').insert(row).select().single();
        if (created) {
          await insertOrderItems(created.id as string);
          await syncNonInventoryCosts(formData.orderNumber, formData.items);
        }
        if (created) {
          logAudit({
            action: 'CREATE',
            module: 'Orders',
            record_id: created.id,
            details: { orderNumber: formData.orderNumber, customer: formData.customerName, total: calculatedTotal, status: formData.status },
          });
        }
      }
      await fetchOrders();
    } catch (err) { console.error(err); }
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData({
      orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
      customerName: '', customerPhone: '',
      items: [{ productName: '', quantity: 1, unitPrice: 0, isNonInventory: false, unitCost: 0 }],
      status: 'Pending', source: 'Regular',
      orderDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      assignedDriver: '', deliveryNotes: '',
      paymentStatus: 'Unpaid', fulfillment: 'Delivery',
    });
    setEditingId(null);
  };

  const handleEdit = (order: Order) => {
    setFormData({
      orderNumber: order.orderNumber, customerName: order.customerName, customerPhone: order.customerPhone,
      items: order.items.length > 0 ? order.items : [{ productName: '', quantity: 1, unitPrice: 0, isNonInventory: false, unitCost: 0 }],
      status: order.status, source: order.source,
      orderDate: order.orderDate, dueDate: order.dueDate,
      assignedDriver: order.assignedDriver || '', deliveryNotes: order.deliveryNotes,
      paymentStatus: order.paymentStatus, fulfillment: order.fulfillment,
    });
    setEditingId(order.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this order?')) {
      const orderToDelete = orders.find(o => o.id === id);
      await supabase.from('order_items').delete().eq('order_id', id);
      await supabase.from('orders').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Orders',
        record_id: id,
        details: { orderNumber: orderToDelete?.orderNumber, customer: orderToDelete?.customerName, total: orderToDelete?.total },
      });
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    const order = orders.find(o => o.id === orderId);
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    logAudit({
      action: 'UPDATE',
      module: 'Orders',
      record_id: orderId,
      details: { orderNumber: order?.orderNumber, customer: order?.customerName, total: order?.total, status: newStatus, previousStatus: order?.status },
    });
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    // Update detail modal if open
    if (showDetailModal && showDetailModal.id === orderId) {
      setShowDetailModal({ ...showDetailModal, status: newStatus });
    }
  };

  const handleAssignDriver = async (orderId: string, driver: string) => {
    const order = orders.find(o => o.id === orderId);
    await supabase.from('orders').update({ assigned_driver: driver, status: 'Shipped' }).eq('id', orderId);
    logAudit({
      action: 'UPDATE',
      module: 'Orders',
      record_id: orderId,
      details: { orderNumber: order?.orderNumber, customer: order?.customerName, total: order?.total, status: 'Shipped', assignedDriver: driver },
    });
    setOrders(orders.map(o => o.id === orderId ? { ...o, assignedDriver: driver, status: 'Shipped' } : o));
    if (showDetailModal && showDetailModal.id === orderId) {
      setShowDetailModal({ ...showDetailModal, assignedDriver: driver, status: 'Shipped' });
    }
    setShowTracking(false);
  };

  // ── Online Order Actions ──
  const handleConfirmOrder = async () => {
    if (!showConfirmModal) return;
    await supabase.from('orders').update({
      status: 'Confirmed',
      payment_status: confirmPayment,
      fulfillment: confirmFulfillment,
    }).eq('id', showConfirmModal.id);
    logAudit({
      action: 'UPDATE',
      module: 'Orders',
      record_id: showConfirmModal.id,
      details: { orderNumber: showConfirmModal.orderNumber, customer: showConfirmModal.customerName, total: showConfirmModal.total, status: 'Confirmed', previousStatus: showConfirmModal.status, paymentStatus: confirmPayment, fulfillment: confirmFulfillment },
    });
    const updated = orders.map(o => o.id === showConfirmModal.id
      ? { ...o, status: 'Confirmed' as const, paymentStatus: confirmPayment, fulfillment: confirmFulfillment }
      : o);
    setOrders(updated);
    // Update detail modal if open
    if (showDetailModal && showDetailModal.id === showConfirmModal.id) {
      setShowDetailModal({ ...showDetailModal, status: 'Confirmed', paymentStatus: confirmPayment, fulfillment: confirmFulfillment });
    }
    setShowConfirmModal(null);
  };

  const handleRejectOrder = async () => {
    if (!showRejectModal) return;
    await supabase.from('orders').update({
      status: 'Rejected',
      rejection_reason: rejectReason,
    }).eq('id', showRejectModal.id);
    logAudit({
      action: 'UPDATE',
      module: 'Orders',
      record_id: showRejectModal.id,
      details: { orderNumber: showRejectModal.orderNumber, customer: showRejectModal.customerName, total: showRejectModal.total, status: 'Rejected', previousStatus: showRejectModal.status, rejectionReason: rejectReason },
    });
    const updated = orders.map(o => o.id === showRejectModal.id
      ? { ...o, status: 'Rejected' as const, rejectionReason: rejectReason }
      : o);
    setOrders(updated);
    if (showDetailModal && showDetailModal.id === showRejectModal.id) {
      setShowDetailModal({ ...showDetailModal, status: 'Rejected', rejectionReason: rejectReason });
    }
    setShowRejectModal(null);
    setRejectReason('');
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { productName: '', quantity: 1, unitPrice: 0, isNonInventory: false, unitCost: 0 }] });
  const updateItem = (idx: number, field: string, value: string | number | boolean) => {
    const updated = [...formData.items];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, items: updated });
  };
  const removeItem = (idx: number) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const getStatusColor = (s: Order['status']) => {
    switch (s) {
      case 'On Hold':    return 'bg-amber-100 text-amber-800';
      case 'Pending':    return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed':  return 'bg-blue-100 text-blue-800';
      case 'Processing': return 'bg-indigo-100 text-indigo-800';
      case 'Ready':      return 'bg-purple-100 text-purple-800';
      case 'Shipped':    return 'bg-orange-100 text-orange-800';
      case 'Delivered':  return 'bg-green-100 text-green-800';
      case 'Cancelled':  return 'bg-gray-100 text-gray-700';
      case 'Rejected':   return 'bg-red-100 text-red-800';
      default:           return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (p: Order['paymentStatus']) => {
    switch (p) {
      case 'Paid':             return 'bg-green-100 text-green-800';
      case 'Pay on Delivery':  return 'bg-amber-100 text-amber-800';
      case 'M-Pesa Pending':   return 'bg-blue-100 text-blue-800';
      default:                 return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredRegular = regularOrders.filter(o => {
    const matchesStatus = filterStatus === 'All' || o.status === filterStatus;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.orderNumber.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term) || o.customerPhone.toLowerCase().includes(term);
  });
  const filteredOnline  = onlineOrders.filter(o => {
    const matchesStatus = filterOnlineStatus === 'All' || o.status === filterOnlineStatus;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.orderNumber.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term) || o.customerPhone.toLowerCase().includes(term);
  });
  const filteredOnCall  = onCallOrders.filter(o => {
    const matchesStatus = filterStatus === 'All' || o.status === filterStatus;
    if (!matchesStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return o.orderNumber.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term) || o.customerPhone.toLowerCase().includes(term);
  });

  // Pagination per tab
  const getPagedData = (data: Order[]) => {
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paged = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    return { paged, totalPages, total: data.length };
  };

  // Reset page on filter/search/tab change
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [searchTerm, filterStatus, filterOnlineStatus, activeTab]);

  // Select all logic for current page
  const getCurrentPageItems = () => {
    if (activeTab === 'regular') return getPagedData(filteredRegular).paged;
    if (activeTab === 'online') return getPagedData(filteredOnline).paged;
    return getPagedData(filteredOnCall).paged;
  };
  const currentPageItems = getCurrentPageItems();
  const allPageSelected = currentPageItems.length > 0 && currentPageItems.every(o => selectedIds.has(o.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); currentPageItems.forEach(o => n.delete(o.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); currentPageItems.forEach(o => n.add(o.id)); return n; });
    }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected order(s)?`)) return;
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) await supabase.from('order_items').delete().eq('order_id', id);
      const { error } = await supabase.from('orders').delete().in('id', ids);
      if (error) throw error;
      for (const id of ids) {
        const orderToDelete = orders.find(o => o.id === id);
        logAudit({
          action: 'DELETE',
          module: 'Orders',
          record_id: id,
          details: { orderNumber: orderToDelete?.orderNumber, customer: orderToDelete?.customerName, total: orderToDelete?.total },
        });
      }
      setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
      setSelectedIds(new Set());
      showToast(`${ids.length} order(s) deleted`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete: ${msg}`, 'error');
    }
  };

  // Pagination component
  const PaginationBar = ({ data }: { data: Order[] }) => {
    const { totalPages, total } = getPagedData(data);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1}&ndash;{Math.min(currentPage * itemsPerPage, total)} of {total}
        </p>
        <div className="flex gap-1 items-center">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed">
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
    );
  };

  // ── Shared Order Row renderer ──
  const OrderRow = ({ order }: { order: Order }) => (
    <tr className={`border-b border-border hover:bg-secondary/50 transition-colors ${selectedIds.has(order.id) ? 'bg-primary/5' : ''}`}>
      <td className="px-3 py-3 text-center">
        <button type="button" onClick={() => toggleSelect(order.id)} className="text-muted-foreground hover:text-foreground">
          {selectedIds.has(order.id) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-sm">{order.customerName}</p>
        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {order.items.length} item(s)
        {order.items.some(i => i.isNonInventory) && (
          <span className="ml-1 text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded">+custom</span>
        )}
      </td>
      <td className="px-4 py-3 font-semibold text-sm">KES {order.total.toLocaleString()}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(order.status)}`}>{order.status}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentColor(order.paymentStatus)}`}>{order.paymentStatus}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{order.dueDate || '\u2014'}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1 items-center">
          <button onClick={() => openDetailModal(order)}
            title="View Order Details"
            className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
            <Eye size={15} />
          </button>
          <button onClick={() => handleEdit(order)}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
          {order.status === 'Ready' && (
            <button onClick={() => { setSelectedOrderId(order.id); setShowTracking(true); }}
              className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 font-medium">Assign</button>
          )}
          <button onClick={() => handleDelete(order.id)}
            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
        </div>
      </td>
    </tr>
  );

  // ── Online Order Row with eye icon ──
  const OnlineOrderRow = ({ order }: { order: Order }) => (
    <tr className={`border-b border-border hover:bg-secondary/50 transition-colors ${order.status === 'Pending' ? 'bg-blue-50/40' : ''}`}>
      <td className="px-4 py-3 font-mono text-xs font-semibold">{order.orderNumber}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-sm">{order.customerName}</p>
        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {order.items.slice(0, 3).map((item, i) => (
            <span key={i} className="text-xs px-1.5 py-0.5 bg-secondary rounded">
              {item.quantity}x {item.productName}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="text-xs text-muted-foreground">+{order.items.length - 3} more</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-semibold text-sm">KES {order.total.toLocaleString()}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(order.status)}`}>{order.status}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentColor(order.paymentStatus)}`}>{order.paymentStatus}</span>
      </td>
      <td className="px-4 py-3">
        {order.fulfillment && (
          <span className="px-2 py-1 rounded text-xs font-semibold bg-secondary text-secondary-foreground">
            {order.fulfillment === 'Delivery' ? 'Delivery' : 'Pickup'}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{order.orderDate || '\u2014'}</td>
      <td className="px-4 py-3">
        <button onClick={() => openDetailModal(order)}
          title="View Order Details"
          className="p-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
          <Eye size={15} />
        </button>
      </td>
    </tr>
  );

  const TableHead = () => (
    <thead className="bg-secondary border-b border-border">
      <tr>
        <th className="px-3 py-3 text-center w-10">
          <button type="button" onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
            {allPageSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        </th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Order #</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Customer</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Items</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Total</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Status</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Payment</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Due Date</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Actions</th>
      </tr>
    </thead>
  );

  const OnlineTableHead = () => (
    <thead className="bg-secondary border-b border-border">
      <tr>
        <th className="px-4 py-3 text-left font-semibold text-sm">Order #</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Customer</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Items</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Total</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Status</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Payment</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Fulfilment</th>
        <th className="px-4 py-3 text-left font-semibold text-sm">Date</th>
        <th className="px-4 py-3 text-center font-semibold text-sm">View</th>
      </tr>
    </thead>
  );

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="mb-1">Order Management</h1>
        <p className="text-muted-foreground">Regular orders, online orders, and on-call orders &mdash; all in one place</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Orders', value: orders.length, color: '' },
          { label: 'On Hold', value: orders.filter(o => o.status === 'On Hold').length, color: 'text-amber-600' },
          { label: 'Pending', value: orders.filter(o => o.status === 'Pending').length, color: 'text-yellow-600' },
          { label: 'Online (new)', value: pendingOnline, color: 'text-blue-600' },
          { label: 'Delivered', value: orders.filter(o => o.status === 'Delivered').length, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {([
          { id: 'regular', label: 'Regular Orders', icon: ShoppingBag, count: regularOrders.length },
          { id: 'online',  label: 'Online Orders',  icon: Globe,       count: onlineOrders.length,  badge: pendingOnline },
          { id: 'oncall',  label: 'On-Call Orders', icon: PhoneCall,   count: onCallOrders.length },
        ] as const).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setFilterStatus('All'); setFilterOnlineStatus('All'); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors relative ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={15} />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                {tab.count}
              </span>
              {'badge' in tab && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Right-side create button */}
        <div className="ml-auto pb-2">
          {(activeTab === 'regular' || activeTab === 'oncall') && (
            <button
              onClick={() => {
                resetForm();
                setFormData(prev => ({ ...prev, source: activeTab === 'oncall' ? 'OnCall' : 'Regular' }));
                setShowForm(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
            >
              + Create Order
            </button>
          )}
        </div>
      </div>

      {/* ── REGULAR ORDERS TAB ── */}
      {activeTab === 'regular' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search orders, customers..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
              {['All', 'On Hold', 'Pending', 'Confirmed', 'Processing', 'Ready', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <button onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                <Trash2 size={14} /> Delete {selectedIds.size}
              </button>
            )}
          </div>
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <TableHead />
              <tbody>
                {filteredRegular.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No regular orders found</td></tr>
                ) : getPagedData(filteredRegular).paged.map(o => <OrderRow key={o.id} order={o} />)}
              </tbody>
            </table>
          </div>
          <PaginationBar data={filteredRegular} />
        </div>
      )}

      {/* ── ONLINE ORDERS TAB ── */}
      {activeTab === 'online' && (
        <div>
          {/* Info banner */}
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 flex gap-3 items-start">
            <Globe size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Online Orders &mdash; from your website</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Click the <Eye size={12} className="inline mx-0.5" /> eye icon to view full order details, confirm, reject, or manage fulfilment.
              </p>
            </div>
          </div>

          {/* Status filter & search */}
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Search orders, customers..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <select value={filterOnlineStatus} onChange={e => setFilterOnlineStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
              {['All', 'Pending', 'Confirmed', 'Processing', 'Ready', 'Shipped', 'Delivered', 'Rejected', 'Cancelled'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {filteredOnline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
              <Globe size={36} className="text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">No online orders yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                Once your website is live and customers start ordering, their orders will appear here for you to review and confirm.
              </p>
            </div>
          ) : (
            <>
            <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <OnlineTableHead />
                <tbody>
                  {getPagedData(filteredOnline).paged.map(o => <OnlineOrderRow key={o.id} order={o} />)}
                </tbody>
              </table>
            </div>
            <PaginationBar data={filteredOnline} />
            </>
          )}
        </div>
      )}

      {/* ── ON-CALL ORDERS TAB ── */}
      {activeTab === 'oncall' && (
        <div>
          {/* Info banner */}
          <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 px-5 py-4 flex gap-4">
            <PhoneCall size={20} className="text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-purple-900 mb-1">How On-Call Orders Work</p>
              <p className="text-sm text-purple-800 leading-relaxed">
                A customer calls in to place an order. The admin opens the <strong>POS system</strong>, searches for products, adds them to the cart, selects the customer, and checks out — choosing either <strong>Pickup</strong> or <strong>Delivery</strong> as the fulfilment method.
              </p>
              <p className="text-sm text-purple-800 mt-1">
                The sale is recorded in POS and any delivery needed can then be scheduled from the <strong>Delivery</strong> page.
              </p>
              <Link
                href="/admin/pos"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-semibold hover:bg-purple-800 transition-colors"
              >
                <ShoppingBag size={14} /> Open POS for On-Call Order
              </Link>
            </div>
          </div>

          {/* On-call orders tagged from system */}
          {onCallOrders.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">On-Call Orders History</p>
                <div className="flex gap-2 items-center">
                  <div className="relative max-w-[200px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Search..." value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs focus:ring-2 focus:ring-primary/50 outline-none" />
                  </div>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-lg text-xs focus:ring-2 focus:ring-primary/50 outline-none">
                    {['All', 'On Hold', 'Pending', 'Processing', 'Ready', 'Delivered', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
                <table className="w-full text-sm">
                  <TableHead />
                  <tbody>
                    {filteredOnCall.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No on-call orders found</td></tr>
                    ) : getPagedData(filteredOnCall).paged.map(o => <OrderRow key={o.id} order={o} />)}
                  </tbody>
                </table>
              </div>
              <PaginationBar data={filteredOnCall} />
            </>
          )}

          {onCallOrders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-xl text-center">
              <Clock size={32} className="text-muted-foreground/30 mb-2" />
              <p className="text-muted-foreground text-sm">No on-call orders recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">On-call orders are processed through the POS system above</p>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Order Modal ── */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Order' : 'Create Order'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Order Number</label>
              <input type="text" value={formData.orderNumber}
                onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Source</label>
              <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value as Order['source'] })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
                <option value="Regular">Regular</option>
                <option value="Online">Online</option>
                <option value="OnCall">On-Call</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Customer Name *</label>
              <input type="text" value={formData.customerName}
                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input type="tel" value={formData.customerPhone}
                onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Order Date</label>
              <input type="date" value={formData.orderDate}
                onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Due / Delivery Date</label>
              <input type="date" value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as Order['status'] })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
                {['On Hold','Pending','Confirmed','Processing','Ready','Shipped','Delivered','Cancelled'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Payment</label>
              <select value={formData.paymentStatus} onChange={e => setFormData({ ...formData, paymentStatus: e.target.value as Order['paymentStatus'] })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
                <option value="Unpaid">Unpaid</option>
                <option value="Pay on Delivery">Pay on Delivery</option>
                <option value="M-Pesa Pending">M-Pesa Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Fulfilment</label>
              <select value={formData.fulfillment} onChange={e => setFormData({ ...formData, fulfillment: e.target.value as Order['fulfillment'] })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none">
                <option value="Delivery">Delivery</option>
                <option value="Pickup">Pickup</option>
              </select>
            </div>
          </div>

          {/* Items */}
          <div className="border border-border rounded-lg p-3 bg-secondary/20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold">Order Items</label>
              <button type="button" onClick={addItem} className="text-xs text-primary font-medium hover:underline">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {formData.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input type="text" placeholder="Product name" value={item.productName}
                    onChange={e => updateItem(idx, 'productName', e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                  <input type="number" placeholder="Qty" value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                  <input type="number" placeholder="KES" value={item.unitPrice}
                    onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!item.isNonInventory}
                      onChange={(e) => updateItem(idx, 'isNonInventory', e.target.checked)}
                      className="rounded border-border"
                    />
                    Non-inv
                  </label>
                  <input
                    type="number"
                    placeholder="Cost"
                    value={item.unitCost || ''}
                    onChange={e => updateItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    disabled={!item.isNonInventory}
                  />
                  {formData.items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">&times;</button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border text-right text-sm font-bold">
              Total: KES {formData.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toLocaleString()}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Delivery Notes</label>
            <textarea value={formData.deliveryNotes} onChange={e => setFormData({ ...formData, deliveryNotes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
            <button type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm">
              {editingId ? 'Update' : 'Create'} Order
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Assign Driver Modal ── */}
      <Modal isOpen={showTracking && !!selectedOrder} onClose={() => setShowTracking(false)}
        title={`Assign Driver \u2014 ${selectedOrder?.orderNumber}`} size="sm">
        <div className="space-y-4">
          <div className="bg-secondary rounded-lg p-3 text-sm">
            <p className="font-semibold">{selectedOrder?.customerName}</p>
            <p className="text-muted-foreground text-xs">{selectedOrder?.customerPhone}</p>
            <p className="text-muted-foreground text-xs mt-1">KES {selectedOrder?.total.toLocaleString()} &bull; {selectedOrder?.fulfillment}</p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Select Driver</label>
            <select onChange={e => handleAssignDriver(selectedOrderId!, e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" defaultValue="">
              <option value="">Choose a driver&hellip;</option>
              {drivers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {drivers.length === 0 && <p className="text-xs text-muted-foreground mt-1">No drivers found. Add employees with category &quot;Driver&quot;.</p>}
          </div>
          <button onClick={() => setShowTracking(false)}
            className="w-full px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
        </div>
      </Modal>

      {/* ── Confirm Online Order Modal ── */}
      <Modal isOpen={!!showConfirmModal} onClose={() => setShowConfirmModal(null)}
        title="Confirm Online Order" size="sm">
        {showConfirmModal && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-green-800">{showConfirmModal.customerName}</p>
              <p className="text-green-700 text-xs">{showConfirmModal.items.length} item(s) &bull; KES {showConfirmModal.total.toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                <CreditCard size={14} className="inline mr-1" /> Payment Method
              </label>
              <div className="grid grid-cols-1 gap-2">
                {([
                  { v: 'Paid' as const, label: 'Already Paid (online)', desc: 'Customer paid via card or M-Pesa online' },
                  { v: 'Pay on Delivery' as const, label: 'Pay on Delivery (Cash)', desc: 'Customer pays in cash upon delivery/pickup' },
                  { v: 'M-Pesa Pending' as const, label: 'M-Pesa on Delivery', desc: 'We send STK push when delivering' },
                ]).map(opt => (
                  <button key={opt.v} type="button" onClick={() => setConfirmPayment(opt.v)}
                    className={`text-left px-3 py-2.5 rounded-lg border-2 transition-colors ${confirmPayment === opt.v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                <Truck size={14} className="inline mr-1" /> Fulfilment
              </label>
              <div className="flex gap-2">
                {(['Delivery', 'Pickup'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setConfirmFulfillment(f)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${confirmFulfillment === f ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}>
                    {f === 'Delivery' ? 'Delivery' : 'Pickup'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <button onClick={() => setShowConfirmModal(null)}
                className="flex-1 px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
              <button onClick={handleConfirmOrder}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm">
                Confirm Order
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reject Online Order Modal ── */}
      <Modal isOpen={!!showRejectModal} onClose={() => setShowRejectModal(null)}
        title="Reject Order" size="sm">
        {showRejectModal && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-red-800">{showRejectModal.customerName}</p>
              <p className="text-red-700 text-xs">{showRejectModal.items.length} item(s) &bull; KES {showRejectModal.total.toLocaleString()}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason for rejection</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none" rows={3}
                placeholder="e.g. Out of stock, delivery area not covered, order incomplete..." />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRejectModal(null)}
                className="flex-1 px-3 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
              <button onClick={handleRejectOrder}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm">
                Reject Order
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Enhanced Order Detail Modal ── */}
      <Modal isOpen={!!showDetailModal} onClose={() => { setShowDetailModal(null); setDetailCustomerLocation(null); }}
        title={`Order Details \u2014 ${showDetailModal?.orderNumber || ''}`} size="xl">
        {showDetailModal && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

            {/* Status & Quick Actions Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-secondary/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${getStatusColor(showDetailModal.status)}`}>{showDetailModal.status}</span>
                <span className={`px-2.5 py-1 rounded text-xs font-bold ${getPaymentColor(showDetailModal.paymentStatus)}`}>{showDetailModal.paymentStatus}</span>
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-secondary text-secondary-foreground">
                  {showDetailModal.fulfillment === 'Delivery' ? 'Delivery' : 'Pickup'}
                </span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-secondary text-muted-foreground">{showDetailModal.source}</span>
              </div>
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap gap-2">
              {showDetailModal.status === 'Pending' && (
                <>
                  <button
                    onClick={() => { setShowConfirmModal(showDetailModal); setConfirmPayment('Pay on Delivery'); setConfirmFulfillment('Delivery'); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold"
                  >
                    <CheckCircle size={13} /> Confirm Order
                  </button>
                  <button
                    onClick={() => { setShowRejectModal(showDetailModal); setRejectReason(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-xs font-semibold"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </>
              )}
              {showDetailModal.status === 'Confirmed' && (
                <>
                  <button
                    onClick={() => handleStatusChange(showDetailModal.id, 'Processing')}
                    className="px-3 py-2 text-xs bg-indigo-100 text-indigo-800 rounded-lg hover:bg-indigo-200 font-semibold"
                  >
                    Mark as Processing
                  </button>
                  <button
                    onClick={() => handleStatusChange(showDetailModal.id, 'Ready')}
                    className="px-3 py-2 text-xs bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 font-semibold"
                  >
                    Mark as Ready
                  </button>
                </>
              )}
              {showDetailModal.status === 'Processing' && (
                <button
                  onClick={() => handleStatusChange(showDetailModal.id, 'Ready')}
                  className="px-3 py-2 text-xs bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 font-semibold"
                >
                  Mark as Ready
                </button>
              )}
              {showDetailModal.status === 'Ready' && (
                <button
                  onClick={() => { setSelectedOrderId(showDetailModal.id); setShowTracking(true); }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 text-xs font-semibold"
                >
                  <Truck size={13} /> Assign Driver
                </button>
              )}
              {showDetailModal.status === 'Shipped' && (
                <button
                  onClick={() => handleStatusChange(showDetailModal.id, 'Delivered')}
                  className="px-3 py-2 text-xs bg-green-100 text-green-800 rounded-lg hover:bg-green-200 font-semibold"
                >
                  Mark as Delivered
                </button>
              )}
              <button onClick={() => { handleEdit(showDetailModal); setShowDetailModal(null); setDetailCustomerLocation(null); }}
                className="px-3 py-2 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-semibold ml-auto">
                Edit Order
              </button>
            </div>

            {showDetailModal.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
                <p className="text-sm text-red-800">{showDetailModal.rejectionReason}</p>
              </div>
            )}

            {/* Order Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
                <p className="font-semibold">{showDetailModal.customerName}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                <p className="font-semibold">{showDetailModal.customerPhone || '\u2014'}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Order Date</p>
                <p className="font-semibold">{showDetailModal.orderDate || '\u2014'}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Due Date</p>
                <p className="font-semibold">{showDetailModal.dueDate || '\u2014'}</p>
              </div>
              {showDetailModal.assignedDriver && (
                <div className="bg-card border border-border rounded-lg p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Assigned Driver</p>
                  <p className="font-semibold">{showDetailModal.assignedDriver}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {showDetailModal.items.map((item, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">
                        {item.productName}
                        {item.isNonInventory && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-800">Non-inventory</span>
                        )}
                        {item.isNonInventory && item.unitCost ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">(cost: KES {item.unitCost.toLocaleString()}/unit)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">KES {item.unitPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold">KES {(item.quantity * item.unitPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-secondary/50">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-bold">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-primary">KES {showDetailModal.total.toLocaleString()}</td>
                  </tr>
                  {showDetailModal.items.some(i => i.isNonInventory && i.unitCost) && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1 text-right text-xs text-muted-foreground">Non-inventory cost total</td>
                      <td className="px-3 py-1 text-right text-xs text-muted-foreground">
                        KES {showDetailModal.items
                          .filter(i => i.isNonInventory && i.unitCost)
                          .reduce((sum, i) => sum + (i.unitCost || 0) * i.quantity, 0)
                          .toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {/* Delivery Notes */}
            {showDetailModal.deliveryNotes && (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Delivery Notes</p>
                <p className="text-sm">{showDetailModal.deliveryNotes}</p>
              </div>
            )}

            {/* Customer Location / Map Section */}
            {detailCustomerLocation && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-secondary px-4 py-2 border-b border-border flex items-center gap-2">
                  <MapPin size={14} className="text-muted-foreground" />
                  <p className="text-sm font-semibold">
                    {detailCustomerLocation.isRegistered ? 'Registered Customer Location' : 'Walk-in Customer \u2014 Delivery Info'}
                  </p>
                  {detailCustomerLocation.isRegistered && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-auto">{detailCustomerLocation.type}</span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {detailCustomerLocation.isRegistered ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {detailCustomerLocation.location && (
                          <div>
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="font-medium">{detailCustomerLocation.location}</p>
                          </div>
                        )}
                        {detailCustomerLocation.address && (
                          <div>
                            <p className="text-xs text-muted-foreground">Full Address</p>
                            <p className="font-medium">{detailCustomerLocation.address}</p>
                          </div>
                        )}
                        {detailCustomerLocation.landmark && (
                          <div>
                            <p className="text-xs text-muted-foreground">Landmark</p>
                            <p className="font-medium">{detailCustomerLocation.landmark}</p>
                          </div>
                        )}
                        {detailCustomerLocation.deliveryInstructions && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Delivery Instructions</p>
                            <p className="font-medium">{detailCustomerLocation.deliveryInstructions}</p>
                          </div>
                        )}
                      </div>

                      {/* Map for registered customers with GPS */}
                      {detailCustomerLocation.gpsLat !== 0 && detailCustomerLocation.gpsLng !== 0 && (
                        <div className="space-y-2">
                          <div className="rounded-lg overflow-hidden border border-border">
                            <iframe
                              width="100%"
                              height="250"
                              style={{ border: 0 }}
                              loading="lazy"
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${detailCustomerLocation.gpsLng - 0.005},${detailCustomerLocation.gpsLat - 0.005},${detailCustomerLocation.gpsLng + 0.005},${detailCustomerLocation.gpsLat + 0.005}&layer=mapnik&marker=${detailCustomerLocation.gpsLat},${detailCustomerLocation.gpsLng}`}
                            />
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${detailCustomerLocation.gpsLat},${detailCustomerLocation.gpsLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                          >
                            <ExternalLink size={12} /> Open in Google Maps
                          </a>
                        </div>
                      )}
                      {(detailCustomerLocation.gpsLat === 0 && detailCustomerLocation.gpsLng === 0) && (
                        <p className="text-xs text-muted-foreground italic">No GPS coordinates saved for this customer.</p>
                      )}
                    </>
                  ) : (
                    /* Walk-in customer */
                    <div className="text-sm">
                      {detailCustomerLocation.deliveryInstructions ? (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Delivery Location / Notes</p>
                          <p className="font-medium">{detailCustomerLocation.deliveryInstructions}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No delivery location information available for this walk-in customer.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="flex justify-end pt-2 border-t border-border">
              <button onClick={() => { setShowDetailModal(null); setDetailCustomerLocation(null); }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
