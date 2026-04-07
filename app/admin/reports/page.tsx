'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { logAudit } from '@/lib/audit-logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface PlReport {
  id: string; period: string; revenue: number; costs: number; profit: number; margin: number; createdAt: string;
}
interface Order {
  id: string; orderNumber: string; customerName: string; totalAmount: number; status: string; paymentStatus: string; orderDate: string;
}
interface InventoryItem {
  id: string; name: string; type: string; category: string; quantity: number; unit: string; unitCost: number; reorderLevel: number; supplier: string; lastRestocked: string;
}
interface Debtor {
  id: string; name: string; totalDebt: number; debtDays: number; lastPayment: string; status: 'Current' | 'Overdue' | 'Defaulted';
}
interface Creditor {
  id: string; supplierName: string; totalCredit: number; creditDays: number; nextPaymentDate: string; status: 'Current' | 'Overdue' | 'Paid';
}
interface LedgerEntry {
  id: string; entryDate: string; description: string; account: string; debit: number; credit: number; reference: string; category: string; createdAt: string;
}
interface SaleRecord {
  id: string; productName: string; quantity: number; unitPrice: number; totalPrice: number; saleDate: string; customerName: string;
}
interface PosSale {
  id: string; receiptNumber: string; customerName: string; saleType: string; paymentMethod: string; total: number; createdAt: string;
}

type TabKey = 'overview' | 'pnl' | 'sales' | 'inventory' | 'debtors' | 'creditors' | 'items' | 'ledger' | 'balance-sheet';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'pnl', label: 'P&L', icon: '📈' },
  { key: 'balance-sheet', label: 'Balance Sheet', icon: '⚖️' },
  { key: 'sales', label: 'Sales', icon: '💰' },
  { key: 'inventory', label: 'Inventory', icon: '📦' },
  { key: 'debtors', label: 'Debtors', icon: '📋' },
  { key: 'creditors', label: 'Creditors', icon: '🏦' },
  { key: 'items', label: 'Items', icon: '🏷️' },
  { key: 'ledger', label: 'Ledger', icon: '📒' },
];

const PAGE_SIZE = 10;
const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// Safe number: guards against NaN, undefined, null, Infinity
function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Safe division: prevents division by zero and NaN results
function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

// Round to 2 decimal places for currency precision
function round2(val: number): number {
  return Math.round((safeNum(val) + Number.EPSILON) * 100) / 100;
}

