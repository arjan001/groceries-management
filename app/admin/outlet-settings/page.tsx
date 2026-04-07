'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import {
  Settings,
  Receipt,
  Monitor,
  ShoppingCart,
  Bell,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  ChevronDown,
  Store,
  Printer,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  is_main_branch: boolean;
  status: string;
  address: string;
  phone: string;
  email: string;
}

interface OutletSetting {
  id: string;
  outlet_id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
  updated_by: string;
}

interface ReceiptSettings {
  headerText: string;
  subHeaderText: string;
  footerText: string;
  disclaimer: string;
  showLogo: boolean;
  showTax: boolean;
  showCashier: boolean;
  showPaymentDetails: boolean;
  paperWidth: '58mm' | '80mm';
}

interface DisplaySettings {
  currencySymbol: string;
  dateFormat: string;
  themePreference: 'light' | 'dark' | 'system';
  itemsPerPage: number;
}

interface PosSettings {
  defaultSaleType: 'Retail' | 'Wholesale';
  allowCreditSales: boolean;
  requireCustomerForCredit: boolean;
  autoPrintReceipt: boolean;
  posPinRequired: boolean;
  openingBalanceRequired: boolean;
  shiftNotesRequired: boolean;
}

interface NotificationSettings {
  lowStockAlerts: boolean;
  lowStockThreshold: number;
  freshnessExpiryAlerts: boolean;
  daysBeforeFreshnessAlert: number;
  dailySalesSummary: boolean;
  wasteReportReminders: boolean;
}

type SettingsTab = 'receipt' | 'display' | 'pos' | 'notifications';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_RECEIPT: ReceiptSettings = {
  headerText: '',
  subHeaderText: '',
  footerText: '',
  disclaimer: 'Goods once sold are not returnable',
  showLogo: true,
  showTax: true,
  showCashier: true,
  showPaymentDetails: true,
  paperWidth: '80mm',
};

const DEFAULT_DISPLAY: DisplaySettings = {
  currencySymbol: 'KES',
  dateFormat: 'DD/MM/YYYY',
  themePreference: 'system',
  itemsPerPage: 20,
};

const DEFAULT_POS: PosSettings = {
  defaultSaleType: 'Retail',
  allowCreditSales: false,
  requireCustomerForCredit: true,
  autoPrintReceipt: true,
  posPinRequired: true,
  openingBalanceRequired: true,
  shiftNotesRequired: false,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  lowStockAlerts: true,
  lowStockThreshold: 10,
  freshnessExpiryAlerts: true,
  daysBeforeFreshnessAlert: 1,
  dailySalesSummary: false,
  wasteReportReminders: false,
};

