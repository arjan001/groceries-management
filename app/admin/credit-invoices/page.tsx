'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { FileText, Plus, Search, DollarSign, Clock, AlertTriangle, CheckCircle, CreditCard, Download, Printer } from 'lucide-react';

interface CreditInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  debtorId: string;
  saleId: string;
  orderId: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentTermsDays: number;
  dueDate: string;
  issueDate: string;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  notes: string;
  receivedBy: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
}

interface CreditOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  createdAt: string;
}

interface BusinessSettings {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  currency: string;
  taxRate: number;
  invoiceLogoHeight: number;
  reportWatermarkEnabled: boolean;
  reportWatermarkOpacity: number;
}

const emptyItem: InvoiceItem = { name: '', quantity: 1, unitPrice: 0, total: 0 };

function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

export default function CreditInvoicesPage() {
  const [invoices, setInvoices] = useState<CreditInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creditOrders, setCreditOrders] = useState<CreditOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<CreditInvoice | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<CreditInvoice | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    businessName: 'SNACKOH BITES', tagline: 'Quality Baked Goods', phone: '+254 700 000 000',
    email: 'info@snackoh.com', address: 'Nairobi, Kenya', logoUrl: '', currency: 'KES', taxRate: 16,
    invoiceLogoHeight: 50, reportWatermarkEnabled: false, reportWatermarkOpacity: 8,
  });
  const perPage = 10;

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    selectedOrderId: '',
    items: [{ ...emptyItem }] as InvoiceItem[],
    subtotal: 0,
    tax: 0,
    totalAmount: 0,
    paymentTermsDays: 30,
    dueDate: '',
    notes: '',
    createdBy: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
    receivedBy: '',
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load business settings for report header
  const loadBusinessSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'general').single();
      if (!error && data?.value) {
        const g = data.value as Record<string, unknown>;
        setBusinessSettings(prev => ({
          ...prev,
          businessName: (g.businessName as string) || prev.businessName,
          tagline: (g.tagline as string) || prev.tagline,
          phone: (g.phone as string) || prev.phone,
          email: (g.email as string) || prev.email,
          address: (g.address as string) || prev.address,
          logoUrl: (g.logoUrl as string) || prev.logoUrl,
          currency: (g.currency as string) || prev.currency,
          taxRate: (g.taxRate as number) || prev.taxRate,
          invoiceLogoHeight: (g.invoiceLogoHeight as number) || prev.invoiceLogoHeight,
          reportWatermarkEnabled: g.reportWatermarkEnabled !== undefined ? (g.reportWatermarkEnabled as boolean) : prev.reportWatermarkEnabled,
          reportWatermarkOpacity: (g.reportWatermarkOpacity as number) || prev.reportWatermarkOpacity,
        }));
        return;
      }
    } catch { /* ignore */ }
    try {
      const saved = localStorage.getItem('snackoh_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.general) {
          setBusinessSettings(prev => ({ ...prev, ...parsed.general }));
        }
      }
    } catch { /* ignore */ }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('credit_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const now = new Date();
        setInvoices(data.map((r: Record<string, unknown>) => {
          let items: InvoiceItem[] = [];
          try {
            if (r.items && typeof r.items === 'string') items = JSON.parse(r.items);
            else if (Array.isArray(r.items)) items = r.items as InvoiceItem[];
          } catch { /* empty */ }

          const balance = (r.balance || 0) as number;
          const dueDate = (r.due_date || '') as string;
          let status = (r.status || 'Unpaid') as CreditInvoice['status'];

          if (balance <= 0 && (r.amount_paid as number) > 0) {
            status = 'Paid';
          } else if (dueDate && new Date(dueDate) < now && balance > 0) {
            status = 'Overdue';
          } else if ((r.amount_paid as number) > 0 && balance > 0) {
            status = 'Partial';
          }

          return {
            id: r.id as string,
            invoiceNumber: (r.invoice_number || '') as string,
            customerId: (r.customer_id || '') as string,
            customerName: (r.customer_name || '') as string,
            customerPhone: (r.customer_phone || '') as string,
            debtorId: (r.debtor_id || '') as string,
            saleId: (r.sale_id || '') as string,
            orderId: (r.order_id || '') as string,
            items,
            subtotal: (r.subtotal || 0) as number,
            tax: (r.tax || 0) as number,
            totalAmount: (r.total_amount || 0) as number,
            amountPaid: (r.amount_paid || 0) as number,
            balance,
            paymentTermsDays: (r.payment_terms_days || 30) as number,
            dueDate,
            issueDate: (r.issue_date || '') as string,
            status,
            notes: (r.notes || '') as string,
            createdBy: (r.created_by || '') as string,
            createdAt: (r.created_at || '') as string,
          };
        }));
      }
    } catch {
      setInvoices([]);
    }
    setLoading(false);
  }, []);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('id, name, phone, credit_limit').order('name');
    if (data) {
      setCustomers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        phone: (r.phone || '') as string,
        creditLimit: (r.credit_limit || 0) as number,
      })));
    }
  }, []);

  // Fetch credit orders (orders with payment_status = 'Unpaid' or payment_method = 'Credit')
  const fetchCreditOrders = useCallback(async () => {
    try {
      // Fetch POS sales with credit
      const { data: posSales } = await supabase
        .from('pos_sales')
        .select('id, receipt_number, customer_name, sale_type, total, status, created_at')
        .or('sale_type.eq.Credit,payment_method.eq.Credit')
        .order('created_at', { ascending: false });

      // Fetch regular orders with credit payment
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, total_amount, status, payment_status, payment_method, created_at')
        .or('payment_status.eq.Unpaid,payment_method.eq.Credit')
        .order('created_at', { ascending: false });

      const creditOrdersList: CreditOrder[] = [];

      // Map POS sales
      if (posSales) {
        for (const sale of posSales) {
          // Fetch sale items
          const { data: saleItems } = await supabase
            .from('pos_sale_items')
            .select('product_name, quantity, unit_price, total')
            .eq('sale_id', sale.id);

          creditOrdersList.push({
            id: sale.id,
            orderNumber: sale.receipt_number || sale.id,
            customerName: sale.customer_name || 'Walk-in',
            customerPhone: '',
            totalAmount: sale.total || 0,
            status: sale.status || 'Completed',
            paymentStatus: 'Unpaid',
            items: (saleItems || []).map((item: Record<string, unknown>) => ({
              name: (item.product_name || '') as string,
              quantity: (item.quantity || 1) as number,
              unitPrice: (item.unit_price || 0) as number,
              total: (item.total || 0) as number,
            })),
            createdAt: sale.created_at || '',
          });
        }
      }

      // Map regular orders
      if (orders) {
        for (const order of orders) {
          // Fetch order items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('product_name, quantity, unit_price, total')
            .eq('order_id', order.id);

          creditOrdersList.push({
            id: order.id,
            orderNumber: order.order_number || order.id,
            customerName: order.customer_name || 'Unknown',
            customerPhone: order.customer_phone || '',
            totalAmount: order.total_amount || 0,
            status: order.status || 'Pending',
            paymentStatus: order.payment_status || 'Unpaid',
            items: (orderItems || []).map((item: Record<string, unknown>) => ({
              name: (item.product_name || '') as string,
              quantity: (item.quantity || 1) as number,
              unitPrice: (item.unit_price || 0) as number,
              total: (item.total || 0) as number,
            })),
            createdAt: order.created_at || '',
          });
        }
      }

      setCreditOrders(creditOrdersList);
    } catch {
      setCreditOrders([]);
    }
  }, []);

  const fetchPaymentsForInvoice = async (invoiceId: string) => {
    const { data } = await supabase
      .from('credit_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    if (data) {
      setPayments(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        invoiceId: (r.invoice_id || '') as string,
        amount: (r.amount || 0) as number,
        paymentMethod: (r.payment_method || 'Cash') as string,
        reference: (r.reference || '') as string,
        notes: (r.notes || '') as string,
        receivedBy: (r.received_by || '') as string,
        createdAt: (r.created_at || '') as string,
      })));
    }
  };

  useEffect(() => { fetchInvoices(); fetchCustomers(); fetchCreditOrders(); loadBusinessSettings(); }, [fetchInvoices, fetchCustomers, fetchCreditOrders, loadBusinessSettings]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

  const recalculate = (items: InvoiceItem[], tax: number) => {
    const safeN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const subtotal = items.reduce((sum, item) => sum + safeN(item.total), 0);
    const totalAmount = subtotal + safeN(tax);
    return { subtotal, totalAmount };
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = formData.items.map((item, i) => {
      if (i !== idx) return item;
      const newItem = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        newItem.total = newItem.quantity * newItem.unitPrice;
      }
      return newItem;
    });
    const { subtotal, totalAmount } = recalculate(updated, formData.tax);
    setFormData({ ...formData, items: updated, subtotal, totalAmount });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (idx: number) => {
    if (formData.items.length <= 1) return;
    const updated = formData.items.filter((_, i) => i !== idx);
    const { subtotal, totalAmount } = recalculate(updated, formData.tax);
    setFormData({ ...formData, items: updated, subtotal, totalAmount });
  };

  // Get credit orders for a specific customer
  const getCustomerCreditOrders = (customerName: string) => {
    return creditOrders.filter(o =>
      o.customerName.toLowerCase() === customerName.toLowerCase()
    );
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    // Find credit orders for this customer
    const customerOrders = getCustomerCreditOrders(customer.name);

    setFormData(prev => ({
      ...prev,
      customerId,
      customerName: customer.name,
      customerPhone: customer.phone,
      selectedOrderId: '',
      items: customerOrders.length > 0 ? prev.items : [{ ...emptyItem }],
    }));
  };

  // Handle order selection - auto-fill items
  const handleOrderSelect = (orderId: string) => {
    const order = creditOrders.find(o => o.id === orderId);
    if (!order) {
      setFormData(prev => ({
        ...prev,
        selectedOrderId: '',
        items: [{ ...emptyItem }],
        subtotal: 0,
        totalAmount: 0,
      }));
      return;
    }

    const items: InvoiceItem[] = order.items.length > 0
      ? order.items.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.quantity * i.unitPrice,
        }))
      : [{ name: `Order ${order.orderNumber}`, quantity: 1, unitPrice: order.totalAmount, total: order.totalAmount }];

    const { subtotal, totalAmount } = recalculate(items, formData.tax);

    setFormData(prev => ({
      ...prev,
      selectedOrderId: orderId,
      items,
      subtotal,
      totalAmount,
      notes: prev.notes || `Credit order ${order.orderNumber}`,
    }));
  };

  const handleSetDueDate = (terms: number) => {
    const due = new Date();
    due.setDate(due.getDate() + terms);
    setFormData({ ...formData, paymentTermsDays: terms, dueDate: due.toISOString().split('T')[0] });
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }
    if (formData.items.filter(i => i.name.trim()).length === 0) {
      showToast('At least one item is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const validItems = formData.items.filter(i => i.name.trim());
      const { subtotal, totalAmount } = recalculate(validItems, formData.tax);

      const row = {
        invoice_number: formData.invoiceNumber,
        customer_id: formData.customerId || null,
        customer_name: formData.customerName.trim(),
        customer_phone: formData.customerPhone,
        items: JSON.stringify(validItems),
        subtotal,
        tax: formData.tax,
        total_amount: totalAmount,
        amount_paid: 0,
        balance: totalAmount,
        payment_terms_days: formData.paymentTermsDays,
        due_date: formData.dueDate || null,
        issue_date: new Date().toISOString().split('T')[0],
        status: 'Unpaid',
        notes: formData.notes,
        created_by: formData.createdBy,
      };

      const { data, error } = await supabase.from('credit_invoices').insert(row).select().single();
      if (error) throw error;

      // Auto-create/update debtor record
      if (formData.customerId) {
        const { data: existingDebtor } = await supabase
          .from('debtors')
          .select('id, total_debt')
          .eq('customer_id', formData.customerId)
          .single();

        if (existingDebtor) {
          await supabase.from('debtors').update({
            total_debt: (existingDebtor.total_debt as number) + totalAmount,
            status: 'Current',
          }).eq('id', existingDebtor.id);

          if (data) {
            await supabase.from('credit_invoices').update({ debtor_id: existingDebtor.id }).eq('id', (data as Record<string, unknown>).id);
          }
        } else {
          const { data: newDebtor } = await supabase.from('debtors').insert({
            customer_id: formData.customerId,
            name: formData.customerName,
            phone: formData.customerPhone,
            total_debt: totalAmount,
            debt_days: 0,
            debt_opened_date: new Date().toISOString().split('T')[0],
            credit_limit_days: formData.paymentTermsDays,
            status: 'Current',
          }).select('id').single();

          if (newDebtor && data) {
            await supabase.from('credit_invoices').update({ debtor_id: (newDebtor as Record<string, unknown>).id }).eq('id', (data as Record<string, unknown>).id);
          }
        }
      }

      logAudit({
        action: 'CREATE',
        module: 'Credit Invoice',
        record_id: (data as Record<string, unknown>)?.id as string || '',
        details: { invoice_number: formData.invoiceNumber, customer: formData.customerName, total: totalAmount },
      });

      showToast('Invoice created successfully', 'success');
      await fetchInvoices();
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to create invoice: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentForm) return;
    if (paymentData.amount <= 0) {
      showToast('Payment amount must be greater than zero', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('credit_invoice_payments').insert({
        invoice_id: showPaymentForm.id,
        amount: paymentData.amount,
        payment_method: paymentData.paymentMethod,
        reference: paymentData.reference,
        notes: paymentData.notes,
        received_by: paymentData.receivedBy,
      });
      if (error) throw error;

      const newPaid = showPaymentForm.amountPaid + paymentData.amount;
      const newBalance = showPaymentForm.totalAmount - newPaid;
      const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

      await supabase.from('credit_invoices').update({
        amount_paid: newPaid,
        balance: Math.max(0, newBalance),
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', showPaymentForm.id);

      if (showPaymentForm.debtorId) {
        const { data: debtor } = await supabase
          .from('debtors')
          .select('total_debt')
          .eq('id', showPaymentForm.debtorId)
          .single();
        if (debtor) {
          const newDebt = Math.max(0, (debtor.total_debt as number) - paymentData.amount);
          await supabase.from('debtors').update({
            total_debt: newDebt,
            last_payment_date: new Date().toISOString().split('T')[0],
            last_payment_amount: paymentData.amount,
            status: newDebt <= 0 ? 'Paid' : 'Current',
          }).eq('id', showPaymentForm.debtorId);
        }

        await supabase.from('debtor_transactions').insert({
          debtor_id: showPaymentForm.debtorId,
          type: 'Payment',
          amount: paymentData.amount,
          reference: `Invoice ${showPaymentForm.invoiceNumber}`,
          notes: paymentData.notes || `Payment via ${paymentData.paymentMethod}`,
        });
      }

      logAudit({
        action: 'CREATE',
        module: 'Credit Invoice Payment',
        record_id: showPaymentForm.id,
        details: { invoice: showPaymentForm.invoiceNumber, amount: paymentData.amount, method: paymentData.paymentMethod },
      });

      showToast('Payment recorded successfully', 'success');
      await fetchInvoices();
      setShowPaymentForm(null);
      setPaymentData({ amount: 0, paymentMethod: 'Cash', reference: '', notes: '', receivedBy: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to record payment: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      invoiceNumber: '',
      customerId: '',
      customerName: '',
      customerPhone: '',
      selectedOrderId: '',
      items: [{ ...emptyItem }],
      subtotal: 0,
      tax: 0,
      totalAmount: 0,
      paymentTermsDays: 30,
      dueDate: '',
      notes: '',
      createdBy: '',
    });
  };

  const openNewForm = () => {
    resetForm();
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setFormData(prev => ({
      ...prev,
      invoiceNumber: generateInvoiceNumber(),
      dueDate: due.toISOString().split('T')[0],
    }));
    setShowForm(true);
  };

  const openDetail = async (inv: CreditInvoice) => {
    setShowDetail(inv);
    await fetchPaymentsForInvoice(inv.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    await supabase.from('credit_invoices').delete().eq('id', id);
    logAudit({ action: 'DELETE', module: 'Credit Invoice', record_id: id, details: {} });
    await fetchInvoices();
    showToast('Invoice deleted', 'success');
  };

  // Print/Download modern invoice
  const handlePrintInvoice = (inv: CreditInvoice) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const b = businessSettings;
    const logoH = b.invoiceLogoHeight || 50;
    const wmEnabled = b.reportWatermarkEnabled && b.logoUrl;
    const wmOpacity = (b.reportWatermarkOpacity || 8) / 100;
    const itemRows = inv.items.map((item, idx) =>
      `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#666;text-align:center">${idx + 1}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:500">${item.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${b.currency} ${item.unitPrice.toLocaleString()}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${b.currency} ${item.total.toLocaleString()}</td>
      </tr>`
    ).join('');

    const paymentRows = payments.map(p =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px">${formatDate(p.createdAt)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#059669;font-weight:600">${b.currency} ${p.amount.toLocaleString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${p.paymentMethod}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666">${p.reference || '—'}</td>
      </tr>`
    ).join('');

    const statusColors: Record<string, string> = {
      Unpaid: '#f59e0b', Partial: '#3b82f6', Paid: '#10b981', Overdue: '#ef4444',
    };

    const html = `<!DOCTYPE html><html><head><title>Invoice ${inv.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; background: #fff; }
  .invoice { max-width: 800px; margin: 0 auto; padding: 40px; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; opacity: ${wmOpacity}; }
  .watermark img { max-width: 350px; max-height: 350px; }
  .content { position: relative; z-index: 1; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 25px; border-bottom: 3px solid #ea580c; }
  .logo-section h1 { font-size: 28px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px; }
  .logo-section p { font-size: 12px; color: #666; margin-top: 4px; }
  .invoice-info { text-align: right; }
  .invoice-info h2 { font-size: 24px; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 2px; }
  .invoice-info .inv-number { font-size: 14px; color: #ea580c; font-weight: 600; margin-top: 4px; }
  .invoice-info .inv-date { font-size: 12px; color: #888; margin-top: 2px; }
  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 35px; }
  .detail-box { background: #fafafa; border-radius: 8px; padding: 16px 20px; }
  .detail-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 8px; font-weight: 600; }
  .detail-box p { font-size: 14px; line-height: 1.6; color: #333; }
  .detail-box .name { font-weight: 700; font-size: 16px; }
  .status-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
  thead th { background: #f8f8f8; padding: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; font-weight: 600; border-bottom: 2px solid #eee; }
  .totals { margin-left: auto; width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
  .totals .row.total { border-top: 2px solid #333; padding-top: 12px; margin-top: 4px; font-size: 18px; font-weight: 800; }
  .totals .row.balance { color: #ef4444; font-weight: 700; }
  .totals .row.paid { color: #059669; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; }
  .footer p { font-size: 11px; color: #999; line-height: 1.8; }
  .footer .contact { font-size: 12px; color: #666; font-weight: 500; }
  .payment-section { margin-top: 25px; }
  .payment-section h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
  @media print { body { padding: 0; } .invoice { padding: 20px; } .no-print { display: none; } .watermark { position: fixed; } }
</style></head><body>
<div class="invoice">
  ${wmEnabled ? `<div class="watermark"><img src="${b.logoUrl}" alt="Watermark" /></div>` : ''}
  <div class="content">
  <div class="header">
    <div class="logo-section">
      ${b.logoUrl ? `<img src="${b.logoUrl}" alt="${b.businessName}" style="height:${logoH}px;margin-bottom:8px" />` : ''}
      <h1>${b.businessName}</h1>
      <p>${b.tagline}</p>
    </div>
    <div class="invoice-info">
      <h2>Invoice</h2>
      <div class="inv-number">${inv.invoiceNumber}</div>
      <div class="inv-date">Issued: ${formatDate(inv.issueDate)}</div>
      <div class="inv-date">Due: ${formatDate(inv.dueDate)}</div>
      <div style="margin-top:8px"><span class="status-badge" style="background:${statusColors[inv.status] || '#888'}">${inv.status}</span></div>
    </div>
  </div>

  <div class="details-grid">
    <div class="detail-box">
      <h4>Bill To</h4>
      <p class="name">${inv.customerName}</p>
      <p>${inv.customerPhone || ''}</p>
    </div>
    <div class="detail-box">
      <h4>From</h4>
      <p class="name">${b.businessName}</p>
      <p>${b.address}</p>
      <p>${b.phone}</p>
      <p>${b.email}</p>
    </div>
  </div>

  <table>
    <thead><tr><th style="text-align:center;width:40px">#</th><th style="text-align:left">Item</th><th style="text-align:center;width:60px">Qty</th><th style="text-align:right;width:100px">Price</th><th style="text-align:right;width:120px">Total</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${b.currency} ${inv.subtotal.toLocaleString()}</span></div>
    ${inv.tax > 0 ? `<div class="row"><span>Tax</span><span>${b.currency} ${inv.tax.toLocaleString()}</span></div>` : ''}
    <div class="row total"><span>Total</span><span>${b.currency} ${inv.totalAmount.toLocaleString()}</span></div>
    <div class="row paid"><span>Paid</span><span>${b.currency} ${inv.amountPaid.toLocaleString()}</span></div>
    <div class="row balance"><span>Balance Due</span><span>${b.currency} ${inv.balance.toLocaleString()}</span></div>
  </div>

  ${payments.length > 0 ? `
  <div class="payment-section">
    <h3>Payment History</h3>
    <table>
      <thead><tr><th style="text-align:left">Date</th><th style="text-align:right">Amount</th><th style="text-align:left">Method</th><th style="text-align:left">Reference</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
  </div>` : ''}

  ${inv.notes ? `<div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b"><p style="font-size:12px;color:#92400e"><strong>Notes:</strong> ${inv.notes}</p></div>` : ''}

  <div class="footer">
    <p class="contact">${b.businessName} | ${b.phone} | ${b.email}</p>
    <p>${b.address}</p>
    <p style="margin-top:10px">Thank you for your business!</p>
  </div>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

    win.document.write(html);
    win.document.close();
  };

  // Filters
  const filtered = invoices.filter(inv => {
    const matchSearch = `${inv.invoiceNumber} ${inv.customerName} ${inv.customerPhone}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Stats
  const totalOutstanding = invoices.reduce((s, i) => { const n = Number(i.balance); return s + (Number.isFinite(n) ? n : 0); }, 0);
  const overdueCount = invoices.filter(i => i.status === 'Overdue').length;
  const unpaidCount = invoices.filter(i => i.status === 'Unpaid').length;
  const paidCount = invoices.filter(i => i.status === 'Paid').length;

  const getStatusBadge = (s: CreditInvoice['status']) => {
    switch (s) {
      case 'Unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'Partial': return 'bg-blue-100 text-blue-800';
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get customer-specific credit orders for the form
  const selectedCustomerOrders = formData.customerName
    ? getCustomerCreditOrders(formData.customerName)
    : [];

  return (
    <div className="p-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2">Credit Sales Invoicing</h1>
        <p className="text-muted-foreground">Create invoices for credit sales, track payments, and manage outstanding balances</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold">{totalOutstanding.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm text-muted-foreground">Unpaid</p>
              <p className="text-2xl font-bold text-yellow-600">{unpaidCount}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-2xl font-bold text-green-600">{paidCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
          >
            <option value="All">All Status</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
            <option value="Overdue">Overdue</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <button onClick={openNewForm} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading invoices...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Invoice #</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-right font-semibold">Balance</th>
                <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No invoices found</td></tr>
              ) : paginated.map(inv => (
                <tr key={inv.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${inv.status === 'Overdue' ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{inv.customerName}</div>
                    <div className="text-xs text-muted-foreground">{inv.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{inv.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-700">{inv.amountPaid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inv.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-semibold ${getStatusBadge(inv.status)}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openDetail(inv)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                      <button onClick={() => handlePrintInvoice(inv)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium" title="Print Invoice"><Printer className="w-3 h-3" /></button>
                      {inv.status !== 'Paid' && (
                        <button onClick={() => { setShowPaymentForm(inv); setPaymentData(prev => ({ ...prev, amount: inv.balance })); }} className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 font-medium">Pay</button>
                      )}
                      <button onClick={() => handleDelete(inv.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
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

      {/* Create Invoice Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Create Credit Invoice" size="3xl">
        <form onSubmit={handleCreateInvoice} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3">Invoice Details</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Invoice Number</label>
                <input type="text" value={formData.invoiceNumber} readOnly className="w-full px-3 py-2 border border-border rounded-lg outline-none bg-muted font-mono text-sm" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Payment Terms (days)</label>
                <select value={formData.paymentTermsDays} onChange={(e) => handleSetDueDate(parseInt(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background">
                  <option value={7}>Net 7</option>
                  <option value={14}>Net 14</option>
                  <option value={30}>Net 30</option>
                  <option value={60}>Net 60</option>
                  <option value={90}>Net 90</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Due Date</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background" />
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3">Customer (Credit Buyers)</p>
            <select value={formData.customerId} onChange={(e) => handleCustomerSelect(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background" required>
              <option value="">Select a credit customer</option>
              {customers.map(c => {
                const hasCreditOrders = creditOrders.some(o => o.customerName.toLowerCase() === c.name.toLowerCase());
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone} {c.creditLimit > 0 ? `(Limit: ${c.creditLimit.toLocaleString()})` : ''} {hasCreditOrders ? ' [Has Credit Orders]' : ''}
                  </option>
                );
              })}
            </select>

            {/* Credit orders for selected customer */}
            {selectedCustomerOrders.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs text-muted-foreground mb-1">Select Credit Order (auto-fills items)</label>
                <select
                  value={formData.selectedOrderId}
                  onChange={(e) => handleOrderSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                >
                  <option value="">— Select an order to auto-fill —</option>
                  {selectedCustomerOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {businessSettings.currency} {o.totalAmount.toLocaleString()} — {new Date(o.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedCustomerOrders.length} credit order(s) found for this customer
                </p>
              </div>
            )}
          </div>

          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Invoice Items</p>
              <button type="button" onClick={addItem} className="text-xs text-primary hover:text-primary/80 font-medium">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {formData.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Item</label>}
                    <input type="text" placeholder="Product name" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Qty</label>}
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Unit Price</label>}
                    <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Total</label>}
                    <input type="text" value={item.total.toLocaleString()} readOnly className="w-full px-3 py-2 border border-border rounded-lg outline-none bg-muted text-sm font-medium" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {formData.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="px-2 py-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded">X</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border text-right space-y-1 text-sm">
              <div><span className="text-muted-foreground">Subtotal:</span> <strong className="ml-2">{formData.subtotal.toLocaleString()}</strong></div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-muted-foreground">Tax:</span>
                <input type="number" min={0} step="0.01" value={formData.tax} onChange={(e) => { const tax = parseFloat(e.target.value) || 0; const { subtotal, totalAmount } = recalculate(formData.items, tax); setFormData({ ...formData, tax, subtotal, totalAmount }); }} className="w-24 px-2 py-1 border border-border rounded text-sm text-right" />
              </div>
              <div className="text-lg"><span className="text-muted-foreground">Total:</span> <strong className="ml-2">{formData.totalAmount.toLocaleString()}</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Created By</label>
              <input type="text" value={formData.createdBy} onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })} placeholder="Your name" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="e.g. Monthly supply for February" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">{saving ? 'Creating...' : 'Create Invoice'}</button>
          </div>
        </form>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => { setShowDetail(null); setPayments([]); }} title={showDetail ? `Invoice ${showDetail.invoiceNumber}` : ''} size="3xl">
        {showDetail && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getStatusBadge(showDetail.status)}`}>{showDetail.status}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Issued: {formatDate(showDetail.issueDate)} | Due: {formatDate(showDetail.dueDate)}</span>
                <button onClick={() => handlePrintInvoice(showDetail)} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium" title="Print/Download Invoice">
                  <Printer className="w-3 h-3" /> Print
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border border-border rounded-lg p-4">
              <div><span className="text-muted-foreground">Customer:</span> <strong className="ml-2">{showDetail.customerName}</strong></div>
              <div><span className="text-muted-foreground">Phone:</span> <strong className="ml-2">{showDetail.customerPhone || '—'}</strong></div>
              <div><span className="text-muted-foreground">Payment Terms:</span> <strong className="ml-2">Net {showDetail.paymentTermsDays}</strong></div>
              <div><span className="text-muted-foreground">Created By:</span> <strong className="ml-2">{showDetail.createdBy || '—'}</strong></div>
            </div>

            {showDetail.items.length > 0 && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-3">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-muted-foreground font-medium">#</th><th className="text-left py-2 text-muted-foreground font-medium">Item</th><th className="text-right py-2 text-muted-foreground font-medium">Qty</th><th className="text-right py-2 text-muted-foreground font-medium">Price</th><th className="text-right py-2 text-muted-foreground font-medium">Total</th></tr></thead>
                  <tbody>
                    {showDetail.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50"><td className="py-2 text-muted-foreground">{idx + 1}</td><td className="py-2 font-medium">{item.name}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">{item.unitPrice.toLocaleString()}</td><td className="py-2 text-right font-semibold">{item.total.toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 pt-3 border-t border-border text-right space-y-1 text-sm">
                  <div>Subtotal: <strong>{showDetail.subtotal.toLocaleString()}</strong></div>
                  {showDetail.tax > 0 && <div>Tax: <strong>{showDetail.tax.toLocaleString()}</strong></div>}
                  <div className="text-lg">Total: <strong>{showDetail.totalAmount.toLocaleString()}</strong></div>
                  <div className="text-green-700">Paid: <strong>{showDetail.amountPaid.toLocaleString()}</strong></div>
                  <div className="text-red-700">Balance: <strong>{showDetail.balance.toLocaleString()}</strong></div>
                </div>
              </div>
            )}

            {/* Payment History */}
            <div className="border border-border rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">Payment History</p>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border"><th className="text-left py-2 text-muted-foreground font-medium">Date</th><th className="text-right py-2 text-muted-foreground font-medium">Amount</th><th className="text-left py-2 text-muted-foreground font-medium">Method</th><th className="text-left py-2 text-muted-foreground font-medium">Reference</th><th className="text-left py-2 text-muted-foreground font-medium">Received By</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-border/50"><td className="py-2 text-xs">{formatDate(p.createdAt)}</td><td className="py-2 text-right font-semibold text-green-700">{p.amount.toLocaleString()}</td><td className="py-2">{p.paymentMethod}</td><td className="py-2 text-xs text-muted-foreground">{p.reference || '—'}</td><td className="py-2 text-xs">{p.receivedBy || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              {showDetail.status !== 'Paid' && (
                <button onClick={() => { setShowDetail(null); setShowPaymentForm(showDetail); setPaymentData(prev => ({ ...prev, amount: showDetail.balance })); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm">Record Payment</button>
              )}
              <button onClick={() => { setShowDetail(null); setPayments([]); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Close</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={!!showPaymentForm} onClose={() => { setShowPaymentForm(null); setPaymentData({ amount: 0, paymentMethod: 'Cash', reference: '', notes: '', receivedBy: '' }); }} title={showPaymentForm ? `Record Payment — ${showPaymentForm.invoiceNumber}` : ''} size="md">
        {showPaymentForm && (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="border border-border rounded-lg p-3 bg-secondary/50 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Invoice Total:</span> <strong className="ml-1">{showPaymentForm.totalAmount.toLocaleString()}</strong></div>
                <div><span className="text-muted-foreground">Already Paid:</span> <strong className="ml-1 text-green-700">{showPaymentForm.amountPaid.toLocaleString()}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Outstanding Balance:</span> <strong className="ml-1 text-red-700">{showPaymentForm.balance.toLocaleString()}</strong></div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Amount *</label>
              <input type="number" min={0} step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select value={paymentData.paymentMethod} onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                  <option>Cash</option>
                  <option>M-Pesa</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference</label>
                <input type="text" value={paymentData.reference} onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })} placeholder="M-Pesa code, cheque #" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Received By</label>
              <input type="text" value={paymentData.receivedBy} onChange={(e) => setPaymentData({ ...paymentData, receivedBy: e.target.value })} placeholder="Name of person receiving payment" className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button type="button" onClick={() => setShowPaymentForm(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">{saving ? 'Recording...' : 'Record Payment'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