function formatKES(amount: number): string {
  return `KES ${safeNum(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try { return new Date(dateStr).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return dateStr; }
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
}

// ─── CSV Export Helper ────────────────────────────────────────────────────────

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

// ─── PDF Export Helper ────────────────────────────────────────────────────────

interface ReportBusinessInfo {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  reportLogoHeight: number;
  reportWatermarkEnabled: boolean;
  reportWatermarkOpacity: number;
}

function exportPDF(title: string, headers: string[], rows: string[][], businessInfo?: ReportBusinessInfo) {
  const win = window.open('', '_blank');
  if (!win) return;
  const b = businessInfo || { businessName: 'SNACKOH BITES', tagline: 'Quality Baked Goods', phone: '', email: '', address: 'Nairobi, Kenya', logoUrl: '', reportLogoHeight: 45, reportWatermarkEnabled: false, reportWatermarkOpacity: 8 };
  const logoH = b.reportLogoHeight || 45;
  const wmEnabled = b.reportWatermarkEnabled && b.logoUrl;
  const wmOpacity = (b.reportWatermarkOpacity || 8) / 100;
  const tableRows = rows.map((row, i) => `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">${row.map(cell => `<td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:12px">${cell}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>${title} - ${b.businessName}</title><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 40px; color: #1a1a1a; background: #fff; }
    .report { max-width: 900px; margin: 0 auto; position: relative; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 0; opacity: ${wmOpacity}; }
    .watermark img { max-width: 400px; max-height: 400px; }
    .content { position: relative; z-index: 1; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #ea580c; }
    .logo-section h1 { font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px; }
    .logo-section .tagline { font-size: 11px; color: #888; margin-top: 2px; }
    .logo-section .contact { font-size: 11px; color: #666; margin-top: 8px; line-height: 1.6; }
    .report-title { text-align: right; }
    .report-title h2 { font-size: 22px; font-weight: 700; color: #333; }
    .report-title .date { font-size: 11px; color: #888; margin-top: 4px; }
    .report-title .period { font-size: 12px; color: #ea580c; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; border-radius: 8px; overflow: hidden; }
    thead th { background: #1a1a1a; color: #fff; padding: 12px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
    tbody tr.even { background: #fafafa; }
    tbody tr.odd { background: #fff; }
    tbody tr:hover { background: #fff7ed; }
    .summary { margin-top: 25px; display: flex; gap: 15px; }
    .summary-card { flex: 1; background: #f8f8f8; border-radius: 8px; padding: 14px 18px; border-left: 3px solid #ea580c; }
    .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; }
    .summary-card .value { font-size: 18px; font-weight: 800; color: #1a1a1a; margin-top: 2px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; }
    .footer .company { font-size: 12px; font-weight: 700; color: #333; }
    .footer .details { font-size: 10px; color: #999; margin-top: 4px; line-height: 1.6; }
    .footer .powered { font-size: 9px; color: #ccc; margin-top: 8px; }
    @media print { body { padding: 20px; } .no-print { display: none; } .watermark { position: fixed; } }
  </style></head><body>
  <div class="report">
    ${wmEnabled ? `<div class="watermark"><img src="${b.logoUrl}" alt="Watermark" /></div>` : ''}
    <div class="content">
    <div class="header">
      <div class="logo-section">
        ${b.logoUrl ? `<img src="${b.logoUrl}" alt="${b.businessName}" style="height:${logoH}px;margin-bottom:6px" />` : ''}
        <h1>${b.businessName}</h1>
        <div class="tagline">${b.tagline}</div>
        <div class="contact">${b.address}${b.phone ? `<br>${b.phone}` : ''}${b.email ? ` | ${b.email}` : ''}</div>
      </div>
      <div class="report-title">
        <h2>${title}</h2>
        <div class="date">Generated: ${new Date().toLocaleString()}</div>
      </div>
    </div>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
    <div style="margin-top:8px;text-align:right;font-size:11px;color:#888">${rows.length} record${rows.length !== 1 ? 's' : ''}</div>
    <div class="footer">
      <div class="company">${b.businessName}</div>
      <div class="details">${b.address}${b.phone ? ` | ${b.phone}` : ''}${b.email ? ` | ${b.email}` : ''}</div>
      <div class="powered">Confidential - For internal use only</div>
    </div>
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

// ─── Pagination Component ─────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, totalItems, onPageChange }: { currentPage: number; totalPages: number; totalItems: number; onPageChange: (p: number) => void }) {
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
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">&laquo;</button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
        {start > 1 && (<><button onClick={() => onPageChange(1)} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary">1</button>{start > 2 && <span className="px-1 text-muted-foreground">...</span>}</>)}
        {pages.map(p => (<button key={p} onClick={() => onPageChange(p)} className={`px-3 py-1 text-sm border rounded-md ${p === currentPage ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}>{p}</button>))}
        {end < totalPages && (<>{end < totalPages - 1 && <span className="px-1 text-muted-foreground">...</span>}<button onClick={() => onPageChange(totalPages)} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary">{totalPages}</button></>)}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">&raquo;</button>
      </div>
    </div>
  );
}

// ─── Summary Card Component ───────────────────────────────────────────────────

function SummaryCard({ title, value, subtitle, color }: { title: string; value: string; subtitle?: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-600' : color === 'purple' ? 'text-purple-600' : 'text-foreground';
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Export Buttons ───────────────────────────────────────────────────────────

function ExportButtons({ onCSV, onPDF }: { onCSV: () => void; onPDF: () => void }) {
  return (
    <div className="flex gap-2">
      <button onClick={onCSV} className="px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors">CSV</button>
      <button onClick={onPDF} className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors">PDF</button>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const defaultRange = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.start);
  const [dateTo, setDateTo] = useState(defaultRange.end);

  // Business settings for report header
  const [reportBizInfo, setReportBizInfo] = useState<ReportBusinessInfo>({
    businessName: 'SNACKOH BITES', tagline: 'Quality Baked Goods', phone: '', email: '', address: 'Nairobi, Kenya', logoUrl: '',
    reportLogoHeight: 45, reportWatermarkEnabled: false, reportWatermarkOpacity: 8,
  });

  // Data states
  const [plReports, setPlReports] = useState<PlReport[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [costEntries, setCostEntries] = useState<{ id: string; category: string; amount: number; costType: string }[]>([]);
  const [assets, setAssets] = useState<{ id: string; name: string; purchasePrice: number; currentValue: number; accumulatedDepreciation: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [pnlPage, setPnlPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [debtorsPage, setDebtorsPage] = useState(1);
  const [creditorsPage, setCreditorsPage] = useState(1);
  const [itemsPage, setItemsPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);

  // Modal states
  const [showPnlForm, setShowPnlForm] = useState(false);
  const [pnlEditingId, setPnlEditingId] = useState<string | null>(null);
  const [pnlFormData, setPnlFormData] = useState({ period: '', revenue: 0, costs: 0 });
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerEditingId, setLedgerEditingId] = useState<string | null>(null);
  const [ledgerFormData, setLedgerFormData] = useState({ entryDate: new Date().toISOString().split('T')[0], description: '', account: '', debit: 0, credit: 0, reference: '', category: 'General' });
  const [showDetail, setShowDetail] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailContent, setDetailContent] = useState<{ label: string; value: string }[]>([]);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchPlReports = useCallback(async () => {
    const { data } = await supabase.from('pl_reports').select('*').order('created_at', { ascending: false });
    if (data) setPlReports(data.map((r: Record<string, unknown>) => ({ id: r.id as string, period: (r.period || '') as string, revenue: (r.revenue || 0) as number, costs: (r.costs || 0) as number, profit: (r.profit || 0) as number, margin: (r.margin || 0) as number, createdAt: (r.created_at || '') as string })));
  }, []);

  const fetchOrders = useCallback(async () => {
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (dateFrom) query = query.gte('order_date', dateFrom);
    if (dateTo) query = query.lte('order_date', dateTo);
    const { data } = await query;
    if (data) setOrders(data.map((r: Record<string, unknown>) => ({ id: r.id as string, orderNumber: (r.order_number || '') as string, customerName: (r.customer_name || '') as string, totalAmount: (r.total_amount || 0) as number, status: (r.status || '') as string, paymentStatus: (r.payment_status || 'Unpaid') as string, orderDate: (r.order_date || '') as string })));
  }, [dateFrom, dateTo]);

  const fetchInventory = useCallback(async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('name', { ascending: true });
    if (data) setInventoryItems(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, type: (r.type || 'Consumable') as string, category: (r.category || '') as string, quantity: (r.quantity || 0) as number, unit: (r.unit || 'kg') as string, unitCost: (r.unit_cost || 0) as number, reorderLevel: (r.reorder_level || 0) as number, supplier: (r.supplier || '') as string, lastRestocked: (r.last_restocked || '') as string })));
  }, []);

  const fetchDebtors = useCallback(async () => {
    const { data } = await supabase.from('debtors').select('*').order('created_at', { ascending: false });
    if (data) setDebtors(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, totalDebt: (r.total_debt || 0) as number, debtDays: (r.debt_days || 0) as number, lastPayment: (r.last_payment_date || '') as string, status: (r.status || 'Current') as Debtor['status'] })));
  }, []);

  const fetchCreditors = useCallback(async () => {
    const { data } = await supabase.from('creditors').select('*').order('created_at', { ascending: false });
    if (data) setCreditors(data.map((r: Record<string, unknown>) => ({ id: r.id as string, supplierName: (r.supplier_name || '') as string, totalCredit: (r.total_credit || 0) as number, creditDays: (r.credit_days || 0) as number, nextPaymentDate: (r.next_payment_date || '') as string, status: (r.status || 'Current') as Creditor['status'] })));
  }, []);

  const fetchLedger = useCallback(async () => {
    let query = supabase.from('ledger_entries').select('*').order('entry_date', { ascending: false });
    if (dateFrom) query = query.gte('entry_date', dateFrom);
    if (dateTo) query = query.lte('entry_date', dateTo);
    const { data } = await query;
    if (data) setLedgerEntries(data.map((r: Record<string, unknown>) => ({ id: r.id as string, entryDate: (r.entry_date || '') as string, description: (r.description || '') as string, account: (r.account || '') as string, debit: (r.debit || 0) as number, credit: (r.credit || 0) as number, reference: (r.reference || '') as string, category: (r.category || '') as string, createdAt: (r.created_at || '') as string })));
  }, [dateFrom, dateTo]);

  const fetchSales = useCallback(async () => {
    const { data, error } = await supabase.from('order_items').select('*, orders!inner(order_date, customer_name, status)').order('created_at', { ascending: false });
    if (!error && data && data.length > 0) {
      setSales(data.filter((r: Record<string, unknown>) => {
        const od = r.orders as Record<string, unknown> | undefined;
        const d = (od?.order_date || '') as string;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }).map((r: Record<string, unknown>) => {
        const od = r.orders as Record<string, unknown> | undefined;
        return { id: r.id as string, productName: (r.product_name || '') as string, quantity: (r.quantity || 0) as number, unitPrice: (r.unit_price || 0) as number, totalPrice: ((r.quantity as number || 0) * (r.unit_price as number || 0)), saleDate: (od?.order_date || '') as string, customerName: (od?.customer_name || '') as string };
      }));
    } else {
      const { data: sd } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      if (sd) setSales(sd.map((r: Record<string, unknown>) => ({ id: r.id as string, productName: (r.product_name || '') as string, quantity: (r.quantity || 0) as number, unitPrice: (r.unit_price || 0) as number, totalPrice: (r.total_price || 0) as number, saleDate: (r.sale_date || '') as string, customerName: (r.customer_name || '') as string })));
    }
  }, [dateFrom, dateTo]);

  const fetchPosSales = useCallback(async () => {
    let query = supabase.from('pos_sales').select('*').order('created_at', { ascending: false });
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
    const { data } = await query;
    if (data) setPosSales(data.map((r: Record<string, unknown>) => ({ id: r.id as string, receiptNumber: (r.receipt_number || '') as string, customerName: (r.customer_name || '') as string, saleType: (r.sale_type || '') as string, paymentMethod: (r.payment_method || '') as string, total: (r.total || 0) as number, createdAt: (r.created_at || '') as string })));
  }, [dateFrom, dateTo]);

  const fetchCostEntries = useCallback(async () => {
    try {
      const { data } = await supabase.from('cost_entries').select('*');
      if (data) setCostEntries(data.map((r: Record<string, unknown>) => ({ id: r.id as string, category: (r.category || '') as string, amount: (r.amount || 0) as number, costType: (r.cost_type || 'general_expense') as string })));
    } catch { setCostEntries([]); }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const { data } = await supabase.from('assets').select('id, name, purchase_price, current_value, accumulated_depreciation');
      if (data) setAssets(data.map((r: Record<string, unknown>) => ({ id: r.id as string, name: (r.name || '') as string, purchasePrice: (r.purchase_price || 0) as number, currentValue: (r.current_value || 0) as number, accumulatedDepreciation: (r.accumulated_depreciation || 0) as number })));
    } catch { setAssets([]); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchPlReports(), fetchOrders(), fetchInventory(), fetchDebtors(), fetchCreditors(), fetchLedger(), fetchSales(), fetchPosSales(), fetchCostEntries(), fetchAssets()]);
    setLoading(false);
  }, [fetchPlReports, fetchOrders, fetchInventory, fetchDebtors, fetchCreditors, fetchLedger, fetchSales, fetchPosSales, fetchCostEntries, fetchAssets]);

  // Load business settings for report headers
  useEffect(() => {
    async function loadBizInfo() {
      try {
        const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'general').single();
        if (!error && data?.value) {
          const g = data.value as Record<string, unknown>;
          setReportBizInfo(prev => ({
            ...prev,
            businessName: (g.businessName as string) || prev.businessName,
            tagline: (g.tagline as string) || prev.tagline,
            phone: (g.phone as string) || prev.phone,
            email: (g.email as string) || prev.email,
            address: (g.address as string) || prev.address,
            logoUrl: (g.logoUrl as string) || prev.logoUrl,
            reportLogoHeight: (g.reportLogoHeight as number) || prev.reportLogoHeight,
            reportWatermarkEnabled: g.reportWatermarkEnabled !== undefined ? (g.reportWatermarkEnabled as boolean) : prev.reportWatermarkEnabled,
            reportWatermarkOpacity: (g.reportWatermarkOpacity as number) || prev.reportWatermarkOpacity,
          }));
          return;
        }
      } catch { /* ignore */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.general) setReportBizInfo(prev => ({ ...prev, ...parsed.general }));
        }
      } catch { /* ignore */ }
    }
    loadBizInfo();
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setPnlPage(1); setSalesPage(1); setInventoryPage(1); setDebtorsPage(1); setCreditorsPage(1); setItemsPage(1); setLedgerPage(1); }, [activeTab]);

  // ─── Computed Totals ──────────────────────────────────────────────────────

  const totalRevenue = round2(plReports.reduce((s, r) => s + safeNum(r.revenue), 0));
  const totalCosts = round2(plReports.reduce((s, r) => s + safeNum(r.costs), 0));
  const totalProfit = round2(totalRevenue - totalCosts);
  const totalOrderRevenue = round2(orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + safeNum(o.totalAmount), 0));
  const totalDebt = round2(debtors.reduce((s, d) => s + safeNum(d.totalDebt), 0));
  const totalCredit = round2(creditors.reduce((s, c) => s + safeNum(c.totalCredit), 0));
  const inventoryValuation = round2(inventoryItems.reduce((s, i) => s + round2(safeNum(i.quantity) * safeNum(i.unitCost)), 0));
  const lowStockItems = inventoryItems.filter(i => safeNum(i.quantity) <= safeNum(i.reorderLevel));
  const totalLedgerDebit = round2(ledgerEntries.reduce((s, e) => s + safeNum(e.debit), 0));
  const totalLedgerCredit = round2(ledgerEntries.reduce((s, e) => s + safeNum(e.credit), 0));
  const totalSalesRevenue = round2(sales.reduce((s, r) => s + safeNum(r.totalPrice), 0));
  const totalSalesQty = sales.reduce((s, r) => s + safeNum(r.quantity), 0);
  const totalPosRevenue = round2(posSales.reduce((s, r) => s + safeNum(r.total), 0));

  // Top products
  const productRevenueMap: Record<string, { qty: number; revenue: number; count: number }> = {};
  sales.forEach(s => { if (!productRevenueMap[s.productName]) productRevenueMap[s.productName] = { qty: 0, revenue: 0, count: 0 }; productRevenueMap[s.productName].qty += s.quantity; productRevenueMap[s.productName].revenue += s.totalPrice; productRevenueMap[s.productName].count += 1; });
  const topProducts = Object.entries(productRevenueMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue);

  // Debtor aging
  const debtorsCurrent = debtors.filter(d => d.debtDays <= 30);
  const debtors3160 = debtors.filter(d => d.debtDays > 30 && d.debtDays <= 60);
  const debtors6190 = debtors.filter(d => d.debtDays > 60 && d.debtDays <= 90);
  const debtors90Plus = debtors.filter(d => d.debtDays > 90);

  // ─── Chart Data ─────────────────────────────────────────────────────────

  // Daily POS sales trend
  const posDailyMap: Record<string, { date: string; revenue: number; count: number }> = {};
  posSales.forEach(s => {
    const d = s.createdAt.split('T')[0];
    if (!posDailyMap[d]) posDailyMap[d] = { date: d, revenue: 0, count: 0 };
    posDailyMap[d].revenue += s.total;
    posDailyMap[d].count += 1;
  });
  const dailyPosData = Object.values(posDailyMap).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, dateLabel: formatDate(d.date) }));

  // Daily order sales trend
  const orderDailyMap: Record<string, { date: string; revenue: number; count: number }> = {};
  orders.forEach(o => {
    const d = o.orderDate || 'Unknown';
    if (!orderDailyMap[d]) orderDailyMap[d] = { date: d, revenue: 0, count: 0 };
    orderDailyMap[d].revenue += o.totalAmount;
    orderDailyMap[d].count += 1;
  });
  const dailyOrderData = Object.values(orderDailyMap).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, dateLabel: formatDate(d.date) }));

  // Payment method breakdown for POS
  const paymentBreakdown: Record<string, number> = {};
  posSales.forEach(s => { paymentBreakdown[s.paymentMethod] = (paymentBreakdown[s.paymentMethod] || 0) + s.total; });
  const paymentPieData = Object.entries(paymentBreakdown).map(([name, value]) => ({ name, value }));

  // Order status breakdown
  const orderStatusMap: Record<string, number> = {};
  orders.forEach(o => { orderStatusMap[o.status] = (orderStatusMap[o.status] || 0) + 1; });
  const orderStatusData = Object.entries(orderStatusMap).map(([name, value]) => ({ name, value }));

  // P&L trend
  const pnlChartData = [...plReports].reverse().map(r => ({ period: r.period, Revenue: r.revenue, Costs: r.costs, Profit: r.profit }));

  // Inventory category distribution
  const invCategoryMap: Record<string, { count: number; value: number }> = {};
  inventoryItems.forEach(i => { const c = i.category || 'Other'; if (!invCategoryMap[c]) invCategoryMap[c] = { count: 0, value: 0 }; invCategoryMap[c].count += 1; invCategoryMap[c].value += i.quantity * i.unitCost; });
  const invCategoryData = Object.entries(invCategoryMap).map(([name, d]) => ({ name, value: d.value, count: d.count }));

  // ─── CRUD Handlers ──────────────────────────────────────────────────────

  const handlePnlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rev = round2(safeNum(pnlFormData.revenue));
    const cos = round2(safeNum(pnlFormData.costs));
    const profit = round2(rev - cos);
    const margin = round2(safeDiv(profit, rev, 0) * 100);
    const row = { period: pnlFormData.period, revenue: rev, costs: cos, profit, margin };
    try { if (pnlEditingId) { await supabase.from('pl_reports').update(row).eq('id', pnlEditingId); logAudit({ action: 'UPDATE', module: 'Reports', record_id: pnlEditingId, details: { table: 'pl_reports', period: pnlFormData.period, revenue: rev, costs: cos } }); } else { await supabase.from('pl_reports').insert(row); logAudit({ action: 'CREATE', module: 'Reports', record_id: pnlFormData.period, details: { table: 'pl_reports', period: pnlFormData.period, revenue: rev, costs: cos } }); } await fetchPlReports(); } catch { /* ignore */ }
    setPnlEditingId(null); setPnlFormData({ period: '', revenue: 0, costs: 0 }); setShowPnlForm(false);
  };
  const handlePnlEdit = (r: PlReport) => { setPnlFormData({ period: r.period, revenue: r.revenue, costs: r.costs }); setPnlEditingId(r.id); setShowPnlForm(true); };
  const handlePnlDelete = async (id: string) => { if (confirm('Delete this P&L report?')) { await supabase.from('pl_reports').delete().eq('id', id); logAudit({ action: 'DELETE', module: 'Reports', record_id: id, details: { table: 'pl_reports' } }); setPlReports(plReports.filter(r => r.id !== id)); } };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const debitVal = round2(safeNum(ledgerFormData.debit));
    const creditVal = round2(safeNum(ledgerFormData.credit));
    if (debitVal === 0 && creditVal === 0) {
      alert('At least one of Debit or Credit must be greater than zero.');
      return;
    }
    const row = { entry_date: ledgerFormData.entryDate, description: ledgerFormData.description, account: ledgerFormData.account, debit: debitVal, credit: creditVal, reference: ledgerFormData.reference, category: ledgerFormData.category };
    try { if (ledgerEditingId) { await supabase.from('ledger_entries').update(row).eq('id', ledgerEditingId); logAudit({ action: 'UPDATE', module: 'Reports', record_id: ledgerEditingId, details: { table: 'ledger_entries', description: ledgerFormData.description, account: ledgerFormData.account } }); } else { await supabase.from('ledger_entries').insert(row); logAudit({ action: 'CREATE', module: 'Reports', record_id: ledgerFormData.description, details: { table: 'ledger_entries', description: ledgerFormData.description, account: ledgerFormData.account } }); } await fetchLedger(); } catch { /* ignore */ }
    setLedgerEditingId(null); setLedgerFormData({ entryDate: new Date().toISOString().split('T')[0], description: '', account: '', debit: 0, credit: 0, reference: '', category: 'General' }); setShowLedgerForm(false);
  };
  const handleLedgerEdit = (e: LedgerEntry) => { setLedgerFormData({ entryDate: e.entryDate, description: e.description, account: e.account, debit: e.debit, credit: e.credit, reference: e.reference, category: e.category }); setLedgerEditingId(e.id); setShowLedgerForm(true); };
  const handleLedgerDelete = async (id: string) => { if (confirm('Delete this ledger entry?')) { await supabase.from('ledger_entries').delete().eq('id', id); logAudit({ action: 'DELETE', module: 'Reports', record_id: id, details: { table: 'ledger_entries' } }); setLedgerEntries(ledgerEntries.filter(e => e.id !== id)); } };

  const showDetailModal = (title: string, content: { label: string; value: string }[]) => { setDetailTitle(title); setDetailContent(content); setShowDetail(true); };

  // ─── Pagination Helper ──────────────────────────────────────────────────

  function paginate<T>(items: T[], page: number): { data: T[]; totalPages: number } {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    return { data: items.slice(start, start + PAGE_SIZE), totalPages };
  }

  // ─── Tab Renderers ────────────────────────────────────────────────────────

  // M-Pesa vs Cash breakdown
  const posCashSales = round2(posSales.filter(s => s.paymentMethod === 'Cash').reduce((sum, s) => sum + safeNum(s.total), 0));
  const posMpesaSales = round2(posSales.filter(s => s.paymentMethod === 'Mpesa' || s.paymentMethod === 'M-Pesa').reduce((sum, s) => sum + safeNum(s.total), 0));
  const posCardSales = round2(posSales.filter(s => s.paymentMethod === 'Card').reduce((sum, s) => sum + safeNum(s.total), 0));
  const posCreditSales = round2(posSales.filter(s => s.paymentMethod === 'Credit').reduce((sum, s) => sum + safeNum(s.total), 0));
  const posCashCount = posSales.filter(s => s.paymentMethod === 'Cash').length;
  const posMpesaCount = posSales.filter(s => s.paymentMethod === 'Mpesa' || s.paymentMethod === 'M-Pesa').length;

  const renderOverview = () => {
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid').length;
    const unpaidOrders = orders.filter(o => o.paymentStatus === 'Unpaid').length;

    return (
      <div className="space-y-6">
        {/* Sales by Payment Method - KEY SEPARATION */}
        <div className="border-2 border-primary/20 rounded-xl p-4 md:p-5 bg-primary/5">
          <h3 className="text-sm md:text-base font-bold mb-3">Sales by Payment Method</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
            <div className="p-3 bg-white/80 rounded-lg text-center border border-border">
              <p className="text-[10px] md:text-xs text-muted-foreground font-medium">Total POS Sales</p>
              <p className="text-sm md:text-xl font-bold text-foreground">{formatKES(totalPosRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{posSales.length} transactions</p>
            </div>
            <div className="p-3 bg-white/80 rounded-lg text-center border border-green-200">
              <p className="text-[10px] md:text-xs text-green-700 font-medium">Cash Sales</p>
              <p className="text-sm md:text-xl font-bold text-green-700">{formatKES(posCashSales)}</p>
              <p className="text-[10px] text-muted-foreground">{posCashCount} txns &bull; {safeDiv(posCashSales, totalPosRevenue, 0) > 0 ? (safeDiv(posCashSales, totalPosRevenue) * 100).toFixed(1) : '0.0'}%</p>
            </div>
            <div className="p-3 bg-white/80 rounded-lg text-center border border-blue-200">
              <p className="text-[10px] md:text-xs text-blue-700 font-medium">M-Pesa Sales</p>
              <p className="text-sm md:text-xl font-bold text-blue-700">{formatKES(posMpesaSales)}</p>
              <p className="text-[10px] text-blue-600">{posMpesaCount} txns &bull; {(safeDiv(posMpesaSales, totalPosRevenue) * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-white/80 rounded-lg text-center border border-purple-200">
              <p className="text-[10px] md:text-xs text-purple-700 font-medium">Card Sales</p>
              <p className="text-sm md:text-xl font-bold text-purple-700">{formatKES(posCardSales)}</p>
              <p className="text-[10px] text-purple-600">{(safeDiv(posCardSales, totalPosRevenue) * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-white/80 rounded-lg text-center border border-amber-200">
              <p className="text-[10px] md:text-xs text-amber-700 font-medium">Credit Sales</p>
              <p className="text-sm md:text-xl font-bold text-amber-700">{formatKES(posCreditSales)}</p>
              <p className="text-[10px] text-amber-600">{(safeDiv(posCreditSales, totalPosRevenue) * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <SummaryCard title="Total Revenue (P&L)" value={formatKES(totalRevenue)} subtitle="From P&L reports" color="green" />
          <SummaryCard title="POS Revenue" value={formatKES(totalPosRevenue)} subtitle={`${posSales.length} POS transactions`} color="green" />
          <SummaryCard title="Net Profit" value={formatKES(totalProfit)} subtitle={totalRevenue > 0 ? `Margin: ${(safeDiv(totalProfit, totalRevenue) * 100).toFixed(1)}%` : 'No data'} color={totalProfit >= 0 ? 'green' : 'red'} />
          <SummaryCard title="Outstanding Debts" value={formatKES(totalDebt)} subtitle={`${debtors.length} debtors`} color="amber" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <SummaryCard title="Order Revenue" value={formatKES(totalOrderRevenue)} subtitle={`${orders.length} orders`} color="blue" />
          <SummaryCard title="Outstanding Credits" value={formatKES(totalCredit)} subtitle={`${creditors.filter(c => c.status !== 'Paid').length} creditors`} color="red" />
          <SummaryCard title="Inventory Value" value={formatKES(inventoryValuation)} subtitle={`${inventoryItems.length} items | ${lowStockItems.length} low stock`} color="purple" />
          <SummaryCard title="Sales Volume" value={formatKES(totalSalesRevenue)} subtitle={`${totalSalesQty} units sold`} color="green" />
        </div>

        {/* Sales Trend Chart */}
        {dailyPosData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Daily POS Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyPosData}>
                <defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Method Pie */}
          {paymentPieData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">POS Payment Methods</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentPieData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Order Status */}
          {orderStatusData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Order Status Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={orderStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Debtor Aging */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Debtor Aging Summary</h3>
            <div className="space-y-3">
              {[{ label: '0-30 days', data: debtorsCurrent, color: 'text-emerald-600 bg-emerald-500' }, { label: '31-60 days', data: debtors3160, color: 'text-amber-600 bg-amber-500' }, { label: '61-90 days', data: debtors6190, color: 'text-orange-600 bg-orange-500' }, { label: '90+ days', data: debtors90Plus, color: 'text-red-600 bg-red-500' }].map(b => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className={`font-semibold ${b.color.split(' ')[0]}`}>{b.data.length} ({formatKES(b.data.reduce((s, d) => s + d.totalDebt, 0))})</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className={`h-2 rounded-full ${b.color.split(' ')[1]}`} style={{ width: `${totalDebt > 0 ? (b.data.reduce((s, d) => s + d.totalDebt, 0) / totalDebt) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Payment Status */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Order Payment Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Paid Orders</span><span className="font-semibold text-emerald-600">{paidOrders}</span></div>
              <div className="w-full bg-secondary rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${orders.length > 0 ? (paidOrders / orders.length) * 100 : 0}%` }} /></div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Unpaid Orders</span><span className="font-semibold text-red-600">{unpaidOrders}</span></div>
              <div className="w-full bg-secondary rounded-full h-2"><div className="bg-red-500 h-2 rounded-full" style={{ width: `${orders.length > 0 ? (unpaidOrders / orders.length) * 100 : 0}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPnl = () => {
    const { data: pnlData, totalPages: pnlTotalPages } = paginate(plReports, pnlPage);
    const avgMargin = totalRevenue > 0 ? (safeDiv(totalProfit, totalRevenue) * 100).toFixed(1) : '0.0';
    const csvHeaders = ['Period', 'Revenue (KES)', 'Costs (KES)', 'Profit (KES)', 'Margin (%)'];
    const csvRows = plReports.map(r => [r.period, r.revenue.toFixed(2), r.costs.toFixed(2), r.profit.toFixed(2), r.margin.toFixed(1)]);

    // P&L Breakdown - compute from cost entries and sales data
    // Formula: Total Sales - Direct Costs = Gross Profit
    //          Gross Profit - (Indirect Costs + General Expenses) = Net Profit

    // Direct costs: raw materials, production costs, labor, packaging
    const rawMaterialsCost = round2(costEntries.filter(c => c.costType === 'raw_materials' || c.category?.toLowerCase().includes('raw') || c.category?.toLowerCase().includes('ingredient')).reduce((s, c) => s + safeNum(c.amount), 0));
    const productionCosts = round2(costEntries.filter(c => c.costType === 'direct_cost' || c.category?.toLowerCase().includes('production') || c.category?.toLowerCase().includes('labor') || c.category?.toLowerCase().includes('packaging')).reduce((s, c) => s + safeNum(c.amount), 0));
    const displayDirectCosts = round2(rawMaterialsCost + productionCosts);

    // Gross Profit = Total Sales - Direct Costs
    const displayGrossProfit = round2(totalRevenue - displayDirectCosts);

    // Indirect costs: utilities, rent, maintenance
    const indirectCosts = round2(costEntries.filter(c => c.costType === 'indirect_cost' || c.category?.toLowerCase().includes('utility') || c.category?.toLowerCase().includes('rent') || c.category?.toLowerCase().includes('maintenance')).reduce((s, c) => s + safeNum(c.amount), 0));

    // General expenses: everything else that isn't direct or indirect
    const generalExpenses = round2(costEntries.filter(c => {
      const ct = c.costType || '';
      const cat = (c.category || '').toLowerCase();
      return !['raw_materials', 'direct_cost', 'indirect_cost'].includes(ct) &&
        !cat.includes('raw') && !cat.includes('ingredient') &&
        !cat.includes('production') && !cat.includes('labor') &&
        !cat.includes('packaging') && !cat.includes('utility') &&
        !cat.includes('rent') && !cat.includes('maintenance');
    }).reduce((s, c) => s + safeNum(c.amount), 0));

    const displayGeneralExpenses = round2(indirectCosts + generalExpenses);

    // Net Profit = Gross Profit - (Indirect Costs + General Expenses)
    const displayNetProfit = round2(displayGrossProfit - displayGeneralExpenses);

    return (
      <div className="space-y-6">
        {/* Financial Summary Cards - Arranged in P&L Order */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-card border-2 border-emerald-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-emerald-600">{formatKES(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Sales + POS income</p>
          </div>
          <div className="bg-card border-2 border-red-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Direct Costs</p>
            <p className="text-2xl font-bold text-red-600">{formatKES(displayDirectCosts)}</p>
            <p className="text-xs text-muted-foreground mt-1">Raw materials + production</p>
          </div>
          <div className="bg-card border-2 border-blue-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Gross Profit</p>
            <p className={`text-2xl font-bold ${displayGrossProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatKES(displayGrossProfit)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalRevenue > 0 ? `Margin: ${(safeDiv(displayGrossProfit, totalRevenue) * 100).toFixed(1)}%` : '-'}</p>
          </div>
          <div className="bg-card border-2 border-purple-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Indirect + Expenses</p>
            <p className="text-2xl font-bold text-purple-600">{formatKES(displayGeneralExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">Overhead & admin</p>
          </div>
          <div className={`bg-card border-2 rounded-xl p-5 shadow-sm ${displayNetProfit >= 0 ? 'border-emerald-300' : 'border-red-300'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1 text-muted-foreground">Net Profit</p>
            <p className={`text-2xl font-bold ${displayNetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(displayNetProfit)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalRevenue > 0 ? `Net margin: ${(safeDiv(displayNetProfit, totalRevenue) * 100).toFixed(1)}%` : '-'}</p>
          </div>
        </div>

        {/* Net Profit Card - Full Width */}
        <div className={`border-2 rounded-xl p-6 shadow-sm ${displayNetProfit >= 0 ? 'border-emerald-300 bg-emerald-50/50' : 'border-red-300 bg-red-50/50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Net Profit / (Loss)</p>
              <p className={`text-3xl font-bold ${displayNetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(displayNetProfit)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Net Margin</p>
              <p className={`text-2xl font-bold ${displayNetProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{totalRevenue > 0 ? `${(safeDiv(displayNetProfit, totalRevenue) * 100).toFixed(1)}%` : '0.0%'}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
            <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">Total Sales</p><p className="font-bold text-emerald-600">{formatKES(totalRevenue)}</p></div>
            <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">- Direct Costs</p><p className="font-bold text-red-600">{formatKES(displayDirectCosts)}</p></div>
            <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">= Gross Profit</p><p className="font-bold text-blue-600">{formatKES(displayGrossProfit)}</p></div>
            <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">- (Indirect + Expenses)</p><p className="font-bold text-purple-600">{formatKES(displayGeneralExpenses)}</p></div>
            <div className="text-center p-2 bg-white/60 rounded-lg"><p className="text-muted-foreground">= Net Profit</p><p className={`font-bold ${displayNetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(displayNetProfit)}</p></div>
          </div>
        </div>

        {/* P&L Trend Chart */}
        {pnlChartData.length > 1 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Revenue vs Costs Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pnlChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Costs" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Profit" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{plReports.length} P&L report{plReports.length !== 1 ? 's' : ''}</p>
          <div className="flex gap-3">
            <ExportButtons onCSV={() => { exportCSV('pnl_reports', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'pnl_reports', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Profit & Loss Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'pnl_reports', details: { format: 'PDF', rows: csvRows.length } }); }} />
            <button onClick={() => { setPnlEditingId(null); setPnlFormData({ period: '', revenue: 0, costs: 0 }); setShowPnlForm(true); }} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">+ Add Period</button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Period</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Revenue</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Costs</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Profit</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Margin</th><th className="px-5 py-3 text-center font-semibold text-muted-foreground">Actions</th></tr></thead>
              <tbody>
                {pnlData.length === 0 && !loading ? (<tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No P&L reports. Click &quot;+ Add Period&quot; to create one.</td></tr>) : pnlData.map(r => (
                  <tr key={r.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{r.period}</td>
                    <td className="px-5 py-3 text-right text-emerald-600 font-semibold">{formatKES(r.revenue)}</td>
                    <td className="px-5 py-3 text-right text-red-600 font-semibold">{formatKES(r.costs)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${r.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(r.profit)}</td>
                    <td className="px-5 py-3 text-right font-semibold">{r.margin.toFixed(1)}%</td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-center"><button onClick={() => handlePnlEdit(r)} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 font-medium">Edit</button><button onClick={() => handlePnlDelete(r.id)} className="px-3 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 font-medium">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
              {plReports.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3">TOTAL</td><td className="px-5 py-3 text-right text-emerald-600">{formatKES(totalRevenue)}</td><td className="px-5 py-3 text-right text-red-600">{formatKES(totalCosts)}</td><td className={`px-5 py-3 text-right ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatKES(totalProfit)}</td><td className="px-5 py-3 text-right">{avgMargin}%</td><td></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={pnlPage} totalPages={pnlTotalPages} totalItems={plReports.length} onPageChange={setPnlPage} />
        </div>
      </div>
    );
  };

  const renderSales = () => {
    const { data: salesData, totalPages: salesTotalPages } = paginate(sales, salesPage);
    const uniqueCustomers = new Set(sales.map(s => s.customerName).filter(Boolean)).size;
    const csvHeaders = ['Date', 'Product', 'Customer', 'Qty', 'Unit Price', 'Total'];
    const csvRows = sales.map(s => [s.saleDate, s.productName, s.customerName, String(s.quantity), s.unitPrice.toFixed(2), s.totalPrice.toFixed(2)]);

    // Daily sales aggregation for chart
    const dailySales: Record<string, { date: string; total: number; count: number }> = {};
    sales.forEach(s => { const d = s.saleDate || 'Unknown'; if (!dailySales[d]) dailySales[d] = { date: d, total: 0, count: 0 }; dailySales[d].total += s.totalPrice; dailySales[d].count += s.quantity; });
    const dailySalesArr = Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, dateLabel: formatDate(d.date) }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Sales Revenue" value={formatKES(totalSalesRevenue)} color="green" />
          <SummaryCard title="Units Sold" value={totalSalesQty.toLocaleString()} color="blue" />
          <SummaryCard title="Unique Products" value={String(topProducts.length)} color="purple" />
          <SummaryCard title="Unique Customers" value={String(uniqueCustomers)} color="amber" />
        </div>

        {/* Sales Trend Chart */}
        {dailySalesArr.length > 1 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Sales Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySalesArr}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Products Chart */}
        {topProducts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Top Products by Revenue</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, topProducts.slice(0, 8).length * 40)}>
              <BarChart data={topProducts.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sales Detail Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-lg font-semibold">Sales Transactions</h3>
            <ExportButtons onCSV={() => { exportCSV('sales_report', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'sales_report', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Sales Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'sales_report', details: { format: 'PDF', rows: csvRows.length } }); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Date</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Product</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Customer</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Qty</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Unit Price</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Total</th></tr></thead>
              <tbody>
                {salesData.length === 0 ? (<tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No sales data in selected period</td></tr>) : salesData.map(s => (
                  <tr key={s.id} className="border-b border-border hover:bg-secondary/30 transition-colors"><td className="px-5 py-3">{formatDate(s.saleDate)}</td><td className="px-5 py-3 font-medium">{s.productName}</td><td className="px-5 py-3">{s.customerName || '-'}</td><td className="px-5 py-3 text-right">{s.quantity}</td><td className="px-5 py-3 text-right">{formatKES(s.unitPrice)}</td><td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatKES(s.totalPrice)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={salesPage} totalPages={salesTotalPages} totalItems={sales.length} onPageChange={setSalesPage} />
        </div>
      </div>
    );
  };

  const renderInventory = () => {
    const { data: invData, totalPages: invTotalPages } = paginate(inventoryItems, inventoryPage);
    const consumables = inventoryItems.filter(i => i.type === 'Consumable');
    const nonConsumables = inventoryItems.filter(i => i.type === 'Non-Consumable');
    const csvHeaders = ['Name', 'Category', 'Type', 'Qty', 'Unit', 'Unit Cost', 'Valuation', 'Reorder Level', 'Supplier'];
    const csvRows = inventoryItems.map(i => [i.name, i.category, i.type, String(i.quantity), i.unit, i.unitCost.toFixed(2), (i.quantity * i.unitCost).toFixed(2), String(i.reorderLevel), i.supplier]);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Valuation" value={formatKES(inventoryValuation)} subtitle={`${inventoryItems.length} items`} color="blue" />
          <SummaryCard title="Consumables" value={formatKES(consumables.reduce((s, i) => s + i.quantity * i.unitCost, 0))} subtitle={`${consumables.length} items`} color="green" />
          <SummaryCard title="Non-Consumables" value={formatKES(nonConsumables.reduce((s, i) => s + i.quantity * i.unitCost, 0))} subtitle={`${nonConsumables.length} items`} color="purple" />
          <SummaryCard title="Low Stock Alerts" value={String(lowStockItems.length)} subtitle={lowStockItems.length > 0 ? 'Below reorder level' : 'All OK'} color={lowStockItems.length > 0 ? 'red' : 'green'} />
        </div>

        {/* Inventory Category Chart */}
        {invCategoryData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Inventory Value by Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={invCategoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {invCategoryData.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-red-800 mb-3">Low Stock Alerts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                  <div><p className="text-sm font-medium text-red-900">{item.name}</p><p className="text-xs text-red-600">Reorder: {item.reorderLevel} {item.unit}</p></div>
                  <div className="text-right"><p className="text-sm font-bold text-red-700">{item.quantity} {item.unit}</p><p className="text-xs text-red-500">in stock</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-lg font-semibold">Inventory Valuation Report</h3>
            <ExportButtons onCSV={() => { exportCSV('inventory_report', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'inventory_report', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Inventory Valuation Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'inventory_report', details: { format: 'PDF', rows: csvRows.length } }); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Item</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Category</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Type</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Qty</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Unit Cost</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Valuation</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th></tr></thead>
              <tbody>
                {invData.length === 0 ? (<tr><td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">No inventory items</td></tr>) : invData.map(item => {
                  const isLow = item.quantity <= item.reorderLevel;
                  return (<tr key={item.id} className={`border-b border-border hover:bg-secondary/30 transition-colors ${isLow ? 'bg-red-50/50' : ''}`}><td className="px-5 py-3 font-medium">{item.name}</td><td className="px-5 py-3">{item.category || '-'}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${item.type === 'Consumable' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{item.type}</span></td><td className="px-5 py-3 text-right font-semibold">{item.quantity} {item.unit}</td><td className="px-5 py-3 text-right">{formatKES(item.unitCost)}</td><td className="px-5 py-3 text-right font-semibold">{formatKES(item.quantity * item.unitCost)}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{isLow ? 'Low Stock' : 'OK'}</span></td></tr>);
                })}
              </tbody>
              {inventoryItems.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3" colSpan={5}>TOTAL VALUATION</td><td className="px-5 py-3 text-right">{formatKES(inventoryValuation)}</td><td></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={inventoryPage} totalPages={invTotalPages} totalItems={inventoryItems.length} onPageChange={setInventoryPage} />
        </div>
      </div>
    );
  };

  const renderDebtors = () => {
    const { data: debtorsData, totalPages: debtorsTotalPages } = paginate(debtors, debtorsPage);
    const csvHeaders = ['Name', 'Total Debt (KES)', 'Days Outstanding', 'Last Payment', 'Status'];
    const csvRows = debtors.map(d => [d.name, d.totalDebt.toFixed(2), String(d.debtDays), d.lastPayment, d.status]);
    const agingData = [{ name: '0-30d', value: debtorsCurrent.reduce((s, d) => s + d.totalDebt, 0) }, { name: '31-60d', value: debtors3160.reduce((s, d) => s + d.totalDebt, 0) }, { name: '61-90d', value: debtors6190.reduce((s, d) => s + d.totalDebt, 0) }, { name: '90d+', value: debtors90Plus.reduce((s, d) => s + d.totalDebt, 0) }].filter(d => d.value > 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Outstanding" value={formatKES(totalDebt)} subtitle={`${debtors.length} debtors`} color="amber" />
          <SummaryCard title="Overdue" value={formatKES(debtors.filter(d => d.status === 'Overdue' || d.status === 'Defaulted').reduce((s, d) => s + d.totalDebt, 0))} color="red" />
          <SummaryCard title="Current (0-30d)" value={formatKES(debtorsCurrent.reduce((s, d) => s + d.totalDebt, 0))} color="green" />
          <SummaryCard title="90+ Days" value={formatKES(debtors90Plus.reduce((s, d) => s + d.totalDebt, 0))} color="red" />
        </div>

        {agingData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Debt Aging Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `KES ${value.toLocaleString()}`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Amount">
                  {agingData.map((_, idx) => <Cell key={idx} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444'][idx]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-lg font-semibold">Debtor Accounts</h3>
            <ExportButtons onCSV={() => { exportCSV('debtors_report', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'debtors_report', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Debtors Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'debtors_report', details: { format: 'PDF', rows: csvRows.length } }); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Debtor</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Amount Owed</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Days</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Last Payment</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th></tr></thead>
              <tbody>
                {debtorsData.length === 0 ? (<tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No debtor records</td></tr>) : debtorsData.map(d => {
                  const sc = d.status === 'Current' ? 'bg-emerald-50 text-emerald-700' : d.status === 'Overdue' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
                  return (<tr key={d.id} className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => showDetailModal(`Debtor: ${d.name}`, [{ label: 'Name', value: d.name }, { label: 'Total Debt', value: formatKES(d.totalDebt) }, { label: 'Days Outstanding', value: String(d.debtDays) }, { label: 'Last Payment', value: formatDate(d.lastPayment) }, { label: 'Status', value: d.status }])}><td className="px-5 py-3 font-medium">{d.name}</td><td className="px-5 py-3 text-right font-semibold text-amber-600">{formatKES(d.totalDebt)}</td><td className="px-5 py-3 text-right">{d.debtDays}</td><td className="px-5 py-3">{formatDate(d.lastPayment)}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc}`}>{d.status}</span></td></tr>);
                })}
              </tbody>
              {debtors.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3">TOTAL</td><td className="px-5 py-3 text-right text-amber-600">{formatKES(totalDebt)}</td><td colSpan={3}></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={debtorsPage} totalPages={debtorsTotalPages} totalItems={debtors.length} onPageChange={setDebtorsPage} />
        </div>
      </div>
    );
  };

  const renderCreditors = () => {
    const { data: creditorsData, totalPages: creditorsTotalPages } = paginate(creditors, creditorsPage);
    const csvHeaders = ['Supplier', 'Total Credit (KES)', 'Credit Days', 'Next Payment', 'Status'];
    const csvRows = creditors.map(c => [c.supplierName, c.totalCredit.toFixed(2), String(c.creditDays), c.nextPaymentDate, c.status]);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Owed" value={formatKES(totalCredit)} subtitle={`${creditors.length} creditors`} color="red" />
          <SummaryCard title="Active/Current" value={formatKES(creditors.filter(c => c.status === 'Current').reduce((s, c) => s + c.totalCredit, 0))} color="blue" />
          <SummaryCard title="Overdue" value={formatKES(creditors.filter(c => c.status === 'Overdue').reduce((s, c) => s + c.totalCredit, 0))} color="red" />
          <SummaryCard title="Paid" value={formatKES(creditors.filter(c => c.status === 'Paid').reduce((s, c) => s + c.totalCredit, 0))} color="green" />
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-lg font-semibold">Creditor Accounts</h3>
            <ExportButtons onCSV={() => { exportCSV('creditors_report', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'creditors_report', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Creditors Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'creditors_report', details: { format: 'PDF', rows: csvRows.length } }); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Supplier</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Amount</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Credit Days</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Next Payment</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th></tr></thead>
              <tbody>
                {creditorsData.length === 0 ? (<tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No creditor records</td></tr>) : creditorsData.map(c => {
                  const sc = c.status === 'Current' ? 'bg-blue-50 text-blue-700' : c.status === 'Overdue' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700';
                  return (<tr key={c.id} className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => showDetailModal(`Creditor: ${c.supplierName}`, [{ label: 'Supplier', value: c.supplierName }, { label: 'Total Credit', value: formatKES(c.totalCredit) }, { label: 'Credit Days', value: String(c.creditDays) }, { label: 'Next Payment', value: formatDate(c.nextPaymentDate) }, { label: 'Status', value: c.status }])}><td className="px-5 py-3 font-medium">{c.supplierName}</td><td className="px-5 py-3 text-right font-semibold text-red-600">{formatKES(c.totalCredit)}</td><td className="px-5 py-3 text-right">{c.creditDays}</td><td className="px-5 py-3">{formatDate(c.nextPaymentDate)}</td><td className="px-5 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sc}`}>{c.status}</span></td></tr>);
                })}
              </tbody>
              {creditors.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3">TOTAL</td><td className="px-5 py-3 text-right text-red-600">{formatKES(totalCredit)}</td><td colSpan={3}></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={creditorsPage} totalPages={creditorsTotalPages} totalItems={creditors.length} onPageChange={setCreditorsPage} />
        </div>
      </div>
    );
  };

  const renderItems = () => {
    const { data: itemsData, totalPages: itemsTotalPages } = paginate(topProducts, itemsPage);
    const csvHeaders = ['Product', 'Qty Sold', 'Revenue (KES)', 'Transactions'];
    const csvRows = topProducts.map(p => [p.name, String(p.qty), p.revenue.toFixed(2), String(p.count)]);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Items Sold" value={String(topProducts.length)} subtitle="Unique products" color="blue" />
          <SummaryCard title="Total Item Revenue" value={formatKES(totalSalesRevenue)} color="green" />
          <SummaryCard title="Avg Revenue/Product" value={formatKES(safeDiv(totalSalesRevenue, topProducts.length, 0))} color="purple" />
          <SummaryCard title="Total Units Sold" value={totalSalesQty.toLocaleString()} color="amber" />
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-lg font-semibold">Item-Level Performance</h3>
            <ExportButtons onCSV={() => { exportCSV('items_report', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'items_report', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Item Performance Report', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'items_report', details: { format: 'PDF', rows: csvRows.length } }); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">#</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Product</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Qty Sold</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Revenue</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Avg Price</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">% of Total</th></tr></thead>
              <tbody>
                {itemsData.length === 0 ? (<tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No item data</td></tr>) : itemsData.map((p, idx) => {
                  const rank = (itemsPage - 1) * PAGE_SIZE + idx + 1;
                  const avgPrice = safeDiv(p.revenue, p.qty, 0);
                  const revPct = totalSalesRevenue > 0 ? (safeDiv(p.revenue, totalSalesRevenue) * 100).toFixed(1) : '0.0';
                  return (<tr key={p.name} className="border-b border-border hover:bg-secondary/30 transition-colors"><td className="px-5 py-3 text-muted-foreground">{rank}</td><td className="px-5 py-3 font-medium">{p.name}</td><td className="px-5 py-3 text-right">{p.qty.toLocaleString()}</td><td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatKES(p.revenue)}</td><td className="px-5 py-3 text-right">{formatKES(avgPrice)}</td><td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-2"><span>{revPct}%</span><div className="w-16 bg-secondary rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${parseFloat(revPct)}%` }} /></div></div></td></tr>);
                })}
              </tbody>
              {topProducts.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3" colSpan={2}>TOTAL</td><td className="px-5 py-3 text-right">{totalSalesQty.toLocaleString()}</td><td className="px-5 py-3 text-right text-emerald-600">{formatKES(totalSalesRevenue)}</td><td colSpan={2}></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={itemsPage} totalPages={itemsTotalPages} totalItems={topProducts.length} onPageChange={setItemsPage} />
        </div>
      </div>
    );
  };

  const renderLedger = () => {
    const { data: ledgerData, totalPages: ledgerTotalPages } = paginate(ledgerEntries, ledgerPage);
    const balance = round2(totalLedgerDebit - totalLedgerCredit);
    const isBalanced = Math.abs(balance) < 0.01;
    const csvHeaders = ['Date', 'Account', 'Description', 'Category', 'Debit', 'Credit', 'Running Balance', 'Reference'];

    // Compute running balance for all entries (oldest to newest, then reverse for display)
    const entriesOldestFirst = [...ledgerEntries].reverse();
    const runningBalances = new Map<string, number>();
    let runBal = 0;
    entriesOldestFirst.forEach(e => {
      runBal = round2(runBal + safeNum(e.debit) - safeNum(e.credit));
      runningBalances.set(e.id, runBal);
    });

    const csvRows = ledgerEntries.map(e => [e.entryDate, e.account, e.description, e.category, e.debit.toFixed(2), e.credit.toFixed(2), (runningBalances.get(e.id) || 0).toFixed(2), e.reference]);

    const categoryTotals: Record<string, { debit: number; credit: number }> = {};
    ledgerEntries.forEach(e => { const cat = e.category || 'Uncategorized'; if (!categoryTotals[cat]) categoryTotals[cat] = { debit: 0, credit: 0 }; categoryTotals[cat].debit = round2(categoryTotals[cat].debit + safeNum(e.debit)); categoryTotals[cat].credit = round2(categoryTotals[cat].credit + safeNum(e.credit)); });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Debits" value={formatKES(totalLedgerDebit)} subtitle={`${ledgerEntries.length} entries`} color="blue" />
          <SummaryCard title="Total Credits" value={formatKES(totalLedgerCredit)} color="purple" />
          <SummaryCard title="Balance" value={formatKES(Math.abs(balance))} subtitle={isBalanced ? 'Books balanced' : balance > 0 ? 'Net debit' : 'Net credit'} color={isBalanced ? 'green' : 'amber'} />
          <SummaryCard title="Categories" value={String(Object.keys(categoryTotals).length)} />
        </div>

        {Object.keys(categoryTotals).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Category Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border"><th className="py-2 text-left font-semibold text-muted-foreground">Category</th><th className="py-2 text-right font-semibold text-muted-foreground">Debit</th><th className="py-2 text-right font-semibold text-muted-foreground">Credit</th><th className="py-2 text-right font-semibold text-muted-foreground">Net</th></tr></thead>
                <tbody>
                  {Object.entries(categoryTotals).sort((a, b) => (b[1].debit + b[1].credit) - (a[1].debit + a[1].credit)).map(([cat, totals]) => (
                    <tr key={cat} className="border-b border-border"><td className="py-2 font-medium">{cat}</td><td className="py-2 text-right text-blue-600 font-semibold">{formatKES(totals.debit)}</td><td className="py-2 text-right text-purple-600 font-semibold">{formatKES(totals.credit)}</td><td className={`py-2 text-right font-bold ${totals.debit - totals.credit >= 0 ? 'text-blue-700' : 'text-purple-700'}`}>{formatKES(Math.abs(totals.debit - totals.credit))} {totals.debit - totals.credit >= 0 ? 'DR' : 'CR'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{ledgerEntries.length} ledger entr{ledgerEntries.length !== 1 ? 'ies' : 'y'}</p>
          <div className="flex gap-3">
            <ExportButtons onCSV={() => { exportCSV('ledger_entries', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'ledger_entries', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('General Ledger', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'ledger_entries', details: { format: 'PDF', rows: csvRows.length } }); }} />
            <button onClick={() => { setLedgerEditingId(null); setLedgerFormData({ entryDate: new Date().toISOString().split('T')[0], description: '', account: '', debit: 0, credit: 0, reference: '', category: 'General' }); setShowLedgerForm(true); }} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">+ New Entry</button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Date</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Account</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Description</th><th className="px-5 py-3 text-left font-semibold text-muted-foreground">Category</th><th className="px-5 py-3 text-right font-semibold text-blue-700">Debit</th><th className="px-5 py-3 text-right font-semibold text-purple-700">Credit</th><th className="px-5 py-3 text-right font-semibold text-muted-foreground">Balance</th><th className="px-5 py-3 text-center font-semibold text-muted-foreground">Actions</th></tr></thead>
              <tbody>
                {ledgerData.length === 0 ? (<tr><td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">No ledger entries</td></tr>) : ledgerData.map(e => {
                  const entryBalance = runningBalances.get(e.id) || 0;
                  return (
                  <tr key={e.id} className="border-b border-border hover:bg-secondary/30 transition-colors"><td className="px-5 py-3 whitespace-nowrap">{formatDate(e.entryDate)}</td><td className="px-5 py-3 font-medium">{e.account}</td><td className="px-5 py-3 max-w-[200px] truncate">{e.description}</td><td className="px-5 py-3"><span className="px-2 py-0.5 text-xs bg-secondary rounded-full font-medium">{e.category}</span></td><td className="px-5 py-3 text-right font-semibold text-blue-600">{e.debit > 0 ? formatKES(e.debit) : '-'}</td><td className="px-5 py-3 text-right font-semibold text-purple-600">{e.credit > 0 ? formatKES(e.credit) : '-'}</td><td className={`px-5 py-3 text-right font-semibold ${entryBalance >= 0 ? 'text-blue-700' : 'text-purple-700'}`}>{formatKES(Math.abs(entryBalance))} {entryBalance >= 0 ? 'DR' : 'CR'}</td><td className="px-5 py-3"><div className="flex gap-2 justify-center"><button onClick={() => handleLedgerEdit(e)} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 font-medium">Edit</button><button onClick={() => handleLedgerDelete(e.id)} className="px-3 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 font-medium">Delete</button></div></td></tr>
                  );
                })}
              </tbody>
              {ledgerEntries.length > 0 && (<tfoot className="bg-secondary/70 font-bold"><tr><td className="px-5 py-3" colSpan={4}>TOTALS</td><td className="px-5 py-3 text-right text-blue-700">{formatKES(totalLedgerDebit)}</td><td className="px-5 py-3 text-right text-purple-700">{formatKES(totalLedgerCredit)}</td><td className={`px-5 py-3 text-right ${isBalanced ? 'text-emerald-700' : Math.abs(balance) > 0 ? (balance > 0 ? 'text-blue-700' : 'text-purple-700') : ''}`}>{isBalanced ? 'Balanced' : `${formatKES(Math.abs(balance))} ${balance > 0 ? 'DR' : 'CR'}`}</td><td className="px-5 py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{isBalanced ? 'Balanced' : 'Unbalanced'}</span></td></tr></tfoot>)}
            </table>
          </div>
          <Pagination currentPage={ledgerPage} totalPages={ledgerTotalPages} totalItems={ledgerEntries.length} onPageChange={setLedgerPage} />
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    // ─── Assets ───
    const totalFixedAssets = round2(assets.reduce((s, a) => s + safeNum(a.currentValue), 0));
    const totalAssetDepreciation = round2(assets.reduce((s, a) => s + safeNum(a.accumulatedDepreciation), 0));
    const netFixedAssets = totalFixedAssets;
    const cashAndBank = round2(ledgerEntries.filter(e => e.account?.toLowerCase().includes('cash') || e.account?.toLowerCase().includes('bank')).reduce((s, e) => s + safeNum(e.debit) - safeNum(e.credit), 0));
    const accountsReceivable = totalDebt; // debtors owe us
    const currentAssets = round2(inventoryValuation + cashAndBank + accountsReceivable);
    const totalAssets = round2(netFixedAssets + currentAssets);

    // ─── Liabilities ───
    const accountsPayable = totalCredit; // we owe creditors
    const otherCurrentLiabilities = round2(ledgerEntries.filter(e => e.category === 'Liabilities' && safeNum(e.credit) > 0).reduce((s, e) => s + safeNum(e.credit) - safeNum(e.debit), 0));
    const currentLiabilities = round2(accountsPayable + Math.max(0, otherCurrentLiabilities));
    const longTermLiabilities = 0;
    const totalLiabilities = round2(currentLiabilities + longTermLiabilities);

    // ─── Equity ───
    const retainedEarnings = totalProfit;
    const totalEquity = round2(totalAssets - totalLiabilities);
    const ownerCapital = round2(totalEquity - retainedEarnings);

    // Verify balance: check that ledger debits equal credits (meaningful accounting check)
    const ledgerBalance = round2(totalLedgerDebit - totalLedgerCredit);
    const isLedgerBalanced = Math.abs(ledgerBalance) < 0.01;
    // Balance sheet always balances by construction (Assets = Liabilities + Equity),
    // so check underlying ledger integrity instead
    const isBalanced = isLedgerBalanced;

    const bsDate = dateTo || new Date().toISOString().split('T')[0];

    const csvHeaders = ['Account', 'Amount (KES)'];
    const csvRows = [
      ['ASSETS', ''],
      ['Fixed Assets (Net Book Value)', totalFixedAssets.toFixed(2)],
      ['Less: Accumulated Depreciation', totalAssetDepreciation.toFixed(2)],
      ['Inventory', inventoryValuation.toFixed(2)],
      ['Accounts Receivable (Debtors)', accountsReceivable.toFixed(2)],
      ['Cash & Bank', cashAndBank.toFixed(2)],
      ['TOTAL ASSETS', totalAssets.toFixed(2)],
      ['', ''],
      ['LIABILITIES', ''],
      ['Accounts Payable (Creditors)', accountsPayable.toFixed(2)],
      ['Other Current Liabilities', Math.max(0, otherCurrentLiabilities).toFixed(2)],
      ['TOTAL LIABILITIES', totalLiabilities.toFixed(2)],
      ['', ''],
      ['EQUITY', ''],
      ['Owner Capital', ownerCapital.toFixed(2)],
      ['Retained Earnings', retainedEarnings.toFixed(2)],
      ['TOTAL EQUITY', totalEquity.toFixed(2)],
    ];

    const renderBSRow = (label: string, amount: number, indent: boolean = false, bold: boolean = false, isNeg: boolean = false) => (
      <tr className={`border-b border-border ${bold ? 'bg-secondary/50 font-bold' : 'hover:bg-secondary/20'}`}>
        <td className={`px-5 py-3 ${indent ? 'pl-10' : ''} ${bold ? 'font-bold' : ''}`}>{label}</td>
        <td className={`px-5 py-3 text-right font-semibold ${isNeg ? 'text-red-600' : bold ? 'text-foreground' : 'text-muted-foreground'}`}>
          {isNeg ? `(${formatKES(Math.abs(amount))})` : formatKES(amount)}
        </td>
      </tr>
    );

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Total Assets" value={formatKES(totalAssets)} subtitle={`${assets.length} fixed assets`} color="blue" />
          <SummaryCard title="Total Liabilities" value={formatKES(totalLiabilities)} subtitle={`${creditors.length} creditors`} color="red" />
          <SummaryCard title="Total Equity" value={formatKES(totalEquity)} subtitle={isBalanced ? 'Balance verified' : 'Check entries'} color={isBalanced ? 'green' : 'amber'} />
          <SummaryCard title="Net Worth" value={formatKES(totalEquity)} subtitle={totalEquity >= 0 ? 'Healthy position' : 'Negative equity'} color={totalEquity >= 0 ? 'green' : 'red'} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Statement of Financial Position</h3>
            <p className="text-sm text-muted-foreground">As at {formatDate(bsDate)}</p>
          </div>
          <ExportButtons onCSV={() => { exportCSV('balance_sheet', csvHeaders, csvRows); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'balance_sheet', details: { format: 'CSV', rows: csvRows.length } }); }} onPDF={() => { exportPDF('Balance Sheet', csvHeaders, csvRows, reportBizInfo); logAudit({ action: 'EXPORT', module: 'Reports', record_id: 'balance_sheet', details: { format: 'PDF', rows: csvRows.length } }); }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ASSETS */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-blue-50 border-b border-blue-200 px-5 py-3">
              <h4 className="font-bold text-blue-900">ASSETS</h4>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border bg-blue-50/30"><td className="px-5 py-2 font-semibold text-blue-800" colSpan={2}>Non-Current Assets</td></tr>
                {renderBSRow('Property, Plant & Equipment', totalFixedAssets + totalAssetDepreciation, true)}
                {renderBSRow('Less: Accumulated Depreciation', totalAssetDepreciation, true, false, true)}
                {renderBSRow('Net Fixed Assets', netFixedAssets, false, true)}

                <tr className="border-b border-border bg-blue-50/30"><td className="px-5 py-2 font-semibold text-blue-800" colSpan={2}>Current Assets</td></tr>
                {renderBSRow('Inventory', inventoryValuation, true)}
                {renderBSRow('Accounts Receivable (Debtors)', accountsReceivable, true)}
                {renderBSRow('Cash & Bank Balances', cashAndBank, true)}
                {renderBSRow('Total Current Assets', currentAssets, false, true)}

                <tr className="border-t-2 border-blue-300 bg-blue-100/50 font-bold">
                  <td className="px-5 py-3 text-blue-900 font-bold text-base">TOTAL ASSETS</td>
                  <td className="px-5 py-3 text-right text-blue-900 font-bold text-base">{formatKES(totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-5 py-3">
              <h4 className="font-bold text-red-900">LIABILITIES & EQUITY</h4>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border bg-red-50/30"><td className="px-5 py-2 font-semibold text-red-800" colSpan={2}>Current Liabilities</td></tr>
                {renderBSRow('Accounts Payable (Creditors)', accountsPayable, true)}
                {renderBSRow('Other Current Liabilities', Math.max(0, otherCurrentLiabilities), true)}
                {renderBSRow('Total Current Liabilities', currentLiabilities, false, true)}

                <tr className="border-b border-border bg-emerald-50/30"><td className="px-5 py-2 font-semibold text-emerald-800" colSpan={2}>Equity</td></tr>
                {renderBSRow("Owner's Capital", ownerCapital, true, false, ownerCapital < 0)}
                {renderBSRow('Retained Earnings', retainedEarnings, true)}
                {renderBSRow('Total Equity', totalEquity, false, true)}

                <tr className="border-t-2 border-red-300 bg-red-100/50 font-bold">
                  <td className="px-5 py-3 text-red-900 font-bold text-base">TOTAL LIABILITIES & EQUITY</td>
                  <td className="px-5 py-3 text-right text-red-900 font-bold text-base">{formatKES(totalLiabilities + totalEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance Check */}
        <div className={`border-2 rounded-xl p-4 flex items-center justify-between ${isBalanced ? 'border-emerald-300 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isBalanced ? 'bg-emerald-500' : 'bg-amber-500'}`}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isBalanced ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} /></svg>
            </div>
            <div>
              <p className={`font-semibold ${isBalanced ? 'text-emerald-800' : 'text-amber-800'}`}>{isBalanced ? 'Ledger is Balanced - Books Verified' : 'Ledger Out of Balance - Review Entries'}</p>
              <p className="text-xs text-muted-foreground">Total Debits ({formatKES(totalLedgerDebit)}) {isBalanced ? '=' : '≠'} Total Credits ({formatKES(totalLedgerCredit)}){!isBalanced ? ` | Difference: ${formatKES(Math.abs(ledgerBalance))}` : ''}</p>
            </div>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isBalanced ? 'Verified' : `Diff: ${formatKES(Math.abs(ledgerBalance))}`}
          </span>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'pnl': return renderPnl();
      case 'balance-sheet': return renderBalanceSheet();
      case 'sales': return renderSales();
      case 'inventory': return renderInventory();
      case 'debtors': return renderDebtors();
      case 'creditors': return renderCreditors();
      case 'items': return renderItems();
      case 'ledger': return renderLedger();
      default: return renderOverview();
    }
  };

  // ─── Main Return ──────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-muted-foreground">Financial reports, sales analytics, and general ledger for SNACKOH BITES</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Date Range:</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2"><label className="text-sm text-muted-foreground">From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background" /></div>
            <div className="flex items-center gap-2"><label className="text-sm text-muted-foreground">To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background" /></div>
            <button onClick={fetchAll} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">Apply</button>
            <button onClick={() => { const r = getDefaultDateRange(); setDateFrom(r.start); setDateTo(r.end); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary font-medium">This Month</button>
            <button onClick={() => { const n = new Date(); setDateFrom(new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary font-medium">This Year</button>
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary font-medium">All Time</button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-border">
        <nav className="flex gap-0 overflow-x-auto -mb-px" role="tablist">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} role="tab" aria-selected={activeTab === tab.key} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}>
              <span className="text-base">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && (<div className="flex items-center justify-center py-12"><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-muted-foreground">Loading report data...</span></div></div>)}

      {!loading && renderTabContent()}

      {/* ─── P&L Form Modal ── */}
      <Modal isOpen={showPnlForm} onClose={() => { setShowPnlForm(false); setPnlEditingId(null); }} title={pnlEditingId ? 'Edit P&L Period' : 'Add P&L Period'} size="md">
        <form onSubmit={handlePnlSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Period</label><input type="text" placeholder="e.g. January 2026" value={pnlFormData.period} onChange={(e) => setPnlFormData({ ...pnlFormData, period: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Revenue (KES)</label><input type="number" step="0.01" value={pnlFormData.revenue} onChange={(e) => setPnlFormData({ ...pnlFormData, revenue: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
            <div><label className="block text-sm font-medium mb-1">Costs (KES)</label><input type="number" step="0.01" value={pnlFormData.costs} onChange={(e) => setPnlFormData({ ...pnlFormData, costs: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
          </div>
          <div className="bg-secondary rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Profit:</span><span className={`font-bold ${safeNum(pnlFormData.revenue) - safeNum(pnlFormData.costs) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatKES(round2(safeNum(pnlFormData.revenue) - safeNum(pnlFormData.costs)))}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Margin:</span><span className="font-bold">{safeNum(pnlFormData.revenue) > 0 ? (safeDiv(safeNum(pnlFormData.revenue) - safeNum(pnlFormData.costs), safeNum(pnlFormData.revenue)) * 100).toFixed(1) : '0.0'}%</span></div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowPnlForm(false); setPnlEditingId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{pnlEditingId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Ledger Form Modal ── */}
      <Modal isOpen={showLedgerForm} onClose={() => { setShowLedgerForm(false); setLedgerEditingId(null); }} title={ledgerEditingId ? 'Edit Ledger Entry' : 'New Ledger Entry'} size="lg">
        <form onSubmit={handleLedgerSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Entry Date</label><input type="date" value={ledgerFormData.entryDate} onChange={(e) => setLedgerFormData({ ...ledgerFormData, entryDate: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
            <div><label className="block text-sm font-medium mb-1">Account</label><input type="text" placeholder="e.g. Cash, Bank, Sales Revenue" value={ledgerFormData.account} onChange={(e) => setLedgerFormData({ ...ledgerFormData, account: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Description</label><input type="text" placeholder="Transaction description" value={ledgerFormData.description} onChange={(e) => setLedgerFormData({ ...ledgerFormData, description: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Debit (KES)</label><input type="number" step="0.01" min="0" value={ledgerFormData.debit} onChange={(e) => setLedgerFormData({ ...ledgerFormData, debit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" /></div>
            <div><label className="block text-sm font-medium mb-1">Credit (KES)</label><input type="number" step="0.01" min="0" value={ledgerFormData.credit} onChange={(e) => setLedgerFormData({ ...ledgerFormData, credit: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" /></div>
          </div>
          {safeNum(ledgerFormData.debit) === 0 && safeNum(ledgerFormData.credit) === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-700">At least one of Debit or Credit must be greater than zero.</div>
          )}
          {safeNum(ledgerFormData.debit) > 0 && safeNum(ledgerFormData.credit) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">Compound entry: Both debit and credit are set. Net effect: {formatKES(Math.abs(safeNum(ledgerFormData.debit) - safeNum(ledgerFormData.credit)))} {safeNum(ledgerFormData.debit) >= safeNum(ledgerFormData.credit) ? 'DR' : 'CR'}</div>
          )}
          {(safeNum(ledgerFormData.debit) > 0 || safeNum(ledgerFormData.credit) > 0) && !(safeNum(ledgerFormData.debit) > 0 && safeNum(ledgerFormData.credit) > 0) && (
            <div className="bg-secondary rounded-lg px-4 py-2 text-sm">
              <span className="text-muted-foreground">Entry: </span>
              <span className="font-semibold">{formatKES(Math.max(safeNum(ledgerFormData.debit), safeNum(ledgerFormData.credit)))} {safeNum(ledgerFormData.debit) > 0 ? 'DEBIT' : 'CREDIT'}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Category</label><select value={ledgerFormData.category} onChange={(e) => setLedgerFormData({ ...ledgerFormData, category: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"><option>General</option><option>Sales</option><option>Purchases</option><option>Expenses</option><option>Payroll</option><option>Assets</option><option>Liabilities</option><option>Equity</option><option>Taxes</option><option>Bank</option><option>Cash</option><option>M-Pesa</option></select></div>
            <div><label className="block text-sm font-medium mb-1">Reference</label><input type="text" placeholder="Invoice #, Receipt #" value={ledgerFormData.reference} onChange={(e) => setLedgerFormData({ ...ledgerFormData, reference: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" /></div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowLedgerForm(false); setLedgerEditingId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{ledgerEditingId ? 'Update Entry' : 'Add Entry'}</button>
          </div>
        </form>
      </Modal>

      {/* ─── Detail View Modal ── */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={detailTitle} size="md">
        <div className="space-y-3">
          {detailContent.map((item, idx) => (<div key={idx} className="flex justify-between items-center py-2 border-b border-border last:border-0"><span className="text-sm text-muted-foreground">{item.label}</span><span className="text-sm font-semibold text-right">{item.value}</span></div>))}
        </div>
        <div className="mt-6 flex justify-end"><button onClick={() => setShowDetail(false)} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Close</button></div>
      </Modal>
    </div>
  );
}
