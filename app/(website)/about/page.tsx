import Link from 'next/link';
import { ChevronRight, Heart, Shield, Truck, Users } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative bg-gray-950 text-white py-20 md:py-28">
        <img
          src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=1400&q=80&fit=crop"
          alt="Bakery"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs text-orange-400 font-bold tracking-widest uppercase mb-3">About Snackoh Bakers</p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
            Baked with Love,<br />Served with Pride
          </h1>
          <p className="text-white/70 text-base max-w-2xl mx-auto leading-relaxed">
            We are a Nairobi-based artisan bakery committed to delivering fresh, high-quality baked goods to homes and businesses every single day.
          </p>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">What We Stand For</p>
            <h2 className="text-3xl font-black text-gray-900">Our Commitment</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Heart, title: 'Health First', desc: 'We use premium, health-conscious ingredients. No artificial preservatives — just wholesome goodness in every bite.' },
              { icon: Shield, title: 'Quality Guaranteed', desc: 'Strict quality control from ingredient selection to final product. Every item meets our exacting standards before it reaches you.' },
              { icon: Truck, title: 'Always Fresh', desc: 'Baked fresh daily and delivered to your doorstep. We never sell day-old products — freshness is our non-negotiable promise.' },
              { icon: Users, title: 'Customer Focused', desc: 'Whether you buy one loaf or a hundred, you receive the same care, attention, and premium quality.' },
            ].map(v => (
              <div key={v.title} className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <v.icon size={22} className="text-orange-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl overflow-hidden aspect-[3/4]">
                <img src="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&fit=crop" alt="Fresh breads" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-2xl overflow-hidden aspect-[3/4] mt-8">
                <img src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80&fit=crop" alt="Cakes" className="w-full h-full object-cover" />
              </div>
            </div>
            <div>
              <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-2">Our Story</p>
              <h2 className="text-3xl font-black text-gray-900 mb-6">From Our Oven to Your Table</h2>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                <p>
                  Snackoh Bakers was born out of a simple belief: everyone deserves access to fresh, high-quality baked goods made with care. What started as a small neighbourhood bakery has grown into a trusted name across Nairobi.
                </p>
                <p>
                  Our master bakers bring years of experience and a passion for perfection to everything we create. From classic white bread to elaborate celebration cakes, every product is crafted with the same unwavering commitment to quality.
                </p>
                <p>
                  We take pride in our health-conscious approach to baking. We carefully select our ingredients, prioritise natural and wholesome components, and maintain rigorous hygiene and safety standards throughout our production process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Retail & Wholesale */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs text-orange-600 font-bold tracking-widest uppercase mb-1">We Serve Everyone</p>
            <h2 className="text-3xl font-black text-gray-900">Retail &amp; Wholesale</h2>
            <p className="text-gray-500 mt-2 text-sm max-w-2xl mx-auto">
              Whether you&apos;re buying for your family or stocking your business, Snackoh Bakers has you covered with competitive pricing and consistent quality.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Retail */}
            <div className="p-8 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-3">Retail Customers</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                Walk into our store or order online for fresh breads, pastries, cakes, cookies, and more. We offer same-day delivery across Nairobi for orders placed before 5 PM. Enjoy free delivery on orders over KES 2,000.
              </p>
              <Link href="/shop"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-full hover:bg-gray-800 transition-colors">
                Shop Now <ChevronRight size={12} />
              </Link>
            </div>

            {/* Wholesale */}
            <div className="p-8 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-black text-gray-900 mb-3">Wholesale Partners</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                We proudly supply shops, supermarkets, restaurants, hotels, schools, event planners, and corporate clients. Get bulk pricing, dedicated account management, and reliable daily deliveries tailored to your business needs.
              </p>
              <Link href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-full hover:bg-orange-700 transition-colors">
                Contact Us for Wholesale <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black mb-4">Ready to Taste the Difference?</h2>
          <p className="text-white/70 text-sm mb-8 max-w-xl mx-auto">
            Browse our full range of freshly baked goods or get in touch for wholesale enquiries. We look forward to serving you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/shop"
              className="px-8 py-3.5 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors inline-flex items-center gap-2">
              Browse Our Shop <ChevronRight size={15} />
            </Link>
            <Link href="/contact"
              className="px-8 py-3.5 border-2 border-white/30 text-white font-bold text-sm rounded-full hover:border-orange-400 hover:text-orange-400 transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
