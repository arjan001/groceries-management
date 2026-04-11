'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Users, CheckCircle, ArrowRight, Building2, Phone, Mail, Globe } from 'lucide-react';

export default function BookDemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
      });
      setSubmitted(true);
    } catch {
      // Handle error gracefully
    }
    setLoading(false);
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
            <Calendar size={14} className="text-green-400" />
            <span className="text-green-400 text-sm font-medium">Schedule a Personalized Demo</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            See SNACKOH <span className="text-green-400">In Action</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
            Get a personalized walkthrough of our grocery management platform. Our team will show you how SNACKOH can transform your business operations.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            {/* Left - Benefits */}
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-6">
                What You&apos;ll Get From the Demo
              </h2>
              <div className="space-y-5 mb-10">
                {[
                  { icon: Clock, title: '30-Minute Personalized Session', desc: 'A focused walkthrough tailored to your specific business needs and challenges.' },
                  { icon: Users, title: 'Expert Guidance', desc: 'Our product specialists will answer all your questions and show best practices.' },
                  { icon: Building2, title: 'Custom Setup Plan', desc: 'Get a migration roadmap and onboarding plan specific to your grocery business.' },
                  { icon: Globe, title: 'Live Platform Access', desc: 'See every feature in action — POS, inventory, analytics, and multi-outlet management.' },
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

              {/* Trust badges */}
              <div className="bg-green-50 rounded-2xl p-6">
                <p className="text-sm font-bold text-green-800 mb-3">Trusted by 500+ Grocery Stores</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { stat: '500+', label: 'Active Stores' },
                    { stat: '99.9%', label: 'Uptime SLA' },
                    { stat: '< 5 min', label: 'Avg. Response' },
                    { stat: '4.9/5', label: 'Customer Rating' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-xl font-black text-green-700">{s.stat}</p>
                      <p className="text-xs text-green-600">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="order-1 lg:order-2">
              {submitted ? (
                <div className="bg-white border border-green-200 rounded-2xl p-8 sm:p-10 text-center shadow-lg">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Demo Booked!</h3>
                  <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
                    Thank you for your interest. Our team will reach out within 24 hours to confirm your demo schedule.
                  </p>
                  <Link href="/"
                    className="inline-flex px-6 py-3 bg-green-600 text-white font-bold text-sm rounded-full hover:bg-green-500 transition-all items-center gap-2">
                    Back to Home <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-lg">
                  <h3 className="text-xl font-black text-gray-900 mb-1">Book Your Free Demo</h3>
                  <p className="text-gray-500 text-sm mb-6">Fill in your details and we&apos;ll schedule a personalized demo for you.</p>

                  <form name="book-demo" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={handleSubmit}>
                    <input type="hidden" name="form-name" value="book-demo" />
                    <p className="hidden">
                      <label>Don&apos;t fill this out: <input name="bot-field" /></label>
                    </p>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                          <input type="text" name="first-name" required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" placeholder="John" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
                          <input type="text" name="last-name" required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" placeholder="Doe" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Email <span className="text-red-500">*</span></label>
                        <input type="email" name="email" required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" placeholder="john@company.com" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                        <input type="tel" name="phone" required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" placeholder="+254 7XX XXX XXX" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Name <span className="text-red-500">*</span></label>
                        <input type="text" name="business-name" required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" placeholder="Your Grocery Store Name" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Number of Outlets</label>
                        <select name="outlets"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all bg-white">
                          <option value="">Select...</option>
                          <option value="1">1 outlet</option>
                          <option value="2-3">2-3 outlets</option>
                          <option value="4-10">4-10 outlets</option>
                          <option value="10+">10+ outlets</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Preferred Demo Date</label>
                        <input type="date" name="preferred-date"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message (Optional)</label>
                        <textarea name="message" rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none transition-all resize-none"
                          placeholder="Tell us about your current setup or any specific features you'd like to see..." />
                      </div>

                      <button type="submit" disabled={loading}
                        className="w-full py-3.5 bg-green-600 text-white font-bold text-sm rounded-xl hover:bg-green-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? 'Submitting...' : 'Book My Free Demo'}
                        {!loading && <ArrowRight size={16} />}
                      </button>

                      <p className="text-xs text-gray-400 text-center">
                        By submitting, you agree to our{' '}
                        <Link href="/privacy-policy" className="text-green-600 hover:underline">Privacy Policy</Link>.
                        We&apos;ll never share your information.
                      </p>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contact alternatives */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Prefer to Talk Directly?</h2>
            <p className="text-gray-500 text-sm">Reach our team through any of these channels.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {[
              { icon: Phone, label: 'Call Us', value: '0733 67 52 67', href: 'tel:0733675267' },
              { icon: Mail, label: 'Email Us', value: 'sales@snackoh-groceries.com', href: 'mailto:sales@snackoh-groceries.com' },
              { icon: Globe, label: 'Visit Our Shop', value: 'Browse Products', href: '/shop' },
            ].map((item) => (
              <a key={item.label} href={item.href}
                className="flex flex-col items-center p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-md hover:border-green-200 transition-all text-center">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                  <item.icon size={20} className="text-green-600" />
                </div>
                <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                <p className="text-green-600 text-xs mt-1">{item.value}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
