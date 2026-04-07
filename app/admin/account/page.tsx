'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/modal';
import { Eye, EyeOff, Save, Upload, Shield, User, Lock, FileText, CheckCircle, Clock } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  idNumber: string;
  role: string;
  department: string;
  category: string;
  profilePhotoUrl: string;
  hireDate: string;
  status: string;
  employeeId: string;
}

interface Certificate {
  id: string;
  name: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function AccountSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'certificates'>('profile');
  const [profile, setProfile] = useState<UserProfile>({
    id: '', email: '', fullName: '', phone: '', address: '', idNumber: '', role: '',
    department: '', category: '', profilePhotoUrl: '', hireDate: '', status: '', employeeId: '',
  });
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [message, setMessage] = useState({ text: '', type: '' as 'success' | 'error' | '' });

  // Password change
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Certificate upload
  const [showCertModal, setShowCertModal] = useState(false);
  const [newCert, setNewCert] = useState({ name: '', number: '', issueDate: '', expiryDate: '' });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const meta = user.user_metadata || {};
      const email = user.email || '';

      // Try to find linked employee record by login_email
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('login_email', email)
        .single();

      let certs: Certificate[] = [];
      if (empData) {
        try {
          const rawCerts = empData.certificates;
          const parsed = typeof rawCerts === 'string' ? JSON.parse(rawCerts) : (rawCerts || []);
          certs = parsed.map((c: Record<string, unknown>) => ({
            id: (c.id || Date.now().toString()) as string,
            name: (c.name || '') as string,
            number: (c.number || '') as string,
            issueDate: (c.issueDate || c.issue_date || '') as string,
            expiryDate: (c.expiryDate || c.expiry_date || '') as string,
            status: (c.status || 'approved') as Certificate['status'],
          }));
        } catch { certs = []; }

        setProfile({
          id: user.id,
          email,
          fullName: `${empData.first_name || ''} ${empData.last_name || ''}`.trim() || meta.full_name || '',
          phone: empData.phone || '',
          address: empData.address || '',
          idNumber: empData.id_number || '',
          role: empData.role || meta.role || '',
          department: empData.department || '',
          category: empData.category || '',
          profilePhotoUrl: empData.profile_photo_url || '',
          hireDate: empData.hire_date || '',
          status: empData.status || 'Active',
          employeeId: empData.employee_id_number || '',
        });
      } else {
        setProfile({
          id: user.id,
          email,
          fullName: meta.full_name || email.split('@')[0] || '',
          phone: meta.phone || '',
          address: '',
          idNumber: '',
          role: meta.role || 'User',
          department: '',
          category: '',
          profilePhotoUrl: '',
          hireDate: '',
          status: 'Active',
          employeeId: '',
        });
      }
      setCertificates(certs);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Update Supabase Auth metadata
      await supabase.auth.updateUser({
        data: { full_name: profile.fullName, phone: profile.phone, role: profile.role },
      });

