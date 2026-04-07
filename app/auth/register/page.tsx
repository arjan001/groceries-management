'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [superAdminExists, setSuperAdminExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  async function checkSuperAdmin() {
    try {
      // Check if a super admin user already exists in the users table
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (!error && data && data.length > 0) {
        setSuperAdminExists(true);
      }
    } catch {
      // If table doesn't exist or error, allow registration
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create the Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role: 'Super Admin',
          },
        },
      });

      if (authError) throw authError;

      // 2. Get the Administrator role id
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'Administrator')
        .single();

      // 3. Insert into users table with super admin role
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user?.id,
        email: form.email,
        full_name: form.fullName,
        role_id: roleData?.id || null,
        is_active: true,
        last_login: new Date().toISOString(),
      });

      if (userError) throw userError;

      // 4. If we have the role, assign all permissions
      if (roleData?.id) {
        const { data: allPerms } = await supabase.from('permissions').select('id');
        if (allPerms && allPerms.length > 0) {
          const rolePermissions = allPerms.map(p => ({
            role_id: roleData.id,
            permission_id: p.id,
          }));
          await supabase.from('role_permissions').upsert(rolePermissions);
        }
      }

      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-orange-600" />
      </div>
    );
  }

  if (superAdminExists) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <Shield size={48} className="text-orange-600 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Registration Closed</h1>
          <p className="text-gray-500 text-sm mb-6">
            A super admin account has already been created. Registration is no longer available.
            Please log in with your existing credentials.
          </p>
          <Link href="/auth/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white font-bold text-sm rounded-full hover:bg-orange-700 transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Super Admin Created!</h1>
          <p className="text-gray-500 text-sm mb-4">
            Your account has been created with full permissions. Redirecting to login...
          </p>
          <Loader2 size={20} className="animate-spin text-orange-600 mx-auto" />
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
          <h1 className="text-xl font-bold text-gray-800 mt-4">Create Super Admin Account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up the initial administrator account with full system permissions.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
            <Shield size={18} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">
              This registration form is for the initial super admin setup only. After creating the account, this page will be locked.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
                placeholder="Enter your full name"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>

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
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Re-enter your password"
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-orange-600 text-white font-bold text-sm rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creating Account...
                </>
              ) : (
                <>
                  <Shield size={16} /> Create Super Admin
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-orange-600 hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
