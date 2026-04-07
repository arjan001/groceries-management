'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  outletType: string;
  status: string;
}

interface InventoryItem {
  id: string;
  name: string;
  type: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  reorderLevel: number;
}

interface StockTake {
  id: string;
  referenceNumber: string;
  outletId: string;
  outletName: string;
  conductedBy: string;
  conductedById: string;
  status: 'In Progress' | 'Completed' | 'Approved';
  startDate: string;
  endDate: string;
  notes: string;
  totalItemsCounted: number;
  totalDiscrepancies: number;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
}

interface StockTakeItem {
  id: string;
  stockTakeId: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  unit: string;
  systemQuantity: number;
  physicalQuantity: number;
  discrepancy: number;
  discrepancyReason: string;
  unitCost: number;
  varianceValue: number;
  countedBy: string;
  countedAt: string;
  createdAt: string;
}

type TabKey = 'stock-take' | 'stock-count' | 'stock-reports';
type StockTakeStatus = 'All' | 'In Progress' | 'Completed' | 'Approved';

const DISCREPANCY_REASONS = [
  'Theft/Pilferage',
  'Damage/Breakage',
  'Expired/Spoilage',
  'Counting Error',
  'Receiving Error',
  'System Error',
  'Transfer Not Recorded',
  'Production Usage',
  'Sampling/Testing',
  'Other',
];

const ITEMS_PER_PAGE = 10;

// ── Export Utilities ────────────────────────────────────────────────────────

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
  const win = window.open('', '_blank');
  if (!win) return;
  const tableRows = rows
    .map(
      row =>
        `<tr>${row.map(cell => `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${cell}</td>`).join('')}</tr>`
    )
    .join('');
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
    <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
    <p class="footer">Stock Take Report</p>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

function generateReferenceNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ST-${dateStr}-${random}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Pagination Component ────────────────────────────────────────────────────

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  const from = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-border gap-2">
      <p className="text-sm text-muted-foreground">
        Showing {from}-{to} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &laquo;
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-muted-foreground">...</span>}
          </>
        )}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 text-sm border rounded-md ${
              p === currentPage
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-secondary'
            }`}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-muted-foreground">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary"
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-sm border border-border rounded-md hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}

// ── Export Buttons Component ────────────────────────────────────────────────

function ExportButtons({ onCSV, onPDF }: { onCSV: () => void; onPDF: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onCSV}
        className="px-4 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
      >
        CSV
      </button>
      <button
        onClick={onPDF}
        className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors"
      >
        PDF
      </button>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function StockTakePage() {
  // ── Tab State ──
  const [activeTab, setActiveTab] = useState<TabKey>('stock-take');

  // ── Data State ──
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [stockTakeItems, setStockTakeItems] = useState<StockTakeItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Stock Take Modal States ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedStockTake, setSelectedStockTake] = useState<StockTake | null>(null);

  // ── Stock Count Modal States ──
  const [showCountModal, setShowCountModal] = useState(false);
  const [activeCountStockTake, setActiveCountStockTake] = useState<StockTake | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // ── Filter & Pagination States ──
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockTakeStatus>('All');
  const [outletFilter, setOutletFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stockTakePage, setStockTakePage] = useState(1);

  // ── Stock Count Filters ──
  const [countSearch, setCountSearch] = useState('');
  const [countCategoryFilter, setCountCategoryFilter] = useState('All');
  const [countPage, setCountPage] = useState(1);

  // ── Reports Filters ──
  const [reportSearch, setReportSearch] = useState('');
  const [reportOutletFilter, setReportOutletFilter] = useState('All');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportPage, setReportPage] = useState(1);

  // ── Toast State ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Create Form State ──
  const [createForm, setCreateForm] = useState({
    outletId: '',
    conductedBy: '',
    notes: '',
  });

  // ── Add Item Form State ──
  const [addItemForm, setAddItemForm] = useState({
    itemId: '',
    physicalQuantity: 0,
    discrepancyReason: '',
    countedBy: '',
  });

  // ── Approval Form State ──
  const [approvalForm, setApprovalForm] = useState({
    approvedBy: '',
  });

  // ── Item Search for Add Modal ──
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // ── Toast Helper ──
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchStockTakes = useCallback(async () => {
    const { data } = await supabase
      .from('stock_takes')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setStockTakes(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          referenceNumber: (r.reference_number || '') as string,
          outletId: (r.outlet_id || '') as string,
          outletName: (r.outlet_name || '') as string,
          conductedBy: (r.conducted_by || '') as string,
          conductedById: (r.conducted_by_id || '') as string,
          status: (r.status || 'In Progress') as StockTake['status'],
          startDate: (r.start_date || '') as string,
          endDate: (r.end_date || '') as string,
          notes: (r.notes || '') as string,
          totalItemsCounted: (r.total_items_counted || 0) as number,
          totalDiscrepancies: (r.total_discrepancies || 0) as number,
          approvedBy: (r.approved_by || '') as string,
          approvedAt: (r.approved_at || '') as string,
          createdAt: (r.created_at || '') as string,
        }))
      );
    } else {
      setStockTakes([]);
    }
  }, []);

  const fetchStockTakeItems = useCallback(async (stockTakeId?: string) => {
    let query = supabase
      .from('stock_take_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (stockTakeId) {
      query = query.eq('stock_take_id', stockTakeId);
    }
    const { data } = await query;
    if (data) {
      setStockTakeItems(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          stockTakeId: (r.stock_take_id || '') as string,
          itemId: (r.item_id || '') as string,
          itemName: (r.item_name || '') as string,
          itemCategory: (r.item_category || '') as string,
          unit: (r.unit || '') as string,
          systemQuantity: (r.system_quantity || 0) as number,
          physicalQuantity: (r.physical_quantity || 0) as number,
          discrepancy: (r.discrepancy || 0) as number,
          discrepancyReason: (r.discrepancy_reason || '') as string,
          unitCost: (r.unit_cost || 0) as number,
          varianceValue: (r.variance_value || 0) as number,
          countedBy: (r.counted_by || '') as string,
          countedAt: (r.counted_at || '') as string,
          createdAt: (r.created_at || '') as string,
        }))
      );
    } else {
      setStockTakeItems([]);
    }
  }, []);

  const fetchInventoryItems = useCallback(async () => {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });
    if (data) {
      setInventoryItems(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name || '') as string,
          type: (r.type || '') as string,
          category: (r.category || '') as string,
          quantity: (r.quantity || 0) as number,
          unit: (r.unit || '') as string,
          unitCost: (r.unit_cost || 0) as number,
          reorderLevel: (r.reorder_level || 0) as number,
        }))
      );
    } else {
      setInventoryItems([]);
    }
  }, []);

  const fetchOutlets = useCallback(async () => {
    const { data } = await supabase
      .from('outlets')
      .select('*')
      .order('name', { ascending: true });
    if (data) {
      setOutlets(
        data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name || '') as string,
          outletType: (r.outlet_type || '') as string,
          status: (r.status || '') as string,
        }))
      );
    } else {
      setOutlets([]);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStockTakes(),
        fetchStockTakeItems(),
        fetchInventoryItems(),
        fetchOutlets(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchStockTakes, fetchStockTakeItems, fetchInventoryItems, fetchOutlets]);

  // ── CRUD Operations ───────────────────────────────────────────────────────

  const handleCreateStockTake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.outletId || !createForm.conductedBy) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    const outlet = outlets.find(o => o.id === createForm.outletId);
    const refNumber = generateReferenceNumber();
    const row = {
      reference_number: refNumber,
      outlet_id: createForm.outletId,
      outlet_name: outlet?.name || '',
      conducted_by: createForm.conductedBy,
      status: 'In Progress',
      start_date: new Date().toISOString(),
      notes: createForm.notes,
      total_items_counted: 0,
      total_discrepancies: 0,
    };
    try {
      const { data, error } = await supabase.from('stock_takes').insert(row).select().single();
      if (error) throw error;
      logAudit({
        action: 'CREATE',
        module: 'Stock Take',
        record_id: data?.id || '',
        details: { reference_number: refNumber, outlet: outlet?.name, conducted_by: createForm.conductedBy },
      });
      showToast(`Stock take ${refNumber} created successfully`, 'success');
      await fetchStockTakes();
      setShowCreateModal(false);
      setCreateForm({ outletId: '', conductedBy: '', notes: '' });
    } catch {
      showToast('Failed to create stock take', 'error');
    }
  };

  const handleAddCountItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCountStockTake || !addItemForm.itemId || !addItemForm.countedBy) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    const invItem = inventoryItems.find(i => i.id === addItemForm.itemId);
    if (!invItem) {
      showToast('Selected item not found', 'error');
      return;
    }
    const systemQty = invItem.quantity;
    const physicalQty = addItemForm.physicalQuantity;
    const discrepancy = physicalQty - systemQty;
    const varianceValue = discrepancy * invItem.unitCost;

    const row = {
      stock_take_id: activeCountStockTake.id,
      item_id: invItem.id,
      item_name: invItem.name,
      item_category: invItem.category,
      unit: invItem.unit,
      system_quantity: systemQty,
      physical_quantity: physicalQty,
      discrepancy: discrepancy,
      discrepancy_reason: discrepancy !== 0 ? addItemForm.discrepancyReason : '',
      unit_cost: invItem.unitCost,
      variance_value: varianceValue,
      counted_by: addItemForm.countedBy,
      counted_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('stock_take_items').insert(row);
      if (error) throw error;

      // Update stock take totals
      const updatedItems = [...stockTakeItems.filter(i => i.stockTakeId === activeCountStockTake.id)];
      const newTotalCounted = updatedItems.length + 1;
      const newTotalDiscrepancies =
        updatedItems.filter(i => i.discrepancy !== 0).length + (discrepancy !== 0 ? 1 : 0);

      await supabase
        .from('stock_takes')
        .update({
          total_items_counted: newTotalCounted,
          total_discrepancies: newTotalDiscrepancies,
        })
        .eq('id', activeCountStockTake.id);

      logAudit({
        action: 'CREATE',
        module: 'Stock Take',
        record_id: activeCountStockTake.id,
        details: {
          item_name: invItem.name,
          system_qty: systemQty,
          physical_qty: physicalQty,
          discrepancy: discrepancy,
          variance_value: varianceValue,
        },
      });

      showToast(`${invItem.name} counted successfully`, 'success');
      await Promise.all([fetchStockTakeItems(activeCountStockTake.id), fetchStockTakes()]);
      setShowAddItemModal(false);
      setAddItemForm({ itemId: '', physicalQuantity: 0, discrepancyReason: '', countedBy: '' });
      setItemSearchQuery('');
    } catch {
      showToast('Failed to add item count', 'error');
    }
  };

  const handleCompleteStockTake = async (st: StockTake) => {
    if (!confirm(`Complete stock take ${st.referenceNumber}? This cannot be undone.`)) return;
    try {
      await supabase
        .from('stock_takes')
        .update({ status: 'Completed', end_date: new Date().toISOString() })
        .eq('id', st.id);
      logAudit({
        action: 'UPDATE',
        module: 'Stock Take',
        record_id: st.id,
        details: { reference_number: st.referenceNumber, status: 'Completed' },
      });
      showToast(`Stock take ${st.referenceNumber} completed`, 'success');
      await fetchStockTakes();
    } catch {
      showToast('Failed to complete stock take', 'error');
    }
  };

  const handleApproveStockTake = async () => {
    if (!selectedStockTake || !approvalForm.approvedBy.trim()) {
      showToast('Please enter the approver name', 'error');
      return;
    }
    try {
      await supabase
        .from('stock_takes')
        .update({
          status: 'Approved',
          approved_by: approvalForm.approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedStockTake.id);
      logAudit({
        action: 'APPROVE',
        module: 'Stock Take',
        record_id: selectedStockTake.id,
        details: {
          reference_number: selectedStockTake.referenceNumber,
          approved_by: approvalForm.approvedBy,
        },
      });
      showToast(`Stock take ${selectedStockTake.referenceNumber} approved`, 'success');
      await fetchStockTakes();
      setShowApprovalModal(false);
      setSelectedStockTake(null);
      setApprovalForm({ approvedBy: '' });
    } catch {
      showToast('Failed to approve stock take', 'error');
    }
  };

  const handleDeleteStockTake = async (st: StockTake) => {
    if (!confirm(`Delete stock take ${st.referenceNumber}? This will also delete all counted items.`))
      return;
    try {
      await supabase.from('stock_take_items').delete().eq('stock_take_id', st.id);
      await supabase.from('stock_takes').delete().eq('id', st.id);
      logAudit({
        action: 'DELETE',
        module: 'Stock Take',
        record_id: st.id,
        details: { reference_number: st.referenceNumber },
      });
      showToast(`Stock take ${st.referenceNumber} deleted`, 'success');
      await fetchStockTakes();
    } catch {
      showToast('Failed to delete stock take', 'error');
    }
  };

  const handleDeleteCountItem = async (item: StockTakeItem) => {
    if (!confirm(`Remove ${item.itemName} from count?`)) return;
    try {
      await supabase.from('stock_take_items').delete().eq('id', item.id);
      logAudit({
        action: 'DELETE',
        module: 'Stock Take',
        record_id: item.id,
        details: { item_name: item.itemName, stock_take_id: item.stockTakeId },
      });
      showToast(`${item.itemName} removed from count`, 'success');

      // Update totals
      if (activeCountStockTake) {
        const remainingItems = stockTakeItems.filter(
          i => i.stockTakeId === activeCountStockTake.id && i.id !== item.id
        );
        await supabase
          .from('stock_takes')
          .update({
            total_items_counted: remainingItems.length,
            total_discrepancies: remainingItems.filter(i => i.discrepancy !== 0).length,
          })
          .eq('id', activeCountStockTake.id);
        await Promise.all([fetchStockTakeItems(activeCountStockTake.id), fetchStockTakes()]);
      }
    } catch {
      showToast('Failed to remove item', 'error');
    }
  };

  // ── Filtered & Paginated Data ─────────────────────────────────────────────

  // Stock Takes
  const filteredStockTakes = useMemo(() => {
    let result = stockTakes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        st =>
          st.referenceNumber.toLowerCase().includes(q) ||
          st.outletName.toLowerCase().includes(q) ||
          st.conductedBy.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      result = result.filter(st => st.status === statusFilter);
    }
    if (outletFilter !== 'All') {
      result = result.filter(st => st.outletId === outletFilter);
    }
    if (dateFrom) {
      result = result.filter(st => st.startDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(st => st.startDate <= dateTo + 'T23:59:59');
    }
    return result;
  }, [stockTakes, searchQuery, statusFilter, outletFilter, dateFrom, dateTo]);

  const stockTakeTotalPages = Math.max(1, Math.ceil(filteredStockTakes.length / ITEMS_PER_PAGE));
  const paginatedStockTakes = filteredStockTakes.slice(
    (stockTakePage - 1) * ITEMS_PER_PAGE,
    stockTakePage * ITEMS_PER_PAGE
  );

  // Stock Count Items
  const activeCountItems = useMemo(() => {
    if (!activeCountStockTake) return [];
    let items = stockTakeItems.filter(i => i.stockTakeId === activeCountStockTake.id);
    if (countSearch.trim()) {
      const q = countSearch.toLowerCase();
      items = items.filter(
        i =>
          i.itemName.toLowerCase().includes(q) ||
          i.itemCategory.toLowerCase().includes(q) ||
          i.countedBy.toLowerCase().includes(q)
      );
    }
    if (countCategoryFilter !== 'All') {
      items = items.filter(i => i.itemCategory === countCategoryFilter);
    }
    return items;
  }, [stockTakeItems, activeCountStockTake, countSearch, countCategoryFilter]);

  const countTotalPages = Math.max(1, Math.ceil(activeCountItems.length / ITEMS_PER_PAGE));
  const paginatedCountItems = activeCountItems.slice(
    (countPage - 1) * ITEMS_PER_PAGE,
    countPage * ITEMS_PER_PAGE
  );

  // Count item categories
  const countCategories = useMemo(() => {
    if (!activeCountStockTake) return [];
    const cats = new Set(
      stockTakeItems
        .filter(i => i.stockTakeId === activeCountStockTake.id)
        .map(i => i.itemCategory)
    );
    return Array.from(cats).sort();
  }, [stockTakeItems, activeCountStockTake]);

  // Count summary
  const countSummary = useMemo(() => {
    if (!activeCountStockTake) return { totalItems: 0, totalDiscrepancies: 0, totalVariance: 0 };
    const items = stockTakeItems.filter(i => i.stockTakeId === activeCountStockTake.id);
    return {
      totalItems: items.length,
      totalDiscrepancies: items.filter(i => i.discrepancy !== 0).length,
      totalVariance: items.reduce((sum, i) => sum + i.varianceValue, 0),
    };
  }, [stockTakeItems, activeCountStockTake]);

  // ── Reports Data ──────────────────────────────────────────────────────────

  const completedStockTakes = useMemo(() => {
    let result = stockTakes.filter(st => st.status === 'Completed' || st.status === 'Approved');
    if (reportSearch.trim()) {
      const q = reportSearch.toLowerCase();
      result = result.filter(
        st =>
          st.referenceNumber.toLowerCase().includes(q) ||
          st.outletName.toLowerCase().includes(q) ||
          st.conductedBy.toLowerCase().includes(q)
      );
    }
    if (reportOutletFilter !== 'All') {
      result = result.filter(st => st.outletId === reportOutletFilter);
    }
    if (reportDateFrom) {
      result = result.filter(st => st.startDate >= reportDateFrom);
    }
    if (reportDateTo) {
      result = result.filter(st => st.startDate <= reportDateTo + 'T23:59:59');
    }
    return result;
  }, [stockTakes, reportSearch, reportOutletFilter, reportDateFrom, reportDateTo]);

  const reportTotalPages = Math.max(1, Math.ceil(completedStockTakes.length / ITEMS_PER_PAGE));
  const paginatedReports = completedStockTakes.slice(
    (reportPage - 1) * ITEMS_PER_PAGE,
    reportPage * ITEMS_PER_PAGE
  );

  // Overall report summary
  const reportSummary = useMemo(() => {
    const allCompletedItems = stockTakeItems.filter(item =>
      completedStockTakes.some(st => st.id === item.stockTakeId)
    );
    return {
      totalStockTakes: completedStockTakes.length,
      totalItemsCounted: allCompletedItems.length,
      totalDiscrepancies: allCompletedItems.filter(i => i.discrepancy !== 0).length,
      totalVarianceValue: allCompletedItems.reduce((sum, i) => sum + i.varianceValue, 0),
      positiveVariance: allCompletedItems
        .filter(i => i.discrepancy > 0)
        .reduce((sum, i) => sum + i.varianceValue, 0),
      negativeVariance: allCompletedItems
        .filter(i => i.discrepancy < 0)
        .reduce((sum, i) => sum + i.varianceValue, 0),
    };
  }, [completedStockTakes, stockTakeItems]);

  // Variance by category for reports
  const varianceByCategory = useMemo(() => {
    const allCompletedItems = stockTakeItems.filter(item =>
      completedStockTakes.some(st => st.id === item.stockTakeId)
    );
    const catMap = new Map<string, { count: number; variance: number; discrepancies: number }>();
    allCompletedItems.forEach(item => {
      const existing = catMap.get(item.itemCategory) || { count: 0, variance: 0, discrepancies: 0 };
      existing.count += 1;
      existing.variance += item.varianceValue;
      if (item.discrepancy !== 0) existing.discrepancies += 1;
      catMap.set(item.itemCategory, existing);
    });
    return Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [completedStockTakes, stockTakeItems]);

  // Top discrepancy reasons for reports
  const discrepancyReasons = useMemo(() => {
    const allCompletedItems = stockTakeItems.filter(
      item =>
        completedStockTakes.some(st => st.id === item.stockTakeId) &&
        item.discrepancy !== 0 &&
        item.discrepancyReason
    );
    const reasonMap = new Map<string, { count: number; variance: number }>();
    allCompletedItems.forEach(item => {
      const existing = reasonMap.get(item.discrepancyReason) || { count: 0, variance: 0 };
      existing.count += 1;
      existing.variance += item.varianceValue;
      reasonMap.set(item.discrepancyReason, existing);
    });
    return Array.from(reasonMap.entries())
      .map(([reason, data]) => ({ reason, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [completedStockTakes, stockTakeItems]);

  // Filtered inventory items for Add modal
  const filteredInventoryForAdd = useMemo(() => {
    if (!itemSearchQuery.trim()) return inventoryItems;
    const q = itemSearchQuery.toLowerCase();
    return inventoryItems.filter(
      i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [inventoryItems, itemSearchQuery]);

  // In-progress stock takes for the count tab
  const inProgressStockTakes = useMemo(
    () => stockTakes.filter(st => st.status === 'In Progress'),
    [stockTakes]
  );

  // Reset pages when filters change
  useEffect(() => {
    setStockTakePage(1);
  }, [searchQuery, statusFilter, outletFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCountPage(1);
  }, [countSearch, countCategoryFilter]);

  useEffect(() => {
    setReportPage(1);
  }, [reportSearch, reportOutletFilter, reportDateFrom, reportDateTo]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getStatusColor = (status: StockTake['status']) => {
    switch (status) {
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openStockCount = async (st: StockTake) => {
    setActiveCountStockTake(st);
    await fetchStockTakeItems(st.id);
    setActiveTab('stock-count');
    setCountSearch('');
    setCountCategoryFilter('All');
    setCountPage(1);
  };

  const openDetailModal = async (st: StockTake) => {
    setSelectedStockTake(st);
    await fetchStockTakeItems(st.id);
    setShowDetailModal(true);
  };

  const openApprovalModal = (st: StockTake) => {
    setSelectedStockTake(st);
    setApprovalForm({ approvedBy: '' });
    setShowApprovalModal(true);
  };

  const clearStockTakeFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setOutletFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveStockTakeFilters =
    searchQuery || statusFilter !== 'All' || outletFilter !== 'All' || dateFrom || dateTo;

  // ── Export Handlers ───────────────────────────────────────────────────────

  const handleExportStockTakesCSV = () => {
    const headers = [
      'Reference',
      'Outlet',
      'Conducted By',
      'Status',
      'Start Date',
      'End Date',
      'Items Counted',
      'Discrepancies',
    ];
    const rows = filteredStockTakes.map(st => [
      st.referenceNumber,
      st.outletName,
      st.conductedBy,
      st.status,
      formatDate(st.startDate),
      formatDate(st.endDate),
      String(st.totalItemsCounted),
      String(st.totalDiscrepancies),
    ]);
    exportCSV('stock_takes', headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      details: { format: 'CSV', rows: rows.length },
    });
  };

  const handleExportStockTakesPDF = () => {
    const headers = [
      'Reference',
      'Outlet',
      'Conducted By',
      'Status',
      'Start Date',
      'Items',
      'Discrepancies',
    ];
    const rows = filteredStockTakes.map(st => [
      st.referenceNumber,
      st.outletName,
      st.conductedBy,
      st.status,
      formatDate(st.startDate),
      String(st.totalItemsCounted),
      String(st.totalDiscrepancies),
    ]);
    exportPDF('Stock Take Report', headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      details: { format: 'PDF', rows: rows.length },
    });
  };

  const handleExportCountCSV = () => {
    if (!activeCountStockTake) return;
    const headers = [
      'Item',
      'Category',
      'Unit',
      'System Qty',
      'Physical Qty',
      'Discrepancy',
      'Unit Cost',
      'Variance Value',
      'Reason',
      'Counted By',
    ];
    const rows = activeCountItems.map(i => [
      i.itemName,
      i.itemCategory,
      i.unit,
      String(i.systemQuantity),
      String(i.physicalQuantity),
      String(i.discrepancy),
      i.unitCost.toFixed(2),
      i.varianceValue.toFixed(2),
      i.discrepancyReason,
      i.countedBy,
    ]);
    exportCSV(`stock_count_${activeCountStockTake.referenceNumber}`, headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      record_id: activeCountStockTake.id,
      details: { format: 'CSV', rows: rows.length },
    });
  };

  const handleExportCountPDF = () => {
    if (!activeCountStockTake) return;
    const headers = [
      'Item',
      'Category',
      'System Qty',
      'Physical Qty',
      'Discrepancy',
      'Variance (KES)',
      'Reason',
    ];
    const rows = activeCountItems.map(i => [
      i.itemName,
      i.itemCategory,
      String(i.systemQuantity),
      String(i.physicalQuantity),
      String(i.discrepancy),
      i.varianceValue.toFixed(2),
      i.discrepancyReason,
    ]);
    exportPDF(`Stock Count - ${activeCountStockTake.referenceNumber}`, headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      record_id: activeCountStockTake.id,
      details: { format: 'PDF', rows: rows.length },
    });
  };

  const handleExportReportsCSV = () => {
    const headers = [
      'Reference',
      'Outlet',
      'Status',
      'Date',
      'Items Counted',
      'Discrepancies',
      'Conducted By',
      'Approved By',
    ];
    const rows = completedStockTakes.map(st => [
      st.referenceNumber,
      st.outletName,
      st.status,
      formatDate(st.startDate),
      String(st.totalItemsCounted),
      String(st.totalDiscrepancies),
      st.conductedBy,
      st.approvedBy || '-',
    ]);
    exportCSV('stock_take_reports', headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      details: { format: 'CSV', entity: 'reports', rows: rows.length },
    });
  };

  const handleExportReportsPDF = () => {
    const headers = [
      'Reference',
      'Outlet',
      'Status',
      'Date',
      'Items',
      'Discrepancies',
      'Approved By',
    ];
    const rows = completedStockTakes.map(st => [
      st.referenceNumber,
      st.outletName,
      st.status,
      formatDate(st.startDate),
      String(st.totalItemsCounted),
      String(st.totalDiscrepancies),
      st.approvedBy || '-',
    ]);
    exportPDF('Stock Take History Report', headers, rows);
    logAudit({
      action: 'EXPORT',
      module: 'Stock Take',
      details: { format: 'PDF', entity: 'reports', rows: rows.length },
    });
  };

  // ── Detail items for modal ────────────────────────────────────────────────

  const detailItems = useMemo(() => {
    if (!selectedStockTake) return [];
    return stockTakeItems.filter(i => i.stockTakeId === selectedStockTake.id);
  }, [stockTakeItems, selectedStockTake]);

  const detailSummary = useMemo(() => {
    return {
      totalItems: detailItems.length,
      totalDiscrepancies: detailItems.filter(i => i.discrepancy !== 0).length,
      totalVarianceValue: detailItems.reduce((sum, i) => sum + i.varianceValue, 0),
    };
  }, [detailItems]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-96" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
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
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold mb-2">Stock Take Management</h1>
        <p className="text-muted-foreground">
          Conduct physical stock counts, track variances, and manage inventory accuracy
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stock-take')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'stock-take'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Stock Take
        </button>
        <button
          onClick={() => setActiveTab('stock-count')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'stock-count'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Stock Count
        </button>
        <button
          onClick={() => setActiveTab('stock-reports')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'stock-reports'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Stock Reports
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── STOCK TAKE TAB ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stock-take' && (
        <div>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <p className="text-sm font-medium text-muted-foreground mb-1">Total Stock Takes</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground">{stockTakes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </div>
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <p className="text-sm font-medium text-muted-foreground mb-1">In Progress</p>
              <p className="text-2xl md:text-3xl font-bold text-blue-600">
                {stockTakes.filter(st => st.status === 'In Progress').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active counts</p>
            </div>
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <p className="text-sm font-medium text-muted-foreground mb-1">Completed</p>
              <p className="text-2xl md:text-3xl font-bold text-yellow-600">
                {stockTakes.filter(st => st.status === 'Completed').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
            </div>
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <p className="text-sm font-medium text-muted-foreground mb-1">Approved</p>
              <p className="text-2xl md:text-3xl font-bold text-green-600">
                {stockTakes.filter(st => st.status === 'Approved').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Finalized</p>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 w-full sm:min-w-[250px] sm:max-w-md">
                <input
                  type="text"
                  placeholder="Search by reference, outlet, conducted by..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <ExportButtons onCSV={handleExportStockTakesCSV} onPDF={handleExportStockTakesPDF} />
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setCreateForm({ outletId: '', conductedBy: '', notes: '' });
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold whitespace-nowrap"
                >
                  + New Stock Take
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StockTakeStatus)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="All">All Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Approved">Approved</option>
              </select>
              <select
                value={outletFilter}
                onChange={e => setOutletFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="All">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                placeholder="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                placeholder="To date"
              />
              {hasActiveStockTakeFilters && (
                <button
                  onClick={clearStockTakeFilters}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Stock Takes Table */}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Reference</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Outlet</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Conducted By</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Start Date</th>
                    <th className="text-center p-3 font-semibold whitespace-nowrap">Items</th>
                    <th className="text-center p-3 font-semibold whitespace-nowrap">Discrepancies</th>
                    <th className="text-right p-3 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStockTakes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {hasActiveStockTakeFilters
                          ? 'No stock takes match the current filters.'
                          : 'No stock takes yet. Create your first stock take to get started.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedStockTakes.map(st => (
                      <tr key={st.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="p-3 font-medium whitespace-nowrap">
                          <button
                            onClick={() => openDetailModal(st)}
                            className="text-primary hover:underline font-semibold"
                          >
                            {st.referenceNumber}
                          </button>
                        </td>
                        <td className="p-3 whitespace-nowrap">{st.outletName || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{st.conductedBy}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(st.status)}`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">{formatDate(st.startDate)}</td>
                        <td className="p-3 text-center">{st.totalItemsCounted}</td>
                        <td className="p-3 text-center">
                          {st.totalDiscrepancies > 0 ? (
                            <span className="text-red-600 font-medium">{st.totalDiscrepancies}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {st.status === 'In Progress' && (
                              <>
                                <button
                                  onClick={() => openStockCount(st)}
                                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 font-medium"
                                >
                                  Count
                                </button>
                                <button
                                  onClick={() => handleCompleteStockTake(st)}
                                  className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100 font-medium"
                                >
                                  Complete
                                </button>
                              </>
                            )}
                            {st.status === 'Completed' && (
                              <button
                                onClick={() => openApprovalModal(st)}
                                className="px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-medium"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => openDetailModal(st)}
                              className="px-2 py-1 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 font-medium"
                            >
                              View
                            </button>
                            {st.status === 'In Progress' && (
                              <button
                                onClick={() => handleDeleteStockTake(st)}
                                className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={stockTakePage}
              totalPages={stockTakeTotalPages}
              totalItems={filteredStockTakes.length}
              onPageChange={setStockTakePage}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── STOCK COUNT TAB ───────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stock-count' && (
        <div>
          {/* Select Active Stock Take */}
          {!activeCountStockTake ? (
            <div>
              <h2 className="text-lg font-semibold mb-4">Select a Stock Take to Count</h2>
              {inProgressStockTakes.length === 0 ? (
                <div className="border border-border rounded-lg p-8 text-center bg-card">
                  <p className="text-muted-foreground mb-4">
                    No in-progress stock takes available. Create one from the Stock Take tab first.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('stock-take');
                      setShowCreateModal(true);
                      setCreateForm({ outletId: '', conductedBy: '', notes: '' });
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold"
                  >
                    + New Stock Take
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inProgressStockTakes.map(st => (
                    <div
                      key={st.id}
                      className="border border-border rounded-lg p-4 md:p-6 bg-card hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openStockCount(st)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-foreground">{st.referenceNumber}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(st.status)}`}>
                          {st.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Outlet: <span className="text-foreground">{st.outletName || '-'}</span></p>
                        <p>Conducted by: <span className="text-foreground">{st.conductedBy}</span></p>
                        <p>Started: <span className="text-foreground">{formatDate(st.startDate)}</span></p>
                        <p>
                          Items counted:{' '}
                          <span className="text-foreground font-medium">{st.totalItemsCounted}</span>
                        </p>
                      </div>
                      <button className="mt-4 w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm">
                        Start Counting
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Count Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveCountStockTake(null)}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      &larr; Back
                    </button>
                    <h2 className="text-lg font-semibold">
                      Counting: {activeCountStockTake.referenceNumber}
                    </h2>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        activeCountStockTake.status
                      )}`}
                    >
                      {activeCountStockTake.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activeCountStockTake.outletName} &bull; {activeCountStockTake.conductedBy} &bull;
                    Started {formatDate(activeCountStockTake.startDate)}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <ExportButtons onCSV={handleExportCountCSV} onPDF={handleExportCountPDF} />
                  {activeCountStockTake.status === 'In Progress' && (
                    <button
                      onClick={() => {
                        setShowAddItemModal(true);
                        setAddItemForm({
                          itemId: '',
                          physicalQuantity: 0,
                          discrepancyReason: '',
                          countedBy: activeCountStockTake.conductedBy,
                        });
                        setItemSearchQuery('');
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-semibold whitespace-nowrap"
                    >
                      + Add Item
                    </button>
                  )}
                </div>
              </div>

              {/* Count Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="border border-border rounded-lg p-4 bg-card">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Items Counted</p>
                  <p className="text-2xl font-bold text-foreground">{countSummary.totalItems}</p>
                </div>
                <div className="border border-border rounded-lg p-4 bg-card">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Discrepancies</p>
                  <p className={`text-2xl font-bold ${countSummary.totalDiscrepancies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {countSummary.totalDiscrepancies}
                  </p>
                </div>
                <div className="border border-border rounded-lg p-4 bg-card">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Variance Value</p>
                  <p className={`text-2xl font-bold ${countSummary.totalVariance < 0 ? 'text-red-600' : countSummary.totalVariance > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {formatCurrency(countSummary.totalVariance)}
                  </p>
                </div>
              </div>

              {/* Count Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                <div className="flex-1 w-full sm:max-w-md">
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={countSearch}
                    onChange={e => setCountSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                </div>
                <select
                  value={countCategoryFilter}
                  onChange={e => setCountCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
                >
                  <option value="All">All Categories</option>
                  {countCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Count Items Table */}
              <div className="border border-border rounded-lg bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left p-3 font-semibold whitespace-nowrap">Item</th>
                        <th className="text-left p-3 font-semibold whitespace-nowrap">Category</th>
                        <th className="text-left p-3 font-semibold whitespace-nowrap">Unit</th>
                        <th className="text-right p-3 font-semibold whitespace-nowrap">System Qty</th>
                        <th className="text-right p-3 font-semibold whitespace-nowrap">Physical Qty</th>
                        <th className="text-right p-3 font-semibold whitespace-nowrap">Discrepancy</th>
                        <th className="text-right p-3 font-semibold whitespace-nowrap">Variance (KES)</th>
                        <th className="text-left p-3 font-semibold whitespace-nowrap">Reason</th>
                        <th className="text-left p-3 font-semibold whitespace-nowrap">Counted By</th>
                        {activeCountStockTake.status === 'In Progress' && (
                          <th className="text-right p-3 font-semibold whitespace-nowrap">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCountItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={activeCountStockTake.status === 'In Progress' ? 10 : 9}
                            className="p-8 text-center text-muted-foreground"
                          >
                            No items counted yet. Click &quot;+ Add Item&quot; to start counting.
                          </td>
                        </tr>
                      ) : (
                        paginatedCountItems.map(item => (
                          <tr
                            key={item.id}
                            className={`border-t border-border hover:bg-secondary/30 transition-colors ${
                              item.discrepancy !== 0 ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <td className="p-3 font-medium whitespace-nowrap">{item.itemName}</td>
                            <td className="p-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                {item.itemCategory}
                              </span>
                            </td>
                            <td className="p-3 whitespace-nowrap">{item.unit}</td>
                            <td className="p-3 text-right">{item.systemQuantity}</td>
                            <td className="p-3 text-right font-medium">{item.physicalQuantity}</td>
                            <td className="p-3 text-right">
                              {item.discrepancy !== 0 ? (
                                <span
                                  className={`font-medium ${
                                    item.discrepancy < 0 ? 'text-red-600' : 'text-yellow-600'
                                  }`}
                                >
                                  {item.discrepancy > 0 ? '+' : ''}
                                  {item.discrepancy}
                                </span>
                              ) : (
                                <span className="text-green-600">0</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {item.varianceValue !== 0 ? (
                                <span
                                  className={`font-medium ${
                                    item.varianceValue < 0 ? 'text-red-600' : 'text-yellow-600'
                                  }`}
                                >
                                  {item.varianceValue > 0 ? '+' : ''}
                                  {item.varianceValue.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-green-600">0.00</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap text-xs">
                              {item.discrepancyReason || '-'}
                            </td>
                            <td className="p-3 whitespace-nowrap">{item.countedBy}</td>
                            {activeCountStockTake.status === 'In Progress' && (
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteCountItem(item)}
                                  className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-medium"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={countPage}
                  totalPages={countTotalPages}
                  totalItems={activeCountItems.length}
                  onPageChange={setCountPage}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── STOCK REPORTS TAB ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stock-reports' && (
        <div>
          {/* Report Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Stock Takes</p>
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
                  Completed/Approved
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                {reportSummary.totalStockTakes}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {reportSummary.totalItemsCounted} items counted
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Discrepancies</p>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    reportSummary.totalDiscrepancies > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {reportSummary.totalDiscrepancies} items
                </span>
              </div>
              <p
                className={`text-2xl md:text-3xl font-bold ${
                  reportSummary.totalDiscrepancies > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {reportSummary.totalDiscrepancies}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {reportSummary.totalItemsCounted > 0
                  ? (
                      (reportSummary.totalDiscrepancies / reportSummary.totalItemsCounted) *
                      100
                    ).toFixed(1)
                  : '0'}
                % discrepancy rate
              </p>
            </div>
            <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Variance Value</p>
              </div>
              <p
                className={`text-2xl md:text-3xl font-bold ${
                  reportSummary.totalVarianceValue < 0
                    ? 'text-red-600'
                    : reportSummary.totalVarianceValue > 0
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}
              >
                {formatCurrency(reportSummary.totalVarianceValue)}
              </p>
              <div className="flex gap-4 mt-1">
                <p className="text-xs text-red-500">
                  Shortage: {formatCurrency(Math.abs(reportSummary.negativeVariance))}
                </p>
                <p className="text-xs text-yellow-600">
                  Surplus: {formatCurrency(reportSummary.positiveVariance)}
                </p>
              </div>
            </div>
          </div>

          {/* Variance by Category */}
          {varianceByCategory.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Variance by Category</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {varianceByCategory.map(cat => (
                  <div key={cat.category} className="border border-border rounded-lg p-4 bg-card">
                    <p className="text-sm font-medium text-foreground">{cat.category}</p>
                    <div className="flex items-end justify-between mt-2">
                      <div>
                        <p
                          className={`text-xl font-bold ${
                            cat.variance < 0 ? 'text-red-600' : cat.variance > 0 ? 'text-yellow-600' : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(cat.variance)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cat.count} items / {cat.discrepancies} discrepancies
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-500">
                          {cat.count > 0
                            ? ((cat.discrepancies / cat.count) * 100).toFixed(1)
                            : '0'}
                          %
                        </p>
                        <p className="text-xs text-muted-foreground">discrepancy rate</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Discrepancy Reasons */}
          {discrepancyReasons.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Top Discrepancy Reasons</h2>
              <div className="border border-border rounded-lg bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/50">
                        <th className="text-left p-3 font-semibold">Reason</th>
                        <th className="text-center p-3 font-semibold">Occurrences</th>
                        <th className="text-right p-3 font-semibold">Variance Value (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancyReasons.map(dr => (
                        <tr key={dr.reason} className="border-t border-border">
                          <td className="p-3 font-medium">{dr.reason}</td>
                          <td className="p-3 text-center">{dr.count}</td>
                          <td
                            className={`p-3 text-right font-medium ${
                              dr.variance < 0 ? 'text-red-600' : 'text-yellow-600'
                            }`}
                          >
                            {dr.variance.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Report Filters & History */}
          <div className="mb-4 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Stock Take History</h2>
              <ExportButtons onCSV={handleExportReportsCSV} onPDF={handleExportReportsPDF} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] max-w-md">
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <select
                value={reportOutletFilter}
                onChange={e => setReportOutletFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="All">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={reportDateFrom}
                onChange={e => setReportDateFrom(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
              <input
                type="date"
                value={reportDateTo}
                onChange={e => setReportDateTo(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              />
            </div>
          </div>

          {/* Reports Table */}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50">
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Reference</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Outlet</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Date</th>
                    <th className="text-center p-3 font-semibold whitespace-nowrap">Items Counted</th>
                    <th className="text-center p-3 font-semibold whitespace-nowrap">Discrepancies</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Conducted By</th>
                    <th className="text-left p-3 font-semibold whitespace-nowrap">Approved By</th>
                    <th className="text-right p-3 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        No completed or approved stock takes to display.
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map(st => (
                      <tr key={st.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                        <td className="p-3 font-medium whitespace-nowrap">
                          <button
                            onClick={() => openDetailModal(st)}
                            className="text-primary hover:underline font-semibold"
                          >
                            {st.referenceNumber}
                          </button>
                        </td>
                        <td className="p-3 whitespace-nowrap">{st.outletName || '-'}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(st.status)}`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">{formatDate(st.startDate)}</td>
                        <td className="p-3 text-center">{st.totalItemsCounted}</td>
                        <td className="p-3 text-center">
                          {st.totalDiscrepancies > 0 ? (
                            <span className="text-red-600 font-medium">{st.totalDiscrepancies}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{st.conductedBy}</td>
                        <td className="p-3 whitespace-nowrap">{st.approvedBy || '-'}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openDetailModal(st)}
                            className="px-2 py-1 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100 font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={reportPage}
              totalPages={reportTotalPages}
              totalItems={completedStockTakes.length}
              onPageChange={setReportPage}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* Create Stock Take Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Stock Take" size="lg">
        <form onSubmit={handleCreateStockTake} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Outlet / Branch <span className="text-red-500">*</span>
            </label>
            <select
              value={createForm.outletId}
              onChange={e => setCreateForm({ ...createForm, outletId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              required
            >
              <option value="">Select an outlet...</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.outletType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Conducted By <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createForm.conductedBy}
              onChange={e => setCreateForm({ ...createForm, conductedBy: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              placeholder="Name of person conducting the stock take"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={createForm.notes}
              onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              rows={3}
              placeholder="Optional notes about this stock take..."
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>
              Reference number will be auto-generated (e.g., ST-{new Date().toISOString().split('T')[0].replace(/-/g, '')}-XXXX)
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-semibold"
            >
              Create Stock Take
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Count Item Modal */}
      <Modal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        title="Add Item to Count"
        size="xl"
      >
        <form onSubmit={handleAddCountItem} className="space-y-4">
          {/* Item Search */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Search & Select Item <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={itemSearchQuery}
              onChange={e => setItemSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none mb-2"
              placeholder="Search inventory items by name or category..."
            />
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
              {filteredInventoryForAdd.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">No items found</p>
              ) : (
                filteredInventoryForAdd.map(item => {
                  const alreadyCounted = activeCountStockTake
                    ? stockTakeItems.some(
                        si =>
                          si.stockTakeId === activeCountStockTake.id && si.itemId === item.id
                      )
                    : false;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (!alreadyCounted) {
                          setAddItemForm({ ...addItemForm, itemId: item.id });
                        }
                      }}
                      className={`flex items-center justify-between p-3 border-b border-border last:border-b-0 cursor-pointer text-sm ${
                        addItemForm.itemId === item.id
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : alreadyCounted
                          ? 'bg-gray-100 opacity-60 cursor-not-allowed'
                          : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category} &bull; {item.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {item.quantity} {item.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @ KES {item.unitCost.toFixed(2)}
                        </p>
                        {alreadyCounted && (
                          <span className="text-xs text-yellow-600 font-medium">Already counted</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Item Info */}
          {addItemForm.itemId && (() => {
            const selected = inventoryItems.find(i => i.id === addItemForm.itemId);
            if (!selected) return null;
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">
                  Selected: {selected.name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  System Quantity: {selected.quantity} {selected.unit} | Unit Cost: KES{' '}
                  {selected.unitCost.toFixed(2)}
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Physical Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addItemForm.physicalQuantity}
                onChange={e =>
                  setAddItemForm({ ...addItemForm, physicalQuantity: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="Enter physical count"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Counted By <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={addItemForm.countedBy}
                onChange={e => setAddItemForm({ ...addItemForm, countedBy: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="Name of counter"
                required
              />
            </div>
          </div>

          {/* Auto-calculated discrepancy preview */}
          {addItemForm.itemId && (() => {
            const selected = inventoryItems.find(i => i.id === addItemForm.itemId);
            if (!selected) return null;
            const disc = addItemForm.physicalQuantity - selected.quantity;
            const varVal = disc * selected.unitCost;
            return (
              <div
                className={`rounded-lg p-3 border ${
                  disc === 0
                    ? 'bg-green-50 border-green-200'
                    : disc < 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Discrepancy</p>
                    <p
                      className={`font-bold ${
                        disc === 0 ? 'text-green-700' : disc < 0 ? 'text-red-700' : 'text-yellow-700'
                      }`}
                    >
                      {disc > 0 ? '+' : ''}
                      {disc} {selected.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Variance Value</p>
                    <p
                      className={`font-bold ${
                        varVal === 0 ? 'text-green-700' : varVal < 0 ? 'text-red-700' : 'text-yellow-700'
                      }`}
                    >
                      {varVal > 0 ? '+' : ''}
                      KES {varVal.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p
                      className={`font-bold ${
                        disc === 0 ? 'text-green-700' : disc < 0 ? 'text-red-700' : 'text-yellow-700'
                      }`}
                    >
                      {disc === 0 ? 'Match' : disc < 0 ? 'Shortage' : 'Surplus'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Discrepancy reason */}
          {addItemForm.itemId && (() => {
            const selected = inventoryItems.find(i => i.id === addItemForm.itemId);
            if (!selected) return null;
            const disc = addItemForm.physicalQuantity - selected.quantity;
            if (disc === 0) return null;
            return (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Discrepancy Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={addItemForm.discrepancyReason}
                  onChange={e =>
                    setAddItemForm({ ...addItemForm, discrepancyReason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  required
                >
                  <option value="">Select a reason...</option>
                  {DISCREPANCY_REASONS.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddItemModal(false)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!addItemForm.itemId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Count
            </button>
          </div>
        </form>
      </Modal>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedStockTake(null);
        }}
        title="Approve Stock Take"
        size="md"
      >
        {selectedStockTake && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p>
                <span className="font-medium">Reference:</span> {selectedStockTake.referenceNumber}
              </p>
              <p>
                <span className="font-medium">Outlet:</span> {selectedStockTake.outletName}
              </p>
              <p>
                <span className="font-medium">Conducted By:</span> {selectedStockTake.conductedBy}
              </p>
              <p>
                <span className="font-medium">Items Counted:</span>{' '}
                {selectedStockTake.totalItemsCounted}
              </p>
              <p>
                <span className="font-medium">Discrepancies:</span>{' '}
                <span
                  className={
                    selectedStockTake.totalDiscrepancies > 0 ? 'text-red-600 font-medium' : 'text-green-600'
                  }
                >
                  {selectedStockTake.totalDiscrepancies}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Approved By <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={approvalForm.approvedBy}
                onChange={e => setApprovalForm({ approvedBy: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                placeholder="Enter approver name"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedStockTake(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveStockTake}
                disabled={!approvalForm.approvedBy.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve Stock Take
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedStockTake(null);
        }}
        title={`Stock Take Details - ${selectedStockTake?.referenceNumber || ''}`}
        size="full"
      >
        {selectedStockTake && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Stock Take Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="font-semibold">{selectedStockTake.referenceNumber}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Outlet</p>
                <p className="font-semibold">{selectedStockTake.outletName || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    selectedStockTake.status
                  )}`}
                >
                  {selectedStockTake.status}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Conducted By</p>
                <p className="font-semibold">{selectedStockTake.conductedBy}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-semibold">{formatDate(selectedStockTake.startDate)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="font-semibold">{formatDate(selectedStockTake.endDate)}</p>
              </div>
              {selectedStockTake.approvedBy && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Approved By</p>
                  <p className="font-semibold">{selectedStockTake.approvedBy}</p>
                </div>
              )}
              {selectedStockTake.approvedAt && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Approved At</p>
                  <p className="font-semibold">{formatDate(selectedStockTake.approvedAt)}</p>
                </div>
              )}
              {selectedStockTake.notes && (
                <div className="bg-gray-50 rounded-lg p-3 sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="font-medium text-sm">{selectedStockTake.notes}</p>
                </div>
              )}
            </div>

            {/* Detail Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-border rounded-lg p-4 bg-card">
                <p className="text-sm text-muted-foreground">Items Counted</p>
                <p className="text-xl font-bold">{detailSummary.totalItems}</p>
              </div>
              <div className="border border-border rounded-lg p-4 bg-card">
                <p className="text-sm text-muted-foreground">Discrepancies</p>
                <p
                  className={`text-xl font-bold ${
                    detailSummary.totalDiscrepancies > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {detailSummary.totalDiscrepancies}
                </p>
              </div>
              <div className="border border-border rounded-lg p-4 bg-card">
                <p className="text-sm text-muted-foreground">Total Variance</p>
                <p
                  className={`text-xl font-bold ${
                    detailSummary.totalVarianceValue < 0
                      ? 'text-red-600'
                      : detailSummary.totalVarianceValue > 0
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}
                >
                  {formatCurrency(detailSummary.totalVarianceValue)}
                </p>
              </div>
            </div>

            {/* Detail Items Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left p-3 font-semibold whitespace-nowrap">Item</th>
                      <th className="text-left p-3 font-semibold whitespace-nowrap">Category</th>
                      <th className="text-left p-3 font-semibold whitespace-nowrap">Unit</th>
                      <th className="text-right p-3 font-semibold whitespace-nowrap">System Qty</th>
                      <th className="text-right p-3 font-semibold whitespace-nowrap">Physical Qty</th>
                      <th className="text-right p-3 font-semibold whitespace-nowrap">Discrepancy</th>
                      <th className="text-right p-3 font-semibold whitespace-nowrap">Unit Cost</th>
                      <th className="text-right p-3 font-semibold whitespace-nowrap">Variance (KES)</th>
                      <th className="text-left p-3 font-semibold whitespace-nowrap">Reason</th>
                      <th className="text-left p-3 font-semibold whitespace-nowrap">Counted By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-muted-foreground">
                          No items have been counted in this stock take.
                        </td>
                      </tr>
                    ) : (
                      detailItems.map(item => (
                        <tr
                          key={item.id}
                          className={`border-t border-border ${
                            item.discrepancy !== 0 ? 'bg-red-50/50' : ''
                          }`}
                        >
                          <td className="p-3 font-medium whitespace-nowrap">{item.itemName}</td>
                          <td className="p-3 whitespace-nowrap">{item.itemCategory}</td>
                          <td className="p-3 whitespace-nowrap">{item.unit}</td>
                          <td className="p-3 text-right">{item.systemQuantity}</td>
                          <td className="p-3 text-right font-medium">{item.physicalQuantity}</td>
                          <td className="p-3 text-right">
                            {item.discrepancy !== 0 ? (
                              <span
                                className={`font-medium ${
                                  item.discrepancy < 0 ? 'text-red-600' : 'text-yellow-600'
                                }`}
                              >
                                {item.discrepancy > 0 ? '+' : ''}
                                {item.discrepancy}
                              </span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="p-3 text-right">{item.unitCost.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            {item.varianceValue !== 0 ? (
                              <span
                                className={`font-medium ${
                                  item.varianceValue < 0 ? 'text-red-600' : 'text-yellow-600'
                                }`}
                              >
                                {item.varianceValue > 0 ? '+' : ''}
                                {item.varianceValue.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-green-600">0.00</span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-xs">{item.discrepancyReason || '-'}</td>
                          <td className="p-3 whitespace-nowrap">{item.countedBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
