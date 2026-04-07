'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/modal';
import { logAudit } from '@/lib/audit-logger';

// ─── Types ───────────────────────────────────────────────────────────────────

type PolicyType = 'Vehicle' | 'Asset' | 'Employee' | 'Business' | 'Liability';
type PolicyStatus = 'Active' | 'Expired' | 'Cancelled' | 'Pending';
type PremiumFrequency = 'Monthly' | 'Quarterly' | 'Annual';
type BenefitType = 'WIBA' | 'Group Life' | 'Medical' | 'Pension';
type ClaimStatus = 'Filed' | 'Under Review' | 'Approved' | 'Rejected' | 'Settled';
type TabKey = 'all' | 'vehicle' | 'asset' | 'employee' | 'business' | 'claims';

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  policyType: PolicyType;
  provider: string;
  providerContact: string;
  providerEmail: string;
  coverageType: string;
  premiumAmount: number;
  premiumFrequency: PremiumFrequency;
  coverageAmount: number;
  deductible: number;
  startDate: string;
  endDate: string;
  renewalDate: string;
  status: PolicyStatus;
  entityType: string;
  entityId: string;
  entityName: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  employeeIdNumber: string;
  benefitType: BenefitType | '';
  outletId: string;
  outletName: string;
  totalClaims: number;
  totalClaimedAmount: number;
  documentUrl: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface InsuranceClaim {
  id: string;
  policyId: string;
  claimNumber: string;
  claimDate: string;
  incidentDate: string;
  description: string;
  claimAmount: number;
  approvedAmount: number;
  status: ClaimStatus;
  settlementDate: string;
  documentsUrl: string;
  adjusterName: string;
  adjusterContact: string;
  notes: string;
  filedBy: string;
  createdAt: string;
  // joined
  policyNumber?: string;
  policyType?: string;
  entityName?: string;
}

interface AssetOption {
  id: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
  purchasePrice: number;
  currentValue: number;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeIdNumber: string;
  category: string;
  status: string;
}

interface OutletOption {
  id: string;
  name: string;
  outletType: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;
const POLICY_TYPES: PolicyType[] = ['Vehicle', 'Asset', 'Employee', 'Business', 'Liability'];
const POLICY_STATUSES: PolicyStatus[] = ['Active', 'Expired', 'Cancelled', 'Pending'];
const PREMIUM_FREQUENCIES: PremiumFrequency[] = ['Monthly', 'Quarterly', 'Annual'];
const BENEFIT_TYPES: BenefitType[] = ['WIBA', 'Group Life', 'Medical', 'Pension'];
const CLAIM_STATUSES: ClaimStatus[] = ['Filed', 'Under Review', 'Approved', 'Rejected', 'Settled'];

const VEHICLE_COVERAGE_TYPES = ['Comprehensive', 'Third Party Only', 'Third Party Fire & Theft'];
const ASSET_COVERAGE_TYPES = ['All Risk', 'Fire & Perils', 'Burglary', 'Electronic Equipment', 'Machinery Breakdown'];
const EMPLOYEE_COVERAGE_TYPES = ['WIBA', 'Group Life Assurance', 'Group Medical', 'Group Pension', 'Group Personal Accident'];
const BUSINESS_COVERAGE_TYPES = ['Public Liability', 'Product Liability', 'Professional Indemnity', 'Business Interruption', 'Property All Risk', 'Fidelity Guarantee', 'Money Insurance'];

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Policies' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'asset', label: 'Asset' },
  { key: 'employee', label: 'Employee' },
  { key: 'business', label: 'Business/Outlet' },
  { key: 'claims', label: 'Claims' },
];

const emptyPolicy: Omit<InsurancePolicy, 'id' | 'createdAt' | 'updatedAt'> = {
  policyNumber: '',
  policyType: 'Vehicle',
  provider: '',
  providerContact: '',
  providerEmail: '',
  coverageType: '',
  premiumAmount: 0,
  premiumFrequency: 'Annual',
  coverageAmount: 0,
  deductible: 0,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  renewalDate: '',
  status: 'Active',
  entityType: '',
  entityId: '',
  entityName: '',
  vehicleRegistration: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: new Date().getFullYear(),
  employeeIdNumber: '',
  benefitType: '',
  outletId: '',
  outletName: '',
  totalClaims: 0,
  totalClaimedAmount: 0,
  documentUrl: '',
  notes: '',
  createdBy: '',
};

