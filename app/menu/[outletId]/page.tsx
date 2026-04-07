'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MapPin, Clock, Phone, Search, ShoppingBag } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  address: string;
  city: string;
  phone: string;
  opening_hours: string;
  status: string;
}

interface MenuItem {
  id: string;
  product_name: string;
  category: string;
  description: string;
  image_url: string;
  retail_price: number;
  is_active: boolean;
  current_stock: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PublicMenuPage() {
  const params = useParams();
  const outletId = params.outletId as string;

  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#ea580c');

  const fetchOutlet = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('outlets')
        .select('id, name, code, outlet_type, address, city, phone, opening_hours, status')
        .eq('id', outletId)
        .single();

      if (err || !data) {
        setError('Menu not found. This outlet may no longer exist.');
        return;
      }

      if (data.status !== 'Active') {
        setError('This outlet is currently not active.');
        return;
      }

      setOutlet({
        id: data.id as string,
        name: (data.name || '') as string,
        code: (data.code || '') as string,
        outlet_type: (data.outlet_type || '') as string,
        address: (data.address || '') as string,
        city: (data.city || '') as string,
        phone: (data.phone || '') as string,
        opening_hours: (data.opening_hours || '') as string,
        status: (data.status || '') as string,
      });
    } catch {
      setError('Failed to load menu. Please try again.');
    }
  }, [outletId]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('outlet_products')
        .select('id, product_name, category, description, image_url, retail_price, is_active, current_stock')
        .eq('outlet_id', outletId)
        .eq('is_active', true)
        .order('category')
        .order('product_name');

      if (err) {
        console.error('Error fetching menu:', err.message);
        return;
      }

      setMenuItems(
        (data || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          product_name: (r.product_name || '') as string,
          category: (r.category || 'General') as string,
          description: (r.description || '') as string,
          image_url: (r.image_url || '') as string,
          retail_price: (r.retail_price || 0) as number,
          is_active: Boolean(r.is_active),
          current_stock: (r.current_stock || 0) as number,
        }))
      );
    } catch {
      console.error('Failed to fetch menu items');
    }
  }, [outletId]);

  const fetchBranding = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'general')
        .single();
      if (!err && data?.value) {
        const g = data.value as Record<string, string>;
        if (g.businessName) setBusinessName(g.businessName);
        if (g.logoUrl) setLogoUrl(g.logoUrl);
        if (g.primaryColor) setThemeColor(g.primaryColor);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchOutlet(), fetchMenuItems(), fetchBranding()]);
      setLoading(false);
    }
    if (outletId) load();
  }, [outletId, fetchOutlet, fetchMenuItems, fetchBranding]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const categories = ['All', ...Array.from(new Set(menuItems.map(m => m.category)))];

  const filteredItems = menuItems.filter(item => {
    const matchSearch = item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const groupedItems = filteredItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Oops!</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header / Hero */}
      <header
        className="relative overflow-hidden text-white"
        style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd, ${themeColor}99)` }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-60 h-60 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 py-8 sm:py-12 text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={businessName} className="h-12 sm:h-14 mx-auto mb-3 object-contain rounded-lg" />
          ) : businessName ? (
            <h2 className="text-lg font-bold tracking-wider opacity-90 mb-1">{businessName}</h2>
          ) : null}
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">{outlet?.name}</h1>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm opacity-90">
            {outlet?.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {outlet.address}{outlet.city ? `, ${outlet.city}` : ''}
              </span>
            )}
            {outlet?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {outlet.phone}
              </span>
            )}
            {outlet?.opening_hours && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {outlet.opening_hours}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Search & Category Filter */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selectedCategory === cat ? { backgroundColor: themeColor } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No menu items found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([category, items]) => (
            <section key={category} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex"
                  >
                    {item.image_url && (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-gray-50">
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base leading-tight">
                            {item.product_name}
                          </h3>
                          <span
                            className="font-bold text-sm sm:text-base shrink-0"
                            style={{ color: themeColor }}
                          >
                            KES {item.retail_price.toLocaleString()}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.current_stock <= 0 && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-full w-fit">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 py-3 text-center">
        <p className="text-xs text-gray-400">
          {businessName || 'Menu'} &middot; {outlet?.name}
          <br />
          <span className="text-[10px]">Prices may vary. Menu updated in real-time.</span>
        </p>
      </footer>
    </div>
  );
}
