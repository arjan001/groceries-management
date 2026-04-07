'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, Clock, MessageSquare, ShoppingBag } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-xs text-orange-400 font-bold tracking-widest uppercase mb-2">Get In Touch</p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Contact Us</h1>
          <p className="text-white/70 text-base max-w-lg mx-auto">
            We&apos;d love to hear from you. Whether you want to place an order, give feedback, or just say hello — reach out anytime.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Online Orders */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <ShoppingBag size={24} className="text-orange-600" />
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-2">Online Orders</h3>
              <p className="text-gray-500 text-sm mb-4">
                For placing orders, wholesale enquiries, and delivery information.
              </p>
              <a href="tel:0733675267" className="text-orange-600 font-bold text-lg hover:underline block mb-2">
                0733 67 52 67
              </a>
              <a href="mailto:sales@snackoh-bakers.com" className="text-gray-600 text-sm hover:text-orange-600 transition-colors">
                sales@snackoh-bakers.com
              </a>
            </div>

            {/* Complaints & Compliments */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <MessageSquare size={24} className="text-orange-600" />
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-2">Complaints & Compliments</h3>
              <p className="text-gray-500 text-sm mb-4">
                Your feedback helps us improve. Let us know how we&apos;re doing.
              </p>
              <a href="tel:0722587222" className="text-orange-600 font-bold text-lg hover:underline block mb-1">
                0722 587 222
              </a>
              <a href="tel:0799559434" className="text-orange-600 font-bold text-lg hover:underline block mb-2">
                0799 55 94 34
              </a>
              <a href="mailto:feedback@snackoh-bakers.com" className="text-gray-600 text-sm hover:text-orange-600 transition-colors">
                feedback@snackoh-bakers.com
              </a>
            </div>

            {/* Leadership */}
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Mail size={24} className="text-orange-600" />
              </div>
              <h3 className="font-black text-gray-900 text-lg mb-2">Leadership</h3>
              <p className="text-gray-500 text-sm mb-4">
                For partnerships, careers, media, or reaching out to leadership.
              </p>
              <a href="mailto:ceo@snackoh-bakers.com" className="text-gray-600 text-sm hover:text-orange-600 transition-colors block mb-1">
                ceo@snackoh-bakers.com
              </a>
              <a href="mailto:sales@snackoh-bakers.com" className="text-gray-600 text-sm hover:text-orange-600 transition-colors block">
                sales@snackoh-bakers.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* All Contact Details */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">All Contact Details</p>
            <h2 className="text-3xl font-black text-gray-900">How to Reach Us</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Phone Numbers */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Phone size={18} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900">Phone Numbers</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Online Orders</p>
                  <a href="tel:0733675267" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors">
                    0733 67 52 67
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Complaints & Compliments</p>
                  <a href="tel:0722587222" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors block">
                    0722 587 222
                  </a>
                  <a href="tel:0799559434" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors block mt-1">
                    0799 55 94 34
                  </a>
                </div>
              </div>
            </div>

            {/* Email Addresses */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Mail size={18} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900">Email Addresses</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Sales</p>
                  <a href="mailto:sales@snackoh-bakers.com" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors">
                    sales@snackoh-bakers.com
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Leadership</p>
                  <a href="mailto:ceo@snackoh-bakers.com" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors">
                    ceo@snackoh-bakers.com
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Feedback</p>
                  <a href="mailto:feedback@snackoh-bakers.com" className="text-gray-800 font-semibold hover:text-orange-600 transition-colors">
                    feedback@snackoh-bakers.com
                  </a>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <MapPin size={18} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900">Location</h3>
              </div>
              <p className="text-gray-700 font-semibold">Nairobi, Kenya</p>
              <p className="text-gray-500 text-sm mt-1">Visit us for fresh baked goods daily.</p>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Clock size={18} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900">Operating Hours</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Monday – Saturday</span>
                  <span className="text-gray-800 font-semibold">6:00 AM – 8:00 PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sunday</span>
                  <span className="text-gray-800 font-semibold">7:00 AM – 6:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-4">Ready to Order?</h2>
          <p className="text-gray-500 text-sm mb-8">
            Browse our full range of freshly baked goods and place your order online. Free delivery on orders over KES 2,000.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/shop"
              className="px-8 py-3.5 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors">
              Shop Now
            </Link>
            <a href="tel:0733675267"
              className="px-8 py-3.5 border-2 border-gray-200 text-gray-800 font-bold text-sm rounded-full hover:border-orange-400 hover:text-orange-600 transition-colors">
              Call to Order
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
