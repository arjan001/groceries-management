'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Recipes', href: '/recipes' },
    { label: 'Food Info', href: '/food-info' },
    { label: 'Production', href: '/production' },
    { label: 'Picking Lists', href: '/picking-lists' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Lot Tracking', href: '/lot-tracking' },
    { label: 'Waste Control', href: '/waste-control' },
    { label: 'Purchasing', href: '/purchasing' },
  ];

  return (
    <nav className="border-b-2 border-black bg-white">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="mr-8 border-2 border-black px-4 py-2 font-black text-black hover:bg-black hover:text-white">
          BAKERY
        </Link>
        <div className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border border-black px-4 py-2 text-sm font-bold transition-colors ${
                pathname === item.href
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
