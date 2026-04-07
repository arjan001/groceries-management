'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Store,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Shield,
  UserCheck,
  CalendarDays,
  Eye,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  category: string;
  status: string;
  hire_date: string;
  profile_photo_url: string;
  primary_outlet_id: string;
  primary_outlet_name: string;
}

interface OutletEmployee {
  id: string;
  outlet_id: string;
  employee_id: string;
  outlet_role: OutletRole;
  is_outlet_admin: boolean;
  permissions: string[];
  status: 'Active' | 'Inactive' | 'Transferred';
  assigned_date: string;
  notes: string;
  created_at: string;
  // Joined employee fields
  employee?: Employee;
}

type OutletRole = 'Admin' | 'Manager' | 'Cashier' | 'Barista' | 'Server' | 'Outlet Staff' | 'Staff';

// ─── Constants ──────────────────────────────────────────────────────────────

const OUTLET_ROLES: OutletRole[] = ['Admin', 'Manager', 'Cashier', 'Barista', 'Server', 'Outlet Staff', 'Staff'];
const STATUSES = ['Active', 'Inactive', 'Transferred'] as const;
const ITEMS_PER_PAGE = 10;

const PERMISSION_OPTIONS = [
  'POS Access',
  'Inventory Management',
  'View Reports',
  'Manage Products',
  'Process Returns',
  'Manage Waste',
];

const ROLE_BADGE_COLORS: Record<OutletRole, string> = {
  Admin: 'bg-purple-100 text-purple-800',
  Manager: 'bg-blue-100 text-blue-800',
  Cashier: 'bg-green-100 text-green-800',
  Barista: 'bg-amber-100 text-amber-800',
  Server: 'bg-teal-100 text-teal-800',
  'Outlet Staff': 'bg-indigo-100 text-indigo-800',
  Staff: 'bg-gray-100 text-gray-800',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-gray-100 text-gray-800',
  Transferred: 'bg-orange-100 text-orange-800',
};

// ─── Default Form Data ──────────────────────────────────────────────────────

const defaultAssignForm = {
  employee_id: '',
  outlet_role: 'Staff' as OutletRole,
  is_outlet_admin: false,
  permissions: [] as string[],
  notes: '',
};

const defaultEditForm = {
  outlet_role: 'Staff' as OutletRole,
  is_outlet_admin: false,
  permissions: [] as string[],
  status: 'Active' as 'Active' | 'Inactive' | 'Transferred',
  notes: '',
};

