'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  loginRole: string;
  permissions: string[];
  systemAccess: boolean;
  department: string;
}

const DEFAULT_CATEGORIES = ['Dashboard', 'Recipes', 'Production', 'Orders', 'Employees', 'POS', 'Inventory', 'Admin', 'Delivery', 'Finance', 'Outlets', 'System', 'Reports'];

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mainSuperAdminId, setMainSuperAdminId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    // Identify the main super admin (first registered user) to hide from lists
    try {
      const { data: usersData } = await supabase.from('users').select('id').order('created_at', { ascending: true }).limit(1);
      if (usersData && usersData.length > 0) {
        setMainSuperAdminId(usersData[0].id as string);
      }
    } catch { /* users table may not exist */ }

    try {
      const { data } = await supabase
        .from('employees')
        .select('id, name, login_email, login_role, permissions, system_access, department')
        .order('name', { ascending: true });
      if (data) {
        setEmployees(data.map((e: Record<string, unknown>) => {
          let perms: string[] = [];
          try {
            perms = typeof e.permissions === 'string' ? JSON.parse(e.permissions as string) : (e.permissions as string[]) || [];
          } catch { perms = []; }
          return {
            id: e.id as string,
            name: (e.name || '') as string,
            email: (e.login_email || '') as string,
            loginRole: (e.login_role || '') as string,
            permissions: perms,
            systemAccess: e.system_access !== false,
            department: (e.department || '') as string,
          };
        }));
      }
    } catch { /* employees table may not exist */ }
  }, []);

  const fetchRoles = useCallback(async () => {
    const { data } = await supabase.from('roles').select('*').order('created_at', { ascending: true });
    if (data) {
      const { data: rp } = await supabase.from('role_permissions').select('*');
      const rpMap: Record<string, string[]> = {};
      (rp || []).forEach((r: Record<string, unknown>) => {
        const rid = r.role_id as string;
        if (!rpMap[rid]) rpMap[rid] = [];
        rpMap[rid].push(r.permission_id as string);
      });

      // Count employees per role
      const { data: empCounts } = await supabase.from('employees').select('login_role');
      const roleCountMap: Record<string, number> = {};
      (empCounts || []).forEach((e: Record<string, unknown>) => {
        const role = (e.login_role || '') as string;
        if (role) roleCountMap[role] = (roleCountMap[role] || 0) + 1;
      });

      setRoles(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        description: (r.description || '') as string,
        permissions: rpMap[r.id as string] || [],
        userCount: roleCountMap[(r.name || '') as string] || 0,
        createdAt: ((r.created_at || '') as string).split('T')[0],
      })));
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    const { data } = await supabase.from('permissions').select('*').order('category', { ascending: true });
    if (data) setPermissions(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, description: (r.description || '') as string, category: (r.category || '') as string, enabled: r.enabled !== false })));
  }, []);

  useEffect(() => { fetchRoles(); fetchPermissions(); fetchEmployees(); }, [fetchRoles, fetchPermissions, fetchEmployees]);

  const [activeTab, setActiveTab] = useState<'roles' | 'permissions' | 'users'>('roles');

  // Role form state
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '' });

  // Permission form state
  const [showPermForm, setShowPermForm] = useState(false);
  const [editingPermId, setEditingPermId] = useState<string | null>(null);
  const [permFormData, setPermFormData] = useState({ name: '', description: '', category: 'Dashboard', customCategory: '' });

  // User assignment state
  const [showUserAssign, setShowUserAssign] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);
  const [assignRole, setAssignRole] = useState('');
  const [assignPerms, setAssignPerms] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');

  // Category filter
  const [filterCategory, setFilterCategory] = useState('All');

  // ── Role CRUD ─────────────────────────────────────
  const handleAddRole = () => {
    setShowRoleForm(true);
    setEditingRoleId(null);
    setRoleFormData({ name: '', description: '' });
    setSelectedPermissions([]);
  };

  const handleEditRole = (role: Role) => {
    setRoleFormData({ name: role.name, description: role.description });
    setSelectedPermissions(role.permissions);
    setEditingRoleId(role.id);
    setShowRoleForm(true);
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoleId) {
        await supabase.from('roles').update({ name: roleFormData.name, description: roleFormData.description }).eq('id', editingRoleId);
        await supabase.from('role_permissions').delete().eq('role_id', editingRoleId);
        if (selectedPermissions.length > 0) await supabase.from('role_permissions').insert(selectedPermissions.map(pid => ({ role_id: editingRoleId, permission_id: pid })));
        logAudit({
          action: 'UPDATE',
          module: 'Roles & Permissions',
          record_id: editingRoleId,
          details: { name: roleFormData.name, description: roleFormData.description, permissions: selectedPermissions },
        });
      } else {
        const { data: created } = await supabase.from('roles').insert({ name: roleFormData.name, description: roleFormData.description }).select().single();
        if (created && selectedPermissions.length > 0) await supabase.from('role_permissions').insert(selectedPermissions.map(pid => ({ role_id: created.id, permission_id: pid })));
        if (created) {
          logAudit({
            action: 'CREATE',
            module: 'Roles & Permissions',
            record_id: created.id,
            details: { name: roleFormData.name, description: roleFormData.description, permissions: selectedPermissions },
          });
        }
      }
      await fetchRoles();
    } catch { /* fallback */ }
    setShowRoleForm(false);
  };

  const handleDeleteRole = async (id: string) => {
    if (confirm('Delete this role?')) {
      await supabase.from('role_permissions').delete().eq('role_id', id);
      await supabase.from('roles').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Roles & Permissions',
        record_id: id,
        details: { entity: 'role' },
      });
      setRoles(roles.filter(r => r.id !== id));
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId) ? prev.filter(p => p !== permissionId) : [...prev, permissionId]
    );
  };

  const selectAllPermissions = () => {
    setSelectedPermissions(permissions.map(p => p.id));
  };

  const clearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  // ── Permission CRUD ─────────────────────────────────────
  const handleAddPerm = () => {
    setShowPermForm(true);
    setEditingPermId(null);
    setPermFormData({ name: '', description: '', category: 'Dashboard', customCategory: '' });
  };

  const handleEditPerm = (perm: Permission) => {
    setPermFormData({
      name: perm.name,
      description: perm.description,
      category: DEFAULT_CATEGORIES.includes(perm.category) ? perm.category : 'custom',
      customCategory: DEFAULT_CATEGORIES.includes(perm.category) ? '' : perm.category,
    });
    setEditingPermId(perm.id);
    setShowPermForm(true);
  };

  const handleSubmitPerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const category = permFormData.category === 'custom' ? permFormData.customCategory : permFormData.category;
    try {
      if (editingPermId) {
        await supabase.from('permissions').update({ name: permFormData.name, description: permFormData.description, category }).eq('id', editingPermId);
        logAudit({
          action: 'UPDATE',
          module: 'Roles & Permissions',
          record_id: editingPermId,
          details: { name: permFormData.name, description: permFormData.description, category },
        });
      } else {
        await supabase.from('permissions').insert({ name: permFormData.name, description: permFormData.description, category, enabled: true });
        logAudit({
          action: 'CREATE',
          module: 'Roles & Permissions',
          record_id: '',
          details: { name: permFormData.name, description: permFormData.description, category },
        });
      }
      await fetchPermissions();
    } catch { /* fallback */ }
    setShowPermForm(false);
  };

  const handleDeletePerm = async (id: string) => {
    if (confirm('Delete this permission? It will be removed from all roles.')) {
      await supabase.from('role_permissions').delete().eq('permission_id', id);
      await supabase.from('permissions').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Roles & Permissions',
        record_id: id,
        details: { entity: 'permission' },
      });
      setPermissions(permissions.filter(p => p.id !== id));
      setRoles(roles.map(r => ({ ...r, permissions: r.permissions.filter(p => p !== id) })));
    }
  };

  const handleTogglePerm = async (id: string) => {
    const perm = permissions.find(p => p.id === id);
    if (perm) {
      await supabase.from('permissions').update({ enabled: !perm.enabled }).eq('id', id);
      setPermissions(permissions.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
    }
  };

  // ── User Assignment ─────────────────────────────────────
  const handleAssignUser = (emp: Employee) => {
    setAssigningEmployee(emp);
    setAssignRole(emp.loginRole);
    setAssignPerms(emp.permissions);
    setShowUserAssign(true);
  };

  const toggleAssignPerm = (permName: string) => {
    setAssignPerms(prev =>
      prev.includes(permName) ? prev.filter(p => p !== permName) : [...prev, permName]
    );
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEmployee) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          login_role: assignRole,
          permissions: JSON.stringify(assignPerms),
        })
        .eq('id', assigningEmployee.id);

      if (!error) {
        logAudit({
          action: 'ASSIGN',
          module: 'Roles & Permissions',
          record_id: assigningEmployee.id,
          details: {
            employee: assigningEmployee.name,
            email: assigningEmployee.email,
            role: assignRole,
            permissions: assignPerms,
            previousRole: assigningEmployee.loginRole,
          },
        });
        await fetchEmployees();
        await fetchRoles();
      }
    } catch { /* fallback */ }
    setShowUserAssign(false);
    setAssigningEmployee(null);
  };

  const handleToggleAccess = async (emp: Employee) => {
    const newAccess = !emp.systemAccess;
    const action = newAccess ? 'enable' : 'disable';
    if (!confirm(`${newAccess ? 'Enable' : 'Disable'} system access for ${emp.name}?`)) return;
    try {
      await supabase.from('employees').update({ system_access: newAccess }).eq('id', emp.id);
      logAudit({
        action: 'UPDATE',
        module: 'Roles & Permissions',
        record_id: emp.id,
        details: { employee: emp.name, action: `${action}_system_access` },
      });
      setEmployees(employees.map(e => e.id === emp.id ? { ...e, systemAccess: newAccess } : e));
    } catch { /* fallback */ }
  };

  // Get unique categories from permissions
  const allCategories = [...new Set(permissions.map(p => p.category))];
  const filteredPermissions = filterCategory === 'All' ? permissions : permissions.filter(p => p.category === filterCategory);

  // Group permissions by category for role form
  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  // Filter employees for Users tab
  const allEmployeeRoles = [...new Set(employees.map(e => e.loginRole).filter(Boolean))];
  const filteredEmployees = employees.filter(emp => {
    // Hide the main super admin (first registered user) from all views
    if (mainSuperAdminId && emp.id === mainSuperAdminId) return false;
    const matchesSearch = !userSearch || emp.name.toLowerCase().includes(userSearch.toLowerCase()) || emp.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'All' || emp.loginRole === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Permission name lookup helper
  const getPermName = (id: string) => permissions.find(p => p.id === id)?.name || id;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Roles & Permissions</h1>
        <p className="text-muted-foreground">Manage roles, permissions, and assign access to users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Roles</p>
          <p className="text-2xl font-bold">{roles.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Permissions</p>
          <p className="text-2xl font-bold">{permissions.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold">{allCategories.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Users with Access</p>
          <p className="text-2xl font-bold">{employees.filter(e => e.systemAccess && e.loginRole).length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'roles' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Roles ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'permissions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Permissions ({permissions.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
            activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          User Assignments ({employees.length})
        </button>
      </div>

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <>
          <div className="mb-6 flex justify-end">
            <button onClick={handleAddRole} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">+ Create Role</button>
          </div>

          {/* Role Form Modal */}
          <Modal isOpen={showRoleForm} onClose={() => setShowRoleForm(false)} title={editingRoleId ? 'Edit Role' : 'Create New Role'} size="lg">
            <form onSubmit={handleSubmitRole} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role Name</label>
                  <input type="text" placeholder="e.g. Supervisor" value={roleFormData.name} onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input type="text" placeholder="Brief description" value={roleFormData.description} onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
              </div>

              <div className="bg-secondary rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">Assign Permissions</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllPermissions} className="text-xs text-primary hover:underline">Select All</button>
                    <span className="text-xs text-muted-foreground">|</span>
                    <button type="button" onClick={clearAllPermissions} className="text-xs text-primary hover:underline">Clear All</button>
                  </div>
                </div>

                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                    <div className="space-y-1">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-background rounded cursor-pointer">
                          <input type="checkbox" checked={selectedPermissions.includes(perm.id)} onChange={() => togglePermission(perm.id)} className="w-4 h-4 rounded border-border accent-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{perm.name}</p>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">{selectedPermissions.length} of {permissions.length} permissions selected</div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => setShowRoleForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingRoleId ? 'Update' : 'Create'} Role</button>
              </div>
            </form>
          </Modal>

          {/* Roles Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Role Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">Permissions</th>
                  <th className="px-4 py-3 text-left font-semibold">Users</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No roles found</td></tr>
                ) : (
                  roles.map(role => (
                    <tr key={role.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-semibold">{role.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{role.description}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                            {role.permissions.length} permissions
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${role.userCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{role.createdAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEditRole(role)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium">Edit</button>
                          <button onClick={() => handleDeleteRole(role.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Permissions Tab ── */}
      {activeTab === 'permissions' && (
        <>
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="All">All Categories</option>
                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <button onClick={handleAddPerm} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">+ Create Permission</button>
          </div>

          {/* Permission Form Modal */}
          <Modal isOpen={showPermForm} onClose={() => setShowPermForm(false)} title={editingPermId ? 'Edit Permission' : 'Create New Permission'} size="md">
            <form onSubmit={handleSubmitPerm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Permission Name</label>
                <input type="text" placeholder="e.g. Manage Deliveries" value={permFormData.name} onChange={(e) => setPermFormData({...permFormData, name: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" placeholder="What this permission allows" value={permFormData.description} onChange={(e) => setPermFormData({...permFormData, description: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select value={permFormData.category} onChange={(e) => setPermFormData({...permFormData, category: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                  {DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  <option value="custom">+ Custom Category</option>
                </select>
              </div>
              {permFormData.category === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Custom Category Name</label>
                  <input type="text" placeholder="e.g. Reports" value={permFormData.customCategory} onChange={(e) => setPermFormData({...permFormData, customCategory: e.target.value})} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
                </div>
              )}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => setShowPermForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingPermId ? 'Update' : 'Create'} Permission</button>
              </div>
            </form>
          </Modal>

          {/* Permissions Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Permission</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-center font-semibold">Used By</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No permissions found</td></tr>
                ) : (
                  filteredPermissions.map(perm => (
                    <tr key={perm.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{perm.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{perm.description}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">{perm.category}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {roles.filter(r => r.permissions.includes(perm.id)).length} roles
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleTogglePerm(perm.id)}
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            perm.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {perm.enabled ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEditPerm(perm)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium">Edit</button>
                          <button onClick={() => handleDeletePerm(perm.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <>
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm w-64"
              />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="All">All Roles</option>
                {allEmployeeRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <p className="text-sm text-muted-foreground">{filteredEmployees.length} of {employees.length} employees</p>
          </div>

          {/* User Assignment Modal */}
          <Modal isOpen={showUserAssign} onClose={() => { setShowUserAssign(false); setAssigningEmployee(null); }} title={`Assign Role & Permissions — ${assigningEmployee?.name || ''}`} size="lg">
            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-3 mb-2">
                <p className="text-sm"><strong>Employee:</strong> {assigningEmployee?.name}</p>
                <p className="text-sm text-muted-foreground">{assigningEmployee?.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Login Role</label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">-- Select a role --</option>
                  <option value="Admin">Admin</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Administrator">Administrator</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                  <option value="Baker">Baker</option>
                  <option value="Cashier">Cashier</option>
                  <option value="POS Attendant">POS Attendant</option>
                  <option value="Sales">Sales</option>
                  <option value="Rider">Rider</option>
                  <option value="Driver">Driver</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This determines the employee&apos;s base access level. Admin/Super Admin/Administrator get full access.
                </p>
              </div>

              <div className="bg-secondary rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">Override Permissions (optional)</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAssignPerms(permissions.map(p => p.name))} className="text-xs text-primary hover:underline">Select All</button>
                    <span className="text-xs text-muted-foreground">|</span>
                    <button type="button" onClick={() => setAssignPerms([])} className="text-xs text-primary hover:underline">Clear All</button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  If permissions are set here, they override the role&apos;s default permissions. Leave empty to use role-based permissions.
                </p>

                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                    <div className="space-y-1">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-3 p-2 hover:bg-background rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignPerms.includes(perm.name)}
                            onChange={() => toggleAssignPerm(perm.name)}
                            className="w-4 h-4 rounded border-border accent-primary"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{perm.name}</p>
                            <p className="text-xs text-muted-foreground">{perm.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground">{assignPerms.length} permissions selected</div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowUserAssign(false); setAssigningEmployee(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">Save Assignment</button>
              </div>
            </form>
          </Modal>

          {/* Users Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Employee</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Permissions</th>
                  <th className="px-4 py-3 text-center font-semibold">System Access</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No employees found</td></tr>
                ) : (
                  filteredEmployees.map(emp => (
                    <tr key={emp.id} className={`border-b border-border hover:bg-secondary/50 transition-colors ${!emp.systemAccess ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold">{emp.name}</p>
                          {emp.department && <p className="text-xs text-muted-foreground">{emp.department}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{emp.email || '—'}</td>
                      <td className="px-4 py-3">
                        {emp.loginRole ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            emp.loginRole === 'Admin' || emp.loginRole === 'Super Admin' || emp.loginRole === 'Administrator'
                              ? 'bg-purple-100 text-purple-800'
                              : emp.loginRole === 'Rider' || emp.loginRole === 'Driver'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {emp.loginRole}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {emp.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {emp.permissions.slice(0, 3).map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                                {p}
                              </span>
                            ))}
                            {emp.permissions.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                                +{emp.permissions.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Role defaults</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleAccess(emp)}
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            emp.systemAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {emp.systemAccess ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleAssignUser(emp)}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                        >
                          Assign Role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
