'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { Lock, Eye, EyeOff, Loader2, ShieldOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [accountDeactivated, setAccountDeactivated] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAccountDeactivated(false);
    setSubmitting(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;

      if (data.user) {
        // Check if this user's account is active
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('is_active')
            .eq('id', data.user.id)
            .single();

          if (userData && userData.is_active === false) {
            // Sign the user out immediately — account is deactivated
            await supabase.auth.signOut();
            setAccountDeactivated(true);
            setSubmitting(false);
            return;
          }
        } catch {
          // users table may not have a record yet — allow login
        }

        // Also check employee system_access
        try {
          const { data: emp } = await supabase
            .from('employees')
            .select('system_access, status')
            .eq('login_email', data.user.email)
            .single();

          if (emp && (emp.system_access === false || emp.status === 'Inactive')) {
            await supabase.auth.signOut();
            setAccountDeactivated(true);
            setSubmitting(false);
            return;
          }
        } catch {
          // No employee record — allow login (likely owner/super admin)
        }

        // Ensure the user has a record in the users table (may be missing for employee accounts)
        const meta = data.user.user_metadata || {};
        try {
          await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              full_name: (meta.full_name as string) || data.user.email?.split('@')[0] || '',
              is_active: true,
              last_login: new Date().toISOString(),
            }, { onConflict: 'id' });
        } catch {
          // Non-critical: users table tracking should not block login
        }

        logAudit({
          action: 'LOGIN',
          module: 'Authentication',
          record_id: data.user.id,
          details: { email: data.user.email },
        });

        router.push('/admin');
        return;
      }

      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  // If account is deactivated, show a full-page friendly maintenance message
  if (accountDeactivated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="bg-white rounded-3xl shadow-xl p-10 border border-red-100">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <ShieldOff size={36} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">System Temporarily Unavailable</h1>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
              <p className="text-red-700 font-semibold text-sm leading-relaxed">
               Unable to Login Please try logging in again later.
              </p>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              If you believe this is an error, please contact your system administrator for assistance.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setAccountDeactivated(false); setForm({ email: '', password: '' }); }}
                className="px-6 py-2.5 bg-orange-600 text-white font-semibold text-sm rounded-xl hover:bg-orange-700 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="px-6 py-2.5 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back to Store
              </Link>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6">SNACKOH Bakers Management System</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black text-gray-900 hover:text-orange-600 transition-colors">
            SNACKOH
          </Link>
          <h1 className="text-xl font-bold text-gray-800 mt-4">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to access the admin dashboard.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="admin@snackoh.co.ke"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-orange-600 text-white font-bold text-sm rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  <Lock size={16} /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/" className="text-orange-600 hover:underline font-medium">Back to Store</Link>
        </p>
      </div>
    </div>
  );
}
