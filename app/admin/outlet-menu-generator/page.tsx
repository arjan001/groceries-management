'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Download,
  FileText,
  Store,
  Eye,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Printer,
  RefreshCw,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Outlet {
  id: string;
  name: string;
  code: string;
  outlet_type: string;
  address: string;
  city: string;
  phone: string;
  opening_hours: string;
  status: string;
  is_main_branch: boolean;
}

interface MenuItem {
  id: string;
  product_name: string;
  category: string;
  description: string;
  image_url: string;
  retail_price: number;
  is_active: boolean;
  current_stock: number;
}

type QRStyle = 'default' | 'branded' | 'minimal' | 'poster';

// ─── Component ───────────────────────────────────────────────────────────────

export default function OutletMenuGeneratorPage() {
  // ─── State ─────────────────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrStyle, setQrStyle] = useState<QRStyle>('branded');
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#ea580c');
  const [qrFgColor, setQrFgColor] = useState('#000000');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const qrRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const selectedOutlet = outlets.find(o => o.id === selectedOutletId) || null;

  const getMenuUrl = () => {
    if (typeof window === 'undefined' || !selectedOutletId) return '';
    return `${window.location.origin}/menu/${selectedOutletId}`;
  };

  const categories = Array.from(new Set(menuItems.map(m => m.category)));
  const groupedItems = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchOutlets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name, code, outlet_type, address, city, phone, opening_hours, status, is_main_branch')
        .eq('status', 'Active')
        .order('name');
      if (!error && data) {
        setOutlets(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: (r.name || '') as string,
          code: (r.code || '') as string,
          outlet_type: (r.outlet_type || '') as string,
          address: (r.address || '') as string,
          city: (r.city || '') as string,
          phone: (r.phone || '') as string,
          opening_hours: (r.opening_hours || '') as string,
          status: (r.status || '') as string,
          is_main_branch: Boolean(r.is_main_branch),
        })));
      }
    } catch (err) {
      console.error('Fetch outlets error:', err);
    }
    setLoading(false);
  }, []);

  const fetchMenuItems = useCallback(async (outletId: string) => {
    if (!outletId) {
      setMenuItems([]);
      return;
    }
    setLoadingMenu(true);
    try {
      const { data, error } = await supabase
        .from('outlet_products')
        .select('id, product_name, category, description, image_url, retail_price, is_active, current_stock')
        .eq('outlet_id', outletId)
        .eq('is_active', true)
        .order('category')
        .order('product_name');
      if (!error && data) {
        setMenuItems(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          product_name: (r.product_name || '') as string,
          category: (r.category || 'General') as string,
          description: (r.description || '') as string,
          image_url: (r.image_url || '') as string,
          retail_price: (r.retail_price || 0) as number,
          is_active: Boolean(r.is_active),
          current_stock: (r.current_stock || 0) as number,
        })));
      }
    } catch (err) {
      console.error('Fetch menu items error:', err);
    }
    setLoadingMenu(false);
  }, []);

  const fetchBranding = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'general')
        .single();
      if (!error && data?.value) {
        const g = data.value as Record<string, string>;
        if (g.businessName) setBusinessName(g.businessName);
        if (g.logoUrl) setLogoUrl(g.logoUrl);
        if (g.primaryColor) setThemeColor(g.primaryColor);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchOutlets();
    fetchBranding();
  }, [fetchOutlets, fetchBranding]);

  // Auto-select outlet from URL query parameter
  useEffect(() => {
    const outletParam = searchParams.get('outlet');
    if (outletParam && outlets.length > 0 && !selectedOutletId) {
      const exists = outlets.find(o => o.id === outletParam);
      if (exists) setSelectedOutletId(outletParam);
    }
  }, [searchParams, outlets, selectedOutletId]);

  useEffect(() => {
    if (selectedOutletId) fetchMenuItems(selectedOutletId);
  }, [selectedOutletId, fetchMenuItems]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const copyMenuLink = async () => {
    const url = getMenuUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Menu link copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const downloadQrCode = async () => {
    if (!qrRef.current) return;
    setGenerating(true);
    try {
      const svgElement = qrRef.current.querySelector('svg');
      if (!svgElement) throw new Error('QR code not found');

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const img = new window.Image();
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `menu-qr-${selectedOutlet?.name?.replace(/\s+/g, '-').toLowerCase() || 'outlet'}.png`;
        link.href = pngUrl;
        link.click();
        showToast('QR code downloaded as PNG', 'success');
        setGenerating(false);
      };
      img.onerror = () => {
        showToast('Failed to generate QR image', 'error');
        setGenerating(false);
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (err) {
      console.error('Download QR error:', err);
      showToast('Failed to download QR code', 'error');
      setGenerating(false);
    }
  };

  const downloadQrPoster = async () => {
    if (!qrRef.current) return;
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const options = {
        margin: 0,
        filename: `menu-qr-poster-${selectedOutlet?.name?.replace(/\s+/g, '-').toLowerCase() || 'outlet'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true },
        jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const },
      };
      await html2pdf().set(options).from(qrRef.current).save();
      showToast('QR poster downloaded as PDF', 'success');
    } catch (err) {
      console.error('Download poster error:', err);
      showToast('Failed to download poster', 'error');
    }
    setGenerating(false);
  };

  const downloadMenuPdf = async () => {
    if (!pdfRef.current) return;
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const options = {
        margin: 10,
        filename: `menu-${selectedOutlet?.name?.replace(/\s+/g, '-').toLowerCase() || 'outlet'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const },
      };
      await html2pdf().set(options).from(pdfRef.current).save();
      showToast('Menu PDF downloaded successfully', 'success');
    } catch (err) {
      console.error('Download PDF error:', err);
      // Fallback to print
      window.print();
      showToast('PDF generation failed — print dialog opened as fallback', 'error');
    }
    setGenerating(false);
  };

  const printMenu = () => {
    if (!pdfRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('Please allow popups to print the menu', 'error');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Menu - ${selectedOutlet?.name || 'Outlet'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; }
            ${pdfRef.current.querySelector('style')?.textContent || ''}
          </style>
        </head>
        <body>${pdfRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  // ─── Render ────────────────────────────────────────────────────────────────

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
          <QrCode className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">Menu Generator</h1>
        </div>
        <p className="text-muted-foreground">
          Generate QR codes and downloadable PDF menus for your outlets. Customers can scan the QR code to view the live, dynamic menu for each branch.
        </p>
      </div>

      {/* Outlet Selector */}
      <div className="border border-border rounded-lg p-6 bg-card mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Select Outlet</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading outlets...
          </div>
        ) : outlets.length === 0 ? (
          <div className="text-center py-8">
            <Store className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No active outlets found. Create an outlet first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {outlets.map(outlet => (
              <button
                key={outlet.id}
                onClick={() => setSelectedOutletId(outlet.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedOutletId === outlet.id
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Store className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold truncate">{outlet.name}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {outlet.city || outlet.address || outlet.code}
                </p>
                {outlet.is_main_branch && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">
                    Main Branch
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content - only when outlet is selected */}
      {selectedOutlet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ─── Left: QR Code Generator ─── */}
          <div className="space-y-6">
            {/* QR Code Style Selector */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">QR Code Style</h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {([
                  { key: 'default', label: 'Classic', icon: QrCode },
                  { key: 'branded', label: 'Branded', icon: Palette },
                  { key: 'minimal', label: 'Minimal', icon: ImageIcon },
                  { key: 'poster', label: 'Poster', icon: FileText },
                ] as const).map(style => (
                  <button
                    key={style.key}
                    onClick={() => setQrStyle(style.key)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      qrStyle === style.key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <style.icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <span className="text-xs font-medium">{style.label}</span>
                  </button>
                ))}
              </div>

              {/* QR Color Picker */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">QR Color:</label>
                <input
                  type="color"
                  value={qrFgColor}
                  onChange={e => setQrFgColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-border"
                />
                <button
                  onClick={() => setQrFgColor('#000000')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* QR Code Preview */}
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">QR Code Preview</h2>
                <div className="flex gap-2">
                  <button
                    onClick={downloadQrCode}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PNG
                  </button>
                  <button
                    onClick={downloadQrPoster}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Poster PDF
                  </button>
                </div>
              </div>

              <div ref={qrRef} className="p-8 flex flex-col items-center bg-white">
                {qrStyle === 'poster' ? (
                  /* Full poster layout */
                  <div className="w-full max-w-sm mx-auto text-center space-y-5 py-4">
                    {logoUrl ? (
                      <img src={logoUrl} alt={businessName} className="h-10 mx-auto object-contain" />
                    ) : businessName ? (
                      <h3 className="text-xl font-black" style={{ color: themeColor }}>{businessName}</h3>
                    ) : null}
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">{selectedOutlet.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">Scan to view our menu</p>
                    </div>
                    <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border-2" style={{ borderColor: themeColor }}>
                      <QRCodeSVG
                        value={getMenuUrl()}
                        size={200}
                        fgColor={qrFgColor}
                        bgColor="#ffffff"
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <div className="space-y-1">
                      {selectedOutlet.address && (
                        <p className="text-xs text-gray-500">{selectedOutlet.address}{selectedOutlet.city ? `, ${selectedOutlet.city}` : ''}</p>
                      )}
                      {selectedOutlet.phone && (
                        <p className="text-xs text-gray-500">Tel: {selectedOutlet.phone}</p>
                      )}
                      {selectedOutlet.opening_hours && (
                        <p className="text-xs text-gray-500">Hours: {selectedOutlet.opening_hours}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400">Point your camera at the QR code to view menu</p>
                    </div>
                  </div>
                ) : qrStyle === 'branded' ? (
                  /* Branded with colors */
                  <div className="text-center space-y-4">
                    <div className="px-4 py-2 rounded-full text-white text-xs font-bold" style={{ backgroundColor: themeColor }}>
                      {selectedOutlet.name}
                    </div>
                    <QRCodeSVG
                      value={getMenuUrl()}
                      size={220}
                      fgColor={qrFgColor}
                      bgColor="#ffffff"
                      level="H"
                      includeMargin
                    />
                    <p className="text-sm text-gray-600 font-medium">Scan for Menu</p>
                  </div>
                ) : qrStyle === 'minimal' ? (
                  /* Minimal clean */
                  <div className="text-center space-y-3">
                    <QRCodeSVG
                      value={getMenuUrl()}
                      size={200}
                      fgColor={qrFgColor}
                      bgColor="#ffffff"
                      level="M"
                      includeMargin={false}
                    />
                    <p className="text-xs text-gray-400">{selectedOutlet.name}</p>
                  </div>
                ) : (
                  /* Default */
                  <div className="text-center space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">{selectedOutlet.name}</h3>
                    <QRCodeSVG
                      value={getMenuUrl()}
                      size={220}
                      fgColor={qrFgColor}
                      bgColor="#ffffff"
                      level="H"
                      includeMargin
                    />
                    <p className="text-sm text-gray-500">Scan to view menu</p>
                  </div>
                )}
              </div>
            </div>

            {/* Menu Link */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Menu Link</h2>
              <div className="flex gap-2">
                <div className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm font-mono text-muted-foreground truncate">
                  {getMenuUrl()}
                </div>
                <button
                  onClick={copyMenuLink}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <a
                  href={getMenuUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open
                </a>
              </div>
            </div>
          </div>

          {/* ─── Right: Menu Preview & PDF ─── */}
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Menu Preview</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {menuItems.length} active item{menuItems.length !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadMenuPdf}
                    disabled={generating || menuItems.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    onClick={printMenu}
                    disabled={menuItems.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <a
                    href={getMenuUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Live View
                  </a>
                </div>
              </div>
            </div>

            {/* PDF-able Menu Preview */}
            <div className="border border-border rounded-lg bg-white overflow-hidden shadow-sm">
              {loadingMenu ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading menu items...
                </div>
              ) : menuItems.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground font-medium">No menu items</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add products to this outlet from the <strong>Outlet Products</strong> page.
                  </p>
                </div>
              ) : (
                <div ref={pdfRef}>
                  <style>{`
                    .menu-pdf-content { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; }
                    .menu-pdf-header { padding: 24px 28px; text-align: center; color: white; }
                    .menu-pdf-category { padding: 10px 28px 6px; font-size: 16px; font-weight: 700; border-bottom: 2px solid #eee; margin-top: 8px; }
                    .menu-pdf-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 28px; border-bottom: 1px solid #f5f5f5; }
                    .menu-pdf-item-name { font-size: 14px; font-weight: 600; }
                    .menu-pdf-item-desc { font-size: 11px; color: #888; margin-top: 2px; }
                    .menu-pdf-item-price { font-size: 14px; font-weight: 700; white-space: nowrap; }
                    .menu-pdf-footer { padding: 16px 28px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; }
                  `}</style>
                  <div className="menu-pdf-content">
                    {/* PDF Header */}
                    <div className="menu-pdf-header" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
                      {logoUrl && (
                        <img src={logoUrl} alt={businessName} style={{ height: '36px', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }} />
                      )}
                      <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        {selectedOutlet.name}
                      </div>
                      {selectedOutlet.address && (
                        <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '4px' }}>
                          {selectedOutlet.address}{selectedOutlet.city ? `, ${selectedOutlet.city}` : ''}
                        </div>
                      )}
                      {selectedOutlet.phone && (
                        <div style={{ fontSize: '11px', opacity: 0.85 }}>
                          Tel: {selectedOutlet.phone}
                        </div>
                      )}
                    </div>

                    {/* Menu Items by Category */}
                    {Object.entries(groupedItems).map(([category, items]) => (
                      <div key={category}>
                        <div className="menu-pdf-category" style={{ color: themeColor }}>
                          {category}
                        </div>
                        {items.map(item => (
                          <div key={item.id} className="menu-pdf-item">
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                              <div className="menu-pdf-item-name">{item.product_name}</div>
                              {item.description && (
                                <div className="menu-pdf-item-desc">{item.description}</div>
                              )}
                            </div>
                            <div className="menu-pdf-item-price" style={{ color: themeColor }}>
                              KES {item.retail_price.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Footer */}
                    <div className="menu-pdf-footer">
                      {businessName && <span>{businessName} &middot; </span>}
                      {selectedOutlet.name}
                      {selectedOutlet.opening_hours && <span> &middot; {selectedOutlet.opening_hours}</span>}
                      <br />
                      Prices are in Kenya Shillings (KES). Menu items subject to availability.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no outlet selected */}
      {!selectedOutlet && !loading && outlets.length > 0 && (
        <div className="border border-dashed border-border rounded-xl p-16 text-center">
          <QrCode className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Select an Outlet</h3>
          <p className="text-sm text-muted-foreground mt-1">Choose an outlet above to generate its QR code and menu PDF.</p>
        </div>
      )}
    </div>
  );
}
