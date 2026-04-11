'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Code, Key, ShoppingCart, Package, Users, BarChart3, Store,
  ChevronRight, ChevronDown, Copy, CheckCircle, Lock, Zap, Globe,
  Terminal, FileJson, Shield,
} from 'lucide-react';

const apiSections = [
  {
    icon: Key,
    title: 'Authentication',
    description: 'API keys, tokens, and authentication flows',
    endpoints: [
      { method: 'POST', path: '/api/v1/auth/login', description: 'Authenticate and get access token' },
      { method: 'POST', path: '/api/v1/auth/refresh', description: 'Refresh an expired access token' },
      { method: 'POST', path: '/api/v1/auth/logout', description: 'Invalidate current access token' },
    ],
  },
  {
    icon: Package,
    title: 'Products',
    description: 'Manage product catalog and categories',
    endpoints: [
      { method: 'GET', path: '/api/v1/products', description: 'List all products with pagination' },
      { method: 'GET', path: '/api/v1/products/:id', description: 'Get a single product by ID' },
      { method: 'POST', path: '/api/v1/products', description: 'Create a new product' },
      { method: 'PUT', path: '/api/v1/products/:id', description: 'Update a product' },
      { method: 'DELETE', path: '/api/v1/products/:id', description: 'Delete a product' },
      { method: 'GET', path: '/api/v1/categories', description: 'List all product categories' },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Orders & Sales',
    description: 'Order processing, sales records, and transactions',
    endpoints: [
      { method: 'GET', path: '/api/v1/orders', description: 'List all orders with filters' },
      { method: 'GET', path: '/api/v1/orders/:id', description: 'Get order details' },
      { method: 'POST', path: '/api/v1/orders', description: 'Create a new order' },
      { method: 'PUT', path: '/api/v1/orders/:id/status', description: 'Update order status' },
      { method: 'GET', path: '/api/v1/sales/summary', description: 'Get sales summary by period' },
    ],
  },
  {
    icon: Package,
    title: 'Inventory',
    description: 'Stock levels, adjustments, and alerts',
    endpoints: [
      { method: 'GET', path: '/api/v1/inventory', description: 'Get current stock levels' },
      { method: 'POST', path: '/api/v1/inventory/adjust', description: 'Adjust stock quantity' },
      { method: 'GET', path: '/api/v1/inventory/alerts', description: 'Get low stock alerts' },
      { method: 'POST', path: '/api/v1/inventory/transfer', description: 'Transfer stock between outlets' },
    ],
  },
  {
    icon: Users,
    title: 'Employees',
    description: 'Staff management, roles, and permissions',
    endpoints: [
      { method: 'GET', path: '/api/v1/employees', description: 'List all employees' },
      { method: 'POST', path: '/api/v1/employees', description: 'Add a new employee' },
      { method: 'PUT', path: '/api/v1/employees/:id', description: 'Update employee details' },
      { method: 'GET', path: '/api/v1/employees/:id/shifts', description: 'Get employee shift history' },
    ],
  },
  {
    icon: BarChart3,
    title: 'Reports',
    description: 'Analytics, reports, and business intelligence',
    endpoints: [
      { method: 'GET', path: '/api/v1/reports/sales', description: 'Sales report by date range' },
      { method: 'GET', path: '/api/v1/reports/inventory', description: 'Inventory valuation report' },
      { method: 'GET', path: '/api/v1/reports/profit-loss', description: 'Profit & loss statement' },
      { method: 'GET', path: '/api/v1/reports/dashboard', description: 'Dashboard summary data' },
    ],
  },
  {
    icon: Store,
    title: 'Outlets',
    description: 'Multi-outlet management and configuration',
    endpoints: [
      { method: 'GET', path: '/api/v1/outlets', description: 'List all outlets' },
      { method: 'GET', path: '/api/v1/outlets/:id', description: 'Get outlet details' },
      { method: 'POST', path: '/api/v1/outlets', description: 'Create a new outlet' },
      { method: 'PUT', path: '/api/v1/outlets/:id', description: 'Update outlet settings' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiDocsPage() {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const sampleCode = `curl -X GET https://api.snackoh-groceries.com/api/v1/products \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <Code size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">API Reference</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            API <span className="text-green-400">Documentation</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
            Integrate SNACKOH with your existing systems. Build custom workflows, sync data, and extend your grocery management platform.
          </p>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-12 sm:py-16 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl font-black text-gray-900 mb-6">Quick Start</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
            {[
              { icon: Key, title: 'Get API Key', desc: 'Generate your API key from the admin dashboard under Settings > API Access.' },
              { icon: Terminal, title: 'Make a Request', desc: 'Use the base URL and your API key to authenticate requests.' },
              { icon: FileJson, title: 'Parse Response', desc: 'All responses are returned in JSON format with standard HTTP status codes.' },
            ].map((item) => (
              <div key={item.title} className="p-5 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                  <item.icon size={18} className="text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Base URL & Sample */}
          <div className="bg-gray-950 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gray-900 border-b border-gray-800">
              <span className="text-xs text-gray-400 font-mono">Base URL: https://api.snackoh-groceries.com</span>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
                {copiedCode ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                {copiedCode ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 sm:p-5 text-sm text-green-400 font-mono overflow-x-auto">
              <code>{sampleCode}</code>
            </pre>
          </div>

          {/* Auth info */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Lock, title: 'Bearer Token Auth', desc: 'Pass your API key as a Bearer token in the Authorization header.' },
              { icon: Zap, title: 'Rate Limiting', desc: '1000 requests per minute for Professional plans. 100/min for Starter.' },
              { icon: Shield, title: 'HTTPS Only', desc: 'All API requests must be made over HTTPS. HTTP requests are rejected.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-3 p-4 bg-green-50 border border-green-100 rounded-xl">
                <item.icon size={16} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900 text-xs">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-xl font-black text-gray-900 mb-8">API Endpoints</h2>
          <div className="space-y-4">
            {apiSections.map((section, idx) => (
              <div key={section.title} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <section.icon size={18} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm">{section.title}</h3>
                    <p className="text-gray-500 text-xs">{section.description}</p>
                  </div>
                  <span className="text-xs text-gray-400 hidden sm:block">{section.endpoints.length} endpoints</span>
                  <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${expandedSection === idx ? 'rotate-180' : ''}`} />
                </button>
                {expandedSection === idx && (
                  <div className="border-t border-gray-50">
                    <div className="divide-y divide-gray-50">
                      {section.endpoints.map((endpoint) => (
                        <div key={endpoint.path} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${methodColors[endpoint.method]}`}>
                            {endpoint.method}
                          </span>
                          <code className="text-xs font-mono text-gray-700 truncate">{endpoint.path}</code>
                          <span className="text-xs text-gray-400 hidden sm:block ml-auto shrink-0">{endpoint.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDKs and Help */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Need Help?</h2>
            <p className="text-gray-500 text-sm">Get support with your API integration.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            <Link href="/help-center"
              className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-green-200 transition-all">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <Globe size={18} className="text-green-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Help Center</p>
                <p className="text-gray-500 text-xs">Guides and tutorials</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 ml-auto" />
            </Link>
            <Link href="/book-demo"
              className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-green-200 transition-all">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                <Zap size={18} className="text-green-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Book a Demo</p>
                <p className="text-gray-500 text-xs">See the API in action</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 ml-auto" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
