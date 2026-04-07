'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Store,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Users,
  MapPin,
  Phone,
  Mail,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  UserPlus,
  X,
  Check,
  AlertCircle,
  ArrowRightLeft,
  Home,
  Navigation,
  Crosshair,
  QrCode,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: 'bakery' | 'coffee_shop' | 'retail' | 'restaurant';
  is_main_branch: boolean;
  address: string;
  city: string;
  phone: string;
  email: string;
  manager_id: string;
  manager_name: string;
  opening_hours: string;
  status: 'Active' | 'Inactive' | 'Closed' | 'Suspended';
  notes: string;
  gps_lat: number;
  gps_lng: number;
  created_at: string;
  updated_at: string;
}

interface OutletEmployee {
  id: string;
  outlet_id: string;
  employee_id: string;
  outlet_role: 'Admin' | 'Manager' | 'Cashier' | 'Barista' | 'Server' | 'Staff';
  is_outlet_admin: boolean;
  permissions: Record<string, unknown>;
  status: string;
  assigned_date: string;
  notes: string;
  created_at: string;
  // joined fields
  employee_name?: string;
  employee_email?: string;
  employee_phone?: string;
  employee_category?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  category: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateOutletCode(): string {
  return `OTL-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
}

function dbToOutlet(row: Record<string, unknown>): Outlet {
  return {
    id: (row.id as string) || '',
    name: (row.name as string) || '',
    code: (row.code as string) || '',
    outlet_type: (row.outlet_type as Outlet['outlet_type']) || 'retail',
    is_main_branch: Boolean(row.is_main_branch),
    address: (row.address as string) || '',
    city: (row.city as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    manager_id: (row.manager_id as string) || '',
    manager_name: (row.manager_name as string) || '',
    opening_hours: (row.opening_hours as string) || '',
    status: (row.status as Outlet['status']) || 'Active',
    notes: (row.notes as string) || '',
    gps_lat: (row.gps_lat as number) || 0,
    gps_lng: (row.gps_lng as number) || 0,
    created_at: (row.created_at as string) || '',
    updated_at: (row.updated_at as string) || '',
  };
}

function dbToOutletEmployee(row: Record<string, unknown>): OutletEmployee {
  let parsedPermissions: Record<string, unknown> = {};
  if (row.permissions) {
    try {
      parsedPermissions = typeof row.permissions === 'string'
        ? JSON.parse(row.permissions as string)
        : (row.permissions as Record<string, unknown>);
    } catch { parsedPermissions = {}; }
  }
  return {
    id: (row.id as string) || '',
    outlet_id: (row.outlet_id as string) || '',
    employee_id: (row.employee_id as string) || '',
    outlet_role: (row.outlet_role as OutletEmployee['outlet_role']) || 'Staff',
    is_outlet_admin: Boolean(row.is_outlet_admin),
    permissions: parsedPermissions,
    status: (row.status as string) || 'Active',
    assigned_date: (row.assigned_date as string) || '',
    notes: (row.notes as string) || '',
    created_at: (row.created_at as string) || '',
  };
}

const OUTLET_TYPES: { value: Outlet['outlet_type']; label: string }[] = [
  { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' },
  { value: 'retail', label: 'Retail Store' },
  { value: 'restaurant', label: 'Restaurant' },
];

const OUTLET_STATUSES: Outlet['status'][] = ['Active', 'Inactive', 'Closed', 'Suspended'];

const OUTLET_ROLES: OutletEmployee['outlet_role'][] = ['Admin', 'Manager', 'Cashier', 'Barista', 'Server', 'Staff'];

const ITEMS_PER_PAGE = 10;

// ─── Component ───────────────────────────────────────────────────────────────

export default function OutletsPage() {
  const router = useRouter();
  // ─── Core state ──────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [outletEmployees, setOutletEmployees] = useState<OutletEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Toast ───────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Modal / form state ──────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // ─── Detail view state ───────────────────────────────────────────────────
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'employees' | 'inventory' | 'requisitions'>('overview');
  const [detailEmployees, setDetailEmployees] = useState<OutletEmployee[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─── Assign employee state ──────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    outlet_role: 'Staff' as OutletEmployee['outlet_role'],
    is_outlet_admin: false,
    notes: '',
  });

  // ─── Search / filter / pagination ────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Form data ───────────────────────────────────────────────────────────
  const emptyForm = {
    name: '',
    code: '',
    outlet_type: 'retail' as Outlet['outlet_type'],
    is_main_branch: false,
    address: '',
    city: '',
    phone: '',
    email: '',
    manager_id: '',
    manager_name: '',
    opening_hours: '',
    status: 'Active' as Outlet['status'],
    notes: '',
    gps_lat: 0,
    gps_lng: 0,
  };

  const [formData, setFormData] = useState(emptyForm);

  // ─── Location search state ─────────────────────────────────────────
  const [locationSuggestions, setLocationSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSearchTimeout, setLocationSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');

  const fetchOutletLocationSuggestions = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ke&limit=5`);
      const data = await res.json();
      setLocationSuggestions(data || []);
      setShowLocationSuggestions(true);
    } catch {
      setLocationSuggestions([]);
    }
  };

  const handleLocationSearchChange = (value: string) => {
    setLocationSearchQuery(value);
    if (locationSearchTimeout) clearTimeout(locationSearchTimeout);
    const timeout = setTimeout(() => fetchOutletLocationSuggestions(value), 400);
    setLocationSearchTimeout(timeout);
  };

  const selectLocationSuggestion = (suggestion: { display_name: string; lat: string; lon: string }) => {
    setFormData(prev => ({
      ...prev,
      address: suggestion.display_name,
      gps_lat: parseFloat(suggestion.lat),
      gps_lng: parseFloat(suggestion.lon),
    }));
    setLocationSearchQuery('');
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
        }));
      },
      () => showToast('Failed to get current location', 'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .order('is_main_branch', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Failed to load outlets: ' + error.message, 'error');
        setOutlets([]);
      } else {
        const mapped = (data || []).map((r: Record<string, unknown>) => dbToOutlet(r));
        // Auto-setup: If no outlets exist, create the default main bakery
        if (mapped.length === 0) {
          await setupDefaultMainOutlet();
          return; // fetchOutlets will be called again after setup
        }
        setOutlets(mapped);
      }
    } catch (err) {
      console.error('Fetch outlets error:', err);
      setOutlets([]);
    }
    setLoading(false);
  }, []);

  // Auto-create a default "Main Bakery" outlet when no outlets exist
  const setupDefaultMainOutlet = async () => {
    try {
      const { data: existing } = await supabase
        .from('outlets')
        .select('id')
        .limit(1);
      if (existing && existing.length > 0) return;

      const { error } = await supabase
        .from('outlets')
        .insert({
          name: 'Main Bakery',
          code: 'OTL-MAIN-001',
          outlet_type: 'bakery',
          is_main_branch: true,
          address: '',
          city: '',
          phone: '',
          email: '',
          opening_hours: '',
          status: 'Active',
          notes: 'Default main bakery outlet. This is the central production hub from which all other branches source their products.',
        });
      if (error) {
        console.error('Failed to create default main outlet:', error);
      } else {
        showToast('Main Bakery outlet has been set up as your default branch', 'success');
      }
      // Re-fetch to load the newly created outlet
      const { data: freshData } = await supabase
        .from('outlets')
        .select('*')
        .order('is_main_branch', { ascending: false })
        .order('created_at', { ascending: false });
      if (freshData) {
        setOutlets(freshData.map((r: Record<string, unknown>) => dbToOutlet(r)));
      }
    } catch (err) {
      console.error('Setup default main outlet error:', err);
    }
    setLoading(false);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, phone, role, category, status')
        .order('first_name');
      if (!error && data) {
        setEmployees(data.map((r: Record<string, unknown>) => ({
          id: (r.id as string) || '',
          first_name: (r.first_name as string) || '',
          last_name: (r.last_name as string) || '',
          email: (r.email as string) || '',
          phone: (r.phone as string) || '',
          role: (r.role as string) || '',
          category: (r.category as string) || '',
          status: (r.status as string) || 'Active',
        })));
      }
    } catch (err) {
      console.error('Fetch employees error:', err);
    }
  }, []);

  const fetchAllOutletEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('outlet_employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setOutletEmployees((data || []).map((r: Record<string, unknown>) => dbToOutletEmployee(r)));
      }
    } catch (err) {
      console.error('Fetch outlet employees error:', err);
    }
  }, []);

  const fetchDetailEmployees = useCallback(async (outletId: string) => {
    setLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('outlet_employees')
        .select('*')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = (data || []).map((r: Record<string, unknown>) => {
          const oe = dbToOutletEmployee(r);
          const emp = employees.find(e => e.id === oe.employee_id);
          if (emp) {
            oe.employee_name = `${emp.first_name} ${emp.last_name}`;
            oe.employee_email = emp.email;
            oe.employee_phone = emp.phone;
            oe.employee_category = emp.category;
          }
          return oe;
        });
        setDetailEmployees(mapped);
      } else {
        setDetailEmployees([]);
      }
    } catch (err) {
      console.error('Fetch detail employees error:', err);
      setDetailEmployees([]);
    }
    setLoadingDetail(false);
  }, [employees]);

  useEffect(() => {
    fetchOutlets();
    fetchEmployees();
    fetchAllOutletEmployees();
  }, [fetchOutlets, fetchEmployees, fetchAllOutletEmployees]);

  // ─── Filtering and pagination ────────────────────────────────────────────

  const filteredOutlets = outlets.filter(outlet => {
    const matchSearch = `${outlet.name} ${outlet.code} ${outlet.city} ${outlet.manager_name} ${outlet.phone} ${outlet.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchType = filterType === 'All' || outlet.outlet_type === filterType;
    const matchStatus = filterStatus === 'All' || outlet.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOutlets.length / ITEMS_PER_PAGE));
  const paginatedOutlets = filteredOutlets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType, filterStatus]);

  // ─── Stats ───────────────────────────────────────────────────────────────

  const totalOutlets = outlets.length;
  const activeOutlets = outlets.filter(o => o.status === 'Active').length;
  const mainBranch = outlets.find(o => o.is_main_branch);
  const totalOutletStaff = outletEmployees.filter(oe => oe.status === 'Active').length;

  // Helper: count employees per outlet
  const getOutletEmployeeCount = (outletId: string) => {
    return outletEmployees.filter(oe => oe.outlet_id === outletId && oe.status === 'Active').length;
  };

  // ─── Outlet type display helpers ─────────────────────────────────────────

  const getOutletTypeLabel = (type: Outlet['outlet_type']) => {
    return OUTLET_TYPES.find(t => t.value === type)?.label || type;
  };

  const getOutletTypeBadgeClass = (type: Outlet['outlet_type']) => {
    switch (type) {
      case 'bakery': return 'bg-amber-100 text-amber-800';
      case 'coffee_shop': return 'bg-brown-100 text-brown-800 bg-orange-100 text-orange-800';
      case 'retail': return 'bg-blue-100 text-blue-800';
      case 'restaurant': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeClass = (status: Outlet['status']) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-yellow-100 text-yellow-800';
      case 'Closed': return 'bg-red-100 text-red-800';
      case 'Suspended': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // ─── Form handlers ──────────────────────────────────────────────────────

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormData({ ...emptyForm, code: generateOutletCode() });
    setShowForm(true);
  };

  const openEditForm = (outlet: Outlet) => {
    setFormData({
      name: outlet.name,
      code: outlet.code,
      outlet_type: outlet.outlet_type,
      is_main_branch: outlet.is_main_branch,
      address: outlet.address,
      city: outlet.city,
      phone: outlet.phone,
      email: outlet.email,
      manager_id: outlet.manager_id,
      manager_name: outlet.manager_name,
      opening_hours: outlet.opening_hours,
      status: outlet.status,
      notes: outlet.notes,
      gps_lat: outlet.gps_lat,
      gps_lng: outlet.gps_lng,
    });
    setEditingId(outlet.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleManagerChange = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    setFormData({
      ...formData,
      manager_id: employeeId,
      manager_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Outlet name is required', 'error');
      return;
    }
    if (!formData.code.trim()) {
      showToast('Outlet code is required', 'error');
      return;
    }

    setSaving(true);
    const row = {
      name: formData.name.trim(),
      code: formData.code.trim(),
      outlet_type: formData.outlet_type,
      is_main_branch: formData.is_main_branch,
      address: formData.address.trim(),
      city: formData.city.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      manager_id: formData.manager_id || null,
      manager_name: formData.manager_name.trim(),
      opening_hours: formData.opening_hours.trim(),
      status: formData.status,
      notes: formData.notes.trim(),
      gps_lat: formData.gps_lat || null,
      gps_lng: formData.gps_lng || null,
      updated_at: new Date().toISOString(),
    };

    try {
      // If setting this outlet as main branch, unset any existing main branch first
      if (row.is_main_branch) {
        const currentMain = outlets.find(o => o.is_main_branch && o.id !== editingId);
        if (currentMain) {
          await supabase
            .from('outlets')
            .update({ is_main_branch: false })
            .eq('id', currentMain.id);
        }
      }

      if (editingId) {
        const { error } = await supabase
          .from('outlets')
          .update(row)
          .eq('id', editingId);
        if (error) throw error;
        logAudit({
          action: 'UPDATE',
          module: 'Outlets',
          record_id: editingId,
          details: { name: row.name, code: row.code, outlet_type: row.outlet_type, status: row.status },
        });
        showToast('Outlet updated successfully', 'success');
      } else {
        const { data: inserted, error } = await supabase
          .from('outlets')
          .insert(row)
          .select('id')
          .single();
        if (error) throw error;
        logAudit({
          action: 'CREATE',
          module: 'Outlets',
          record_id: inserted?.id ?? '',
          details: { name: row.name, code: row.code, outlet_type: row.outlet_type, status: row.status },
        });
        showToast('Outlet created successfully', 'success');
      }
      await fetchOutlets();
      closeForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to save outlet: ${msg}`, 'error');
      console.error('Outlet save error:', err);
    }
    setSaving(false);
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const outlet = outlets.find(o => o.id === id);
    if (outlet?.is_main_branch) {
      showToast('Cannot delete the main bakery branch. Set another outlet as main branch first.', 'error');
      setShowDeleteConfirm(null);
      return;
    }

    setSaving(true);
    try {
      // Check if outlet has assigned employees
      const assignedCount = outletEmployees.filter(oe => oe.outlet_id === id).length;
      if (assignedCount > 0) {
        // Remove all employee assignments first
        const { error: removeError } = await supabase
          .from('outlet_employees')
          .delete()
          .eq('outlet_id', id);
        if (removeError) throw removeError;
      }

      const outlet = outlets.find(o => o.id === id);
      const { error } = await supabase
        .from('outlets')
        .delete()
        .eq('id', id);
      if (error) throw error;
      logAudit({
        action: 'DELETE',
        module: 'Outlets',
        record_id: id,
        details: { name: outlet?.name || id, code: outlet?.code || '' },
      });
      showToast('Outlet deleted successfully', 'success');
      setOutlets(outlets.filter(o => o.id !== id));
      setOutletEmployees(outletEmployees.filter(oe => oe.outlet_id !== id));
      if (selectedOutlet?.id === id) {
        setSelectedOutlet(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to delete outlet: ${msg}`, 'error');
      console.error('Delete outlet error:', err);
    }
    setSaving(false);
    setShowDeleteConfirm(null);
  };

  // ─── Detail view ─────────────────────────────────────────────────────────

  const openDetailView = (outlet: Outlet) => {
    setSelectedOutlet(outlet);
    setDetailTab('overview');
    fetchDetailEmployees(outlet.id);
  };

  const closeDetailView = () => {
    setSelectedOutlet(null);
    setDetailEmployees([]);
  };

  // ─── Assign employee ────────────────────────────────────────────────────

  const openAssignModal = () => {
    setAssignForm({
      employee_id: '',
      outlet_role: 'Staff',
      is_outlet_admin: false,
      notes: '',
    });
    setShowAssignModal(true);
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet) return;
    if (!assignForm.employee_id) {
      showToast('Please select an employee', 'error');
      return;
    }

    // Check if employee is already assigned to this outlet
    const alreadyAssigned = detailEmployees.find(
      de => de.employee_id === assignForm.employee_id
    );
    if (alreadyAssigned) {
      showToast('This employee is already assigned to this outlet', 'error');
      return;
    }

    setSaving(true);
    const emp = employees.find(e => e.id === assignForm.employee_id);
    const row = {
      outlet_id: selectedOutlet.id,
      employee_id: assignForm.employee_id,
      outlet_role: assignForm.outlet_role,
      is_outlet_admin: assignForm.is_outlet_admin,
      permissions: JSON.stringify({}),
      status: 'Active',
      assigned_date: new Date().toISOString().split('T')[0],
      notes: assignForm.notes.trim(),
    };

    try {
      const { error } = await supabase
        .from('outlet_employees')
        .insert(row);
      if (error) throw error;
      logAudit({
        action: 'CREATE',
        module: 'Outlets',
        record_id: selectedOutlet.id,
        details: {
          action: 'assign_employee',
          outlet_name: selectedOutlet.name,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : assignForm.employee_id,
          outlet_role: assignForm.outlet_role,
        },
      });
      showToast(`Employee assigned to ${selectedOutlet.name} successfully`, 'success');
      await fetchDetailEmployees(selectedOutlet.id);
      await fetchAllOutletEmployees();
      setShowAssignModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to assign employee: ${msg}`, 'error');
      console.error('Assign employee error:', err);
    }
    setSaving(false);
  };

  // ─── Remove employee from outlet ────────────────────────────────────────

  const handleRemoveEmployee = async (outletEmployeeId: string) => {
    if (!selectedOutlet) return;
    setSaving(true);
    try {
      const oe = detailEmployees.find(de => de.id === outletEmployeeId);
      const { error } = await supabase
        .from('outlet_employees')
        .delete()
        .eq('id', outletEmployeeId);
      if (error) throw error;
      logAudit({
        action: 'DELETE',
        module: 'Outlets',
        record_id: selectedOutlet.id,
        details: {
          action: 'remove_employee',
          outlet_name: selectedOutlet.name,
          employee_name: oe?.employee_name || outletEmployeeId,
          outlet_role: oe?.outlet_role || '',
        },
      });
      showToast('Employee removed from outlet', 'success');
      await fetchDetailEmployees(selectedOutlet.id);
      await fetchAllOutletEmployees();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to remove employee: ${msg}`, 'error');
      console.error('Remove employee error:', err);
    }
    setSaving(false);
  };

  // ─── Update outlet employee role ─────────────────────────────────────────

  const handleUpdateOutletEmployeeRole = async (outletEmployeeId: string, newRole: OutletEmployee['outlet_role']) => {
    if (!selectedOutlet) return;
    try {
      const { error } = await supabase
        .from('outlet_employees')
        .update({ outlet_role: newRole })
        .eq('id', outletEmployeeId);
      if (error) throw error;
      logAudit({
        action: 'UPDATE',
        module: 'Outlets',
        record_id: selectedOutlet.id,
        details: {
          action: 'update_employee_role',
          outlet_employee_id: outletEmployeeId,
          new_role: newRole,
        },
      });
      showToast('Employee role updated', 'success');
      await fetchDetailEmployees(selectedOutlet.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to update role: ${msg}`, 'error');
    }
  };

  // ─── Get employees not yet assigned to the selected outlet ──────────────

  const getAvailableEmployees = () => {
    if (!selectedOutlet) return employees;
    const assignedIds = new Set(detailEmployees.map(de => de.employee_id));
    return employees.filter(e => !assignedIds.has(e.id) && e.status === 'Active');
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Store className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Branch Management</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your bakery branches and outlets. The <strong>Main Bakery</strong> is the central production hub &mdash; all other branches (coffee shops, retail outlets, etc.) source their products from it via requisitions.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Outlets</p>
              <p className="text-2xl font-bold">{totalOutlets}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Outlets</p>
              <p className="text-2xl font-bold text-green-600">{activeOutlets}</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Store className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Main Branch</p>
              <p className="text-lg font-bold text-amber-600 truncate" title={mainBranch?.name || 'Not Set'}>
                {mainBranch?.name || 'Not Set'}
              </p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Outlet Staff</p>
              <p className="text-2xl font-bold text-purple-600">{totalOutletStaff}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────── Detail View ────────────────────────── */}
      {selectedOutlet ? (
        <div>
          {/* Back button and outlet header */}
          <div className="mb-6">
            <button
              onClick={closeDetailView}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Outlets
            </button>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold">{selectedOutlet.name}</h2>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusBadgeClass(selectedOutlet.status)}`}>
                    {selectedOutlet.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getOutletTypeBadgeClass(selectedOutlet.outlet_type)}`}>
                    {getOutletTypeLabel(selectedOutlet.outlet_type)}
                  </span>
                  {selectedOutlet.is_main_branch && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                      Main Branch
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{selectedOutlet.code}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/admin/outlet-menu-generator?outlet=${selectedOutlet.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 transition-colors font-medium"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Menu &amp; QR
                </button>
                <button
                  onClick={() => openEditForm(selectedOutlet)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(selectedOutlet.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Detail Tabs */}
          <div className="flex gap-2 border-b border-border mb-6">
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'employees', label: `Employees (${detailEmployees.length})` },
              { key: 'inventory', label: 'Inventory' },
              { key: 'requisitions', label: 'Requisitions' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setDetailTab(tab.key)}
                className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
                  detailTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Overview Tab ─── */}
          {detailTab === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Branch Relationship Banner */}
              {!selectedOutlet.is_main_branch && mainBranch && (
                <div className="col-span-2 border border-orange-200 bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100">
                      <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Branch of {mainBranch.name}</p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        This outlet sources products from the main bakery via requisitions. Use the Requisitions tab to request stock.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {selectedOutlet.is_main_branch && (
                <div className="col-span-2 border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Home className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Central Production Hub</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        This is your main bakery &mdash; the production center that supplies products to all other branches.
                        {outlets.filter(o => !o.is_main_branch && o.status === 'Active').length > 0
                          ? ` Currently supplying ${outlets.filter(o => !o.is_main_branch && o.status === 'Active').length} active branch(es).`
                          : ' No other branches have been added yet.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Outlet Information */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Outlet Information</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Outlet Name</p>
                      <p className="text-sm font-medium">{selectedOutlet.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Store className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium">{getOutletTypeLabel(selectedOutlet.outlet_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Address</p>
                      <p className="text-sm font-medium">{selectedOutlet.address || '---'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">City</p>
                      <p className="text-sm font-medium">{selectedOutlet.city || '---'}</p>
                    </div>
                  </div>
                  {selectedOutlet.gps_lat !== 0 && selectedOutlet.gps_lng !== 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">GPS: {selectedOutlet.gps_lat.toFixed(6)}, {selectedOutlet.gps_lng.toFixed(6)}</p>
                        <a
                          href={`https://www.google.com/maps?q=${selectedOutlet.gps_lat},${selectedOutlet.gps_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                      <iframe
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedOutlet.gps_lng - 0.005},${selectedOutlet.gps_lat - 0.005},${selectedOutlet.gps_lng + 0.005},${selectedOutlet.gps_lat + 0.005}&layer=mapnik&marker=${selectedOutlet.gps_lat},${selectedOutlet.gps_lng}`}
                        width="100%"
                        height="180"
                        className="rounded-lg border border-border"
                        style={{ border: 0 }}
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Opening Hours</p>
                      <p className="text-sm font-medium">{selectedOutlet.opening_hours || '---'}</p>
                    </div>
                  </div>
                  {selectedOutlet.gps_lat !== 0 && selectedOutlet.gps_lng !== 0 && (
                    <div className="flex items-start gap-3">
                      <Navigation className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">GPS Location</p>
                        <p className="text-sm font-medium font-mono">{selectedOutlet.gps_lat.toFixed(6)}, {selectedOutlet.gps_lng.toFixed(6)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map display in overview */}
              {selectedOutlet.gps_lat !== 0 && selectedOutlet.gps_lng !== 0 && (
                <div className="col-span-2 border border-border rounded-lg p-6 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Outlet Location</h3>
                    <a
                      href={`https://www.google.com/maps?q=${selectedOutlet.gps_lat},${selectedOutlet.gps_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Open in Google Maps
                    </a>
                  </div>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedOutlet.gps_lng - 0.008},${selectedOutlet.gps_lat - 0.008},${selectedOutlet.gps_lng + 0.008},${selectedOutlet.gps_lat + 0.008}&layer=mapnik&marker=${selectedOutlet.gps_lat},${selectedOutlet.gps_lng}`}
                    width="100%"
                    height="250"
                    className="rounded-lg border border-border"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                </div>
              )}

              {/* Contact & Manager */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Contact & Manager</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{selectedOutlet.phone || '---'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedOutlet.email || '---'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Manager</p>
                      <p className="text-sm font-medium">{selectedOutlet.manager_name || '---'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Assigned Staff</p>
                      <p className="text-sm font-medium">{detailEmployees.length} employee{detailEmployees.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedOutlet.notes && (
                <div className="col-span-2 border border-border rounded-lg p-6 bg-card">
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Notes</h3>
                  <p className="text-sm whitespace-pre-wrap bg-secondary/30 p-4 rounded-lg">{selectedOutlet.notes}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="col-span-2 border border-border rounded-lg p-6 bg-card">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Metadata</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Outlet Code:</span>
                    <span className="font-mono font-medium ml-2">{selectedOutlet.code}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium ml-2">
                      {selectedOutlet.created_at ? new Date(selectedOutlet.created_at).toLocaleDateString() : '---'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="font-medium ml-2">
                      {selectedOutlet.updated_at ? new Date(selectedOutlet.updated_at).toLocaleDateString() : '---'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Employees Tab ─── */}
          {detailTab === 'employees' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {detailEmployees.length} employee{detailEmployees.length !== 1 ? 's' : ''} assigned to this outlet
                </p>
                <button
                  onClick={openAssignModal}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign Employee
                </button>
              </div>

              {loadingDetail ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading assigned employees...</div>
              ) : detailEmployees.length === 0 ? (
                <div className="text-center py-12 border border-border rounded-lg bg-card">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No employees assigned</p>
                  <p className="text-sm text-muted-foreground mt-1">Assign employees to this outlet to get started.</p>
                  <button
                    onClick={openAssignModal}
                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
                  >
                    Assign First Employee
                  </button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Employee</th>
                        <th className="px-4 py-3 text-left font-semibold">Category</th>
                        <th className="px-4 py-3 text-left font-semibold">Outlet Role</th>
                        <th className="px-4 py-3 text-center font-semibold">Outlet Admin</th>
                        <th className="px-4 py-3 text-left font-semibold">Assigned Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailEmployees.map(oe => (
                        <tr key={oe.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{oe.employee_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{oe.employee_email || ''}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {oe.employee_category || '---'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={oe.outlet_role}
                              onChange={(e) => handleUpdateOutletEmployeeRole(oe.id, e.target.value as OutletEmployee['outlet_role'])}
                              className="px-2 py-1 border border-border rounded text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                              {OUTLET_ROLES.map(role => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {oe.is_outlet_admin ? (
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Yes</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {oe.assigned_date ? new Date(oe.assigned_date).toLocaleDateString() : '---'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              oe.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {oe.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveEmployee(oe.id)}
                              disabled={saving}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Assign Employee Modal */}
              <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title={`Assign Employee to ${selectedOutlet?.name || 'Outlet'}`} size="lg">
                <form onSubmit={handleAssignEmployee} className="space-y-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Select Employee *</label>
                    <select
                      value={assignForm.employee_id}
                      onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                      required
                    >
                      <option value="">-- Select an employee --</option>
                      {getAvailableEmployees().map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} -- {emp.category} ({emp.role || 'No Role'})
                        </option>
                      ))}
                    </select>
                    {getAvailableEmployees().length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        All active employees are already assigned to this outlet.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Outlet Role *</label>
                      <select
                        value={assignForm.outlet_role}
                        onChange={(e) => setAssignForm({ ...assignForm, outlet_role: e.target.value as OutletEmployee['outlet_role'] })}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                      >
                        {OUTLET_ROLES.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Outlet Admin</label>
                      <div className="flex items-center gap-3 h-10">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignForm.is_outlet_admin}
                            onChange={(e) => setAssignForm({ ...assignForm, is_outlet_admin: e.target.checked })}
                            className="rounded border-border"
                          />
                          <span className="text-sm">Grant admin access to this outlet</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                    <textarea
                      value={assignForm.notes}
                      onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                      rows={2}
                      placeholder="Optional notes about this assignment"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !assignForm.employee_id}
                      className="flex items-center gap-1.5 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      {saving ? 'Assigning...' : 'Assign Employee'}
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}

          {/* ─── Inventory Tab ─── */}
          {detailTab === 'inventory' && (
            <div className="text-center py-12 border border-border rounded-lg bg-card">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {selectedOutlet.is_main_branch ? 'Main Bakery Inventory' : 'Branch Inventory'}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {selectedOutlet.is_main_branch
                  ? 'Manage the central production inventory. Raw materials, packaging, and finished goods available to distribute to branches.'
                  : `This branch receives products from ${mainBranch?.name || 'the main bakery'}. Track stock levels, transfers, and local inventory movements.`
                }
              </p>
              <a
                href={selectedOutlet.is_main_branch ? '/admin/inventory' : '/admin/outlet-inventory'}
                className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
              >
                {selectedOutlet.is_main_branch ? 'Go to Main Inventory' : 'Go to Outlet Inventory'}
              </a>
            </div>
          )}

          {/* ─── Requisitions Tab ─── */}
          {detailTab === 'requisitions' && (
            <div className="text-center py-12 border border-border rounded-lg bg-card">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {selectedOutlet.is_main_branch ? 'Incoming Requisitions' : 'Branch Requisitions'}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {selectedOutlet.is_main_branch
                  ? 'View and approve product requests from all branches. Manage fulfillment and delivery of stock to outlets.'
                  : `Request products from ${mainBranch?.name || 'the main bakery'}. Track order status and delivery to this branch.`
                }
              </p>
              <a
                href="/admin/outlet-requisitions"
                className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm"
              >
                {selectedOutlet.is_main_branch ? 'Manage Requisitions' : 'Create Requisition'}
              </a>
            </div>
          )}
        </div>
      ) : (
        /* ────────────────────────── List View ────────────────────────── */
        <div>
          {/* Search / Filter / Actions */}
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search outlets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="All">All Types</option>
                {OUTLET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="All">All Statuses</option>
                {OUTLET_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <button
              onClick={openCreateForm}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading outlets...</div>
          )}

          {/* Empty state */}
          {!loading && outlets.length === 0 && (
            <div className="text-center py-16 border border-border rounded-lg bg-card">
              <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Setting up your bakery...</p>
              <p className="text-sm text-muted-foreground mt-1">Your main bakery branch is being created as the default production hub.</p>
            </div>
          )}

          {/* No results state */}
          {!loading && outlets.length > 0 && filteredOutlets.length === 0 && (
            <div className="text-center py-12 border border-border rounded-lg bg-card">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No outlets match your filters</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria.</p>
              <button
                onClick={() => { setSearchTerm(''); setFilterType('All'); setFilterStatus('All'); }}
                className="mt-3 text-sm text-primary hover:text-primary/80 font-medium"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && filteredOutlets.length > 0 && (
            <>
              <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Outlet</th>
                      <th className="px-4 py-3 text-left font-semibold">Code</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Manager</th>
                      <th className="px-4 py-3 text-left font-semibold">City</th>
                      <th className="px-4 py-3 text-center font-semibold">Location</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-center font-semibold">Staff</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOutlets.map((outlet) => (
                      <tr key={outlet.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              outlet.is_main_branch ? 'bg-amber-100' : 'bg-secondary'
                            }`}>
                              {outlet.is_main_branch
                                ? <Home className={`w-4 h-4 text-amber-600`} />
                                : <Store className={`w-4 h-4 text-muted-foreground`} />
                              }
                            </div>
                            <div>
                              <p className="font-medium">{outlet.name}</p>
                              {outlet.is_main_branch ? (
                                <span className="text-xs text-amber-600 font-medium">Main Bakery (Production Hub)</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Branch &bull; Sources from {mainBranch?.name || 'Main Bakery'}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{outlet.code}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getOutletTypeBadgeClass(outlet.outlet_type)}`}>
                            {getOutletTypeLabel(outlet.outlet_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(outlet.status)}`}>
                            {outlet.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{outlet.manager_name || '---'}</td>
                        <td className="px-4 py-3 text-sm">{outlet.city || '---'}</td>
                        <td className="px-4 py-3 text-center">
                          {outlet.gps_lat !== 0 && outlet.gps_lng !== 0 ? (
                            <a
                              href={`https://www.google.com/maps?q=${outlet.gps_lat},${outlet.gps_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                              title={`${outlet.gps_lat.toFixed(4)}, ${outlet.gps_lng.toFixed(4)}`}
                            >
                              <MapPin className="w-3 h-3" />
                              Mapped
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{outlet.phone || '---'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {getOutletEmployeeCount(outlet.id)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openDetailView(outlet)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors font-medium"
                              title="View Details"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            <button
                              onClick={() => openEditForm(outlet)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors font-medium"
                              title="Edit Outlet"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => router.push(`/admin/outlet-menu-generator?outlet=${outlet.id}`)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 transition-colors font-medium"
                              title="Generate Menu QR Code"
                            >
                              <QrCode className="w-3 h-3" />
                              QR
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(outlet.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors font-medium"
                              title="Delete Outlet"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredOutlets.length > ITEMS_PER_PAGE && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredOutlets.length)} of {filteredOutlets.length} outlets
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          page === currentPage
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border hover:bg-secondary'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ────────────────────────── Create/Edit Outlet Modal ────────────────────────── */}
      <Modal isOpen={showForm} onClose={closeForm} title={editingId ? 'Edit Outlet' : 'Create New Outlet'} size="2xl">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Name and Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Outlet Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="e.g. Downtown Coffee Shop"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Outlet Code *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-mono"
                  placeholder="OTL-XXXXXXXX"
                  required
                />
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, code: generateOutletCode() })}
                    className="px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground"
                    title="Regenerate Code"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Type and Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Outlet Type *</label>
              <select
                value={formData.outlet_type}
                onChange={(e) => setFormData({ ...formData, outlet_type: e.target.value as Outlet['outlet_type'] })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {OUTLET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Outlet['status'] })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                {OUTLET_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Main Branch</label>
              <div className="flex items-center gap-3 h-10">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_main_branch}
                    onChange={(e) => setFormData({ ...formData, is_main_branch: e.target.checked })}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm">This is the main branch</span>
                </label>
              </div>
              {formData.is_main_branch && mainBranch && mainBranch.id !== editingId && (
                <p className="text-xs text-amber-600 mt-1">
                  &quot;{mainBranch.name}&quot; is currently the main branch. It will be automatically changed to a regular branch outlet.
                </p>
              )}
            </div>
          </div>

          {/* Address and City */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs text-muted-foreground mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  handleLocationSearchChange(e.target.value);
                }}
                onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                onFocus={() => { if (locationSuggestions.length > 0) setShowLocationSuggestions(true); }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="Search address or type location..."
              />
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {locationSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors border-b border-border last:border-0"
                      onMouseDown={() => selectLocationSuggestion(s)}
                    >
                      <MapPin size={10} className="inline mr-1 text-muted-foreground" />
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="e.g. Nairobi"
              />
            </div>
          </div>

          {/* GPS Location - Pin on Map */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Outlet Location (Pin on Map)</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setFormData(prev => ({
                          ...prev,
                          gps_lat: parseFloat(pos.coords.latitude.toFixed(6)),
                          gps_lng: parseFloat(pos.coords.longitude.toFixed(6)),
                        }));
                      },
                      () => {},
                      { enableHighAccuracy: true }
                    );
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                >
                  <Crosshair className="w-3 h-3" />
                  Use My Location
                </button>
                {formData.gps_lat !== 0 && formData.gps_lng !== 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, gps_lat: 0, gps_lng: 0 }))}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.gps_lat || ''}
                  onChange={(e) => setFormData({ ...formData, gps_lat: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm font-mono"
                  placeholder="e.g. -1.286389"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.gps_lng || ''}
                  onChange={(e) => setFormData({ ...formData, gps_lng: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm font-mono"
                  placeholder="e.g. 36.817223"
                />
              </div>
            </div>

            {/* Interactive Map for pinning location */}
            <div className="relative">
              {formData.gps_lat !== 0 && formData.gps_lng !== 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">
                      GPS: {formData.gps_lat.toFixed(6)}, {formData.gps_lng.toFixed(6)}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${formData.gps_lat},${formData.gps_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Open in Google Maps
                    </a>
                  </div>
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.gps_lng - 0.005},${formData.gps_lat - 0.005},${formData.gps_lng + 0.005},${formData.gps_lat + 0.005}&layer=mapnik&marker=${formData.gps_lat},${formData.gps_lng}`}
                    width="100%"
                    height="200"
                    className="rounded-lg border border-border"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="border border-dashed border-border rounded-lg p-6 text-center bg-background">
                  <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground font-medium">No location set</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter latitude/longitude coordinates above, or click &quot;Use My Location&quot; to auto-detect.
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Pin this outlet&apos;s location on the map for delivery route planning and rider assignment optimization.
            </p>
          </div>

          {/* Phone and Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="+254 7XX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="outlet@bakery.com"
              />
            </div>
          </div>

          {/* Manager */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Manager</label>
            <select
              value={formData.manager_id}
              onChange={(e) => handleManagerChange(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
            >
              <option value="">-- Select Manager (optional) --</option>
              {employees
                .filter(emp => emp.status === 'Active')
                .map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} -- {emp.category} ({emp.role || 'No Role'})
                  </option>
                ))}
            </select>
            {formData.manager_name && (
              <p className="text-xs text-muted-foreground mt-1">Selected: {formData.manager_name}</p>
            )}
          </div>

          {/* Opening Hours */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Opening Hours</label>
            <input
              type="text"
              value={formData.opening_hours}
              onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              placeholder="e.g. Mon-Sat 6:00 AM - 8:00 PM, Sun 8:00 AM - 6:00 PM"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={3}
              placeholder="Additional notes about this outlet"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update Outlet' : 'Create Outlet'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────────────────────── Delete Confirmation Modal ────────────────────────── */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Outlet" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-red-100 flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Are you sure you want to delete this outlet?</p>
              <p className="text-sm text-muted-foreground mt-1">
                This action cannot be undone. All employee assignments for this outlet will also be removed.
              </p>
              {showDeleteConfirm && (
                <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {outlets.find(o => o.id === showDeleteConfirm)?.name || 'Unknown Outlet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Code: {outlets.find(o => o.id === showDeleteConfirm)?.code || '---'}
                  </p>
                  {outlets.find(o => o.id === showDeleteConfirm)?.is_main_branch && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      This is the main bakery branch and cannot be deleted. Set another outlet as main branch first.
                    </p>
                  )}
                  {getOutletEmployeeCount(showDeleteConfirm) > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      This outlet has {getOutletEmployeeCount(showDeleteConfirm)} assigned employee(s) who will be unassigned.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
              disabled={saving || (showDeleteConfirm ? (outlets.find(o => o.id === showDeleteConfirm)?.is_main_branch ?? false) : false)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Deleting...' : 'Delete Outlet'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