const emptyClaim: Omit<InsuranceClaim, 'id' | 'createdAt'> = {
  policyId: '',
  claimNumber: '',
  claimDate: new Date().toISOString().split('T')[0],
  incidentDate: '',
  description: '',
  claimAmount: 0,
  approvedAmount: 0,
  status: 'Filed',
  settlementDate: '',
  documentsUrl: '',
  adjusterName: '',
  adjusterContact: '',
  notes: '',
  filedBy: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '---';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpiringSoon(dateStr: string): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30 && diffDays >= 0;
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function daysUntilExpiry(dateStr: string): number {
  if (!dateStr) return 999;
  const expiry = new Date(dateStr);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function generatePolicyNumber(type: PolicyType): string {
  const typeCode: Record<PolicyType, string> = {
    Vehicle: 'VEH',
    Asset: 'AST',
    Employee: 'EMP',
    Business: 'BIZ',
    Liability: 'LBL',
  };
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INS-${typeCode[type]}-${dateStr}-${rand}`;
}

function generateClaimNumber(): string {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CLM-${dateStr}-${rand}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Active': return 'bg-green-100 text-green-800';
    case 'Expired': return 'bg-red-100 text-red-800';
    case 'Cancelled': return 'bg-gray-100 text-gray-800';
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Filed': return 'bg-blue-100 text-blue-800';
    case 'Under Review': return 'bg-yellow-100 text-yellow-800';
    case 'Approved': return 'bg-green-100 text-green-800';
    case 'Rejected': return 'bg-red-100 text-red-800';
    case 'Settled': return 'bg-purple-100 text-purple-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPolicyTypeIcon(type: PolicyType): string {
  switch (type) {
    case 'Vehicle': return '\u{1F697}';
    case 'Asset': return '\u{1F3ED}';
    case 'Employee': return '\u{1F465}';
    case 'Business': return '\u{1F3E2}';
    case 'Liability': return '\u{1F6E1}';
    default: return '\u{1F4CB}';
  }
}

function dbToPolicy(r: Record<string, unknown>): InsurancePolicy {
  return {
    id: r.id as string,
    policyNumber: (r.policy_number || '') as string,
    policyType: (r.policy_type || 'Vehicle') as PolicyType,
    provider: (r.provider || '') as string,
    providerContact: (r.provider_contact || '') as string,
    providerEmail: (r.provider_email || '') as string,
    coverageType: (r.coverage_type || '') as string,
    premiumAmount: (r.premium_amount || 0) as number,
    premiumFrequency: (r.premium_frequency || 'Annual') as PremiumFrequency,
    coverageAmount: (r.coverage_amount || 0) as number,
    deductible: (r.deductible || 0) as number,
    startDate: (r.start_date || '') as string,
    endDate: (r.end_date || '') as string,
    renewalDate: (r.renewal_date || '') as string,
    status: (r.status || 'Active') as PolicyStatus,
    entityType: (r.entity_type || '') as string,
    entityId: (r.entity_id || '') as string,
    entityName: (r.entity_name || '') as string,
    vehicleRegistration: (r.vehicle_registration || '') as string,
    vehicleMake: (r.vehicle_make || '') as string,
    vehicleModel: (r.vehicle_model || '') as string,
    vehicleYear: (r.vehicle_year || new Date().getFullYear()) as number,
    employeeIdNumber: (r.employee_id_number || '') as string,
    benefitType: (r.benefit_type || '') as BenefitType | '',
    outletId: (r.outlet_id || '') as string,
    outletName: (r.outlet_name || '') as string,
    totalClaims: (r.total_claims || 0) as number,
    totalClaimedAmount: (r.total_claimed_amount || 0) as number,
    documentUrl: (r.document_url || '') as string,
    notes: (r.notes || '') as string,
    createdBy: (r.created_by || '') as string,
    createdAt: (r.created_at || '') as string,
    updatedAt: (r.updated_at || '') as string,
  };
}

function dbToClaim(r: Record<string, unknown>): InsuranceClaim {
  return {
    id: r.id as string,
    policyId: (r.policy_id || '') as string,
    claimNumber: (r.claim_number || '') as string,
    claimDate: (r.claim_date || '') as string,
    incidentDate: (r.incident_date || '') as string,
    description: (r.description || '') as string,
    claimAmount: (r.claim_amount || 0) as number,
    approvedAmount: (r.approved_amount || 0) as number,
    status: (r.status || 'Filed') as ClaimStatus,
    settlementDate: (r.settlement_date || '') as string,
    documentsUrl: (r.documents_url || '') as string,
    adjusterName: (r.adjuster_name || '') as string,
    adjusterContact: (r.adjuster_contact || '') as string,
    notes: (r.notes || '') as string,
    filedBy: (r.filed_by || '') as string,
    createdAt: (r.created_at || '') as string,
  };
}

function policyToDbRow(form: typeof emptyPolicy) {
  return {
    policy_number: form.policyNumber,
    policy_type: form.policyType,
    provider: form.provider,
    provider_contact: form.providerContact,
    provider_email: form.providerEmail,
    coverage_type: form.coverageType,
    premium_amount: form.premiumAmount,
    premium_frequency: form.premiumFrequency,
    coverage_amount: form.coverageAmount,
    deductible: form.deductible,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    renewal_date: form.renewalDate || null,
    status: form.status,
    entity_type: form.entityType,
    entity_id: form.entityId || null,
    entity_name: form.entityName,
    vehicle_registration: form.vehicleRegistration,
    vehicle_make: form.vehicleMake,
    vehicle_model: form.vehicleModel,
    vehicle_year: form.vehicleYear || null,
    employee_id_number: form.employeeIdNumber,
    benefit_type: form.benefitType || null,
    outlet_id: form.outletId || null,
    outlet_name: form.outletName,
    total_claims: form.totalClaims,
    total_claimed_amount: form.totalClaimedAmount,
    document_url: form.documentUrl,
    notes: form.notes,
    created_by: form.createdBy,
  };
}

function claimToDbRow(form: typeof emptyClaim) {
  return {
    policy_id: form.policyId || null,
    claim_number: form.claimNumber,
    claim_date: form.claimDate || null,
    incident_date: form.incidentDate || null,
    description: form.description,
    claim_amount: form.claimAmount,
    approved_amount: form.approvedAmount,
    status: form.status,
    settlement_date: form.settlementDate || null,
    documents_url: form.documentsUrl,
    adjuster_name: form.adjusterName,
    adjuster_contact: form.adjusterContact,
    notes: form.notes,
    filed_by: form.filedBy,
  };
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportPDF(title: string, headers: string[], rows: string[][]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td style="border:1px solid #ddd;padding:6px 8px;font-size:11px;">${cell}</td>`).join('')}</tr>`
  ).join('');
  const tableHeaders = headers.map(h =>
    `<th style="border:1px solid #ddd;padding:6px 8px;background:#f3f4f6;font-size:11px;text-align:left;">${h}</th>`
  ).join('');
  printWindow.document.write(`
    <html><head><title>${title}</title></head><body style="font-family:Arial,sans-serif;padding:20px;">
    <h2 style="margin-bottom:10px;">${title}</h2>
    <p style="color:#666;font-size:12px;">Generated: ${new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
    </table></body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InsurancePage() {
  // Data
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  // Policy form
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState(emptyPolicy);
  const [showPolicyDetail, setShowPolicyDetail] = useState<InsurancePolicy | null>(null);

  // Claim form
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [claimForm, setClaimForm] = useState(emptyClaim);
  const [showClaimDetail, setShowClaimDetail] = useState<InsuranceClaim | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterEntity, setFilterEntity] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [claimPage, setClaimPage] = useState(1);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('insurance_policies').select('*').order('created_at', { ascending: false });
    if (data) {
      setPolicies(data.map((r: Record<string, unknown>) => dbToPolicy(r)));
    } else {
      setPolicies([]);
    }
    setLoading(false);
  }, []);

  const fetchClaims = useCallback(async () => {
    const { data } = await supabase.from('insurance_claims').select('*').order('created_at', { ascending: false });
    if (data) {
      setClaims(data.map((r: Record<string, unknown>) => dbToClaim(r)));
    } else {
      setClaims([]);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    const { data } = await supabase.from('assets').select('id, name, category, serial_number, status, purchase_price, current_value').order('name', { ascending: true });
    if (data) {
      setAssets(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        category: (r.category || '') as string,
        serialNumber: (r.serial_number || '') as string,
        status: (r.status || '') as string,
        purchasePrice: (r.purchase_price || 0) as number,
        currentValue: (r.current_value || 0) as number,
      })));
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, first_name, last_name, employee_id_number, category, status').order('first_name', { ascending: true });
    if (data) {
      setEmployees(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name || '') as string,
        lastName: (r.last_name || '') as string,
        employeeIdNumber: (r.employee_id_number || '') as string,
        category: (r.category || '') as string,
        status: (r.status || '') as string,
      })));
    }
  }, []);

  const fetchOutlets = useCallback(async () => {
    const { data } = await supabase.from('outlets').select('id, name, outlet_type, status').order('name', { ascending: true });
    if (data) {
      setOutlets(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        outletType: (r.outlet_type || '') as string,
        status: (r.status || '') as string,
      })));
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchClaims();
    fetchAssets();
    fetchEmployees();
    fetchOutlets();
  }, [fetchPolicies, fetchClaims, fetchAssets, fetchEmployees, fetchOutlets]);

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = policies.length;
    const active = policies.filter(p => p.status === 'Active').length;
    const expiringSoon = policies.filter(p => p.status === 'Active' && isExpiringSoon(p.endDate)).length;
    const totalPremiums = policies.filter(p => p.status === 'Active').reduce((s, p) => s + Number(p.premiumAmount), 0);
    const totalClaimCount = claims.length;
    const totalClaimedAmt = claims.reduce((s, c) => s + Number(c.claimAmount), 0);
    const pendingClaims = claims.filter(c => c.status === 'Filed' || c.status === 'Under Review').length;
    const expiredCount = policies.filter(p => isExpired(p.endDate) && p.status === 'Active').length;
    return { total, active, expiringSoon, totalPremiums, totalClaimCount, totalClaimedAmt, pendingClaims, expiredCount };
  }, [policies, claims]);

  // ─── Filtered Policies ─────────────────────────────────────────────────────

  const filteredPolicies = useMemo(() => {
    let result = policies;

    // Tab filter
    if (activeTab === 'vehicle') result = result.filter(p => p.policyType === 'Vehicle');
    else if (activeTab === 'asset') result = result.filter(p => p.policyType === 'Asset');
    else if (activeTab === 'employee') result = result.filter(p => p.policyType === 'Employee');
    else if (activeTab === 'business') result = result.filter(p => p.policyType === 'Business' || p.policyType === 'Liability');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.policyNumber.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        p.entityName.toLowerCase().includes(q) ||
        p.vehicleRegistration.toLowerCase().includes(q) ||
        p.coverageType.toLowerCase().includes(q) ||
        p.outletName.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'All') {
      result = result.filter(p => p.policyType === filterType);
    }

    if (filterStatus !== 'All') {
      result = result.filter(p => p.status === filterStatus);
    }

    if (filterEntity !== 'All') {
      result = result.filter(p => p.entityName === filterEntity);
    }

    return result;
  }, [policies, activeTab, searchQuery, filterType, filterStatus, filterEntity]);

  const filteredClaims = useMemo(() => {
    let result = claims.map(c => {
      const policy = policies.find(p => p.id === c.policyId);
      return { ...c, policyNumber: policy?.policyNumber || '---', policyType: policy?.policyType || '---', entityName: policy?.entityName || '---' };
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.claimNumber.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.policyNumber || '').toLowerCase().includes(q) ||
        (c.entityName || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'All') {
      result = result.filter(c => c.status === filterStatus);
    }

    return result;
  }, [claims, policies, searchQuery, filterStatus]);

  // Pagination
  const totalPolicyPages = Math.max(1, Math.ceil(filteredPolicies.length / ITEMS_PER_PAGE));
  const paginatedPolicies = filteredPolicies.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalClaimPages = Math.max(1, Math.ceil(filteredClaims.length / ITEMS_PER_PAGE));
  const paginatedClaims = filteredClaims.slice((claimPage - 1) * ITEMS_PER_PAGE, claimPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); setClaimPage(1); }, [searchQuery, filterType, filterStatus, filterEntity, activeTab]);

  // Entity names for filter dropdown
  const entityNames = useMemo(() => {
    const names = [...new Set(policies.map(p => p.entityName).filter(Boolean))];
    return names.sort();
  }, [policies]);

  // ─── Policy CRUD ───────────────────────────────────────────────────────────

  const openNewPolicy = (type?: PolicyType) => {
    const t = type || 'Vehicle';
    setPolicyForm({ ...emptyPolicy, policyType: t, policyNumber: generatePolicyNumber(t) });
    setEditingPolicyId(null);
    setShowPolicyForm(true);
  };

  const openEditPolicy = (policy: InsurancePolicy) => {
    setPolicyForm({
      policyNumber: policy.policyNumber,
      policyType: policy.policyType,
      provider: policy.provider,
      providerContact: policy.providerContact,
      providerEmail: policy.providerEmail,
      coverageType: policy.coverageType,
      premiumAmount: policy.premiumAmount,
      premiumFrequency: policy.premiumFrequency,
      coverageAmount: policy.coverageAmount,
      deductible: policy.deductible,
      startDate: policy.startDate,
      endDate: policy.endDate,
      renewalDate: policy.renewalDate,
      status: policy.status,
      entityType: policy.entityType,
      entityId: policy.entityId,
      entityName: policy.entityName,
      vehicleRegistration: policy.vehicleRegistration,
      vehicleMake: policy.vehicleMake,
      vehicleModel: policy.vehicleModel,
      vehicleYear: policy.vehicleYear,
      employeeIdNumber: policy.employeeIdNumber,
      benefitType: policy.benefitType,
      outletId: policy.outletId,
      outletName: policy.outletName,
      totalClaims: policy.totalClaims,
      totalClaimedAmount: policy.totalClaimedAmount,
      documentUrl: policy.documentUrl,
      notes: policy.notes,
      createdBy: policy.createdBy,
    });
    setEditingPolicyId(policy.id);
    setShowPolicyForm(true);
  };

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = policyToDbRow(policyForm);

    try {
      if (editingPolicyId) {
        await supabase.from('insurance_policies').update(row).eq('id', editingPolicyId);
        logAudit({ action: 'UPDATE', module: 'Insurance', record_id: editingPolicyId, details: { policy_number: row.policy_number, type: row.policy_type } });
      } else {
        const { data: inserted } = await supabase.from('insurance_policies').insert(row).select('id').single();
        logAudit({ action: 'CREATE', module: 'Insurance', record_id: inserted?.id || undefined, details: { policy_number: row.policy_number, type: row.policy_type } });
      }
      await fetchPolicies();
    } catch { /* supabase handles */ }

    setShowPolicyForm(false);
    setEditingPolicyId(null);
    setPolicyForm(emptyPolicy);
  };

  const handleDeletePolicy = async (id: string) => {
    if (!confirm('Delete this policy? This cannot be undone.')) return;
    await supabase.from('insurance_policies').delete().eq('id', id);
    logAudit({ action: 'DELETE', module: 'Insurance', record_id: id });
    fetchPolicies();
  };

  // ─── Claim CRUD ────────────────────────────────────────────────────────────

  const openNewClaim = (policyId?: string) => {
    setClaimForm({ ...emptyClaim, claimNumber: generateClaimNumber(), policyId: policyId || '' });
    setEditingClaimId(null);
    setShowClaimForm(true);
  };

  const openEditClaim = (claim: InsuranceClaim) => {
    setClaimForm({
      policyId: claim.policyId,
      claimNumber: claim.claimNumber,
      claimDate: claim.claimDate,
      incidentDate: claim.incidentDate,
      description: claim.description,
      claimAmount: claim.claimAmount,
      approvedAmount: claim.approvedAmount,
      status: claim.status,
      settlementDate: claim.settlementDate,
      documentsUrl: claim.documentsUrl,
      adjusterName: claim.adjusterName,
      adjusterContact: claim.adjusterContact,
      notes: claim.notes,
      filedBy: claim.filedBy,
    });
    setEditingClaimId(claim.id);
    setShowClaimForm(true);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = claimToDbRow(claimForm);

    try {
      if (editingClaimId) {
        await supabase.from('insurance_claims').update(row).eq('id', editingClaimId);
        logAudit({ action: 'UPDATE', module: 'Insurance Claims', record_id: editingClaimId, details: { claim_number: row.claim_number, status: row.status } });
      } else {
        const { data: inserted } = await supabase.from('insurance_claims').insert(row).select('id').single();
        logAudit({ action: 'CREATE', module: 'Insurance Claims', record_id: inserted?.id || undefined, details: { claim_number: row.claim_number, policy_id: row.policy_id } });
      }

      // Update policy claim counters
      if (claimForm.policyId) {
        const policyClaims = [...claims.filter(c => c.policyId === claimForm.policyId)];
        if (!editingClaimId) policyClaims.push({ ...emptyClaim, claimAmount: claimForm.claimAmount } as InsuranceClaim);
        const totalClaimCount = policyClaims.length + (editingClaimId ? 0 : 0);
        const totalClaimedAmt = policyClaims.reduce((s, c) => s + Number(c.claimAmount), 0);
        await supabase.from('insurance_policies').update({
          total_claims: totalClaimCount,
          total_claimed_amount: totalClaimedAmt,
        }).eq('id', claimForm.policyId);
      }

      await fetchClaims();
      await fetchPolicies();
    } catch { /* supabase handles */ }

    setShowClaimForm(false);
    setEditingClaimId(null);
    setClaimForm(emptyClaim);
  };

  const handleDeleteClaim = async (id: string) => {
    if (!confirm('Delete this claim? This cannot be undone.')) return;
    await supabase.from('insurance_claims').delete().eq('id', id);
    logAudit({ action: 'DELETE', module: 'Insurance Claims', record_id: id });
    fetchClaims();
    fetchPolicies();
  };

  const updateClaimStatus = async (claim: InsuranceClaim, newStatus: ClaimStatus) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'Settled') updates.settlement_date = new Date().toISOString().split('T')[0];
    await supabase.from('insurance_claims').update(updates).eq('id', claim.id);
    logAudit({ action: 'UPDATE', module: 'Insurance Claims', record_id: claim.id, details: { claim_number: claim.claimNumber, new_status: newStatus } });
    fetchClaims();
  };

  // ─── Export Handlers ───────────────────────────────────────────────────────

  const handleExportPoliciesCSV = () => {
    const headers = ['Policy Number', 'Type', 'Provider', 'Coverage', 'Premium', 'Frequency', 'Coverage Amount', 'Entity', 'Start Date', 'End Date', 'Status'];
    const rows = filteredPolicies.map(p => [
      p.policyNumber, p.policyType, p.provider, p.coverageType,
      String(p.premiumAmount), p.premiumFrequency, String(p.coverageAmount),
      p.entityName, p.startDate, p.endDate, p.status,
    ]);
    exportCSV('insurance_policies', headers, rows);
    logAudit({ action: 'EXPORT', module: 'Insurance', details: { format: 'CSV', count: rows.length } });
  };

  const handleExportPoliciesPDF = () => {
    const headers = ['Policy #', 'Type', 'Provider', 'Coverage', 'Premium', 'Entity', 'End Date', 'Status'];
    const rows = filteredPolicies.map(p => [
      p.policyNumber, p.policyType, p.provider, p.coverageType,
      formatKES(p.premiumAmount), p.entityName, formatDate(p.endDate), p.status,
    ]);
    exportPDF('Insurance Policies Report', headers, rows);
    logAudit({ action: 'EXPORT', module: 'Insurance', details: { format: 'PDF', count: rows.length } });
  };

  const handleExportClaimsCSV = () => {
    const headers = ['Claim Number', 'Policy', 'Incident Date', 'Description', 'Claim Amount', 'Approved', 'Status', 'Filed By'];
    const rows = filteredClaims.map(c => [
      c.claimNumber, c.policyNumber || '', c.incidentDate, c.description,
      String(c.claimAmount), String(c.approvedAmount), c.status, c.filedBy,
    ]);
    exportCSV('insurance_claims', headers, rows);
    logAudit({ action: 'EXPORT', module: 'Insurance Claims', details: { format: 'CSV', count: rows.length } });
  };

  // ─── Entity selection helpers ──────────────────────────────────────────────

  const handleAssetSelect = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setPolicyForm(prev => ({
        ...prev,
        entityId: asset.id,
        entityType: 'Asset',
        entityName: `${asset.name} (${asset.category})`,
      }));
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setPolicyForm(prev => ({
        ...prev,
        entityId: emp.id,
        entityType: 'Employee',
        entityName: `${emp.firstName} ${emp.lastName}`,
        employeeIdNumber: emp.employeeIdNumber,
      }));
    }
  };

  const handleOutletSelect = (outletId: string) => {
    const outlet = outlets.find(o => o.id === outletId);
    if (outlet) {
      setPolicyForm(prev => ({
        ...prev,
        entityId: outlet.id,
        entityType: 'Outlet',
        entityName: outlet.name,
        outletId: outlet.id,
        outletName: outlet.name,
      }));
    }
  };

  const getCoverageOptions = (): string[] => {
    switch (policyForm.policyType) {
      case 'Vehicle': return VEHICLE_COVERAGE_TYPES;
      case 'Asset': return ASSET_COVERAGE_TYPES;
      case 'Employee': return EMPLOYEE_COVERAGE_TYPES;
      case 'Business': case 'Liability': return BUSINESS_COVERAGE_TYPES;
      default: return [];
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading insurance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Insurance Management</h1>
          <p className="text-muted-foreground mt-1">Manage policies, claims, and coverage across all business entities</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openNewPolicy()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium">
            + New Policy
          </button>
          <button onClick={() => openNewClaim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition text-sm font-medium">
            + New Claim
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Policies</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.expiredCount} expired</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Active Policies</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
          <p className="text-xs text-muted-foreground mt-1">{policies.filter(p => p.status === 'Pending').length} pending</p>
        </div>
        <div className={`bg-card border rounded-lg p-4 ${stats.expiringSoon > 0 ? 'border-orange-400 bg-orange-50' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Expiring Soon</p>
          <p className={`text-2xl font-bold mt-1 ${stats.expiringSoon > 0 ? 'text-orange-600' : 'text-foreground'}`}>{stats.expiringSoon}</p>
          <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Annual Premiums</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatKES(stats.totalPremiums)}</p>
          <p className="text-xs text-muted-foreground mt-1">Active policies</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Claims</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.totalClaimCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{stats.pendingClaims} pending &middot; {formatKES(stats.totalClaimedAmt)}</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {tab.label}
              {tab.key !== 'claims' && tab.key !== 'all' && (
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {policies.filter(p => {
                    if (tab.key === 'vehicle') return p.policyType === 'Vehicle';
                    if (tab.key === 'asset') return p.policyType === 'Asset';
                    if (tab.key === 'employee') return p.policyType === 'Employee';
                    if (tab.key === 'business') return p.policyType === 'Business' || p.policyType === 'Liability';
                    return true;
                  }).length}
                </span>
              )}
              {tab.key === 'claims' && (
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{claims.length}</span>
              )}
              {tab.key === 'all' && (
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">{policies.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder={activeTab === 'claims' ? 'Search claims...' : 'Search policies...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
        {activeTab !== 'claims' && activeTab === 'all' && (
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
            <option value="All">All Types</option>
            {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
        >
          <option value="All">All Statuses</option>
          {(activeTab === 'claims' ? CLAIM_STATUSES : POLICY_STATUSES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {activeTab !== 'claims' && entityNames.length > 0 && (
          <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
            <option value="All">All Entities</option>
            {entityNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <button onClick={activeTab === 'claims' ? handleExportClaimsCSV : handleExportPoliciesCSV} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground hover:bg-muted transition text-sm" title="Export CSV">
            CSV
          </button>
          {activeTab !== 'claims' && (
            <button onClick={handleExportPoliciesPDF} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground hover:bg-muted transition text-sm" title="Export PDF">
              PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Claims Tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'claims' ? (
        <div>
          {/* Claims summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">Filed</p>
              <p className="text-xl font-bold text-blue-800">{claims.filter(c => c.status === 'Filed').length}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-600 font-medium">Under Review</p>
              <p className="text-xl font-bold text-yellow-800">{claims.filter(c => c.status === 'Under Review').length}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium">Approved / Settled</p>
              <p className="text-xl font-bold text-green-800">{claims.filter(c => c.status === 'Approved' || c.status === 'Settled').length}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium">Rejected</p>
              <p className="text-xl font-bold text-red-800">{claims.filter(c => c.status === 'Rejected').length}</p>
            </div>
          </div>

          {paginatedClaims.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg mb-2">No claims found</p>
              <button onClick={() => openNewClaim()} className="text-primary hover:underline text-sm">File a new claim</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium">Claim #</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium hidden md:table-cell">Policy</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium hidden lg:table-cell">Entity</th>
                    <th className="text-left py-3 px-3 text-muted-foreground font-medium">Incident</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium hidden sm:table-cell">Approved</th>
                    <th className="text-center py-3 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-right py-3 px-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClaims.map(claim => (
                    <tr key={claim.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-3 font-mono text-xs">{claim.claimNumber}</td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className="font-mono text-xs">{claim.policyNumber}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">{claim.policyType}</span>
                      </td>
                      <td className="py-3 px-3 hidden lg:table-cell text-xs">{claim.entityName}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs">{formatDate(claim.incidentDate)}</span>
                        <br />
                        <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{claim.description}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-xs">{formatKES(claim.claimAmount)}</td>
                      <td className="py-3 px-3 text-right hidden sm:table-cell text-xs">{claim.approvedAmount > 0 ? formatKES(claim.approvedAmount) : '---'}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setShowClaimDetail(claim)} className="p-1 text-muted-foreground hover:text-foreground" title="View">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => openEditClaim(claim)} className="p-1 text-muted-foreground hover:text-blue-600" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteClaim(claim.id)} className="p-1 text-muted-foreground hover:text-red-600" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                          {/* Workflow buttons */}
                          {claim.status === 'Filed' && (
                            <button onClick={() => updateClaimStatus(claim, 'Under Review')} className="ml-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200" title="Start Review">
                              Review
                            </button>
                          )}
                          {claim.status === 'Under Review' && (
                            <>
                              <button onClick={() => updateClaimStatus(claim, 'Approved')} className="ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200">Approve</button>
                              <button onClick={() => updateClaimStatus(claim, 'Rejected')} className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200">Reject</button>
                            </>
                          )}
                          {claim.status === 'Approved' && (
                            <button onClick={() => updateClaimStatus(claim, 'Settled')} className="ml-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200">Settle</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Claim Pagination */}
          {totalClaimPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {((claimPage - 1) * ITEMS_PER_PAGE) + 1}--{Math.min(claimPage * ITEMS_PER_PAGE, filteredClaims.length)} of {filteredClaims.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setClaimPage(p => Math.max(1, p - 1))} disabled={claimPage === 1} className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50">Prev</button>
                {Array.from({ length: Math.min(totalClaimPages, 5) }, (_, i) => {
                  const pageNum = claimPage <= 3 ? i + 1 : claimPage - 2 + i;
                  if (pageNum > totalClaimPages) return null;
                  return (
                    <button key={pageNum} onClick={() => setClaimPage(pageNum)} className={`px-3 py-1 border rounded text-sm ${claimPage === pageNum ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setClaimPage(p => Math.min(totalClaimPages, p + 1))} disabled={claimPage === totalClaimPages} className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Policies Grid / Table ──────────────────────────────────────────── */
        <div>
          {/* Expiry Alert Banner */}
          {stats.expiringSoon > 0 && activeTab === 'all' && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-orange-600 font-medium text-sm">
                Warning: {stats.expiringSoon} {stats.expiringSoon === 1 ? 'policy' : 'policies'} expiring within 30 days
              </span>
              <button
                onClick={() => { setFilterStatus('Active'); setSearchQuery(''); }}
                className="text-orange-700 underline text-sm hover:text-orange-900"
              >
                View expiring policies
              </button>
            </div>
          )}

          {/* Type-specific quick add (on sub-tabs) */}
          {activeTab !== 'all' && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  const typeMap: Record<string, PolicyType> = { vehicle: 'Vehicle', asset: 'Asset', employee: 'Employee', business: 'Business' };
                  openNewPolicy(typeMap[activeTab] || 'Vehicle');
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium"
              >
                + Add {activeTab === 'business' ? 'Business/Liability' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Policy
              </button>
            </div>
          )}

          {paginatedPolicies.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg mb-2">No policies found</p>
              <button onClick={() => openNewPolicy()} className="text-primary hover:underline text-sm">Create a new policy</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedPolicies.map(policy => {
                const expiring = isExpiringSoon(policy.endDate);
                const expired = isExpired(policy.endDate);
                const days = daysUntilExpiry(policy.endDate);
                return (
                  <div
                    key={policy.id}
                    className={`bg-card border rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                      expiring ? 'border-orange-400 ring-1 ring-orange-200' : expired && policy.status === 'Active' ? 'border-red-400 ring-1 ring-red-200' : 'border-border'
                    }`}
                    onClick={() => setShowPolicyDetail(policy)}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getPolicyTypeIcon(policy.policyType)}</span>
                        <div>
                          <p className="font-mono text-xs text-muted-foreground">{policy.policyNumber}</p>
                          <p className="font-medium text-sm text-foreground">{policy.policyType} Insurance</p>
                        </div>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(policy.status)}`}>
                        {policy.status}
                      </span>
                    </div>

                    {/* Entity Info */}
                    <div className="mb-3">
                      <p className="text-sm font-medium text-foreground truncate">{policy.entityName || '---'}</p>
                      {policy.policyType === 'Vehicle' && policy.vehicleRegistration && (
                        <p className="text-xs text-muted-foreground">{policy.vehicleRegistration} &middot; {policy.vehicleMake} {policy.vehicleModel} {policy.vehicleYear}</p>
                      )}
                      {policy.policyType === 'Employee' && policy.benefitType && (
                        <p className="text-xs text-muted-foreground">Benefit: {policy.benefitType}</p>
                      )}
                      {(policy.policyType === 'Business' || policy.policyType === 'Liability') && policy.outletName && (
                        <p className="text-xs text-muted-foreground">Outlet: {policy.outletName}</p>
                      )}
                    </div>

                    {/* Coverage & Premium */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Premium</p>
                        <p className="font-medium text-foreground">{formatKES(policy.premiumAmount)}</p>
                        <p className="text-muted-foreground">{policy.premiumFrequency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Coverage</p>
                        <p className="font-medium text-foreground">{formatKES(policy.coverageAmount)}</p>
                        <p className="text-muted-foreground">{policy.coverageType}</p>
                      </div>
                    </div>

                    {/* Provider */}
                    <p className="text-xs text-muted-foreground mb-2 truncate">Provider: {policy.provider || '---'}</p>

                    {/* Dates & Expiry Alert */}
                    <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                      <span className="text-muted-foreground">{formatDate(policy.startDate)} - {formatDate(policy.endDate)}</span>
                      {expiring && (
                        <span className="text-orange-600 font-medium">{days}d left</span>
                      )}
                      {expired && policy.status === 'Active' && (
                        <span className="text-red-600 font-medium">Expired</span>
                      )}
                    </div>

                    {/* Claims badge */}
                    {policy.totalClaims > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {policy.totalClaims} claim{policy.totalClaims !== 1 ? 's' : ''} &middot; {formatKES(policy.totalClaimedAmount)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Policy Pagination */}
          {totalPolicyPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}--{Math.min(currentPage * ITEMS_PER_PAGE, filteredPolicies.length)} of {filteredPolicies.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50">Prev</button>
                {Array.from({ length: Math.min(totalPolicyPages, 5) }, (_, i) => {
                  const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                  if (pageNum > totalPolicyPages) return null;
                  return (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1 border rounded text-sm ${currentPage === pageNum ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPolicyPages, p + 1))} disabled={currentPage === totalPolicyPages} className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── POLICY FORM MODAL ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showPolicyForm} onClose={() => { setShowPolicyForm(false); setEditingPolicyId(null); setPolicyForm(emptyPolicy); }} title={editingPolicyId ? 'Edit Policy' : 'New Insurance Policy'} size="4xl">
        <form onSubmit={handlePolicySubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
          {/* Policy Type & Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Policy Number</label>
              <input type="text" value={policyForm.policyNumber} readOnly className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Policy Type *</label>
              <select
                value={policyForm.policyType}
                onChange={e => {
                  const newType = e.target.value as PolicyType;
                  setPolicyForm(prev => ({
                    ...prev,
                    policyType: newType,
                    policyNumber: editingPolicyId ? prev.policyNumber : generatePolicyNumber(newType),
                    coverageType: '',
                    entityType: '',
                    entityId: '',
                    entityName: '',
                    vehicleRegistration: '',
                    vehicleMake: '',
                    vehicleModel: '',
                    vehicleYear: new Date().getFullYear(),
                    employeeIdNumber: '',
                    benefitType: '',
                    outletId: '',
                    outletName: '',
                  }));
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                required
              >
                {POLICY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Provider Info */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Insurance Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider Name *</label>
                <input type="text" value={policyForm.provider} onChange={e => setPolicyForm(prev => ({ ...prev, provider: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contact Phone</label>
                <input type="text" value={policyForm.providerContact} onChange={e => setPolicyForm(prev => ({ ...prev, providerContact: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Provider Email</label>
                <input type="email" value={policyForm.providerEmail} onChange={e => setPolicyForm(prev => ({ ...prev, providerEmail: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
              </div>
            </div>
          </div>

          {/* Coverage & Premium */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Coverage &amp; Premium</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Coverage Type *</label>
                <select value={policyForm.coverageType} onChange={e => setPolicyForm(prev => ({ ...prev, coverageType: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                  <option value="">Select coverage type</option>
                  {getCoverageOptions().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Premium Amount (KES) *</label>
                <input type="number" min="0" step="0.01" value={policyForm.premiumAmount || ''} onChange={e => setPolicyForm(prev => ({ ...prev, premiumAmount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Premium Frequency *</label>
                <select value={policyForm.premiumFrequency} onChange={e => setPolicyForm(prev => ({ ...prev, premiumFrequency: e.target.value as PremiumFrequency }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                  {PREMIUM_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Coverage Amount (KES) *</label>
                <input type="number" min="0" step="0.01" value={policyForm.coverageAmount || ''} onChange={e => setPolicyForm(prev => ({ ...prev, coverageAmount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Deductible (KES)</label>
                <input type="number" min="0" step="0.01" value={policyForm.deductible || ''} onChange={e => setPolicyForm(prev => ({ ...prev, deductible: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select value={policyForm.status} onChange={e => setPolicyForm(prev => ({ ...prev, status: e.target.value as PolicyStatus }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
                  {POLICY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Policy Dates</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Date *</label>
                <input type="date" value={policyForm.startDate} onChange={e => setPolicyForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">End Date *</label>
                <input type="date" value={policyForm.endDate} onChange={e => setPolicyForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Renewal Date</label>
                <input type="date" value={policyForm.renewalDate} onChange={e => setPolicyForm(prev => ({ ...prev, renewalDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
              </div>
            </div>
          </div>

          {/* ── Entity-specific fields ──────────────────────────────────────── */}

          {/* Vehicle */}
          {policyForm.policyType === 'Vehicle' && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Vehicle Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Registration *</label>
                  <input type="text" value={policyForm.vehicleRegistration} onChange={e => setPolicyForm(prev => ({ ...prev, vehicleRegistration: e.target.value.toUpperCase(), entityName: e.target.value.toUpperCase() }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" placeholder="KXX 000X" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Make</label>
                  <input type="text" value={policyForm.vehicleMake} onChange={e => setPolicyForm(prev => ({ ...prev, vehicleMake: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" placeholder="Toyota" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Model</label>
                  <input type="text" value={policyForm.vehicleModel} onChange={e => setPolicyForm(prev => ({ ...prev, vehicleModel: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" placeholder="Hiace" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Year</label>
                  <input type="number" min="1990" max="2099" value={policyForm.vehicleYear || ''} onChange={e => setPolicyForm(prev => ({ ...prev, vehicleYear: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
                </div>
              </div>
              {/* Link to existing vehicle asset */}
              {assets.filter(a => a.category === 'Vehicles' || a.category === 'Vehicle').length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Or link to asset vehicle:</label>
                  <select
                    value={policyForm.entityId}
                    onChange={e => {
                      const asset = assets.find(a => a.id === e.target.value);
                      if (asset) {
                        setPolicyForm(prev => ({ ...prev, entityId: asset.id, entityType: 'Asset', entityName: asset.name }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
                  >
                    <option value="">-- Select vehicle asset --</option>
                    {assets.filter(a => a.category === 'Vehicles' || a.category === 'Vehicle').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serialNumber})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Asset */}
          {policyForm.policyType === 'Asset' && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Asset Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Select Asset *</label>
                  <select value={policyForm.entityId} onChange={e => handleAssetSelect(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                    <option value="">-- Select an asset --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} - {a.category} ({a.serialNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Entity Name</label>
                  <input type="text" value={policyForm.entityName} onChange={e => setPolicyForm(prev => ({ ...prev, entityName: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground text-sm" readOnly />
                </div>
              </div>
            </div>
          )}

          {/* Employee */}
          {policyForm.policyType === 'Employee' && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Employee &amp; Benefit Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Select Employee *</label>
                  <select value={policyForm.entityId} onChange={e => handleEmployeeSelect(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                    <option value="">-- Select employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeIdNumber})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Employee ID</label>
                  <input type="text" value={policyForm.employeeIdNumber} readOnly className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Benefit Type *</label>
                  <select value={policyForm.benefitType} onChange={e => setPolicyForm(prev => ({ ...prev, benefitType: e.target.value as BenefitType }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                    <option value="">Select benefit</option>
                    {BENEFIT_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Business / Liability */}
          {(policyForm.policyType === 'Business' || policyForm.policyType === 'Liability') && (
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Business / Outlet Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Select Outlet</label>
                  <select value={policyForm.outletId} onChange={e => handleOutletSelect(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
                    <option value="">-- Select outlet (optional) --</option>
                    {outlets.map(o => (
                      <option key={o.id} value={o.id}>{o.name} ({o.outletType})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Business / Entity Name *</label>
                  <input type="text" value={policyForm.entityName} onChange={e => setPolicyForm(prev => ({ ...prev, entityName: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required placeholder="Business name or outlet" />
                </div>
              </div>
            </div>
          )}

          {/* Document & Notes */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Additional Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Document URL</label>
                <input type="url" value={policyForm.documentUrl} onChange={e => setPolicyForm(prev => ({ ...prev, documentUrl: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea value={policyForm.notes} onChange={e => setPolicyForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" rows={2} />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowPolicyForm(false); setEditingPolicyId(null); setPolicyForm(emptyPolicy); }} className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium">
              {editingPolicyId ? 'Update Policy' : 'Create Policy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── POLICY DETAIL MODAL ───────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!showPolicyDetail} onClose={() => setShowPolicyDetail(null)} title="Policy Details" size="3xl">
        {showPolicyDetail && (() => {
          const p = showPolicyDetail;
          const policyClaims = claims.filter(c => c.policyId === p.id);
          const expiring = isExpiringSoon(p.endDate);
          const expired = isExpired(p.endDate);
          return (
            <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
              {/* Alert banners */}
              {expiring && (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm text-orange-700">
                  This policy expires in {daysUntilExpiry(p.endDate)} days. Consider renewing.
                </div>
              )}
              {expired && p.status === 'Active' && (
                <div className="bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-700">
                  This policy has expired. Please renew or update status.
                </div>
              )}

              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-muted-foreground">{p.policyNumber}</p>
                  <p className="text-lg font-semibold text-foreground">{getPolicyTypeIcon(p.policyType)} {p.policyType} Insurance</p>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>{p.status}</span>
                  <button onClick={() => { setShowPolicyDetail(null); openEditPolicy(p); }} className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-muted transition">Edit</button>
                  <button onClick={() => { setShowPolicyDetail(null); handleDeletePolicy(p.id); }} className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">Delete</button>
                </div>
              </div>

              {/* Two-column detail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-muted-foreground">Provider:</span> <span className="font-medium text-foreground">{p.provider}</span></div>
                <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{p.providerContact || '---'}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{p.providerEmail || '---'}</span></div>
                <div><span className="text-muted-foreground">Coverage Type:</span> <span className="text-foreground">{p.coverageType}</span></div>
                <div><span className="text-muted-foreground">Premium:</span> <span className="font-medium text-foreground">{formatKES(p.premiumAmount)} / {p.premiumFrequency}</span></div>
                <div><span className="text-muted-foreground">Coverage Amount:</span> <span className="font-medium text-foreground">{formatKES(p.coverageAmount)}</span></div>
                <div><span className="text-muted-foreground">Deductible:</span> <span className="text-foreground">{formatKES(p.deductible)}</span></div>
                <div><span className="text-muted-foreground">Entity:</span> <span className="font-medium text-foreground">{p.entityName || '---'}</span></div>
                <div><span className="text-muted-foreground">Start Date:</span> <span className="text-foreground">{formatDate(p.startDate)}</span></div>
                <div><span className="text-muted-foreground">End Date:</span> <span className={`${expiring ? 'text-orange-600 font-medium' : expired ? 'text-red-600 font-medium' : 'text-foreground'}`}>{formatDate(p.endDate)}</span></div>
                <div><span className="text-muted-foreground">Renewal Date:</span> <span className="text-foreground">{formatDate(p.renewalDate)}</span></div>

                {p.policyType === 'Vehicle' && (
                  <>
                    <div><span className="text-muted-foreground">Registration:</span> <span className="font-medium text-foreground">{p.vehicleRegistration}</span></div>
                    <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground">{p.vehicleMake} {p.vehicleModel} {p.vehicleYear}</span></div>
                  </>
                )}
                {p.policyType === 'Employee' && (
                  <>
                    <div><span className="text-muted-foreground">Employee ID:</span> <span className="text-foreground">{p.employeeIdNumber}</span></div>
                    <div><span className="text-muted-foreground">Benefit Type:</span> <span className="text-foreground">{p.benefitType}</span></div>
                  </>
                )}
                {(p.policyType === 'Business' || p.policyType === 'Liability') && p.outletName && (
                  <div><span className="text-muted-foreground">Outlet:</span> <span className="text-foreground">{p.outletName}</span></div>
                )}
              </div>

              {p.documentUrl && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Document: </span>
                  <a href={p.documentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.documentUrl}</a>
                </div>
              )}
              {p.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span className="text-foreground">{p.notes}</span>
                </div>
              )}

              {/* Claims for this policy */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Claims ({policyClaims.length})</h3>
                  <button onClick={() => { setShowPolicyDetail(null); openNewClaim(p.id); }} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:opacity-90 transition">
                    + File Claim
                  </button>
                </div>
                {policyClaims.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No claims filed for this policy.</p>
                ) : (
                  <div className="space-y-2">
                    {policyClaims.map(c => (
                      <div key={c.id} className="border border-border rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="font-mono">{c.claimNumber}</span>
                          <span className="text-muted-foreground ml-2">{formatDate(c.incidentDate)}</span>
                          <p className="text-muted-foreground mt-0.5 truncate max-w-[300px]">{c.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatKES(c.claimAmount)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>{c.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── CLAIM FORM MODAL ──────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showClaimForm} onClose={() => { setShowClaimForm(false); setEditingClaimId(null); setClaimForm(emptyClaim); }} title={editingClaimId ? 'Edit Claim' : 'File New Claim'} size="3xl">
        <form onSubmit={handleClaimSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Claim Number</label>
              <input type="text" value={claimForm.claimNumber} readOnly className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground text-sm font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Policy *</label>
              <select value={claimForm.policyId} onChange={e => setClaimForm(prev => ({ ...prev, policyId: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required>
                <option value="">-- Select policy --</option>
                {policies.filter(p => p.status === 'Active').map(p => (
                  <option key={p.id} value={p.id}>{p.policyNumber} - {p.policyType} ({p.entityName})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Claim Date *</label>
              <input type="date" value={claimForm.claimDate} onChange={e => setClaimForm(prev => ({ ...prev, claimDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Incident Date *</label>
              <input type="date" value={claimForm.incidentDate} onChange={e => setClaimForm(prev => ({ ...prev, incidentDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
            <textarea value={claimForm.description} onChange={e => setClaimForm(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" rows={3} required placeholder="Describe the incident and damages..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Claim Amount (KES) *</label>
              <input type="number" min="0" step="0.01" value={claimForm.claimAmount || ''} onChange={e => setClaimForm(prev => ({ ...prev, claimAmount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Approved Amount (KES)</label>
              <input type="number" min="0" step="0.01" value={claimForm.approvedAmount || ''} onChange={e => setClaimForm(prev => ({ ...prev, approvedAmount: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select value={claimForm.status} onChange={e => setClaimForm(prev => ({ ...prev, status: e.target.value as ClaimStatus }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
                {CLAIM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Adjuster Name</label>
              <input type="text" value={claimForm.adjusterName} onChange={e => setClaimForm(prev => ({ ...prev, adjusterName: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Adjuster Contact</label>
              <input type="text" value={claimForm.adjusterContact} onChange={e => setClaimForm(prev => ({ ...prev, adjusterContact: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Filed By</label>
              <input type="text" value={claimForm.filedBy} onChange={e => setClaimForm(prev => ({ ...prev, filedBy: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Documents URL</label>
              <input type="url" value={claimForm.documentsUrl} onChange={e => setClaimForm(prev => ({ ...prev, documentsUrl: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" placeholder="https://..." />
            </div>
          </div>

          {claimForm.status === 'Settled' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Settlement Date</label>
              <input type="date" value={claimForm.settlementDate} onChange={e => setClaimForm(prev => ({ ...prev, settlementDate: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea value={claimForm.notes} onChange={e => setClaimForm(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowClaimForm(false); setEditingClaimId(null); setClaimForm(emptyClaim); }} className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted transition text-sm">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition text-sm font-medium">
              {editingClaimId ? 'Update Claim' : 'File Claim'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── CLAIM DETAIL MODAL ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={!!showClaimDetail} onClose={() => setShowClaimDetail(null)} title="Claim Details" size="2xl">
        {showClaimDetail && (() => {
          const c = showClaimDetail;
          const policy = policies.find(p => p.id === c.policyId);
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-muted-foreground">{c.claimNumber}</p>
                  <p className="text-lg font-semibold text-foreground">Insurance Claim</p>
                </div>
                <div className="flex gap-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>{c.status}</span>
                  <button onClick={() => { setShowClaimDetail(null); openEditClaim(c); }} className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-muted transition">Edit</button>
                  <button onClick={() => { setShowClaimDetail(null); handleDeleteClaim(c.id); }} className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition">Delete</button>
                </div>
              </div>

              {/* Workflow status bar */}
              <div className="flex items-center gap-1 text-xs">
                {CLAIM_STATUSES.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <span className={`px-2 py-1 rounded ${c.status === s ? 'bg-primary text-primary-foreground font-medium' : CLAIM_STATUSES.indexOf(c.status) > i ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>{s}</span>
                    {i < CLAIM_STATUSES.length - 1 && <span className="mx-1 text-muted-foreground">&rarr;</span>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-muted-foreground">Policy:</span> <span className="font-mono text-foreground">{policy?.policyNumber || '---'}</span></div>
                <div><span className="text-muted-foreground">Policy Type:</span> <span className="text-foreground">{policy?.policyType || '---'}</span></div>
                <div><span className="text-muted-foreground">Entity:</span> <span className="text-foreground">{policy?.entityName || '---'}</span></div>
                <div><span className="text-muted-foreground">Claim Date:</span> <span className="text-foreground">{formatDate(c.claimDate)}</span></div>
                <div><span className="text-muted-foreground">Incident Date:</span> <span className="text-foreground">{formatDate(c.incidentDate)}</span></div>
                <div><span className="text-muted-foreground">Claim Amount:</span> <span className="font-medium text-foreground">{formatKES(c.claimAmount)}</span></div>
                <div><span className="text-muted-foreground">Approved Amount:</span> <span className="font-medium text-foreground">{c.approvedAmount > 0 ? formatKES(c.approvedAmount) : '---'}</span></div>
                {c.settlementDate && <div><span className="text-muted-foreground">Settlement Date:</span> <span className="text-foreground">{formatDate(c.settlementDate)}</span></div>}
                <div><span className="text-muted-foreground">Filed By:</span> <span className="text-foreground">{c.filedBy || '---'}</span></div>
                {c.adjusterName && <div><span className="text-muted-foreground">Adjuster:</span> <span className="text-foreground">{c.adjusterName} ({c.adjusterContact})</span></div>}
              </div>

              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Description:</p>
                <p className="text-foreground bg-muted rounded-lg p-3">{c.description || 'No description provided.'}</p>
              </div>

              {c.documentsUrl && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Documents: </span>
                  <a href={c.documentsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.documentsUrl}</a>
                </div>
              )}
              {c.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span className="text-foreground">{c.notes}</span>
                </div>
              )}

              {/* Workflow actions */}
              <div className="flex gap-2 pt-3 border-t border-border">
                {c.status === 'Filed' && (
                  <button onClick={() => { updateClaimStatus(c, 'Under Review'); setShowClaimDetail(null); }} className="px-4 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition font-medium">
                    Start Review
                  </button>
                )}
                {c.status === 'Under Review' && (
                  <>
                    <button onClick={() => { updateClaimStatus(c, 'Approved'); setShowClaimDetail(null); }} className="px-4 py-2 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition font-medium">Approve</button>
                    <button onClick={() => { updateClaimStatus(c, 'Rejected'); setShowClaimDetail(null); }} className="px-4 py-2 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition font-medium">Reject</button>
                  </>
                )}
                {c.status === 'Approved' && (
                  <button onClick={() => { updateClaimStatus(c, 'Settled'); setShowClaimDetail(null); }} className="px-4 py-2 text-sm bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition font-medium">Mark as Settled</button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
