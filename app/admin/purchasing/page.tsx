'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface PurchaseItem {
  id: string;
  itemId: string;
  ingredient: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  orderDate: string;
  deliveryDate: string;
  status: 'draft' | 'pending' | 'received' | 'cancelled';
  items: PurchaseItem[];
  notes: string;
}

interface Distributor {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
}

interface Customer {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string;
}

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
  category: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
}

export default function PurchasingPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Distributor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);

  // Fetch purchase orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      const mapped = await Promise.all(data.map(async (r: Record<string, unknown>) => {
        const { data: items } = await supabase.from('purchase_order_items').select('*').eq('purchase_order_id', r.id);
        return {
          id: r.id as string,
          poNumber: (r.po_number || '') as string,
          supplier: (r.supplier || '') as string,
          orderDate: (r.order_date || '') as string,
          deliveryDate: (r.delivery_date || '') as string,
          status: (r.status || 'draft') as PurchaseOrder['status'],
          notes: (r.notes || '') as string,
          items: (items || []).map((i: Record<string, unknown>) => ({
            id: i.id as string,
            itemId: (i.item_id || '') as string,
            ingredient: (i.ingredient || '') as string,
            quantity: (i.quantity || 0) as number,
            unit: (i.unit || 'kg') as string,
            unitPrice: (i.unit_price || 0) as number,
            total: (i.total || 0) as number,
          })),
        };
      }));
      setOrders(mapped);
    } else {
      setOrders([]);
    }
    setLoading(false);
  }, []);

  // Fetch suppliers (distributors)
  const fetchSuppliers = useCallback(async () => {
    const { data } = await supabase.from('distributors').select('*').eq('status', 'Active').order('name');
    if (data) {
      setSuppliers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        companyName: (r.company_name || '') as string,
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
      })));
    }
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').eq('status', 'Active').order('name');
    if (data) {
      setCustomers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        type: (r.type || '') as string,
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
      })));
    }
  }, []);

  // Fetch inventory items
  const fetchInventoryItems = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name');
    if (data) {
      setInventoryItems(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        unit: (r.unit || 'kg') as string,
        unitCost: (r.unit_cost || 0) as number,
        category: (r.category || '') as string,
      })));
    }
  }, []);

  // Fetch saved ingredients from settings
  const fetchIngredients = useCallback(async () => {
    const { data } = await supabase.from('settings_ingredients').select('*').order('name');
    if (data) {
      setIngredients(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        unit: (r.unit || 'kg') as string,
        costPerUnit: (r.cost_per_unit || 0) as number,
      })));
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchCustomers();
    fetchInventoryItems();
    fetchIngredients();
  }, [fetchOrders, fetchSuppliers, fetchCustomers, fetchInventoryItems, fetchIngredients]);

  // Auto-generate PO number
  const generatePoNumber = useCallback(() => {
    const year = new Date().getFullYear();
    const existingThisYear = orders.filter(o => o.poNumber.startsWith(`PO-${year}-`));
    let maxNum = 0;
    existingThisYear.forEach(o => {
      const parts = o.poNumber.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    return `PO-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }, [orders]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    poNumber: '',
    supplier: '',
    orderDate: '',
    deliveryDate: '',
    status: 'draft' as PurchaseOrder['status'],
    items: [] as PurchaseItem[],
    notes: '',
  });
  const [newItem, setNewItem] = useState({
    itemId: '',
    ingredient: '',
    quantity: '',
    unit: 'kg',
    unitPrice: '',
  });

  // When supplier is selected from dropdown, auto-fill name
  const handleSupplierSelect = (supplierId: string) => {
    if (supplierId === '') {
      setFormData({ ...formData, supplier: '' });
      return;
    }
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setFormData({ ...formData, supplier: supplier.name + (supplier.companyName ? ` (${supplier.companyName})` : '') });
    }
  };

  // When inventory item is selected, auto-fill fields
  const handleInventoryItemSelect = (itemId: string) => {
    if (itemId === '') {
      setNewItem({ ...newItem, itemId: '', unit: 'kg', unitPrice: '' });
      return;
    }
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
      setNewItem({
        ...newItem,
        itemId: item.id,
        unit: item.unit,
        unitPrice: item.unitCost > 0 ? item.unitCost.toString() : newItem.unitPrice,
      });
    }
  };

  // When ingredient is selected from settings, auto-fill fields
  const handleIngredientSelect = (ingredientId: string) => {
    if (ingredientId === '') {
      setNewItem({ ...newItem, ingredient: '', unit: 'kg', unitPrice: '' });
      return;
    }
    const ing = ingredients.find(i => i.id === ingredientId);
    if (ing) {
      setNewItem({
        ...newItem,
        ingredient: ing.name,
        unit: ing.unit,
        unitPrice: ing.costPerUnit > 0 ? ing.costPerUnit.toString() : newItem.unitPrice,
      });
    }
  };

  const handleAddItem = () => {
    if (newItem.ingredient && newItem.quantity && newItem.unitPrice) {
      const qty = parseFloat(newItem.quantity);
      const price = parseFloat(newItem.unitPrice);
      setFormData({
        ...formData,
        items: [
          ...formData.items,
          {
            id: Date.now().toString(),
            itemId: newItem.itemId,
            ingredient: newItem.ingredient,
            quantity: qty,
            unit: newItem.unit,
            unitPrice: price,
            total: qty * price,
          },
        ],
      });
      setNewItem({ itemId: '', ingredient: '', quantity: '', unit: 'kg', unitPrice: '' });
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.id !== itemId),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      po_number: formData.poNumber,
      supplier: formData.supplier,
      order_date: formData.orderDate || null,
      delivery_date: formData.deliveryDate || null,
      status: formData.status,
      notes: formData.notes,
    };
    try {
      if (editId) {
        await supabase.from('purchase_orders').update(row).eq('id', editId);
        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', editId);
        if (formData.items.length > 0) {
          await supabase.from('purchase_order_items').insert(
            formData.items.map(i => ({
              purchase_order_id: editId,
              item_id: i.itemId,
              ingredient: i.ingredient,
              quantity: i.quantity,
              unit: i.unit,
              unit_price: i.unitPrice,
              total: i.total,
            }))
          );
        }
        logAudit({
          action: 'UPDATE',
          module: 'Purchasing',
          record_id: editId,
          details: { po_number: formData.poNumber, supplier: formData.supplier, total: formData.items.reduce((s, i) => s + i.total, 0), status: formData.status },
        });
      } else {
        const { data: created } = await supabase.from('purchase_orders').insert(row).select().single();
        if (created && formData.items.length > 0) {
          await supabase.from('purchase_order_items').insert(
            formData.items.map(i => ({
              purchase_order_id: created.id,
              item_id: i.itemId,
              ingredient: i.ingredient,
              quantity: i.quantity,
              unit: i.unit,
              unit_price: i.unitPrice,
              total: i.total,
            }))
          );
        }
        if (created) {
          logAudit({
            action: 'CREATE',
            module: 'Purchasing',
            record_id: created.id,
            details: { po_number: formData.poNumber, supplier: formData.supplier, total: formData.items.reduce((s, i) => s + i.total, 0), status: formData.status },
          });
        }
      }
      await fetchOrders();
    } catch { /* handled by audit */ }
    setEditId(null);
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setFormData({
      poNumber: '',
      supplier: '',
      orderDate: '',
      deliveryDate: '',
      status: 'draft',
      items: [],
      notes: '',
    });
    setNewItem({ itemId: '', ingredient: '', quantity: '', unit: 'kg', unitPrice: '' });
  };

  const handleNewOrder = () => {
    setEditId(null);
    resetForm();
    // Auto-generate PO number and set today's date
    setFormData(prev => ({
      ...prev,
      poNumber: generatePoNumber(),
      orderDate: new Date().toISOString().split('T')[0],
    }));
    setShowForm(true);
  };

  const handleEdit = (order: PurchaseOrder) => {
    setEditId(order.id);
    setFormData({
      poNumber: order.poNumber,
      supplier: order.supplier,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      status: order.status,
      items: order.items,
      notes: order.notes,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this purchase order?')) {
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
      await supabase.from('purchase_orders').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Purchasing',
        record_id: id,
        details: {},
      });
      setOrders(orders.filter(o => o.id !== id));
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: PurchaseOrder['status']) => {
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', orderId);
    logAudit({
      action: 'UPDATE',
      module: 'Purchasing',
      record_id: orderId,
      details: { status: newStatus },
    });
    await fetchOrders();
  };

  const getStatusColor = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'received': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = search === '' ||
      o.poNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some(i => i.ingredient.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'draft').length;
  const totalOrderValue = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.total, 0), 0);
  const receivedOrders = orders.filter(o => o.status === 'received').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Purchasing</h1>
        <p className="text-muted-foreground">Manage purchase orders and supplier procurement</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-blue-600">{pendingOrders}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold">KES {totalOrderValue.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Received</p>
          <p className="text-2xl font-bold text-green-600">{receivedOrders}</p>
        </div>
      </div>

      {/* Search, Filter, and New Order */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search PO number, supplier, or ingredient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={handleNewOrder}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium whitespace-nowrap"
        >
          + New Purchase Order
        </button>
      </div>

      {/* ──────── Create / Edit PO Modal ──────── */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit Purchase Order' : 'Create Purchase Order'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {/* PO Number - Auto Generated, read-only for new orders */}
            <div>
              <label className="block text-sm font-medium mb-1">PO Number</label>
              <input
                type="text"
                value={formData.poNumber}
                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-secondary/50"
                placeholder="Auto-generated"
                readOnly={!editId}
                required
              />
              {!editId && <p className="text-xs text-muted-foreground mt-1">Auto-generated. Will be assigned on creation.</p>}
            </div>

            {/* Supplier - Dynamic Dropdown from Distributors */}
            <div>
              <label className="block text-sm font-medium mb-1">Supplier</label>
              <select
                value={suppliers.find(s => formData.supplier.startsWith(s.name))?.id || ''}
                onChange={(e) => handleSupplierSelect(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.companyName ? ` (${s.companyName})` : ''}{s.phone ? ` - ${s.phone}` : ''}
                  </option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No active suppliers found. Add suppliers in the Distributors module.</p>
              )}
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Order Date</label>
              <input
                type="date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PurchaseOrder['status'] })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* ──────── Line Items Section ──────── */}
          <div className="border-t border-border pt-4">
            <label className="block text-sm font-medium mb-3">Order Items</label>

            {/* Add Item Row */}
            <div className="grid grid-cols-6 gap-2 mb-3 items-end">
              {/* Inventory Item selector */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Inventory Item</label>
                <select
                  value={newItem.itemId}
                  onChange={(e) => handleInventoryItemSelect(e.target.value)}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">-- Select Item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ingredient selector from settings */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Ingredient</label>
                <select
                  value={ingredients.find(i => i.name === newItem.ingredient)?.id || ''}
                  onChange={(e) => handleIngredientSelect(e.target.value)}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">-- Select Ingredient --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) - KES {ing.costPerUnit.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Qty"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                <select
                  value={newItem.unit}
                  onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="mL">mL</option>
                  <option value="units">units</option>
                  <option value="pcs">pcs</option>
                  <option value="bags">bags</option>
                  <option value="boxes">boxes</option>
                  <option value="crates">crates</option>
                </select>
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Unit Price (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={newItem.unitPrice}
                  onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                  className="w-full px-2 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {/* Add button */}
              <div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!newItem.ingredient || !newItem.quantity || !newItem.unitPrice}
                  className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-40"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Line item subtotal preview */}
            {newItem.quantity && newItem.unitPrice && (
              <p className="text-xs text-muted-foreground mb-2">
                Subtotal: KES {(parseFloat(newItem.quantity || '0') * parseFloat(newItem.unitPrice || '0')).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}

            {/* Added Items Table */}
            {formData.items.length > 0 && (
              <div className="mt-3 border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Item ID</th>
                      <th className="px-3 py-2 text-left">Ingredient</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.itemId ? inventoryItems.find(i => i.id === item.itemId)?.name || item.itemId.slice(0, 8) : '-'}</td>
                        <td className="px-3 py-2 font-medium">{item.ingredient}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2">{item.unit}</td>
                        <td className="px-3 py-2 text-right">KES {item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold">KES {item.total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => handleRemoveItem(item.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/50">
                    <tr className="border-t border-border">
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold">Grand Total:</td>
                      <td className="px-3 py-2 text-right font-bold text-base">KES {formData.items.reduce((sum, i) => sum + i.total, 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={2}
              placeholder="Additional notes for this purchase order..."
            />
          </div>

          {/* Submit / Cancel */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={formData.items.length === 0 || !formData.supplier}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {editId ? 'Update' : 'Create'} Order
            </button>
          </div>
        </form>
      </Modal>

      {/* ──────── View Order Detail Modal ──────── */}
      <Modal
        isOpen={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? `Purchase Order: ${viewOrder.poNumber}` : ''}
        size="lg"
      >
        {viewOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">PO Number</p>
                <p className="font-semibold">{viewOrder.poNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supplier</p>
                <p className="font-semibold">{viewOrder.supplier}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Order Date</p>
                <p>{viewOrder.orderDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expected Delivery</p>
                <p>{viewOrder.deliveryDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(viewOrder.status)}`}>
                  {viewOrder.status.charAt(0).toUpperCase() + viewOrder.status.slice(1)}
                </span>
              </div>
              {viewOrder.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm">{viewOrder.notes}</p>
                </div>
              )}
            </div>

            {viewOrder.items.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">Ingredient</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewOrder.items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{item.ingredient}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2">{item.unit}</td>
                        <td className="px-3 py-2 text-right">KES {item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-semibold">KES {item.total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-secondary/50">
                    <tr className="border-t border-border">
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">Grand Total:</td>
                      <td className="px-3 py-2 text-right font-bold">KES {viewOrder.items.reduce((sum, i) => sum + i.total, 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Quick Status Change */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {viewOrder.status === 'draft' && (
                <button onClick={() => { handleStatusChange(viewOrder.id, 'pending'); setViewOrder(null); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 text-sm font-medium">
                  Mark as Pending
                </button>
              )}
              {viewOrder.status === 'pending' && (
                <button onClick={() => { handleStatusChange(viewOrder.id, 'received'); setViewOrder(null); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 text-sm font-medium">
                  Mark as Received
                </button>
              )}
              {(viewOrder.status === 'draft' || viewOrder.status === 'pending') && (
                <button onClick={() => { handleStatusChange(viewOrder.id, 'cancelled'); setViewOrder(null); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 text-sm font-medium">
                  Cancel Order
                </button>
              )}
              <button onClick={() => setViewOrder(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────── Orders Table ──────── */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading purchase orders...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">PO Number</th>
                <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                <th className="px-4 py-3 text-left font-semibold">Order Date</th>
                <th className="px-4 py-3 text-left font-semibold">Delivery</th>
                <th className="px-4 py-3 text-center font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Value</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    {search || statusFilter !== 'all' ? 'No matching purchase orders found' : 'No purchase orders found. Click "+ New Purchase Order" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => setViewOrder(order)} className="text-primary hover:underline font-semibold">
                        {order.poNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.supplier}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{order.orderDate}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{order.deliveryDate}</td>
                    <td className="px-4 py-3 text-center">{order.items.length}</td>
                    <td className="px-4 py-3 text-right font-semibold">KES {order.items.reduce((sum, i) => sum + i.total, 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => setViewOrder(order)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors font-medium">View</button>
                        <button onClick={() => handleEdit(order)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium">Edit</button>
                        <button onClick={() => handleDelete(order.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier & Customer Quick Reference */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">Active Suppliers ({suppliers.length})</h3>
          {suppliers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active suppliers. Add them in the Distributors module.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {suppliers.slice(0, 10).map(s => (
                <div key={s.id} className="text-xs flex justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.phone}</span>
                </div>
              ))}
              {suppliers.length > 10 && <p className="text-xs text-muted-foreground">...and {suppliers.length - 10} more</p>}
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">Active Customers ({customers.length})</h3>
          {customers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active customers. Add them in the Customers module.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {customers.slice(0, 10).map(c => (
                <div key={c.id} className="text-xs flex justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.type} - {c.phone}</span>
                </div>
              ))}
              {customers.length > 10 && <p className="text-xs text-muted-foreground">...and {customers.length - 10} more</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
