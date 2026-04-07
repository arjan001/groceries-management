'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface CartItem { id: string; name: string; sku: string; price: number; quantity: number; stock: number; isNonInventory?: boolean; unitCost?: number; }
interface Product { id: string; name: string; sku: string; retailPrice: number; wholesalePrice: number; stock: number; category: string; }
interface Customer { id: string; name: string; phone: string; type: string; }
interface HeldOrder { id: string; name: string; items: CartItem[]; customer: Customer; saleType: string; time: string; }
interface ReceiptData { receiptNo: string; date: string; cashier: string; customer: string; items: CartItem[]; subtotal: number; tax: number; total: number; paid: number; change: number; method: string; mpesaRef?: string; }
interface ReceiptSettings { headerText: string; subHeaderText: string; footerText: string; disclaimer: string; showLogo: boolean; showTax: boolean; showCashier: boolean; showCustomer: boolean; showPaymentDetails: boolean; autoPrint: boolean; softwareProvidedBy: string; paperWidth?: string; }
interface PaymentDetailsSettings { mpesaType: 'paybill' | 'till'; paybillNumber: string; accountNumber: string; tillNumber: string; mpesaName: string; showOnReceipt: boolean; bankName: string; bankAccount: string; bankBranch: string; }
interface GeneralSettings { businessName: string; phone: string; email: string; shopNumber: string; address: string; currency: string; taxRate: number; logoUrl: string; }
interface PosCardSettings { enabled: boolean; readerType: string; readerBrand: string; readerModel: string; connectionId: string; autoConnect: boolean; requireApprovalCode: boolean; requireLastFourDigits: boolean; printCardReceipt: boolean; minimumAmount: number; surchargeEnabled: boolean; surchargePercent: number; allowContactless: boolean; allowChip: boolean; allowSwipe: boolean; timeoutSeconds: number; }

type PaymentMethod = 'Cash' | 'Mpesa' | 'Credit' | 'Card';
type MpesaStatus = 'idle' | 'sending' | 'waiting' | 'checking' | 'success' | 'failed';
type CardStatus = 'idle' | 'processing' | 'approved' | 'declined';

