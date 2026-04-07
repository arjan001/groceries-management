'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

interface Asset {
  id: string;
  name: string;
  category: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  salvageValue: number;
  usefulLifeYears: number;
  nextServiceDate: string;
  serviceInterval: string;
  warrantyExpiry: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  status: 'Active' | 'Under Repair' | 'Disposed' | 'Retired';
  location: string;
  assignedTo: string;
  assignmentDate: string;
  assignmentNotes: string;
  notes: string;
  serviceLifeHours: number;
  hoursUsed: number;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  maintenanceIntervalDays: number;
  maintenanceCostTotal: number;
  operatingCostTotal: number;
  depreciationMethod: 'straight_line' | 'usage_based';
  usageDepreciationRate: number;
}

interface AssetCategory {
  id: string;
  name: string;
  description: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  status: string;
}

interface AssignmentRecord {
  id: string;
  assetId: string;
  employeeId: string;
  employeeName: string;
  assignedDate: string;
  returnedDate: string;
  notes: string;
}

interface MaintenanceLog {
  id: string;
  assetId: string;
  assetName: string;
  maintenanceType: string;
  description: string;
  cost: number;
  performedBy: string;
  performedDate: string;
  nextDueDate: string;
  notes: string;
  createdAt: string;
}

const emptyAsset: Asset = {
  id: '', name: '', category: '', serialNumber: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  purchasePrice: 0, currentValue: 0, salvageValue: 0, usefulLifeYears: 5,
  nextServiceDate: '', serviceInterval: '', warrantyExpiry: '',
  condition: 'Good', status: 'Active', location: '',
  assignedTo: '', assignmentDate: '', assignmentNotes: '', notes: '',
  serviceLifeHours: 0, hoursUsed: 0,
  lastMaintenanceDate: '', nextMaintenanceDate: '',
  maintenanceIntervalDays: 90,
  maintenanceCostTotal: 0, operatingCostTotal: 0,
  depreciationMethod: 'straight_line', usageDepreciationRate: 0,
};

const emptyMaintenanceForm = {
  assetId: '',
  maintenanceType: 'Routine' as string,
  description: '',
  cost: 0,
  performedBy: '',
  performedDate: new Date().toISOString().split('T')[0],
  nextDueDate: '',
  notes: '',
};

