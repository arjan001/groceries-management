'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { Minus, Plus, X, ChevronRight, ShoppingBag } from 'lucide-react';

export default function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart();
  const router = useRouter();

  const FREE_DELIVERY = 2000;
  const remaining = Math.max(0, FREE_DELIVERY - total);
  const progress = Math.min(100, (total / FREE_DELIVERY) * 100);

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16">
        <ShoppingBag size={56} className="text-gray-200 mb-4" />
        <h2 className="text-2xl font-black text-gray-800 mb-2">Your Shopping Cart is Empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven&apos;t added anything yet.</p>
        <Link href="/shop"
          className="px-8 py-3.5 bg-gray-900 text-white font-bold rounded-full hover:bg-orange-600 transition-colors">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <ChevronRight size={12} />
          <span className="text-gray-800 font-semibold">Your Shopping Cart</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black text-gray-900 text-center mb-10">Your Shopping Cart</h1>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* Cart items table */}
          <div className="lg:col-span-2">
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="col-span-6">Product</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right">Total</div>
              </div>

              {/* Items */}
              <div className="divide-y divide-gray-50">
                {items.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-4 px-5 py-5 items-center">
                    {/* Product */}
                    <div className="col-span-6 flex gap-3 items-center">
                      <Link href={`/shop/${item.id}`} className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                      </Link>
                      <div className="min-w-0">
                        <Link href={`/shop/${item.id}`} className="text-sm font-semibold text-gray-800 hover:text-orange-600 truncate block">{item.name}</Link>
                        <p className="text-xs text-orange-600 font-bold mt-0.5">KES {item.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{item.category}</p>
                        <button onClick={() => removeItem(item.id)}
                          className="text-xs text-gray-400 hover:text-red-500 underline mt-1">Delete</button>
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-3 flex items-center justify-center">
                      <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-500">
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 text-gray-500">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <span className="text-sm font-black text-gray-800">KES {(item.price * item.quantity).toLocaleString()}</span>
                      <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-400 transition-colors ml-1">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart actions */}
            <div className="flex items-center justify-between mt-4">
              <Link href="/shop"
                className="text-sm font-bold text-gray-600 hover:text-orange-600 underline underline-offset-2">
                ← Continue Shopping
              </Link>
              <button onClick={clearCart}
                className="text-xs text-gray-400 hover:text-red-500 underline">
                Clear cart
              </button>
            </div>
          </div>

          {/* Order Summary sidebar */}
          <div className="space-y-4">
            {/* Free delivery progress */}
            <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50">
              {remaining > 0 ? (
                <p className="text-xs text-gray-600 mb-2">
                  Buy <strong className="text-gray-900">KES {remaining.toLocaleString()}</strong> more to enjoy <strong className="text-green-700">FREE delivery</strong>
                </p>
              ) : (
                <p className="text-xs text-green-700 font-bold mb-2">🎉 You qualify for FREE delivery!</p>
              )}
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Special instructions */}
            <div className="border border-gray-100 rounded-2xl p-5">
              <label className="block text-sm font-bold text-gray-700 mb-2">Order special instructions</label>
              <textarea rows={3} placeholder="Any special requests, allergies, or delivery notes…"
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-orange-400 outline-none resize-none text-gray-600 placeholder-gray-300" />
            </div>

            {/* Total summary */}
            <div className="border border-gray-100 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-600">Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="text-sm font-bold text-gray-800">KES {total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Delivery</span>
                <span className="text-sm text-gray-400">{total >= FREE_DELIVERY ? 'FREE' : 'Calculated at checkout'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 mb-1">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-xl text-gray-900">KES {total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Taxes and delivery calculated at checkout</p>

              <button onClick={() => router.push('/checkout')}
                className="w-full py-4 bg-gray-900 text-white font-black text-sm rounded-full hover:bg-orange-600 transition-colors uppercase tracking-wide">
                CHECK OUT
              </button>

              {/* Payment icons */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400 mb-2">We accept</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {['VISA', 'MC', 'AMEX', 'JCB', 'M-PESA'].map(p => (
                    <span key={p} className="px-2 py-1 border border-gray-200 rounded text-[10px] font-bold text-gray-500">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
