'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { logAudit } from '@/lib/audit-logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  category: string;
  status: string;
}

interface ProductivityRecord {
  id: string;
  employeeId: string;
  metricType: MetricType;
  metricValue: number;
  date: string;
  notes: string;
  createdAt: string;
}

interface ActivityLogEntry {
  id: string;
  date: string;
  metricType: string;
  metricValue: number;
  notes: string;
}

interface EmployeeKPI {
  employeeId: string;
  employeeName: string;
  role: string;
  department: string;
  category: string;
  email: string;
  phone: string;
  batchesProduced: number;
  deliveriesCompleted: number;
  deliveriesAssigned: number;
  posSales: number;
  wasteReports: number;
  systemLogins: number;
  overallScore: number;
  status: 'Excellent' | 'Good' | 'Needs Improvement';
  // System activity metrics from audit logs
  systemActions: number;
  membersAdded: number;
  moduleUsage: Record<string, number>;
}

interface DailyTrend {
  date: string;
  score: number;
}

interface CategoryBreakdown {
  name: string;
  value: number;
}

type MetricType = 'batches_produced' | 'deliveries_completed' | 'deliveries_assigned' | 'pos_sales' | 'waste_reports' | 'system_logins' | 'pos_facilitated';

type DatePreset = 'today' | 'this_week' | 'this_month' | 'custom';

const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: 'batches_produced', label: 'Batches Produced' },
  { value: 'deliveries_completed', label: 'Deliveries Completed' },
  { value: 'deliveries_assigned', label: 'Deliveries Assigned' },
  { value: 'pos_sales', label: 'POS Sales Count' },
  { value: 'pos_facilitated', label: 'POS Facilitated' },
  { value: 'waste_reports', label: 'Waste Reports Logged' },
  { value: 'system_logins', label: 'System Logins' },
];

const PAGE_SIZE = 10;

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'this_week': {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return { start: weekStart.toISOString().split('T')[0], end };
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart.toISOString().split('T')[0], end };
    }
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], end };
  }
}

