'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { MapPin, Search, Loader2, FileDown } from 'lucide-react';
import { logAudit } from '@/lib/audit-logger';

interface Customer {
  id: string;
  name: string;
  type: 'Retail' | 'Wholesale' | 'Individual';
  phone: string;
  email: string;
  location: string;
  address: string;
  gpsLat: number;
  gpsLng: number;
  creditLimit: number;
  purchaseVolume: number;
  rating: number;
  status: string;
  notes: string;
  landmark: string;
  deliveryInstructions: string;
}

const emptyForm = {
  name: '',
  type: 'Retail' as Customer['type'],
  phone: '',
  email: '',
  location: '',
  address: '',
  gpsLat: 0,
  gpsLng: 0,
  creditLimit: 0,
  purchaseVolume: 0,
  rating: 5,
  status: 'Active',
  notes: '',
  landmark: '',
  deliveryInstructions: '',
};

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Customer | null>(null);
  const [showMapModal, setShowMapModal] = useState<Customer | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (data) {
      setCustomers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        type: (r.type || 'Retail') as Customer['type'],
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
        location: (r.location || '') as string,
        address: (r.address || '') as string,
        gpsLat: Number(r.gps_lat) || 0,
        gpsLng: Number(r.gps_lng) || 0,
        creditLimit: Number(r.credit_limit) || 0,
        purchaseVolume: Number(r.purchase_volume) || 0,
        rating: Number(r.rating) || 0,
        status: (r.status || 'Active') as string,
        notes: (r.notes || '') as string,
        landmark: (r.landmark || '') as string,
        deliveryInstructions: (r.delivery_instructions || '') as string,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Location search via Nominatim (free, no API key needed)
  const searchLocation = async () => {
    if (!locationSearch.trim()) return;
    setSearchingLocation(true);
    setShowDropdown(false);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&countrycodes=ke&limit=6`
      );
      const data = await res.json();
      const results = data.map((r: Record<string, unknown>) => ({
        name: r.display_name as string,
        lat: parseFloat(r.lat as string),
        lon: parseFloat(r.lon as string),
      }));
      setLocationResults(results);
      if (results.length > 0) setShowDropdown(true);
    } catch {
      setLocationResults([]);
    }
    setSearchingLocation(false);
  };

  const selectLocation = (loc: { name: string; lat: number; lon: number }) => {
    setFormData(prev => ({
      ...prev,
      location: loc.name.split(',')[0].trim(),
      address: loc.name,
      gpsLat: loc.lat,
      gpsLng: loc.lon,
    }));
    setLocationResults([]);
    setLocationSearch('');
    setShowDropdown(false);
  };

  const clearLocation = () => {
    setFormData(prev => ({ ...prev, location: '', address: '', gpsLat: 0, gpsLng: 0 }));
    setLocationSearch('');
    setLocationResults([]);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const row = {
      name: formData.name,
      type: formData.type,
      phone: formData.phone,
      email: formData.email,
      location: formData.location,
      address: formData.address,
      gps_lat: formData.gpsLat ?? 0,
      gps_lng: formData.gpsLng ?? 0,
      credit_limit: formData.creditLimit,
      purchase_volume: formData.purchaseVolume,
      rating: formData.rating,
      status: formData.status,
      notes: formData.notes,
      landmark: formData.landmark,
      delivery_instructions: formData.deliveryInstructions,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('customers').update(row).eq('id', editingId);
        if (error) {
          setFormError(error.message || 'Failed to update customer');
          setSaving(false);
          return;
        }
        logAudit({
          action: 'UPDATE',
          module: 'Customers',
          record_id: editingId,
          details: { name: formData.name, type: formData.type, phone: formData.phone },
        });
      } else {
        const { data: inserted, error } = await supabase.from('customers').insert(row).select().single();
        if (error) {
          setFormError(error.message || 'Failed to create customer');
          setSaving(false);
          return;
        }
        if (inserted) {
          logAudit({
            action: 'CREATE',
            module: 'Customers',
            record_id: inserted.id,
            details: { name: formData.name, type: formData.type, phone: formData.phone },
          });
        }
      }
      await fetchData();
      setEditingId(null);
      setFormData(emptyForm);
      setLocationSearch('');
      setLocationResults([]);
      setShowDropdown(false);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c: Customer) => {
    setFormData({
      name: c.name, type: c.type, phone: c.phone, email: c.email,
      location: c.location, address: c.address, gpsLat: c.gpsLat, gpsLng: c.gpsLng,
      creditLimit: c.creditLimit, purchaseVolume: c.purchaseVolume, rating: c.rating,
      status: c.status, notes: c.notes, landmark: c.landmark, deliveryInstructions: c.deliveryInstructions,
    });
    setEditingId(c.id);
    setLocationSearch('');
    setLocationResults([]);
    setShowDropdown(false);
    setFormError(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this customer?')) {
      const customer = customers.find(c => c.id === id);
      await supabase.from('customers').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Customers',
        record_id: id,
        details: { name: customer?.name, type: customer?.type, phone: customer?.phone },
      });
      setCustomers(customers.filter(c => c.id !== id));
    }
  };

  const getMapEmbedUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.005},${lng + 0.005},${lat + 0.005}&layer=mapnik&marker=${lat},${lng}`;

  const getGoogleMapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  const filtered = customers.filter(c => {
    const matchSearch = `${c.name} ${c.phone} ${c.location} ${c.email} ${c.landmark}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filterType === 'All' || c.type === filterType;
    return matchSearch && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedCustomers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalCustomers = customers.length;
  const wholesaleCount = customers.filter(c => c.type === 'Wholesale').length;
  const retailCount = customers.filter(c => c.type === 'Retail').length;
  const individualCount = customers.filter(c => c.type === 'Individual').length;

  const exportPdf = async () => {
    if (!tableRef.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Customers-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(tableRef.current).save();
    } catch { /* */ }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Customer Management</h1>
        <p className="text-muted-foreground">Manage customers with geo-location, segmentation, and delivery mapping</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Customers', value: totalCustomers, color: '' },
          { label: 'Wholesale', value: wholesaleCount, color: 'text-blue-600' },
          { label: 'Retail', value: retailCount, color: 'text-green-600' },
          { label: 'Individual', value: individualCount, color: 'text-orange-600' },
          { label: 'With Location', value: customers.filter(c => c.gpsLat).length, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="border border-border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
          >
            <option value="All">All Types</option>
            <option>Retail</option>
            <option>Wholesale</option>
            <option>Individual</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingId(null); setFormData(emptyForm); setLocationSearch(''); setLocationResults([]); setShowDropdown(false); setFormError(null); setShowForm(true); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            + Add Customer
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
          >
            <FileDown size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Add / Edit Form Modal ── */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingId(null); setFormError(null); }}
        title={editingId ? 'Edit Customer' : 'New Customer'}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
          {formError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {formError}
            </div>
          )}
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Customer Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Customer['type'] })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                <option>Retail</option>
                <option>Wholesale</option>
                <option>Individual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Phone *</label>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Credit Limit (KES)</label>
              <input type="number" value={formData.creditLimit} onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                <option>Active</option>
                <option>Inactive</option>
                <option>Suspended</option>
              </select>
            </div>
          </div>

          {/* ── Location Section ── */}
          <div className="border border-border rounded-xl p-4 bg-secondary/20 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-primary" />
              <span className="text-sm font-semibold">Delivery Location</span>
              {formData.gpsLat !== 0 && (
                <button type="button" onClick={clearLocation}
                  className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium">
                  × Clear Location
                </button>
              )}
            </div>

            {/* Single search bar */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search location (e.g. Westlands, Nairobi)…"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchLocation(); } }}
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
                  />
                </div>
                <button
                  type="button"
                  onClick={searchLocation}
                  disabled={searchingLocation || !locationSearch.trim()}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {searchingLocation ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {searchingLocation ? 'Searching…' : 'Search'}
                </button>
              </div>

              {/* Dropdown results — full width, overlays below */}
              {showDropdown && locationResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-secondary/50">
                    <p className="text-[11px] text-muted-foreground font-medium">{locationResults.length} results — click to select</p>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto divide-y divide-border">
                    {locationResults.map((loc, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => selectLocation(loc)}
                        className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-start gap-3"
                      >
                        <MapPin size={14} className="text-primary mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{loc.name.split(',')[0]}</p>
                          <p className="text-xs text-muted-foreground truncate">{loc.name.split(',').slice(1, 3).join(',').trim()}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* After location selected: show the map full width */}
            {formData.gpsLat !== 0 && formData.gpsLng !== 0 ? (
              <div className="space-y-3">
                {/* Confirmed location badge */}
                <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">{formData.location}</p>
                      <p className="text-[11px] text-green-700">GPS: {formData.gpsLat.toFixed(5)}, {formData.gpsLng.toFixed(5)}</p>
                    </div>
                  </div>
                  <a
                    href={getGoogleMapsUrl(formData.gpsLat, formData.gpsLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium shrink-0"
                  >
                    Open in Google Maps →
                  </a>
                </div>

                {/* Full-width map */}
                <iframe
                  src={getMapEmbedUrl(formData.gpsLat, formData.gpsLng)}
                  width="100%"
                  height="280"
                  className="rounded-xl border border-border w-full"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 py-10 text-center">
                <MapPin size={28} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Search for a location above to pin it on the map</p>
                <p className="text-xs text-muted-foreground/70 mt-1">GPS coordinates will be saved automatically</p>
              </div>
            )}

            {/* Location Name & Address */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Location Name</label>
                <input type="text" value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                  placeholder="e.g. Westlands" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Full Address</label>
                <input type="text" value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                  placeholder="Full address" />
              </div>
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Landmark / Nearby Reference</label>
              <input type="text" value={formData.landmark}
                onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                placeholder="e.g. Next to Sarit Centre, opposite Total petrol station" />
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Delivery Instructions</label>
              <textarea value={formData.deliveryInstructions}
                onChange={(e) => setFormData({ ...formData, deliveryInstructions: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                rows={2}
                placeholder="e.g. Call on arrival, use back entrance, ask for John at reception…" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormError(null); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
              {saving ? 'Saving…' : (editingId ? 'Update' : 'Save')} {saving ? '' : 'Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail View Modal ── */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || ''} size="3xl">
        {showDetail && (
          <div className="space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                  showDetail.type === 'Wholesale' ? 'bg-purple-100 text-purple-800' :
                  showDetail.type === 'Individual' ? 'bg-orange-100 text-orange-800' :
                  'bg-blue-100 text-blue-800'}`}>
                  {showDetail.type}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                  showDetail.status === 'Active' ? 'bg-green-100 text-green-800' :
                  showDetail.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'}`}>
                  {showDetail.status}
                </span>
              </div>
              <div><span className="text-muted-foreground">Phone:</span><span className="font-medium ml-2">{showDetail.phone}</span></div>
              <div><span className="text-muted-foreground">Email:</span><span className="font-medium ml-2">{showDetail.email || '—'}</span></div>
              <div><span className="text-muted-foreground">Credit Limit:</span><span className="font-medium ml-2">KES {showDetail.creditLimit.toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Location:</span><span className="font-medium ml-2">{showDetail.location || '—'}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Address:</span><span className="font-medium ml-2">{showDetail.address || '—'}</span></div>
              {showDetail.landmark && (
                <div className="col-span-2"><span className="text-muted-foreground">Landmark:</span><span className="font-medium ml-2">{showDetail.landmark}</span></div>
              )}
              {showDetail.deliveryInstructions && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-1">Delivery Instructions:</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">{showDetail.deliveryInstructions}</div>
                </div>
              )}
            </div>

            {/* Map section */}
            {showDetail.gpsLat !== 0 ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-primary" />
                    <span className="text-sm font-semibold">Delivery Location</span>
                    <span className="text-xs text-muted-foreground">
                      {showDetail.gpsLat.toFixed(5)}, {showDetail.gpsLng.toFixed(5)}
                    </span>
                  </div>
                  <a
                    href={getGoogleMapsUrl(showDetail.gpsLat, showDetail.gpsLng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Open in Google Maps →
                  </a>
                </div>
                <iframe
                  src={getMapEmbedUrl(showDetail.gpsLat, showDetail.gpsLng)}
                  width="100%"
                  height="340"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-4 border border-dashed border-border rounded-xl text-muted-foreground bg-secondary/20">
                <MapPin size={18} className="opacity-40" />
                <p className="text-sm">No GPS location saved for this customer</p>
              </div>
            )}

            {showDetail.notes && (
              <div className="border-t border-border pt-3">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{showDetail.notes}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-3 border-t border-border">
              <button onClick={() => { handleEdit(showDetail); setShowDetail(null); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
                Edit Customer
              </button>
              <button onClick={() => setShowDetail(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Map-only popup Modal ── */}
      <Modal isOpen={!!showMapModal} onClose={() => setShowMapModal(null)} title={`📍 ${showMapModal?.name || ''} — Location`} size="3xl">
        {showMapModal && showMapModal.gpsLat !== 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-green-800">{showMapModal.location || showMapModal.name}</p>
                <p className="text-xs text-green-700">{showMapModal.address || ''}</p>
                {showMapModal.landmark && <p className="text-xs text-green-700">📌 {showMapModal.landmark}</p>}
                <p className="text-[11px] text-green-700/80 mt-0.5">
                  GPS: {showMapModal.gpsLat.toFixed(5)}, {showMapModal.gpsLng.toFixed(5)}
                </p>
              </div>
              <a
                href={getGoogleMapsUrl(showMapModal.gpsLat, showMapModal.gpsLng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium shrink-0"
              >
                Open in Google Maps →
              </a>
            </div>
            <iframe
              src={getMapEmbedUrl(showMapModal.gpsLat, showMapModal.gpsLng)}
              width="100%"
              height="420"
              className="rounded-xl border border-border"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
        )}
      </Modal>

      {/* Table */}
      {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>}
      <div ref={tableRef}>
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Phone</th>
              <th className="px-4 py-3 text-left font-semibold">Location</th>
              <th className="px-4 py-3 text-left font-semibold">Landmark</th>
              <th className="px-4 py-3 text-center font-semibold">GPS</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.length === 0 && !loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No customers found</td>
              </tr>
            ) : (
              paginatedCustomers.map((cust) => (
                <tr key={cust.id} className="border-b border-border hover:bg-secondary/50">
                  <td className="px-4 py-3 font-medium">{cust.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      cust.type === 'Wholesale' ? 'bg-purple-100 text-purple-800' :
                      cust.type === 'Individual' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'}`}>
                      {cust.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{cust.phone}</td>
                  <td className="px-4 py-3 text-sm">{cust.location || '—'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {cust.landmark ? (cust.landmark.length > 25 ? cust.landmark.substring(0, 25) + '…' : cust.landmark) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cust.gpsLat ? (
                      <button
                        onClick={() => setShowMapModal(cust)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold transition-colors"
                        title={`${cust.gpsLat.toFixed(4)}, ${cust.gpsLng.toFixed(4)}`}
                      >
                        <MapPin size={11} /> View Map
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      cust.status === 'Active' ? 'bg-green-100 text-green-800' :
                      cust.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'}`}>
                      {cust.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setShowDetail(cust)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                      <button onClick={() => handleEdit(cust)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                      <button onClick={() => handleDelete(cust.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} customers
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50">Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button key={page} onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 text-sm border rounded-lg font-medium ${currentPage === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}>
                {page}
              </button>
            ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      {filtered.length <= PAGE_SIZE && filtered.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Showing {filtered.length} of {totalCustomers} customers</p>
        </div>
      )}
    </div>
  );
}