function loadSettings() {
  try {
    const saved = localStorage.getItem('snackoh_settings');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

// ── Session persistence helpers ──
const POS_SESSION_KEY = 'snackoh_pos_session';

interface PosSession {
  shiftStarted: boolean;
  openingBalance: number;
  totalSalesCount: number;
  totalSalesAmount: number;
  cashierName: string;
  startedAt: string;
  heldOrders: HeldOrder[];
}

function saveSession(session: PosSession) {
  try { localStorage.setItem(POS_SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}

function loadSession(): PosSession | null {
  try {
    const saved = localStorage.getItem(POS_SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.shiftStarted) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function clearSession() {
  try { localStorage.removeItem(POS_SESSION_KEY); } catch { /* ignore */ }
}

export default function POSPage() {
  // ── Auth — resolve actual cashier name from authenticated user ──
  const [loggedCashier, setLoggedCashier] = useState('Cashier');
  const [outletId, setOutletId] = useState<string | null>(null);

  useEffect(() => {
    async function resolveCashierName() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata || {};
          const email = user.email || '';
          // Try to get name from employee record first
          const { data: emp } = await supabase
            .from('employees')
            .select('first_name, last_name, id, primary_outlet_id')
            .eq('login_email', email)
            .single();
          if (emp) {
            setLoggedCashier(`${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Cashier');
            // Check if employee is assigned to an outlet
            if (emp.primary_outlet_id) {
              setOutletId(emp.primary_outlet_id);
            } else {
              try {
                const { data: outletEmp } = await supabase
                  .from('outlet_employees')
                  .select('outlet_id')
                  .eq('employee_id', emp.id)
                  .eq('status', 'Active')
                  .limit(1)
                  .single();
                if (outletEmp?.outlet_id) setOutletId(outletEmp.outlet_id);
              } catch { /* no outlet assignment */ }
            }
          } else {
            setLoggedCashier((meta.full_name as string) || email.split('@')[0] || 'Cashier');
          }
        }
      } catch { /* use default */ }
    }
    resolveCashierName();
  }, []);

  // ── Opening / Closing Balance ──
  // Check for existing session on mount
  const existingSession = typeof window !== 'undefined' ? loadSession() : null;
  const [showOpeningBalance, setShowOpeningBalance] = useState(!existingSession);
  const [showClosingBalance, setShowClosingBalance] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(existingSession?.openingBalance ?? 0);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [shiftStarted, setShiftStarted] = useState(existingSession?.shiftStarted ?? false);

  // ── Settings ──
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    headerText: 'SNACKOH BITES', subHeaderText: 'Quality Baked Goods', footerText: 'Thank you for choosing Snackoh!',
    disclaimer: 'Goods once sold are not returnable', showLogo: true, showTax: true, showCashier: true, showCustomer: true, showPaymentDetails: true,
    autoPrint: false, softwareProvidedBy: '', paperWidth: '80mm',
  });
  const [paymentDetailsSettings, setPaymentDetailsSettings] = useState<PaymentDetailsSettings>({
    mpesaType: 'paybill', paybillNumber: '', accountNumber: '', tillNumber: '', mpesaName: 'SNACKOH BITES', showOnReceipt: true,
    bankName: '', bankAccount: '', bankBranch: '',
  });
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    businessName: 'SNACKOH BITES', phone: '+254 700 000 000', email: 'info@snackoh.com', shopNumber: '', address: 'Nairobi, Kenya', currency: 'KES', taxRate: 16, logoUrl: '',
  });
  const [posCardSettings, setPosCardSettings] = useState<PosCardSettings>({
    enabled: false, readerType: 'bluetooth', readerBrand: '', readerModel: '', connectionId: '', autoConnect: true,
    requireApprovalCode: true, requireLastFourDigits: true, printCardReceipt: true, minimumAmount: 0,
    surchargeEnabled: false, surchargePercent: 0, allowContactless: true, allowChip: true, allowSwipe: true, timeoutSeconds: 60,
  });

  useEffect(() => {
    async function loadSettingsFromDb() {
      // Try loading from database first
      try {
        const { data, error } = await supabase.from('business_settings').select('key, value');
        if (!error && data && data.length > 0) {
          const dbSettings: Record<string, unknown> = {};
          for (const row of data) dbSettings[row.key] = row.value;
          if (dbSettings.receipt) setReceiptSettings(prev => ({ ...prev, ...(dbSettings.receipt as Record<string, unknown>) }));
          if (dbSettings.paymentDetails) setPaymentDetailsSettings(prev => ({ ...prev, ...(dbSettings.paymentDetails as Record<string, unknown>) }));
          if (dbSettings.posCard) setPosCardSettings(prev => ({ ...prev, ...(dbSettings.posCard as Record<string, unknown>) }));
          if (dbSettings.general) {
            const g = dbSettings.general as Record<string, unknown>;
            setGeneralSettings(prev => ({
              businessName: (g.businessName as string) || prev.businessName,
              phone: (g.phone as string) || prev.phone,
              email: (g.email as string) || prev.email,
              shopNumber: (g.shopNumber as string) || prev.shopNumber,
              address: (g.address as string) || prev.address,
              currency: (g.currency as string) || prev.currency,
              taxRate: (g.taxRate as number) ?? prev.taxRate,
              logoUrl: (g.logoUrl as string) || prev.logoUrl,
            }));
          }
          return;
        }
      } catch {
        // Table may not exist yet
      }
      // Fallback to localStorage
      const s = loadSettings();
      if (s) {
        if (s.receipt) setReceiptSettings(prev => ({ ...prev, ...s.receipt }));
        if (s.paymentDetails) setPaymentDetailsSettings(prev => ({ ...prev, ...s.paymentDetails }));
        if (s.posCard) setPosCardSettings(prev => ({ ...prev, ...s.posCard }));
        if (s.general) setGeneralSettings(prev => ({
          businessName: s.general.businessName || prev.businessName,
          phone: s.general.phone || prev.phone,
          email: s.general.email || prev.email,
          shopNumber: s.general.shopNumber || prev.shopNumber,
          address: s.general.address || prev.address,
          currency: s.general.currency || prev.currency,
          taxRate: s.general.taxRate ?? prev.taxRate,
          logoUrl: s.general.logoUrl || prev.logoUrl,
        }));
      }
    }
    loadSettingsFromDb();
  }, []);

  // ── Sales Totals (restore from session) ──
  const [totalSalesCount, setTotalSalesCount] = useState(existingSession?.totalSalesCount ?? 0);
  const [totalSalesAmount, setTotalSalesAmount] = useState(existingSession?.totalSalesAmount ?? 0);

  // ── Products ──
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([
    { id: 'walk-in', name: 'Walk-in Customer', phone: '', type: 'Retail' },
  ]);

  // ── Cart ──
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [saleType, setSaleType] = useState<'Retail' | 'Wholesale'>('Retail');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', price: '', quantity: '1', unitCost: '', sku: '' });

  // ── Held Orders (restore from session) ──
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(existingSession?.heldOrders ?? []);
  const [showHeld, setShowHeld] = useState(false);

  // ── Payment ──
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashAmount, setCashAmount] = useState(0);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle');
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState('');
  const [creditName, setCreditName] = useState('');
  const [creditPhone, setCreditPhone] = useState('');
  const [cardApprovalCode, setCardApprovalCode] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [cardEntryMethod, setCardEntryMethod] = useState<'contactless' | 'chip' | 'swipe'>('contactless');
  const [cardStatus, setCardStatus] = useState<CardStatus>('idle');
  const [cardMessage, setCardMessage] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Receipt ──
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const lastPrintedReceiptRef = useRef<string | null>(null);

  // ── Fetch products from inventory / pricing ──
  // Single POS system — all branches see the same product catalog from pricing_tiers,
  // but stock levels reflect the outlet's own inventory when available
  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('pricing_tiers').select('*').eq('active', true);
    if (data && data.length > 0) {
      // If a branch outlet is detected, fetch outlet inventory for stock levels
      let outletStockMap: Record<string, number> = {};
      let hasOutletInventory = false;

      if (outletId) {
        try {
          const { data: outletInv } = await supabase
            .from('outlet_inventory')
            .select('item_name, quantity')
            .eq('outlet_id', outletId)
            .eq('status', 'Active');

          if (outletInv && outletInv.length > 0) {
            hasOutletInventory = true;
            outletInv.forEach((item: Record<string, unknown>) => {
              const name = ((item.item_name || '') as string).toLowerCase();
              outletStockMap[name] = (outletStockMap[name] || 0) + ((item.quantity || 0) as number);
            });
          }
        } catch { /* outlet_inventory may not exist yet */ }
      }

      setProducts(data.map((r: Record<string, unknown>) => {
        const productName = ((r.product_name || '') as string);
        // Use outlet stock if available for this branch, otherwise show available (999 = unlimited)
        const stock = hasOutletInventory
          ? (outletStockMap[productName.toLowerCase()] ?? 0)
          : 999;

        return {
          id: r.id as string,
          name: productName,
          sku: (r.product_code || '') as string,
          retailPrice: (r.retail_price || 0) as number,
          wholesalePrice: (r.wholesale_price || 0) as number,
          stock,
          category: 'Products',
        };
      }));
    }
  }, [outletId]);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').eq('status', 'Active').order('name');
    if (data && data.length > 0) {
      const mapped = data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, phone: (r.phone || '') as string, type: (r.type || 'Retail') as string }));
      setCustomers([{ id: 'walk-in', name: 'Walk-in Customer', phone: '', type: 'Retail' }, ...mapped]);
    }
  }, []);

  useEffect(() => { fetchProducts(); fetchCustomers(); }, [fetchProducts, fetchCustomers]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  // ── Persist session state across navigation ──
  useEffect(() => {
    if (shiftStarted) {
      saveSession({
        shiftStarted,
        openingBalance,
        totalSalesCount,
        totalSalesAmount,
        cashierName: loggedCashier,
        startedAt: existingSession?.startedAt || new Date().toISOString(),
        heldOrders,
      });
    }
  }, [shiftStarted, openingBalance, totalSalesCount, totalSalesAmount, heldOrders, loggedCashier]);

  // Totals - use safe number operations to prevent NaN
  const safeN = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const taxRate = safeN(generalSettings.taxRate) / 100;
  const subtotal = cartItems.reduce((sum, item) => sum + safeN(item.price) * safeN(item.quantity), 0);
  const tax = Math.round((subtotal * taxRate + Number.EPSILON) * 100) / 100;
  const total = Math.round((subtotal + tax + Number.EPSILON) * 100) / 100;
  const categories = [...new Set(products.map(p => p.category))];
  const filteredProducts = products.filter(p => {
    const match = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const cat = filterCategory === 'All' || p.category === filterCategory;
    return match && cat;
  });

  // ── Cart ──
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    const price = saleType === 'Retail' ? product.retailPrice : product.wholesalePrice;
    const existing = cartItems.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCartItems(cartItems.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCartItems([...cartItems, { id: product.id, name: product.name, sku: product.sku, price, quantity: 1, stock: product.stock }]);
    }
  };
  const updateQty = (id: string, qty: number) => { if (qty <= 0) setCartItems(cartItems.filter(i => i.id !== id)); else setCartItems(cartItems.map(i => i.id === id ? { ...i, quantity: Math.min(qty, i.stock) } : i)); };
  const removeItem = (id: string) => setCartItems(cartItems.filter(i => i.id !== id));
  const clearCart = () => { if (cartItems.length > 0 && confirm('Clear cart?')) setCartItems([]); };

  const addCustomItem = () => {
    const name = customItem.name.trim();
    const price = parseFloat(customItem.price);
    const quantity = Math.max(1, parseInt(customItem.quantity, 10) || 1);
    const unitCost = parseFloat(customItem.unitCost) || 0;
    if (!name || Number.isNaN(price) || price <= 0) return;
    const sku = customItem.sku.trim() || 'CUSTOM';
    setCartItems([
      ...cartItems,
      {
        id: `custom-${Date.now()}`,
        name,
        sku,
        price,
        quantity,
        stock: 999999,
        isNonInventory: true,
        unitCost,
      },
    ]);
    setCustomItem({ name: '', price: '', quantity: '1', unitCost: '', sku: '' });
    setShowCustomItem(false);
  };

  // ── Hold/Recall ──
  const holdOrder = () => {
    if (cartItems.length === 0) return;
    const held: HeldOrder = { id: Date.now().toString(), name: selectedCustomer.name, items: [...cartItems], customer: selectedCustomer, saleType, time: new Date().toLocaleTimeString() };
    const newHeld = [...heldOrders, held];
    setHeldOrders(newHeld);
    setCartItems([]);
  };
  const recallOrder = (held: HeldOrder) => {
    // If there are items in the cart, confirm before replacing
    if (cartItems.length > 0 && !confirm('You have items in the cart. Replace them with the recalled order?')) return;
    setCartItems(held.items);
    setSelectedCustomer(held.customer);
    setSaleType(held.saleType as 'Retail' | 'Wholesale');
    setHeldOrders(heldOrders.filter(h => h.id !== held.id));
    setShowHeld(false);
  };
  const cancelOrder = () => {
    if (cartItems.length === 0) return;
    if (confirm('Cancel current order and clear the cart?')) {
      setCartItems([]);
    }
  };
  const deleteHeld = (id: string) => {
    if (confirm('Delete this held order?')) {
      setHeldOrders(heldOrders.filter(h => h.id !== id));
    }
  };

  // ── Customer ──
  const handleCustomerChange = (cid: string) => {
    const c = customers.find(x => x.id === cid) || customers[0];
    setSelectedCustomer(c);
    if (c.phone) setMpesaPhone(c.phone);
    if (c.type === 'Wholesale') setSaleType('Wholesale');
  };

  // ── M-Pesa ──
  const pollMpesaStatus = useCallback((checkoutId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 3s = 90s max
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setMpesaStatus('failed');
        setMpesaMessage('Payment timed out. Please try again.');
        return;
      }
      try {
        const res = await fetch('/api/mpesa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'query', checkoutRequestId: checkoutId }),
        });
        const data = await res.json();
        if (data.status === 'completed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setMpesaStatus('success');
          setMpesaMessage(`KES ${total.toFixed(0)} received via M-Pesa`);
        } else if (data.status === 'cancelled' || data.status === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setMpesaStatus('failed');
          setMpesaMessage(data.message || 'Payment was cancelled or failed');
        }
      } catch { /* continue polling */ }
    }, 3000);
  }, [total]);

  const sendMpesaStkPush = async () => {
    if (!mpesaPhone) { setMpesaMessage('Enter M-Pesa phone number'); return; }
    setMpesaStatus('sending');
    setMpesaMessage('Sending STK push to ' + mpesaPhone + '...');
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mpesaPhone,
          amount: Math.ceil(total),
          accountReference: `SNACKOH-${Date.now()}`,
          description: `Snackoh POS - ${selectedCustomer.name}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMpesaCheckoutId(data.checkoutRequestId);
        setMpesaStatus('waiting');
        setMpesaMessage('STK sent! Enter your M-Pesa PIN on your phone...');
        pollMpesaStatus(data.checkoutRequestId);
      } else {
        setMpesaStatus('failed');
        setMpesaMessage(data.message || 'STK push failed');
      }
    } catch {
      setMpesaStatus('failed');
      setMpesaMessage('Network error — check your connection');
    }
  };

  const pollMpesaMatch = useCallback((amount: number, phone: string) => {
    let attempts = 0;
    const maxAttempts = 20;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setMpesaStatus('checking');
    setMpesaMessage('Checking for payment...');

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setMpesaStatus('failed');
        setMpesaMessage('No matching payment found yet.');
        return;
      }
      try {
        const res = await fetch('/api/mpesa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'match', amount: Math.ceil(amount), phone }),
        });
        const data = await res.json();
        if (data.status === 'matched') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setMpesaStatus('success');
          setMpesaMessage(`Payment matched: ${data.amount || Math.ceil(amount)} received`);
          setMpesaCheckoutId(data.mpesaRef || data.checkoutRequestId || 'MPesa-Matched');
        }
      } catch { /* continue polling */ }
    }, 3000);
  }, []);

  // ── Generate receipt number ──
  const genReceiptNo = () => `SNK-${Date.now().toString(36).toUpperCase()}`;

  // ── Complete Sale ──
  const completeSale = async (method: string, paid: number, change: number, mpesaRef?: string) => {
    const rNo = genReceiptNo();
    const receipt: ReceiptData = { receiptNo: rNo, date: new Date().toLocaleString(), cashier: loggedCashier, customer: selectedCustomer.name, items: [...cartItems], subtotal, tax, total, paid, change, method, mpesaRef };
    let posSaleId: string | null = null;
    try {
      const { data: saleData } = await supabase.from('pos_sales').insert({
        receipt_number: rNo, customer_name: selectedCustomer.name, sale_type: saleType,
        payment_method: method, mpesa_reference: mpesaRef || null, mpesa_phone: method === 'M-Pesa' ? mpesaPhone : null,
        subtotal, tax, total, amount_paid: paid, change_amount: change, cashier_name: loggedCashier, status: 'Completed',
        outlet_id: outletId || null,
      }).select('id').single();
      if (saleData) posSaleId = saleData.id;
      if (posSaleId) {
        logAudit({
          action: 'CREATE',
          module: 'POS',
          record_id: posSaleId,
          details: { receipt_number: rNo, total, cashier: loggedCashier, item_count: cartItems.length, payment_method: method },
        });
      }
    } catch { /* continue */ }

    const posItemsPayload = cartItems.map(item => ({
      sale_id: posSaleId,
      product_name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.price,
      total: item.price * item.quantity,
      is_non_inventory: !!item.isNonInventory,
      unit_cost: item.unitCost || 0,
      cost_total: (item.unitCost || 0) * item.quantity,
    }));

    // Also save POS sale items
    if (posSaleId) {
      try {
        await supabase.from('pos_sale_items').insert(posItemsPayload);
      } catch {
        try {
          const fallback = posItemsPayload.map(({ is_non_inventory, unit_cost, cost_total, ...rest }) => rest);
          await supabase.from('pos_sale_items').insert(fallback);
        } catch { /* continue */ }
      }
    }

    // Track non-inventory item costs for P&L
    if (posSaleId) {
      const costEntries = cartItems
        .filter(item => item.isNonInventory && (item.unitCost || 0) > 0)
        .map(item => ({
          date: new Date().toISOString().split('T')[0],
          category: 'Non-Inventory',
          description: `${rNo} - ${item.name}`,
          amount: (item.unitCost || 0) * item.quantity,
          payment_status: 'Paid',
          reference: `POS:${rNo}`,
          notes: 'Auto: non-inventory POS item',
          cost_type: 'direct_cost',
        }));
      if (costEntries.length > 0) {
        try {
          await supabase.from('cost_entries').insert(costEntries);
        } catch {
          try {
            const fallback = costEntries.map(({ cost_type, ...rest }) => rest);
            await supabase.from('cost_entries').insert(fallback);
          } catch { /* continue */ }
        }
      }
    }

    // Save as regular order in orders table for unified order management
    try {
      const orderNumber = `POS-${rNo}`;
      const { data: orderData } = await supabase.from('orders').insert({
        order_number: orderNumber,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone || '',
        status: 'Delivered',
        total_amount: total,
        payment_status: method === 'Credit' ? 'Unpaid' : 'Paid',
        payment_method: method,
        source: 'Regular',
        fulfillment: 'Pickup',
        delivery_notes: `POS Sale | Receipt: ${rNo} | Cashier: ${loggedCashier}`,
        pos_sale_id: posSaleId,
      }).select('id').single();

      if (orderData) {
        const orderItemsPayload = cartItems.map(item => ({
          order_id: orderData.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total: item.price * item.quantity,
          is_non_inventory: !!item.isNonInventory,
          unit_cost: item.unitCost || 0,
          cost_total: (item.unitCost || 0) * item.quantity,
        }));
        try {
          await supabase.from('order_items').insert(orderItemsPayload);
        } catch {
          const fallback = orderItemsPayload.map(({ is_non_inventory, unit_cost, cost_total, ...rest }) => rest);
          await supabase.from('order_items').insert(fallback);
        }
      }
    } catch { /* continue — order table may not have the new columns yet */ }
    setProducts(products.map(p => { const ci = cartItems.find(i => i.id === p.id); return ci ? { ...p, stock: Math.max(0, p.stock - ci.quantity) } : p; }));
    setTotalSalesCount(prev => prev + 1);
    setTotalSalesAmount(prev => prev + total);
    setReceiptData(receipt);
    setShowPayment(false);
    setShowReceipt(true);
    setCartItems([]);
    setCashAmount(0);
    setMpesaPhone('');
    setMpesaStatus('idle');
    setMpesaCheckoutId('');
    setCardApprovalCode('');
    setCardLastFour('');
    setCardStatus('idle');
    setCardMessage('');
    setCardEntryMethod('contactless');
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setPaymentMethod('Cash');
  };

  const handlePayment = () => {
    if (cartItems.length === 0) return;
    if (paymentMethod === 'Cash') {
      if (cashAmount < total) return;
      completeSale('Cash', cashAmount, cashAmount - total);
    } else if (paymentMethod === 'Mpesa') {
      if (mpesaStatus === 'success') completeSale('M-Pesa', total, 0, mpesaCheckoutId || 'MPesa-Auto');
    } else if (paymentMethod === 'Credit') {
      const name = creditName || selectedCustomer.name;
      if (!name || name === 'Walk-in Customer') { alert('Select or enter customer for credit'); return; }
      completeSale('Credit', 0, 0);
    } else if (paymentMethod === 'Card') {
      if (cardStatus !== 'approved') return;
      const cardRef = [
        cardApprovalCode ? `Auth:${cardApprovalCode}` : '',
        cardLastFour ? `****${cardLastFour}` : '',
        cardEntryMethod,
      ].filter(Boolean).join(' | ');
      const cardTotal = posCardSettings.surchargeEnabled ? total + (total * posCardSettings.surchargePercent / 100) : total;
      completeSale('Card', cardTotal, 0, cardRef || 'Card-Payment');
    }
  };

  const openCheckout = () => {
    if (cartItems.length === 0) return;
    setPaymentMethod('Cash'); setCashAmount(0); setMpesaPhone(selectedCustomer.phone || ''); setMpesaStatus('idle'); setMpesaMessage('');
    setCreditName(selectedCustomer.id !== 'walk-in' ? selectedCustomer.name : ''); setCreditPhone(selectedCustomer.phone || '');
    setCardApprovalCode(''); setCardLastFour(''); setCardStatus('idle'); setCardMessage(''); setCardEntryMethod('contactless');
    setShowPayment(true);
  };

  // ── Print Receipt ──
  const printReceipt = () => {
    if (!receiptRef.current) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:'Courier New',monospace;font-size:12px;padding:10px;max-width:300px;margin:0 auto}h2,h3{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #333;margin:8px 0}.row{display:flex;justify-content:space-between}.total{font-size:14px;font-weight:bold}.center{text-align:center}</style></head><body>`);
    win.document.write(receiptRef.current.innerHTML);
    win.document.write(`</body></html>`);
    win.document.close();
    win.print();
  };

  useEffect(() => {
    if (!showReceipt || !receiptSettings.autoPrint || !receiptData?.receiptNo) return;
    if (lastPrintedReceiptRef.current === receiptData.receiptNo) return;
    lastPrintedReceiptRef.current = receiptData.receiptNo;
    setTimeout(() => printReceipt(), 300);
  }, [showReceipt, receiptSettings.autoPrint, receiptData?.receiptNo]);

  const quickCash = [100, 200, 500, 1000, 2000, 5000];

  const cur = generalSettings.currency;

  // ── POS VIEW ──
  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-background">
      {/* Top Bar */}
      <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-primary">SNACKOH POS</span>
          <span className="text-xs text-muted-foreground">Cashier: <strong>{loggedCashier}</strong></span>
          <span className="text-xs text-muted-foreground">Opening: {cur} {openingBalance.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">Sales: {totalSalesCount} | {cur} {totalSalesAmount.toLocaleString()}</span>
          {shiftStarted && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Shift active — remember to End Shift</span>}
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedCustomer.id} onChange={(e) => handleCustomerChange(e.target.value)} className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/50 outline-none bg-background min-w-[160px]">
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['Retail', 'Wholesale'] as const).map(t => (
              <button key={t} onClick={() => setSaleType(t)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${saleType === t ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'}`}>{t}</button>
            ))}
          </div>
          <button onClick={holdOrder} disabled={cartItems.length === 0} className="px-3 py-1.5 text-xs border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 font-medium disabled:opacity-40">Hold</button>
          <button onClick={() => setShowHeld(true)} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary font-medium relative">
            Recall {heldOrders.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center">{heldOrders.length}</span>}
          </button>
          <button onClick={() => setShowClosingBalance(true)} className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium">End Shift</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Products */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none bg-card text-sm" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none bg-card text-sm">{['All', ...categories].map(c => <option key={c}>{c}</option>)}</select>
            <button onClick={() => setShowCustomItem(true)} className="px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-secondary">
              + Custom Item
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredProducts.map(p => {
                const price = saleType === 'Retail' ? p.retailPrice : p.wholesalePrice;
                const inCart = cartItems.find(i => i.id === p.id);
                const outOfStock = p.stock <= 0;
                return (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={outOfStock} className={`relative p-3 border rounded-xl text-left transition-all ${outOfStock ? 'opacity-40 cursor-not-allowed bg-gray-50' : inCart ? 'border-primary bg-primary/5 shadow' : 'border-border bg-card hover:border-primary/50 hover:shadow'}`}>
                    {inCart && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow">{inCart.quantity}</span>}
                    {outOfStock && <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">SOLD OUT</span>}
                    <p className="font-semibold text-xs mb-0.5 truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                    <div className="flex justify-between items-end mt-1">
                      <span className="text-sm font-bold text-primary">{cur} {price}</span>
                      <span className="text-[10px] text-muted-foreground">{p.stock} left</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="w-[320px] flex flex-col border-l border-border bg-card">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between"><h2 className="font-bold text-sm">Cart</h2><span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-medium">{cartItems.reduce((s, i) => s + i.quantity, 0)} items</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{selectedCustomer.name} &bull; {saleType}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><p className="text-2xl mb-1">🛒</p><p className="text-xs">Tap products to add</p></div>
            ) : cartItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 bg-secondary/50 p-2 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">
                    {item.name}
                    {item.isNonInventory && <span className="ml-1 text-[9px] px-1 py-0.5 bg-amber-100 text-amber-800 rounded">Custom</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{cur} {item.price} x {item.quantity}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-6 h-6 rounded bg-background border border-border text-xs font-bold hover:bg-red-50">-</button>
                  <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-6 h-6 rounded bg-background border border-border text-xs font-bold hover:bg-green-50">+</button>
                </div>
                <div className="text-right min-w-[50px]">
                  <p className="text-xs font-bold">{cur} {(item.price * item.quantity).toLocaleString()}</p>
                  <button onClick={() => removeItem(item.id)} className="text-[10px] text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>{cur} {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">VAT ({generalSettings.taxRate}%)</span><span>{cur} {tax.toFixed(0)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-1.5"><span>Total</span><span className="text-primary">{cur} {total.toLocaleString()}</span></div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={cancelOrder} className="px-3 py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-xs font-medium">Cancel Order</button>
              <button onClick={openCheckout} disabled={cartItems.length === 0} className="px-3 py-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-40 font-bold text-xs">Checkout</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Custom Item Modal ── */}
      <Modal isOpen={showCustomItem} onClose={() => setShowCustomItem(false)} title="Add Custom Item" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Use this for custom cakes or items not in inventory.</p>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Item Name *</label>
            <input
              type="text"
              value={customItem.name}
              onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              placeholder="e.g. Custom Birthday Cake"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Price *</label>
              <input
                type="number"
                value={customItem.price}
                onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="KES"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={customItem.quantity}
                onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Unit Cost</label>
              <input
                type="number"
                value={customItem.unitCost}
                onChange={(e) => setCustomItem({ ...customItem, unitCost: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="KES"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">SKU (optional)</label>
              <input
                type="text"
                value={customItem.sku}
                onChange={(e) => setCustomItem({ ...customItem, sku: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="CUSTOM"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button onClick={() => setShowCustomItem(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">Cancel</button>
            <button onClick={addCustomItem} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium">Add Item</button>
          </div>
        </div>
      </Modal>

      {/* ── Held Orders Modal ── */}
      <Modal isOpen={showHeld} onClose={() => setShowHeld(false)} title={`Held Orders (${heldOrders.length})`} size="md">
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {heldOrders.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No held orders</p> : heldOrders.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-muted-foreground">{h.items.length} items &bull; {h.saleType} &bull; {h.time}</p></div>
              <div className="flex gap-2"><button onClick={() => recallOrder(h)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Recall</button><button onClick={() => deleteHeld(h.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button></div>
            </div>
          ))}
        </div>
      </Modal>

      {/* ── Payment Modal ── */}
      <Modal isOpen={showPayment} onClose={() => { setShowPayment(false); if (pollTimerRef.current) clearInterval(pollTimerRef.current); }} title="Complete Payment" size="md">
        <div className="space-y-4">
          <div className="text-center py-3 bg-secondary rounded-xl">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-3xl font-black text-primary">{cur} {total.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{selectedCustomer.name} &bull; {cartItems.reduce((s, i) => s + i.quantity, 0)} items &bull; {loggedCashier}</p>
          </div>
          <div className={`grid ${posCardSettings.enabled ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
            {([
              { v: 'Cash' as const, l: 'Cash', i: '💵' },
              { v: 'Mpesa' as const, l: 'M-Pesa', i: '📱' },
              ...(posCardSettings.enabled ? [{ v: 'Card' as const, l: 'Card', i: '💳' }] : []),
              { v: 'Credit' as const, l: 'Credit', i: '📝' },
            ]).map(b => (
              <button key={b.v} onClick={() => { setPaymentMethod(b.v); setMpesaStatus('idle'); setCardStatus('idle'); setCardMessage(''); if (pollTimerRef.current) clearInterval(pollTimerRef.current); }} className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${paymentMethod === b.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}><span className="text-lg">{b.i}</span>{b.l}</button>
            ))}
          </div>
          {paymentMethod === 'Cash' && (
            <div className="space-y-2">
              <input type="number" placeholder="Amount received" value={cashAmount || ''} onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 border border-border rounded-xl text-lg font-bold focus:ring-2 focus:ring-primary/50 outline-none text-center" autoFocus />
              <div className="grid grid-cols-3 gap-1.5">{quickCash.map(a => (<button key={a} onClick={() => setCashAmount(a)} className={`py-1.5 rounded-lg border text-xs font-medium ${cashAmount === a ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`}>{a.toLocaleString()}</button>))}</div>
              <button onClick={() => setCashAmount(Math.ceil(total))} className="w-full py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5">Exact ({Math.ceil(total).toLocaleString()})</button>
              {cashAmount > 0 && <div className={`p-2 rounded-xl text-center font-bold text-sm ${cashAmount >= total ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{cashAmount >= total ? `Change: ${cur} ${(cashAmount - total).toFixed(0)}` : `Short: ${cur} ${(total - cashAmount).toFixed(0)}`}</div>}
            </div>
          )}
          {paymentMethod === 'Mpesa' && (
            <div className="space-y-2">
              <input type="tel" placeholder="0712345678" value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} className="w-full px-4 py-3 border border-border rounded-xl text-lg font-mono focus:ring-2 focus:ring-primary/50 outline-none text-center tracking-wider" autoFocus disabled={mpesaStatus === 'sending' || mpesaStatus === 'waiting' || mpesaStatus === 'checking'} />
              {mpesaStatus === 'idle' && <button onClick={sendMpesaStkPush} disabled={!mpesaPhone} className="w-full py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-xs disabled:opacity-40">📱 Send STK Push — {cur} {total.toFixed(0)}</button>}
              {mpesaStatus === 'sending' && <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center"><div className="animate-spin w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-1"></div><p className="text-xs text-blue-800">Sending...</p></div>}
              {mpesaStatus === 'waiting' && <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-center animate-pulse"><p className="text-lg">📱</p><p className="text-xs font-bold text-yellow-800">{mpesaMessage}</p></div>}
              {mpesaStatus === 'checking' && <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center animate-pulse"><p className="text-lg">🔎</p><p className="text-xs font-bold text-blue-800">{mpesaMessage}</p></div>}
              {mpesaStatus === 'success' && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-center"><p className="text-lg">✅</p><p className="text-xs font-bold text-green-800">Payment Received!</p></div>}
              {mpesaStatus === 'failed' && <><div className="p-2 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-800">{mpesaMessage}</div><button onClick={() => { setMpesaStatus('idle'); if (pollTimerRef.current) clearInterval(pollTimerRef.current); }} className="w-full py-1.5 border border-border rounded-xl text-xs hover:bg-secondary">Retry</button></>}
              <div className="rounded-xl border border-border bg-secondary/50 p-3 text-[11px]">
                <p className="font-semibold mb-1">Already paid without STK?</p>
                <p className="text-muted-foreground mb-2">Pay the exact amount and verify the latest M-Pesa payment.</p>
                <button onClick={() => pollMpesaMatch(total, mpesaPhone)} disabled={!mpesaPhone || mpesaStatus === 'checking' || mpesaStatus === 'waiting' || mpesaStatus === 'sending'} className="w-full py-2 border border-border rounded-xl text-xs font-semibold hover:bg-secondary disabled:opacity-40">
                  Verify Payment — {cur} {total.toFixed(0)}
                </button>
              </div>
            </div>
          )}
          {paymentMethod === 'Credit' && (
            <div className="space-y-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-bold text-amber-800">Credit Sale — Debtor Record</p>
              <input type="text" placeholder="Customer Name" value={creditName} onChange={(e) => setCreditName(e.target.value)} className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white" />
              <input type="tel" placeholder="Phone" value={creditPhone} onChange={(e) => setCreditPhone(e.target.value)} className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white" />
            </div>
          )}
          {paymentMethod === 'Card' && (
            <div className="space-y-3">
              {/* Minimum amount check */}
              {posCardSettings.minimumAmount > 0 && total < posCardSettings.minimumAmount && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-800">
                  Minimum card payment is {cur} {posCardSettings.minimumAmount.toLocaleString()}. Current total is {cur} {total.toLocaleString()}.
                </div>
              )}

              {/* Surcharge notice */}
              {posCardSettings.surchargeEnabled && posCardSettings.surchargePercent > 0 && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-center text-xs text-blue-800">
                  Card surcharge of {posCardSettings.surchargePercent}% applies: {cur} {(total * posCardSettings.surchargePercent / 100).toFixed(0)} fee — Total: <strong>{cur} {(total + total * posCardSettings.surchargePercent / 100).toFixed(0)}</strong>
                </div>
              )}

              {/* Card entry method */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Card Entry Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ...(posCardSettings.allowContactless ? [{ v: 'contactless' as const, l: 'Tap / NFC', i: '📶' }] : []),
                    ...(posCardSettings.allowChip ? [{ v: 'chip' as const, l: 'Chip Insert', i: '💳' }] : []),
                    ...(posCardSettings.allowSwipe ? [{ v: 'swipe' as const, l: 'Swipe', i: '↔️' }] : []),
                  ]).map(m => (
                    <button key={m.v} onClick={() => setCardEntryMethod(m.v)} className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-[11px] font-medium transition-all ${cardEntryMethod === m.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
                      <span className="text-base">{m.i}</span>{m.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reader info */}
              {posCardSettings.readerBrand && (
                <div className="p-2 bg-secondary rounded-xl text-[11px] text-muted-foreground text-center">
                  Reader: <strong>{posCardSettings.readerBrand.toUpperCase()}</strong>{posCardSettings.readerModel ? ` — ${posCardSettings.readerModel}` : ''} ({posCardSettings.readerType})
                </div>
              )}

              {/* Process card on reader */}
              {cardStatus === 'idle' && (
                <button
                  onClick={() => {
                    if (posCardSettings.minimumAmount > 0 && total < posCardSettings.minimumAmount) return;
                    setCardStatus('processing');
                    setCardMessage('Present card on reader...');
                    // Simulate waiting for card reader — in production this would connect to the physical reader API
                    setTimeout(() => {
                      setCardStatus('approved');
                      setCardMessage('Card reader: Ready for approval code');
                    }, 1500);
                  }}
                  disabled={posCardSettings.minimumAmount > 0 && total < posCardSettings.minimumAmount}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xs disabled:opacity-40"
                >
                  💳 Process Card — {cur} {(posCardSettings.surchargeEnabled ? total + total * posCardSettings.surchargePercent / 100 : total).toFixed(0)}
                </button>
              )}

              {cardStatus === 'processing' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center animate-pulse">
                  <div className="animate-spin w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-1"></div>
                  <p className="text-xs font-bold text-blue-800">{cardMessage}</p>
                  <p className="text-[10px] text-blue-600 mt-1">Waiting for card reader response...</p>
                </div>
              )}

              {cardStatus === 'approved' && (
                <div className="space-y-2">
                  <div className="p-2 bg-green-50 border border-green-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-green-800">Card Accepted — Enter details from terminal</p>
                  </div>
                  {posCardSettings.requireApprovalCode && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1 font-medium">Approval / Auth Code *</label>
                      <input
                        type="text"
                        placeholder="e.g. 123456"
                        value={cardApprovalCode}
                        onChange={(e) => setCardApprovalCode(e.target.value)}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none text-center tracking-wider"
                        autoFocus
                        maxLength={10}
                      />
                    </div>
                  )}
                  {posCardSettings.requireLastFourDigits && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1 font-medium">Last 4 Digits of Card</label>
                      <input
                        type="text"
                        placeholder="e.g. 4321"
                        value={cardLastFour}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCardLastFour(v); }}
                        className="w-full px-4 py-2.5 border border-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none text-center tracking-widest"
                        maxLength={4}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => { setCardStatus('idle'); setCardMessage(''); setCardApprovalCode(''); setCardLastFour(''); }}
                    className="w-full py-1.5 border border-border rounded-xl text-xs hover:bg-secondary text-muted-foreground"
                  >
                    Re-process Card
                  </button>
                </div>
              )}

              {cardStatus === 'declined' && (
                <>
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-800">{cardMessage || 'Card declined. Try another card or payment method.'}</div>
                  <button onClick={() => { setCardStatus('idle'); setCardMessage(''); }} className="w-full py-1.5 border border-border rounded-xl text-xs hover:bg-secondary">Retry</button>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-border">
            <button onClick={() => { setShowPayment(false); if (pollTimerRef.current) clearInterval(pollTimerRef.current); }} className="flex-1 px-3 py-2.5 border border-border rounded-xl hover:bg-secondary text-xs font-medium">Cancel</button>
            <button onClick={handlePayment} disabled={(paymentMethod === 'Cash' && cashAmount < total) || (paymentMethod === 'Mpesa' && mpesaStatus !== 'success') || (paymentMethod === 'Credit' && !creditName && selectedCustomer.id === 'walk-in') || (paymentMethod === 'Card' && (cardStatus !== 'approved' || (posCardSettings.requireApprovalCode && !cardApprovalCode)))} className="flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 font-bold text-xs disabled:opacity-40">
              {paymentMethod === 'Mpesa' && mpesaStatus === 'success' ? 'Confirm' : paymentMethod === 'Credit' ? 'Record Credit' : paymentMethod === 'Card' && cardStatus === 'approved' ? 'Confirm Card Payment' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Receipt Modal (Dynamic from Settings) ── */}
      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Sale Complete" size="sm">
        <div className="space-y-3">
          <div ref={receiptRef} className="bg-white p-4 rounded-lg border border-border text-xs font-mono">
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              {receiptSettings.showLogo !== false && generalSettings.logoUrl && (
                <img src={generalSettings.logoUrl} alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }} />
              )}
              <h2 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>{receiptSettings.headerText}</h2>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>{receiptSettings.subHeaderText}</p>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>Tel: {generalSettings.phone}</p>
              {generalSettings.email && <p style={{ margin: '2px 0', fontSize: '10px' }}>{generalSettings.email}</p>}
              {generalSettings.shopNumber && <p style={{ margin: '2px 0', fontSize: '10px' }}>Shop No: {generalSettings.shopNumber}</p>}
              {generalSettings.address && <p style={{ margin: '2px 0', fontSize: '10px' }}>{generalSettings.address}</p>}
              <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
              <p style={{ margin: '0', fontSize: '10px' }}>Receipt: {receiptData?.receiptNo}</p>
              <p style={{ margin: '2px 0', fontSize: '10px' }}>{receiptData?.date}</p>
              {receiptSettings.showCashier && <p style={{ margin: '2px 0', fontSize: '10px' }}>Served by: {receiptData?.cashier}</p>}
              {receiptSettings.showCustomer && <p style={{ margin: '2px 0', fontSize: '10px' }}>Customer: {receiptData?.customer}</p>}
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
            <table style={{ width: '100%', fontSize: '10px' }}>
              <thead><tr style={{ borderBottom: '1px solid #ccc' }}><th style={{ textAlign: 'left', padding: '2px 0' }}>Item</th><th style={{ textAlign: 'center' }}>Qty</th><th style={{ textAlign: 'right' }}>Price</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {receiptData?.items.map((item, idx) => (
                  <tr key={idx}><td style={{ padding: '2px 0' }}>{item.name}</td><td style={{ textAlign: 'center' }}>{item.quantity}</td><td style={{ textAlign: 'right' }}>{item.price}</td><td style={{ textAlign: 'right' }}>{(item.price * item.quantity).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
            <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
            <div style={{ fontSize: '10px' }}>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>{cur} {receiptData?.subtotal.toLocaleString()}</span></div>
              {receiptSettings.showTax && <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>VAT ({generalSettings.taxRate}%):</span><span>{cur} {receiptData?.tax.toFixed(0)}</span></div>}
              <div className="row total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}><span>TOTAL:</span><span>{cur} {receiptData?.total.toLocaleString()}</span></div>
              <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid ({receiptData?.method}):</span><span>{cur} {receiptData?.paid.toLocaleString()}</span></div>
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Change:</span><span>{cur} {receiptData?.change.toFixed(0)}</span></div>
              {receiptData?.mpesaRef && receiptData?.method === 'M-Pesa' && <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>M-Pesa Ref:</span><span>{receiptData.mpesaRef}</span></div>}
              {receiptData?.mpesaRef && receiptData?.method === 'Card' && (
                <div style={{ fontSize: '10px', marginTop: '4px' }}>
                  <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Card Ref:</span><span>{receiptData.mpesaRef}</span></div>
                </div>
              )}
            </div>
            {/* Payment Details from Settings */}
            {receiptSettings.showPaymentDetails && paymentDetailsSettings.showOnReceipt && (paymentDetailsSettings.paybillNumber || paymentDetailsSettings.tillNumber || paymentDetailsSettings.bankName) && (
              <>
                <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
                <div style={{ textAlign: 'center', fontSize: '10px' }}>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Payment Info:</p>
                  {paymentDetailsSettings.mpesaType === 'paybill' && paymentDetailsSettings.paybillNumber && (
                    <>
                      <p style={{ margin: '2px 0' }}>M-Pesa Paybill: {paymentDetailsSettings.paybillNumber}</p>
                      {paymentDetailsSettings.accountNumber && <p style={{ margin: '2px 0' }}>Account: {paymentDetailsSettings.accountNumber}</p>}
                    </>
                  )}
                  {paymentDetailsSettings.mpesaType === 'till' && paymentDetailsSettings.tillNumber && (
                    <p style={{ margin: '2px 0' }}>M-Pesa Till: {paymentDetailsSettings.tillNumber}</p>
                  )}
                  {paymentDetailsSettings.mpesaName && <p style={{ margin: '2px 0' }}>Name: {paymentDetailsSettings.mpesaName}</p>}
                  {paymentDetailsSettings.bankName && (
                    <>
                      <p style={{ margin: '4px 0 2px', fontWeight: 'bold' }}>Bank Transfer:</p>
                      <p style={{ margin: '2px 0' }}>{paymentDetailsSettings.bankName}</p>
                      {paymentDetailsSettings.bankAccount && <p style={{ margin: '2px 0' }}>A/C: {paymentDetailsSettings.bankAccount}</p>}
                      {paymentDetailsSettings.bankBranch && <p style={{ margin: '2px 0' }}>Branch: {paymentDetailsSettings.bankBranch}</p>}
                    </>
                  )}
                </div>
              </>
            )}
            <hr style={{ border: 'none', borderTop: '1px dashed #333', margin: '8px 0' }} />
            <div style={{ textAlign: 'center', fontSize: '10px' }}>
              <p style={{ margin: '2px 0' }}>{receiptSettings.footerText}</p>
              <p style={{ margin: '2px 0' }}>{receiptSettings.disclaimer}</p>
              {receiptSettings.softwareProvidedBy && <p style={{ margin: '2px 0' }}>Software provided by {receiptSettings.softwareProvidedBy}</p>}
              <p style={{ margin: '4px 0', fontWeight: 'bold' }}>*** {receiptSettings.headerText} ***</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={printReceipt} className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 font-bold text-sm">🖨️ Print Receipt</button>
            <button onClick={() => setShowReceipt(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl hover:bg-secondary text-sm font-medium">New Sale</button>
          </div>
        </div>
      </Modal>

      {/* ── Opening Balance Modal ── */}
      <Modal isOpen={showOpeningBalance && !shiftStarted} onClose={() => {}} title="Start Shift — Opening Balance" size="sm">
        <div className="space-y-4">
          <div className="text-center py-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs text-blue-600 uppercase tracking-wider font-medium">Cashier Desk</p>
            <p className="text-sm text-blue-800 mt-1">Enter the opening cash balance to begin your shift</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Opening Cash Balance ({cur})</label>
            <input
              type="number"
              step="0.01"
              value={openingBalanceInput}
              onChange={(e) => setOpeningBalanceInput(e.target.value)}
              className="w-full px-4 py-3 border border-border rounded-xl text-lg font-bold focus:ring-2 focus:ring-primary/50 outline-none text-center"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <button
            onClick={() => {
              const bal = parseFloat(openingBalanceInput) || 0;
              setOpeningBalance(bal);
              setShiftStarted(true);
              setShowOpeningBalance(false);
            }}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 font-bold text-sm"
          >
            Start Shift
          </button>
        </div>
      </Modal>

      {/* ── Closing Balance Modal ── */}
      <Modal isOpen={showClosingBalance} onClose={() => setShowClosingBalance(false)} title="End Shift — Closing Balance" size="md">
        <ShiftClosingModal
          openingBalance={openingBalance}
          totalSalesAmount={totalSalesAmount}
          totalSalesCount={totalSalesCount}
          cur={cur}
          closingNotes={closingNotes}
          setClosingNotes={setClosingNotes}
          onCancel={() => setShowClosingBalance(false)}
          onConfirm={async () => {
            try {
              // Fetch shift expenses and sales breakdown
              const sessionStart = existingSession?.startedAt || new Date().toISOString();
              const { data: shiftSales } = await supabase.from('pos_sales').select('total, payment_method').eq('cashier_name', loggedCashier).eq('status', 'Completed').gte('created_at', sessionStart);
              const shiftSalesData = shiftSales || [];
              const shiftCash = shiftSalesData.filter(s => s.payment_method === 'Cash').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0);
              const shiftMpesa = shiftSalesData.filter(s => s.payment_method === 'Mpesa' || s.payment_method === 'M-Pesa').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0);
              const shiftCard = shiftSalesData.filter(s => s.payment_method === 'Card').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0);
              const shiftCredit = shiftSalesData.filter(s => s.payment_method === 'Credit').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0);

              // Save shift record
              try {
                const shiftNum = `SH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                await supabase.from('shifts').insert({
                  shift_number: shiftNum,
                  employee_name: loggedCashier,
                  employee_role: 'Cashier',
                  outlet_id: outletId || null,
                  start_time: sessionStart,
                  end_time: new Date().toISOString(),
                  opening_balance: openingBalance,
                  closing_balance: openingBalance + shiftCash,
                  total_sales: totalSalesAmount,
                  cash_sales: shiftCash,
                  mpesa_sales: shiftMpesa,
                  card_sales: shiftCard,
                  credit_sales: shiftCredit,
                  total_transactions: totalSalesCount,
                  net_cash: shiftCash,
                  status: 'Ended',
                  notes: closingNotes,
                  closed_by: loggedCashier,
                });
              } catch { /* shifts table may not exist */ }

              await supabase.from('pos_sales').insert({
                receipt_number: `SHIFT-${Date.now().toString(36).toUpperCase()}`,
                customer_name: 'SHIFT CLOSE',
                sale_type: 'Shift',
                payment_method: 'N/A',
                subtotal: 0, tax: 0, total: 0, amount_paid: 0, change_amount: 0,
                cashier_name: loggedCashier,
                status: 'Shift Close',
                outlet_id: outletId || null,
                mpesa_reference: JSON.stringify({
                  openingBalance, totalSales: totalSalesAmount, salesCount: totalSalesCount,
                  cashSales: shiftCash, mpesaSales: shiftMpesa, cardSales: shiftCard, creditSales: shiftCredit,
                  expectedClosing: openingBalance + shiftCash, notes: closingNotes,
                }),
              });
            } catch { /* continue */ }
            setCartItems([]);
            setTotalSalesCount(0);
            setTotalSalesAmount(0);
            setShowClosingBalance(false);
            setShiftStarted(false);
            setShowOpeningBalance(true);
            setOpeningBalanceInput('');
            setOpeningBalance(0);
            setClosingNotes('');
            setHeldOrders([]);
            clearSession();
          }}
          loggedCashier={loggedCashier}
          outletId={outletId}
          sessionStart={existingSession?.startedAt || new Date().toISOString()}
        />
      </Modal>
    </div>
  );
}

// ── Shift Closing Modal Component ──
function ShiftClosingModal({ openingBalance, totalSalesAmount, totalSalesCount, cur, closingNotes, setClosingNotes, onCancel, onConfirm, loggedCashier, outletId, sessionStart }: {
  openingBalance: number; totalSalesAmount: number; totalSalesCount: number; cur: string;
  closingNotes: string; setClosingNotes: (v: string) => void;
  onCancel: () => void; onConfirm: () => void;
  loggedCashier: string; outletId: string | null; sessionStart: string;
}) {
  const [shiftCash, setShiftCash] = useState(0);
  const [shiftMpesa, setShiftMpesa] = useState(0);
  const [shiftCard, setShiftCard] = useState(0);
  const [shiftCredit, setShiftCredit] = useState(0);
  const [shiftExpenses, setShiftExpenses] = useState(0);
  const [loadingSales, setLoadingSales] = useState(true);

  useEffect(() => {
    async function loadShiftData() {
      setLoadingSales(true);
      try {
        // Fetch sales for this shift
        const { data: sales } = await supabase.from('pos_sales').select('total, payment_method').eq('cashier_name', loggedCashier).eq('status', 'Completed').gte('created_at', sessionStart);
        if (sales) {
          setShiftCash(sales.filter(s => s.payment_method === 'Cash').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0));
          setShiftMpesa(sales.filter(s => s.payment_method === 'Mpesa' || s.payment_method === 'M-Pesa').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0));
          setShiftCard(sales.filter(s => s.payment_method === 'Card').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0));
          setShiftCredit(sales.filter(s => s.payment_method === 'Credit').reduce((sum: number, s: Record<string, unknown>) => sum + ((s.total || 0) as number), 0));
        }
        // Fetch today's expenses
        const today = new Date().toISOString().split('T')[0];
        const { data: expData } = await supabase.from('cost_entries').select('amount').eq('date', today);
        if (expData) {
          setShiftExpenses(expData.reduce((sum: number, e: Record<string, unknown>) => sum + ((e.amount || 0) as number), 0));
        }
      } catch { /* continue */ }
      setLoadingSales(false);
    }
    loadShiftData();
  }, [loggedCashier, sessionStart]);

  const netCash = shiftCash - shiftExpenses;
  const expectedCashInDrawer = openingBalance + netCash;

  return (
    <div className="space-y-4">
      <div className="text-center py-3 bg-red-50 rounded-xl border border-red-200">
        <p className="text-xs text-red-600 uppercase tracking-wider font-medium">Shift Summary</p>
        <p className="text-[10px] text-red-500 mt-0.5">Cashier: {loggedCashier}</p>
      </div>

      {loadingSales ? (
        <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
      ) : (
        <>
          {/* Sales Breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sales Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-secondary rounded-lg">
                <p className="text-[10px] text-muted-foreground">Total Sales</p>
                <p className="text-base font-bold text-foreground">{cur} {totalSalesAmount.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-secondary rounded-lg">
                <p className="text-[10px] text-muted-foreground">Transactions</p>
                <p className="text-base font-bold">{totalSalesCount}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
                <p className="text-[10px] text-green-700 font-medium">Cash Sales</p>
                <p className="text-base font-bold text-green-700">{cur} {shiftCash.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-[10px] text-blue-700 font-medium">M-Pesa Sales</p>
                <p className="text-base font-bold text-blue-700">{cur} {shiftMpesa.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-[10px] text-purple-700 font-medium">Card Sales</p>
                <p className="text-base font-bold text-purple-700">{cur} {shiftCard.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-[10px] text-amber-700 font-medium">Credit Sales</p>
                <p className="text-base font-bold text-amber-700">{cur} {shiftCredit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Cash Reconciliation */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cash Reconciliation</p>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Balance</span>
                <span className="font-medium">{cur} {openingBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>+ Cash Sales</span>
                <span className="font-medium">{cur} {shiftCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>- Expenses (deducted)</span>
                <span className="font-medium">({cur} {shiftExpenses.toLocaleString()})</span>
              </div>
              <div className="border-t border-border pt-1.5 mt-1.5">
                <div className="flex justify-between font-bold">
                  <span>Net Cash in Drawer</span>
                  <span className="text-primary">{cur} {expectedCashInDrawer.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
        <textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm" rows={2} placeholder="Any discrepancies or notes..." />
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="flex-1 px-3 py-2.5 border border-border rounded-xl hover:bg-secondary text-xs font-medium">Cancel</button>
        <button onClick={onConfirm} className="flex-1 px-3 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-xs">Confirm &amp; End Shift</button>
      </div>
    </div>
  );
}