const ITEMS_PER_PAGE = 10;

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRecord[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Asset | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'categories' | 'maintenance'>('assets');
  const [filterCategory, setFilterCategory] = useState('All');
  const [formData, setFormData] = useState<Asset>(emptyAsset);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [maintenanceFormData, setMaintenanceFormData] = useState(emptyMaintenanceForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [maintenancePage, setMaintenancePage] = useState(1);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
    if (data) setAssets(data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.name || '') as string,
      category: (r.category || '') as string,
      serialNumber: (r.serial_number || '') as string,
      purchaseDate: (r.purchase_date || '') as string,
      purchasePrice: (r.purchase_price || 0) as number,
      currentValue: (r.current_value || 0) as number,
      salvageValue: (r.salvage_value || 0) as number,
      usefulLifeYears: (r.useful_life_years || 5) as number,
      nextServiceDate: (r.replacement_date || '') as string,
      serviceInterval: (r.capacity || '') as string,
      warrantyExpiry: (r.warranty_expiry || '') as string,
      condition: (r.condition || 'Good') as Asset['condition'],
      status: (r.status || 'Active') as Asset['status'],
      location: (r.location || '') as string,
      assignedTo: (r.assigned_to || '') as string,
      assignmentDate: (r.assignment_date || '') as string,
      assignmentNotes: (r.assignment_notes || '') as string,
      notes: (r.notes || '') as string,
      serviceLifeHours: (r.service_life_hours || 0) as number,
      hoursUsed: (r.hours_used || 0) as number,
      lastMaintenanceDate: (r.last_maintenance_date || '') as string,
      nextMaintenanceDate: (r.next_maintenance_date || '') as string,
      maintenanceIntervalDays: (r.maintenance_interval_days || 90) as number,
      maintenanceCostTotal: (r.maintenance_cost_total || 0) as number,
      operatingCostTotal: (r.operating_cost_total || 0) as number,
      depreciationMethod: (r.depreciation_method || 'straight_line') as Asset['depreciationMethod'],
      usageDepreciationRate: (r.usage_depreciation_rate || 0) as number,
    })));
    setLoading(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('asset_categories').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setCategories(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        description: (r.description || '') as string,
      })));
    } else {
      setCategories([
        { id: '1', name: 'Equipment', description: 'Production machinery and equipment' },
        { id: '2', name: 'Vehicles', description: 'Delivery vehicles and transport' },
        { id: '3', name: 'Furniture', description: 'Office and production furniture' },
        { id: '4', name: 'Electronics', description: 'Computers, POS terminals, printers' },
      ]);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, first_name, last_name, department, role, status').order('first_name', { ascending: true });
    if (data) {
      setEmployees(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name || '') as string,
        lastName: (r.last_name || '') as string,
        department: (r.department || '') as string,
        role: (r.role || '') as string,
        status: (r.status || 'Active') as string,
      })));
    }
  }, []);

  const fetchAssignmentHistory = useCallback(async (assetId: string) => {
    const { data } = await supabase
      .from('asset_assignments')
      .select('*')
      .eq('asset_id', assetId)
      .order('assigned_date', { ascending: false });
    if (data) {
      setAssignmentHistory(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        assetId: (r.asset_id || '') as string,
        employeeId: (r.employee_id || '') as string,
        employeeName: (r.employee_name || '') as string,
        assignedDate: (r.assigned_date || '') as string,
        returnedDate: (r.returned_date || '') as string,
        notes: (r.notes || '') as string,
      })));
    } else {
      setAssignmentHistory([]);
    }
  }, []);

  const fetchMaintenanceLogs = useCallback(async () => {
    const { data } = await supabase
      .from('asset_maintenance_log')
      .select('*')
      .order('performed_date', { ascending: false });
    if (data) {
      setMaintenanceLogs(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        assetId: (r.asset_id || '') as string,
        assetName: '',
        maintenanceType: (r.maintenance_type || '') as string,
        description: (r.description || '') as string,
        cost: (r.cost || 0) as number,
        performedBy: (r.performed_by || '') as string,
        performedDate: (r.performed_date || '') as string,
        nextDueDate: (r.next_due_date || '') as string,
        notes: (r.notes || '') as string,
        createdAt: (r.created_at || '') as string,
      })));
    } else {
      setMaintenanceLogs([]);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
    fetchCategories();
    fetchEmployees();
    fetchMaintenanceLogs();
  }, [fetchAssets, fetchCategories, fetchEmployees, fetchMaintenanceLogs]);

  // Straight-line depreciation calculation
  const calcDepreciation = (asset: Asset) => {
    if (!asset.purchaseDate || asset.usefulLifeYears <= 0) return { annual: 0, accumulated: 0, bookValue: asset.purchasePrice };
    const years = (Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const annual = (asset.purchasePrice - asset.salvageValue) / asset.usefulLifeYears;
    const accumulated = Math.min(annual * years, asset.purchasePrice - asset.salvageValue);
    const bookValue = asset.purchasePrice - accumulated;
    return { annual: Math.round(annual), accumulated: Math.round(accumulated), bookValue: Math.round(bookValue) };
  };

  // Usage-based depreciation calculation
  const calcUsageDepreciation = (asset: Asset) => {
    if (asset.serviceLifeHours <= 0) return { accumulated: 0, bookValue: asset.purchasePrice, ratePerHour: 0 };
    const depreciableAmount = asset.purchasePrice - asset.salvageValue;
    const accumulated = Math.min(depreciableAmount * (asset.hoursUsed / asset.serviceLifeHours), depreciableAmount);
    const bookValue = asset.purchasePrice - accumulated;
    const ratePerHour = depreciableAmount / asset.serviceLifeHours;
    return { accumulated: Math.round(accumulated), bookValue: Math.round(bookValue), ratePerHour: Math.round(ratePerHour * 100) / 100 };
  };

  // Effective depreciation based on asset's chosen method
  const calcEffectiveDepreciation = (asset: Asset) => {
    if (asset.depreciationMethod === 'usage_based') {
      const usage = calcUsageDepreciation(asset);
      return { annual: 0, accumulated: usage.accumulated, bookValue: usage.bookValue };
    }
    return calcDepreciation(asset);
  };

  // Remaining service life
  const getRemainingServiceLife = (asset: Asset) => {
    if (asset.serviceLifeHours <= 0) return 0;
    return Math.max(0, asset.serviceLifeHours - asset.hoursUsed);
  };

  // Maintenance status helper
  const getMaintenanceStatus = (nextMaintenanceDate: string): 'ok' | 'upcoming' | 'overdue' => {
    if (!nextMaintenanceDate) return 'ok';
    const next = new Date(nextMaintenanceDate);
    const now = new Date();
    const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'upcoming';
    return 'ok';
  };

  const getMaintenanceStatusColor = (status: 'ok' | 'upcoming' | 'overdue') => {
    if (status === 'overdue') return 'bg-red-100 text-red-800';
    if (status === 'upcoming') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
  };

  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : assetId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dep = calcEffectiveDepreciation(formData);
    const selectedEmployee = employees.find(e => e.id === formData.assignedTo);
    const employeeName = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '';

    const row = {
      name: formData.name,
      category: formData.category,
      serial_number: formData.serialNumber,
      purchase_date: formData.purchaseDate || null,
      purchase_price: formData.purchasePrice,
      current_value: dep.bookValue,
      salvage_value: formData.salvageValue,
      useful_life_years: formData.usefulLifeYears,
      annual_depreciation: calcDepreciation(formData).annual,
      accumulated_depreciation: dep.accumulated,
      replacement_date: formData.nextServiceDate || null,
      capacity: formData.serviceInterval,
      warranty_expiry: formData.warrantyExpiry || null,
      condition: formData.condition,
      status: formData.status,
      location: formData.location,
      assigned_to: formData.assignedTo,
      assignment_date: formData.assignmentDate || null,
      assignment_notes: formData.assignmentNotes,
      notes: formData.notes,
      service_life_hours: formData.serviceLifeHours,
      hours_used: formData.hoursUsed,
      last_maintenance_date: formData.lastMaintenanceDate || null,
      next_maintenance_date: formData.nextMaintenanceDate || null,
      maintenance_interval_days: formData.maintenanceIntervalDays,
      maintenance_cost_total: formData.maintenanceCostTotal,
      operating_cost_total: formData.operatingCostTotal,
      depreciation_method: formData.depreciationMethod,
      usage_depreciation_rate: formData.usageDepreciationRate,
    };

    try {
      if (editingId) {
        // Check if assignment changed to log history
        const existingAsset = assets.find(a => a.id === editingId);
        if (existingAsset && existingAsset.assignedTo !== formData.assignedTo && formData.assignedTo) {
          await supabase.from('asset_assignments').insert({
            asset_id: editingId,
            employee_id: formData.assignedTo,
            employee_name: employeeName,
            assigned_date: formData.assignmentDate || new Date().toISOString().split('T')[0],
            notes: formData.assignmentNotes,
          });
          logAudit({
            action: 'CREATE',
            module: 'Asset Assignments',
            record_id: editingId,
            details: { asset_name: formData.name, employee_name: employeeName },
          });
          // Mark previous assignment as returned
          if (existingAsset.assignedTo) {
            await supabase.from('asset_assignments')
              .update({ returned_date: new Date().toISOString().split('T')[0] })
              .eq('asset_id', editingId)
              .eq('employee_id', existingAsset.assignedTo)
              .is('returned_date', null);
          }
        }
        await supabase.from('assets').update(row).eq('id', editingId);
        logAudit({
          action: 'UPDATE',
          module: 'Assets',
          record_id: editingId,
          details: { name: formData.name, status: formData.status },
        });
      } else {
        const { data: inserted } = await supabase.from('assets').insert(row).select();
        if (inserted && inserted[0]) {
          logAudit({
            action: 'CREATE',
            module: 'Assets',
            record_id: inserted[0].id as string,
            details: { name: formData.name, status: formData.status },
          });
        }
        // Log initial assignment if provided
        if (formData.assignedTo && inserted && inserted[0]) {
          await supabase.from('asset_assignments').insert({
            asset_id: inserted[0].id,
            employee_id: formData.assignedTo,
            employee_name: employeeName,
            assigned_date: formData.assignmentDate || new Date().toISOString().split('T')[0],
            notes: formData.assignmentNotes,
          });
          logAudit({
            action: 'CREATE',
            module: 'Asset Assignments',
            record_id: inserted[0].id as string,
            details: { asset_name: formData.name, employee_name: employeeName },
          });
        }
      }
      await fetchAssets();
    } catch {
      /* fallback */
    }
    setEditingId(null);
    setFormData(emptyAsset);
    setShowForm(false);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCatId) {
        await supabase.from('asset_categories').update({ name: categoryForm.name, description: categoryForm.description }).eq('id', editingCatId);
        logAudit({
          action: 'UPDATE',
          module: 'Asset Categories',
          record_id: editingCatId,
          details: { name: categoryForm.name },
        });
      } else {
        await supabase.from('asset_categories').insert({ name: categoryForm.name, description: categoryForm.description });
        logAudit({
          action: 'CREATE',
          module: 'Asset Categories',
          record_id: categoryForm.name,
          details: { name: categoryForm.name, description: categoryForm.description },
        });
      }
      await fetchCategories();
    } catch {
      setCategories([...categories, { id: Date.now().toString(), ...categoryForm }]);
    }
    setEditingCatId(null);
    setCategoryForm({ name: '', description: '' });
    setShowCategoryForm(false);
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('asset_maintenance_log').insert({
        asset_id: maintenanceFormData.assetId,
        maintenance_type: maintenanceFormData.maintenanceType,
        description: maintenanceFormData.description,
        cost: maintenanceFormData.cost,
        performed_by: maintenanceFormData.performedBy,
        performed_date: maintenanceFormData.performedDate || null,
        next_due_date: maintenanceFormData.nextDueDate || null,
        notes: maintenanceFormData.notes,
      });
      logAudit({
        action: 'CREATE',
        module: 'Asset Maintenance',
        record_id: maintenanceFormData.assetId,
        details: { asset_name: getAssetName(maintenanceFormData.assetId), maintenance_type: maintenanceFormData.maintenanceType, cost: maintenanceFormData.cost },
      });

      // Update the asset's maintenance fields
      const targetAsset = assets.find(a => a.id === maintenanceFormData.assetId);
      if (targetAsset) {
        const updatePayload: Record<string, unknown> = {
          last_maintenance_date: maintenanceFormData.performedDate || null,
          maintenance_cost_total: targetAsset.maintenanceCostTotal + maintenanceFormData.cost,
        };
        if (maintenanceFormData.nextDueDate) {
          updatePayload.next_maintenance_date = maintenanceFormData.nextDueDate;
        }
        await supabase.from('assets').update(updatePayload).eq('id', maintenanceFormData.assetId);
      }

      await fetchAssets();
      await fetchMaintenanceLogs();
    } catch {
      /* fallback */
    }
    setMaintenanceFormData(emptyMaintenanceForm);
    setShowMaintenanceForm(false);
  };

  const handleEdit = (a: Asset) => {
    setFormData(a);
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this asset?')) {
      const deletedAsset = assets.find(a => a.id === id);
      await supabase.from('assets').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Assets',
        record_id: id,
        details: { name: deletedAsset?.name, status: deletedAsset?.status },
      });
      setAssets(assets.filter(a => a.id !== id));
    }
  };

  const handleEditCat = (c: AssetCategory) => {
    setCategoryForm({ name: c.name, description: c.description });
    setEditingCatId(c.id);
    setShowCategoryForm(true);
  };

  const handleDeleteCat = async (id: string) => {
    if (confirm('Delete this category?')) {
      const deletedCat = categories.find(c => c.id === id);
      await supabase.from('asset_categories').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Asset Categories',
        record_id: id,
        details: { name: deletedCat?.name },
      });
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const handleViewDetail = (a: Asset) => {
    setShowDetail(a);
    fetchAssignmentHistory(a.id);
  };

  const filteredAssets = filterCategory === 'All' ? assets : assets.filter(a => a.category === filterCategory);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / ITEMS_PER_PAGE));
  const paginatedAssets = filteredAssets.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Maintenance pagination
  const maintenanceTotalPages = Math.max(1, Math.ceil(maintenanceLogs.length / ITEMS_PER_PAGE));
  const paginatedMaintenanceLogs = maintenanceLogs.slice((maintenancePage - 1) * ITEMS_PER_PAGE, maintenancePage * ITEMS_PER_PAGE);

  // Reset page when filter changes
  useEffect(() => { setCurrentPage(1); }, [filterCategory]);

  // Stats - Row 1
  const totalValue = assets.reduce((s, a) => s + a.purchasePrice, 0);
  const totalBookValue = assets.reduce((s, a) => s + calcEffectiveDepreciation(a).bookValue, 0);
  const assignedCount = assets.filter(a => a.assignedTo && a.assignedTo.trim() !== '').length;

  // Stats - Row 2
  const totalDepreciation = assets.reduce((s, a) => s + calcEffectiveDepreciation(a).accumulated, 0);
  const maintenanceDueCount = assets.filter(a => {
    const status = getMaintenanceStatus(a.nextMaintenanceDate);
    return status === 'overdue' || status === 'upcoming';
  }).length;
  const totalCostsIncurred = assets.reduce((s, a) => s + a.maintenanceCostTotal + a.operatingCostTotal, 0);
  const avgAssetAge = assets.length > 0
    ? assets.reduce((s, a) => {
        if (!a.purchaseDate) return s;
        return s + (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      }, 0) / assets.filter(a => !!a.purchaseDate).length || 0
    : 0;

  const inputClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none';
  const inputBgClass = 'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Asset Management</h1>
        <p className="text-muted-foreground">Register, track, depreciate, assign, and service business assets</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Assets</p>
          <p className="text-2xl font-bold">{assets.length}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Purchase Value</p>
          <p className="text-2xl font-bold">KES {totalValue.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Book Value</p>
          <p className="text-2xl font-bold text-green-600">KES {totalBookValue.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Assigned Assets</p>
          <p className="text-2xl font-bold text-blue-600">{assignedCount}</p>
        </div>
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Depreciation</p>
          <p className="text-2xl font-bold text-red-600">KES {totalDepreciation.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Maintenance Due</p>
          <p className={`text-2xl font-bold ${maintenanceDueCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{maintenanceDueCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Costs Incurred</p>
          <p className="text-2xl font-bold">KES {totalCostsIncurred.toLocaleString()}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Avg Asset Age</p>
          <p className="text-2xl font-bold">{avgAssetAge.toFixed(1)} yrs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        {(['assets', 'categories', 'maintenance'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors capitalize ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* -- ASSETS TAB -- */}
      {activeTab === 'assets' && (
        <>
          <div className="mb-6 flex justify-between items-center">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => { setEditingId(null); setFormData(emptyAsset); setShowForm(true); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              + Register Asset
            </button>
          </div>

          {/* -- FORM MODAL -- */}
          <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit Asset' : 'Register Asset'} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
              {/* Basic Info Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Basic Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Asset Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputBgClass} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Category *</label>
                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={inputBgClass} required>
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Serial Number</label>
                    <input type="text" value={formData.serialNumber} onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Purchase Date</label>
                    <input type="date" value={formData.purchaseDate} onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
              </div>

              {/* Financial Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Financial</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Purchase Price (KES)</label>
                    <input type="number" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Salvage Value (KES)</label>
                    <input type="number" value={formData.salvageValue} onChange={(e) => setFormData({ ...formData, salvageValue: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Useful Life (Years)</label>
                    <input type="number" value={formData.usefulLifeYears} onChange={(e) => setFormData({ ...formData, usefulLifeYears: parseInt(e.target.value) || 1 })} className={inputBgClass} />
                  </div>
                </div>
                {formData.purchasePrice > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-background p-2 rounded">
                      <span className="text-muted-foreground">Annual Depreciation:</span>
                      <p className="font-bold">KES {calcDepreciation(formData).annual.toLocaleString()}</p>
                    </div>
                    <div className="bg-background p-2 rounded">
                      <span className="text-muted-foreground">Accumulated:</span>
                      <p className="font-bold text-red-600">KES {calcEffectiveDepreciation(formData).accumulated.toLocaleString()}</p>
                    </div>
                    <div className="bg-background p-2 rounded">
                      <span className="text-muted-foreground">Book Value:</span>
                      <p className="font-bold text-green-600">KES {calcEffectiveDepreciation(formData).bookValue.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Life & Usage Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Service Life & Usage</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Service Life (Hours)</label>
                    <input type="number" value={formData.serviceLifeHours} onChange={(e) => setFormData({ ...formData, serviceLifeHours: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Hours Used</label>
                    <input type="number" value={formData.hoursUsed} onChange={(e) => setFormData({ ...formData, hoursUsed: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Depreciation Method</label>
                    <select value={formData.depreciationMethod} onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value as Asset['depreciationMethod'] })} className={inputBgClass}>
                      <option value="straight_line">Straight Line</option>
                      <option value="usage_based">Usage Based</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Usage Depreciation Rate (KES/hr)</label>
                    <input type="number" step="0.01" value={formData.usageDepreciationRate} onChange={(e) => setFormData({ ...formData, usageDepreciationRate: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                </div>
                {formData.serviceLifeHours > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Service Life Progress</span>
                      <span>{formData.hoursUsed} / {formData.serviceLifeHours} hrs ({Math.round((formData.hoursUsed / formData.serviceLifeHours) * 100)}%)</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${(formData.hoursUsed / formData.serviceLifeHours) > 0.9 ? 'bg-red-500' : (formData.hoursUsed / formData.serviceLifeHours) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (formData.hoursUsed / formData.serviceLifeHours) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Maintenance Schedule Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Maintenance Schedule</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Maintenance Interval (Days)</label>
                    <input type="number" value={formData.maintenanceIntervalDays} onChange={(e) => setFormData({ ...formData, maintenanceIntervalDays: parseInt(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Last Maintenance Date</label>
                    <input type="date" value={formData.lastMaintenanceDate} onChange={(e) => setFormData({ ...formData, lastMaintenanceDate: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Next Maintenance Date</label>
                    <input type="date" value={formData.nextMaintenanceDate} onChange={(e) => setFormData({ ...formData, nextMaintenanceDate: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
              </div>

              {/* Cost Tracking Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Cost Tracking</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Total Maintenance Cost (KES)</label>
                    <div className="w-full px-3 py-2 border border-border rounded-lg bg-secondary/50 text-sm">
                      KES {formData.maintenanceCostTotal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Total Operating Cost (KES)</label>
                    <div className="w-full px-3 py-2 border border-border rounded-lg bg-secondary/50 text-sm">
                      KES {formData.operatingCostTotal.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Service & Warranty Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Service & Warranty</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Next Service Date</label>
                    <input type="date" value={formData.nextServiceDate} onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Service Interval</label>
                    <select value={formData.serviceInterval} onChange={(e) => setFormData({ ...formData, serviceInterval: e.target.value })} className={inputBgClass}>
                      <option value="">None</option>
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Bi-Annual</option>
                      <option>Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Warranty Expiry</label>
                    <input type="date" value={formData.warrantyExpiry} onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
              </div>

              {/* Assignment Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Assignment</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Assign to Employee</label>
                    <select value={formData.assignedTo} onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })} className={inputBgClass}>
                      <option value="">Unassigned</option>
                      {employees.filter(e => e.status === 'Active').map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} — {emp.role || emp.department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Assignment Date</label>
                    <input type="date" value={formData.assignmentDate} onChange={(e) => setFormData({ ...formData, assignmentDate: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1">Assignment Notes</label>
                  <input type="text" placeholder="e.g. Assigned for daily deliveries" value={formData.assignmentNotes} onChange={(e) => setFormData({ ...formData, assignmentNotes: e.target.value })} className={inputBgClass} />
                </div>
              </div>

              {/* Condition, Status, Location, Notes */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Status & Details</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Condition</label>
                    <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as Asset['condition'] })} className={inputBgClass}>
                      <option>Excellent</option>
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Asset['status'] })} className={inputBgClass}>
                      <option>Active</option>
                      <option>Under Repair</option>
                      <option>Disposed</option>
                      <option>Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Location</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={inputBgClass} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputBgClass} rows={2} />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">{editingId ? 'Update' : 'Register'} Asset</button>
              </div>
            </form>
          </Modal>

          {/* -- DETAIL MODAL -- */}
          <Modal isOpen={!!showDetail} onClose={() => { setShowDetail(null); setAssignmentHistory([]); }} title={showDetail?.name || ''} size="2xl">
            {showDetail && (() => {
              const depStraight = calcDepreciation(showDetail);
              const depUsage = calcUsageDepreciation(showDetail);
              const depEffective = calcEffectiveDepreciation(showDetail);
              const remainingLife = getRemainingServiceLife(showDetail);
              const serviceLifePercent = showDetail.serviceLifeHours > 0 ? (showDetail.hoursUsed / showDetail.serviceLifeHours) * 100 : 0;
              const maintStatus = getMaintenanceStatus(showDetail.nextMaintenanceDate);
              const totalCostOfOwnership = showDetail.purchasePrice + showDetail.maintenanceCostTotal + showDetail.operatingCostTotal;
              return (
                <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2 text-sm">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div><span className="text-muted-foreground">Category:</span> <strong className="ml-2">{showDetail.category}</strong></div>
                    <div><span className="text-muted-foreground">Serial Number:</span> <strong className="ml-2">{showDetail.serialNumber || '---'}</strong></div>
                    <div><span className="text-muted-foreground">Purchase Date:</span> <strong className="ml-2">{showDetail.purchaseDate || '---'}</strong></div>
                    <div><span className="text-muted-foreground">Condition:</span> <strong className="ml-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${showDetail.condition === 'Excellent' ? 'bg-green-100 text-green-800' : showDetail.condition === 'Good' ? 'bg-blue-100 text-blue-800' : showDetail.condition === 'Fair' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{showDetail.condition}</span>
                    </strong></div>
                    <div><span className="text-muted-foreground">Status:</span> <strong className="ml-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${showDetail.status === 'Active' ? 'bg-green-100 text-green-800' : showDetail.status === 'Under Repair' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>{showDetail.status}</span>
                    </strong></div>
                    <div><span className="text-muted-foreground">Location:</span> <strong className="ml-2">{showDetail.location || '---'}</strong></div>
                  </div>

                  {/* Cost Analysis */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Cost Analysis</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 border border-border rounded-lg text-center bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Purchase Price</p>
                        <p className="text-lg font-bold">KES {showDetail.purchasePrice.toLocaleString()}</p>
                      </div>
                      <div className="p-3 border border-border rounded-lg text-center bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Maintenance Costs</p>
                        <p className="text-lg font-bold text-orange-600">KES {showDetail.maintenanceCostTotal.toLocaleString()}</p>
                      </div>
                      <div className="p-3 border border-border rounded-lg text-center bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Operating Costs</p>
                        <p className="text-lg font-bold text-blue-600">KES {showDetail.operatingCostTotal.toLocaleString()}</p>
                      </div>
                      <div className="p-3 border border-border rounded-lg text-center bg-primary/10">
                        <p className="text-xs text-muted-foreground">Total Cost of Ownership</p>
                        <p className="text-lg font-bold">KES {totalCostOfOwnership.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Depreciation Analysis */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Depreciation Analysis</p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Straight-Line */}
                      <div className={`p-3 border rounded-lg ${showDetail.depreciationMethod === 'straight_line' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold">Straight-Line</p>
                          {showDetail.depreciationMethod === 'straight_line' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary">Active</span>
                          )}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Annual:</span>
                            <span className="font-bold">KES {depStraight.annual.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Accumulated:</span>
                            <span className="font-bold text-red-600">KES {depStraight.accumulated.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Book Value:</span>
                            <span className="font-bold text-green-600">KES {depStraight.bookValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      {/* Usage-Based */}
                      <div className={`p-3 border rounded-lg ${showDetail.depreciationMethod === 'usage_based' ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold">Usage-Based</p>
                          {showDetail.depreciationMethod === 'usage_based' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/20 text-primary">Active</span>
                          )}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rate/Hour:</span>
                            <span className="font-bold">KES {depUsage.ratePerHour.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Accumulated:</span>
                            <span className="font-bold text-red-600">KES {depUsage.accumulated.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Book Value:</span>
                            <span className="font-bold text-green-600">KES {depUsage.bookValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2 bg-secondary/30 rounded text-center">
                        <span className="text-muted-foreground">Effective Book Value:</span>
                        <p className="font-bold text-green-600">KES {depEffective.bookValue.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-secondary/30 rounded text-center">
                        <span className="text-muted-foreground">Salvage Value:</span>
                        <p className="font-bold">KES {showDetail.salvageValue.toLocaleString()}</p>
                      </div>
                      <div className="p-2 bg-secondary/30 rounded text-center">
                        <span className="text-muted-foreground">Useful Life:</span>
                        <p className="font-bold">{showDetail.usefulLifeYears} years</p>
                      </div>
                    </div>
                  </div>

                  {/* Service Life */}
                  {showDetail.serviceLifeHours > 0 && (
                    <div className="border border-border rounded-lg p-4">
                      <p className="text-sm font-semibold mb-3">Service Life</p>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Hours Used: {showDetail.hoursUsed.toLocaleString()} hrs</span>
                          <span>Remaining: {remainingLife.toLocaleString()} hrs</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${serviceLifePercent > 90 ? 'bg-red-500' : serviceLifePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, serviceLifePercent)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          {Math.round(serviceLifePercent)}% of {showDetail.serviceLifeHours.toLocaleString()} hrs total service life used
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Maintenance Schedule */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Maintenance Schedule</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 border border-border rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Last Maintenance</p>
                        <p className="font-bold">{showDetail.lastMaintenanceDate || 'N/A'}</p>
                      </div>
                      <div className={`p-3 border rounded-lg ${maintStatus === 'overdue' ? 'border-red-300 bg-red-50' : maintStatus === 'upcoming' ? 'border-yellow-300 bg-yellow-50' : 'border-border bg-secondary/30'}`}>
                        <p className="text-xs text-muted-foreground">Next Maintenance</p>
                        <p className={`font-bold ${maintStatus === 'overdue' ? 'text-red-600' : maintStatus === 'upcoming' ? 'text-yellow-700' : ''}`}>
                          {showDetail.nextMaintenanceDate || 'N/A'}
                        </p>
                        {maintStatus === 'overdue' && <p className="text-xs text-red-600 font-semibold mt-1">OVERDUE</p>}
                        {maintStatus === 'upcoming' && <p className="text-xs text-yellow-700 font-semibold mt-1">DUE SOON</p>}
                      </div>
                      <div className="p-3 border border-border rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Interval</p>
                        <p className="font-bold">{showDetail.maintenanceIntervalDays} days</p>
                      </div>
                    </div>
                  </div>

                  {/* Service & Warranty */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Service & Warranty</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 border border-border rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Next Service</p>
                        <p className="font-bold">{showDetail.nextServiceDate || 'N/A'}</p>
                      </div>
                      <div className="p-3 border border-border rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Service Interval</p>
                        <p className="font-bold">{showDetail.serviceInterval || 'N/A'}</p>
                      </div>
                      <div className="p-3 border border-border rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Warranty Expiry</p>
                        <p className={`font-bold ${showDetail.warrantyExpiry && new Date(showDetail.warrantyExpiry) < new Date() ? 'text-red-600' : ''}`}>
                          {showDetail.warrantyExpiry || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current Assignment */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Current Assignment</p>
                    {showDetail.assignedTo ? (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        <div><span className="text-muted-foreground">Assigned To:</span> <strong className="ml-2">{getEmployeeName(showDetail.assignedTo)}</strong></div>
                        <div><span className="text-muted-foreground">Assignment Date:</span> <strong className="ml-2">{showDetail.assignmentDate || '---'}</strong></div>
                        {showDetail.assignmentNotes && (
                          <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> <span className="ml-2">{showDetail.assignmentNotes}</span></div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">This asset is currently unassigned.</p>
                    )}
                  </div>

                  {/* Assignment History */}
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-3">Assignment History</p>
                    {assignmentHistory.length > 0 ? (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-secondary border-b border-border">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Employee</th>
                              <th className="px-3 py-2 text-left font-semibold">Assigned</th>
                              <th className="px-3 py-2 text-left font-semibold">Returned</th>
                              <th className="px-3 py-2 text-left font-semibold">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignmentHistory.map(record => (
                              <tr key={record.id} className="border-b border-border hover:bg-secondary/50">
                                <td className="px-3 py-2 font-medium">{record.employeeName || getEmployeeName(record.employeeId)}</td>
                                <td className="px-3 py-2">{record.assignedDate}</td>
                                <td className="px-3 py-2">
                                  {record.returnedDate ? (
                                    <span>{record.returnedDate}</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">Current</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{record.notes || '---'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">No assignment history recorded for this asset.</p>
                    )}
                  </div>

                  {/* Notes */}
                  {showDetail.notes && (
                    <div className="border border-border rounded-lg p-4">
                      <p className="text-sm font-semibold mb-2">Notes</p>
                      <p className="text-muted-foreground">{showDetail.notes}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </Modal>

          {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>}

          {/* Assets Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Asset</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Serial</th>
                  <th className="px-4 py-3 text-left font-semibold">Condition</th>
                  <th className="px-4 py-3 text-right font-semibold">Purchase</th>
                  <th className="px-4 py-3 text-right font-semibold">Book Value</th>
                  <th className="px-4 py-3 text-left font-semibold">Assigned To</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Next Maintenance</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.length === 0 && !loading ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No assets found</td></tr>
                ) : paginatedAssets.map(a => {
                  const dep = calcEffectiveDepreciation(a);
                  const maintStatus = getMaintenanceStatus(a.nextMaintenanceDate);
                  return (
                    <tr key={a.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3 text-xs"><span className="px-2 py-0.5 rounded bg-secondary">{a.category}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.serialNumber || '---'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${a.condition === 'Excellent' ? 'bg-green-100 text-green-800' : a.condition === 'Good' ? 'bg-blue-100 text-blue-800' : a.condition === 'Fair' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {a.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">KES {a.purchasePrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">KES {dep.bookValue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">
                        {a.assignedTo ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">{getEmployeeName(a.assignedTo)}</span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${a.status === 'Active' ? 'bg-green-100 text-green-800' : a.status === 'Under Repair' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.nextMaintenanceDate ? (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getMaintenanceStatusColor(maintStatus)}`}>
                            {a.nextMaintenanceDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">---</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => handleViewDetail(a)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                          <button onClick={() => handleEdit(a)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                          <button onClick={() => handleDelete(a.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredAssets.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length)} of {filteredAssets.length} assets
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* -- CATEGORIES TAB -- */}
      {activeTab === 'categories' && (
        <>
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => { setEditingCatId(null); setCategoryForm({ name: '', description: '' }); setShowCategoryForm(true); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              + Add Category
            </button>
          </div>

          <Modal isOpen={showCategoryForm} onClose={() => setShowCategoryForm(false)} title={editingCatId ? 'Edit Category' : 'Add Asset Category'} size="sm">
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <input type="text" placeholder="Category Name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className={inputClass} required />
              <textarea placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} className={inputClass} rows={3} />
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => setShowCategoryForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">{editingCatId ? 'Update' : 'Add'} Category</button>
              </div>
            </form>
          </Modal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => {
              const count = assets.filter(a => a.category === cat.name).length;
              const value = assets.filter(a => a.category === cat.name).reduce((s, a) => s + a.purchasePrice, 0);
              return (
                <div key={cat.id} className="p-5 border border-border rounded-lg bg-card hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold">{cat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{count}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Total Value: <strong>KES {value.toLocaleString()}</strong></p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditCat(cat)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                    <button onClick={() => handleDeleteCat(cat.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* -- MAINTENANCE TAB -- */}
      {activeTab === 'maintenance' && (
        <>
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => { setMaintenanceFormData(emptyMaintenanceForm); setShowMaintenanceForm(true); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              + Add Maintenance Record
            </button>
          </div>

          {/* Maintenance Form Modal */}
          <Modal isOpen={showMaintenanceForm} onClose={() => setShowMaintenanceForm(false)} title="Add Maintenance Record" size="2xl">
            <form onSubmit={handleMaintenanceSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <p className="text-sm font-semibold mb-3">Maintenance Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Asset *</label>
                    <select value={maintenanceFormData.assetId} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, assetId: e.target.value })} className={inputBgClass} required>
                      <option value="">Select Asset</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.serialNumber || 'No Serial'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Maintenance Type *</label>
                    <select value={maintenanceFormData.maintenanceType} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, maintenanceType: e.target.value })} className={inputBgClass} required>
                      <option value="Routine">Routine</option>
                      <option value="Repair">Repair</option>
                      <option value="Inspection">Inspection</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Description *</label>
                    <input type="text" value={maintenanceFormData.description} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, description: e.target.value })} className={inputBgClass} required />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Cost (KES)</label>
                    <input type="number" value={maintenanceFormData.cost} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, cost: parseFloat(e.target.value) || 0 })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Performed By</label>
                    <input type="text" value={maintenanceFormData.performedBy} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, performedBy: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Performed Date</label>
                    <input type="date" value={maintenanceFormData.performedDate} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, performedDate: e.target.value })} className={inputBgClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Next Due Date</label>
                    <input type="date" value={maintenanceFormData.nextDueDate} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, nextDueDate: e.target.value })} className={inputBgClass} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                    <textarea value={maintenanceFormData.notes} onChange={(e) => setMaintenanceFormData({ ...maintenanceFormData, notes: e.target.value })} className={inputBgClass} rows={2} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => setShowMaintenanceForm(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">Add Record</button>
              </div>
            </form>
          </Modal>

          {/* Maintenance Logs Table */}
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Asset Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 text-left font-semibold">Performed By</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Next Due</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMaintenanceLogs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No maintenance records found</td></tr>
                ) : paginatedMaintenanceLogs.map(log => {
                  const nextDueStatus = getMaintenanceStatus(log.nextDueDate);
                  return (
                    <tr key={log.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium">{getAssetName(log.assetId)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${log.maintenanceType === 'Routine' ? 'bg-blue-100 text-blue-800' : log.maintenanceType === 'Repair' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}`}>
                          {log.maintenanceType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.description}</td>
                      <td className="px-4 py-3 text-right">KES {log.cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">{log.performedBy || '---'}</td>
                      <td className="px-4 py-3 text-xs">{log.performedDate || '---'}</td>
                      <td className="px-4 py-3 text-xs">
                        {log.nextDueDate ? (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getMaintenanceStatusColor(nextDueStatus)}`}>
                            {log.nextDueDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Maintenance Pagination */}
          {maintenanceLogs.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((maintenancePage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(maintenancePage * ITEMS_PER_PAGE, maintenanceLogs.length)} of {maintenanceLogs.length} records
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setMaintenancePage(p => Math.max(1, p - 1))}
                  disabled={maintenancePage === 1}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: maintenanceTotalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setMaintenancePage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${maintenancePage === page ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-secondary'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setMaintenancePage(p => Math.min(maintenanceTotalPages, p + 1))}
                  disabled={maintenancePage === maintenanceTotalPages}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
