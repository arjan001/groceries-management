'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useCart } from '@/lib/cart-context';
import { CIRCLE_CATEGORIES, fetchMainBakeryProducts } from '@/lib/products';
import type { Product, Offer } from '@/lib/products';
import { ShoppingBag, Star, ChevronRight, ChevronLeft, Truck, Clock, Shield, Users, Store, Megaphone, Tag, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Product Card (mini, for home page) ───────────────────────────────────
function HomeProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();

  return (
    <div className="group cursor-pointer" onClick={() => router.push(`/shop/${product.id}`)}>
      <div className="relative overflow-hidden rounded-2xl bg-gray-50 aspect-square mb-3">
        <img src={product.image} alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {product.isSale && product.originalPrice && (
          <div className="absolute top-3 right-0">
            <div className="bg-red-500 text-white text-[10px] font-black px-3 py-1 uppercase tracking-wider"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8% 100%)' }}>
              SALE
            </div>
          </div>
        )}
        {product.isNew && (
          <span className="absolute top-3 left-3 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full">SOLD OUT</span>
          </div>
        )}
        {product.inStock && (
          <button
            onClick={e => { e.stopPropagation(); addItem({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category }); }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-orange-600 flex items-center gap-1.5"
          >
            <ShoppingBag size={12} /> Add to Cart
          </button>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-sm font-black text-orange-600">KES {product.price.toLocaleString()}</span>
        {product.originalPrice && (
          <span className="text-xs text-gray-400 line-through">KES {product.originalPrice.toLocaleString()}</span>
        )}
      </div>
      {/* Stock indicator */}
      <div className="mt-1">
        {product.inStock ? (
          product.stock <= 5 ? (
            <span className="text-[10px] text-amber-600 font-semibold">Only {product.stock} left!</span>
          ) : (
            <span className="text-[10px] text-green-600 font-semibold">In stock</span>
          )
        ) : (
          <span className="text-[10px] text-red-500 font-semibold">Out of stock</span>
        )}
      </div>
    </div>
  );
}

// ─── Promotional Ads Carousel ─────────────────────────────────────────────
function AdsCarousel() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    async function loadOffers() {
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (!error && data && data.length > 0) {
          setOffers(data as Offer[]);
          return;
        }
      } catch { /* table may not exist */ }
      // Fallback to localStorage
      try {
        const local = localStorage.getItem('snackoh_offers');
        if (local) {
          const parsed = JSON.parse(local) as Offer[];
          setOffers(parsed.filter(o => o.is_active));
        }
      } catch { /* ignore */ }
    }
    loadOffers();
  }, []);

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (offers.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % offers.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [offers.length]);

  // Default offers if none configured
  const defaultOffers: { title: string; description: string; badge: string; link: string; image: string; discount: string }[] = [
    {
      title: 'Weekend Special Sale',
      description: 'Up to 30% off on selected baked goods. Fresh from the oven, curated for you.',
      badge: 'LIMITED OFFER',
      link: '/shop',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80&fit=crop',
      discount: '30% OFF',
    },
    {
      title: 'New Arrivals This Week',
      description: 'Fresh pastries and cakes added weekly. Discover our latest creations.',
      badge: 'JUST DROPPED',
      link: '/shop',
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80&fit=crop',
      discount: '',
    },
  ];

  if (offers.length === 0) {
    return (
      <section className="py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {defaultOffers.map((offer, idx) => (
              <Link key={idx} href={offer.link}
                className="group relative rounded-2xl overflow-hidden h-48 md:h-56 block">
                <img src={offer.image} alt={offer.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                <div className="relative z-10 p-6 h-full flex flex-col justify-center">
                  <p className="text-orange-300 text-[10px] font-bold tracking-widest uppercase mb-1">{offer.badge}</p>
                  <h3 className="text-white text-xl md:text-2xl font-black leading-tight mb-1.5">{offer.title}</h3>
                  <p className="text-white/70 text-xs max-w-xs mb-3">{offer.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-white text-xs font-bold group-hover:text-orange-300 transition-colors">
                    {offer.discount ? `${offer.discount} — Shop Now` : 'Explore New In'} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 px-6">
      <div className="max-w-7xl mx-auto">
        {offers.length <= 2 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map((offer) => (
              <Link key={offer.id} href={offer.link_url || '/shop'}
                className="group relative rounded-2xl overflow-hidden h-48 md:h-56 block">
                {offer.image_url ? (
                  <img src={offer.image_url} alt={offer.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-amber-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                <div className="relative z-10 p-6 h-full flex flex-col justify-center">
                  <p className="text-orange-300 text-[10px] font-bold tracking-widest uppercase mb-1">{offer.badge_text}</p>
                  <h3 className="text-white text-xl md:text-2xl font-black leading-tight mb-1.5">{offer.title}</h3>
                  <p className="text-white/70 text-xs max-w-xs mb-3">{offer.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-white text-xs font-bold group-hover:text-orange-300 transition-colors">
                    {offer.discount_text ? `${offer.discount_text} — Shop Now` : 'Shop The Sale'} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Full carousel for 3+ offers */
          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <div className="flex transition-transform duration-500"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                {offers.map((offer) => (
                  <Link key={offer.id} href={offer.link_url || '/shop'}
                    className="min-w-full relative h-48 md:h-56 block group">
                    {offer.image_url ? (
                      <img src={offer.image_url} alt={offer.title}
                        className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-600 to-amber-800" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                    <div className="relative z-10 p-8 h-full flex flex-col justify-center">
                      <p className="text-orange-300 text-[10px] font-bold tracking-widest uppercase mb-1">{offer.badge_text}</p>
                      <h3 className="text-white text-2xl md:text-3xl font-black leading-tight mb-2">{offer.title}</h3>
                      <p className="text-white/70 text-sm max-w-md mb-3">{offer.description}</p>
                      <span className="inline-flex items-center gap-1.5 text-white text-sm font-bold group-hover:text-orange-300 transition-colors">
                        {offer.discount_text ? `${offer.discount_text} — Shop Now` : 'Shop Now'} <ArrowRight size={14} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {/* Carousel controls */}
            {offers.length > 1 && (
              <>
                <button onClick={() => setCurrentSlide(prev => prev === 0 ? offers.length - 1 : prev - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white shadow-md transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setCurrentSlide(prev => (prev + 1) % offers.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white shadow-md transition-colors">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {offers.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentSlide(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${idx === currentSlide ? 'bg-white' : 'bg-white/40'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Offers & Wholesale Section ──────────────────────────────────────────────
function OffersSection() {
  return (
    <section className="py-10 bg-orange-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">Special Deals</p>
          <h2 className="text-3xl font-black text-gray-900">Offers & Promotions</h2>
          <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">Check out our current deals, wholesale offers, and upcoming promotions. Save big on your favourite bakes!</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Current Offers */}
          <div className="bg-white rounded-2xl p-6 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <Tag size={20} className="text-orange-600" />
            </div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Current Offers</h3>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0" /> 15% off all pastries this weekend</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0" /> Buy 2 loaves, get 1 free</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0" /> Free delivery over KES 2,000</li>
            </ul>
            <Link href="/shop" className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1">
              Shop Now <ArrowRight size={12} />
            </Link>
          </div>

          {/* Wholesale Offers */}
          <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
              <Users size={20} className="text-amber-600" />
            </div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Wholesale Offers</h3>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" /> Bulk pricing from 50+ units</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" /> Dedicated account manager</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" /> Weekly delivery scheduling</li>
            </ul>
            <Link href="/contact" className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
              Contact Sales <ArrowRight size={12} />
            </Link>
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Megaphone size={20} className="text-blue-600" />
            </div>
            <h3 className="font-black text-gray-900 text-lg mb-2">Coming Soon</h3>
            <ul className="space-y-2 text-sm text-gray-600 mb-4">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" /> Valentine&apos;s Day specials</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" /> Custom cake design contest</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0" /> Loyalty rewards program</li>
            </ul>
            <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
              Stay tuned for updates
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}


export default function HomePage() {
  const [dynamicProducts, setDynamicProducts] = useState<Product[]>([]);
  const [freshProducts, setFreshProducts] = useState<Product[]>([]);

  // Fetch products from main bakery inventory (food_info table) — only real products, no dummy fallback
  useEffect(() => {
    async function loadProducts() {
      try {
        const bakeryProducts = await fetchMainBakeryProducts();
        if (bakeryProducts && bakeryProducts.length > 0) {
          setDynamicProducts(bakeryProducts);
          setFreshProducts(bakeryProducts.filter(p => p.inStock).slice(0, 8));
          return;
        }
      } catch { /* no products available */ }
      // No fallback to hardcoded dummy products — show empty until real products are added
      setDynamicProducts([]);
      setFreshProducts([]);
    }
    loadProducts();
  }, []);

  const bestSellers = dynamicProducts.filter(p => p.isBestSeller || p.stock > 10).slice(0, 8);

  return (
    <div className="bg-white">

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div>
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-3">
              FREE DELIVERY ON ORDERS OVER KES 2,000
            </p>
            <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight mb-5">
              Award-Winning<br />
              <span className="text-orange-600">Baked Goods</span><br />
              Delivered Daily
            </h1>
            <p className="text-gray-500 text-base leading-relaxed mb-4 max-w-md">
              We cater for both <strong className="text-gray-700">retail and wholesale</strong> customers.
              From fresh breads, kaimati, cakes, pastries, donuts, and so much more —
              handcrafted with love by our master bakers, fresh every morning.
            </p>
            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-2 text-xs bg-orange-50 text-orange-700 font-semibold px-3 py-1.5 rounded-full border border-orange-200">
                <Store size={14} /> Retail Orders
              </div>
              <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 font-semibold px-3 py-1.5 rounded-full border border-amber-200">
                <Users size={14} /> Wholesale Orders
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop"
                className="px-8 py-3.5 bg-gray-900 text-white font-bold text-sm rounded-full hover:bg-orange-600 transition-colors inline-flex items-center gap-2">
                SHOP NOW <ChevronRight size={15} />
              </Link>
              <Link href="/shop?category=Cake"
                className="px-8 py-3.5 border-2 border-gray-200 text-gray-800 font-bold text-sm rounded-full hover:border-orange-400 transition-colors">
                Custom Cakes
              </Link>
            </div>
            {/* Trust badges */}
            <div className="flex flex-wrap gap-5 mt-10">
              {[
                { icon: Truck, label: 'Same-Day Delivery' },
                { icon: Clock, label: 'Baked Fresh Daily' },
                { icon: Shield, label: 'Quality Guaranteed' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <b.icon size={14} className="text-orange-500" /> {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image Grid */}
          <div className="hidden md:grid grid-cols-2 gap-3 h-[480px]">
            <div className="rounded-3xl overflow-hidden row-span-2">
              <img
                src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop"
                alt="Chocolate Cake" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-3xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80&fit=crop"
                alt="Croissant" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-3xl overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&fit=crop"
                alt="Bread" className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Mobile hero image */}
          <div className="md:hidden rounded-3xl overflow-hidden aspect-video">
            <img src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80&fit=crop"
              alt="Bakery" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* ─── PROMOTIONAL ADS CAROUSEL ─────────────────────────────────── */}
      <AdsCarousel />

      {/* ─── SCROLLING CATEGORY CIRCLES ──────────────────────────────────── */}
      <section className="py-10 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-8 overflow-x-auto pb-2 scrollbar-hide justify-center flex-wrap">
            {CIRCLE_CATEGORIES.map(cat => (
              <Link key={cat.label} href={cat.href}
                className="flex flex-col items-center gap-2.5 group shrink-0">
                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-transparent group-hover:border-orange-400 transition-all ring-2 ring-gray-100 group-hover:ring-orange-200">
                  <img src={cat.image} alt={cat.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
                <span className="text-xs font-bold text-gray-700 group-hover:text-orange-600 transition-colors tracking-wide">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHAT WE OFFER (RETAIL & WHOLESALE) ──────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">Retail &amp; Wholesale</p>
            <h2 className="text-3xl font-black text-gray-900">What We Offer</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-lg mx-auto">
              Whether you&apos;re buying for your home or stocking your shop, we&apos;ve got you covered with fresh baked goods every day.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Fresh Breads', desc: 'White, brown, whole wheat & more', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&fit=crop' },
              { name: 'Kaimati', desc: 'Traditional Kenyan sweet dumplings', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80&fit=crop' },
              { name: 'Cakes & Pastries', desc: 'Custom cakes, croissants & tarts', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80&fit=crop' },
              { name: 'Donuts & Cookies', desc: 'Glazed donuts, butter cookies & more', image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80&fit=crop' },
            ].map(item => (
              <Link key={item.name} href="/shop" className="group relative rounded-2xl overflow-hidden aspect-square block">
                <img src={item.image} alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white font-black text-sm">{item.name}</p>
                  <p className="text-white/70 text-xs mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Looking for <strong className="text-gray-700">wholesale pricing</strong>? We offer bulk orders for shops, restaurants, events, and corporate clients.
            </p>
            <Link href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors">
              Contact Us for Wholesale <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── BEST SELLERS ─────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">Our Favourites</p>
              <h2 className="text-3xl font-black text-gray-900">Best Sellers</h2>
            </div>
            <Link href="/shop" className="text-sm font-bold text-gray-600 hover:text-orange-600 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {bestSellers.map(p => <HomeProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      {/* ─── OFFERS & PROMOTIONS SECTION ──────────────────────────────── */}
      <OffersSection />

      {/* ─── PROMO BANNER ─────────────────────────────────────────────────── */}
      <section className="py-4 px-6">
        <div className="max-w-7xl mx-auto rounded-3xl overflow-hidden bg-amber-950 relative h-64 md:h-80 flex items-center">
          <img
            src="https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=1200&q=80&fit=crop"
            alt="Bakery" className="absolute inset-0 w-full h-full object-cover opacity-40" />
          <div className="relative z-10 px-10 md:px-16 max-w-xl">
            <p className="text-orange-300 text-xs font-bold tracking-widest uppercase mb-2">Limited Time</p>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
              The Perfect Bakes<br />For Any Occasion
            </h2>
            <p className="text-white/70 text-sm mb-6">
              From graduation to anniversary — our seasonal creations are here for a limited time only.
            </p>
            <Link href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-bold text-sm rounded-full hover:bg-orange-600 hover:text-white transition-colors">
              SHOP NOW <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── GIFTS SECTION ────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">Celebrate with Us</p>
            <h2 className="text-3xl font-black text-gray-900">Gifts for Every Occasion!</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-md mx-auto">
              Whether it&apos;s a birthday or a thank-you, you&apos;ll find the perfect baked gift here.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'BIRTHDAYS', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80&fit=crop', href: '/shop?category=Cake' },
              { label: 'THANK YOU', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80&fit=crop', href: '/shop?category=Cookies' },
              { label: 'CELEBRATIONS', image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80&fit=crop', href: '/shop?category=Cake' },
            ].map(item => (
              <Link key={item.label} href={item.href}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] block">
                <img src={item.image} alt={item.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                <div className="absolute bottom-5 inset-x-0 flex justify-center">
                  <span className="bg-white text-gray-900 font-black text-xs tracking-[0.2em] px-6 py-2.5 rounded-full group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FRESH TODAY (products from database) ─────────────────────── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">Baked Today</p>
              <h2 className="text-3xl font-black text-gray-900">Fresh Today</h2>
            </div>
            <Link href="/shop" className="text-sm font-bold text-gray-600 hover:text-orange-600 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {freshProducts.map(p => <HomeProductCard key={p.id} product={p} />)}
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors">
              Shop More <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── DISCOUNT STRIP ───────────────────────────────────────────────── */}
      <section className="py-5 bg-orange-600">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-black text-white">25% OFF CUSTOM CAKE ORDERS</p>
            <p className="text-orange-100 text-sm">Mix and match flavours, get 25% off. This week only.</p>
          </div>
          <Link href="/shop?category=Cake"
            className="shrink-0 px-6 py-3 bg-white text-orange-600 font-black text-sm rounded-full hover:bg-gray-100 transition-colors">
            SHOP NOW
          </Link>
        </div>
      </section>

      {/* ─── ABOUT US ──────────────────────────────────────────────────── */}
      <section id="about" className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-2">About Snackoh Bakers</p>
              <h2 className="text-3xl font-black text-gray-900 mb-6">Committed to Health, Quality &amp; Freshness</h2>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  At Snackoh Bakers, we believe that every bite should be a testament to quality. Our bakery is built on a foundation of health-conscious baking, using premium ingredients sourced from trusted suppliers to ensure every product meets the highest standards.
                </p>
                <p>
                  We are committed to maintaining strict quality control at every step — from selecting the finest flours and natural ingredients to our carefully monitored baking processes. Freshness is not just a promise; it&apos;s our daily practice. Every loaf, pastry, and cake is baked fresh to order.
                </p>
                <p>
                  Whether you&apos;re a <strong className="text-gray-800">retail customer</strong> looking for your daily bread or a <strong className="text-gray-800">wholesale partner</strong> stocking your shelves, we serve both with the same dedication to excellence. We supply shops, restaurants, hotels, events, and corporate clients across Nairobi.
                </p>
              </div>
              <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                <p className="text-sm font-bold text-gray-800 mb-1">Interested in wholesale orders?</p>
                <p className="text-xs text-gray-600 mb-3">We offer competitive bulk pricing for businesses. Get in touch with our sales team for a custom quote.</p>
                <Link href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-full hover:bg-orange-700 transition-colors">
                  Contact Us <ChevronRight size={12} />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden aspect-[3/4]">
                <img src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&fit=crop" alt="Fresh breads" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-2xl overflow-hidden aspect-[3/4] mt-8">
                <img src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80&fit=crop" alt="Cakes and pastries" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── REVIEWS ──────────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-gray-900">What Our Customers Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Grace M.', review: 'The chocolate fudge cake was absolutely divine! Ordered for my son\'s birthday and everyone was asking where it came from.', rating: 5 },
              { name: 'James K.', review: 'Croissants are the best in Nairobi! Flaky, buttery perfection. I order every Saturday morning.', rating: 5 },
              { name: 'Amina W.', review: 'Custom red velvet cake for our wedding. It was stunning and delicious. Cannot recommend enough!', rating: 5 },
            ].map(r => (
              <div key={r.name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex mb-3">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">&ldquo;{r.review}&rdquo;</p>
                <p className="font-bold text-gray-900 text-sm">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
