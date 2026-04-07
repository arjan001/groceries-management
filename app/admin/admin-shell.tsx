'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { UserPermissionsProvider, useUserPermissions, getAllowedRoutes } from '@/lib/user-permissions';
import { Loader2, ShieldAlert, LogOut, Wrench, Database, RefreshCw } from 'lucide-react';

// Maintenance mode screen shown when admin panel is under maintenance
function MaintenanceScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="max-w-xl w-full text-center relative z-10">
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/10">
          {/* Animated icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Wrench size={40} className="text-white animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">System Maintenance</h1>
          <p className="text-blue-200 text-lg mb-8">Automatic maintenance & backup in progress{dots}</p>

          {/* Progress indicators */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-left bg-white/5 rounded-xl p-4 border border-white/10">
              <Database size={20} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Database Optimization</p>
                <p className="text-blue-300/70 text-xs">Running scheduled maintenance routines</p>
              </div>
              <RefreshCw size={16} className="text-blue-400 animate-spin" />
            </div>
            <div className="flex items-center gap-3 text-left bg-white/5 rounded-xl p-4 border border-white/10">
              <svg className="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Data Backup</p>
                <p className="text-blue-300/70 text-xs">Securing all records and system data</p>
              </div>
              <RefreshCw size={16} className="text-indigo-400 animate-spin" style={{ animationDuration: '2s' }} />
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
            <p className="text-amber-200 text-sm font-medium">
              The admin panel will be available again shortly. The customer-facing website remains fully operational.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-white/10 text-white font-semibold text-sm rounded-xl hover:bg-white/20 transition-colors border border-white/10"
          >
            <span className="flex items-center gap-2">
              <LogOut size={16} />
              Sign Out
            </span>
          </button>
        </div>
        <p className="text-xs text-blue-300/40 mt-6">SNACKOH Bakers Management System</p>
      </div>
    </div>
  );
}

// Impersonation banner shown when an admin is viewing the system as another user
function ImpersonationBanner() {
  const [impersonation, setImpersonation] = useState<{
    active: boolean;
    adminName: string;
    targetName: string;
    targetEmail: string;
  } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('impersonation');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.active) {
          setImpersonation(parsed);
        }
      }
    } catch {
      // sessionStorage not available
    }
  }, []);

  const handleEndImpersonation = async () => {
    try {
      sessionStorage.removeItem('impersonation');
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    window.close();
  };

  if (!impersonation) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm z-50">
      <div className="flex items-center gap-2">
        <ShieldAlert size={16} />
        <span className="font-semibold">Admin Impersonation Active</span>
        <span className="opacity-90">
          &mdash; Viewing as <strong>{impersonation.targetName}</strong>
          {impersonation.targetEmail && <span className="ml-1 opacity-75">({impersonation.targetEmail})</span>}
        </span>
        <span className="opacity-75 ml-2">
          Initiated by {impersonation.adminName}
        </span>
      </div>
      <button
        onClick={handleEndImpersonation}
        className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors"
      >
        <LogOut size={12} />
        End Impersonation
      </button>
    </div>
  );
}

// Heartbeat: periodically updates last_activity in the users table for online status tracking
function useActivityHeartbeat() {
  const updateActivity = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await supabase
          .from('users')
          .update({ last_activity: new Date().toISOString() })
          .eq('email', user.email);
      }
    } catch {
      // Silently fail - activity tracking is non-critical
    }
  }, []);

  useEffect(() => {
    // Update immediately on mount
    updateActivity();

    // Then every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [updateActivity]);
}

function AdminContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, permissions, role, loading: permsLoading, isOutletAdmin } = useUserPermissions();

  // Activity heartbeat for online status tracking
  useActivityHeartbeat();

  // Route guard based on permissions
  useEffect(() => {
    if (permsLoading) return;
    if (isAdmin) return; // admins can access everything

    const allowedRoutes = getAllowedRoutes(permissions, role, isAdmin, isOutletAdmin);
    if (allowedRoutes.length > 0) {
      const isAllowed = allowedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
      if (!isAllowed) {
        // Redirect to first allowed route or account page
        router.push(allowedRoutes[0] || '/admin/account');
      }
    } else if (!isAdmin) {
      // Non-admin user with no allowed routes — restrict to account only
      if (pathname !== '/admin/account') {
        router.push('/admin/account');
      }
    }
  }, [pathname, isAdmin, permissions, role, permsLoading, isOutletAdmin, router]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <ImpersonationBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthenticated(false);
        router.push('/auth/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthenticated(true);

        // Check if user is a super admin (no employee record = owner account)
        const email = session.user.email || '';
        const { data: emp } = await supabase
          .from('employees')
          .select('login_role')
          .eq('login_email', email)
          .single();

        const role = emp?.login_role || session.user.user_metadata?.role || '';
        const isAdmin = !emp || role === 'Admin' || role === 'Super Admin' || role === 'Administrator';
        setIsSuperAdmin(!emp); // No employee record = owner/super admin

        // Check maintenance mode from business_settings
        try {
          const { data: maint } = await supabase
            .from('business_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

          if (maint?.value && typeof maint.value === 'object' && (maint.value as Record<string, unknown>).enabled === true) {
            // Super admins (no employee record = owner) can bypass maintenance
            if (!isAdmin || emp) {
              setMaintenanceMode(true);
            }
          }
        } catch {
          // maintenance_mode setting may not exist — continue normally
        }
      } else {
        router.push('/auth/login');
        return;
      }
    } catch {
      router.push('/auth/login');
      return;
    }
    setChecking(false);
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-orange-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  // Show maintenance screen for non-super-admin users
  if (maintenanceMode && !isSuperAdmin) {
    return <MaintenanceScreen />;
  }

  return (
    <UserPermissionsProvider>
      <PwaInstallPrompt>
        <AdminContent>{children}</AdminContent>
      </PwaInstallPrompt>
    </UserPermissionsProvider>
  );
}
