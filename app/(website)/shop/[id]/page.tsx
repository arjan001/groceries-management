'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart-context';
import { fetchMainBakeryProducts } from '@/lib/products';
import type { Product } from '@/lib/products';
import { ShoppingBag, Minus, Plus, ChevronRight, Star, Truck, RotateCcw, Shield } from 'lucide-react';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { addItem } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'details'>('description');
  const [added, setAdded] = useState(false);
  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

  // Load from main bakery inventory only — no dummy product fallback
  useEffect(() => {
    async function loadProduct() {
      try {
        const bakeryProducts = await fetchMainBakeryProducts();
        if (bakeryProducts && bakeryProducts.length > 0) {
          const found = bakeryProducts.find(p => p.id === id);
          if (found) {
            setProduct(found);
            setRelatedProducts(bakeryProducts.filter(p => p.id !== id && p.category === found.category).slice(0, 4));
            return;
          }
        }
      } catch { /* product not found */ }
    }
    loadProduct();
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="text-5xl mb-4">🍞</p>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">This item might be sold out or no longer available.</p>
          <Link href="/shop" className="px-6 py-3 bg-orange-600 text-white font-bold rounded-full hover:bg-orange-700">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  const savings = product.originalPrice ? product.originalPrice - product.price : 0;
  const related = relatedProducts;

  const handleAddToCart = () => {
    for (let i = 0; i < qty; i++) {
      addItem({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="bg-white">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-orange-600">Home</Link>
          <ChevronRight size={12} />
          <Link href="/shop" className="hover:text-orange-600">Shop</Link>
          <ChevronRight size={12} />
          <Link href={`/shop?category=${product.category}`} className="hover:text-orange-600">{product.category}</Link>
          <ChevronRight size={12} />
          <span className="text-gray-800 font-semibold truncate">{product.name}</span>
        </div>
      </div>

      {/* Main product layout */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20">

          {/* Image */}
          <div className="space-y-3">
            <div className="relative rounded-3xl overflow-hidden aspect-square bg-gray-50">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              {product.isSale && product.originalPrice && (
                <div className="absolute top-0 right-0 overflow-hidden w-24 h-24">
                  <div className="absolute top-5 -right-5 bg-red-500 text-white text-[10px] font-black tracking-wider py-1 w-28 text-center rotate-45 shadow">
                    SALE
                  </div>
                </div>
              )}
              {product.isNew && (
                <span className="absolute top-4 left-4 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">NEW</span>
              )}
            </div>
            {/* Thumbnail row (placeholder same image) */}
            <div className="flex gap-2">
              {[product.image, ...related.slice(0, 3).map(r => r.image)].slice(0, 4).map((img, i) => (
                <div key={i} className={`w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer ${i === 0 ? 'border-orange-400' : 'border-gray-100 hover:border-orange-200'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.tags.map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">{tag}</span>
              ))}
            </div>

            <h1 className="text-3xl font-black text-gray-900 mb-2">{product.name}</h1>

            {/* Stars */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">
                {[1,2,3,4,5].map(i => <Star key={i} size={14} className="text-amber-400 fill-amber-400" />)}
              </div>
              <span className="text-xs text-gray-500">(24 reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-3xl font-black text-orange-600">KES {product.price.toLocaleString()}</span>
              {product.originalPrice && (
                <span className="text-lg text-gray-400 line-through">KES {product.originalPrice.toLocaleString()}</span>
              )}
            </div>
            {savings > 0 && (
              <p className="text-sm text-green-600 font-semibold mb-4">You save KES {savings.toLocaleString()}!</p>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2 mb-5">
              {!product.inStock ? (
                <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-sm text-red-600 font-semibold">Out of Stock</span></>
              ) : product.stock < 10 ? (
                <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /><span className="text-sm text-amber-600 font-semibold">Only {product.stock} left — order soon!</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-sm text-green-600 font-semibold">In Stock ({product.stock} available)</span></>
              )}
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-6">{product.description}</p>

            {/* Quantity + Add to cart */}
            {product.inStock ? (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                    <button onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-50">
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center font-bold text-sm">{qty}</span>
                    <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-50">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={handleAddToCart}
                    className={`flex-1 py-3.5 font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 ${added ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-orange-600'}`}>
                    <ShoppingBag size={16} />
                    {added ? '✓ Added to Cart!' : 'Add to Cart'}
                  </button>
                </div>
                <button onClick={() => { handleAddToCart(); router.push('/checkout'); }}
                  className="w-full py-3.5 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors">
                  Buy Now
                </button>
              </div>
            ) : (
              <div className="mb-6">
                <button disabled className="w-full py-3.5 bg-gray-200 text-gray-400 font-bold text-sm rounded-full cursor-not-allowed">
                  Out of Stock
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">Join the waitlist to be notified when this item is back</p>
              </div>
            )}

            {/* Trust icons */}
            <div className="grid grid-cols-3 gap-3 py-4 border-t border-gray-100">
              {[
                { icon: Truck, label: 'Free Delivery', sub: 'Orders over KES 2,000' },
                { icon: RotateCcw, label: 'Easy Returns', sub: 'Within 24 hours' },
                { icon: Shield, label: 'Quality Assured', sub: 'Freshness guaranteed' },
              ].map(t => (
                <div key={t.label} className="text-center">
                  <t.icon size={18} className="mx-auto text-orange-500 mb-1" />
                  <p className="text-xs font-bold text-gray-700">{t.label}</p>
                  <p className="text-[10px] text-gray-400">{t.sub}</p>
                </div>
              ))}
            </div>

            {/* Details / Description tabs */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex gap-4 mb-4">
                {(['description', 'details'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`text-sm font-bold pb-1 border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {activeTab === 'description' ? product.description : product.details}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
