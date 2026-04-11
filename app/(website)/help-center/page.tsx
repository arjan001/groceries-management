'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search, ShoppingCart, Package, Users, CreditCard, BarChart3, Settings,
  ChevronRight, ChevronDown, HelpCircle, MessageSquare, Phone, Mail,
  Store, Truck, Shield, BookOpen,
} from 'lucide-react';

const categories = [
  {
    icon: ShoppingCart,
    title: 'POS & Sales',
    description: 'Point of sale, transactions, and payment processing',
    articles: [
      { title: 'How to process a sale using the POS system', id: 'pos-sale' },
      { title: 'Accepting M-Pesa payments', id: 'mpesa' },
      { title: 'Processing refunds and returns', id: 'refunds' },
      { title: 'Setting up cash, card, and credit payments', id: 'payment-methods' },
      { title: 'Using the POS in offline mode', id: 'offline-pos' },
    ],
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Stock tracking, reorder alerts, and supplier management',
    articles: [
      { title: 'Adding and managing products', id: 'add-products' },
      { title: 'Setting up stock reorder alerts', id: 'reorder-alerts' },
      { title: 'Managing product categories', id: 'categories' },
      { title: 'Importing products in bulk', id: 'bulk-import' },
      { title: 'Tracking expiry dates and waste', id: 'expiry-tracking' },
    ],
  },
  {
    icon: Users,
    title: 'Employee Management',
    description: 'Staff accounts, roles, shifts, and permissions',
    articles: [
      { title: 'Adding new employees', id: 'add-employee' },
      { title: 'Setting up roles and permissions', id: 'roles' },
      { title: 'Managing shift schedules', id: 'shifts' },
      { title: 'Employee performance tracking', id: 'performance' },
    ],
  },
  {
    icon: Store,
    title: 'Multi-Outlet Management',
    description: 'Managing multiple store locations',
    articles: [
      { title: 'Adding a new outlet', id: 'add-outlet' },
      { title: 'Transferring stock between outlets', id: 'stock-transfer' },
      { title: 'Unified reporting across outlets', id: 'multi-reports' },
      { title: 'Setting outlet-specific pricing', id: 'outlet-pricing' },
    ],
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Sales reports, profit analysis, and business insights',
    articles: [
      { title: 'Viewing sales reports and trends', id: 'sales-reports' },
      { title: 'Profit and loss analysis', id: 'profit-loss' },
      { title: 'Exporting reports to CSV or PDF', id: 'export-reports' },
      { title: 'Understanding the dashboard analytics', id: 'dashboard' },
    ],
  },
  {
    icon: Settings,
    title: 'Account & Settings',
    description: 'Account setup, billing, and system configuration',
    articles: [
      { title: 'Getting started with SNACKOH', id: 'getting-started' },
      { title: 'Updating your business profile', id: 'business-profile' },
      { title: 'Managing your subscription and billing', id: 'billing' },
      { title: 'Configuring tax and receipt settings', id: 'tax-receipts' },
      { title: 'Data backup and security', id: 'data-security' },
    ],
  },
];

const popularArticles = [
  { title: 'Getting started with SNACKOH', category: 'Account & Settings' },
  { title: 'How to process a sale using the POS system', category: 'POS & Sales' },
  { title: 'Accepting M-Pesa payments', category: 'POS & Sales' },
  { title: 'Adding and managing products', category: 'Inventory' },
  { title: 'Setting up roles and permissions', category: 'Employees' },
  { title: 'Viewing sales reports and trends', category: 'Reports' },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  const filteredCategories = searchQuery
    ? categories.map(cat => ({
        ...cat,
        articles: cat.articles.filter(a =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.articles.length > 0)
    : categories;

  return (
    <div className="bg-white">
      {/* Hero with Search */}
      <section className="bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <HelpCircle size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">Help Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            How Can We <span className="text-green-400">Help You?</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-8">
            Find answers, guides, and tutorials for the SNACKOH grocery management platform.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search for articles, guides, or topics..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none placeholder-gray-500"
            />
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      {!searchQuery && (
        <section className="py-12 sm:py-16 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
              <BookOpen size={18} className="text-green-600" /> Popular Articles
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {popularArticles.map((article) => (
                <div key={article.title}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-green-50 hover:border-green-200 border border-transparent transition-all cursor-pointer">
                  <ChevronRight size={14} className="text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{article.title}</p>
                    <p className="text-xs text-gray-500">{article.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-lg font-black text-gray-900 mb-8">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Browse by Category'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredCategories.map((cat, idx) => (
              <div key={cat.title} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === idx ? null : idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                    <cat.icon size={20} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{cat.title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{cat.description}</p>
                    <p className="text-green-600 text-xs font-semibold mt-2">{cat.articles.length} articles</p>
                  </div>
                  <ChevronDown size={18} className={`text-gray-400 shrink-0 mt-1 transition-transform ${expandedCategory === idx ? 'rotate-180' : ''}`} />
                </button>
                {expandedCategory === idx && (
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t border-gray-50">
                    <ul className="space-y-1 mt-3">
                      {cat.articles.map((article) => (
                        <li key={article.id}>
                          <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-green-50 transition-colors cursor-pointer">
                            <ChevronRight size={12} className="text-green-500 shrink-0" />
                            <span className="text-sm text-gray-700">{article.title}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredCategories.length === 0 && (
            <div className="text-center py-16">
              <HelpCircle size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No articles found for &quot;{searchQuery}&quot;</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search term or browse categories above.</p>
            </div>
          )}
        </div>
      </section>

      {/* Contact Support */}
      <section className="py-12 sm:py-16 bg-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Still Need Help?</h2>
            <p className="text-gray-500 text-sm">Our support team is ready to assist you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {[
              { icon: MessageSquare, label: 'Live Chat', desc: 'Chat with support', action: 'Start Chat' },
              { icon: Phone, label: 'Call Us', desc: '0733 67 52 67', action: 'Call Now' },
              { icon: Mail, label: 'Email Support', desc: 'support@snackoh-groceries.com', action: 'Send Email' },
            ].map((item) => (
              <div key={item.label}
                className="flex flex-col items-center p-6 bg-white border border-green-100 rounded-2xl text-center">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <item.icon size={20} className="text-green-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                <p className="text-gray-500 text-xs mt-1 mb-3">{item.desc}</p>
                <span className="text-green-600 text-xs font-bold">{item.action}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