// ─── Toggle Component ────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            checked ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium group-hover:text-foreground">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OutletSettingsPage() {
  // ─── State ──────────────────────────────────────────────────────────────
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('receipt');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Settings state
  const [receipt, setReceipt] = useState<ReceiptSettings>({ ...DEFAULT_RECEIPT });
  const [display, setDisplay] = useState<DisplaySettings>({ ...DEFAULT_DISPLAY });
  const [pos, setPos] = useState<PosSettings>({ ...DEFAULT_POS });
  const [notifications, setNotifications] = useState<NotificationSettings>({ ...DEFAULT_NOTIFICATIONS });

  // ─── Toast ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── Selected outlet helper ─────────────────────────────────────────────
  const selectedOutlet = outlets.find(o => o.id === selectedOutletId) || null;

  // ─── Resolve effective receipt values (defaults from outlet data) ───────
  const effectiveReceipt = {
    ...receipt,
    headerText: receipt.headerText || selectedOutlet?.name || 'Branch Name',
    subHeaderText: receipt.subHeaderText || selectedOutlet?.address || 'Branch Address',
    footerText: receipt.footerText || (selectedOutlet ? `Thank you for visiting our ${selectedOutlet.name} branch!` : 'Thank you for your visit!'),
  };

  // ─── Fetch outlets ──────────────────────────────────────────────────────
  const fetchOutlets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, code, outlet_type, is_main_branch, status, address, phone, email')
        .eq('status', 'Active')
        .order('is_main_branch', { ascending: false })
        .order('name', { ascending: true });
      if (error) {
        showToast('Failed to load outlets: ' + error.message, 'error');
        setOutlets([]);
      } else {
        const mapped = (data || []) as Outlet[];
        setOutlets(mapped);
      }
    } catch (err) {
      console.error('Fetch outlets error:', err);
      setOutlets([]);
    }
  }, []);

  // ─── Load settings for selected outlet ──────────────────────────────────
  const loadSettings = useCallback(async (outletId: string) => {
    if (!outletId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlet_settings')
        .select('*')
        .eq('outlet_id', outletId);

      if (error) {
        console.error('Load settings error:', error.message);
        // Apply defaults
        setReceipt({ ...DEFAULT_RECEIPT });
        setDisplay({ ...DEFAULT_DISPLAY });
        setPos({ ...DEFAULT_POS });
        setNotifications({ ...DEFAULT_NOTIFICATIONS });
      } else {
        const settings = (data || []) as OutletSetting[];
        const receiptSetting = settings.find(s => s.key === 'receipt');
        const displaySetting = settings.find(s => s.key === 'display');
        const posSetting = settings.find(s => s.key === 'pos');
        const notifSetting = settings.find(s => s.key === 'notifications');

        setReceipt(receiptSetting ? { ...DEFAULT_RECEIPT, ...(receiptSetting.value as unknown as Partial<ReceiptSettings>) } : { ...DEFAULT_RECEIPT });
        setDisplay(displaySetting ? { ...DEFAULT_DISPLAY, ...(displaySetting.value as unknown as Partial<DisplaySettings>) } : { ...DEFAULT_DISPLAY });
        setPos(posSetting ? { ...DEFAULT_POS, ...(posSetting.value as unknown as Partial<PosSettings>) } : { ...DEFAULT_POS });
        setNotifications(notifSetting ? { ...DEFAULT_NOTIFICATIONS, ...(notifSetting.value as unknown as Partial<NotificationSettings>) } : { ...DEFAULT_NOTIFICATIONS });
      }
    } catch (err) {
      console.error('Load settings error:', err);
      setReceipt({ ...DEFAULT_RECEIPT });
      setDisplay({ ...DEFAULT_DISPLAY });
      setPos({ ...DEFAULT_POS });
      setNotifications({ ...DEFAULT_NOTIFICATIONS });
    }
    setLoading(false);
  }, []);

  // ─── Save settings for current tab ──────────────────────────────────────
  const saveCurrentTab = async () => {
    if (!selectedOutletId) {
      showToast('Please select an outlet first', 'error');
      return;
    }

    setSaving(true);
    try {
      let settingsKey: string;
      let settingsValue: Record<string, unknown>;

      switch (activeTab) {
        case 'receipt':
          settingsKey = 'receipt';
          settingsValue = receipt as unknown as Record<string, unknown>;
          break;
        case 'display':
          settingsKey = 'display';
          settingsValue = display as unknown as Record<string, unknown>;
          break;
        case 'pos':
          settingsKey = 'pos';
          settingsValue = pos as unknown as Record<string, unknown>;
          break;
        case 'notifications':
          settingsKey = 'notifications';
          settingsValue = notifications as unknown as Record<string, unknown>;
          break;
        default:
          setSaving(false);
          return;
      }

      // Check if setting exists
      const { data: existing } = await supabase
        .from('outlet_settings')
        .select('id')
        .eq('outlet_id', selectedOutletId)
        .eq('key', settingsKey)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('outlet_settings')
          .update({
            value: settingsValue,
            updated_at: new Date().toISOString(),
            updated_by: 'admin',
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('outlet_settings')
          .insert({
            outlet_id: selectedOutletId,
            key: settingsKey,
            value: settingsValue,
            updated_at: new Date().toISOString(),
            updated_by: 'admin',
          });
        if (error) throw error;
      }

      showToast(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings saved successfully`, 'success');
      logAudit({
        action: 'UPDATE',
        module: 'Outlet Settings',
        record_id: selectedOutletId,
        details: { outlet: selectedOutlet?.name, tab: activeTab },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to save settings: ${msg}`, 'error');
      console.error('Save settings error:', err);
    }
    setSaving(false);
  };

  // ─── Reset current tab to defaults ──────────────────────────────────────
  const resetCurrentTab = () => {
    switch (activeTab) {
      case 'receipt':
        setReceipt({ ...DEFAULT_RECEIPT });
        break;
      case 'display':
        setDisplay({ ...DEFAULT_DISPLAY });
        break;
      case 'pos':
        setPos({ ...DEFAULT_POS });
        break;
      case 'notifications':
        setNotifications({ ...DEFAULT_NOTIFICATIONS });
        break;
    }
    showToast('Settings reset to defaults. Click Save to persist the changes.', 'success');
  };

  // ─── Effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  // Auto-select first outlet once outlets are loaded
  useEffect(() => {
    if (outlets.length > 0 && !selectedOutletId) {
      setSelectedOutletId(outlets[0].id);
    }
  }, [outlets, selectedOutletId]);

  useEffect(() => {
    if (selectedOutletId) {
      loadSettings(selectedOutletId);
    }
  }, [selectedOutletId, loadSettings]);

  // ─── Shared CSS classes ─────────────────────────────────────────────────
  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background';
  const labelCls = 'block text-xs text-muted-foreground mb-1 font-medium';
  const sectionCls = 'border border-border rounded-lg p-6 bg-card';

  // ─── Tab definitions ────────────────────────────────────────────────────
  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'receipt', label: 'Receipt', icon: <Receipt className="w-4 h-4" /> },
    { key: 'display', label: 'Display', icon: <Monitor className="w-4 h-4" /> },
    { key: 'pos', label: 'POS', icon: <ShoppingCart className="w-4 h-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────
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
          <Settings className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Branch Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure branch-specific settings for receipts, display preferences, POS behavior, and notifications. Each outlet can customize these settings independently.
        </p>
      </div>

      {/* Outlet Selector */}
      <div className="mb-6">
        <div className={sectionCls}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              <label className="text-sm font-medium">Select Branch:</label>
            </div>
            <div className="relative flex-1 max-w-sm">
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className={`${inputCls} appearance-none pr-10`}
              >
                <option value="">-- Select an outlet --</option>
                {outlets.map(outlet => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code}){outlet.is_main_branch ? ' - Main Branch' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {selectedOutlet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${selectedOutlet.is_main_branch ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {selectedOutlet.is_main_branch ? 'Main Branch' : selectedOutlet.outlet_type}
                </span>
                {selectedOutlet.phone && <span>{selectedOutlet.phone}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {!selectedOutletId ? (
        <div className="text-center py-16 border border-border rounded-lg bg-card">
          <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Select a branch to configure</p>
          <p className="text-sm text-muted-foreground mt-1">Choose an outlet from the dropdown above to manage its settings.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading settings...</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Receipt Settings Tab ── */}
          {activeTab === 'receipt' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Settings Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Header & Footer */}
                <div className={sectionCls}>
                  <h3 className="font-semibold mb-4">Receipt Text</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Header Text</label>
                      <input
                        type="text"
                        value={receipt.headerText}
                        onChange={e => setReceipt({ ...receipt, headerText: e.target.value })}
                        className={inputCls}
                        placeholder={selectedOutlet?.name || 'Branch Name'}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Defaults to outlet name if left empty</p>
                    </div>
                    <div>
                      <label className={labelCls}>Sub-Header Text</label>
                      <input
                        type="text"
                        value={receipt.subHeaderText}
                        onChange={e => setReceipt({ ...receipt, subHeaderText: e.target.value })}
                        className={inputCls}
                        placeholder={selectedOutlet?.address || 'Branch Address'}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Defaults to outlet address if left empty</p>
                    </div>
                    <div>
                      <label className={labelCls}>Footer Text</label>
                      <input
                        type="text"
                        value={receipt.footerText}
                        onChange={e => setReceipt({ ...receipt, footerText: e.target.value })}
                        className={inputCls}
                        placeholder={selectedOutlet ? `Thank you for visiting our ${selectedOutlet.name} branch!` : 'Thank you for your visit!'}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Disclaimer Text</label>
                      <input
                        type="text"
                        value={receipt.disclaimer}
                        onChange={e => setReceipt({ ...receipt, disclaimer: e.target.value })}
                        className={inputCls}
                        placeholder="Goods once sold are not returnable"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className={sectionCls}>
                  <h3 className="font-semibold mb-4">Receipt Options</h3>
                  <div className="space-y-4">
                    <Toggle
                      checked={receipt.showLogo}
                      onChange={val => setReceipt({ ...receipt, showLogo: val })}
                      label="Show Logo"
                      description="Display the business logo at the top of the receipt"
                    />
                    <Toggle
                      checked={receipt.showTax}
                      onChange={val => setReceipt({ ...receipt, showTax: val })}
                      label="Show Tax Breakdown"
                      description="Display tax amount and rate on the receipt"
                    />
                    <Toggle
                      checked={receipt.showCashier}
                      onChange={val => setReceipt({ ...receipt, showCashier: val })}
                      label="Show Cashier Name"
                      description="Print the name of the cashier who processed the sale"
                    />
                    <Toggle
                      checked={receipt.showPaymentDetails}
                      onChange={val => setReceipt({ ...receipt, showPaymentDetails: val })}
                      label="Show Payment Details"
                      description="Display payment method and reference information"
                    />
                  </div>
                </div>

                {/* Paper Width */}
                <div className={sectionCls}>
                  <h3 className="font-semibold mb-4">Paper Settings</h3>
                  <div>
                    <label className={labelCls}>Paper Width</label>
                    <select
                      value={receipt.paperWidth}
                      onChange={e => setReceipt({ ...receipt, paperWidth: e.target.value as '58mm' | '80mm' })}
                      className={`${inputCls} max-w-xs`}
                    >
                      <option value="58mm">58mm (Narrow)</option>
                      <option value="80mm">80mm (Standard)</option>
                    </select>
                  </div>
                </div>

                {/* Save / Reset Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveCurrentTab}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Receipt Settings'}
                  </button>
                  <button
                    onClick={resetCurrentTab}
                    className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset to Defaults
                  </button>
                </div>
              </div>

              {/* Receipt Preview Column */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Printer className="w-4 h-4" />
                      Receipt Preview
                    </h3>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPreview ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showPreview && (
                    <div
                      className="border-2 border-dashed border-border rounded-lg bg-white p-4 shadow-sm"
                      style={{
                        maxWidth: receipt.paperWidth === '58mm' ? '220px' : '300px',
                        fontFamily: '"Courier New", Courier, monospace',
                      }}
                    >
                      {/* Logo placeholder */}
                      {effectiveReceipt.showLogo && (
                        <div className="text-center mb-2">
                          <div className="w-10 h-10 bg-gray-200 rounded mx-auto flex items-center justify-center text-xs text-gray-500 font-bold">
                            LOGO
                          </div>
                        </div>
                      )}

                      {/* Header */}
                      <div className="text-center mb-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
                          {effectiveReceipt.headerText}
                        </p>
                        <p className="text-[10px] text-gray-600">{effectiveReceipt.subHeaderText}</p>
                        {selectedOutlet?.phone && (
                          <p className="text-[10px] text-gray-600">Tel: {selectedOutlet.phone}</p>
                        )}
                      </div>

                      {/* Dashed separator */}
                      <div className="border-t border-dashed border-gray-400 my-2" />

                      {/* Receipt info */}
                      <div className="text-[10px] text-gray-700 space-y-0.5 mb-2">
                        <div className="flex justify-between">
                          <span>Receipt #:</span>
                          <span>RCP-001234</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span>23/02/2026 14:30</span>
                        </div>
                        {effectiveReceipt.showCashier && (
                          <div className="flex justify-between">
                            <span>Cashier:</span>
                            <span>Jane D.</span>
                          </div>
                        )}
                      </div>

                      {/* Dashed separator */}
                      <div className="border-t border-dashed border-gray-400 my-2" />

                      {/* Items */}
                      <div className="text-[10px] text-gray-800 space-y-1 mb-2">
                        <div className="flex justify-between">
                          <span>Chocolate Cake x1</span>
                          <span>850.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Croissant x3</span>
                          <span>450.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Coffee (Latte) x2</span>
                          <span>600.00</span>
                        </div>
                      </div>

                      {/* Dashed separator */}
                      <div className="border-t border-dashed border-gray-400 my-2" />

                      {/* Totals */}
                      <div className="text-[10px] text-gray-800 space-y-0.5 mb-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>1,900.00</span>
                        </div>
                        {effectiveReceipt.showTax && (
                          <div className="flex justify-between">
                            <span>VAT (16%):</span>
                            <span>304.00</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>TOTAL:</span>
                          <span>{effectiveReceipt.showTax ? '2,204.00' : '1,900.00'}</span>
                        </div>
                      </div>

                      {/* Payment Details */}
                      {effectiveReceipt.showPaymentDetails && (
                        <>
                          <div className="border-t border-dashed border-gray-400 my-2" />
                          <div className="text-[10px] text-gray-700 space-y-0.5 mb-2">
                            <div className="flex justify-between">
                              <span>Payment:</span>
                              <span>M-Pesa</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Ref:</span>
                              <span>SLK3M9XP2Q</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Dashed separator */}
                      <div className="border-t border-dashed border-gray-400 my-2" />

                      {/* Footer */}
                      <div className="text-center text-[10px] text-gray-600 space-y-1">
                        <p>{effectiveReceipt.footerText}</p>
                        {effectiveReceipt.disclaimer && (
                          <p className="text-[9px] italic text-gray-500">{effectiveReceipt.disclaimer}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Display Settings Tab ── */}
          {activeTab === 'display' && (
            <div className="max-w-2xl space-y-6">
              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Regional Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Currency Symbol</label>
                    <select
                      value={display.currencySymbol}
                      onChange={e => setDisplay({ ...display, currencySymbol: e.target.value })}
                      className={inputCls}
                    >
                      <option value="KES">KES (Kenyan Shilling)</option>
                      <option value="TZS">TZS (Tanzanian Shilling)</option>
                      <option value="UGX">UGX (Ugandan Shilling)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Date Format</label>
                    <select
                      value={display.dateFormat}
                      onChange={e => setDisplay({ ...display, dateFormat: e.target.value })}
                      className={inputCls}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Appearance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Theme Preference</label>
                    <select
                      value={display.themePreference}
                      onChange={e => setDisplay({ ...display, themePreference: e.target.value as 'light' | 'dark' | 'system' })}
                      className={inputCls}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System Default</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Items Per Page</label>
                    <select
                      value={display.itemsPerPage}
                      onChange={e => setDisplay({ ...display, itemsPerPage: parseInt(e.target.value) })}
                      className={inputCls}
                    >
                      <option value={10}>10 items</option>
                      <option value={20}>20 items</option>
                      <option value={50}>50 items</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Save / Reset Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveCurrentTab}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Display Settings'}
                </button>
                <button
                  onClick={resetCurrentTab}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}

          {/* ── POS Settings Tab ── */}
          {activeTab === 'pos' && (
            <div className="max-w-2xl space-y-6">
              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Sale Defaults</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Default Sale Type</label>
                    <select
                      value={pos.defaultSaleType}
                      onChange={e => setPos({ ...pos, defaultSaleType: e.target.value as 'Retail' | 'Wholesale' })}
                      className={`${inputCls} max-w-xs`}
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">The default pricing mode when a new sale is started</p>
                  </div>
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Credit Sales</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={pos.allowCreditSales}
                    onChange={val => setPos({ ...pos, allowCreditSales: val })}
                    label="Allow Credit Sales"
                    description="Enable selling on credit at this branch"
                  />
                  {pos.allowCreditSales && (
                    <Toggle
                      checked={pos.requireCustomerForCredit}
                      onChange={val => setPos({ ...pos, requireCustomerForCredit: val })}
                      label="Require Customer for Credit Sales"
                      description="A customer must be selected before a credit sale can be processed"
                    />
                  )}
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">POS Behavior</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={pos.autoPrintReceipt}
                    onChange={val => setPos({ ...pos, autoPrintReceipt: val })}
                    label="Auto-Print Receipt"
                    description="Automatically print receipt after completing a sale"
                  />
                  <Toggle
                    checked={pos.posPinRequired}
                    onChange={val => setPos({ ...pos, posPinRequired: val })}
                    label="POS PIN Required"
                    description="Require cashier to enter their PIN to access the POS"
                  />
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Shift Management</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={pos.openingBalanceRequired}
                    onChange={val => setPos({ ...pos, openingBalanceRequired: val })}
                    label="Opening Balance Required"
                    description="Cashier must enter the cash drawer opening balance to start their shift"
                  />
                  <Toggle
                    checked={pos.shiftNotesRequired}
                    onChange={val => setPos({ ...pos, shiftNotesRequired: val })}
                    label="Shift Notes Required"
                    description="Require cashier to add notes when ending their shift"
                  />
                </div>
              </div>

              {/* Save / Reset Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveCurrentTab}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save POS Settings'}
                </button>
                <button
                  onClick={resetCurrentTab}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}

          {/* ── Notifications Settings Tab ── */}
          {activeTab === 'notifications' && (
            <div className="max-w-2xl space-y-6">
              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Stock Alerts</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={notifications.lowStockAlerts}
                    onChange={val => setNotifications({ ...notifications, lowStockAlerts: val })}
                    label="Low Stock Alerts"
                    description="Get notified when inventory items fall below the threshold"
                  />
                  {notifications.lowStockAlerts && (
                    <div className="ml-12">
                      <label className={labelCls}>Low Stock Threshold</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={notifications.lowStockThreshold}
                        onChange={e => setNotifications({ ...notifications, lowStockThreshold: parseInt(e.target.value) || 10 })}
                        className={`${inputCls} max-w-[180px]`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Alert when stock falls below this quantity</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Freshness Tracking</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={notifications.freshnessExpiryAlerts}
                    onChange={val => setNotifications({ ...notifications, freshnessExpiryAlerts: val })}
                    label="Freshness Expiry Alerts"
                    description="Get notified before products reach their freshness expiry"
                  />
                  {notifications.freshnessExpiryAlerts && (
                    <div className="ml-12">
                      <label className={labelCls}>Days Before Alert</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={notifications.daysBeforeFreshnessAlert}
                        onChange={e => setNotifications({ ...notifications, daysBeforeFreshnessAlert: parseInt(e.target.value) || 1 })}
                        className={`${inputCls} max-w-[180px]`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">How many days before expiry to send the alert</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={sectionCls}>
                <h3 className="font-semibold mb-4">Reports & Reminders</h3>
                <div className="space-y-4">
                  <Toggle
                    checked={notifications.dailySalesSummary}
                    onChange={val => setNotifications({ ...notifications, dailySalesSummary: val })}
                    label="Daily Sales Summary"
                    description="Receive a daily summary of sales performance for this branch"
                  />
                  <Toggle
                    checked={notifications.wasteReportReminders}
                    onChange={val => setNotifications({ ...notifications, wasteReportReminders: val })}
                    label="Waste Report Reminders"
                    description="Remind staff to submit waste/spoilage reports at the end of the day"
                  />
                </div>
              </div>

              {/* Save / Reset Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveCurrentTab}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Notification Settings'}
                </button>
                <button
                  onClick={resetCurrentTab}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
