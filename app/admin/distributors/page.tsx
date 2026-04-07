'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { FileDown, Search, Pencil } from 'lucide-react';

interface ContactPerson {
  name: string;
  role: string;
  phone: string;
  email: string;
}

interface Distributor {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  location: string;
  gpsLat: number;
  gpsLng: number;
  category: string;
  products: string;
  paymentTerms: string;
  rating: number;
  status: 'Active' | 'Inactive';
  notes: string;
  website: string;
  contacts: ContactPerson[];
}

interface DistributorCategory {
  id: string;
  name: string;
  description: string;
}

const emptyContact: ContactPerson = { name: '', role: '', phone: '', email: '' };

const emptyForm = {
  name: '',
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  location: '',
  gpsLat: 0,
  gpsLng: 0,
  category: '',
  products: '',
  paymentTerms: 'Net 30',
  rating: 5,
  status: 'Active' as Distributor['status'],
  notes: '',
  website: '',
  contacts: [] as ContactPerson[],
};

const emptyCategoryForm = { name: '', description: '' };

const ITEMS_PER_PAGE = 10;

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [categories, setCategories] = useState<DistributorCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'distributors' | 'categories'>('distributors');
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const distributorTableRef = useRef<HTMLDivElement>(null);
  const categoryTableRef = useRef<HTMLDivElement>(null);

  // Distributor form state
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Distributor | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  // Search, filter, pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Location search
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);

  const fetchDistributors = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('distributors').select('*').order('created_at', { ascending: false });
    if (data) {
      setDistributors(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        companyName: (r.company_name || '') as string,
        contactPerson: (r.contact_person || '') as string,
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
        address: (r.address || '') as string,
        location: (r.location || '') as string,
        gpsLat: (r.gps_lat || 0) as number,
        gpsLng: (r.gps_lng || 0) as number,
        category: (r.category || '') as string,
        products: (r.products || '') as string,
        paymentTerms: (r.payment_terms || 'Net 30') as string,
        rating: (r.rating || 0) as number,
        status: (r.status || 'Active') as Distributor['status'],
        notes: (r.notes || '') as string,
        website: (r.website || '') as string,
        contacts: (r.contacts ? (typeof r.contacts === 'string' ? JSON.parse(r.contacts as string) : r.contacts) : []) as ContactPerson[],
      })));
    }
    setLoading(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('distributor_categories').select('*').order('name');
    if (data) {
      setCategories(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        description: (r.description || '') as string,
      })));
    }
  }, []);

  useEffect(() => { fetchDistributors(); fetchCategories(); }, [fetchDistributors, fetchCategories]);

  // Location search using Nominatim (free, no API key)
  const searchLocation = async () => {
    if (!locationSearch.trim()) return;
    setSearchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}&countrycodes=ke&limit=5`);
      const data = await res.json();
      setLocationResults(data.map((r: Record<string, unknown>) => ({ name: r.display_name as string, lat: parseFloat(r.lat as string), lon: parseFloat(r.lon as string) })));
    } catch { setLocationResults([]); }
    setSearchingLocation(false);
  };

  const selectLocation = (loc: { name: string; lat: number; lon: number }) => {
    setFormData({ ...formData, location: loc.name.split(',')[0], address: loc.name, gpsLat: loc.lat, gpsLng: loc.lon });
    setLocationResults([]);
    setLocationSearch('');
  };

  const getMapUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  const getMapLinkUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

  // Contacts management in form
  const addContact = () => {
    setFormData({ ...formData, contacts: [...formData.contacts, { ...emptyContact }] });
  };

  const removeContact = (idx: number) => {
    setFormData({ ...formData, contacts: formData.contacts.filter((_, i) => i !== idx) });
  };

  const updateContact = (idx: number, field: keyof ContactPerson, value: string) => {
    const updated = [...formData.contacts];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, contacts: updated });
  };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Distributor CRUD
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = {
      name: formData.name,
      company_name: formData.companyName,
      contact_person: formData.contactPerson,
      phone: formData.phone,
      email: formData.email,
      address: formData.address,
      location: formData.location,
      gps_lat: formData.gpsLat || null,
      gps_lng: formData.gpsLng || null,
      category: formData.category,
      products: formData.products,
      payment_terms: formData.paymentTerms,
      rating: formData.rating,
      status: formData.status,
      notes: formData.notes,
      website: formData.website,
      contacts: JSON.stringify(formData.contacts.filter(c => c.name.trim())),
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('distributors').update(row).eq('id', editingId);
        if (error) throw error;
        logAudit({
          action: 'UPDATE',
          module: 'Suppliers',
          record_id: editingId,
          details: { name: row.name, company_name: row.company_name, category: row.category, status: row.status },
        });
        showToast('Supplier updated successfully', 'success');
      } else {
        const { data: inserted, error } = await supabase.from('distributors').insert(row).select('id').single();
        if (error) throw error;
        logAudit({
          action: 'CREATE',
          module: 'Suppliers',
          record_id: inserted?.id ?? '',
          details: { name: row.name, company_name: row.company_name, category: row.category, status: row.status },
        });
        showToast('Supplier added successfully', 'success');
      }
      await fetchDistributors();
      setEditingId(null);
      setFormData({ ...emptyForm, contacts: [] });
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String((err as Record<string, unknown>).message) : 'Unknown error';
      showToast(`Failed to save supplier: ${msg}`, 'error');
    }
  };

  const handleEdit = (d: Distributor) => {
    setFormData({
      name: d.name,
      companyName: d.companyName,
      contactPerson: d.contactPerson,
      phone: d.phone,
      email: d.email,
      address: d.address,
      location: d.location,
      gpsLat: d.gpsLat,
      gpsLng: d.gpsLng,
      category: d.category,
      products: d.products,
      paymentTerms: d.paymentTerms,
      rating: d.rating,
      status: d.status,
      notes: d.notes,
      website: d.website,
      contacts: d.contacts.length > 0 ? d.contacts : [],
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this supplier?')) {
      await supabase.from('distributors').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Suppliers',
        record_id: id,
        details: {},
      });
      setDistributors(distributors.filter(d => d.id !== id));
    }
  };

  // Category CRUD
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { name: categoryForm.name, description: categoryForm.description };
    try {
      if (editingCategoryId) {
        await supabase.from('distributor_categories').update(row).eq('id', editingCategoryId);
        logAudit({
          action: 'UPDATE',
          module: 'Suppliers',
          record_id: editingCategoryId,
          details: { table: 'distributor_categories', name: row.name, description: row.description },
        });
      } else {
        const { data: inserted } = await supabase.from('distributor_categories').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Suppliers',
          record_id: inserted?.id ?? '',
          details: { table: 'distributor_categories', name: row.name, description: row.description },
        });
      }
      await fetchCategories();
    } catch { /* fallback */ }
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryForm(false);
  };

  const handleEditCategory = (cat: DistributorCategory) => {
    setCategoryForm({ name: cat.name, description: cat.description });
    setEditingCategoryId(cat.id);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Delete this category?')) {
      await supabase.from('distributor_categories').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Suppliers',
        record_id: id,
        details: { table: 'distributor_categories' },
      });
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  // Filtering and pagination
  const filtered = distributors.filter(d => {
    const matchSearch = `${d.name} ${d.companyName} ${d.contactPerson} ${d.phone} ${d.email} ${d.location} ${d.products}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = filterCategory === 'All' || d.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedDistributors = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory]);

  // Stats
  const totalDistributors = distributors.length;
  const activeDistributors = distributors.filter(d => d.status === 'Active').length;
  const categoriesCount = categories.length;
  const withLocationCount = distributors.filter(d => d.gpsLat !== 0).length;

  // Filtered categories
  const filteredCategories = categories.filter(cat => {
    if (!catSearchTerm) return true;
    return cat.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || cat.description.toLowerCase().includes(catSearchTerm.toLowerCase());
  });

  const exportPdf = async (title: string, ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
      };
      await html2pdf().set(opt).from(ref.current).save();
    } catch { /* */ }
  };

  // Rating stars display
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-yellow-500' : 'text-gray-300'}>*</span>
    ));
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="mb-2">Supplier Management</h1>
        <p className="text-muted-foreground">Manage inventory suppliers, their categories, and procurement pricing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Suppliers</p>
          <p className="text-2xl font-bold">{totalDistributors}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeDistributors}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Categories</p>
          <p className="text-2xl font-bold text-blue-600">{categoriesCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">With Location</p>
          <p className="text-2xl font-bold text-purple-600">{withLocationCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('distributors')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'distributors'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Suppliers
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Categories
        </button>
      </div>

      {/* ── DISTRIBUTORS TAB ── */}
      {activeTab === 'distributors' && (
        <div>
          {/* Actions */}
          <div className="mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
              >
                <option value="All">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { setEditingId(null); setFormData({ ...emptyForm, contacts: [] }); setShowForm(true); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              + Add Supplier
            </button>
            <button
              onClick={() => exportPdf('Distributors', distributorTableRef)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
            >
              <FileDown size={14} /> Export PDF
            </button>
          </div>

          {/* Distributor Form Modal */}
          <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingId(null); }} title={editingId ? 'Edit Supplier' : 'New Supplier'} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Supplier Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Company Name</label>
                  <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Primary Contact Person</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Phone *</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Website</label>
                  <input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" placeholder="e.g. www.example.com (optional)" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" required>
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Payment Terms</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                    <option>Cash on Delivery</option>
                    <option>Net 7</option>
                    <option>Net 14</option>
                    <option>Net 30</option>
                    <option>Net 60</option>
                    <option>Net 90</option>
                    <option>Prepaid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Rating (1-5)</label>
                  <select value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                    <option value={1}>1 - Poor</option>
                    <option value={2}>2 - Below Average</option>
                    <option value={3}>3 - Average</option>
                    <option value={4}>4 - Good</option>
                    <option value={5}>5 - Excellent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Distributor['status'] })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Products / Items Supplied</label>
                <textarea value={formData.products} onChange={(e) => setFormData({ ...formData, products: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} placeholder="e.g. Wheat flour, Sugar, Baking powder (comma separated)" />
              </div>

              {/* Location Search */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <label className="block text-sm font-medium mb-2">Location</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search location (e.g. Industrial Area, Nairobi)"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchLocation())}
                    className="flex-1 px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
                  />
                  <button type="button" onClick={searchLocation} disabled={searchingLocation} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50">
                    {searchingLocation ? '...' : 'Search'}
                  </button>
                </div>
                {locationResults.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
                    {locationResults.map((loc, idx) => (
                      <button type="button" key={idx} onClick={() => selectLocation(loc)} className="w-full text-left px-3 py-2 text-xs bg-background border border-border rounded-lg hover:bg-primary/5 hover:border-primary/30 transition-colors">
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Location Name</label>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="e.g. Industrial Area" />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Full Address</label>
                    <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="Full address" />
                  </div>
                </div>
                {formData.gpsLat !== 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">GPS: {formData.gpsLat.toFixed(6)}, {formData.gpsLng.toFixed(6)}</p>
                    <iframe src={getMapUrl(formData.gpsLat, formData.gpsLng)} width="100%" height="150" className="rounded-lg border border-border" style={{ border: 0 }} loading="lazy"></iframe>
                  </div>
                )}
              </div>

              {/* Contacts Section */}
              <div className="border border-border rounded-lg p-4 bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Additional Contact Persons <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
                  <button type="button" onClick={addContact} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">
                    + Add Contact
                  </button>
                </div>
                {formData.contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No additional contacts added. Click &quot;+ Add Contact&quot; to add one.</p>
                ) : (
                <div className="space-y-3">
                  {formData.contacts.map((contact, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Name</label>
                        <input type="text" value={contact.name} onChange={(e) => updateContact(idx, 'name', e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="Contact name" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Role</label>
                        <input type="text" value={contact.role} onChange={(e) => updateContact(idx, 'role', e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="e.g. Sales Rep" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                        <input type="tel" value={contact.phone} onChange={(e) => updateContact(idx, 'phone', e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="Phone" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Email</label>
                        <input type="email" value={contact.email} onChange={(e) => updateContact(idx, 'email', e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none bg-background" placeholder="Email" />
                      </div>
                      <button type="button" onClick={() => removeContact(idx)} className="px-2 py-1.5 text-xs bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium">
                        X
                      </button>
                    </div>
                  ))}
                </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none" rows={2} />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingId ? 'Update' : 'Create'} Supplier</button>
              </div>
            </form>
          </Modal>

          {/* Detail View Modal */}
          <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || ''} size="2xl">
            {showDetail && (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {/* Header with company and status */}
                <div className="flex items-start justify-between">
                  <div>
                    {showDetail.companyName && <p className="text-lg font-semibold">{showDetail.companyName}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${showDetail.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{showDetail.status}</span>
                      {showDetail.category && <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">{showDetail.category}</span>}
                      <span className="text-sm">{renderStars(showDetail.rating)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowDetail(null); handleEdit(showDetail); }} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium">Edit</button>
                    <button onClick={() => { setShowDetail(null); handleDelete(showDetail.id); }} className="px-3 py-1.5 text-xs bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium">Delete</button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-muted-foreground">Contact Person:</span> <span className="font-medium ml-2">{showDetail.contactPerson || '—'}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium ml-2">{showDetail.phone}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium ml-2">{showDetail.email || '—'}</span></div>
                  <div><span className="text-muted-foreground">Website:</span> <span className="font-medium ml-2">{showDetail.website ? <a href={showDetail.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{showDetail.website}</a> : '—'}</span></div>
                  <div><span className="text-muted-foreground">Payment Terms:</span> <span className="font-medium ml-2">{showDetail.paymentTerms}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="font-medium ml-2">{showDetail.location || '—'}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium ml-2">{showDetail.address || '—'}</span></div>
                </div>

                {/* Products */}
                {showDetail.products && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium mb-2">Products / Items Supplied</p>
                    <div className="flex flex-wrap gap-1.5">
                      {showDetail.products.split(',').map((p, i) => (
                        <span key={i} className="px-2 py-1 bg-secondary text-xs rounded-lg font-medium">{p.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map */}
                {showDetail.gpsLat !== 0 && (
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Location Map</p>
                      <a href={getMapLinkUrl(showDetail.gpsLat, showDetail.gpsLng)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">Open in Google Maps</a>
                    </div>
                    <iframe src={getMapUrl(showDetail.gpsLat, showDetail.gpsLng)} width="100%" height="200" className="rounded-lg border border-border" style={{ border: 0 }} loading="lazy"></iframe>
                    <p className="text-xs text-muted-foreground mt-1">GPS: {showDetail.gpsLat.toFixed(6)}, {showDetail.gpsLng.toFixed(6)}</p>
                  </div>
                )}

                {/* Contact Persons */}
                {showDetail.contacts && showDetail.contacts.length > 0 && showDetail.contacts.some(c => c.name) && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium mb-2">Contact Persons</p>
                    <div className="space-y-2">
                      {showDetail.contacts.filter(c => c.name).map((contact, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{contact.name}</p>
                            {contact.role && <p className="text-xs text-muted-foreground">{contact.role}</p>}
                          </div>
                          {contact.phone && <span className="text-xs">{contact.phone}</span>}
                          {contact.email && <span className="text-xs text-muted-foreground">{contact.email}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {showDetail.notes && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{showDetail.notes}</p>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Table */}
          {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading...</p>}
          <div ref={distributorTableRef}>
          <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Company</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-center font-semibold">Rating</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDistributors.length === 0 && !loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No suppliers found</td></tr>
                ) : (
                  paginatedDistributors.map((dist) => (
                    <tr key={dist.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="px-4 py-3 font-medium">{dist.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{dist.companyName || '—'}</td>
                      <td className="px-4 py-3">
                        {dist.category ? <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">{dist.category}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">{dist.phone}</td>
                      <td className="px-4 py-3 text-sm">{dist.location || '—'}</td>
                      <td className="px-4 py-3 text-center text-sm">{renderStars(dist.rating)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${dist.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{dist.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setShowDetail(dist)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                          <button onClick={() => handleEdit(dist)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                          <button onClick={() => handleDelete(dist.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} suppliers
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
                    className={`px-3 py-1.5 text-sm border rounded-lg font-medium ${
                      page === currentPage
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-secondary'
                    }`}
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
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {activeTab === 'categories' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={catSearchTerm}
                  onChange={e => setCatSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingCategoryId(null); setCategoryForm(emptyCategoryForm); setShowCategoryForm(true); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                + Add Category
              </button>
              <button
                onClick={() => exportPdf('Supplier-Categories', categoryTableRef)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary font-medium text-sm flex items-center gap-1.5"
              >
                <FileDown size={14} /> Export PDF
              </button>
            </div>
          </div>

          <Modal isOpen={showCategoryForm} onClose={() => { setShowCategoryForm(false); setEditingCategoryId(null); }} title={editingCategoryId ? 'Edit Category' : 'Add Supplier Category'} size="md">
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  placeholder="e.g. Flour Suppliers"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                  rows={3}
                  placeholder="Brief description of this supplier category"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <button type="button" onClick={() => { setShowCategoryForm(false); setEditingCategoryId(null); }} className="px-4 py-2 border border-border rounded-lg hover:bg-secondary">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium">{editingCategoryId ? 'Update' : 'Add'} Category</button>
              </div>
            </form>
          </Modal>

          <div ref={categoryTableRef}>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
              {catSearchTerm ? 'No categories match your search.' : 'No categories yet. Add one to get started.'}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Category Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-center font-semibold">Suppliers</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map(cat => {
                    const count = distributors.filter(d => d.category === cat.name).length;
                    return (
                      <tr key={cat.id} className="border-b border-border hover:bg-secondary/50">
                        <td className="px-4 py-3 font-medium">{cat.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cat.description || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-secondary">{count}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEditCategory(cat)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium flex items-center gap-1">
                              <Pencil size={11} /> Edit
                            </button>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
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

          {filteredCategories.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Showing {filteredCategories.length} of {categories.length} categories</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
