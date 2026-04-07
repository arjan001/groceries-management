'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { CartProvider, useCart } from '@/lib/cart-context';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Search, User, Heart, X, Plus, Minus, Menu, ChevronRight, ChevronLeft, Mail } from 'lucide-react';
import CookieConsent from '@/components/cookie-consent';

// ─── Marquee Announcement Bar ────────────────────────────────────────────────
function AnnouncementBar() {
  const [navbarAds, setNavbarAds] = useState<string[]>([]);

  useEffect(() => {
    async function loadNavbarAds() {
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'navbarAds')
          .single();
        if (!error && data?.value) {
          const config = data.value as { enabled?: boolean; items?: string[] };
          if (config.enabled && config.items && config.items.length > 0) {
            setNavbarAds(config.items.filter((i: string) => i.trim()));
            return;
          }
        }
      } catch { /* table may not exist */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.navbarAds?.enabled && parsed.navbarAds?.items?.length > 0) {
            setNavbarAds(parsed.navbarAds.items.filter((i: string) => i.trim()));
            return;
          }
        }
      } catch { /* ignore */ }
    }
    loadNavbarAds();
  }, []);

  const defaultItems = [
    'FREE DELIVERY ON ORDERS OVER KES 2,000',
    'FRESHLY BAKED DAILY',
    'ORDER BY 5PM FOR NEXT-DAY DELIVERY',
    'CUSTOM CAKES — ORDER 48 HRS IN ADVANCE',
    'WHOLESALE ORDERS AVAILABLE',
  ];

  const marqueeItems = navbarAds.length > 0 ? navbarAds : defaultItems;
  const marqueeText = marqueeItems.map(item => `  •  ${item}`).join('');

  return (
    <div className="bg-orange-600 text-white text-xs py-2.5 font-medium tracking-wide overflow-hidden whitespace-nowrap">
      <div className="inline-flex animate-marquee">
        <span className="inline-block">{marqueeText}{marqueeText}</span>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// ─── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const { itemCount, openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [businessName, setBusinessName] = useState('SNACKOH');
  const [logoHeight, setLogoHeight] = useState(40);
  const [logoPosition, setLogoPosition] = useState<'left' | 'center'>('left');
  const router = useRouter();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Load logo and business name from database/localStorage
  useEffect(() => {
    async function loadBranding() {
      try {
        const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'general').single();
        if (!error && data?.value) {
          const g = data.value as Record<string, string>;
          if (g.logoUrl) setLogoUrl(g.logoUrl);
          if (g.businessName) setBusinessName(g.businessName);
          if (g.logoHeight) setLogoHeight(parseInt(g.logoHeight as string) || 40);
          if (g.logoPosition) setLogoPosition(g.logoPosition as 'left' | 'center');
          return;
        }
      } catch { /* table may not exist */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.general?.logoUrl) setLogoUrl(parsed.general.logoUrl);
          if (parsed.general?.businessName) setBusinessName(parsed.general.businessName);
          if (parsed.general?.logoHeight) setLogoHeight(parseInt(parsed.general.logoHeight) || 40);
          if (parsed.general?.logoPosition) setLogoPosition(parsed.general.logoPosition);
        }
      } catch { /* ignore */ }
    }
    loadBranding();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { label: 'HOME', href: '/' },
    { label: 'SHOP', href: '/shop' },
    { label: 'ABOUT', href: '/about' },
    { label: 'CONTACT', href: '/contact' },
  ];

  const LogoElement = (
    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity overflow-hidden">
      {logoUrl ? (
        <img src={logoUrl} alt={businessName} style={{ height: `${logoHeight}px`, maxHeight: '3.25rem' }} className="w-auto object-contain rounded-lg" />
      ) : (
        <span className="text-2xl font-black tracking-tight text-gray-900 hover:text-orange-600 transition-colors">
          {businessName}
        </span>
      )}
    </Link>
  );

  // Split nav links into two halves for centered logo layout
  const midIndex = Math.ceil(navLinks.length / 2);
  const leftLinks = navLinks.slice(0, midIndex);
  const rightLinks = navLinks.slice(midIndex);

  return (
    <>
      <header className={`sticky top-0 z-40 bg-white transition-shadow ${scrolled ? 'shadow-md' : 'border-b border-gray-100'}`}>
        {logoPosition === 'center' ? (
          /* ── Centered Logo Layout ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            {/* Mobile menu button (left on mobile) */}
            <button className="md:hidden w-9 h-9 flex items-center justify-center" onClick={() => setMenuOpen(true)}>
              <Menu size={20} />
            </button>

            {/* Desktop: Left nav links */}
            <nav className="hidden md:flex items-center gap-6 flex-1 justify-end">
              {leftLinks.map(l => (
                <Link key={l.href} href={l.href}
                  className="text-xs font-bold tracking-widest text-gray-700 hover:text-orange-600 transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Center Logo */}
            <div className="mx-6 flex-shrink-0">
              {LogoElement}
            </div>

            {/* Desktop: Right nav links */}
            <nav className="hidden md:flex items-center gap-6 flex-1">
              {rightLinks.map(l => (
                <Link key={l.href} href={l.href}
                  className="text-xs font-bold tracking-widest text-gray-700 hover:text-orange-600 transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Icons */}
            <div className="flex items-center gap-1">
              <button onClick={() => setSearchOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <Search size={18} />
              </button>
              <Link href="/admin"
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700"
                title="Staff Admin">
                <User size={18} />
              </Link>
              <button
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <Heart size={18} />
              </button>
              <button onClick={openCart}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ── Default Left Logo Layout ── */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            {/* Logo */}
            {LogoElement}

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map(l => (
                <Link key={l.href} href={l.href}
                  className="text-xs font-bold tracking-widest text-gray-700 hover:text-orange-600 transition-colors">
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Icons */}
            <div className="flex items-center gap-1">
              <button onClick={() => setSearchOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <Search size={18} />
              </button>
              <Link href="/admin"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700"
                title="Staff Admin">
                <User size={18} />
              </Link>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <Heart size={18} />
              </button>
              <button onClick={openCart}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-700">
                <ShoppingBag size={18} />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </button>
              <button className="md:hidden ml-1 w-9 h-9 flex items-center justify-center" onClick={() => setMenuOpen(true)}>
                <Menu size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Search overlay */}
        {searchOpen && (
          <div className="absolute inset-0 bg-white z-50 flex items-center px-6" style={{ height: 64 }}>
            <form onSubmit={handleSearch} className="flex-1 flex items-center gap-3">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search breads, cakes, pastries…"
                className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400" />
              <button type="submit" className="text-xs font-bold text-orange-600 hover:underline">Search</button>
              <button type="button" onClick={() => setSearchOpen(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center">
              <span className="text-xl font-black">SNACKOH</span>
              <button onClick={() => setMenuOpen(false)}><X size={20} /></button>
            </div>
            <nav className="p-5 space-y-4">
              {navLinks.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between text-sm font-bold tracking-wider text-gray-800 hover:text-orange-600 py-2 border-b border-gray-50">
                  {l.label} <ChevronRight size={14} className="text-gray-400" />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Cart Drawer ─────────────────────────────────────────────────────────────
function CartDrawer() {
  const { items, removeItem, updateQty, total, isOpen, closeCart, itemCount } = useCart();
  const router = useRouter();
  const freeDeliveryThreshold = 2000;
  const remaining = Math.max(0, freeDeliveryThreshold - total);
  const progress = Math.min(100, (total / freeDeliveryThreshold) * 100);

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/40 z-50" onClick={closeCart} />}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-[400px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-base">Shopping Cart</h2>
          <button onClick={closeCart} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Free delivery bar */}
        <div className="px-5 py-3 border-b border-gray-50">
          {remaining > 0 ? (
            <p className="text-xs text-gray-600 mb-1.5">
              Buy <strong>KES {remaining.toLocaleString()}</strong> more to enjoy <strong>FREE delivery</strong>
            </p>
          ) : (
            <p className="text-xs text-green-700 font-semibold mb-1.5">You qualify for FREE delivery!</p>
          )}
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">Your cart is empty</p>
              <button onClick={() => { closeCart(); router.push('/shop'); }}
                className="mt-4 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-full hover:bg-orange-700">
                Start Shopping
              </button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-orange-600 font-bold mt-0.5">KES {item.price.toLocaleString()}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => updateQty(item.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <Minus size={10} />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <Plus size={10} />
                    </button>
                    <button onClick={() => removeItem(item.id)}
                      className="text-xs text-gray-400 hover:text-red-500 ml-2 underline">Remove</button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-800">KES {(item.price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}

        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-black text-gray-900 text-base">KES {total.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-400 text-center">Taxes and delivery calculated at checkout</p>
            <button onClick={() => { closeCart(); router.push('/checkout'); }}
              className="w-full py-3.5 bg-gray-900 text-white font-bold text-sm rounded-full hover:bg-gray-800 transition-colors">
              Check Out
            </button>
            <button onClick={() => { closeCart(); router.push('/cart'); }}
              className="w-full py-3 border-2 border-gray-200 text-gray-800 font-bold text-sm rounded-full hover:border-gray-400 transition-colors">
              View Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Newsletter Modal ────────────────────────────────────────────────────────
function NewsletterModal() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [config, setConfig] = useState({
    enabled: true,
    title: 'Subscribe Now',
    subtitle: 'Newsletter',
    description: 'Get 15% off your first order when you subscribe to our newsletter. Stay updated with exclusive offers and new arrivals.',
    image: '',
    discountCode: 'WELCOME15',
    delaySeconds: 5,
  });

  useEffect(() => {
    // Load config from DB or localStorage
    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('value')
          .eq('key', 'newsletterModal')
          .single();
        if (!error && data?.value) {
          setConfig(prev => ({ ...prev, ...(data.value as Record<string, unknown>) }));
          return;
        }
      } catch { /* ignore */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.newsletterModal) setConfig(prev => ({ ...prev, ...parsed.newsletterModal }));
        }
      } catch { /* ignore */ }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (!config.enabled) return;
    // Check if user has already dismissed
    const dismissed = localStorage.getItem('snackoh_newsletter_dismissed');
    if (dismissed === 'true') return;
    const alreadySubscribed = localStorage.getItem('snackoh_newsletter_subscribed');
    if (alreadySubscribed === 'true') return;

    const timer = setTimeout(() => {
      setShow(true);
    }, (config.delaySeconds || 5) * 1000);

    return () => clearTimeout(timer);
  }, [config.enabled, config.delaySeconds]);

  const handleSubscribe = async () => {
    if (!email || !email.includes('@')) return;
    setLoading(true);
    try {
      await supabase.from('newsletter_subscribers').insert({
        email,
        source: 'modal',
        discount_code: config.discountCode,
      });
    } catch {
      // Table may not exist, save locally
    }
    localStorage.setItem('snackoh_newsletter_subscribed', 'true');
    setSubmitted(true);
    setLoading(false);
  };

  const handleClose = () => {
    if (dontShow) {
      localStorage.setItem('snackoh_newsletter_dismissed', 'true');
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col sm:flex-row" onClick={e => e.stopPropagation()}>
        {/* Image side */}
        <div className="sm:w-1/2 h-56 sm:h-auto relative hidden sm:block bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600">
          {config.image && !imgError ? (
            <img src={config.image} alt="Newsletter" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90 mb-4">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <p className="text-xl font-black tracking-tight text-center">Stay In The Loop</p>
              <p className="text-sm opacity-80 mt-1 text-center">Fresh deals & baked goodness</p>
            </div>
          )}
        </div>
        {/* Content side */}
        <div className="sm:w-1/2 p-8 relative">
          <button onClick={handleClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
            <X size={16} />
          </button>

          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail size={20} className="text-green-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Thank You!</h3>
              <p className="text-sm text-gray-600 mb-3">You&apos;re now subscribed. Use code <strong className="text-orange-600">{config.discountCode}</strong> for your discount.</p>
              <button onClick={handleClose} className="px-5 py-2 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700">
                Start Shopping
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{config.subtitle}</p>
              <h3 className="text-2xl font-black text-gray-900 mb-3">{config.title}</h3>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">{config.description}</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    placeholder="Enter Your Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                  />
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={loading || !email}
                  className="w-full py-2.5 bg-orange-600 text-white font-bold text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Subscribing...' : 'Subscribe'}
                </button>
              </div>

              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)}
                  className="accent-gray-600 w-3.5 h-3.5" />
                <span className="text-xs text-gray-500">Don&apos;t show this popup again</span>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const [footerEmail, setFooterEmail] = useState('');
  const [footerSubscribed, setFooterSubscribed] = useState(false);

  const handleFooterSubscribe = async () => {
    if (!footerEmail || !footerEmail.includes('@')) return;
    try {
      await supabase.from('newsletter_subscribers').insert({
        email: footerEmail,
        source: 'footer',
      });
    } catch { /* table may not exist */ }
    localStorage.setItem('snackoh_newsletter_subscribed', 'true');
    setFooterSubscribed(true);
    setTimeout(() => setFooterSubscribed(false), 5000);
    setFooterEmail('');
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <h3 className="text-white text-2xl font-black mb-4">SNACKOH</h3>
            <p className="text-sm leading-relaxed text-gray-400 mb-4">
              Artisan baked goods crafted with love. From our oven to your table, fresh daily.
            </p>
            <p className="text-xs text-gray-500">Nairobi, Kenya</p>
            <p className="text-xs text-gray-500 mt-1">0733 67 52 67 (Orders)</p>
            <p className="text-xs text-gray-500 mt-1">0722 587 222 (Feedback)</p>
            <p className="text-xs text-gray-500 mt-1">sales@snackoh-bakers.com</p>
            <div className="flex gap-3 mt-4">
              <a href="https://www.instagram.com/snackohbites" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors" title="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@snackohbites" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors" title="TikTok">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.66a8.21 8.21 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.09z"/>
                </svg>
              </a>
              <a href="https://www.facebook.com/SnackohBites" target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-600 transition-colors" title="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* About */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">About Us</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {[
                { label: 'Our Story', href: '/about' },
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Cookie Policy', href: '/cookie-policy' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'Careers', href: '#' },
              ].map(l => (
                <li key={l.label}><Link href={l.href} className="hover:text-orange-400 transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Categories</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {['Breads', 'Pastries', 'Cakes', 'Cookies', 'Donuts', 'Custom Orders'].map(l => (
                <li key={l}><Link href="/shop" className="hover:text-orange-400 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-4">Let Us Help You</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              {[
                { label: 'Delivery Information', href: '#' },
                { label: 'Order Tracking', href: '#' },
                { label: 'FAQs', href: '#' },
                { label: 'Refund Policy', href: '/refund-policy' },
                { label: 'Custom Cakes', href: '#' },
              ].map(l => (
                <li key={l.label}><Link href={l.href} className="hover:text-orange-400 transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom newsletter + payments */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
              Get 10% Off
            </div>
            <span className="text-xs text-gray-500">Subscribe to our newsletter for the latest updates and offers</span>
          </div>
          <div className="flex gap-2">
            <input type="email" placeholder="Your email address" value={footerEmail}
              onChange={e => setFooterEmail(e.target.value)}
              className="px-4 py-2 bg-gray-800 text-white text-xs rounded-lg outline-none placeholder-gray-500 w-52 focus:ring-2 focus:ring-orange-500" />
            <button onClick={handleFooterSubscribe}
              className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700">
              {footerSubscribed ? 'SUBSCRIBED!' : 'SUBSCRIBE'}
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} Snackoh Bakers &middot; All rights reserved</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">We accept:</span>
            <img src="/visa-cards.png" alt="Visa & Mastercard" className="h-10 object-contain" />
            <img src="/mpesa.png" alt="M-Pesa" className="h-10 object-contain" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-4 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-2.5">
            <img src="/odpc-logo.png" alt="ODPC - Office of the Data Protection Commissioner" className="h-10 object-contain" />
            <span className="text-xs text-gray-400">ODPC Certified — Office of the Data Protection Commissioner</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pb-5 flex items-center justify-center">
          <p className="text-xs text-gray-600">
            Developed by{' '}
            <a href="http://oneplusafrica.com/" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 font-semibold transition-colors">
              OnePlusAfrica Tech Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────
export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer />
        <NewsletterModal />
        <CookieConsent />
      </div>
    </CartProvider>
  );
}
