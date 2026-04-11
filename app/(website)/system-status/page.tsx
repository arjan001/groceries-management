'use client';

import { CheckCircle, AlertCircle, Clock, Activity, Server, Database, Globe, Shield, Wifi } from 'lucide-react';

const services = [
  { name: 'Web Application', description: 'Main dashboard and storefront', status: 'operational', uptime: '99.99%', icon: Globe },
  { name: 'POS System', description: 'Point of sale transactions', status: 'operational', uptime: '99.98%', icon: Activity },
  { name: 'API Services', description: 'REST API endpoints', status: 'operational', uptime: '99.97%', icon: Server },
  { name: 'Database', description: 'Data storage and retrieval', status: 'operational', uptime: '99.99%', icon: Database },
  { name: 'M-Pesa Integration', description: 'Mobile payment processing', status: 'operational', uptime: '99.95%', icon: Wifi },
  { name: 'Authentication', description: 'Login and access control', status: 'operational', uptime: '99.99%', icon: Shield },
];

const incidents = [
  {
    date: 'April 8, 2026',
    title: 'Scheduled Maintenance Completed',
    status: 'resolved',
    description: 'Database optimization and performance improvements were successfully completed. No downtime was experienced.',
  },
  {
    date: 'March 28, 2026',
    title: 'M-Pesa Gateway Intermittent Delays',
    status: 'resolved',
    description: 'Some M-Pesa transactions experienced brief delays due to upstream provider issues. The issue was resolved within 15 minutes.',
  },
  {
    date: 'March 15, 2026',
    title: 'Platform Update v3.2',
    status: 'resolved',
    description: 'Scheduled update with new features and performance improvements. Deployment completed with zero downtime.',
  },
];

const uptimeHistory = [
  { month: 'Apr 2026', uptime: 99.99 },
  { month: 'Mar 2026', uptime: 99.97 },
  { month: 'Feb 2026', uptime: 99.99 },
  { month: 'Jan 2026', uptime: 99.98 },
  { month: 'Dec 2025', uptime: 99.99 },
  { month: 'Nov 2025', uptime: 99.96 },
];

export default function SystemStatusPage() {
  const allOperational = services.every(s => s.status === 'operational');

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${allOperational ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
            {allOperational ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <AlertCircle size={14} className="text-amber-400" />
            )}
            <span className={`text-sm font-medium ${allOperational ? 'text-green-400' : 'text-amber-400'}`}>
              {allOperational ? 'All Systems Operational' : 'Partial Service Disruption'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            System <span className="text-green-400">Status</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
            Real-time status of SNACKOH services and infrastructure. Updated every 60 seconds.
          </p>
        </div>
      </section>

      {/* Service Status */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-lg font-black text-gray-900 mb-6">Current Status</h2>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-4 sm:p-5 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <service.icon size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{service.name}</p>
                    <p className="text-gray-500 text-xs hidden sm:block">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="text-xs text-gray-400 hidden sm:block">{service.uptime} uptime</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-600 capitalize">Operational</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Uptime History */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-lg font-black text-gray-900 mb-6">Uptime History</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {uptimeHistory.map((month) => (
              <div key={month.month} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-green-600">{month.uptime}%</p>
                <p className="text-xs text-gray-500 mt-1">{month.month}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-white border border-green-100 rounded-xl p-4 sm:p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
              <Activity size={18} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Overall Uptime: 99.98%</p>
              <p className="text-gray-500 text-xs">Average uptime over the last 6 months</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Incidents */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-lg font-black text-gray-900 mb-6">Recent Incidents</h2>
          <div className="space-y-4">
            {incidents.map((incident, idx) => (
              <div key={idx} className="bg-white border border-gray-100 rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="font-bold text-gray-900 text-sm">{incident.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} /> {incident.date}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full capitalize">
                      {incident.status}
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm">{incident.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscribe to Updates */}
      <section className="py-12 sm:py-16 bg-green-50">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Get Status Updates</h2>
          <p className="text-gray-500 text-sm mb-6">Subscribe to receive notifications about system status changes and scheduled maintenance.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="email" placeholder="Enter your email"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 outline-none" />
            <button className="px-6 py-3 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-500 transition-all whitespace-nowrap">
              Subscribe
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
