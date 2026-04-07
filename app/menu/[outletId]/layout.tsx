import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu',
  description: 'View our menu',
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
