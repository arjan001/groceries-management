'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { CATEGORY_LIST, CIRCLE_CATEGORIES, fetchMainBakeryProducts } from '@/lib/products';
import type { Product } from '@/lib/products';
import { ShoppingBag, SlidersHorizontal, X, ChevronDown, ChevronRight } from 'lucide-react';

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();

  return (
    <div className="group" onClick={() => router.push(`/shop/${product.id}`)}>
      <div className="relative overflow-hidden rounded-2xl bg-gray-50 aspect-square mb-3 cursor-pointer">
        <img src={product.image} alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

        {/* SALE ribbon */}
        {product.isSale && product.originalPrice && (
          <div className="absolute top-0 right-0 overflow-hidden w-20 h-20">
            <div className="absolute top-4 -right-5 bg-red-500 text-white text-[9px] font-black tracking-wider py-1 w-24 text-center rotate-45 shadow-md">
              SALE
            </div>
          </div>
        )}
        {product.isNew && (
          <span className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full">SOLD OUT</span>
          </div>
        )}
        {product.inStock && (
          <button
            onClick={e => {
              e.stopPropagation();
              addItem({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category });
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-orange-600 flex items-center gap-1.5"
          >
            <ShoppingBag size={12} /> Add to Cart
          </button>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate cursor-pointer">{product.name}</p>
      <p className="text-[11px] text-gray-400 mb-1">{product.category}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-orange-600">KES {product.price.toLocaleString()}</span>
        {product.originalPrice && (
          <span className="text-xs text-gray-400 line-through">KES {product.originalPrice.toLocaleString()}</span>
        )}
      </div>
      {/* Stock indicator */}
      <div className="mt-1.5">
        {!product.inStock ? (
          <span className="text-[10px] font-semibold text-red-500">Out of stock</span>
        ) : product.stock < 10 ? (
          <span className="text-[10px] font-semibold text-amber-500">Only {product.stock} left!</span>
        ) : (
          <span className="text-[10px] text-green-600 font-semibold">In stock</span>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading shop...</p></div>}>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Load products from main bakery inventory — only real products, no dummy fallback
  useEffect(() => {
    async function loadProducts() {
      try {
        const bakeryProducts = await fetchMainBakeryProducts();
        if (bakeryProducts && bakeryProducts.length > 0) {
          setProducts(bakeryProducts);
          return;
        }
      } catch { /* no products available */ }
      setProducts([]);
    }
    loadProducts();
  }, []);

  const categoryParam = searchParams.get('category') || 'All';
  const queryParam    = searchParams.get('q') || '';
  const sortParam     = searchParams.get('sort') || 'featured';

  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [priceMax, setPriceMax] = useState(2000);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState(sortParam);
  const [searchQuery, setSearchQuery] = useState(queryParam);

  useEffect(() => { setSelectedCategory(categoryParam); }, [categoryParam]);
  useEffect(() => { setSearchQuery(queryParam); }, [queryParam]);

  const allTags = [...new Set(products.flatMap(p => p.tags))];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const setCategory = (cat: string) => {
    setSelectedCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat === 'All') params.delete('category'); else params.set('category', cat);
    router.push(`/shop?${params.toString()}`);
  };

  let filtered = products
    .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
    .filter(p => p.price <= priceMax)
    .filter(p => selectedTags.length === 0 || selectedTags.some(t => p.tags.includes(t)))
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase()));

  if (sortBy === 'price-asc')   filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sortBy === 'price-desc')  filtered = [...filtered].sort((a, b) => b.price - a.price);
  if (sortBy === 'name')        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const SidebarContent = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <div className="flex items-center gap-2 mb-3 border-l-2 border-orange-500 pl-2">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Categories</h3>
        </div>
        <ul className="space-y-1">
          {CATEGORY_LIST.map(cat => (
            <li key={cat}>
              <button
                onClick={() => setCategory(cat)}
                className={`w-full text-left text-sm py-1.5 px-2 rounded transition-colors flex items-center justify-between ${selectedCategory === cat ? 'text-orange-600 font-bold bg-orange-50' : 'text-gray-600 hover:text-orange-500'}`}
              >
                {cat}
                {selectedCategory === cat && <ChevronRight size={12} />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Price Range */}
      <div>
        <div className="flex items-center gap-2 mb-3 border-l-2 border-orange-500 pl-2">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Price</h3>
        </div>
        <input type="range" min={50} max={2000} step={50} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))}
          className="w-full accent-orange-500" />
        <p className="text-xs text-gray-500 mt-1">Price: KES 50 – KES {priceMax.toLocaleString()}</p>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center gap-2 mb-3 border-l-2 border-orange-500 pl-2">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Tags</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${selectedTags.includes(tag) ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Clear filters */}
      {(selectedCategory !== 'All' || selectedTags.length > 0 || priceMax < 2000) && (
        <button
          onClick={() => { setCategory('All'); setSelectedTags([]); setPriceMax(2000); }}
          className="w-full py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb + category circles */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-5">
            <Link href="/" className="hover:text-orange-600">Home</Link>
            <span>›</span>
            <span className="text-gray-800 font-semibold">{selectedCategory === 'All' ? 'All Products' : selectedCategory}</span>
          </div>
          {/* Category circles */}
          <div className="flex gap-5 overflow-x-auto pb-2">
            {CIRCLE_CATEGORIES.map(cat => (
              <button key={cat.label} onClick={() => setCategory(cat.label === 'Specials' ? 'All' : cat.label)}
                className="flex flex-col items-center gap-1.5 group shrink-0">
                <div className={`w-14 h-14 rounded-full overflow-hidden ring-2 transition-all ${selectedCategory === cat.label ? 'ring-orange-500' : 'ring-gray-100 group-hover:ring-orange-200'}`}>
                  <img src={cat.image} alt={cat.label} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold text-gray-600 group-hover:text-orange-600">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-52 shrink-0">
            <SidebarContent />
          </aside>

          {/* Product Area */}
          <div className="flex-1 min-w-0">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:border-orange-400">
                  <SlidersHorizontal size={14} /> Filters
                </button>
                <p className="text-sm text-gray-500">{filtered.length} products</p>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown size={14} className="text-gray-400" />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  className="text-sm font-semibold text-gray-700 border-0 outline-none cursor-pointer">
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            </div>

            {/* Search result note */}
            {searchQuery && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <span>Results for "<strong>{searchQuery}</strong>"</span>
                <button onClick={() => { setSearchQuery(''); router.push('/shop'); }}
                  className="text-xs text-red-500 hover:underline flex items-center gap-0.5">
                  <X size={12} /> Clear
                </button>
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingBag size={48} className="text-gray-200 mb-4" />
                <p className="text-gray-500 font-semibold">No products found</p>
                <button onClick={() => { setCategory('All'); setSelectedTags([]); setPriceMax(2000); setSearchQuery(''); router.push('/shop'); }}
                  className="mt-4 text-sm text-orange-600 hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-gray-900">Filters</h3>
              <button onClick={() => setSidebarOpen(false)}><X size={20} /></button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
}