const defaultTransferForm = {
  target_outlet_id: '',
  outlet_role: 'Staff' as OutletRole,
  is_outlet_admin: false,
  permissions: [] as string[],
  notes: '',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OutletEmployeesPage() {
  // ─── Core State ─────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [outletEmployees, setOutletEmployees] = useState<OutletEmployee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Search, Filter ─────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Modals ─────────────────────────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState<string | null>(null);

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [assignForm, setAssignForm] = useState({ ...defaultAssignForm });
  const [editForm, setEditForm] = useState({ ...defaultEditForm });
  const [transferForm, setTransferForm] = useState({ ...defaultTransferForm });

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, code, outlet_type, is_main_branch, status')
        .eq('status', 'Active')
        .order('name', { ascending: true });

      if (error) {
        showToast('Failed to load outlets: ' + error.message, 'error');
        return;
      }

      const outletList = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        code: (r.code || '') as string,
        outlet_type: (r.outlet_type || 'retail') as string,
        is_main_branch: Boolean(r.is_main_branch),
        status: (r.status || 'Active') as string,
      }));

      setOutlets(outletList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load outlets: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOutletEmployees = useCallback(async () => {
    if (!selectedOutletId) {
      setOutletEmployees([]);
      return;
    }

    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('outlet_employees')
        .select('*')
        .eq('outlet_id', selectedOutletId)
        .order('created_at', { ascending: false });

      if (error) {
        showToast('Failed to load outlet employees: ' + error.message, 'error');
        return;
      }

      const assignments: OutletEmployee[] = (data || []).map((r: Record<string, unknown>) => {
        let parsedPermissions: string[] = [];
        if (r.permissions) {
          try {
            parsedPermissions = typeof r.permissions === 'string'
              ? JSON.parse(r.permissions as string)
              : Array.isArray(r.permissions) ? (r.permissions as string[]) : [];
          } catch { parsedPermissions = []; }
        }

        return {
          id: r.id as string,
          outlet_id: (r.outlet_id || '') as string,
          employee_id: (r.employee_id || '') as string,
          outlet_role: (r.outlet_role || 'Staff') as OutletRole,
          is_outlet_admin: Boolean(r.is_outlet_admin),
          permissions: parsedPermissions,
          status: (r.status || 'Active') as 'Active' | 'Inactive' | 'Transferred',
          assigned_date: (r.assigned_date || '') as string,
          notes: (r.notes || '') as string,
          created_at: (r.created_at || '') as string,
        };
      });

      // Fetch employee details for each assignment
      const employeeIds = assignments.map(a => a.employee_id).filter(Boolean);
      if (employeeIds.length > 0) {
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select('id, first_name, last_name, email, phone, department, role, category, status, hire_date, profile_photo_url, primary_outlet_id, primary_outlet_name')
          .in('id', employeeIds);

        if (!empError && empData) {
          const empMap: Record<string, Employee> = {};
          empData.forEach((e: Record<string, unknown>) => {
            empMap[e.id as string] = {
              id: e.id as string,
              first_name: (e.first_name || '') as string,
              last_name: (e.last_name || '') as string,
              email: (e.email || '') as string,
              phone: (e.phone || '') as string,
              department: (e.department || '') as string,
              role: (e.role || '') as string,
              category: (e.category || '') as string,
              status: (e.status || '') as string,
              hire_date: (e.hire_date || '') as string,
              profile_photo_url: (e.profile_photo_url || '') as string,
              primary_outlet_id: (e.primary_outlet_id || '') as string,
              primary_outlet_name: (e.primary_outlet_name || '') as string,
            };
          });
          assignments.forEach(a => {
            a.employee = empMap[a.employee_id];
          });
        }
      }

      setOutletEmployees(assignments);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load outlet employees: ' + msg, 'error');
    } finally {
      setLoadingEmployees(false);
    }
  }, [selectedOutletId]);

  const fetchAllEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, phone, department, role, category, status, hire_date, profile_photo_url, primary_outlet_id, primary_outlet_name')
        .eq('status', 'Active')
        .order('first_name', { ascending: true });

      if (error) {
        showToast('Failed to load employees: ' + error.message, 'error');
        return;
      }

      const empList = (data || []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        first_name: (e.first_name || '') as string,
        last_name: (e.last_name || '') as string,
        email: (e.email || '') as string,
        phone: (e.phone || '') as string,
        department: (e.department || '') as string,
        role: (e.role || '') as string,
        category: (e.category || '') as string,
        status: (e.status || '') as string,
        hire_date: (e.hire_date || '') as string,
        profile_photo_url: (e.profile_photo_url || '') as string,
        primary_outlet_id: (e.primary_outlet_id || '') as string,
        primary_outlet_name: (e.primary_outlet_name || '') as string,
      }));

      setAllEmployees(empList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast('Failed to load employees: ' + msg, 'error');
    }
  }, []);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchOutlets();
    fetchAllEmployees();
  }, [fetchOutlets, fetchAllEmployees]);

  // Auto-select first outlet once outlets are loaded
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  useEffect(() => {
    if (selectedOutletId) {
      fetchOutletEmployees();
      setCurrentPage(1);
      setSearchTerm('');
      setFilterRole('All');
      setFilterStatus('All');
    }
  }, [selectedOutletId, fetchOutletEmployees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterStatus]);

  // ─── Filtering & Pagination ───────────────────────────────────────────────

  const filteredEmployees = outletEmployees
    .filter(oe => {
      const matchesRole = filterRole === 'All' || oe.outlet_role === filterRole;
      const matchesStatus = filterStatus === 'All' || oe.status === filterStatus;
      if (!matchesRole || !matchesStatus) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const emp = oe.employee;
      if (!emp) return false;
      return (
        emp.first_name.toLowerCase().includes(term) ||
        emp.last_name.toLowerCase().includes(term) ||
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(term) ||
        emp.email.toLowerCase().includes(term) ||
        emp.phone.toLowerCase().includes(term)
      );
    });

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalStaff = outletEmployees.length;
  const activeStaff = outletEmployees.filter(oe => oe.status === 'Active').length;
  const adminCount = outletEmployees.filter(oe => oe.is_outlet_admin && oe.status === 'Active').length;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentAssignments = outletEmployees.filter(oe => {
    if (!oe.assigned_date) return false;
    return new Date(oe.assigned_date) >= thirtyDaysAgo;
  }).length;

  // ─── Available Employees (not already assigned to this outlet) ─────────────

  const assignedEmployeeIds = new Set(
    outletEmployees
      .filter(oe => oe.status !== 'Transferred')
      .map(oe => oe.employee_id)
  );

  const availableEmployees = allEmployees.filter(emp => !assignedEmployeeIds.has(emp.id));

  // ─── Form Helpers ─────────────────────────────────────────────────────────

  const resetAssignForm = () => {
    setAssignForm({ ...defaultAssignForm });
  };

  const openAssignModal = () => {
    resetAssignForm();
    setShowAssignModal(true);
  };

  const openEditModal = (oe: OutletEmployee) => {
    setEditForm({
      outlet_role: oe.outlet_role,
      is_outlet_admin: oe.is_outlet_admin,
      permissions: [...oe.permissions],
      status: oe.status,
      notes: oe.notes,
    });
    setShowEditModal(oe.id);
  };

  const openTransferModal = (oe: OutletEmployee) => {
    setTransferForm({
      target_outlet_id: '',
      outlet_role: oe.outlet_role,
      is_outlet_admin: false,
      permissions: [...oe.permissions],
      notes: '',
    });
    setShowTransferModal(oe.id);
  };

  // ─── CRUD Operations ─────────────────────────────────────────────────────

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!assignForm.employee_id) {
      showToast('Please select an employee', 'error');
      return;
    }

    if (!selectedOutletId) {
      showToast('Please select an outlet first', 'error');
      return;
    }

    setSaving(true);

    try {
      // Check if there's an existing inactive/transferred record for this employee at this outlet
      const { data: existingRecords } = await supabase
        .from('outlet_employees')
        .select('id, status')
        .eq('outlet_id', selectedOutletId)
        .eq('employee_id', assignForm.employee_id);

      const existingInactive = existingRecords?.find(
        (r: Record<string, unknown>) => r.status === 'Inactive' || r.status === 'Transferred'
      );
      const existingActive = existingRecords?.find(
        (r: Record<string, unknown>) => r.status === 'Active'
      );

      if (existingActive) {
        showToast('This employee is already actively assigned to this outlet', 'error');
        setSaving(false);
        return;
      }

      if (existingInactive) {
        // Reactivate the existing record instead of inserting a new one
        const updateRow = {
          outlet_role: assignForm.outlet_role,
          is_outlet_admin: assignForm.is_outlet_admin,
          permissions: assignForm.permissions,
          status: 'Active',
          assigned_date: new Date().toISOString().split('T')[0],
          notes: assignForm.notes.trim() || 'Reassigned to outlet',
        };

        const { error } = await supabase
          .from('outlet_employees')
          .update(updateRow)
          .eq('id', existingInactive.id as string);
        if (error) throw error;
      } else {
        // Insert new assignment
        const row = {
          outlet_id: selectedOutletId,
          employee_id: assignForm.employee_id,
          outlet_role: assignForm.outlet_role,
          is_outlet_admin: assignForm.is_outlet_admin,
          permissions: assignForm.permissions,
          status: 'Active',
          assigned_date: new Date().toISOString().split('T')[0],
          notes: assignForm.notes.trim() || null,
        };

        const { error } = await supabase.from('outlet_employees').insert(row);
        if (error) throw error;
      }

      // Also update the employee's primary_outlet_id for easier POS resolution
      const emp = allEmployees.find(e => e.id === assignForm.employee_id);
      if (emp && !emp.primary_outlet_id) {
        const selectedOutlet = outlets.find(o => o.id === selectedOutletId);
        await supabase
          .from('employees')
          .update({
            primary_outlet_id: selectedOutletId,
            primary_outlet_name: selectedOutlet?.name || '',
          })
          .eq('id', assignForm.employee_id);
      }

      logAudit({
        action: 'CREATE',
        module: 'Outlet Employees',
        record_id: assignForm.employee_id,
        details: {
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : assignForm.employee_id,
          outlet_id: selectedOutletId,
          outlet_role: assignForm.outlet_role,
        },
      });

      showToast('Employee assigned successfully', 'success');
      await fetchOutletEmployees();
      resetAssignForm();
      setShowAssignModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        showToast('This employee is already assigned to this outlet. Try editing their existing assignment instead.', 'error');
      } else {
        showToast(`Failed to assign employee: ${msg}`, 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showEditModal) return;

    setSaving(true);

    try {
      const row = {
        outlet_role: editForm.outlet_role,
        is_outlet_admin: editForm.is_outlet_admin,
        permissions: editForm.permissions,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
      };

      const { data, error } = await supabase
        .from('outlet_employees')
        .update(row)
        .eq('id', showEditModal)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update failed — no rows were changed. The record may be protected by database policies.');
      }

      const oe = outletEmployees.find(o => o.id === showEditModal);
      logAudit({
        action: 'UPDATE',
        module: 'Outlet Employees',
        record_id: showEditModal,
        details: {
          employee_name: oe?.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : showEditModal,
          outlet_id: selectedOutletId,
          outlet_role: editForm.outlet_role,
          status: editForm.status,
        },
      });

      showToast('Assignment updated successfully', 'success');
      await fetchOutletEmployees();
      setShowEditModal(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to update assignment: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('outlet_employees')
        .update({ status: 'Inactive' })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Update failed — no rows were changed. The record may be protected by database policies.');
      }

      const oe = outletEmployees.find(o => o.id === id);
      logAudit({
        action: 'UPDATE',
        module: 'Outlet Employees',
        record_id: id,
        details: {
          action_type: 'remove_from_outlet',
          employee_name: oe?.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : id,
          outlet_id: selectedOutletId,
        },
      });

      showToast('Employee removed from outlet', 'success');
      await fetchOutletEmployees();
      setShowRemoveConfirm(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to remove employee: ${msg}`, 'error');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showTransferModal || !transferForm.target_outlet_id) {
      showToast('Please select a target outlet', 'error');
      return;
    }

    if (transferForm.target_outlet_id === selectedOutletId) {
      showToast('Cannot transfer to the same outlet', 'error');
      return;
    }

    setSaving(true);

    try {
      const oe = outletEmployees.find(o => o.id === showTransferModal);
      if (!oe) throw new Error('Assignment not found');

      // Mark old assignment as Transferred
      const { data: transferData, error: updateError } = await supabase
        .from('outlet_employees')
        .update({ status: 'Transferred' })
        .eq('id', showTransferModal)
        .select();
      if (updateError) throw updateError;
      if (!transferData || transferData.length === 0) {
        throw new Error('Transfer failed — could not update the old assignment. The record may be protected by database policies.');
      }

      // Create new assignment at target outlet
      const newRow = {
        outlet_id: transferForm.target_outlet_id,
        employee_id: oe.employee_id,
        outlet_role: transferForm.outlet_role,
        is_outlet_admin: transferForm.is_outlet_admin,
        permissions: transferForm.permissions,
        status: 'Active',
        assigned_date: new Date().toISOString().split('T')[0],
        notes: transferForm.notes.trim() || `Transferred from ${getSelectedOutlet()?.name || 'previous outlet'}`,
      };

      const { error: insertError } = await supabase.from('outlet_employees').insert(newRow);
      if (insertError) throw insertError;

      const targetOutlet = outlets.find(o => o.id === transferForm.target_outlet_id);
      logAudit({
        action: 'UPDATE',
        module: 'Outlet Employees',
        record_id: oe.employee_id,
        details: {
          action_type: 'transfer',
          employee_name: oe.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : oe.employee_id,
          from_outlet_id: selectedOutletId,
          to_outlet_id: transferForm.target_outlet_id,
          to_outlet_name: targetOutlet?.name || '',
          new_role: transferForm.outlet_role,
        },
      });

      showToast(`Employee transferred to ${targetOutlet?.name || 'new outlet'}`, 'success');
      await fetchOutletEmployees();
      setShowTransferModal(null);
      setTransferForm({ ...defaultTransferForm });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Transfer failed: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getSelectedOutlet = (): Outlet | undefined => {
    return outlets.find(o => o.id === selectedOutletId);
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getOutletEmployee = (id: string): OutletEmployee | undefined => {
    return outletEmployees.find(oe => oe.id === id);
  };

  const togglePermission = (
    perm: string,
    current: string[],
    setter: (perms: string[]) => void
  ) => {
    if (current.includes(perm)) {
      setter(current.filter(p => p !== perm));
    } else {
      setter([...current, perm]);
    }
  };

  // ─── Permission Checkboxes Renderer ─────────────────────────────────────────

  const renderPermissionCheckboxes = (
    currentPermissions: string[],
    onToggle: (perm: string) => void
  ) => (
    <div className="grid grid-cols-2 gap-2">
      {PERMISSION_OPTIONS.map(perm => (
        <label
          key={perm}
          className="flex items-center gap-2 p-2 border border-border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors text-sm"
        >
          <input
            type="checkbox"
            checked={currentPermissions.includes(perm)}
            onChange={() => onToggle(perm)}
            className="rounded border-border"
          />
          {perm}
        </label>
      ))}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading outlets...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Users size={28} className="text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Branch Employees</h1>
            </div>
            <p className="text-muted-foreground">
              Manage employee assignments, roles, and permissions for each branch/outlet.
            </p>
          </div>
          {selectedOutletId && outlets.length > 0 && (
            <button
              onClick={openAssignModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              <Plus size={16} /> Assign Employee
            </button>
          )}
        </div>
      </div>

      {/* Outlet Selector */}
      <div className="mb-6 p-4 border border-border rounded-lg bg-secondary/30">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-muted-foreground" />
            <label className="text-sm font-semibold text-foreground">Select Branch:</label>
          </div>
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm min-w-[250px]"
          >
            {outlets.length === 0 && <option value="">No outlets available</option>}
            {outlets.map(outlet => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name} {outlet.code ? `(${outlet.code})` : ''} &mdash; {outlet.outlet_type.replace('_', ' ')}
              </option>
            ))}
          </select>
          {getSelectedOutlet() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  getSelectedOutlet()?.outlet_type === 'coffee_shop'
                    ? 'bg-amber-100 text-amber-800'
                    : getSelectedOutlet()?.outlet_type === 'restaurant'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {getSelectedOutlet()?.outlet_type?.replace('_', ' ')}
              </span>
              {getSelectedOutlet()?.is_main_branch && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                  Main Branch
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                {getSelectedOutlet()?.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* No Outlets Message */}
      {outlets.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Store size={48} className="mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Outlets Found</h3>
          <p className="text-muted-foreground text-sm">
            There are no active outlets configured. Please add outlets in the Outlet Management section first.
          </p>
        </div>
      )}

      {/* Main Content */}
      {selectedOutletId && outlets.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Staff</p>
                  <p className="text-2xl font-bold text-foreground">{totalStaff}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Staff</p>
                  <p className="text-2xl font-bold text-green-600">{activeStaff}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Shield size={20} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold text-purple-600">{adminCount}</p>
                </div>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <CalendarDays size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recent Assignments</p>
                  <p className="text-2xl font-bold text-amber-600">{recentAssignments}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search / Filter Bar */}
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Roles</option>
                {OUTLET_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-medium text-sm"
              >
                <option value="All">All Statuses</option>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => fetchOutletEmployees()}
              className="p-2 border border-border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Employee Table */}
          {loadingEmployees ? (
            <div className="flex items-center justify-center py-16 border border-border rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Loading employees...</p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Users size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {outletEmployees.length === 0
                  ? 'No Employees Assigned'
                  : 'No Employees Match Your Filters'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {outletEmployees.length === 0
                  ? `Assign your first employee to ${getSelectedOutlet()?.name || 'this outlet'}.`
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {outletEmployees.length === 0 && (
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
                >
                  <Plus size={16} /> Assign First Employee
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Employee Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Email</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold">Outlet Role</th>
                      <th className="px-4 py-3 text-center font-semibold">Admin?</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Assigned Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployees.map(oe => {
                      const emp = oe.employee;
                      return (
                        <tr
                          key={oe.id}
                          className={`border-b border-border hover:bg-secondary/50 transition-colors ${
                            oe.status === 'Inactive' ? 'opacity-60' : ''
                          } ${oe.status === 'Transferred' ? 'opacity-50 bg-orange-50/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0 overflow-hidden">
                                {emp?.profile_photo_url ? (
                                  <img src={emp.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(emp?.first_name || '?').charAt(0)}{(emp?.last_name || '?').charAt(0)}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee'}
                                </p>
                                {emp?.department && (
                                  <p className="text-xs text-muted-foreground">{emp.department} - {emp.role || emp.category}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{emp?.email || '--'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{emp?.phone || '--'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${ROLE_BADGE_COLORS[oe.outlet_role] || 'bg-gray-100 text-gray-800'}`}>
                              {oe.outlet_role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {oe.is_outlet_admin ? (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                                <Shield size={12} className="inline mr-1" />
                                Yes
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_BADGE_COLORS[oe.status] || 'bg-gray-100 text-gray-800'}`}>
                              {oe.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {formatDate(oe.assigned_date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => setShowDetailModal(oe.id)}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium"
                                title="View details"
                              >
                                <Eye size={12} className="inline mr-1" />
                                View
                              </button>
                              {oe.status === 'Active' && (
                                <>
                                  <button
                                    onClick={() => openEditModal(oe)}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium"
                                    title="Edit assignment"
                                  >
                                    <Edit size={12} className="inline mr-1" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openTransferModal(oe)}
                                    className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 font-medium"
                                    title="Transfer to another outlet"
                                  >
                                    <ArrowRightLeft size={12} className="inline mr-1" />
                                    Transfer
                                  </button>
                                  <button
                                    onClick={() => setShowRemoveConfirm(oe.id)}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium"
                                    title="Remove from outlet"
                                  >
                                    <Trash2 size={12} className="inline mr-1" />
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}&ndash;
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)} of{' '}
                    {filteredEmployees.length} employees
                  </p>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (currentPage <= 4) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            currentPage === page
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border hover:bg-secondary'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ────────────────────────────────────────────────────────────────────── */}
          {/* MODALS                                                                 */}
          {/* ────────────────────────────────────────────────────────────────────── */}

          {/* Assign Employee Modal */}
          <Modal
            isOpen={showAssignModal}
            onClose={() => {
              setShowAssignModal(false);
              resetAssignForm();
            }}
            title="Assign Employee to Branch"
            size="lg"
          >
            <form onSubmit={handleAssign} className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Select an employee to assign to <strong>{getSelectedOutlet()?.name || 'this outlet'}</strong>. Only employees not already assigned to this outlet are shown.
              </p>

              {/* Employee Selector */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Employee *</label>
                {availableEmployees.length === 0 ? (
                  <div className="p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
                    No available employees. All employees are already assigned to this outlet.
                  </div>
                ) : (
                  <select
                    value={assignForm.employee_id}
                    onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  >
                    <option value="">-- Select Employee --</option>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} - {emp.email} ({emp.category || emp.department})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selected Employee Preview */}
              {assignForm.employee_id && (() => {
                const emp = availableEmployees.find(e => e.id === assignForm.employee_id);
                if (!emp) return null;
                return (
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden">
                        {emp.profile_photo_url ? (
                          <img src={emp.profile_photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.email} | {emp.department} - {emp.role || emp.category}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Outlet Role */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Outlet Role *</label>
                <select
                  value={assignForm.outlet_role}
                  onChange={(e) => setAssignForm({ ...assignForm, outlet_role: e.target.value as OutletRole })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  {OUTLET_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Outlet Admin */}
              <div className="p-3 border border-border rounded-lg bg-secondary/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignForm.is_outlet_admin}
                    onChange={(e) => setAssignForm({ ...assignForm, is_outlet_admin: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <div>
                    <span className="text-sm font-medium">Outlet Administrator</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Grant admin privileges for this branch (can manage other branch staff)
                    </p>
                  </div>
                </label>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">Permissions</label>
                {renderPermissionCheckboxes(
                  assignForm.permissions,
                  (perm) => togglePermission(perm, assignForm.permissions, (p) => setAssignForm({ ...assignForm, permissions: p }))
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, permissions: [...PERMISSION_OPTIONS] })}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, permissions: [] })}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                <textarea
                  placeholder="Any additional notes..."
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    resetAssignForm();
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !assignForm.employee_id}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : 'Assign Employee'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Edit Assignment Modal */}
          <Modal
            isOpen={!!showEditModal}
            onClose={() => setShowEditModal(null)}
            title={`Edit Assignment: ${(() => {
              const oe = getOutletEmployee(showEditModal || '');
              return oe?.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : '';
            })()}`}
            size="lg"
          >
            {showEditModal && (
              <form onSubmit={handleEditAssignment} className="space-y-4">
                {/* Current Employee Info */}
                {(() => {
                  const oe = getOutletEmployee(showEditModal);
                  const emp = oe?.employee;
                  if (!emp) return null;
                  return (
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden border border-border">
                          {emp.profile_photo_url ? (
                            <img src={emp.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email} | {emp.department}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Outlet Role */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Outlet Role</label>
                  <select
                    value={editForm.outlet_role}
                    onChange={(e) => setEditForm({ ...editForm, outlet_role: e.target.value as OutletRole })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {OUTLET_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* Outlet Admin */}
                <div className="p-3 border border-border rounded-lg bg-secondary/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_outlet_admin}
                      onChange={(e) => setEditForm({ ...editForm, is_outlet_admin: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Outlet Administrator</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Grant admin privileges for this branch
                      </p>
                    </div>
                  </label>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">Permissions</label>
                  {renderPermissionCheckboxes(
                    editForm.permissions,
                    (perm) => togglePermission(perm, editForm.permissions, (p) => setEditForm({ ...editForm, permissions: p }))
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, permissions: [...PERMISSION_OPTIONS] })}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, permissions: [] })}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'Active' | 'Inactive' | 'Transferred' })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Notes</label>
                  <textarea
                    placeholder="Any additional notes..."
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Update Assignment'}
                  </button>
                </div>
              </form>
            )}
          </Modal>

          {/* Employee Detail Modal */}
          <Modal
            isOpen={!!showDetailModal}
            onClose={() => setShowDetailModal(null)}
            title="Employee Details"
            size="xl"
          >
            {showDetailModal && (() => {
              const oe = getOutletEmployee(showDetailModal);
              const emp = oe?.employee;
              if (!oe) return <p className="text-sm text-muted-foreground">Assignment not found.</p>;
              return (
                <div className="space-y-6 max-h-[32rem] overflow-y-auto pr-1">
                  {/* Header */}
                  <div className="flex gap-5 items-start">
                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-muted-foreground flex-shrink-0 overflow-hidden border-2 border-border">
                      {emp?.profile_photo_url ? (
                        <img src={emp.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span>{(emp?.first_name || '?').charAt(0)}{(emp?.last_name || '?').charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-lg font-semibold">
                          {emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE_COLORS[oe.status]}`}>
                          {oe.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE_COLORS[oe.outlet_role]}`}>
                          {oe.outlet_role}
                        </span>
                        {oe.is_outlet_admin && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
                            <Shield size={10} className="inline mr-1" />
                            Outlet Admin
                          </span>
                        )}
                      </div>
                      {emp && (
                        <p className="text-sm text-muted-foreground">{emp.department} - {emp.role || emp.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Employee Profile Info */}
                  {emp && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Employee Profile</h4>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium ml-2">{emp.email || '--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="font-medium ml-2">{emp.phone || '--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category:</span>
                          <span className="font-medium ml-2">{emp.category || '--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Department:</span>
                          <span className="font-medium ml-2">{emp.department || '--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Role:</span>
                          <span className="font-medium ml-2">{emp.role || '--'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Hire Date:</span>
                          <span className="font-medium ml-2">{formatDate(emp.hire_date)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Employee Status:</span>
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                            emp.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>{emp.status}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Primary Outlet:</span>
                          <span className="font-medium ml-2">{emp.primary_outlet_name || 'Main Branch'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Outlet Assignment Details */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      Outlet Assignment Details
                    </h4>
                    <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Outlet Role:</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${ROLE_BADGE_COLORS[oe.outlet_role]}`}>
                          {oe.outlet_role}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outlet Admin:</span>
                        <span className="font-medium ml-2">{oe.is_outlet_admin ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assignment Status:</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE_COLORS[oe.status]}`}>
                          {oe.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Assigned Date:</span>
                        <span className="font-medium ml-2">{formatDate(oe.assigned_date)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium ml-2">{formatDate(oe.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Permissions</h4>
                    {oe.permissions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {oe.permissions.map(perm => (
                          <span
                            key={perm}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs"
                          >
                            <CheckCircle size={12} />
                            {perm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No specific permissions assigned.</p>
                    )}
                  </div>

                  {/* Notes */}
                  {oe.notes && (
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Notes</h4>
                      <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">{oe.notes}</p>
                    </div>
                  )}

                  {/* Close */}
                  <div className="flex justify-end pt-2 border-t border-border">
                    <button
                      onClick={() => setShowDetailModal(null)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </Modal>

          {/* Remove Confirmation Modal */}
          <Modal
            isOpen={!!showRemoveConfirm}
            onClose={() => setShowRemoveConfirm(null)}
            title="Remove Employee from Outlet"
            size="sm"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Are you sure?</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will set{' '}
                    <strong>
                      {(() => {
                        const oe = getOutletEmployee(showRemoveConfirm || '');
                        return oe?.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : 'this employee';
                      })()}
                    </strong>{' '}
                    to Inactive for this outlet. They can be reassigned later.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-border">
                <button
                  onClick={() => setShowRemoveConfirm(null)}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => showRemoveConfirm && handleRemove(showRemoveConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Remove Employee
                </button>
              </div>
            </div>
          </Modal>

          {/* Transfer Modal */}
          <Modal
            isOpen={!!showTransferModal}
            onClose={() => {
              setShowTransferModal(null);
              setTransferForm({ ...defaultTransferForm });
            }}
            title={`Transfer Employee: ${(() => {
              const oe = getOutletEmployee(showTransferModal || '');
              return oe?.employee ? `${oe.employee.first_name} ${oe.employee.last_name}` : '';
            })()}`}
            size="lg"
          >
            {showTransferModal && (
              <form onSubmit={handleTransfer} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Transfer this employee from <strong>{getSelectedOutlet()?.name}</strong> to another branch.
                  The current assignment will be marked as &quot;Transferred&quot; and a new assignment will be created at the target branch.
                </p>

                {/* Current Info */}
                {(() => {
                  const oe = getOutletEmployee(showTransferModal);
                  const emp = oe?.employee;
                  if (!emp) return null;
                  return (
                    <div className="p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground overflow-hidden border border-border">
                          {emp.profile_photo_url ? (
                            <img src={emp.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{emp.first_name.charAt(0)}{emp.last_name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Current: {getSelectedOutlet()?.name} ({oe?.outlet_role})
                          </p>
                        </div>
                        <ArrowRightLeft size={20} className="text-muted-foreground" />
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Transferring to:</p>
                          <p className="font-medium text-sm">
                            {transferForm.target_outlet_id
                              ? outlets.find(o => o.id === transferForm.target_outlet_id)?.name || 'Select...'
                              : 'Select outlet...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Target Outlet */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Target Branch *</label>
                  <select
                    value={transferForm.target_outlet_id}
                    onChange={(e) => setTransferForm({ ...transferForm, target_outlet_id: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  >
                    <option value="">-- Select Target Branch --</option>
                    {outlets
                      .filter(o => o.id !== selectedOutletId)
                      .map(outlet => (
                        <option key={outlet.id} value={outlet.id}>
                          {outlet.name} {outlet.code ? `(${outlet.code})` : ''} - {outlet.outlet_type.replace('_', ' ')}
                        </option>
                      ))}
                  </select>
                </div>

                {/* New Role at Target */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Role at New Branch</label>
                  <select
                    value={transferForm.outlet_role}
                    onChange={(e) => setTransferForm({ ...transferForm, outlet_role: e.target.value as OutletRole })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {OUTLET_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* Admin at target */}
                <div className="p-3 border border-border rounded-lg bg-secondary/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferForm.is_outlet_admin}
                      onChange={(e) => setTransferForm({ ...transferForm, is_outlet_admin: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <div>
                      <span className="text-sm font-medium">Outlet Administrator at new branch</span>
                    </div>
                  </label>
                </div>

                {/* Permissions at target */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">Permissions at New Branch</label>
                  {renderPermissionCheckboxes(
                    transferForm.permissions,
                    (perm) => togglePermission(perm, transferForm.permissions, (p) => setTransferForm({ ...transferForm, permissions: p }))
                  )}
                </div>

                {/* Transfer Notes */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Transfer Notes</label>
                  <textarea
                    placeholder="Reason for transfer..."
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferModal(null);
                      setTransferForm({ ...defaultTransferForm });
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !transferForm.target_outlet_id}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {saving ? 'Transferring...' : 'Transfer Employee'}
                  </button>
                </div>
              </form>
            )}
          </Modal>
        </>
      )}
    </div>
  );
}
