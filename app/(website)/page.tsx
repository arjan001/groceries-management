'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  BarChart3, ShoppingCart, Users, Package, TrendingUp, Shield,
  ChevronRight, ArrowRight, Check, Star, Play, Zap, Clock,
  Store, Truck, Receipt, PieChart, Bell, Smartphone,
  ChevronDown, Layers, Settings, CreditCard, Box,
  MonitorSmartphone, HeadphonesIcon, Globe,
} from 'lucide-react';

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedStat({ value, suffix = '', prefix = '' }: { value: string; suffix?: string; prefix?: string }) {
  return (
    <span className="tabular-nums">{prefix}{value}{suffix}</span>
  );
}

export default function HomePage() {
  const [activePricing, setActivePricing] = useState<'monthly' | 'annual'>('monthly');
  const [activeFeature, setActiveFeature] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: BarChart3,
      title: 'Real-Time Dashboard',
      description: 'Monitor sales, inventory, and expenses in real-time. Get instant insights into your grocery business performance with live analytics.',
    },
    {
      icon: ShoppingCart,
      title: 'POS System',
      description: 'Fast, reliable point-of-sale with M-Pesa, cash, and card payments. Process transactions seamlessly across all your outlets.',
    },
    {
      icon: Package,
      title: 'Inventory Management',
      description: 'Track stock levels, set reorder alerts, manage suppliers, and automate purchase orders. Never run out of best-selling items.',
    },
    {
      icon: Users,
      title: 'Employee Management',
      description: 'Manage staff shifts, roles, and permissions. Track performance and streamline payroll across multiple locations.',
    },
    {
      icon: TrendingUp,
      title: 'Sales & Reports',
      description: 'Generate detailed sales reports, profit analysis, and trend forecasts. Make data-driven decisions to grow your business.',
    },
    {
      icon: Store,
      title: 'Multi-Outlet Support',
      description: 'Manage multiple grocery stores from one dashboard. Centralized inventory, unified reporting, and outlet-level controls.',
    },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Sign Up & Configure',
      description: 'Create your account in minutes. Set up your store profile, add products, and configure your business settings.',
      icon: Settings,
    },
    {
      step: '02',
      title: 'Add Your Inventory',
      description: 'Import your product catalog or add items manually. Set prices, categories, stock levels, and supplier details.',
      icon: Box,
    },
    {
      step: '03',
      title: 'Start Selling',
      description: 'Use our POS system to process sales, accept payments, and manage your daily operations from anywhere.',
      icon: CreditCard,
    },
    {
      step: '04',
      title: 'Grow Your Business',
      description: 'Track performance with real-time analytics. Optimize inventory, reduce waste, and increase profitability.',
      icon: TrendingUp,
    },
  ];

  const testimonials = [
    {
      name: 'Grace Muthoni',
      role: 'Owner, FreshMart Groceries',
      review: 'SNACKOH transformed how we run our grocery store. The inventory tracking alone has saved us thousands in waste reduction. The real-time dashboard gives me full visibility even when I\'m away.',
      rating: 5,
      location: 'Nairobi',
    },
    {
      name: 'James Kiprop',
      role: 'Manager, GreenBasket Supermarket',
      review: 'Managing 3 outlets used to be a nightmare. With SNACKOH, I can track sales, inventory, and employees across all locations from one dashboard. The M-Pesa integration is seamless.',
      rating: 5,
      location: 'Eldoret',
    },
    {
      name: 'Amina Hassan',
      role: 'Director, QuickShop Chain',
      review: 'The POS system is incredibly fast and reliable. Our checkout times have decreased by 40%. The stock reorder alerts ensure we never run out of popular items.',
      rating: 5,
      location: 'Mombasa',
    },
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      description: 'Perfect for small grocery shops',
      monthly: 2500,
      annual: 2000,
      features: [
        '1 outlet',
        'Up to 500 products',
        'Basic POS system',
        'Sales reports',
        'M-Pesa integration',
        'Email support',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Growth',
      description: 'For growing grocery businesses',
      monthly: 5000,
      annual: 4000,
      features: [
        'Up to 3 outlets',
        'Unlimited products',
        'Advanced POS system',
        'Full inventory management',
        'Employee management',
        'Advanced analytics',
        'Stock reorder alerts',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Professional',
      description: 'For established grocery chains',
      monthly: 10000,
      annual: 8000,
      features: [
        'Up to 10 outlets',
        'Everything in Growth',
        'Multi-outlet dashboard',
        'Purchase order management',
        'Supplier management',
        'Custom reports & exports',
        'API access',
        'Dedicated account manager',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Enterprise',
      description: 'Custom solutions for large chains',
      monthly: null,
      annual: null,
      features: [
        'Unlimited outlets',
        'Everything in Professional',
        'White-label branding',
        'Custom integrations',
        'On-premise deployment option',
        'SLA guarantee',
        'Training & onboarding',
        'Custom development',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  const stats = [
    { value: '500', suffix: '+', label: 'Grocery Stores' },
    { value: '50K', suffix: '+', label: 'Products Tracked' },
    { value: '99.9', suffix: '%', label: 'Uptime' },
    { value: '2M', suffix: '+', prefix: 'KES ', label: 'Transactions Processed' },
  ];

  const faqs = [
    {
      question: 'How long does it take to set up SNACKOH?',
      answer: 'You can set up your store and start selling within 30 minutes. Our onboarding wizard guides you through adding products, setting up payments, and configuring your store. We also offer free onboarding assistance for Growth and above plans.',
    },
    {
      question: 'Does SNACKOH work offline?',
      answer: 'Yes! Our POS system includes an offline mode that stores transactions locally and syncs automatically when connectivity is restored. You\'ll never miss a sale due to internet issues.',
    },
    {
      question: 'Can I integrate M-Pesa and other payment methods?',
      answer: 'Absolutely. SNACKOH supports M-Pesa (Lipa Na M-Pesa), cash, card payments, and credit accounts. Payment reconciliation is automatic across all methods.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Your data is encrypted in transit and at rest. We use enterprise-grade security with regular backups, role-based access controls, and are ODPC (Office of the Data Protection Commissioner) compliant.',
    },
    {
      question: 'Can I manage multiple outlets from one account?',
      answer: 'Yes! Growth plans and above support multi-outlet management. You get centralized inventory, unified reporting, and the ability to manage each outlet independently or together.',
    },
    {
      question: 'What happens when my trial expires?',
      answer: 'Your 14-day free trial includes full access to all features. After the trial, you can choose a plan that fits your needs. Your data is preserved, and you can upgrade or downgrade at any time.',
    },
  ];

  return (
    <div className="bg-white">

      {/* ─── HERO SECTION ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-950">
        {/* Background gradient effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          {/* Trust Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-sm font-medium">Trusted by 500+ Grocery Stores in Kenya</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[1.1] mb-6 tracking-tight">
              Manage Your Grocery Store{' '}
              <span className="text-green-400">Like Never Before</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
              The all-in-one platform for inventory, sales, POS, employee management, and analytics.{' '}
              <strong className="text-gray-300">Built for Kenya.</strong>
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Manage from anywhere in the world.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/auth/register"
                className="px-8 py-4 bg-green-600 text-white font-bold text-sm rounded-full hover:bg-green-500 transition-all inline-flex items-center gap-2 shadow-lg shadow-green-600/25">
                Start Free Trial <ArrowRight size={16} />
              </Link>
              <button className="px-8 py-4 bg-gray-800 text-white font-bold text-sm rounded-full hover:bg-gray-700 transition-all inline-flex items-center gap-2 border border-gray-700">
                <Play size={16} className="fill-white" /> Watch Demo
              </button>
            </div>

            {/* Sub-trust */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> Free 14-day trial
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> No credit card required
              </span>
              <span className="flex items-center gap-2">
                <Check size={16} className="text-green-500" /> Cancel anytime
              </span>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-green-600/20 via-green-500/10 to-green-600/20 rounded-2xl blur-xl" />
            <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-gray-800 rounded-md text-xs text-gray-400 font-mono">
                    app.snackoh-groceries.com/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard content mockup */}
              <div className="p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                  {[
                    { label: 'Total Sales', value: 'KES 2.4M', change: '+12.5%', icon: TrendingUp, changeColor: 'text-green-400' },
                    { label: 'Net Profit', value: 'KES 840K', change: '+8.1%', icon: PieChart, changeColor: 'text-green-400' },
                    { label: 'Total Loss/Waste', value: 'KES 45K', change: '-3.2%', icon: Package, changeColor: 'text-red-400' },
                    { label: 'Active Products', value: '1,847', change: '+23', icon: Store, changeColor: 'text-green-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 md:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <stat.icon size={16} className="text-gray-500" />
                        <span className={`${stat.changeColor} text-xs font-semibold`}>{stat.change}</span>
                      </div>
                      <p className="text-white font-black text-base md:text-xl">{stat.value}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
                {/* Secondary stats row */}
                <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
                  {[
                    { label: 'Today\'s Revenue', value: 'KES 127K', icon: Receipt },
                    { label: 'Pending Orders', value: '24', icon: ShoppingCart },
                    { label: 'Active Outlets', value: '5', icon: Store },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-800/30 border border-gray-700/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon size={12} className="text-green-400" />
                        <p className="text-gray-500 text-xs">{stat.label}</p>
                      </div>
                      <p className="text-white font-bold text-sm md:text-base">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-bold text-sm">Recent Grocery Sales</h4>
                      <span className="text-green-400 text-xs font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
                      </span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { name: 'Fresh Vegetables Bundle', amount: 'KES 3,200', time: '2m ago', method: 'M-Pesa' },
                        { name: 'Rice 10kg + Cooking Oil', amount: 'KES 4,350', time: '8m ago', method: 'Cash' },
                        { name: 'Dairy & Bread Order', amount: 'KES 1,890', time: '15m ago', method: 'Card' },
                      ].map((sale, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700/30 last:border-0">
                          <div>
                            <p className="text-gray-300 text-xs sm:text-sm font-medium">{sale.name}</p>
                            <p className="text-gray-500 text-xs">{sale.method}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 font-bold text-xs sm:text-sm">{sale.amount}</p>
                            <p className="text-gray-500 text-xs">{sale.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-bold text-sm">Stock Alerts</h4>
                      <span className="text-amber-400 text-xs font-semibold">5 items low</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { item: 'Fresh Milk (500ml)', stock: 12, threshold: 20 },
                        { item: 'Maize Flour 2kg', stock: 5, threshold: 15 },
                        { item: 'Sugar (1kg)', stock: 8, threshold: 25 },
                      ].map((item, idx) => (
                        <div key={idx} className="py-2 border-b border-gray-700/30 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-gray-300 text-xs sm:text-sm font-medium">{item.item}</p>
                            <p className="text-amber-400 text-xs font-semibold">{item.stock} left</p>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(item.stock / item.threshold) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 left-6 md:left-10 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">99.9%</p>
                <p className="text-gray-400 text-xs">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ────────────────────────────────────────────────── */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-black text-gray-900">
                  <AnimatedStat value={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm text-green-600 font-bold tracking-widest uppercase mb-3">Powerful Features</p>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
              Everything You Need to Run{' '}
              <span className="text-green-600">Your Grocery Business</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              From inventory to analytics, SNACKOH gives you the tools to manage every aspect of your grocery store efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div key={idx}
                className="group p-8 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-lg hover:shadow-green-50 transition-all duration-300 bg-white"
                onMouseEnter={() => setActiveFeature(idx)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors ${activeFeature === idx ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600'}`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm text-green-600 font-bold tracking-widest uppercase mb-3">Simple Setup</p>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
              Get Started in <span className="text-green-600">4 Easy Steps</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Setting up your grocery management system takes minutes, not days.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, idx) => (
              <div key={idx} className="relative">
                {idx < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-green-300 to-transparent z-10" style={{ width: 'calc(100% - 3rem)' }} />
                )}
                <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow h-full">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-5">
                    <step.icon size={22} className="text-white" />
                  </div>
                  <span className="text-green-600 text-xs font-bold tracking-widest">STEP {step.step}</span>
                  <h3 className="text-lg font-bold text-gray-900 mt-2 mb-2">{step.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVICES / WHAT YOU GET ──────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm text-green-600 font-bold tracking-widest uppercase mb-3">Why SNACKOH?</p>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6">
                Built Specifically for{' '}
                <span className="text-green-600">Kenyan Grocery Stores</span>
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-8">
                Unlike generic retail software, SNACKOH is designed from the ground up for the Kenyan grocery market. From M-Pesa integration to local supplier management, every feature is tailored to how grocery businesses operate here.
              </p>

              <div className="space-y-5">
                {[
                  { icon: Smartphone, title: 'M-Pesa Native', desc: 'Seamless Lipa Na M-Pesa integration with automatic reconciliation' },
                  { icon: Globe, title: 'Works Offline', desc: 'POS continues working even without internet — syncs when reconnected' },
                  { icon: MonitorSmartphone, title: 'Access Anywhere', desc: 'Manage your store from any device — desktop, tablet, or phone' },
                  { icon: HeadphonesIcon, title: 'Local Support', desc: 'Dedicated Kenyan support team available via phone, WhatsApp, and email' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                      <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature showcase card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-green-50 rounded-3xl" />
              <div className="relative bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Inventory Overview</h3>
                  <p className="text-sm text-gray-500 mt-1">Real-time stock levels across all outlets</p>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { name: 'Fresh Vegetables', stock: 85, color: 'bg-green-500' },
                    { name: 'Dairy Products', stock: 62, color: 'bg-green-400' },
                    { name: 'Meat & Poultry', stock: 45, color: 'bg-amber-500' },
                    { name: 'Beverages', stock: 78, color: 'bg-green-500' },
                    { name: 'Pantry Staples', stock: 92, color: 'bg-green-600' },
                  ].map((item) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-gray-700 font-medium">{item.name}</span>
                        <span className="text-gray-500 text-xs">{item.stock}% stocked</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.stock}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 bg-green-50 border-t border-green-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">Total Products</p>
                      <p className="text-xs text-gray-500">Across all categories</p>
                    </div>
                    <p className="text-2xl font-black text-green-600">1,847</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING SECTION ──────────────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28 bg-gray-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm text-green-400 font-bold tracking-widest uppercase mb-3">Pricing Plans</p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              Choose the Plan That Fits{' '}
              <span className="text-green-400">Your Business</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Start free for 14 days. No credit card required. Upgrade as you grow.
            </p>

            {/* Toggle */}
            <div className="inline-flex bg-gray-800 rounded-full p-1">
              <button
                onClick={() => setActivePricing('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activePricing === 'monthly' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                Monthly
              </button>
              <button
                onClick={() => setActivePricing('annual')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activePricing === 'annual' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                Annual <span className="text-green-400 text-xs ml-1">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan) => (
              <div key={plan.name}
                className={`relative rounded-2xl p-6 ${plan.popular ? 'bg-gray-800 border-2 border-green-500 shadow-lg shadow-green-500/10' : 'bg-gray-900 border border-gray-800'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-green-600 text-white text-xs font-bold rounded-full">Most Popular</span>
                  </div>
                )}
                <div className="mb-6 pt-2">
                  <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
                </div>
                <div className="mb-6">
                  {plan.monthly ? (
                    <>
                      <span className="text-3xl font-black text-white">
                        KES {(activePricing === 'annual' ? plan.annual : plan.monthly)?.toLocaleString()}
                      </span>
                      <span className="text-gray-400 text-sm ml-1">per month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-black text-white">Custom</span>
                      <p className="text-gray-400 text-sm mt-1">Contact sales</p>
                    </>
                  )}
                </div>
                <Link href={plan.cta === 'Contact Sales' ? '/contact' : '/auth/register'}
                  className={`block w-full py-3 rounded-xl font-bold text-sm text-center transition-all mb-6 ${plan.popular ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'}`}>
                  {plan.cta}
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-green-400 shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 md:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm text-green-600 font-bold tracking-widest uppercase mb-3">Testimonials</p>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
              Loved by Grocery Stores{' '}
              <span className="text-green-600">Across Kenya</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              See why hundreds of grocery businesses trust SNACKOH to run their operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-8 hover:shadow-lg transition-shadow">
                <div className="flex mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">&ldquo;{t.review}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-bold text-sm">{t.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role} &middot; {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ──────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm text-green-600 font-bold tracking-widest uppercase mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-base">
              Have a question? We&apos;ve got answers.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <span className="font-bold text-gray-900 text-sm">{faq.question}</span>
                  <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-500 text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BOOK A DEMO / CTA ────────────────────────────────────────── */}
      <section id="book-demo" className="py-20 md:py-28 bg-green-600 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/50 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-700/50 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            Ready to Transform Your Grocery Business?
          </h2>
          <p className="text-green-100 text-lg max-w-2xl mx-auto mb-10">
            Join 500+ grocery stores across Kenya that use SNACKOH to manage inventory, boost sales, and grow their business. Start your free trial today — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register"
              className="px-10 py-4 bg-white text-green-700 font-bold text-base rounded-full hover:bg-gray-100 transition-all inline-flex items-center gap-2 shadow-lg">
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <Link href="/book-demo"
              className="px-10 py-4 bg-green-700/50 text-white font-bold text-base rounded-full hover:bg-green-700 transition-all inline-flex items-center gap-2 border border-green-400/30">
              Book a Demo <Zap size={18} />
            </Link>
          </div>
          <p className="text-green-200/70 text-sm mt-6">
            14-day free trial &middot; No credit card required &middot; Full feature access
          </p>
        </div>
      </section>
    </div>
  );
}
