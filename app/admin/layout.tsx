import type { Metadata } from 'next';
import AdminShell from './admin-shell';

// PWA metadata — scoped to /admin only so the install prompt
// never appears on the public website.
export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