function metricLabel(type: string): string {
  const found = METRIC_TYPES.find(m => m.value === type);
  return found ? found.label : type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function calculateKPIScore(emp: Employee, records: ProductivityRecord[]): number {
  const empRecords = records.filter(r => r.employeeId === emp.id);
  if (empRecords.length === 0) return 0;

  const cat = (emp.category || '').toLowerCase();
  let score = 0;
  let totalWeight = 0;

  // Baker KPI: batches produced score
  if (cat === 'baker' || cat === 'supervisor' || cat === 'packer') {
    const batches = empRecords.filter(r => r.metricType === 'batches_produced').reduce((s, r) => s + r.metricValue, 0);
    const expectedBatches = 10; // baseline daily expected batches
    const batchScore = Math.min(100, (batches / Math.max(1, expectedBatches)) * 100);
    score += batchScore * 0.4;
    totalWeight += 0.4;
  }

  // Rider KPI: deliveries completed / assigned
  if (cat === 'rider' || cat === 'driver') {
    const completed = empRecords.filter(r => r.metricType === 'deliveries_completed').reduce((s, r) => s + r.metricValue, 0);
    const assigned = empRecords.filter(r => r.metricType === 'deliveries_assigned').reduce((s, r) => s + r.metricValue, 0);
    const deliveryScore = assigned > 0 ? Math.min(100, (completed / assigned) * 100) : 0;
    score += deliveryScore * 0.4;
    totalWeight += 0.4;
  }

  // Cashier / Sales KPI: POS sales count
  if (cat === 'sales' || cat === 'admin' || cat === 'cashier') {
    const sales = empRecords.filter(r => r.metricType === 'pos_sales' || r.metricType === 'pos_facilitated').reduce((s, r) => s + r.metricValue, 0);
    const expectedSales = 20; // baseline daily expected sales
    const salesScore = Math.min(100, (sales / Math.max(1, expectedSales)) * 100);
    score += salesScore * 0.4;
    totalWeight += 0.4;
  }

  // Universal: system logins (shows engagement)
  const logins = empRecords.filter(r => r.metricType === 'system_logins').reduce((s, r) => s + r.metricValue, 0);
  const loginScore = Math.min(100, (logins / Math.max(1, 5)) * 100);
  score += loginScore * 0.2;
  totalWeight += 0.2;

  // Universal: waste reports (proactive reporting is good)
  const wasteReports = empRecords.filter(r => r.metricType === 'waste_reports').reduce((s, r) => s + r.metricValue, 0);
  const wasteScore = Math.min(100, (wasteReports / Math.max(1, 2)) * 100);
  score += wasteScore * 0.1;
  totalWeight += 0.1;

  // If no role-specific metrics, distribute weight to general metrics
  if (totalWeight === 0) return 0;

  // Normalize: the weights above may not add up to 1.0 for all categories
  const normalized = (score / totalWeight) * (totalWeight > 0 ? 1 : 0);
  return Math.round(Math.min(100, Math.max(0, normalized)));
}

function getStatusBadge(score: number): { label: string; className: string } {
  if (score > 80) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (score >= 60) return { label: 'Good', className: 'bg-blue-100 text-blue-800 border-blue-200' };
  return { label: 'Needs Improvement', className: 'bg-amber-100 text-amber-800 border-amber-200' };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

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

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportPDF(title: string, headers: string[], rows: string[][]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const tableRows = rows.map(row =>
    `<tr>${row.map(cell => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${cell}</td>`).join('')}</tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#333}
    h1{font-size:20px;margin-bottom:5px}
    .subtitle{color:#666;font-size:12px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin-top:15px}
    th{background:#f8f9fa;padding:8px 10px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #dee2e6}
    .footer{margin-top:30px;padding-top:15px;border-top:1px solid #eee;font-size:10px;color:#999;text-align:center}
    @media print{body{padding:15px}.no-print{display:none}}
  </style></head><body>
    <h1>${title}</h1>
    <p class="subtitle">Generated on ${new Date().toLocaleString()} | SNACKOH BAKERS - Employee Productivity Report</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
    <p class="footer">SNACKOH BAKERS - Employee Productivity Report</p>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Pagination Component ─────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, totalItems, onPageChange }: {
  currentPage: number; totalPages: number; totalItems: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  const from = (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing {from}-{to} of {totalItems} &bull; Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1}
          className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">&laquo;</button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
        {start > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary">1</button>
            {start > 2 && <span className="px-1 text-muted-foreground">...</span>}
          </>
        )}
        {pages.map(p => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`px-3 py-1 text-sm border rounded-md ${p === currentPage ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}>{p}</button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-muted-foreground">...</span>}
            <button onClick={() => onPageChange(totalPages)} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary">{totalPages}</button>
          </>
        )}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}
          className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">&raquo;</button>
      </div>
    </div>
  );
}

// ─── Summary Card Component ───────────────────────────────────────────────────

function SummaryCard({ title, value, subtitle, color, icon }: {
  title: string; value: string; subtitle?: string; color?: string; icon?: string;
}) {
  const colorClass = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : color === 'purple' ? 'text-purple-600' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Export Buttons ───────────────────────────────────────────────────────────

function ExportButtons({ onCSV, onPDF }: { onCSV: () => void; onPDF: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onCSV} className="px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">
        CSV Export
      </button>
      <button onClick={onPDF} className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors">
        PDF Export
      </button>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function EmployeeProductivityPage() {
  // ── Core data ──
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [productivityRecords, setProductivityRecords] = useState<ProductivityRecord[]>([]);
  const [auditData, setAuditData] = useState<Record<string, { actions: number; membersAdded: number; moduleUsage: Record<string, number> }>>({});
  const [loading, setLoading] = useState(true);

  // ── Date range ──
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const defaultRange = getDateRange('this_month');
  const [dateFrom, setDateFrom] = useState(defaultRange.start);
  const [dateTo, setDateTo] = useState(defaultRange.end);

  // ── Search & filter ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);

  // ── Detail modal ──
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeKPI | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailDailyTrend, setDetailDailyTrend] = useState<DailyTrend[]>([]);
  const [detailCategoryBreakdown, setDetailCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [detailActivityLog, setDetailActivityLog] = useState<ActivityLogEntry[]>([]);

  // ── Log productivity modal ──
  const [showLogModal, setShowLogModal] = useState(false);
  const [logEditId, setLogEditId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({
    employeeId: '',
    metricType: 'batches_produced' as MetricType,
    metricValue: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // ── Delete confirmation ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // ─── Fetch Employees ────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, email, phone, department, role, category, status')
      .eq('status', 'Active')
      .order('first_name', { ascending: true });
    if (data && data.length > 0) {
      setEmployees(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name || '') as string,
        lastName: (r.last_name || '') as string,
        email: (r.email || '') as string,
        phone: (r.phone || '') as string,
        department: (r.department || '') as string,
        role: (r.role || '') as string,
        category: (r.category || '') as string,
        status: (r.status || 'Active') as string,
      })));
    } else {
      setEmployees([]);
    }
  }, []);

  // ─── Fetch Productivity Records ─────────────────────────────────────────────

  const fetchProductivityRecords = useCallback(async () => {
    setLoading(true);

    // Fetch from employee_productivity table
    let query = supabase
      .from('employee_productivity')
      .select('*')
      .order('date', { ascending: false });

    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data: prodData } = await query;

    const records: ProductivityRecord[] = [];

    if (prodData && prodData.length > 0) {
      for (const r of prodData) {
        records.push({
          id: (r as Record<string, unknown>).id as string,
          employeeId: (r as Record<string, unknown>).employee_id as string,
          metricType: (r as Record<string, unknown>).metric_type as MetricType,
          metricValue: ((r as Record<string, unknown>).metric_value || 0) as number,
          date: ((r as Record<string, unknown>).date || '') as string,
          notes: ((r as Record<string, unknown>).notes || '') as string,
          createdAt: ((r as Record<string, unknown>).created_at || '') as string,
        });
      }
    }

    // Also aggregate from production_runs (batches for bakers)
    const { data: productionData } = await supabase
      .from('production_runs')
      .select('operator, status, start_time')
      .eq('status', 'completed');

    if (productionData && productionData.length > 0) {
      const batchCounts: Record<string, { count: number; dates: string[] }> = {};
      for (const run of productionData) {
        const r = run as Record<string, unknown>;
        const operator = (r.operator || '') as string;
        const startDate = ((r.start_time || '') as string).split('T')[0];
        if (operator && startDate >= dateFrom && startDate <= dateTo) {
          if (!batchCounts[operator]) batchCounts[operator] = { count: 0, dates: [] };
          batchCounts[operator].count += 1;
          if (!batchCounts[operator].dates.includes(startDate)) {
            batchCounts[operator].dates.push(startDate);
          }
        }
      }
      // Match operator names to employee IDs
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        if (batchCounts[fullName]) {
          const existing = records.find(r => r.employeeId === emp.id && r.metricType === 'batches_produced');
          if (!existing) {
            records.push({
              id: `prod-${emp.id}`,
              employeeId: emp.id,
              metricType: 'batches_produced',
              metricValue: batchCounts[fullName].count,
              date: dateTo,
              notes: 'Aggregated from production runs',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Aggregate from pos_sales (cashier activity) — use cashier_name field
    const { data: posData } = await supabase
      .from('pos_sales')
      .select('cashier_name, created_at, total, status')
      .neq('status', 'Shift Close');

    if (posData && posData.length > 0) {
      const salesCounts: Record<string, { count: number; revenue: number }> = {};
      for (const sale of posData) {
        const r = sale as Record<string, unknown>;
        const cashier = ((r.cashier_name || '') as string).trim();
        const saleDate = ((r.created_at || '') as string).split('T')[0];
        const saleTotal = (r.total || 0) as number;
        if (cashier && saleDate >= dateFrom && saleDate <= dateTo) {
          if (!salesCounts[cashier]) salesCounts[cashier] = { count: 0, revenue: 0 };
          salesCounts[cashier].count += 1;
          salesCounts[cashier].revenue += saleTotal;
        }
      }
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        if (salesCounts[fullName]) {
          const existing = records.find(r => r.employeeId === emp.id && r.metricType === 'pos_sales');
          if (!existing) {
            records.push({
              id: `pos-${emp.id}`,
              employeeId: emp.id,
              metricType: 'pos_sales',
              metricValue: salesCounts[fullName].count,
              date: dateTo,
              notes: `Auto-tracked: ${salesCounts[fullName].count} sales, revenue ${salesCounts[fullName].revenue.toLocaleString()}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Aggregate from waste_records
    const { data: wasteData } = await supabase
      .from('waste_records')
      .select('reported_by, date');

    if (wasteData && wasteData.length > 0) {
      const wasteCounts: Record<string, number> = {};
      for (const w of wasteData) {
        const r = w as Record<string, unknown>;
        const reporter = (r.reported_by || '') as string;
        const wasteDate = ((r.date || '') as string).split('T')[0];
        if (reporter && wasteDate >= dateFrom && wasteDate <= dateTo) {
          wasteCounts[reporter] = (wasteCounts[reporter] || 0) + 1;
        }
      }
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        if (wasteCounts[fullName]) {
          const existing = records.find(r => r.employeeId === emp.id && r.metricType === 'waste_reports');
          if (!existing) {
            records.push({
              id: `waste-${emp.id}`,
              employeeId: emp.id,
              metricType: 'waste_reports',
              metricValue: wasteCounts[fullName],
              date: dateTo,
              notes: 'Aggregated from waste records',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Aggregate from deliveries
    const { data: deliveryData } = await supabase
      .from('deliveries')
      .select('driver_id, status, scheduled_date');

    if (deliveryData && deliveryData.length > 0) {
      const deliveryCounts: Record<string, { completed: number; assigned: number }> = {};
      for (const d of deliveryData) {
        const r = d as Record<string, unknown>;
        const driverId = (r.driver_id || '') as string;
        const delDate = ((r.scheduled_date || '') as string).split('T')[0];
        if (driverId && delDate >= dateFrom && delDate <= dateTo) {
          if (!deliveryCounts[driverId]) deliveryCounts[driverId] = { completed: 0, assigned: 0 };
          deliveryCounts[driverId].assigned += 1;
          if (r.status === 'Delivered') {
            deliveryCounts[driverId].completed += 1;
          }
        }
      }
      for (const [driverId, counts] of Object.entries(deliveryCounts)) {
        const existingCompleted = records.find(r => r.employeeId === driverId && r.metricType === 'deliveries_completed');
        if (!existingCompleted) {
          records.push({
            id: `del-comp-${driverId}`,
            employeeId: driverId,
            metricType: 'deliveries_completed',
            metricValue: counts.completed,
            date: dateTo,
            notes: 'Aggregated from deliveries',
            createdAt: new Date().toISOString(),
          });
        }
        const existingAssigned = records.find(r => r.employeeId === driverId && r.metricType === 'deliveries_assigned');
        if (!existingAssigned) {
          records.push({
            id: `del-asgn-${driverId}`,
            employeeId: driverId,
            metricType: 'deliveries_assigned',
            metricValue: counts.assigned,
            date: dateTo,
            notes: 'Aggregated from deliveries',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Aggregate system logins from audit_log
    const { data: loginData } = await supabase
      .from('audit_log')
      .select('user_name, created_at')
      .eq('action', 'LOGIN')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59');

    if (loginData && loginData.length > 0) {
      const loginCounts: Record<string, number> = {};
      for (const log of loginData) {
        const r = log as Record<string, unknown>;
        const userName = ((r.user_name || '') as string).trim();
        if (userName) {
          loginCounts[userName] = (loginCounts[userName] || 0) + 1;
        }
      }
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        const matchedName = Object.keys(loginCounts).find(
          name => name.toLowerCase() === fullName.toLowerCase() || name.toLowerCase() === (emp.email || '').toLowerCase()
        );
        if (matchedName) {
          const existing = records.find(r => r.employeeId === emp.id && r.metricType === 'system_logins');
          if (!existing) {
            records.push({
              id: `login-${emp.id}`,
              employeeId: emp.id,
              metricType: 'system_logins',
              metricValue: loginCounts[matchedName],
              date: dateTo,
              notes: 'Auto-tracked from system login records',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Aggregate from orders (order management activity)
    const { data: orderData } = await supabase
      .from('orders')
      .select('created_at, status, delivery_notes')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59');

    if (orderData && orderData.length > 0) {
      // Track POS-facilitated orders by parsing delivery_notes for cashier info
      const facilitatedCounts: Record<string, number> = {};
      for (const order of orderData) {
        const r = order as Record<string, unknown>;
        const notes = ((r.delivery_notes || '') as string);
        const cashierMatch = notes.match(/Cashier:\s*(.+?)$/);
        if (cashierMatch) {
          const cashierName = cashierMatch[1].trim();
          facilitatedCounts[cashierName] = (facilitatedCounts[cashierName] || 0) + 1;
        }
      }
      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        if (facilitatedCounts[fullName]) {
          const existing = records.find(r => r.employeeId === emp.id && r.metricType === 'pos_facilitated');
          if (!existing) {
            records.push({
              id: `facilitated-${emp.id}`,
              employeeId: emp.id,
              metricType: 'pos_facilitated',
              metricValue: facilitatedCounts[fullName],
              date: dateTo,
              notes: 'Auto-tracked from order records facilitated via POS',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    setProductivityRecords(records);
    setLoading(false);
  }, [dateFrom, dateTo, employees]);

  // ─── Fetch Audit Log Activity Per Employee ─────────────────────────────────

  const fetchAuditActivity = useCallback(async () => {
    if (employees.length === 0) return;

    const { data: auditLogs } = await supabase
      .from('audit_log')
      .select('user_name, action, module, created_at')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!auditLogs || auditLogs.length === 0) {
      setAuditData({});
      return;
    }

    const empAuditMap: Record<string, { actions: number; membersAdded: number; moduleUsage: Record<string, number> }> = {};

    for (const log of auditLogs) {
      const r = log as Record<string, unknown>;
      const userName = ((r.user_name || '') as string).trim();
      const action = (r.action || '') as string;
      const module = (r.module || '') as string;

      if (!userName) continue;

      // Match audit log user_name to employee name
      const matchedEmp = employees.find(emp => {
        const fullName = `${emp.firstName} ${emp.lastName}`.trim();
        return fullName.toLowerCase() === userName.toLowerCase() || emp.email.toLowerCase() === userName.toLowerCase();
      });

      if (!matchedEmp) continue;

      const empId = matchedEmp.id;
      if (!empAuditMap[empId]) {
        empAuditMap[empId] = { actions: 0, membersAdded: 0, moduleUsage: {} };
      }

      empAuditMap[empId].actions += 1;

      // Track members added (employee CREATE actions)
      if (action === 'CREATE' && (module === 'Employees' || module === 'Customers')) {
        empAuditMap[empId].membersAdded += 1;
      }

      // Track module usage
      if (module) {
        empAuditMap[empId].moduleUsage[module] = (empAuditMap[empId].moduleUsage[module] || 0) + 1;
      }
    }

    setAuditData(empAuditMap);
  }, [employees, dateFrom, dateTo]);

  // ─── Initial Load ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (employees.length > 0) {
      fetchProductivityRecords();
      fetchAuditActivity();
    } else {
      setLoading(false);
    }
  }, [employees, fetchProductivityRecords, fetchAuditActivity]);

  // ─── Date Preset Handling ───────────────────────────────────────────────────

  useEffect(() => {
    if (datePreset !== 'custom') {
      const range = getDateRange(datePreset);
      setDateFrom(range.start);
      setDateTo(range.end);
    }
  }, [datePreset]);

  // ─── Computed KPI Data ──────────────────────────────────────────────────────

  const employeeKPIs: EmployeeKPI[] = useMemo(() => {
    return employees.map(emp => {
      const empRecords = productivityRecords.filter(r => r.employeeId === emp.id);
      const batches = empRecords.filter(r => r.metricType === 'batches_produced').reduce((s, r) => s + r.metricValue, 0);
      const delCompleted = empRecords.filter(r => r.metricType === 'deliveries_completed').reduce((s, r) => s + r.metricValue, 0);
      const delAssigned = empRecords.filter(r => r.metricType === 'deliveries_assigned').reduce((s, r) => s + r.metricValue, 0);
      const posSales = empRecords.filter(r => r.metricType === 'pos_sales' || r.metricType === 'pos_facilitated').reduce((s, r) => s + r.metricValue, 0);
      const wasteReports = empRecords.filter(r => r.metricType === 'waste_reports').reduce((s, r) => s + r.metricValue, 0);
      const systemLogins = empRecords.filter(r => r.metricType === 'system_logins').reduce((s, r) => s + r.metricValue, 0);
      const overallScore = calculateKPIScore(emp, productivityRecords);
      const badge = getStatusBadge(overallScore);

      // Audit log metrics
      const empAudit = auditData[emp.id] || { actions: 0, membersAdded: 0, moduleUsage: {} };

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
        role: emp.role,
        department: emp.department,
        category: emp.category,
        email: emp.email,
        phone: emp.phone,
        batchesProduced: batches,
        deliveriesCompleted: delCompleted,
        deliveriesAssigned: delAssigned,
        posSales,
        wasteReports,
        systemLogins,
        overallScore,
        status: badge.label as EmployeeKPI['status'],
        systemActions: empAudit.actions,
        membersAdded: empAudit.membersAdded,
        moduleUsage: empAudit.moduleUsage,
      };
    });
  }, [employees, productivityRecords, auditData]);

  // ─── Filtered & Searched KPIs ───────────────────────────────────────────────

  const filteredKPIs = useMemo(() => {
    let result = employeeKPIs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        e => e.employeeName.toLowerCase().includes(q) ||
             e.role.toLowerCase().includes(q) ||
             e.department.toLowerCase().includes(q) ||
             e.category.toLowerCase().includes(q)
      );
    }
    if (filterRole !== 'All') {
      result = result.filter(e => e.category === filterRole);
    }
    if (filterDepartment !== 'All') {
      result = result.filter(e => e.department === filterDepartment);
    }

    return result;
  }, [employeeKPIs, searchQuery, filterRole, filterDepartment]);

  // ─── Pagination ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredKPIs.length / PAGE_SIZE));
  const paginatedKPIs = filteredKPIs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterDepartment, dateFrom, dateTo]);

  // ─── Dashboard KPI Summaries ────────────────────────────────────────────────

  const totalTracked = employeeKPIs.length;
  const avgScore = totalTracked > 0
    ? Math.round(employeeKPIs.reduce((s, e) => s + e.overallScore, 0) / totalTracked)
    : 0;
  const topPerformer = employeeKPIs.length > 0
    ? [...employeeKPIs].sort((a, b) => b.overallScore - a.overallScore)[0]
    : null;
  const lowPerformers = employeeKPIs.filter(e => e.overallScore < 60).length;
  const totalSystemActions = employeeKPIs.reduce((s, e) => s + e.systemActions, 0);
  const totalMembersAdded = employeeKPIs.reduce((s, e) => s + e.membersAdded, 0);

  // ─── Unique Roles & Departments ─────────────────────────────────────────────

  const uniqueRoles = useMemo(() => {
    const roles = new Set(employees.map(e => e.category).filter(Boolean));
    return ['All', ...Array.from(roles).sort()];
  }, [employees]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return ['All', ...Array.from(depts).sort()];
  }, [employees]);

  // ─── Detail Modal Logic ─────────────────────────────────────────────────────

  const openDetailModal = useCallback((kpi: EmployeeKPI) => {
    setSelectedEmployee(kpi);

    const empRecords = productivityRecords.filter(r => r.employeeId === kpi.employeeId);

    // Build daily trend
    const dailyMap: Record<string, number> = {};
    for (const rec of empRecords) {
      const d = rec.date.split('T')[0];
      dailyMap[d] = (dailyMap[d] || 0) + rec.metricValue;
    }
    const trend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => {
        // Calculate a rough daily score based on totals
        const dailyScore = Math.min(100, Math.round((total / 10) * 100));
        return { date: formatDate(date), score: dailyScore };
      });
    setDetailDailyTrend(trend.length > 0 ? trend : [
      { date: 'No Data', score: 0 },
    ]);

    // Build category breakdown
    const catMap: Record<string, number> = {};
    for (const rec of empRecords) {
      const label = metricLabel(rec.metricType);
      catMap[label] = (catMap[label] || 0) + rec.metricValue;
    }
    const breakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));
    setDetailCategoryBreakdown(breakdown.length > 0 ? breakdown : [
      { name: 'No Data', value: 0 },
    ]);

    // Build activity log
    const activityLog: ActivityLogEntry[] = empRecords
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map(r => ({
        id: r.id,
        date: r.date,
        metricType: metricLabel(r.metricType),
        metricValue: r.metricValue,
        notes: r.notes,
      }));
    setDetailActivityLog(activityLog);

    setShowDetailModal(true);
  }, [productivityRecords]);

  // ─── Log Productivity CRUD ──────────────────────────────────────────────────

  const resetLogForm = () => {
    setLogForm({
      employeeId: '',
      metricType: 'batches_produced',
      metricValue: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setLogEditId(null);
  };

  const handleOpenLogModal = (editRecord?: ProductivityRecord) => {
    if (editRecord) {
      setLogEditId(editRecord.id);
      setLogForm({
        employeeId: editRecord.employeeId,
        metricType: editRecord.metricType,
        metricValue: editRecord.metricValue.toString(),
        date: editRecord.date.split('T')[0],
        notes: editRecord.notes,
      });
    } else {
      resetLogForm();
    }
    setShowLogModal(true);
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.employeeId || !logForm.metricValue) return;

    const row = {
      employee_id: logForm.employeeId,
      metric_type: logForm.metricType,
      metric_value: parseFloat(logForm.metricValue) || 0,
      date: logForm.date,
      notes: logForm.notes,
    };

    try {
      if (logEditId) {
        await supabase.from('employee_productivity').update(row).eq('id', logEditId);
        logAudit({
          action: 'UPDATE',
          module: 'Employee Productivity',
          record_id: logEditId,
          details: { ...row },
        });
      } else {
        const { data: inserted } = await supabase.from('employee_productivity').insert(row).select().single();
        logAudit({
          action: 'CREATE',
          module: 'Employee Productivity',
          record_id: inserted?.id || '',
          details: { ...row },
        });
      }
      await fetchProductivityRecords();
    } catch (err) {
      console.error('Error saving productivity record:', err);
    }

    resetLogForm();
    setShowLogModal(false);
  };

  const handleDeleteRecord = async () => {
    if (!deleteTargetId) return;
    try {
      await supabase.from('employee_productivity').delete().eq('id', deleteTargetId);
      logAudit({
        action: 'DELETE',
        module: 'Employee Productivity',
        record_id: deleteTargetId,
        details: { deleted_record_id: deleteTargetId },
      });
      await fetchProductivityRecords();
    } catch (err) {
      console.error('Error deleting record:', err);
    }
    setDeleteTargetId(null);
    setShowDeleteConfirm(false);
  };

  // ─── Export Handlers ────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const headers = ['Employee', 'Role', 'Department', 'Batches', 'Deliveries (Done/Assigned)', 'POS Sales', 'Waste Reports', 'Logins', 'System Actions', 'Members Added', 'KPI Score', 'Status'];
    const rows = filteredKPIs.map(e => [
      e.employeeName,
      e.category,
      e.department,
      e.batchesProduced.toString(),
      `${e.deliveriesCompleted}/${e.deliveriesAssigned}`,
      e.posSales.toString(),
      e.wasteReports.toString(),
      e.systemLogins.toString(),
      e.systemActions.toString(),
      e.membersAdded.toString(),
      e.overallScore.toString(),
      e.status,
    ]);
    exportCSV('employee_productivity_report', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Employee', 'Role', 'Department', 'Batches', 'Deliveries', 'POS Sales', 'Waste', 'Logins', 'Sys Actions', 'Members', 'Score', 'Status'];
    const rows = filteredKPIs.map(e => [
      e.employeeName,
      e.category,
      e.department,
      e.batchesProduced.toString(),
      `${e.deliveriesCompleted}/${e.deliveriesAssigned}`,
      e.posSales.toString(),
      e.wasteReports.toString(),
      e.systemLogins.toString(),
      e.systemActions.toString(),
      e.membersAdded.toString(),
      `${e.overallScore}/100`,
      e.status,
    ]);
    exportPDF('Employee Productivity Report', headers, rows);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Productivity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated tracking of employee KPIs and performance across all modules — POS, Production, Delivery, Inventory, and more. Data is synced automatically from system activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchProductivityRecords(); fetchAuditActivity(); }}
            disabled={loading}
            className="px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary/10 font-medium transition-colors disabled:opacity-40"
          >
            {loading ? 'Syncing...' : 'Refresh Data'}
          </button>
          <ExportButtons onCSV={handleExportCSV} onPDF={handleExportPDF} />
          <button
            onClick={() => handleOpenLogModal()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium transition-opacity"
          >
            + Manual Entry
          </button>
        </div>
      </div>

      {/* Auto-tracking info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-sm">&#9889;</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">Automated Productivity Tracking</p>
            <p className="text-xs text-blue-700 mt-0.5">
              This module automatically tracks employee activity based on their role and permissions across the entire system.
              <strong> Bakers:</strong> production runs completed &bull;
              <strong> Riders/Drivers:</strong> deliveries completed vs assigned &bull;
              <strong> Cashiers/Sales:</strong> POS transactions &bull;
              <strong> All roles:</strong> system logins, audit trail actions, waste reporting, and module interactions.
            </p>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Period:</span>
          {(['today', 'this_week', 'this_month', 'custom'] as DatePreset[]).map(preset => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                datePreset === preset
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {preset === 'today' ? 'Today' : preset === 'this_week' ? 'This Week' : preset === 'this_month' ? 'This Month' : 'Custom Range'}
            </button>
          ))}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground"
              />
            </div>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDate(dateFrom)} - {formatDate(dateTo)}
          </span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard
          title="Total Employees Tracked"
          value={totalTracked.toString()}
          subtitle="Active employees with data"
          color="blue"
          icon="👥"
        />
        <SummaryCard
          title="Avg Productivity Score"
          value={`${avgScore}/100`}
          subtitle={avgScore > 80 ? 'Team performing excellently' : avgScore >= 60 ? 'Team performing well' : 'Room for improvement'}
          color={avgScore > 80 ? 'green' : avgScore >= 60 ? 'blue' : 'amber'}
          icon="📊"
        />
        <SummaryCard
          title="Top Performer"
          value={topPerformer ? topPerformer.employeeName : '-'}
          subtitle={topPerformer ? `Score: ${topPerformer.overallScore}/100 (${topPerformer.category})` : 'No data yet'}
          color="green"
          icon="🏆"
        />
        <SummaryCard
          title="Low Performers"
          value={lowPerformers.toString()}
          subtitle="Employees scoring below 60"
          color={lowPerformers > 0 ? 'red' : 'green'}
          icon="⚠️"
        />
        <SummaryCard
          title="Total System Actions"
          value={totalSystemActions.toString()}
          subtitle="All module interactions tracked"
          color="purple"
          icon="🔄"
        />
        <SummaryCard
          title="Members Added"
          value={totalMembersAdded.toString()}
          subtitle="Employees & customers created"
          color="blue"
          icon="➕"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by name, role, or department..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
          >
            {uniqueRoles.map(r => (
              <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>
            ))}
          </select>
          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
          >
            {uniqueDepartments.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>
            ))}
          </select>
          {(searchQuery || filterRole !== 'All' || filterDepartment !== 'All') && (
            <button
              onClick={() => { setSearchQuery(''); setFilterRole('All'); setFilterDepartment('All'); }}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Filters
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredKPIs.length} of {employeeKPIs.length} employees
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading productivity data...</p>
            </div>
          </div>
        ) : paginatedKPIs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-lg font-medium text-foreground">No productivity data found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || filterRole !== 'All' || filterDepartment !== 'All'
                ? 'Try adjusting your search or filters'
                : 'Start by logging productivity entries for your employees'}
            </p>
            <button
              onClick={() => handleOpenLogModal()}
              className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              + Log First Entry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Department</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Batches</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Deliveries</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">POS Sales</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Waste Rpts</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Logins</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Sys Actions</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Members Added</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">KPI Score</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedKPIs.map((kpi, idx) => {
                    const badge = getStatusBadge(kpi.overallScore);
                    const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={kpi.employeeId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{rowNum}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openDetailModal(kpi)}
                            className="text-left hover:underline"
                          >
                            <span className="font-medium text-foreground">{kpi.employeeName}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{kpi.category || kpi.role}</td>
                        <td className="px-4 py-3 text-muted-foreground">{kpi.department || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium">{kpi.batchesProduced || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {kpi.deliveriesAssigned > 0 ? (
                            <span className="font-medium">
                              {kpi.deliveriesCompleted}/{kpi.deliveriesAssigned}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({Math.round((kpi.deliveriesCompleted / kpi.deliveriesAssigned) * 100)}%)
                              </span>
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{kpi.posSales || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium">{kpi.wasteReports || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium">{kpi.systemLogins || '-'}</td>
                        <td className="px-4 py-3 text-center font-medium">
                          {kpi.systemActions > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200">
                              {kpi.systemActions}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {kpi.membersAdded > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
                              {kpi.membersAdded}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  kpi.overallScore > 80 ? 'bg-emerald-500' :
                                  kpi.overallScore >= 60 ? 'bg-blue-500' :
                                  'bg-amber-500'
                                }`}
                                style={{ width: `${kpi.overallScore}%` }}
                              />
                            </div>
                            <span className="font-bold text-foreground">{kpi.overallScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openDetailModal(kpi)}
                            className="px-2.5 py-1 text-xs bg-secondary text-foreground border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredKPIs.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>

      {/* ── Employee Detail Modal ── */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedEmployee(null); }}
        title="Employee Productivity Detail"
        size="4xl"
      >
        {selectedEmployee && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-start gap-4 bg-muted/30 rounded-xl p-4 border border-border">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                {selectedEmployee.employeeName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-foreground">{selectedEmployee.employeeName}</h3>
                <p className="text-sm text-muted-foreground">{selectedEmployee.category} &bull; {selectedEmployee.department}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                  {selectedEmployee.email && <span>Email: {selectedEmployee.email}</span>}
                  {selectedEmployee.phone && <span>Phone: {selectedEmployee.phone}</span>}
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className={`text-3xl font-bold ${
                  selectedEmployee.overallScore > 80 ? 'text-emerald-600' :
                  selectedEmployee.overallScore >= 60 ? 'text-blue-600' :
                  'text-amber-600'
                }`}>
                  {selectedEmployee.overallScore}
                </div>
                <p className="text-xs text-muted-foreground">KPI Score</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mt-1 ${getStatusBadge(selectedEmployee.overallScore).className}`}>
                  {getStatusBadge(selectedEmployee.overallScore).label}
                </span>
              </div>
            </div>

            {/* KPI Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Batches</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.batchesProduced}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Deliveries Done</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.deliveriesCompleted}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Assigned</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.deliveriesAssigned}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">POS Sales</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.posSales}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Waste Rpts</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.wasteReports}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Logins</p>
                <p className="text-xl font-bold text-foreground">{selectedEmployee.systemLogins}</p>
              </div>
              <div className="bg-card border border-violet-200 rounded-lg p-3 text-center bg-violet-50/50">
                <p className="text-xs text-violet-600 mb-1">System Actions</p>
                <p className="text-xl font-bold text-violet-700">{selectedEmployee.systemActions}</p>
              </div>
              <div className="bg-card border border-cyan-200 rounded-lg p-3 text-center bg-cyan-50/50">
                <p className="text-xs text-cyan-600 mb-1">Members Added</p>
                <p className="text-xl font-bold text-cyan-700">{selectedEmployee.membersAdded}</p>
              </div>
            </div>

            {/* Module Usage Breakdown */}
            {selectedEmployee.systemActions > 0 && Object.keys(selectedEmployee.moduleUsage).length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h4 className="text-sm font-semibold text-foreground">System Activity by Module</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Overall interactions across the system</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(selectedEmployee.moduleUsage)
                      .sort(([, a], [, b]) => b - a)
                      .map(([mod, count]) => (
                        <div key={mod} className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg border border-border">
                          <span className="text-xs font-medium text-foreground truncate">{mod}</span>
                          <span className="text-xs font-bold text-primary ml-2 shrink-0">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Daily Trend - Line Chart */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Daily Performance Trend</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={detailDailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Category Breakdown - Bar Chart */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Metric Breakdown</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={detailCategoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {detailCategoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Task Distribution - Pie Chart */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Task Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={detailCategoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {detailCategoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activity Log Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Recent Activity Log</h4>
              </div>
              {detailActivityLog.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No activity records found for this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Metric</th>
                        <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Value</th>
                        <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailActivityLog.map(entry => (
                        <tr key={entry.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2 text-muted-foreground">{formatDate(entry.date)}</td>
                          <td className="px-4 py-2">{entry.metricType}</td>
                          <td className="px-4 py-2 text-center font-medium">{entry.metricValue}</td>
                          <td className="px-4 py-2 text-muted-foreground">{entry.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Log Productivity Modal ── */}
      <Modal
        isOpen={showLogModal}
        onClose={() => { setShowLogModal(false); resetLogForm(); }}
        title={logEditId ? 'Edit Productivity Record' : 'Log Productivity Entry'}
        size="lg"
      >
        <form onSubmit={handleLogSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Employee *</label>
            <select
              required
              value={logForm.employeeId}
              onChange={e => setLogForm(prev => ({ ...prev, employeeId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
            >
              <option value="">Select Employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Metric Type *</label>
              <select
                required
                value={logForm.metricType}
                onChange={e => setLogForm(prev => ({ ...prev, metricType: e.target.value as MetricType }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
              >
                {METRIC_TYPES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Value *</label>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={logForm.metricValue}
                onChange={e => setLogForm(prev => ({ ...prev, metricValue: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Date *</label>
            <input
              type="date"
              required
              value={logForm.date}
              onChange={e => setLogForm(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={logForm.notes}
              onChange={e => setLogForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Optional notes about this productivity entry..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowLogModal(false); resetLogForm(); }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium transition-opacity"
            >
              {logEditId ? 'Update Record' : 'Save Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
        title="Confirm Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this productivity record? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRecord}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Productivity Records Management Table ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Productivity Records Log</h3>
          <button
            onClick={() => handleOpenLogModal()}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Entry
          </button>
        </div>
        {productivityRecords.filter(r => !r.id.startsWith('prod-') && !r.id.startsWith('pos-') && !r.id.startsWith('waste-') && !r.id.startsWith('del-')).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No manually logged productivity records yet. Click &quot;+ New Entry&quot; to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Metric</th>
                  <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Value</th>
                  <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Notes</th>
                  <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productivityRecords
                  .filter(r => !r.id.startsWith('prod-') && !r.id.startsWith('pos-') && !r.id.startsWith('waste-') && !r.id.startsWith('del-'))
                  .slice(0, 20)
                  .map(record => {
                    const emp = employees.find(e => e.id === record.employeeId);
                    const empName = emp ? `${emp.firstName} ${emp.lastName}` : record.employeeId;
                    return (
                      <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(record.date)}</td>
                        <td className="px-4 py-2 font-medium text-foreground">{empName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{metricLabel(record.metricType)}</td>
                        <td className="px-4 py-2 text-center font-medium">{record.metricValue}</td>
                        <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{record.notes || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenLogModal(record)}
                              className="px-2 py-1 text-xs bg-secondary text-foreground border border-border rounded-md hover:bg-muted transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => { setDeleteTargetId(record.id); setShowDeleteConfirm(true); }}
                              className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
