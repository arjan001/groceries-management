'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Lock, Smartphone, Truck, Store, CheckCircle, Clock, Loader2, ShieldCheck, CreditCard } from 'lucide-react';
import { CardPaymentModal } from '@/components/card-payment-modal';

type FulfillmentType = 'ship' | 'pickup';
type PaymentMethod = 'mpesa' | 'card' | 'pay_on_delivery';
type MpesaState = 'idle' | 'sending' | 'waiting' | 'checking' | 'done' | 'failed';

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('ship');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa');
  const [step, setStep] = useState<'form' | 'success'>('form');

  // Contact
  const [email, setEmail] = useState('');

  // Address
  const [form, setForm] = useState({
    firstName: '', lastName: '', address: '', apartment: '',
    city: '', county: '', postalCode: '', phone: '',
    saveInfo: false,
  });

  // M-Pesa
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaState, setMpesaState] = useState<MpesaState>('idle');
  const [mpesaMsg, setMpesaMsg] = useState('');
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Card payment modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardPaymentDone, setCardPaymentDone] = useState(false);

  // Track the order number for the success screen
  const [completedOrderNumber, setCompletedOrderNumber] = useState('');
  const [orderError, setOrderError] = useState('');

  // Dynamic delivery settings from admin
  const [deliverySettings, setDeliverySettings] = useState({
    deliveryEnabled: true,
    minimumOrderForDelivery: 500,
    deliveryFee: 200,
    freeDeliveryThreshold: 2000,
  });

  // Load delivery settings from database
  useEffect(() => {
    async function loadDeliverySettings() {
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'delivery')
          .single();
        if (!error && data?.value) {
          const val = data.value as Record<string, unknown>;
          setDeliverySettings(prev => ({
            ...prev,
            deliveryEnabled: val.deliveryEnabled !== undefined ? Boolean(val.deliveryEnabled) : prev.deliveryEnabled,
            minimumOrderForDelivery: val.minimumOrderForDelivery !== undefined ? Number(val.minimumOrderForDelivery) : prev.minimumOrderForDelivery,
            deliveryFee: val.deliveryFee !== undefined ? Number(val.deliveryFee) : prev.deliveryFee,
            freeDeliveryThreshold: val.freeDeliveryThreshold !== undefined ? Number(val.freeDeliveryThreshold) : prev.freeDeliveryThreshold,
          }));
          return;
        }
      } catch { /* table may not exist */ }
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.delivery) {
            const val = parsed.delivery;
            setDeliverySettings(prev => ({
              ...prev,
              ...val,
            }));
          }
        }
      } catch { /* ignore */ }
    }
    loadDeliverySettings();
  }, []);

  // Calculate delivery based on dynamic settings
  const canDeliver = deliverySettings.deliveryEnabled && total >= deliverySettings.minimumOrderForDelivery;
  const delivery = (fulfillment === 'ship' && total >= deliverySettings.freeDeliveryThreshold) ? 0 : deliverySettings.deliveryFee;
  const orderTotal = total + (fulfillment === 'ship' ? delivery : 0);

  // Force pickup if delivery is disabled or order is below minimum
  useEffect(() => {
    if (!canDeliver && fulfillment === 'ship') {
      setFulfillment('pickup');
    }
  }, [canDeliver, fulfillment]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  const pollMpesaStatus = useCallback((checkoutId: string) => {
    let attempts = 0;
    const maxAttempts = 30;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setMpesaState('failed');
        setMpesaMsg('Payment timed out. Please try again.');
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
          setMpesaState('done');
          setMpesaMsg('Payment confirmed!');
        } else if (data.status === 'cancelled' || data.status === 'failed') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setMpesaState('failed');
          setMpesaMsg(data.message || 'Payment was cancelled or failed');
        }
      } catch { /* continue polling */ }
    }, 3000);
  }, []);

  const handleMpesaPush = async () => {
    if (!mpesaPhone) { setMpesaMsg('Enter your M-Pesa phone number'); return; }
    // Validate Kenyan phone number format
    const cleaned = mpesaPhone.replace(/[\s-]/g, '');
    if (!/^(?:0[17]\d{8}|254[17]\d{8}|\+254[17]\d{8})$/.test(cleaned)) {
      setMpesaMsg('Enter a valid Kenyan phone number (e.g. 0712 345 678)');
      return;
    }
    setMpesaState('sending');
    setMpesaMsg('Sending STK push...');
    try {
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mpesaPhone,
          amount: Math.ceil(orderTotal),
          accountReference: `SNACKOH-${Date.now()}`,
          description: `Snackoh Online Order - ${email || form.firstName}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMpesaCheckoutId(data.checkoutRequestId);
        setMpesaState('waiting');
        setMpesaMsg(`Check your phone (${mpesaPhone}) — enter your M-Pesa PIN to complete payment`);
        pollMpesaStatus(data.checkoutRequestId);
      } else {
        setMpesaState('failed');
        setMpesaMsg(data.message || 'Failed to send STK push');
      }
    } catch {
      setMpesaState('failed');
      setMpesaMsg('Network error — please check your connection');
    }
  };

  const pollMpesaMatch = useCallback((amount: number, phone: string) => {
    let attempts = 0;
    const maxAttempts = 20;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setMpesaState('checking');
    setMpesaMsg('Checking for payment...');

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        setMpesaState('failed');
        setMpesaMsg('No matching payment found yet.');
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
          setMpesaState('done');
          setMpesaMsg('Payment confirmed!');
        }
      } catch { /* continue polling */ }
    }, 3000);
  }, []);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save order to database
    const orderNumber = `ON-${Date.now().toString(36).toUpperCase()}`;
    const customerName = `${form.firstName} ${form.lastName}`.trim() || 'Customer';
    const customerPhone = form.phone || mpesaPhone || email;
    const paymentLabel = paymentMethod === 'mpesa' ? 'M-Pesa' : paymentMethod === 'card' ? 'Card' : 'Pay on Delivery/Pickup';
    const paymentSt = paymentMethod === 'mpesa' && mpesaState === 'done' ? 'Paid' : paymentMethod === 'card' && cardPaymentDone ? 'Paid' : 'Pending';
    setOrderError('');
    try {
      const { error: orderError } = await supabase.from('orders').insert({
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        status: 'Confirmed',
        total_amount: orderTotal,
        payment_status: paymentSt,
        payment_method: paymentLabel,
        source: 'Online',
        fulfillment: fulfillment === 'ship' ? 'Delivery' : 'Pickup',
        delivery_notes: fulfillment === 'ship'
          ? `Ship to: ${form.address}${form.apartment ? ', ' + form.apartment : ''}, ${form.city}, ${form.county} ${form.postalCode}`
          : 'Pickup from bakery',
      });
      if (orderError) {
        console.error('Order save error:', orderError);
        setOrderError('There was a problem saving your order. Please contact us with your M-Pesa confirmation.');
        return;
      }

      // Save order items
      const { data: savedOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .single();

      if (savedOrder) {
        await supabase.from('order_items').insert(
          items.map(item => ({
            order_id: savedOrder.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total: item.price * item.quantity,
          }))
        );
      }
    } catch (err) {
      console.error('Order save error:', err);
      setOrderError('There was a problem saving your order. Please contact us with your M-Pesa confirmation.');
      return;
    }

    setCompletedOrderNumber(orderNumber);
    clearCart();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setStep('success');
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600 mb-2">Thank you for your order. We&apos;ll bake it fresh and{fulfillment === 'ship' ? ' deliver it to you' : ' have it ready for pickup'}.</p>
          {completedOrderNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 mt-4">
              <p className="text-sm font-bold text-blue-800 mb-1">Your Order ID</p>
              <div className="bg-white rounded-lg px-3 py-2 border border-blue-200 font-mono text-sm text-blue-900 font-bold mb-2">{completedOrderNumber}</div>
              <p className="text-xs text-blue-600">Save this ID to track the status of your order.</p>
            </div>
          )}
          <p className="text-sm text-gray-400 mb-6">A confirmation will be sent to <strong>{email}</strong></p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/shop" className="px-6 py-3 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-700 text-sm">
              Continue Shopping
            </Link>
            {completedOrderNumber && (
              <Link href={`/shop?track=${encodeURIComponent(completedOrderNumber)}`} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 text-sm flex items-center justify-center gap-2">
                <Truck size={16} /> Track Order
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <Link href="/shop" className="px-6 py-3 bg-orange-600 text-white font-bold rounded-full">Shop Now</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Logo + breadcrumb */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-black text-gray-900">SNACKOH</Link>
          <div className="flex items-center justify-center gap-2 mt-3 text-xs">
            {['Cart', 'Information', 'Shipping', 'Payment'].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={10} className="text-gray-300" />}
                <span className={i === 1 ? 'text-orange-600 font-bold' : 'text-gray-400'}>{s}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-10 items-start">

          {/* LEFT: Checkout Form */}
          <form onSubmit={handlePlaceOrder} className="space-y-7">

            {/* Contact */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-gray-900">Contact</h2>
                <Link href="#" className="text-xs text-orange-600 hover:underline">Sign in</Link>
              </div>
              <input type="email" placeholder="Email or mobile phone number" value={email}
                onChange={e => setEmail(e.target.value)} required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
            </div>

            {/* Delivery method */}
            <div>
              <h2 className="text-base font-black text-gray-900 mb-3">Delivery</h2>
              {!canDeliver && deliverySettings.deliveryEnabled && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  Delivery is available for orders of <strong>KES {deliverySettings.minimumOrderForDelivery.toLocaleString()}</strong> and above. Add more items to qualify for delivery, or choose pickup.
                </div>
              )}
              {!deliverySettings.deliveryEnabled && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
                  Delivery is currently unavailable. Please choose pickup.
                </div>
              )}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {[
                  { value: 'ship', label: 'Ship', sub: canDeliver ? 'Deliver to my address' : `Min. order KES ${deliverySettings.minimumOrderForDelivery.toLocaleString()} for delivery`, icon: Truck, disabled: !canDeliver },
                  { value: 'pickup', label: 'Pick up', sub: 'Collect from our bakery', icon: Store, disabled: false },
                ].map((opt, i) => (
                  <label key={opt.value}
                    className={`flex items-center gap-4 px-4 py-3.5 transition-colors ${opt.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${fulfillment === opt.value ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                    <input type="radio" name="fulfillment" value={opt.value}
                      checked={fulfillment === opt.value} onChange={() => !opt.disabled && setFulfillment(opt.value as FulfillmentType)}
                      disabled={opt.disabled}
                      className="accent-orange-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.sub}</p>
                    </div>
                    <opt.icon size={18} className="text-gray-400" />
                  </label>
                ))}
              </div>
            </div>

            {/* Address (only for Ship) */}
            {fulfillment === 'ship' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Country / Region</label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none">
                    <option>Kenya</option>
                    <option>Uganda</option>
                    <option>Tanzania</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="First name (optional)" value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                  <input placeholder="Last name" value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })} required
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <div className="relative">
                  <input placeholder="Address" value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })} required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none pr-10" />
                </div>
                <input placeholder="Apartment, suite, etc. (optional)" value={form.apartment}
                  onChange={e => setForm({ ...form, apartment: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="City" value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })} required
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                  <select value={form.county} onChange={e => setForm({ ...form, county: e.target.value })}
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none">
                    <option value="">County</option>
                    {['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <input placeholder="Postal code" value={form.postalCode}
                    onChange={e => setForm({ ...form, postalCode: e.target.value })}
                    className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                </div>
                <input placeholder="Phone number" type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.saveInfo} onChange={e => setForm({ ...form, saveInfo: e.target.checked })}
                    className="accent-orange-600 w-4 h-4" />
                  <span className="text-sm text-gray-600">Save this information for next time</span>
                </label>

                {/* Shipping method */}
                <div className="mt-2">
                  <h3 className="text-sm font-black text-gray-800 mb-2">Shipping method</h3>
                  <div className="border border-gray-200 rounded-xl px-4 py-4">
                    {delivery === 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Standard Delivery</span>
                        <span className="text-sm font-bold text-green-600">FREE</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Standard Delivery</span>
                        <span className="text-sm font-bold">KES {delivery}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {fulfillment === 'pickup' && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800">
                <p className="font-bold mb-1">Pickup Location</p>
                <p>Snackoh Bites, Nairobi CBD</p>
                <p className="text-xs text-orange-600 mt-1">Mon-Sat: 6:00 AM - 8:00 PM | Sun: 7:00 AM - 6:00 PM</p>
              </div>
            )}

            {/* Payment */}
            <div>
              <h2 className="text-base font-black text-gray-900 mb-1">Payment</h2>
              <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                <Lock size={11} /> All transactions are secure and encrypted.
              </p>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Payment method selector */}
                {[
                  { value: 'mpesa' as PaymentMethod, label: 'M-Pesa', sub: 'Pay via M-Pesa STK Push', icon: Smartphone },
                  { value: 'card' as PaymentMethod, label: 'Card Payment', sub: 'Pay with Visa / Mastercard', icon: CreditCard },
                  { value: 'pay_on_delivery' as PaymentMethod, label: fulfillment === 'ship' ? 'Pay on Delivery' : 'Pay at Pickup', sub: fulfillment === 'ship' ? 'Pay when your order arrives' : 'Pay when you collect your order', icon: ShieldCheck },
                ].map((opt, i) => (
                  <label key={opt.value}
                    className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors ${paymentMethod === opt.value ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'} ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                    <input type="radio" name="paymentMethod" value={opt.value}
                      checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)}
                      className="accent-orange-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.sub}</p>
                    </div>
                    <opt.icon size={18} className="text-gray-400" />
                  </label>
                ))}
              </div>

              {/* M-Pesa payment form */}
              {paymentMethod === 'mpesa' && (
                <div className="mt-4 border border-green-200 rounded-xl p-4 bg-green-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone size={18} className="text-green-600" />
                    <h3 className="text-sm font-bold text-gray-800">M-Pesa Payment</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Enter your M-Pesa phone number. You&apos;ll receive an STK push to complete payment.</p>
                  <input
                    type="tel"
                    placeholder="e.g. 0712 345 678"
                    value={mpesaPhone}
                    onChange={e => setMpesaPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 outline-none mb-3"
                  />
                  {mpesaState === 'idle' || mpesaState === 'failed' ? (
                    <button type="button" onClick={handleMpesaPush}
                      className="w-full py-3 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                      <Smartphone size={16} /> Pay KES {orderTotal.toLocaleString()} with M-Pesa
                    </button>
                  ) : mpesaState === 'sending' ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-600">
                      <Loader2 size={16} className="animate-spin" /> Sending STK push...
                    </div>
                  ) : mpesaState === 'waiting' || mpesaState === 'checking' ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-amber-700">
                      <Clock size={16} className="animate-pulse" /> Waiting for payment confirmation...
                    </div>
                  ) : mpesaState === 'done' ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-green-700 font-bold">
                      <CheckCircle size={16} /> Payment confirmed!
                    </div>
                  ) : null}
                  {mpesaMsg && mpesaState !== 'done' && (
                    <p className={`text-xs mt-2 ${mpesaState === 'failed' ? 'text-red-600' : 'text-gray-500'}`}>{mpesaMsg}</p>
                  )}
                </div>
              )}

              {/* Card payment form */}
              {paymentMethod === 'card' && (
                <div className="mt-4 border border-blue-200 rounded-xl p-4 bg-blue-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={18} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-800">Card Payment</h3>
                  </div>
                  {cardPaymentDone ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 py-2 text-green-700">
                        <CheckCircle size={18} />
                        <span className="text-sm font-bold">Card payment confirmed</span>
                      </div>
                      <p className="text-xs text-gray-500">Your card has been charged KES {orderTotal.toLocaleString()}. You can now place your order.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">Click the button below to enter your card details securely.</p>
                      <button
                        type="button"
                        onClick={() => setShowCardModal(true)}
                        className="w-full py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 active:scale-[0.98]"
                      >
                        <CreditCard size={16} />
                        Pay KES {orderTotal.toLocaleString()} with Card
                      </button>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <div className="flex items-center gap-1 text-gray-400">
                          <Lock size={10} />
                          <span className="text-[10px]">Secure payment</span>
                        </div>
                        <span className="text-gray-200">|</span>
                        <div className="flex items-center gap-1 text-gray-400">
                          <ShieldCheck size={10} />
                          <span className="text-[10px]">SSL encrypted</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pay on delivery/pickup info */}
              {paymentMethod === 'pay_on_delivery' && (
                <div className="mt-4 border border-amber-200 rounded-xl p-4 bg-amber-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={18} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-gray-800">{fulfillment === 'ship' ? 'Pay on Delivery' : 'Pay at Pickup'}</h3>
                  </div>
                  <p className="text-xs text-gray-500">
                    {fulfillment === 'ship'
                      ? 'You can pay via M-Pesa or cash when your order is delivered.'
                      : 'You can pay via M-Pesa or cash when you collect your order from our bakery.'}
                  </p>
                </div>
              )}
            </div>

            {/* Order save error */}
            {orderError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 font-medium">
                {orderError}
              </div>
            )}

            {/* Place order button */}
            <button type="submit"
              className="w-full py-4 font-black text-base rounded-xl transition-colors flex items-center justify-center gap-2 bg-orange-600 text-white hover:bg-orange-700">
              <Lock size={16} /> Place Order — KES {orderTotal.toLocaleString()}
            </button>

            {/* Footer links */}
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-5">
              {['Refund policy', 'Shipping', 'Privacy policy', 'Terms of service', 'Cancellations'].map(l => (
                <Link key={l} href="#" className="hover:text-orange-600 hover:underline">{l}</Link>
              ))}
            </div>
          </form>

          {/* RIGHT: Order Summary */}
          <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 h-fit sticky top-24">
            <h3 className="font-black text-gray-800 mb-4 text-sm">Order Summary</h3>

            {/* Items */}
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-gray-100">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.category}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-800 shrink-0">KES {(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span className="flex items-center gap-1">
                  {fulfillment === 'pickup' ? <span className="text-gray-500">Pickup</span> : delivery === 0 ? <span className="text-green-600 font-semibold">FREE</span> : `KES ${delivery}`}
                </span>
              </div>
              <div className="flex justify-between font-black text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>
                  <span className="text-xs font-normal text-gray-400 mr-1">KES</span>
                  {orderTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Payment Modal */}
      <CardPaymentModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        amount={orderTotal}
        email={email}
        onPaymentComplete={() => {
          setCardPaymentDone(true);
          setShowCardModal(false);
        }}
      />
    </div>
  );
}