      // Update employee record if linked
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emp } = await supabase.from('employees').select('id').eq('login_email', user.email).single();
        if (emp) {
          const nameParts = profile.fullName.split(' ');
          await supabase.from('employees').update({
            first_name: nameParts[0] || '',
            last_name: nameParts.slice(1).join(' ') || '',
            phone: profile.phone,
            address: profile.address,
            id_number: profile.idNumber,
            profile_photo_url: profile.profilePhotoUrl,
          }).eq('id', emp.id);
        }
      }
      showMsg('Profile updated successfully', 'success');
    } catch {
      showMsg('Failed to update profile', 'error');
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMsg('New passwords do not match', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showMsg('Password must be at least 6 characters', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user found');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      });
      if (signInError) {
        showMsg('Current password is incorrect', 'error');
        setChangingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      showMsg('Password changed successfully', 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      showMsg('Failed to change password', 'error');
    }
    setChangingPassword(false);
  };

  const handleAddCertificate = async () => {
    if (!newCert.name || !newCert.number) return;
    const cert: Certificate = {
      id: Date.now().toString(),
      name: newCert.name,
      number: newCert.number,
      issueDate: newCert.issueDate,
      expiryDate: newCert.expiryDate,
      status: 'pending',
    };
    const updatedCerts = [...certificates, cert];
    setCertificates(updatedCerts);

    // Save to employee record
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emp } = await supabase.from('employees').select('id').eq('login_email', user.email).single();
        if (emp) {
          await supabase.from('employees').update({
            certificates: JSON.stringify(updatedCerts),
          }).eq('id', emp.id);
        }
      }
      showMsg('Certificate submitted for admin approval', 'success');
    } catch {
      showMsg('Failed to save certificate', 'error');
    }
    setNewCert({ name: '', number: '', issueDate: '', expiryDate: '' });
    setShowCertModal(false);
  };

  const initials = profile.fullName ? profile.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
        <p className="text-muted-foreground">Manage your personal information, password, and certificates</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-3 rounded-lg border text-sm font-medium ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Profile Header */}
      <div className="border border-border rounded-xl p-6 bg-card mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold overflow-hidden border-2 border-border">
            {profile.profilePhotoUrl ? (
              <img src={profile.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{profile.fullName || 'User'}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <div className="flex gap-2 mt-2">
              {profile.role && <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">{profile.role}</span>}
              {profile.department && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{profile.department}</span>}
              {profile.category && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">{profile.category}</span>}
              {profile.status && <span className={`px-2 py-0.5 rounded text-xs font-medium ${profile.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{profile.status}</span>}
            </div>
          </div>
          {profile.employeeId && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Employee ID</p>
              <p className="font-mono text-sm font-medium">{profile.employeeId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-2">
        {[
          { key: 'profile' as const, label: 'Profile', icon: User },
          { key: 'password' as const, label: 'Password', icon: Lock },
          { key: 'certificates' as const, label: 'Certificates', icon: FileText },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="border border-border rounded-xl p-6 bg-card space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={profile.fullName}
                onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-3 py-2 border border-border rounded-lg bg-secondary/50 text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={e => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="+254 7XX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">National ID Number</label>
              <input
                type="text"
                value={profile.idNumber}
                onChange={e => setProfile({ ...profile, idNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={e => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">Profile Photo URL</label>
              <input
                type="url"
                value={profile.profilePhotoUrl}
                onChange={e => setProfile({ ...profile, profilePhotoUrl: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          {profile.hireDate && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Member since: <span className="font-medium text-foreground">{new Date(profile.hireDate).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="border border-border rounded-xl p-6 bg-card">
          <div className="flex items-center gap-3 mb-5">
            <Shield size={20} className="text-primary" />
            <div>
              <h3 className="font-semibold">Change Password</h3>
              <p className="text-xs text-muted-foreground">Update your account password. Must be at least 6 characters.</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none pr-10"
                  required
                />
                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none pr-10"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                required
                minLength={6}
              />
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              <Lock size={16} />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}

      {/* Certificates Tab */}
      {activeTab === 'certificates' && (
        <div className="border border-border rounded-xl p-6 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-primary" />
              <div>
                <h3 className="font-semibold">Certificates &amp; Documents</h3>
                <p className="text-xs text-muted-foreground">Upload certificates for admin review and approval</p>
              </div>
            </div>
            <button
              onClick={() => setShowCertModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
            >
              <Upload size={14} />
              Add Certificate
            </button>
          </div>

          {certificates.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <FileText size={32} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No certificates uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Add Certificate&quot; to submit your documents</p>
            </div>
          ) : (
            <div className="space-y-2">
              {certificates.map(cert => (
                <div key={cert.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/20">
                  <div>
                    <p className="font-medium text-sm">{cert.name}</p>
                    <p className="text-xs text-muted-foreground">#{cert.number} &bull; Issued: {cert.issueDate || 'N/A'} &bull; Expires: {cert.expiryDate || 'N/A'}</p>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                    cert.status === 'approved' ? 'bg-green-100 text-green-800' :
                    cert.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {cert.status === 'approved' && <CheckCircle size={12} />}
                    {cert.status === 'pending' && <Clock size={12} />}
                    {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Certificate Modal */}
      <Modal isOpen={showCertModal} onClose={() => setShowCertModal(false)} title="Add Certificate" size="md">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Submit a new certificate for admin approval.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Certificate Name</label>
              <input
                type="text"
                value={newCert.name}
                onChange={e => setNewCert({ ...newCert, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="e.g. Food Hygiene Certificate"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Certificate Number</label>
              <input
                type="text"
                value={newCert.number}
                onChange={e => setNewCert({ ...newCert, number: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="CERT-XXXX"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Issue Date</label>
              <input
                type="date"
                value={newCert.issueDate}
                onChange={e => setNewCert({ ...newCert, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Expiry Date</label>
              <input
                type="date"
                value={newCert.expiryDate}
                onChange={e => setNewCert({ ...newCert, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button onClick={() => setShowCertModal(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            <button
              onClick={handleAddCertificate}
              disabled={!newCert.name || !newCert.number}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              Submit for Approval
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
