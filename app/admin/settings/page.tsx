'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { products } from '@/lib/products';
import type { Offer } from '@/lib/products';
import { logAudit } from '@/lib/audit-logger';

type SettingsTab = 'general' | 'chatgpt-ai' | 'offers' | 'navbar-ads' | 'newsletter' | 'social-media' | 'receipt' | 'payment' | 'family-bank' | 'posCard' | 'security' | 'backup' | 'sessions' | 'delivery' | 'kra-etims' | 'sha-nssf' | 'maintenance' | 'bug-tracker' | 'email';

interface SystemBug {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  module: string;
  source: string;
  error_code?: string;
  stack_trace?: string;
  endpoint?: string;
  http_status?: number;
  request_details?: Record<string, unknown>;
  occurrence_count: number;
  first_detected_at: string;
  detected_at: string;
  resolved_at?: string;
  notes?: string;
  scan_id?: string;
  updated_at: string;
  created_at: string;
}

interface NewsletterSubscriber {
  id: string;
  email: string;
  source: string;
  discount_code?: string;
  subscribed_at: string;
  is_active: boolean;
}

interface OfferForm {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  badge_text: string;
  discount_text: string;
  product_id: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  sort_order: number;
}

const emptyOffer: OfferForm = {
  title: '',
  description: '',
  image_url: '',
  link_url: '/shop',
  badge_text: 'Limited Time',
  discount_text: '',
  product_id: '',
  is_active: true,
  start_date: '',
  end_date: '',
  sort_order: 0,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // ── General Settings ──
  const [general, setGeneral] = useState({
    businessName: 'SNACKOH BITES',
    tagline: 'Quality Baked Goods',
    phone: '+254 700 000 000',
    email: 'info@snackoh.com',
    shopNumber: '',
    address: 'Nairobi, Kenya',
    currency: 'KES',
    taxRate: 16,
    timezone: 'Africa/Nairobi',
    language: 'en',
    logoUrl: '',
    logoHeight: 60,
    logoWidthAuto: true,
    logoPosition: 'left' as 'left' | 'center',
    invoiceLogoHeight: 50,
    reportLogoHeight: 45,
    reportWatermarkEnabled: true,
    reportWatermarkOpacity: 8,
  });

  // ── ChatGPT AI Settings ──
  const [chatGptSettings, setChatGptSettings] = useState({
    model: 'gpt-4o-mini',
    enabled: false,
    maxTokens: 2048,
    temperature: 0.7,
  });
  const [chatGptTestResult, setChatGptTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [chatGptTesting, setChatGptTesting] = useState(false);

  // ── Receipt Settings ──
  const [receipt, setReceipt] = useState({
    showLogo: true,
    headerText: 'SNACKOH BITES',
    subHeaderText: 'Quality Baked Goods',
    footerText: 'Thank you for choosing Snackoh!',
    showTax: true,
    showCashier: true,
    showCustomer: true,
    showPaymentDetails: true,
    disclaimer: 'Goods once sold are not returnable',
    paperWidth: '80mm',
    autoPrint: false,
    softwareProvidedBy: '',
  });

  // ── Payment Details Settings ──
  const [paymentDetails, setPaymentDetails] = useState({
    mpesaType: 'paybill' as 'paybill' | 'till',
    paybillNumber: '',
    accountNumber: '',
    tillNumber: '',
    mpesaName: 'SNACKOH BITES',
    bankName: '',
    bankAccount: '',
    bankBranch: '',
    showOnReceipt: true,
  });

  // ── POS Card Reader Settings ──
  const [posCard, setPosCard] = useState({
    enabled: false,
    readerType: 'bluetooth' as 'bluetooth' | 'usb' | 'audio',
    readerBrand: '',
    readerModel: '',
    connectionId: '',
    autoConnect: true,
    requireApprovalCode: true,
    requireLastFourDigits: true,
    printCardReceipt: true,
    minimumAmount: 0,
    surchargeEnabled: false,
    surchargePercent: 0,
    allowContactless: true,
    allowChip: true,
    allowSwipe: true,
    timeoutSeconds: 60,
  });

  // ── Security Settings ──
  const [security, setSecurity] = useState({
    requirePosPin: true,
    pinLength: 4,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    enforceStrongPasswords: false,
    twoFactorAuth: false,
    auditLogging: true,
    ipWhitelist: '',
  });

  // ── Backup Settings ──
  const [backup, setBackup] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    retentionDays: 30,
    lastBackup: 'Never',
    backupLocation: 'supabase',
  });
  const [backupList, setBackupList] = useState<Array<{
    backup_id: string; filename: string; size_bytes: number;
    table_count: number; total_rows: number; trigger: string;
    status: string; errors: string[] | null; created_at: string;
  }>>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  // ── Delivery Settings ──
  const [delivery, setDelivery] = useState({
    deliveryEnabled: true,
    minimumOrderForDelivery: 500,
    deliveryFee: 200,
    freeDeliveryThreshold: 2000,
    estimatedDeliveryTime: '30-60 mins',
    deliveryRadius: '10 km',
    deliveryNotes: '',
    googleMapsApiKey: '',
  });

  // ── KRA eTIMS Integration ──
  const [kraEtims, setKraEtims] = useState({
    enabled: false,
    kraPin: '',
    businessName: '',
    branchId: '',
    apiUrl: '',
    apiKey: '',
    apiSecret: '',
    autoSubmit: false,
    lastSync: '',
    status: 'Inactive' as string,
  });

  // ── SHA / NSSF Integration ──
  const [shaNssf, setShaNssf] = useState({
    shaEnabled: false,
    shaEmployerCode: '',
    shaApiKey: '',
    shaEndpoint: '',
    shaAutoDeduct: false,
    shaLastSync: '',
    nssfEnabled: false,
    nssfEmployerCode: '',
    nssfApiKey: '',
    nssfEndpoint: '',
    nssfAutoDeduct: false,
    nssfLastSync: '',
    nhifEnabled: false,
    nhifEmployerCode: '',
    nhifApiKey: '',
    nhifEndpoint: '',
    nhifAutoDeduct: false,
    nhifLastSync: '',
  });

  // ── Maintenance Mode ──
  const [maintenanceMode, setMaintenanceMode] = useState({
    enabled: false,
    message: 'System under automatic maintenance and backup. Please check back shortly.',
    started_at: null as string | null,
    started_by: null as string | null,
  });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('');

  // ── Email Settings (Resend) ──
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    fromEmail: '',
    fromName: '',
    resendApiKey: '',
    sendOnUserCreation: true,
  });
  const [emailTestSending, setEmailTestSending] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Bug Tracker ──
  const [bugs, setBugs] = useState<SystemBug[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugScanning, setBugScanning] = useState(false);
  const [bugScanResult, setBugScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bugFilter, setBugFilter] = useState({ status: 'all', severity: 'all', category: 'all', search: '' });
  const [bugStats, setBugStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, critical: 0, high: 0 });
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);
  const [lastScanInfo, setLastScanInfo] = useState<Record<string, unknown> | null>(null);
  const [bugAutoScan, setBugAutoScan] = useState(true);
  const [bugPage, setBugPage] = useState(0);
  const bugsPerPage = 15;

  // ── Offers ──
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerForm, setOfferForm] = useState<OfferForm>(emptyOffer);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerRotation, setOfferRotation] = useState({ enabled: true, interval: 5 });
  const [offerUploading, setOfferUploading] = useState(false);

  // ── Navbar Ads (Marquee) ──
  const [navbarAds, setNavbarAds] = useState({
    enabled: true,
    items: [
      'FREE DELIVERY ON ORDERS OVER KES 2,000',
      'FRESHLY BAKED DAILY',
      'ORDER BY 5PM FOR NEXT-DAY DELIVERY',
      'CUSTOM CAKES — ORDER 48 HRS IN ADVANCE',
      'WHOLESALE ORDERS AVAILABLE',
    ],
  });
  const [newNavbarItem, setNewNavbarItem] = useState('');

  // ── Newsletter Modal ──
  const [newsletterModal, setNewsletterModal] = useState({
    enabled: true,
    title: 'Subscribe Now',
    subtitle: 'Newsletter',
    description: 'Get 15% off your first order when you subscribe to our newsletter. Stay updated with exclusive offers and new arrivals.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80&fit=crop',
    discountCode: 'WELCOME15',
    delaySeconds: 5,
  });
  const [newsletterImageUploading, setNewsletterImageUploading] = useState(false);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);

  // ── Social Media Settings ──
  const [socialMedia, setSocialMedia] = useState({
    instagram: '@snackohbites',
    instagramUrl: 'https://www.instagram.com/snackohbites',
    tiktok: '@snackohbites',
    tiktokUrl: 'https://www.tiktok.com/@snackohbites',
    facebook: 'Snackoh Bites',
    facebookUrl: 'https://www.facebook.com/SnackohBites',
    twitter: '',
    twitterUrl: '',
    youtube: '',
    youtubeUrl: '',
    whatsapp: '',
    whatsappUrl: '',
  });

  // ── M-Pesa API Settings ──
  const [mpesaApi, setMpesaApi] = useState({
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_shortcode: '174379',
    mpesa_passkey: '',
    mpesa_callback_url: '',
    mpesa_env: 'sandbox',
    mpesa_b2c_shortcode: '',
    mpesa_b2c_initiator_name: '',
    mpesa_b2c_security_credential: '',
    mpesa_b2c_consumer_key: '',
    mpesa_b2c_consumer_secret: '',
    mpesa_b2c_result_url: '',
    mpesa_b2c_timeout_url: '',
  });
  const [mpesaApiMasked, setMpesaApiMasked] = useState<Record<string, string>>({});
  const [mpesaApiSource, setMpesaApiSource] = useState<Record<string, string>>({});
  const [mpesaApiLoading, setMpesaApiLoading] = useState(false);
  const [mpesaApiSaving, setMpesaApiSaving] = useState(false);
  const [mpesaApiTesting, setMpesaApiTesting] = useState(false);
  const [mpesaApiTestResult, setMpesaApiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showMpesaSecrets, setShowMpesaSecrets] = useState(false);

  const loadOffers = async () => {
    setOffersLoading(true);
    try {
      const { data, error } = await supabase.from('offers').select('*').order('sort_order', { ascending: true });
      if (!error && data) setOffers(data as Offer[]);
    } catch { /* table may not exist yet */ }

    // Load rotation settings from localStorage
    try {
      const rot = localStorage.getItem('snackoh_offer_rotation');
      if (rot) setOfferRotation(JSON.parse(rot));
    } catch { /* ignore */ }

    // Also load from localStorage as fallback
    try {
      const local = localStorage.getItem('snackoh_offers');
      if (local) {
        const parsed = JSON.parse(local) as Offer[];
        setOffers(prev => prev.length > 0 ? prev : parsed);
      }
    } catch { /* ignore */ }
    setOffersLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'offers') loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Load Navbar Ads settings ──
  useEffect(() => {
    if (activeTab === 'navbar-ads') {
      async function loadNavbarAds() {
        try {
          const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'navbarAds').single();
          if (!error && data?.value) {
            setNavbarAds(prev => ({ ...prev, ...(data.value as Record<string, unknown>) }));
            return;
          }
        } catch { /* table may not exist */ }
        try {
          const saved = localStorage.getItem('snackoh_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.navbarAds) setNavbarAds(prev => ({ ...prev, ...parsed.navbarAds }));
          }
        } catch { /* ignore */ }
      }
      loadNavbarAds();
    }
  }, [activeTab]);

  // ── Load Newsletter Modal settings & subscribers ──
  useEffect(() => {
    if (activeTab === 'newsletter') {
      async function loadNewsletterSettings() {
        try {
          const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'newsletterModal').single();
          if (!error && data?.value) {
            setNewsletterModal(prev => ({ ...prev, ...(data.value as Record<string, unknown>) }));
            return;
          }
        } catch { /* table may not exist */ }
        try {
          const saved = localStorage.getItem('snackoh_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.newsletterModal) setNewsletterModal(prev => ({ ...prev, ...parsed.newsletterModal }));
          }
        } catch { /* ignore */ }
      }
      async function loadSubscribers() {
        setSubscribersLoading(true);
        try {
          const { data, error } = await supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false });
          if (!error && data) setSubscribers(data as NewsletterSubscriber[]);
        } catch { /* table may not exist */ }
        setSubscribersLoading(false);
      }
      loadNewsletterSettings();
      loadSubscribers();
    }
  }, [activeTab]);

  const saveNavbarAds = async () => {
    setSaving(true);
    const settingsData = { ...JSON.parse(localStorage.getItem('snackoh_settings') || '{}'), navbarAds };
    localStorage.setItem('snackoh_settings', JSON.stringify(settingsData));
    try {
      await supabase.from('business_settings').upsert(
        { key: 'navbarAds', value: navbarAds, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      logAudit({
        action: 'UPDATE',
        module: 'Settings',
        record_id: 'navbarAds',
        details: { key: 'navbarAds', items: navbarAds.items.length },
      });
    } catch { /* table may not exist */ }
    setSaving(false);
    setSavedMsg('Navbar ads saved!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const saveNewsletterModal = async () => {
    setSaving(true);
    const settingsData = { ...JSON.parse(localStorage.getItem('snackoh_settings') || '{}'), newsletterModal };
    localStorage.setItem('snackoh_settings', JSON.stringify(settingsData));
    try {
      await supabase.from('business_settings').upsert(
        { key: 'newsletterModal', value: newsletterModal, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      logAudit({
        action: 'UPDATE',
        module: 'Settings',
        record_id: 'newsletterModal',
        details: { key: 'newsletterModal', title: newsletterModal.title },
      });
    } catch { /* table may not exist */ }
    setSaving(false);
    setSavedMsg('Newsletter modal settings saved!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const deleteSubscriber = async (id: string) => {
    try {
      await supabase.from('newsletter_subscribers').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Settings',
        record_id: id,
        details: { table: 'newsletter_subscribers' },
      });
      setSubscribers(prev => prev.filter(s => s.id !== id));
      setSavedMsg('Subscriber removed');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch { setSavedMsg('Failed to remove subscriber'); }
  };

  // ── M-Pesa API: Load settings ──
  const loadMpesaApiSettings = async () => {
    setMpesaApiLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/mpesa/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const masked: Record<string, string> = {};
        const sources: Record<string, string> = {};
        // Build masked display and source info from env
        if (data.env) {
          for (const [key, info] of Object.entries(data.env as Record<string, { masked: string; source: string }>)) {
            masked[key] = info.masked || '';
            sources[key] = info.source || 'none';
          }
        }
        // Overlay DB backup info for display
        if (data.db) {
          for (const [key, info] of Object.entries(data.db as Record<string, { masked: string; value: string }>)) {
            if (!masked[key] && info.masked) {
              masked[key] = info.masked;
              sources[key] = 'db';
            }
          }
        }
        setMpesaApiMasked(masked);
        setMpesaApiSource(sources);
      }
    } catch {
      // API may not be available
    }
    setMpesaApiLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'family-bank') loadMpesaApiSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const saveMpesaApiSettings = async () => {
    setMpesaApiSaving(true);
    try {
      // Only send fields that have been filled in (non-empty)
      const settingsToSave: Record<string, string> = {};
      for (const [key, value] of Object.entries(mpesaApi)) {
        if (value) settingsToSave[key] = value;
      }

      const token = await getAuthToken();
      const res = await fetch('/api/mpesa/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ settings: settingsToSave }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedMsg('Family Bank settings saved to database backup!');
        // Clear the form fields (since they are now saved)
        setMpesaApi({
          mpesa_consumer_key: '',
          mpesa_consumer_secret: '',
          mpesa_shortcode: '',
          mpesa_passkey: '',
          mpesa_callback_url: '',
          mpesa_env: '',
          mpesa_b2c_shortcode: '',
          mpesa_b2c_initiator_name: '',
          mpesa_b2c_security_credential: '',
          mpesa_b2c_consumer_key: '',
          mpesa_b2c_consumer_secret: '',
          mpesa_b2c_result_url: '',
          mpesa_b2c_timeout_url: '',
        });
        // Reload to show updated masked values
        loadMpesaApiSettings();
      } else {
        setSavedMsg(data.message || 'Failed to save M-Pesa settings');
      }
    } catch {
      setSavedMsg('Error saving M-Pesa settings');
    }
    setMpesaApiSaving(false);
    setTimeout(() => setSavedMsg(''), 4000);
  };

  const testMpesaConnection = async () => {
    setMpesaApiTesting(true);
    setMpesaApiTestResult(null);
    try {
      // Try to get an access token to verify credentials
      const res = await fetch('/api/mpesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '254700000000', amount: 1, accountReference: 'TEST', description: 'Connection Test' }),
      });
      const data = await res.json();
      if (data.success) {
        setMpesaApiTestResult({ success: true, message: 'Connection successful! STK push was initiated (sandbox test).' });
      } else {
        setMpesaApiTestResult({ success: false, message: data.message || 'Connection failed. Check your credentials.' });
      }
    } catch (err) {
      setMpesaApiTestResult({ success: false, message: 'Network error. Unable to reach M-Pesa API.' + (err instanceof Error ? ' ' + err.message : '') });
    }
    setMpesaApiTesting(false);
  };

  const saveOffer = async () => {
    const now = new Date().toISOString();
    const offerData: Partial<Offer> = {
      title: offerForm.title,
      description: offerForm.description,
      image_url: offerForm.image_url,
      link_url: offerForm.link_url || '/shop',
      badge_text: offerForm.badge_text || 'Limited Time',
      discount_text: offerForm.discount_text || undefined,
      product_id: offerForm.product_id || undefined,
      is_active: offerForm.is_active,
      start_date: offerForm.start_date || now,
      end_date: offerForm.end_date || undefined,
      sort_order: offerForm.sort_order,
    };

    try {
      if (editingOfferId) {
        const { error } = await supabase.from('offers').update(offerData).eq('id', editingOfferId);
        if (error) throw error;
        logAudit({
          action: 'UPDATE',
          module: 'Settings',
          record_id: editingOfferId,
          details: { table: 'offers', title: offerForm.title },
        });
      } else {
        const { error } = await supabase.from('offers').insert(offerData);
        if (error) throw error;
        logAudit({
          action: 'CREATE',
          module: 'Settings',
          record_id: offerForm.title,
          details: { table: 'offers', title: offerForm.title },
          trackChangelog: true,
          changelogTitle: `New Offer Created — ${offerForm.title}`,
          changelogDescription: `Created new promotional offer "${offerForm.title}".`,
          changelogCategory: 'feature',
        });
      }
    } catch {
      // Fallback to localStorage if Supabase table doesn't exist
      const localOffers = [...offers];
      if (editingOfferId) {
        const idx = localOffers.findIndex(o => o.id === editingOfferId);
        if (idx >= 0) localOffers[idx] = { ...localOffers[idx], ...offerData };
      } else {
        localOffers.push({ ...offerData, id: crypto.randomUUID(), created_at: now } as Offer);
      }
      localStorage.setItem('snackoh_offers', JSON.stringify(localOffers));
    }

    // Save rotation settings
    localStorage.setItem('snackoh_offer_rotation', JSON.stringify(offerRotation));

    setShowOfferForm(false);
    setEditingOfferId(null);
    setOfferForm(emptyOffer);
    setSavedMsg(editingOfferId ? 'Offer updated!' : 'Offer created!');
    setTimeout(() => setSavedMsg(''), 3000);
    loadOffers();
  };

  const deleteOffer = async (id: string) => {
    try {
      const { error } = await supabase.from('offers').delete().eq('id', id);
      if (error) throw error;
      logAudit({
        action: 'DELETE',
        module: 'Settings',
        record_id: id,
        details: { table: 'offers' },
      });
    } catch {
      const localOffers = offers.filter(o => o.id !== id);
      localStorage.setItem('snackoh_offers', JSON.stringify(localOffers));
    }
    setSavedMsg('Offer deleted');
    setTimeout(() => setSavedMsg(''), 3000);
    loadOffers();
  };

  const toggleOfferActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('offers').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      logAudit({
        action: 'UPDATE',
        module: 'Settings',
        record_id: id,
        details: { table: 'offers', is_active: !current },
      });
    } catch {
      const localOffers = offers.map(o => o.id === id ? { ...o, is_active: !current } : o);
      localStorage.setItem('snackoh_offers', JSON.stringify(localOffers));
    }
    loadOffers();
  };

  const editOffer = (offer: Offer) => {
    setOfferForm({
      id: offer.id,
      title: offer.title,
      description: offer.description || '',
      image_url: offer.image_url || '',
      link_url: offer.link_url || '/shop',
      badge_text: offer.badge_text || 'Limited Time',
      discount_text: offer.discount_text || '',
      product_id: offer.product_id || '',
      is_active: offer.is_active,
      start_date: offer.start_date ? offer.start_date.slice(0, 16) : '',
      end_date: offer.end_date ? offer.end_date.slice(0, 16) : '',
      sort_order: offer.sort_order || 0,
    });
    setEditingOfferId(offer.id);
    setShowOfferForm(true);
  };

  // Load from database first, then localStorage fallback
  useEffect(() => {
    async function loadFromDb() {
      try {
        const { data, error } = await supabase.from('business_settings').select('key, value');
        if (!error && data && data.length > 0) {
          const settings: Record<string, unknown> = {};
          for (const row of data) settings[row.key] = row.value;
          if (settings.general) setGeneral(prev => ({ ...prev, ...(settings.general as Record<string, unknown>) }));
          if (settings.chatGptAi) setChatGptSettings(prev => ({ ...prev, ...(settings.chatGptAi as Record<string, unknown>) }));
          if (settings.receipt) setReceipt(prev => ({ ...prev, ...(settings.receipt as Record<string, unknown>) }));
          if (settings.paymentDetails) setPaymentDetails(prev => ({ ...prev, ...(settings.paymentDetails as Record<string, unknown>) }));
          if (settings.posCard) setPosCard(prev => ({ ...prev, ...(settings.posCard as Record<string, unknown>) }));
          if (settings.security) setSecurity(prev => ({ ...prev, ...(settings.security as Record<string, unknown>) }));
          if (settings.backup) setBackup(prev => ({ ...prev, ...(settings.backup as Record<string, unknown>) }));
          if (settings.delivery) setDelivery(prev => ({ ...prev, ...(settings.delivery as Record<string, unknown>) }));
          if (settings.kraEtims) setKraEtims(prev => ({ ...prev, ...(settings.kraEtims as Record<string, unknown>) }));
          if (settings.shaNssf) setShaNssf(prev => ({ ...prev, ...(settings.shaNssf as Record<string, unknown>) }));
          if (settings.maintenance_mode) setMaintenanceMode(prev => ({ ...prev, ...(settings.maintenance_mode as Record<string, unknown>) }));
          return;
        }
      } catch {
        // Table may not exist yet
      }
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.general) setGeneral(prev => ({ ...prev, ...parsed.general }));
          if (parsed.chatGptAi) setChatGptSettings(prev => ({ ...prev, ...parsed.chatGptAi }));
          if (parsed.receipt) setReceipt(prev => ({ ...prev, ...parsed.receipt }));
          if (parsed.paymentDetails) setPaymentDetails(prev => ({ ...prev, ...parsed.paymentDetails }));
          if (parsed.posCard) setPosCard(prev => ({ ...prev, ...parsed.posCard }));
          if (parsed.security) setSecurity(prev => ({ ...prev, ...parsed.security }));
          if (parsed.backup) setBackup(prev => ({ ...prev, ...parsed.backup }));
          if (parsed.delivery) setDelivery(prev => ({ ...prev, ...parsed.delivery }));
          if (parsed.kraEtims) setKraEtims(prev => ({ ...prev, ...parsed.kraEtims }));
          if (parsed.shaNssf) setShaNssf(prev => ({ ...prev, ...parsed.shaNssf }));
        }
      } catch { /* ignore */ }
    }
    loadFromDb();
  }, []);

  // Load backup list on mount
  useEffect(() => { loadBackups(); }, []);

  const testChatGptConnection = async () => {
    setChatGptTesting(true);
    setChatGptTestResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/chatgpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'test' }),
      });
      const result = await res.json();
      if (result.success) {
        setChatGptTestResult({ success: true, message: 'ChatGPT AI connection successful! Netlify AI Gateway is active.' });
      } else {
        setChatGptTestResult({ success: false, message: result.message || `API error: ${res.status}` });
      }
    } catch (e) {
      setChatGptTestResult({ success: false, message: `Connection failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
    setChatGptTesting(false);
  };

  // ── Backup Functions ──
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/backup/list', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBackupList(data.backups);
        if (data.backups.length > 0) {
          setBackup(prev => ({ ...prev, lastBackup: new Date(data.backups[0].created_at).toLocaleString() }));
        }
      }
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setBackupLoading(false);
    }
  };

  const runManualBackup = async () => {
    setBackupRunning(true);
    setBackupMessage('');
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/backup/run', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setBackupMessage(`Backup completed! ${data.backup.tableCount} tables, ${data.backup.totalRows.toLocaleString()} rows (${formatBytes(data.backup.sizeBytes)})`);
        logAudit({ action: 'EXPORT', module: 'Backup', details: { trigger: 'manual', tables: data.backup.tableCount, rows: data.backup.totalRows }, trackChangelog: true, changelogTitle: 'Database Backup Completed', changelogDescription: `Manual database backup exported: ${data.backup.tableCount} tables, ${data.backup.totalRows.toLocaleString()} rows.`, changelogCategory: 'infrastructure' });
        loadBackups();
      } else {
        setBackupMessage(`Backup failed: ${data.message}`);
      }
    } catch (err) {
      setBackupMessage(`Backup error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBackupRunning(false);
    }
  };

  const downloadBackup = async (backupId: string, filename: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/backup/download?id=${encodeURIComponent(backupId)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setBackupMessage(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`/api/backup/download?id=${encodeURIComponent(backupId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBackupMessage('Backup deleted');
        loadBackups();
      } else {
        setBackupMessage(`Delete failed: ${data.message}`);
      }
    } catch (err) {
      setBackupMessage(`Delete error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const saveSettings = async () => {
    setSaving(true);
    const settingsData = { general, chatGptAi: chatGptSettings, receipt, paymentDetails, posCard, security, backup, delivery, navbarAds, newsletterModal, socialMedia, kraEtims, shaNssf, emailSettings };

    // Save to localStorage as fallback
    localStorage.setItem('snackoh_settings', JSON.stringify(settingsData));

    // Save to database
    try {
      for (const [key, value] of Object.entries(settingsData)) {
        await supabase.from('business_settings').upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      }
      logAudit({
        action: 'UPDATE',
        module: 'Settings',
        record_id: 'all',
        details: { keys: Object.keys(settingsData) },
      });
    } catch {
      // Table may not exist yet, localStorage is the fallback
    }

    setSaving(false);
    setSavedMsg('Settings saved successfully!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  // ── Active Sessions (from Supabase) ──
  const [sessions, setSessions] = useState<{ id: string; email: string; lastActive: string; device: string }[]>([]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessions([{ id: data.session.access_token.slice(-8), email: data.session.user.email || 'admin', lastActive: new Date().toLocaleString(), device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop' }]);
      }
    });
  }, []);

  // ── Bug Tracker: Load bugs ──
  const loadBugs = async () => {
    setBugsLoading(true);
    try {
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (bugFilter.status !== 'all') params.set('status', bugFilter.status);
      if (bugFilter.severity !== 'all') params.set('severity', bugFilter.severity);
      if (bugFilter.category !== 'all') params.set('category', bugFilter.category);
      if (bugFilter.search) params.set('search', bugFilter.search);
      params.set('limit', String(bugsPerPage));
      params.set('offset', String(bugPage * bugsPerPage));

      const res = await fetch(`/api/bugs?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBugs(data.bugs);
        setBugStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load bugs:', err);
    }
    setBugsLoading(false);
  };

  const loadLastScanInfo = async () => {
    try {
      const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'last_bug_scan').single();
      if (!error && data?.value) setLastScanInfo(data.value as Record<string, unknown>);
    } catch { /* ignore */ }
  };

  const runBugScan = async () => {
    setBugScanning(true);
    setBugScanResult(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/bugs/scan', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBugScanResult({
          success: true,
          message: `Scan complete: ${data.issues_found} issue(s) found, ${data.new_bugs} new, ${data.updated_bugs} updated, ${data.auto_resolved} auto-resolved (${data.duration_ms}ms)`,
        });
        loadBugs();
        loadLastScanInfo();
        logAudit({
          action: 'VIEW',
          module: 'Bug Tracker',
          record_id: data.scan_id,
          details: { issues_found: data.issues_found, new_bugs: data.new_bugs, trigger: 'manual' },
        });
      } else {
        setBugScanResult({ success: false, message: data.message || 'Scan failed' });
      }
    } catch (err) {
      setBugScanResult({ success: false, message: 'Network error: ' + (err instanceof Error ? err.message : 'Unknown') });
    }
    setBugScanning(false);
  };

  const updateBugStatus = async (bugId: string, status: string) => {
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/bugs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: bugId, status }),
      });
      const data = await res.json();
      if (data.success) {
        setBugs(prev => prev.map(b => b.id === bugId ? { ...b, ...data.bug } : b));
        loadBugs();
      }
    } catch (err) {
      console.error('Failed to update bug:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'bug-tracker') {
      loadBugs();
      loadLastScanInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, bugFilter.status, bugFilter.severity, bugFilter.category, bugPage]);

  // Debounced search for bug tracker
  useEffect(() => {
    if (activeTab !== 'bug-tracker') return;
    const timer = setTimeout(() => loadBugs(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bugFilter.search]);

  // ── Load Email Settings ──
  useEffect(() => {
    if (activeTab === 'email') {
      async function loadEmailSettings() {
        try {
          const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'emailSettings').single();
          if (!error && data?.value) {
            setEmailSettings(prev => ({ ...prev, ...(data.value as Record<string, unknown>) }));
            return;
          }
        } catch { /* table may not exist */ }
        try {
          const saved = localStorage.getItem('snackoh_settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.emailSettings) setEmailSettings(prev => ({ ...prev, ...parsed.emailSettings }));
          }
        } catch { /* ignore */ }
      }
      loadEmailSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabs: { key: SettingsTab; label: string; icon: string; tip: string }[] = [
    { key: 'general', label: 'General', icon: '🏢', tip: 'Business name, contact, tax & currency' },
    { key: 'chatgpt-ai', label: 'ChatGPT AI', icon: '🤖', tip: 'Configure ChatGPT AI for recipe generation & suggestions' },
    { key: 'offers', label: 'Offers', icon: '🏷️', tip: 'Manage promotional offers & banner content' },
    { key: 'navbar-ads', label: 'Navbar Ads', icon: '📢', tip: 'Scrolling marquee text on customer website navbar' },
    { key: 'newsletter', label: 'Newsletter', icon: '📧', tip: 'Newsletter modal settings & subscriber management' },
    { key: 'social-media', label: 'Social Media', icon: '📲', tip: 'Social media links for Instagram, TikTok, Facebook & more' },
    { key: 'receipt', label: 'Receipt', icon: '🧾', tip: 'Receipt layout, header, footer & printing' },
    { key: 'payment', label: 'Payment', icon: '💳', tip: 'M-Pesa paybill/till & bank details for receipts' },
    { key: 'family-bank', label: 'Family Bank', icon: '🏦', tip: 'Family Bank Paybill integration, C2B & B2C settings' },
    { key: 'posCard', label: 'POS Card', icon: '💳', tip: 'Card reader setup & POS card payment settings' },
    { key: 'kra-etims', label: 'KRA eTIMS', icon: '🏛️', tip: 'KRA eTIMS integration for auto tax submission per sale' },
    { key: 'sha-nssf', label: 'SHA/NSSF', icon: '🏥', tip: 'SHA, NSSF, NHIF government deductions & compliance' },
    { key: 'security', label: 'Security', icon: '🔒', tip: 'PIN policy, sessions, audit & access control' },
    { key: 'backup', label: 'Backup', icon: '💾', tip: 'Auto-backup schedule & data retention' },
    { key: 'delivery', label: 'Delivery', icon: '🚚', tip: 'Minimum order for delivery, delivery fees & thresholds' },
    { key: 'sessions', label: 'Sessions', icon: '👤', tip: 'Active login sessions & devices' },
    { key: 'maintenance', label: 'Maintenance', icon: '🔧', tip: 'Enable maintenance mode for the admin panel' },
    { key: 'bug-tracker', label: 'Bug Tracker', icon: '🐛', tip: 'Automatic bug detection, system health scanning & error monitoring' },
    { key: 'email', label: 'Email', icon: '✉️', tip: 'Configure Resend email for sending credentials to new users' },
  ];

  const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background';
  const labelCls = 'block text-xs text-muted-foreground mb-1 font-medium';

  // Products for the offer form dropdown
  const saleProducts = products.filter(p => p.isSale || p.inStock);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2">System Settings</h1>
          <p className="text-muted-foreground">Configure system preferences, receipt printing, payment details, security & backups</p>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
          <button onClick={saveSettings} disabled={saving} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} title={tab.tip} className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ── */}
      {activeTab === 'general' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Business Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Business Name</label><input type="text" value={general.businessName} onChange={e => setGeneral({ ...general, businessName: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Tagline</label><input type="text" value={general.tagline} onChange={e => setGeneral({ ...general, tagline: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Phone</label><input type="tel" value={general.phone} onChange={e => setGeneral({ ...general, phone: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Email</label><input type="email" value={general.email} onChange={e => setGeneral({ ...general, email: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Shop Number / Branch</label><input type="text" value={general.shopNumber} onChange={e => setGeneral({ ...general, shopNumber: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Address</label><input type="text" value={general.address} onChange={e => setGeneral({ ...general, address: e.target.value })} className={inputCls} /></div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Regional & Tax</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={labelCls}>Currency</label><select value={general.currency} onChange={e => setGeneral({ ...general, currency: e.target.value })} className={inputCls}><option>KES</option></select></div>
              <div><label className={labelCls}>Tax Rate (%)</label><input type="number" value={general.taxRate} onChange={e => setGeneral({ ...general, taxRate: parseFloat(e.target.value) || 0 })} className={inputCls} /></div>
              <div><label className={labelCls}>Timezone</label><select value={general.timezone} onChange={e => setGeneral({ ...general, timezone: e.target.value })} className={inputCls}><option>Africa/Nairobi</option><option>UTC</option><option>Europe/London</option></select></div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Logo</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload your company logo. It will be displayed on the admin panel, customer website, receipts, invoices, and reports.</p>
            <div className="flex items-start gap-6">
              <div className="bg-secondary rounded-lg flex items-center justify-center text-2xl font-black text-primary border-2 border-dashed border-border overflow-hidden flex-shrink-0" style={{ width: Math.max(96, general.logoHeight + 36), height: Math.max(96, general.logoHeight + 36) }}>
                {general.logoUrl ? <img src={general.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-lg" /> : 'S'}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className={labelCls}>Logo URL</label>
                  <input type="text" placeholder="Logo URL (auto-filled on upload)" value={general.logoUrl} onChange={e => setGeneral({ ...general, logoUrl: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Or Upload Logo File</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 file:cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSaving(true);
                      setSavedMsg('Uploading logo...');
                      try {
                        const ext = file.name.split('.').pop() || 'png';
                        const fileName = `company-logo-${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                        if (urlData?.publicUrl) {
                          setGeneral(prev => ({ ...prev, logoUrl: urlData.publicUrl }));
                          setSavedMsg('Logo uploaded! Click "Save All Settings" to apply.');
                        }
                      } catch (err) {
                        console.error('Logo upload error:', err);
                        setSavedMsg('Upload failed. You can paste a URL instead.');
                      }
                      setSaving(false);
                      setTimeout(() => setSavedMsg(''), 4000);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Recommended: PNG or SVG, at least 200x200px. The logo is stored in Supabase Storage and referenced across all pages.</p>
                </div>
              </div>
            </div>

            {/* Logo Size Settings */}
            <div className="mt-6 pt-5 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">Logo Size Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Website / Landing Page Logo Height (px)</label>
                  <input type="range" min="30" max="120" step="5" value={general.logoHeight} onChange={e => setGeneral({ ...general, logoHeight: parseInt(e.target.value) })} className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>30px (small)</span>
                    <span className="font-semibold text-primary">{general.logoHeight}px</span>
                    <span>120px (large)</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Invoice Logo Height (px)</label>
                  <input type="range" min="30" max="120" step="5" value={general.invoiceLogoHeight} onChange={e => setGeneral({ ...general, invoiceLogoHeight: parseInt(e.target.value) })} className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>30px</span>
                    <span className="font-semibold text-primary">{general.invoiceLogoHeight}px</span>
                    <span>120px</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Report PDF Logo Height (px)</label>
                  <input type="range" min="30" max="120" step="5" value={general.reportLogoHeight} onChange={e => setGeneral({ ...general, reportLogoHeight: parseInt(e.target.value) })} className="w-full accent-primary" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>30px</span>
                    <span className="font-semibold text-primary">{general.reportLogoHeight}px</span>
                    <span>120px</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={general.logoWidthAuto} onChange={e => setGeneral({ ...general, logoWidthAuto: e.target.checked })} className="accent-primary w-4 h-4" />
                    <span className="text-sm">Auto width (maintain aspect ratio)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Logo Position on Customer Website */}
            <div className="mt-6 pt-5 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">Logo Position on Customer Website</h4>
              <p className="text-xs text-muted-foreground mb-3">Choose how the logo is displayed in the navigation bar on the customer-facing website.</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setGeneral({ ...general, logoPosition: 'left' })}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${general.logoPosition === 'left' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                >
                  <div className="text-sm font-medium mb-1">Left (Default)</div>
                  <p className="text-xs text-muted-foreground mb-3">Logo on the left, navigation links on the right.</p>
                  <div className="bg-secondary rounded-lg p-2 flex items-center gap-3 h-10">
                    <div className="w-8 h-6 bg-primary/30 rounded" />
                    <div className="flex gap-2 ml-auto">
                      <div className="w-8 h-2 bg-muted-foreground/30 rounded" />
                      <div className="w-8 h-2 bg-muted-foreground/30 rounded" />
                      <div className="w-8 h-2 bg-muted-foreground/30 rounded" />
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setGeneral({ ...general, logoPosition: 'center' })}
                  className={`p-4 rounded-lg border-2 transition-colors text-left ${general.logoPosition === 'center' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                >
                  <div className="text-sm font-medium mb-1">Center (Between Nav Items)</div>
                  <p className="text-xs text-muted-foreground mb-3">Logo centered horizontally between navigation menu items.</p>
                  <div className="bg-secondary rounded-lg p-2 flex items-center justify-center gap-3 h-10">
                    <div className="flex gap-2">
                      <div className="w-6 h-2 bg-muted-foreground/30 rounded" />
                      <div className="w-6 h-2 bg-muted-foreground/30 rounded" />
                    </div>
                    <div className="w-8 h-6 bg-primary/30 rounded" />
                    <div className="flex gap-2">
                      <div className="w-6 h-2 bg-muted-foreground/30 rounded" />
                      <div className="w-6 h-2 bg-muted-foreground/30 rounded" />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Report Watermark Settings */}
            <div className="mt-6 pt-5 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">PDF Report Watermark</h4>
              <p className="text-xs text-muted-foreground mb-3">Display your logo as a semi-transparent watermark behind the content on PDF reports and invoices.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={general.reportWatermarkEnabled} onChange={e => setGeneral({ ...general, reportWatermarkEnabled: e.target.checked })} className="accent-primary w-4 h-4" />
                    <span className="text-sm">Enable logo watermark on PDFs</span>
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Watermark Opacity (%)</label>
                  <input type="range" min="3" max="25" step="1" value={general.reportWatermarkOpacity} onChange={e => setGeneral({ ...general, reportWatermarkOpacity: parseInt(e.target.value) })} className="w-full accent-primary" disabled={!general.reportWatermarkEnabled} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>3% (subtle)</span>
                    <span className="font-semibold text-primary">{general.reportWatermarkOpacity}%</span>
                    <span>25% (bold)</span>
                  </div>
                </div>
              </div>
              {general.logoUrl && general.reportWatermarkEnabled && (
                <div className="mt-3 p-4 bg-secondary/30 rounded-lg border border-border relative overflow-hidden" style={{ minHeight: 80 }}>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img src={general.logoUrl} alt="Watermark Preview" style={{ opacity: general.reportWatermarkOpacity / 100, maxWidth: '60%', maxHeight: '60px' }} />
                  </div>
                  <p className="text-xs text-muted-foreground relative z-10 text-center">Watermark preview (sample text behind logo)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHATGPT AI ── */}
      {activeTab === 'chatgpt-ai' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-1">ChatGPT AI Configuration</h3>
            <p className="text-xs text-muted-foreground mb-4">ChatGPT AI is powered by Netlify AI Gateway — no API key needed. Auto-generate recipes based on your inventory items with AI-powered recipe formulation.</p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable ChatGPT AI</p>
                  <p className="text-xs text-muted-foreground">Allow AI recipe generation in the Recipes module</p>
                </div>
                <button type="button" onClick={() => setChatGptSettings({ ...chatGptSettings, enabled: !chatGptSettings.enabled })} className={`w-10 h-5 rounded-full transition-colors ${chatGptSettings.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${chatGptSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Powered by Netlify AI Gateway</p>
                <p className="text-xs text-green-700 mt-1">No API key required — ChatGPT access is automatically provided through Netlify AI Gateway at no extra cost.</p>
              </div>

              <div>
                <label className={labelCls}>Model</label>
                <select value={chatGptSettings.model} onChange={e => setChatGptSettings({ ...chatGptSettings, model: e.target.value })} className={inputCls}>
                  <option value="gpt-4o-mini">GPT-4o Mini (Recommended - Fast & Free)</option>
                  <option value="gpt-4o">GPT-4o (More Capable)</option>
                  <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                  <option value="gpt-4.1-nano">GPT-4.1 Nano (Fastest)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Max Tokens</label>
                  <input type="number" value={chatGptSettings.maxTokens} onChange={e => setChatGptSettings({ ...chatGptSettings, maxTokens: parseInt(e.target.value) || 2048 })} className={inputCls} min={256} max={8192} />
                </div>
                <div>
                  <label className={labelCls}>Temperature (Creativity)</label>
                  <input type="number" step="0.1" min="0" max="2" value={chatGptSettings.temperature} onChange={e => setChatGptSettings({ ...chatGptSettings, temperature: parseFloat(e.target.value) || 0.7 })} className={inputCls} />
                  <p className="text-xs text-muted-foreground mt-1">Lower = more precise, Higher = more creative</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Test Connection</h3>
            <div className="flex items-center gap-3">
              <button onClick={testChatGptConnection} disabled={chatGptTesting} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
                {chatGptTesting ? 'Testing...' : 'Test ChatGPT Connection'}
              </button>
              {chatGptTestResult && (
                <span className={`text-sm font-medium ${chatGptTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {chatGptTestResult.message}
                </span>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-2">How It Works</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Go to <strong>Recipes & Products</strong> and click <strong>&quot;AI Generate Recipe&quot;</strong></p>
              <p>2. Enter a product name or description (e.g. &quot;Chocolate Croissant&quot;)</p>
              <p>3. ChatGPT AI will formulate a recipe with ingredients, quantities, and instructions</p>
              <p>4. The AI checks your <strong>inventory items</strong> — if an ingredient isn&apos;t in stock, it flags it</p>
              <p>5. Review and adjust the auto-filled recipe, then save</p>
            </div>
          </div>
        </div>
      )}

      {/* ── OFFERS ── */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          {/* Rotation Settings */}
          <div className="border border-border rounded-lg p-6 bg-card max-w-2xl">
            <h3 className="font-semibold mb-4">Banner Rotation Settings</h3>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-3">
                <span className="text-sm font-medium">Auto-rotate banners</span>
                <button type="button" onClick={() => setOfferRotation({ ...offerRotation, enabled: !offerRotation.enabled })} className={`w-10 h-5 rounded-full transition-colors ${offerRotation.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${offerRotation.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <div className="flex items-center gap-2">
                <label className={labelCls + ' mb-0'}>Interval (seconds)</label>
                <input type="number" min={2} max={30} value={offerRotation.interval} onChange={e => setOfferRotation({ ...offerRotation, interval: parseInt(e.target.value) || 5 })} className={`${inputCls} w-20`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Active offers will rotate automatically in the hero banner on the customer website. Product offers (items on sale) are also included dynamically.</p>
          </div>

          {/* Offer List + Add */}
          <div className="flex items-center justify-between max-w-4xl">
            <div>
              <h3 className="font-semibold">Promotional Offers</h3>
              <p className="text-xs text-muted-foreground">Create custom banner offers for the customer website. Products currently on sale are automatically included.</p>
            </div>
            <button onClick={() => { setOfferForm(emptyOffer); setEditingOfferId(null); setShowOfferForm(true); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm">
              + Add Offer
            </button>
          </div>

          {/* Offer Form Modal */}
          {showOfferForm && (
            <div className="border border-primary/30 rounded-lg p-6 bg-primary/5 max-w-2xl space-y-4">
              <h4 className="font-semibold text-sm">{editingOfferId ? 'Edit Offer' : 'New Offer'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={labelCls}>Offer Title *</label><input type="text" value={offerForm.title} onChange={e => setOfferForm({ ...offerForm, title: e.target.value })} placeholder="e.g. 25% Off All Cakes" className={inputCls} /></div>
                <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={offerForm.description} onChange={e => setOfferForm({ ...offerForm, description: e.target.value })} placeholder="Brief description shown under the title" className={`${inputCls} h-20 resize-none`} /></div>
                <div className="col-span-2"><label className={labelCls}>Banner Image URL</label><input type="text" value={offerForm.image_url} onChange={e => setOfferForm({ ...offerForm, image_url: e.target.value })} placeholder="https://images.unsplash.com/... or upload to storage" className={inputCls} /></div>
                <div className="col-span-2">
                  <label className={labelCls}>Or Upload Banner Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={offerUploading}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 file:cursor-pointer disabled:opacity-60"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setOfferUploading(true);
                      setSavedMsg('Uploading offer image...');
                      try {
                        const ext = file.name.split('.').pop() || 'jpg';
                        const baseName = file.name.replace(/\.[^.]+$/, '');
                        const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '-');
                        const fileName = `offer-${Date.now()}-${safeName}.${ext}`;
                        const { error: uploadError } = await supabase.storage.from('offers').upload(fileName, file, { upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage.from('offers').getPublicUrl(fileName);
                        if (urlData?.publicUrl) {
                          setOfferForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
                          setSavedMsg('Offer image uploaded.');
                        }
                      } catch (err) {
                        console.error('Offer image upload error:', err);
                        setSavedMsg('Upload failed. You can paste a URL instead.');
                      }
                      setOfferUploading(false);
                      setTimeout(() => setSavedMsg(''), 4000);
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Images are stored in the Supabase Storage `offers` bucket.</p>
                </div>
                {offerForm.image_url && (
                  <div className="col-span-2">
                    <div className="rounded-lg overflow-hidden h-32 bg-gray-100">
                      <img src={offerForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                <div><label className={labelCls}>Badge Text</label><input type="text" value={offerForm.badge_text} onChange={e => setOfferForm({ ...offerForm, badge_text: e.target.value })} placeholder="e.g. Limited Time, Weekend Special" className={inputCls} /></div>
                <div><label className={labelCls}>Discount Text</label><input type="text" value={offerForm.discount_text} onChange={e => setOfferForm({ ...offerForm, discount_text: e.target.value })} placeholder="e.g. 25% OFF, Buy 1 Get 1 Free" className={inputCls} /></div>
                <div><label className={labelCls}>Link URL</label><input type="text" value={offerForm.link_url} onChange={e => setOfferForm({ ...offerForm, link_url: e.target.value })} placeholder="/shop or /shop?category=Cake" className={inputCls} /></div>
                <div>
                  <label className={labelCls}>Link to Product (optional)</label>
                  <select value={offerForm.product_id} onChange={e => setOfferForm({ ...offerForm, product_id: e.target.value })} className={inputCls}>
                    <option value="">-- No product link --</option>
                    {saleProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category}) — KES {p.price}</option>
                    ))}
                  </select>
                </div>
                <div><label className={labelCls}>Start Date</label><input type="datetime-local" value={offerForm.start_date} onChange={e => setOfferForm({ ...offerForm, start_date: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>End Date</label><input type="datetime-local" value={offerForm.end_date} onChange={e => setOfferForm({ ...offerForm, end_date: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Sort Order</label><input type="number" value={offerForm.sort_order} onChange={e => setOfferForm({ ...offerForm, sort_order: parseInt(e.target.value) || 0 })} className={inputCls} /></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3">
                    <span className="text-sm font-medium">Active</span>
                    <button type="button" onClick={() => setOfferForm({ ...offerForm, is_active: !offerForm.is_active })} className={`w-10 h-5 rounded-full transition-colors ${offerForm.is_active ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${offerForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveOffer} disabled={!offerForm.title} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm disabled:opacity-50">
                  {editingOfferId ? 'Update Offer' : 'Create Offer'}
                </button>
                <button onClick={() => { setShowOfferForm(false); setEditingOfferId(null); setOfferForm(emptyOffer); }} className="px-5 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Existing Offers */}
          <div className="max-w-4xl space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Custom Offers</h4>
            {offersLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading offers...</p>
            ) : offers.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <p className="text-muted-foreground text-sm">No custom offers yet. Click &quot;+ Add Offer&quot; to create your first promotional banner.</p>
              </div>
            ) : (
              offers.map(offer => (
                <div key={offer.id} className={`border rounded-lg p-4 flex items-center gap-4 ${offer.is_active ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-70'}`}>
                  {offer.image_url ? (
                    <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-24 h-16 rounded-lg bg-orange-100 flex items-center justify-center shrink-0 text-2xl">🏷️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{offer.title}</p>
                      {offer.badge_text && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">{offer.badge_text}</span>}
                      {offer.is_active ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">Active</span> : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold">Inactive</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{offer.description || 'No description'}</p>
                    {offer.discount_text && <p className="text-xs font-bold text-orange-600 mt-0.5">{offer.discount_text}</p>}
                    {offer.product_id && <p className="text-[10px] text-muted-foreground mt-0.5">Linked product: {products.find(p => p.id === offer.product_id)?.name || offer.product_id}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleOfferActive(offer.id, offer.is_active)} className={`px-3 py-1.5 rounded text-xs font-medium ${offer.is_active ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                      {offer.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => editOffer(offer)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium">Edit</button>
                    <button onClick={() => deleteOffer(offer.id)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Auto-generated Product Offers Preview */}
          <div className="max-w-4xl space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Auto-Generated Product Banners</h4>
            <p className="text-xs text-muted-foreground">These banners are automatically generated from products that have sale prices. They rotate alongside your custom offers.</p>
            <div className="space-y-2">
              {products.filter(p => p.isSale && p.originalPrice).map(p => (
                <div key={p.id} className="border border-border rounded-lg p-3 flex items-center gap-3 bg-card">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category} — <span className="text-orange-600 font-bold">KES {p.price}</span> <span className="line-through text-gray-400">KES {p.originalPrice}</span> — Save {Math.round(((p.originalPrice! - p.price) / p.originalPrice!) * 100)}%</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold shrink-0">Auto</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── NAVBAR ADS (Marquee) ── */}
      {activeTab === 'navbar-ads' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-2">Navbar Marquee Text</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure the scrolling text that appears on the announcement bar at the top of the customer website. These items scroll infinitely from right to left.</p>
            <label className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Enable Navbar Ads</p>
                <p className="text-xs text-muted-foreground">Show scrolling marquee on customer site</p>
              </div>
              <button type="button" onClick={() => setNavbarAds({ ...navbarAds, enabled: !navbarAds.enabled })} className={`w-10 h-5 rounded-full transition-colors ${navbarAds.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${navbarAds.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>

            <div className="space-y-2 mb-4">
              {navbarAds.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6 shrink-0">{idx + 1}.</span>
                  <input type="text" value={item}
                    onChange={e => {
                      const newItems = [...navbarAds.items];
                      newItems[idx] = e.target.value;
                      setNavbarAds({ ...navbarAds, items: newItems });
                    }}
                    className={`${inputCls} flex-1`} />
                  <button onClick={() => {
                    const newItems = navbarAds.items.filter((_, i) => i !== idx);
                    setNavbarAds({ ...navbarAds, items: newItems });
                  }} className="px-2 py-1 text-red-500 hover:bg-red-50 rounded text-xs font-medium">Remove</button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input type="text" placeholder="Add new marquee item..." value={newNavbarItem}
                onChange={e => setNewNavbarItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newNavbarItem.trim()) {
                    setNavbarAds({ ...navbarAds, items: [...navbarAds.items, newNavbarItem.trim()] });
                    setNewNavbarItem('');
                  }
                }}
                className={inputCls} />
              <button onClick={() => {
                if (newNavbarItem.trim()) {
                  setNavbarAds({ ...navbarAds, items: [...navbarAds.items, newNavbarItem.trim()] });
                  setNewNavbarItem('');
                }
              }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm shrink-0">
                + Add
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Preview</h3>
            <div className="bg-orange-600 text-white text-xs py-2.5 font-medium tracking-wide overflow-hidden whitespace-nowrap rounded-lg">
              <div className="inline-flex" style={{ animation: 'marquee 15s linear infinite' }}>
                <span className="inline-block">
                  {navbarAds.items.map(item => `  •  ${item}`).join('')}
                  {navbarAds.items.map(item => `  •  ${item}`).join('')}
                </span>
              </div>
              <style>{`@keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }`}</style>
            </div>
          </div>

          <button onClick={saveNavbarAds} disabled={saving}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Navbar Ads'}
          </button>
        </div>
      )}

      {/* ── NEWSLETTER MODAL ── */}
      {activeTab === 'newsletter' && (
        <div className="space-y-6">
          {/* Modal Configuration */}
          <div className="max-w-2xl border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-2">Newsletter Popup Modal</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure the newsletter subscription modal that appears on the customer website. Visitors can subscribe for a discount code.</p>

            <label className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Enable Newsletter Popup</p>
                <p className="text-xs text-muted-foreground">Show popup to first-time visitors</p>
              </div>
              <button type="button" onClick={() => setNewsletterModal({ ...newsletterModal, enabled: !newsletterModal.enabled })} className={`w-10 h-5 rounded-full transition-colors ${newsletterModal.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${newsletterModal.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Subtitle (small text)</label><input type="text" value={newsletterModal.subtitle} onChange={e => setNewsletterModal({ ...newsletterModal, subtitle: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Title (large heading)</label><input type="text" value={newsletterModal.title} onChange={e => setNewsletterModal({ ...newsletterModal, title: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Description</label><textarea value={newsletterModal.description} onChange={e => setNewsletterModal({ ...newsletterModal, description: e.target.value })} className={`${inputCls} h-20 resize-none`} /></div>
              <div><label className={labelCls}>Discount Code</label><input type="text" value={newsletterModal.discountCode} onChange={e => setNewsletterModal({ ...newsletterModal, discountCode: e.target.value })} placeholder="e.g. WELCOME15" className={inputCls} /></div>
              <div><label className={labelCls}>Popup Delay (seconds)</label><input type="number" min={1} max={60} value={newsletterModal.delaySeconds} onChange={e => setNewsletterModal({ ...newsletterModal, delaySeconds: parseInt(e.target.value) || 5 })} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Modal Image URL</label><input type="text" value={newsletterModal.image} onChange={e => setNewsletterModal({ ...newsletterModal, image: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2">
                <label className={labelCls}>Or Upload Modal Image</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={newsletterImageUploading}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 file:cursor-pointer disabled:opacity-60"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNewsletterImageUploading(true);
                    setSavedMsg('Uploading newsletter image...');
                    try {
                      const ext = file.name.split('.').pop() || 'jpg';
                      const fileName = `newsletter-${Date.now()}.${ext}`;
                      const { error: uploadError } = await supabase.storage.from('offers').upload(fileName, file, { upsert: true });
                      if (uploadError) throw uploadError;
                      const { data: urlData } = supabase.storage.from('offers').getPublicUrl(fileName);
                      if (urlData?.publicUrl) {
                        setNewsletterModal(prev => ({ ...prev, image: urlData.publicUrl }));
                        setSavedMsg('Newsletter image uploaded.');
                      }
                    } catch (err) {
                      console.error('Newsletter image upload error:', err);
                      setSavedMsg('Upload failed. You can paste a URL instead.');
                    }
                    setNewsletterImageUploading(false);
                    setTimeout(() => setSavedMsg(''), 4000);
                  }}
                />
              </div>
              {newsletterModal.image && (
                <div className="col-span-2">
                  <div className="rounded-lg overflow-hidden h-32 bg-gray-100 w-48">
                    <img src={newsletterModal.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveNewsletterModal} disabled={saving}
              className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Newsletter Settings'}
            </button>
          </div>

          {/* Modal Preview */}
          <div className="max-w-2xl border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Modal Preview</h3>
            <div className="bg-gray-100 rounded-xl p-6 flex justify-center">
              <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full overflow-hidden flex">
                {newsletterModal.image && (
                  <div className="w-1/3 hidden sm:block">
                    <img src={newsletterModal.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 p-5">
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">{newsletterModal.subtitle}</p>
                  <h4 className="text-base font-black text-gray-900 mb-1">{newsletterModal.title}</h4>
                  <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">{newsletterModal.description}</p>
                  <div className="bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-400 mb-2">Enter Your Email</div>
                  <div className="bg-orange-600 text-white rounded-lg py-2 text-center text-xs font-bold">Subscribe</div>
                </div>
              </div>
            </div>
          </div>

          {/* Subscribers List */}
          <div className="max-w-4xl border border-border rounded-lg p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Newsletter Subscribers</h3>
                <p className="text-xs text-muted-foreground">All email subscribers from the modal and footer forms.</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{subscribers.length} total</span>
            </div>

            {subscribersLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading subscribers...</p>
            ) : subscribers.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <p className="text-muted-foreground text-sm">No subscribers yet. The newsletter popup and footer form will collect emails here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-bold text-muted-foreground py-2 px-2">Email</th>
                      <th className="text-left text-xs font-bold text-muted-foreground py-2 px-2">Source</th>
                      <th className="text-left text-xs font-bold text-muted-foreground py-2 px-2">Discount Code</th>
                      <th className="text-left text-xs font-bold text-muted-foreground py-2 px-2">Date</th>
                      <th className="text-right text-xs font-bold text-muted-foreground py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map(sub => (
                      <tr key={sub.id} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-2 px-2 font-medium">{sub.email}</td>
                        <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sub.source === 'modal' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{sub.source || 'unknown'}</span></td>
                        <td className="py-2 px-2 font-mono text-xs">{sub.discount_code || '-'}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : '-'}</td>
                        <td className="py-2 px-2 text-right">
                          <button onClick={() => deleteSubscriber(sub.id)} className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded text-xs font-medium">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SOCIAL MEDIA ── */}
      {activeTab === 'social-media' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-1">Social Media Links</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure your social media accounts. These links appear in the website footer.</p>
            <div className="space-y-5">
              {/* Instagram */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📸</span>
                  <h4 className="font-semibold text-sm">Instagram</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Handle</label>
                    <input className={inputCls} value={socialMedia.instagram} onChange={e => setSocialMedia({ ...socialMedia, instagram: e.target.value })} placeholder="@snackohbites" />
                  </div>
                  <div>
                    <label className={labelCls}>URL</label>
                    <input className={inputCls} value={socialMedia.instagramUrl} onChange={e => setSocialMedia({ ...socialMedia, instagramUrl: e.target.value })} placeholder="https://www.instagram.com/snackohbites" />
                  </div>
                </div>
              </div>
              {/* TikTok */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🎵</span>
                  <h4 className="font-semibold text-sm">TikTok</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Handle</label>
                    <input className={inputCls} value={socialMedia.tiktok} onChange={e => setSocialMedia({ ...socialMedia, tiktok: e.target.value })} placeholder="@snackohbites" />
                  </div>
                  <div>
                    <label className={labelCls}>URL</label>
                    <input className={inputCls} value={socialMedia.tiktokUrl} onChange={e => setSocialMedia({ ...socialMedia, tiktokUrl: e.target.value })} placeholder="https://www.tiktok.com/@snackohbites" />
                  </div>
                </div>
              </div>
              {/* Facebook */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📘</span>
                  <h4 className="font-semibold text-sm">Facebook</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Page Name</label>
                    <input className={inputCls} value={socialMedia.facebook} onChange={e => setSocialMedia({ ...socialMedia, facebook: e.target.value })} placeholder="Snackoh Bites" />
                  </div>
                  <div>
                    <label className={labelCls}>URL</label>
                    <input className={inputCls} value={socialMedia.facebookUrl} onChange={e => setSocialMedia({ ...socialMedia, facebookUrl: e.target.value })} placeholder="https://www.facebook.com/SnackohBites" />
                  </div>
                </div>
              </div>
              {/* Twitter/X */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">𝕏</span>
                  <h4 className="font-semibold text-sm">Twitter / X</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Handle</label>
                    <input className={inputCls} value={socialMedia.twitter} onChange={e => setSocialMedia({ ...socialMedia, twitter: e.target.value })} placeholder="@snackohbites" />
                  </div>
                  <div>
                    <label className={labelCls}>URL</label>
                    <input className={inputCls} value={socialMedia.twitterUrl} onChange={e => setSocialMedia({ ...socialMedia, twitterUrl: e.target.value })} placeholder="https://x.com/snackohbites" />
                  </div>
                </div>
              </div>
              {/* YouTube */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">▶️</span>
                  <h4 className="font-semibold text-sm">YouTube</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Channel Name</label>
                    <input className={inputCls} value={socialMedia.youtube} onChange={e => setSocialMedia({ ...socialMedia, youtube: e.target.value })} placeholder="Snackoh Bites" />
                  </div>
                  <div>
                    <label className={labelCls}>URL</label>
                    <input className={inputCls} value={socialMedia.youtubeUrl} onChange={e => setSocialMedia({ ...socialMedia, youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/@snackohbites" />
                  </div>
                </div>
              </div>
              {/* WhatsApp */}
              <div className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">💬</span>
                  <h4 className="font-semibold text-sm">WhatsApp</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input className={inputCls} value={socialMedia.whatsapp} onChange={e => setSocialMedia({ ...socialMedia, whatsapp: e.target.value })} placeholder="+254 700 000 000" />
                  </div>
                  <div>
                    <label className={labelCls}>Chat Link</label>
                    <input className={inputCls} value={socialMedia.whatsappUrl} onChange={e => setSocialMedia({ ...socialMedia, whatsappUrl: e.target.value })} placeholder="https://wa.me/254700000000" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECEIPT ── */}
      {activeTab === 'receipt' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="font-semibold mb-4">Receipt Content</h3>
              <div className="space-y-3">
                <div><label className={labelCls}>Header Text (Business Name on Receipt)</label><input type="text" value={receipt.headerText} onChange={e => setReceipt({ ...receipt, headerText: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Sub-Header</label><input type="text" value={receipt.subHeaderText} onChange={e => setReceipt({ ...receipt, subHeaderText: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Footer Message</label><input type="text" value={receipt.footerText} onChange={e => setReceipt({ ...receipt, footerText: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Disclaimer</label><input type="text" value={receipt.disclaimer} onChange={e => setReceipt({ ...receipt, disclaimer: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Software Provided By</label><input type="text" value={receipt.softwareProvidedBy} onChange={e => setReceipt({ ...receipt, softwareProvidedBy: e.target.value })} className={inputCls} /></div>
              </div>
            </div>
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="font-semibold mb-4">Receipt Options</h3>
              <div className="space-y-3">
                {[
                  { key: 'showLogo', label: 'Show logo on receipt' },
                  { key: 'showTax', label: 'Show tax breakdown' },
                  { key: 'showCashier', label: 'Show cashier name' },
                  { key: 'showCustomer', label: 'Show customer name' },
                  { key: 'showPaymentDetails', label: 'Show payment details (Paybill/Till)' },
                  { key: 'autoPrint', label: 'Auto-print after sale' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">{opt.label}</span>
                    <button type="button" onClick={() => setReceipt({ ...receipt, [opt.key]: !receipt[opt.key as keyof typeof receipt] })} className={`w-10 h-5 rounded-full transition-colors ${receipt[opt.key as keyof typeof receipt] ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${receipt[opt.key as keyof typeof receipt] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                ))}
                <div><label className={labelCls}>Paper Width</label><select value={receipt.paperWidth} onChange={e => setReceipt({ ...receipt, paperWidth: e.target.value })} className={inputCls}><option>58mm</option><option>80mm</option></select></div>
              </div>
            </div>
          </div>

          {/* Receipt Preview */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Receipt Preview</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-[300px] mx-auto font-mono text-[11px] shadow-sm">
              <div className="text-center mb-2">
                {receipt.showLogo && general.logoUrl && (
                  <img src={general.logoUrl} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-1" />
                )}
                <p className="text-sm font-black">{receipt.headerText}</p>
                <p className="text-[10px]">{receipt.subHeaderText}</p>
                <p className="text-[10px]">{general.phone}</p>
                {general.email && <p className="text-[10px]">{general.email}</p>}
                {general.shopNumber && <p className="text-[10px]">Shop No: {general.shopNumber}</p>}
                <p className="text-[10px]">{general.address}</p>
                <hr className="border-dashed my-2" />
                <p className="text-[10px]">Receipt: SNK-SAMPLE</p>
                <p className="text-[10px]">{new Date().toLocaleString()}</p>
                {receipt.showCashier && <p className="text-[10px]">Cashier: John Mwangi</p>}
                {receipt.showCustomer && <p className="text-[10px]">Customer: Walk-in</p>}
              </div>
              <hr className="border-dashed my-2" />
              <div className="space-y-1">
                <div className="flex justify-between"><span>White Bread x2</span><span>400</span></div>
                <div className="flex justify-between"><span>Croissant x3</span><span>450</span></div>
              </div>
              <hr className="border-dashed my-2" />
              <div className="flex justify-between"><span>Subtotal:</span><span>850</span></div>
              {receipt.showTax && <div className="flex justify-between"><span>VAT ({general.taxRate}%):</span><span>{Math.round(850 * general.taxRate / 100)}</span></div>}
              <div className="flex justify-between font-bold text-xs mt-1"><span>TOTAL:</span><span>{general.currency} {850 + Math.round(850 * general.taxRate / 100)}</span></div>
              <hr className="border-dashed my-2" />
              <div className="flex justify-between"><span>Cash:</span><span>1000</span></div>
              <div className="flex justify-between"><span>Change:</span><span>{1000 - 850 - Math.round(850 * general.taxRate / 100)}</span></div>

              {/* Payment Details Preview */}
              {receipt.showPaymentDetails && paymentDetails.showOnReceipt && (
                <>
                  <hr className="border-dashed my-2" />
                  <div className="text-center text-[10px]">
                    <p className="font-bold mb-0.5">Payment Info:</p>
                    {paymentDetails.mpesaType === 'paybill' && paymentDetails.paybillNumber && (
                      <>
                        <p>M-Pesa Paybill: {paymentDetails.paybillNumber}</p>
                        {paymentDetails.accountNumber && <p>Account: {paymentDetails.accountNumber}</p>}
                      </>
                    )}
                    {paymentDetails.mpesaType === 'till' && paymentDetails.tillNumber && (
                      <p>M-Pesa Till: {paymentDetails.tillNumber}</p>
                    )}
                    {paymentDetails.mpesaName && <p>Name: {paymentDetails.mpesaName}</p>}
                    {paymentDetails.bankName && (
                      <>
                        <p className="font-bold mt-1">Bank Transfer:</p>
                        <p>{paymentDetails.bankName}</p>
                        {paymentDetails.bankAccount && <p>A/C: {paymentDetails.bankAccount}</p>}
                        {paymentDetails.bankBranch && <p>Branch: {paymentDetails.bankBranch}</p>}
                      </>
                    )}
                  </div>
                </>
              )}

              <hr className="border-dashed my-2" />
              <div className="text-center text-[10px]">
                <p>{receipt.footerText}</p>
                <p>{receipt.disclaimer}</p>
                {receipt.softwareProvidedBy && <p>Software provided by {receipt.softwareProvidedBy}</p>}
                <p className="font-bold mt-1">*** {receipt.headerText} ***</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT DETAILS ── */}
      {activeTab === 'payment' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">M-Pesa Payment Details</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure your M-Pesa payment details. These will appear on receipts so customers know where to pay.</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>M-Pesa Type</label>
                <div className="flex gap-3">
                  {(['paybill', 'till'] as const).map(type => (
                    <button key={type} onClick={() => setPaymentDetails({ ...paymentDetails, mpesaType: type })} className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${paymentDetails.mpesaType === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
                      {type === 'paybill' ? 'Paybill Number' : 'Till Number (Buy Goods)'}
                    </button>
                  ))}
                </div>
              </div>

              {paymentDetails.mpesaType === 'paybill' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Paybill Number</label>
                    <input type="text" placeholder="e.g. 522533" value={paymentDetails.paybillNumber} onChange={e => setPaymentDetails({ ...paymentDetails, paybillNumber: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Account Number</label>
                    <input type="text" placeholder="e.g. SNK001" value={paymentDetails.accountNumber} onChange={e => setPaymentDetails({ ...paymentDetails, accountNumber: e.target.value })} className={inputCls} />
                  </div>
                </div>
              )}

              {paymentDetails.mpesaType === 'till' && (
                <div>
                  <label className={labelCls}>Till Number</label>
                  <input type="text" placeholder="e.g. 5143433" value={paymentDetails.tillNumber} onChange={e => setPaymentDetails({ ...paymentDetails, tillNumber: e.target.value })} className={inputCls} />
                </div>
              )}

              <div>
                <label className={labelCls}>M-Pesa Registered Name</label>
                <input type="text" placeholder="e.g. SNACKOH BITES" value={paymentDetails.mpesaName} onChange={e => setPaymentDetails({ ...paymentDetails, mpesaName: e.target.value })} className={inputCls} />
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Show on Receipt</p>
                  <p className="text-xs text-muted-foreground">Display M-Pesa payment details on printed receipts</p>
                </div>
                <button type="button" onClick={() => setPaymentDetails({ ...paymentDetails, showOnReceipt: !paymentDetails.showOnReceipt })} className={`w-10 h-5 rounded-full transition-colors ${paymentDetails.showOnReceipt ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${paymentDetails.showOnReceipt ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Bank Details (Optional)</h3>
            <p className="text-sm text-muted-foreground mb-4">For bank transfer payments.</p>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={labelCls}>Bank Name</label><input type="text" placeholder="e.g. Equity Bank" value={paymentDetails.bankName} onChange={e => setPaymentDetails({ ...paymentDetails, bankName: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Account Number</label><input type="text" placeholder="Account number" value={paymentDetails.bankAccount} onChange={e => setPaymentDetails({ ...paymentDetails, bankAccount: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Branch</label><input type="text" placeholder="Branch name" value={paymentDetails.bankBranch} onChange={e => setPaymentDetails({ ...paymentDetails, bankBranch: e.target.value })} className={inputCls} /></div>
            </div>
          </div>

          {/* Preview of how it looks on receipt */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Receipt Payment Info Preview</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-[300px] mx-auto font-mono text-[11px] shadow-sm">
              <div className="text-center">
                <p className="font-bold mb-1">--- Payment Info ---</p>
                {paymentDetails.mpesaType === 'paybill' && paymentDetails.paybillNumber ? (
                  <>
                    <p>M-Pesa Paybill: <strong>{paymentDetails.paybillNumber}</strong></p>
                    {paymentDetails.accountNumber && <p>Account: <strong>{paymentDetails.accountNumber}</strong></p>}
                  </>
                ) : paymentDetails.mpesaType === 'till' && paymentDetails.tillNumber ? (
                  <p>M-Pesa Till: <strong>{paymentDetails.tillNumber}</strong></p>
                ) : (
                  <p className="text-gray-400 italic">No M-Pesa details configured</p>
                )}
                {paymentDetails.mpesaName && <p>Name: {paymentDetails.mpesaName}</p>}
                {paymentDetails.bankName && (
                  <>
                    <hr className="border-dashed my-1" />
                    <p>Bank: {paymentDetails.bankName}</p>
                    {paymentDetails.bankAccount && <p>A/C: {paymentDetails.bankAccount}</p>}
                    {paymentDetails.bankBranch && <p>Branch: {paymentDetails.bankBranch}</p>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── M-PESA API SETTINGS ── */}
      {activeTab === 'family-bank' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-blue-200 rounded-lg p-6 bg-blue-50/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">FB</div>
              <h3 className="font-semibold text-blue-800">Family Bank Integration</h3>
            </div>
            <p className="text-sm text-blue-700">
              Configure Family Bank Paybill integration for receiving M-Pesa payments directly to your Family Bank account. Manage STK Push credentials, C2B registration, and B2C disbursements. The primary source is your <strong>environment variables</strong> (set on Netlify or in <code>.env.local</code>). You can also save a backup copy to the database below.
            </p>
          </div>

          {mpesaApiLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading Family Bank settings...</div>
          ) : (
            <>
              {/* Current Configuration Status */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Current Configuration</h3>
                  <button onClick={loadMpesaApiSettings} className="text-xs text-primary hover:underline font-medium">Refresh</button>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Values currently loaded from environment variables or database backup. Sensitive values are masked.</p>
                <div className="space-y-2">
                  {[
                    { key: 'mpesa_consumer_key', label: 'Consumer Key' },
                    { key: 'mpesa_consumer_secret', label: 'Consumer Secret' },
                    { key: 'mpesa_shortcode', label: 'Shortcode' },
                    { key: 'mpesa_passkey', label: 'Passkey' },
                    { key: 'mpesa_callback_url', label: 'Callback URL' },
                    { key: 'mpesa_env', label: 'Environment' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm font-medium">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${mpesaApiMasked[item.key] ? 'text-green-700' : 'text-red-500'}`}>
                          {mpesaApiMasked[item.key] || 'Not set'}
                        </span>
                        {mpesaApiSource[item.key] && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            mpesaApiSource[item.key] === 'env' ? 'bg-green-100 text-green-700' :
                            mpesaApiSource[item.key] === 'db' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {mpesaApiSource[item.key] === 'env' ? 'ENV' : mpesaApiSource[item.key] === 'db' ? 'DB' : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Connection */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-2">Test Connection</h3>
                <p className="text-xs text-muted-foreground mb-4">Send a test STK push to verify your M-Pesa credentials are working correctly.</p>
                <button
                  onClick={testMpesaConnection}
                  disabled={mpesaApiTesting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50"
                >
                  {mpesaApiTesting ? 'Testing...' : 'Test M-Pesa Connection'}
                </button>
                {mpesaApiTestResult && (
                  <div className={`mt-3 p-3 rounded-lg text-sm ${mpesaApiTestResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {mpesaApiTestResult.message}
                  </div>
                )}
              </div>

              {/* Update / Override Settings (DB Backup) */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-2">Update Settings (Database Backup)</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Override or set M-Pesa credentials via the database. These act as a backup when environment variables are not set. Leave fields empty to keep current values.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Consumer Key</label>
                      <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_consumer_key}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_consumer_key: e.target.value })}
                        placeholder="Leave empty to keep current" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Consumer Secret</label>
                      <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_consumer_secret}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_consumer_secret: e.target.value })}
                        placeholder="Leave empty to keep current" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Shortcode (Business Short Code)</label>
                      <input type="text" value={mpesaApi.mpesa_shortcode}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_shortcode: e.target.value })}
                        placeholder="e.g. 174379" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Passkey</label>
                      <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_passkey}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_passkey: e.target.value })}
                        placeholder="Leave empty to keep current" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Callback URL</label>
                      <input type="text" value={mpesaApi.mpesa_callback_url}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_callback_url: e.target.value })}
                        placeholder="Auto-detected from site URL" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Environment</label>
                      <select value={mpesaApi.mpesa_env} onChange={e => setMpesaApi({ ...mpesaApi, mpesa_env: e.target.value })} className={inputCls}>
                        <option value="">Keep current</option>
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showMpesaSecrets} onChange={e => setShowMpesaSecrets(e.target.checked)}
                      className="accent-orange-600 w-4 h-4" />
                    <span className="text-sm text-muted-foreground">Show secret values</span>
                  </label>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={saveMpesaApiSettings}
                      disabled={mpesaApiSaving}
                      className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm disabled:opacity-50"
                    >
                      {mpesaApiSaving ? 'Saving...' : 'Save to Database'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Family Bank Integration */}
              <div className="border border-blue-200 rounded-lg p-6 bg-blue-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">FB</div>
                  <h3 className="font-semibold">Family Bank Paybill Integration</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Configure Family Bank Paybill for receiving M-Pesa payments directly to your Family Bank account. Customers pay via Paybill and funds settle in your bank account.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Family Bank Paybill Number</label>
                      <input type="text" value={mpesaApi.mpesa_shortcode}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_shortcode: e.target.value })}
                        placeholder="e.g. 222111 (Family Bank Paybill)" className={inputCls} />
                      <p className="text-[10px] text-muted-foreground mt-1">This is your Family Bank M-Pesa Paybill number from Daraja</p>
                    </div>
                    <div>
                      <label className={labelCls}>Transaction Type</label>
                      <select value={mpesaApi.mpesa_env === 'production' ? 'CustomerPayBillOnline' : 'CustomerPayBillOnline'} className={inputCls} disabled>
                        <option value="CustomerPayBillOnline">Paybill (CustomerPayBillOnline)</option>
                        <option value="CustomerBuyGoodsOnline">Till (CustomerBuyGoodsOnline)</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">Family Bank uses Paybill transaction type</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-800 mb-1">How Family Bank C2B Works:</p>
                    <ul className="text-[11px] text-blue-700 space-y-0.5 list-disc list-inside">
                      <li>Customer receives STK Push on their phone</li>
                      <li>Payment goes to Family Bank Paybill number</li>
                      <li>Funds settle directly in your Family Bank account</li>
                      <li>M-Pesa callback confirms payment instantly</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* C2B Register URLs */}
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-2">C2B URL Registration</h3>
                <p className="text-xs text-muted-foreground mb-4">Register validation and confirmation URLs with M-Pesa to receive real-time payment notifications when customers pay via Paybill/Till directly (without STK Push).</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Confirmation URL</label>
                      <input type="text" value={mpesaApi.mpesa_callback_url ? mpesaApi.mpesa_callback_url.replace('/callback', '/c2b-register/confirmation') : ''}
                        className={inputCls} disabled placeholder="Auto-generated from site URL" />
                      <p className="text-[10px] text-muted-foreground mt-1">Receives payment confirmation after successful transaction</p>
                    </div>
                    <div>
                      <label className={labelCls}>Validation URL</label>
                      <input type="text" value={mpesaApi.mpesa_callback_url ? mpesaApi.mpesa_callback_url.replace('/callback', '/c2b-register/validation') : ''}
                        className={inputCls} disabled placeholder="Auto-generated from site URL" />
                      <p className="text-[10px] text-muted-foreground mt-1">Validates payment before processing (accepts all by default)</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/mpesa/c2b-register', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({}),
                        });
                        const data = await res.json();
                        setSavedMsg(data.success ? 'C2B URLs registered successfully!' : (data.message || 'Registration failed'));
                      } catch {
                        setSavedMsg('Failed to register C2B URLs');
                      }
                      setTimeout(() => setSavedMsg(''), 4000);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
                  >
                    Register C2B URLs with M-Pesa
                  </button>
                </div>
              </div>

              {/* B2C Settings */}
              <div className="border border-green-200 rounded-lg p-6 bg-green-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">B2C</div>
                  <div>
                    <h3 className="font-semibold">B2C Disbursement Configuration</h3>
                    <p className="text-[10px] text-muted-foreground">Business-to-Customer payments via M-Pesa (refunds, salary, promotions)</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Send money from your Family Bank business account to customer M-Pesa wallets. Used for refunds, salary payments, and promotional disbursements.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>B2C Shortcode</label>
                      <input type="text" value={mpesaApi.mpesa_b2c_shortcode}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_shortcode: e.target.value })}
                        placeholder="Your B2C shortcode" className={inputCls} />
                      <p className="text-[10px] text-muted-foreground mt-1">Shortcode registered for B2C on Daraja</p>
                    </div>
                    <div>
                      <label className={labelCls}>Initiator Name</label>
                      <input type="text" value={mpesaApi.mpesa_b2c_initiator_name}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_initiator_name: e.target.value })}
                        placeholder="API initiator username" className={inputCls} />
                      <p className="text-[10px] text-muted-foreground mt-1">Username set on M-Pesa portal for API access</p>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Security Credential</label>
                    <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_b2c_security_credential}
                      onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_security_credential: e.target.value })}
                      placeholder="Encrypted credential from Daraja portal" className={inputCls} />
                    <p className="text-[10px] text-muted-foreground mt-1">Generate this by encrypting your initiator password with the M-Pesa certificate</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>B2C Consumer Key</label>
                      <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_b2c_consumer_key}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_consumer_key: e.target.value })}
                        placeholder="B2C app consumer key" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>B2C Consumer Secret</label>
                      <input type={showMpesaSecrets ? 'text' : 'password'} value={mpesaApi.mpesa_b2c_consumer_secret}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_consumer_secret: e.target.value })}
                        placeholder="B2C app consumer secret" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>B2C Result URL</label>
                      <input type="text" value={mpesaApi.mpesa_b2c_result_url}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_result_url: e.target.value })}
                        placeholder="Auto-detected from site URL" className={inputCls} />
                      <p className="text-[10px] text-muted-foreground mt-1">Callback for B2C payment results</p>
                    </div>
                    <div>
                      <label className={labelCls}>B2C Timeout URL</label>
                      <input type="text" value={mpesaApi.mpesa_b2c_timeout_url}
                        onChange={e => setMpesaApi({ ...mpesaApi, mpesa_b2c_timeout_url: e.target.value })}
                        placeholder="Auto-detected from site URL" className={inputCls} />
                      <p className="text-[10px] text-muted-foreground mt-1">Callback for B2C timeout notifications</p>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-800 mb-1">B2C Payment Types:</p>
                    <ul className="text-[11px] text-green-700 space-y-0.5 list-disc list-inside">
                      <li><strong>BusinessPayment</strong> - General payments to customers (refunds, rewards)</li>
                      <li><strong>SalaryPayment</strong> - Employee salary disbursements</li>
                      <li><strong>PromotionPayment</strong> - Promotional offers and cashback</li>
                    </ul>
                  </div>

                  {/* Test B2C Disbursement */}
                  <div className="border-t border-green-200 pt-3 mt-3">
                    <p className="text-xs font-medium mb-2">Test B2C Disbursement</p>
                    <p className="text-[10px] text-muted-foreground mb-2">Send a test B2C payment to verify your configuration is working.</p>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/mpesa/b2c', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone: '254700000000', amount: 10, commandId: 'BusinessPayment', remarks: 'Test B2C' }),
                          });
                          const data = await res.json();
                          setSavedMsg(data.success ? 'B2C test payment initiated!' : (data.message || 'B2C test failed'));
                        } catch {
                          setSavedMsg('Failed to test B2C disbursement');
                        }
                        setTimeout(() => setSavedMsg(''), 4000);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                    >
                      Test B2C Payment (KES 10)
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── POS CARD READER ── */}
      {activeTab === 'posCard' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Card Payment on POS</h3>
            <p className="text-sm text-muted-foreground mb-4">Enable card payments on the POS cashier terminal. When enabled, cashiers can accept physical card payments using a handheld card reader device.</p>
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Card Payments</p>
                <p className="text-xs text-muted-foreground">Allow &quot;Card&quot; as a payment method on POS</p>
              </div>
              <button type="button" onClick={() => setPosCard({ ...posCard, enabled: !posCard.enabled })} className={`w-10 h-5 rounded-full transition-colors ${posCard.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>

          {posCard.enabled && (
            <>
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-4">Card Reader Device</h3>
                <p className="text-sm text-muted-foreground mb-4">Configure the handheld card reader connected to your POS terminal.</p>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Connection Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { v: 'bluetooth' as const, l: 'Bluetooth', d: 'Wireless pairing' },
                        { v: 'usb' as const, l: 'USB', d: 'Wired connection' },
                        { v: 'audio' as const, l: 'Audio Jack', d: 'Headphone plug-in' },
                      ]).map(t => (
                        <button key={t.v} onClick={() => setPosCard({ ...posCard, readerType: t.v })} className={`px-3 py-3 rounded-lg border-2 text-sm font-medium transition-all text-center ${posCard.readerType === t.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'}`}>
                          <p className="font-semibold">{t.l}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{t.d}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Reader Brand</label>
                      <select value={posCard.readerBrand} onChange={e => setPosCard({ ...posCard, readerBrand: e.target.value })} className={inputCls}>
                        <option value="">-- Select Brand --</option>
                        <option value="square">Square</option>
                        <option value="sumup">SumUp</option>
                        <option value="zettle">Zettle (iZettle)</option>
                        <option value="stripe">Stripe Reader</option>
                        <option value="verifone">Verifone</option>
                        <option value="ingenico">Ingenico</option>
                        <option value="pax">PAX</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Reader Model / Name</label>
                      <input type="text" value={posCard.readerModel} onChange={e => setPosCard({ ...posCard, readerModel: e.target.value })} placeholder="e.g. Square Reader, SumUp Air" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Device ID / Serial Number (optional)</label>
                    <input type="text" value={posCard.connectionId} onChange={e => setPosCard({ ...posCard, connectionId: e.target.value })} placeholder="e.g. SN-12345 or Bluetooth MAC address" className={inputCls} />
                    <p className="text-xs text-muted-foreground mt-1">Used to identify the reader when multiple devices are available.</p>
                  </div>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-connect on POS start</p>
                      <p className="text-xs text-muted-foreground">Attempt to reconnect to the card reader when POS loads</p>
                    </div>
                    <button type="button" onClick={() => setPosCard({ ...posCard, autoConnect: !posCard.autoConnect })} className={`w-10 h-5 rounded-full transition-colors ${posCard.autoConnect ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.autoConnect ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
              </div>

              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-4">Accepted Card Methods</h3>
                <p className="text-sm text-muted-foreground mb-4">Choose which card entry methods the reader should accept.</p>
                <div className="space-y-3">
                  {[
                    { key: 'allowContactless', label: 'Contactless / NFC (Tap)', desc: 'Accept tap-to-pay cards and mobile wallets' },
                    { key: 'allowChip', label: 'Chip (EMV Insert)', desc: 'Accept chip card insert transactions' },
                    { key: 'allowSwipe', label: 'Magnetic Stripe (Swipe)', desc: 'Accept card swipe (less secure, fallback)' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center justify-between">
                      <div><p className="text-sm font-medium">{opt.label}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                      <button type="button" onClick={() => setPosCard({ ...posCard, [opt.key]: !posCard[opt.key as keyof typeof posCard] })} className={`w-10 h-5 rounded-full transition-colors ${posCard[opt.key as keyof typeof posCard] ? 'bg-primary' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard[opt.key as keyof typeof posCard] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-4">Transaction Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Require Approval Code</p>
                      <p className="text-xs text-muted-foreground">Cashier must enter the approval / auth code from the terminal</p>
                    </div>
                    <button type="button" onClick={() => setPosCard({ ...posCard, requireApprovalCode: !posCard.requireApprovalCode })} className={`w-10 h-5 rounded-full transition-colors ${posCard.requireApprovalCode ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.requireApprovalCode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Require Last 4 Digits</p>
                      <p className="text-xs text-muted-foreground">Cashier must enter the last 4 digits of the card number for records</p>
                    </div>
                    <button type="button" onClick={() => setPosCard({ ...posCard, requireLastFourDigits: !posCard.requireLastFourDigits })} className={`w-10 h-5 rounded-full transition-colors ${posCard.requireLastFourDigits ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.requireLastFourDigits ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Print Card Receipt</p>
                      <p className="text-xs text-muted-foreground">Show &quot;Card&quot; as payment method and card reference on receipt</p>
                    </div>
                    <button type="button" onClick={() => setPosCard({ ...posCard, printCardReceipt: !posCard.printCardReceipt })} className={`w-10 h-5 rounded-full transition-colors ${posCard.printCardReceipt ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.printCardReceipt ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Minimum Card Amount ({general.currency})</label>
                      <input type="number" value={posCard.minimumAmount} onChange={e => setPosCard({ ...posCard, minimumAmount: parseFloat(e.target.value) || 0 })} className={inputCls} placeholder="0 for no minimum" />
                      <p className="text-xs text-muted-foreground mt-1">Set 0 to allow any amount</p>
                    </div>
                    <div>
                      <label className={labelCls}>Transaction Timeout (seconds)</label>
                      <input type="number" value={posCard.timeoutSeconds} onChange={e => setPosCard({ ...posCard, timeoutSeconds: parseInt(e.target.value) || 60 })} className={inputCls} min={10} max={300} />
                      <p className="text-xs text-muted-foreground mt-1">Max wait time for card reader response</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-semibold mb-4">Card Surcharge (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-4">Add a processing fee for card transactions. This will be added to the total at checkout.</p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable Card Surcharge</p>
                      <p className="text-xs text-muted-foreground">Add a percentage fee on card payments</p>
                    </div>
                    <button type="button" onClick={() => setPosCard({ ...posCard, surchargeEnabled: !posCard.surchargeEnabled })} className={`w-10 h-5 rounded-full transition-colors ${posCard.surchargeEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${posCard.surchargeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  {posCard.surchargeEnabled && (
                    <div>
                      <label className={labelCls}>Surcharge Percentage (%)</label>
                      <input type="number" step="0.1" value={posCard.surchargePercent} onChange={e => setPosCard({ ...posCard, surchargePercent: parseFloat(e.target.value) || 0 })} className={`${inputCls} max-w-xs`} placeholder="e.g. 1.5" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-blue-200 rounded-lg p-6 bg-blue-50/50">
                <h3 className="font-semibold mb-2 text-blue-800">How Card Payments Work on POS</h3>
                <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                  <li>Cashier selects <strong>&quot;Card&quot;</strong> as the payment method at checkout</li>
                  <li>The card reader device processes the physical card (tap, chip, or swipe)</li>
                  <li>Cashier enters the <strong>approval code</strong> and optionally the <strong>last 4 digits</strong> from the terminal</li>
                  <li>Sale is recorded as a card payment with the reference details</li>
                  <li>Receipt is printed showing card payment info</li>
                </ol>
                <p className="text-xs text-blue-600 mt-3">Note: The card reader device must be set up and paired independently. This system records the card transaction reference after the reader approves the payment.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SECURITY ── */}
      {activeTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">POS Authentication</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Require PIN for POS login</p><p className="text-xs text-muted-foreground">Cashiers must enter a PIN before accessing POS</p></div>
                <button type="button" onClick={() => setSecurity({ ...security, requirePosPin: !security.requirePosPin })} className={`w-10 h-5 rounded-full transition-colors ${security.requirePosPin ? 'bg-primary' : 'bg-gray-300'}`}><div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${security.requirePosPin ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>PIN Length</label><select value={security.pinLength} onChange={e => setSecurity({ ...security, pinLength: parseInt(e.target.value) })} className={inputCls}><option value={4}>4 digits</option><option value={6}>6 digits</option></select></div>
                <div><label className={labelCls}>Max Login Attempts</label><input type="number" value={security.maxLoginAttempts} onChange={e => setSecurity({ ...security, maxLoginAttempts: parseInt(e.target.value) || 5 })} className={inputCls} /></div>
              </div>
            </div>
          </div>
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Session & Access</h3>
            <div className="space-y-3">
              <div><label className={labelCls}>Session Timeout (minutes)</label><input type="number" value={security.sessionTimeout} onChange={e => setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) || 30 })} className={`${inputCls} max-w-xs`} /></div>
              {[
                { key: 'enforceStrongPasswords', label: 'Enforce Strong Passwords', desc: 'Require uppercase, lowercase, number & special char' },
                { key: 'twoFactorAuth', label: 'Two-Factor Authentication', desc: 'Require 2FA for admin accounts' },
                { key: 'auditLogging', label: 'Audit Logging', desc: 'Log all user actions for compliance' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{opt.label}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>
                  <button type="button" onClick={() => setSecurity({ ...security, [opt.key]: !security[opt.key as keyof typeof security] })} className={`w-10 h-5 rounded-full transition-colors ${security[opt.key as keyof typeof security] ? 'bg-primary' : 'bg-gray-300'}`}><div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${security[opt.key as keyof typeof security] ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BACKUP ── */}
      {activeTab === 'backup' && (
        <div className="max-w-4xl space-y-6">
          {/* Backup Settings */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Automatic Backup</h3>
            <p className="text-xs text-muted-foreground mb-4">A scheduled function runs daily at midnight (UTC) to automatically back up all database tables. Configure retention and other preferences below.</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Enable Auto-Backup</p><p className="text-xs text-muted-foreground">Automatically backup data on schedule</p></div>
                <button type="button" onClick={() => setBackup({ ...backup, autoBackup: !backup.autoBackup })} className={`w-10 h-5 rounded-full transition-colors ${backup.autoBackup ? 'bg-primary' : 'bg-gray-300'}`}><div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${backup.autoBackup ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div><label className={labelCls}>Frequency</label><select value={backup.backupFrequency} onChange={e => setBackup({ ...backup, backupFrequency: e.target.value })} className={inputCls}><option>daily</option><option>weekly</option><option>monthly</option></select></div>
                <div><label className={labelCls}>Time</label><input type="time" value={backup.backupTime} onChange={e => setBackup({ ...backup, backupTime: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Retention (days)</label><input type="number" value={backup.retentionDays} onChange={e => setBackup({ ...backup, retentionDays: parseInt(e.target.value) || 30 })} className={inputCls} /></div>
              </div>
            </div>
          </div>

          {/* Manual Backup & Status */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Backup Status</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-4 bg-secondary rounded-lg"><p className="text-xs text-muted-foreground">Last Backup</p><p className="font-bold text-sm">{backup.lastBackup}</p></div>
              <div className="p-4 bg-secondary rounded-lg"><p className="text-xs text-muted-foreground">Total Backups</p><p className="font-bold text-sm">{backupList.length}</p></div>
              <div className="p-4 bg-secondary rounded-lg"><p className="text-xs text-muted-foreground">Storage</p><p className="font-bold text-sm capitalize">Supabase (JSON)</p></div>
            </div>
            {backupMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${backupMessage.includes('failed') || backupMessage.includes('error') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                {backupMessage}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={runManualBackup}
                disabled={backupRunning}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50"
              >
                {backupRunning ? '⏳ Running Backup...' : '💾 Run Manual Backup Now'}
              </button>
              <button
                onClick={loadBackups}
                disabled={backupLoading}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm font-medium disabled:opacity-50"
              >
                {backupLoading ? 'Loading...' : '🔄 Refresh List'}
              </button>
            </div>
          </div>

          {/* Backup History */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4">Backup History</h3>
            <p className="text-xs text-muted-foreground mb-4">Download backups to your local machine for safekeeping. Each backup contains all database tables as JSON.</p>
            {backupLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading backups...</div>
            ) : backupList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg mb-2">No backups yet</p>
                <p className="text-sm">Click &quot;Run Manual Backup Now&quot; to create your first backup</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Trigger</th>
                      <th className="pb-2 font-medium">Tables</th>
                      <th className="pb-2 font-medium">Rows</th>
                      <th className="pb-2 font-medium">Size</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupList.map((b) => (
                      <tr key={b.backup_id} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-3">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${b.trigger === 'scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            {b.trigger}
                          </span>
                        </td>
                        <td className="py-3">{b.table_count}</td>
                        <td className="py-3">{b.total_rows?.toLocaleString()}</td>
                        <td className="py-3">{formatBytes(b.size_bytes)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${b.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : b.status === 'partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => downloadBackup(b.backup_id, b.filename)}
                              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                              title="Download to your local machine"
                            >
                              ⬇ Download
                            </button>
                            <button
                              onClick={() => deleteBackup(b.backup_id)}
                              className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                              title="Delete this backup"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Setup Instructions */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-3">Setup Instructions</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">1. Create the backups table</p>
                <p>Go to your Supabase Dashboard → SQL Editor and run the migration from <code className="bg-secondary px-1 py-0.5 rounded text-xs">supabase/migrations/create_backups_table.sql</code></p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">2. Set the BACKUP_SECRET environment variable</p>
                <p>In your Netlify dashboard, add a <code className="bg-secondary px-1 py-0.5 rounded text-xs">BACKUP_SECRET</code> environment variable with a secure random string. This authenticates the scheduled backup function.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">3. Automated daily backups</p>
                <p>A Netlify Scheduled Function runs every day at midnight UTC automatically. No extra setup needed after deployment.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">4. Download backups</p>
                <p>Use the download buttons above to save backup files to your local machine for safekeeping.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVERY ── */}
      {activeTab === 'delivery' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-1">Delivery Settings</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure delivery rules for online orders. Orders below the minimum amount will only be available for pickup.</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable Delivery</p>
                  <p className="text-xs text-muted-foreground">Allow customers to choose delivery for online orders</p>
                </div>
                <button type="button" onClick={() => setDelivery({ ...delivery, deliveryEnabled: !delivery.deliveryEnabled })} className={`w-10 h-5 rounded-full transition-colors ${delivery.deliveryEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${delivery.deliveryEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Minimum Order for Delivery (KES)</label>
                  <input type="number" min={0} value={delivery.minimumOrderForDelivery} onChange={e => setDelivery({ ...delivery, minimumOrderForDelivery: parseFloat(e.target.value) || 0 })} className={inputCls} />
                  <p className="text-xs text-muted-foreground mt-1">Orders below this amount will only be available for pickup. Set to 0 to allow delivery for all orders.</p>
                </div>
                <div>
                  <label className={labelCls}>Delivery Fee (KES)</label>
                  <input type="number" min={0} value={delivery.deliveryFee} onChange={e => setDelivery({ ...delivery, deliveryFee: parseFloat(e.target.value) || 0 })} className={inputCls} />
                  <p className="text-xs text-muted-foreground mt-1">Standard delivery charge applied to qualifying orders</p>
                </div>
                <div>
                  <label className={labelCls}>Free Delivery Threshold (KES)</label>
                  <input type="number" min={0} value={delivery.freeDeliveryThreshold} onChange={e => setDelivery({ ...delivery, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })} className={inputCls} />
                  <p className="text-xs text-muted-foreground mt-1">Orders above this amount get free delivery. Set to 0 to always charge delivery.</p>
                </div>
                <div>
                  <label className={labelCls}>Estimated Delivery Time</label>
                  <input type="text" value={delivery.estimatedDeliveryTime} onChange={e => setDelivery({ ...delivery, estimatedDeliveryTime: e.target.value })} className={inputCls} placeholder="e.g. 30-60 mins" />
                </div>
                <div>
                  <label className={labelCls}>Delivery Radius</label>
                  <input type="text" value={delivery.deliveryRadius} onChange={e => setDelivery({ ...delivery, deliveryRadius: e.target.value })} className={inputCls} placeholder="e.g. 10 km" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Delivery Notes (shown to customers)</label>
                <textarea value={delivery.deliveryNotes} onChange={e => setDelivery({ ...delivery, deliveryNotes: e.target.value })} className={inputCls} rows={2} placeholder="e.g. Delivery available within Nairobi only" />
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-1">Google Maps Integration</h3>
            <p className="text-xs text-muted-foreground mb-4">Configure Google Maps API for automatic distance calculation between departure and destination locations in delivery tracking.</p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Google Maps API Key *</label>
                <input type="password" value={delivery.googleMapsApiKey} onChange={e => setDelivery({ ...delivery, googleMapsApiKey: e.target.value })} className={inputCls} placeholder="Enter your Google Maps API key" />
                <p className="text-xs text-muted-foreground mt-1">
                  Required APIs: Distance Matrix API, Places API. Get your key from{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a>
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <strong>How it works:</strong> When creating a delivery, the system will automatically calculate the driving distance (km) between the departure location and the customer&apos;s destination using Google Maps. Odometer readings remain manual for actual trip logging.
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-3">Delivery Rules Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Delivery Status</span>
                <span className={`font-medium ${delivery.deliveryEnabled ? 'text-green-600' : 'text-red-600'}`}>{delivery.deliveryEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Minimum Order for Delivery</span>
                <span className="font-medium">KES {delivery.minimumOrderForDelivery.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="font-medium">KES {delivery.deliveryFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Free Delivery Above</span>
                <span className="font-medium">KES {delivery.freeDeliveryThreshold.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Est. Delivery Time</span>
                <span className="font-medium">{delivery.estimatedDeliveryTime || 'Not set'}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Example:</strong> With current settings, orders below KES {delivery.minimumOrderForDelivery.toLocaleString()} can only be picked up. Orders between KES {delivery.minimumOrderForDelivery.toLocaleString()} and KES {delivery.freeDeliveryThreshold.toLocaleString()} pay KES {delivery.deliveryFee.toLocaleString()} delivery fee. Orders above KES {delivery.freeDeliveryThreshold.toLocaleString()} get free delivery.
            </div>
          </div>
        </div>
      )}

      {/* ── SESSIONS (Enhanced Functional) ── */}
      {activeTab === 'sessions' && (
        <div className="max-w-2xl space-y-6">
          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <h3 className="font-semibold mb-4">Active Sessions</h3>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No active sessions detected</p>
              ) : sessions.map(s => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border border-border rounded-lg gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">●</div>
                    <div>
                      <p className="text-sm font-medium">{s.email}</p>
                      <p className="text-xs text-muted-foreground">{s.device} &bull; Last active: {s.lastActive}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold w-fit">Current</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <h3 className="font-semibold mb-2">Session Security</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Session Timeout</p>
                  <p className="text-xs text-muted-foreground">Auto-logout after inactivity (minutes)</p>
                </div>
                <input type="number" min={5} max={480} value={security.sessionTimeout} onChange={e => setSecurity({ ...security, sessionTimeout: parseInt(e.target.value) || 30 })} className={`${inputCls} w-20`} />
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Max Login Attempts</p>
                  <p className="text-xs text-muted-foreground">Lock account after failed attempts</p>
                </div>
                <input type="number" min={3} max={10} value={security.maxLoginAttempts} onChange={e => setSecurity({ ...security, maxLoginAttempts: parseInt(e.target.value) || 5 })} className={`${inputCls} w-20`} />
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <h3 className="font-semibold mb-2">Session Management</h3>
            <p className="text-sm text-muted-foreground mb-4">Sign out from all other devices and sessions.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={async () => {
                  try {
                    await supabase.auth.signOut({ scope: 'others' });
                    logAudit({ action: 'UPDATE', module: 'Settings', record_id: 'sessions', details: { action: 'sign_out_other_sessions' } });
                    setSavedMsg('All other sessions have been signed out');
                    setTimeout(() => setSavedMsg(''), 3000);
                  } catch {
                    setSavedMsg('Failed to sign out other sessions');
                    setTimeout(() => setSavedMsg(''), 3000);
                  }
                }}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
              >
                Sign Out All Other Sessions
              </button>
              <button
                onClick={async () => {
                  try {
                    const { data } = await supabase.auth.refreshSession();
                    if (data.session) {
                      setSessions([{
                        id: data.session.access_token.slice(-8),
                        email: data.session.user.email || 'admin',
                        lastActive: new Date().toLocaleString(),
                        device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
                      }]);
                      setSavedMsg('Session refreshed');
                      setTimeout(() => setSavedMsg(''), 3000);
                    }
                  } catch { /* ignore */ }
                }}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
              >
                Refresh Current Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KRA eTIMS INTEGRATION ── */}
      {activeTab === 'kra-etims' && (
        <div className="max-w-2xl space-y-6">
          <div className="border-2 border-amber-200 rounded-lg p-4 md:p-6 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏛️</span>
              <div>
                <h3 className="font-semibold mb-1">KRA eTIMS Integration</h3>
                <p className="text-xs text-muted-foreground">Kenya Revenue Authority Electronic Tax Invoice Management System. When enabled, tax invoices are automatically submitted to KRA for every sale made through the POS system.</p>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">eTIMS Configuration</h3>
              <div className={`px-2 py-1 rounded text-xs font-bold ${kraEtims.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {kraEtims.enabled ? 'Active' : 'Inactive'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable eTIMS</p>
                  <p className="text-xs text-muted-foreground">Auto-submit tax invoices on each sale</p>
                </div>
                <button type="button" onClick={() => setKraEtims({ ...kraEtims, enabled: !kraEtims.enabled })} className={`w-10 h-5 rounded-full transition-colors ${kraEtims.enabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${kraEtims.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>KRA PIN *</label>
                  <input type="text" value={kraEtims.kraPin} onChange={e => setKraEtims({ ...kraEtims, kraPin: e.target.value })} className={inputCls} placeholder="e.g. A123456789Z" />
                </div>
                <div>
                  <label className={labelCls}>Business Name</label>
                  <input type="text" value={kraEtims.businessName} onChange={e => setKraEtims({ ...kraEtims, businessName: e.target.value })} className={inputCls} placeholder="Registered business name" />
                </div>
                <div>
                  <label className={labelCls}>Branch ID</label>
                  <input type="text" value={kraEtims.branchId} onChange={e => setKraEtims({ ...kraEtims, branchId: e.target.value })} className={inputCls} placeholder="Branch identifier" />
                </div>
                <div>
                  <label className={labelCls}>eTIMS API URL</label>
                  <input type="text" value={kraEtims.apiUrl} onChange={e => setKraEtims({ ...kraEtims, apiUrl: e.target.value })} className={inputCls} placeholder="https://etims.kra.go.ke/api/v1" />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={kraEtims.apiKey} onChange={e => setKraEtims({ ...kraEtims, apiKey: e.target.value })} className={inputCls} placeholder="eTIMS API key" />
                </div>
                <div>
                  <label className={labelCls}>API Secret</label>
                  <input type="password" value={kraEtims.apiSecret} onChange={e => setKraEtims({ ...kraEtims, apiSecret: e.target.value })} className={inputCls} placeholder="eTIMS API secret" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Auto-Submit on Sale</p>
                  <p className="text-xs text-muted-foreground">Automatically submit invoices to KRA when a POS sale is completed</p>
                </div>
                <button type="button" onClick={() => setKraEtims({ ...kraEtims, autoSubmit: !kraEtims.autoSubmit })} className={`w-10 h-5 rounded-full transition-colors ${kraEtims.autoSubmit ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${kraEtims.autoSubmit ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <h3 className="font-semibold mb-3">Tax Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-muted-foreground">VAT Rate</span>
                <span className="font-medium">16% (Standard)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-muted-foreground">Exempt Items</span>
                <span className="font-medium">0% (Configure per product)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <span className="text-muted-foreground">Tax Invoice Prefix</span>
                <span className="font-medium">INV-</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">KRA eTIMS requires all businesses to submit electronic invoices. Ensure your KRA PIN and API credentials are correctly configured before enabling auto-submission.</p>
          </div>
        </div>
      )}

      {/* ── SHA / NSSF / NHIF INTEGRATION ── */}
      {activeTab === 'sha-nssf' && (
        <div className="max-w-2xl space-y-6">
          <div className="border-2 border-blue-200 rounded-lg p-4 md:p-6 bg-blue-50/50">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏥</span>
              <div>
                <h3 className="font-semibold mb-1">Government Statutory Deductions</h3>
                <p className="text-xs text-muted-foreground">Configure integrations with SHA (Social Health Authority), NSSF (National Social Security Fund), and NHIF (National Hospital Insurance Fund) for employee statutory deductions and compliance reporting.</p>
              </div>
            </div>
          </div>

          {/* SHA */}
          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏥</span>
                <h3 className="font-semibold">SHA (Social Health Authority)</h3>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${shaNssf.shaEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {shaNssf.shaEnabled ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable SHA Integration</p>
                  <p className="text-xs text-muted-foreground">Social Health Insurance Fund deductions</p>
                </div>
                <button type="button" onClick={() => setShaNssf({ ...shaNssf, shaEnabled: !shaNssf.shaEnabled })} className={`w-10 h-5 rounded-full transition-colors ${shaNssf.shaEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${shaNssf.shaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Employer Code</label>
                  <input type="text" value={shaNssf.shaEmployerCode} onChange={e => setShaNssf({ ...shaNssf, shaEmployerCode: e.target.value })} className={inputCls} placeholder="SHA employer code" />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={shaNssf.shaApiKey} onChange={e => setShaNssf({ ...shaNssf, shaApiKey: e.target.value })} className={inputCls} placeholder="SHA API key" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Auto-Deduct from Payroll</p>
                  <p className="text-xs text-muted-foreground">Automatically compute SHA deductions</p>
                </div>
                <button type="button" onClick={() => setShaNssf({ ...shaNssf, shaAutoDeduct: !shaNssf.shaAutoDeduct })} className={`w-10 h-5 rounded-full transition-colors ${shaNssf.shaAutoDeduct ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${shaNssf.shaAutoDeduct ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* NSSF */}
          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <h3 className="font-semibold">NSSF (National Social Security Fund)</h3>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${shaNssf.nssfEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {shaNssf.nssfEnabled ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable NSSF Integration</p>
                  <p className="text-xs text-muted-foreground">Social security fund deductions</p>
                </div>
                <button type="button" onClick={() => setShaNssf({ ...shaNssf, nssfEnabled: !shaNssf.nssfEnabled })} className={`w-10 h-5 rounded-full transition-colors ${shaNssf.nssfEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${shaNssf.nssfEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Employer Code</label>
                  <input type="text" value={shaNssf.nssfEmployerCode} onChange={e => setShaNssf({ ...shaNssf, nssfEmployerCode: e.target.value })} className={inputCls} placeholder="NSSF employer code" />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={shaNssf.nssfApiKey} onChange={e => setShaNssf({ ...shaNssf, nssfApiKey: e.target.value })} className={inputCls} placeholder="NSSF API key" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Auto-Deduct from Payroll</p>
                  <p className="text-xs text-muted-foreground">Tier I: KES 360, Tier II: KES 360 (per 2025 rates)</p>
                </div>
                <button type="button" onClick={() => setShaNssf({ ...shaNssf, nssfAutoDeduct: !shaNssf.nssfAutoDeduct })} className={`w-10 h-5 rounded-full transition-colors ${shaNssf.nssfAutoDeduct ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${shaNssf.nssfAutoDeduct ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* NHIF (Legacy) */}
          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏨</span>
                <h3 className="font-semibold">NHIF (National Hospital Insurance Fund)</h3>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${shaNssf.nhifEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {shaNssf.nhifEnabled ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Note:</strong> NHIF is transitioning to SHA (Social Health Authority). Configure SHA above for the latest compliance requirements.
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Enable NHIF (Legacy)</p>
                  <p className="text-xs text-muted-foreground">For historical records and transition period</p>
                </div>
                <button type="button" onClick={() => setShaNssf({ ...shaNssf, nhifEnabled: !shaNssf.nhifEnabled })} className={`w-10 h-5 rounded-full transition-colors ${shaNssf.nhifEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${shaNssf.nhifEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Employer Code</label>
                  <input type="text" value={shaNssf.nhifEmployerCode} onChange={e => setShaNssf({ ...shaNssf, nhifEmployerCode: e.target.value })} className={inputCls} placeholder="NHIF employer code" />
                </div>
                <div>
                  <label className={labelCls}>API Key</label>
                  <input type="password" value={shaNssf.nhifApiKey} onChange={e => setShaNssf({ ...shaNssf, nhifApiKey: e.target.value })} className={inputCls} placeholder="NHIF API key" />
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 md:p-6 bg-card">
            <h3 className="font-semibold mb-3">Deduction Rates Reference</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Statutory Body</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Employee</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Employer</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium">SHA</td>
                    <td className="py-2">2.75% of gross</td>
                    <td className="py-2">2.75% of gross</td>
                    <td className="py-2 text-muted-foreground">Replaces NHIF</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium">NSSF Tier I</td>
                    <td className="py-2">KES 360</td>
                    <td className="py-2">KES 360</td>
                    <td className="py-2 text-muted-foreground">On first KES 7,000</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium">NSSF Tier II</td>
                    <td className="py-2">KES 360</td>
                    <td className="py-2">KES 360</td>
                    <td className="py-2 text-muted-foreground">On next KES 29,000</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Housing Levy</td>
                    <td className="py-2">1.5% of gross</td>
                    <td className="py-2">1.5% of gross</td>
                    <td className="py-2 text-muted-foreground">Affordable Housing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MAINTENANCE MODE ── */}
      {activeTab === 'maintenance' && (
        <div className="max-w-2xl space-y-6">
          {/* Maintenance Mode Toggle */}
          <div className={`border-2 rounded-lg p-6 transition-colors ${maintenanceMode.enabled ? 'border-red-300 bg-red-50/50' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="text-xl">🔧</span> Admin Panel Maintenance Mode
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, all staff accessing the admin panel will see a maintenance & backup screen. The customer-facing website remains fully operational.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const newEnabled = !maintenanceMode.enabled;
                  const updated = {
                    ...maintenanceMode,
                    enabled: newEnabled,
                    started_at: newEnabled ? new Date().toISOString() : null,
                    started_by: newEnabled ? 'Admin' : null,
                  };
                  setMaintenanceMode(updated);
                  setMaintenanceSaving(true);
                  try {
                    await supabase.from('business_settings').upsert(
                      { key: 'maintenance_mode', value: updated, updated_at: new Date().toISOString() },
                      { onConflict: 'key' }
                    );
                    logAudit({
                      action: 'UPDATE',
                      module: 'Maintenance Mode',
                      record_id: 'maintenance_mode',
                      details: { enabled: newEnabled },
                      trackChangelog: true,
                      changelogTitle: newEnabled ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
                      changelogDescription: newEnabled
                        ? 'System-wide maintenance mode activated. Non-admin users see maintenance screen.'
                        : 'Maintenance mode deactivated. System is fully accessible to all users.',
                      changelogCategory: 'infrastructure',
                    });
                    setMaintenanceMsg(newEnabled ? 'Maintenance mode ENABLED - staff will see maintenance screen' : 'Maintenance mode DISABLED - admin panel is accessible');
                  } catch {
                    setMaintenanceMsg('Failed to update maintenance mode');
                  }
                  setMaintenanceSaving(false);
                  setTimeout(() => setMaintenanceMsg(''), 4000);
                }}
                disabled={maintenanceSaving}
                className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${maintenanceMode.enabled ? 'bg-red-500' : 'bg-gray-300'}`}
              >
                <div className={`w-6 h-6 rounded-full bg-white shadow transform transition-transform ${maintenanceMode.enabled ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {maintenanceMsg && (
              <div className={`p-3 rounded-lg text-sm mb-4 ${maintenanceMsg.includes('ENABLED') ? 'bg-red-100 text-red-700 border border-red-200' : maintenanceMsg.includes('DISABLED') ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
                {maintenanceMsg}
              </div>
            )}

            {/* Current Status */}
            <div className={`p-4 rounded-xl border ${maintenanceMode.enabled ? 'bg-red-100/50 border-red-200' : 'bg-green-100/50 border-green-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${maintenanceMode.enabled ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <div>
                  <p className={`font-semibold text-sm ${maintenanceMode.enabled ? 'text-red-800' : 'text-green-800'}`}>
                    {maintenanceMode.enabled ? 'Maintenance Mode is ACTIVE' : 'Admin Panel is Operational'}
                  </p>
                  <p className={`text-xs ${maintenanceMode.enabled ? 'text-red-600' : 'text-green-600'}`}>
                    {maintenanceMode.enabled
                      ? `Started ${maintenanceMode.started_at ? new Date(maintenanceMode.started_at).toLocaleString() : 'just now'}`
                      : 'All staff can access the admin dashboard normally'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Maintenance Message */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-1">Maintenance Message</h3>
            <p className="text-xs text-muted-foreground mb-4">Customize the message displayed to staff during maintenance</p>
            <textarea
              value={maintenanceMode.message}
              onChange={e => setMaintenanceMode({ ...maintenanceMode, message: e.target.value })}
              rows={3}
              className={inputCls}
              placeholder="System under automatic maintenance and backup..."
            />
            <button
              onClick={async () => {
                setMaintenanceSaving(true);
                try {
                  await supabase.from('business_settings').upsert(
                    { key: 'maintenance_mode', value: maintenanceMode, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                  );
                  setMaintenanceMsg('Maintenance message updated');
                } catch {
                  setMaintenanceMsg('Failed to save message');
                }
                setMaintenanceSaving(false);
                setTimeout(() => setMaintenanceMsg(''), 3000);
              }}
              disabled={maintenanceSaving}
              className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-50"
            >
              {maintenanceSaving ? 'Saving...' : 'Save Message'}
            </button>
          </div>

          {/* How It Works */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-3">How Maintenance Mode Works</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="text-lg">🌐</span>
                <div>
                  <p className="font-medium text-foreground">Customer Website</p>
                  <p>Remains fully operational. Online orders, browsing, and the store continue as normal.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🔒</span>
                <div>
                  <p className="font-medium text-foreground">Admin Panel</p>
                  <p>All staff members see a professional maintenance & backup screen when trying to access any admin page.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">👑</span>
                <div>
                  <p className="font-medium text-foreground">Owner/Super Admin</p>
                  <p>The primary owner account (super admin) can still access the admin panel to manage settings and disable maintenance mode.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">📝</span>
                <div>
                  <p className="font-medium text-foreground">Audit Logged</p>
                  <p>Enabling or disabling maintenance mode is recorded in the audit log for accountability.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BUG TRACKER ── */}
      {activeTab === 'bug-tracker' && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Issues', value: bugStats.total, color: 'text-foreground', bg: 'bg-card' },
              { label: 'Open', value: bugStats.open, color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'In Progress', value: bugStats.in_progress, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Resolved', value: bugStats.resolved, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Critical', value: bugStats.critical, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'High', value: bugStats.high, color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} border border-border rounded-lg p-4 text-center`}>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Scan Controls */}
          <div className="border border-border rounded-lg p-5 bg-card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="text-xl">🔍</span> System Scanner
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Scan the system for bugs, errors, misconfigurations, security issues, and data integrity problems
                </p>
                {lastScanInfo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last scan: {new Date(lastScanInfo.timestamp as string).toLocaleString()} &middot;{' '}
                    {lastScanInfo.issues_found} issue(s) found &middot;{' '}
                    {lastScanInfo.duration_ms}ms &middot;{' '}
                    Trigger: {lastScanInfo.trigger as string}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Auto-scan</span>
                  <button
                    type="button"
                    onClick={() => setBugAutoScan(!bugAutoScan)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${bugAutoScan ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${bugAutoScan ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <button
                  onClick={runBugScan}
                  disabled={bugScanning}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {bugScanning ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Run Scan Now
                    </>
                  )}
                </button>
              </div>
            </div>

            {bugScanResult && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${bugScanResult.success ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                {bugScanResult.message}
              </div>
            )}

            {/* What the scanner checks */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { icon: '🗃️', label: 'Database Health' },
                { icon: '🔐', label: 'Security Audit' },
                { icon: '📊', label: 'Data Integrity' },
                { icon: '⚙️', label: 'Configuration' },
                { icon: '🚀', label: 'Performance' },
                { icon: '📡', label: 'API Endpoints' },
                { icon: '📦', label: 'Stale Data' },
                { icon: '💾', label: 'Backup Status' },
              ].map(check => (
                <div key={check.label} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                  <span>{check.icon}</span> {check.label}
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search bugs by title, description, or module..."
                value={bugFilter.search}
                onChange={e => { setBugFilter({ ...bugFilter, search: e.target.value }); setBugPage(0); }}
                className={inputCls}
              />
            </div>
            <select
              value={bugFilter.status}
              onChange={e => { setBugFilter({ ...bugFilter, status: e.target.value }); setBugPage(0); }}
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select
              value={bugFilter.severity}
              onChange={e => { setBugFilter({ ...bugFilter, severity: e.target.value }); setBugPage(0); }}
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <select
              value={bugFilter.category}
              onChange={e => { setBugFilter({ ...bugFilter, category: e.target.value }); setBugPage(0); }}
              className="px-3 py-2.5 border border-border rounded-lg text-sm bg-background"
            >
              <option value="all">All Categories</option>
              <option value="database">Database</option>
              <option value="api">API</option>
              <option value="security">Security</option>
              <option value="data_integrity">Data Integrity</option>
              <option value="configuration">Configuration</option>
              <option value="performance">Performance</option>
              <option value="workflow">Workflow</option>
            </select>
          </div>

          {/* Bug List */}
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            {bugsLoading ? (
              <div className="p-12 text-center text-muted-foreground">
                <span className="inline-block w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mb-3" />
                <p className="text-sm">Loading issues...</p>
              </div>
            ) : bugs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-medium">No issues found</p>
                <p className="text-xs mt-1">Run a scan to check for system bugs and errors</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {bugs.map(bug => {
                  const severityColors: Record<string, string> = {
                    critical: 'bg-red-100 text-red-700 border-red-200',
                    high: 'bg-amber-100 text-amber-700 border-amber-200',
                    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    low: 'bg-blue-100 text-blue-700 border-blue-200',
                    info: 'bg-gray-100 text-gray-600 border-gray-200',
                  };
                  const statusColors: Record<string, string> = {
                    open: 'bg-orange-100 text-orange-700',
                    in_progress: 'bg-blue-100 text-blue-700',
                    resolved: 'bg-green-100 text-green-700',
                    dismissed: 'bg-gray-100 text-gray-500',
                  };
                  const categoryIcons: Record<string, string> = {
                    database: '🗃️',
                    api: '📡',
                    security: '🔐',
                    data_integrity: '📊',
                    configuration: '⚙️',
                    performance: '🚀',
                    workflow: '📋',
                    error: '❌',
                  };
                  const isExpanded = expandedBugId === bug.id;

                  return (
                    <div key={bug.id} className={`${isExpanded ? 'bg-muted/20' : 'hover:bg-muted/10'} transition-colors`}>
                      <button
                        type="button"
                        onClick={() => setExpandedBugId(isExpanded ? null : bug.id)}
                        className="w-full px-5 py-4 text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">{categoryIcons[bug.category] || '🐛'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm truncate">{bug.title}</h4>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${severityColors[bug.severity] || severityColors.medium}`}>
                                {bug.severity}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[bug.status] || statusColors.open}`}>
                                {bug.status.replace('_', ' ')}
                              </span>
                              {bug.occurrence_count > 1 && (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 font-medium">
                                  x{bug.occurrence_count}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{bug.module}</span>
                              <span className="text-xs text-muted-foreground">&middot;</span>
                              <span className="text-xs text-muted-foreground">{new Date(bug.detected_at).toLocaleString()}</span>
                              {bug.source === 'auto_scan' && (
                                <>
                                  <span className="text-xs text-muted-foreground">&middot;</span>
                                  <span className="text-xs text-muted-foreground">Auto-detected</span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`text-muted-foreground transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-0 ml-9">
                          <div className="border border-border rounded-lg p-4 bg-background space-y-4">
                            {/* Description */}
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                              <p className="text-sm">{bug.description}</p>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground font-medium">Category</p>
                                <p className="capitalize">{bug.category.replace('_', ' ')}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-medium">Module</p>
                                <p>{bug.module}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-medium">First Detected</p>
                                <p>{new Date(bug.first_detected_at).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground font-medium">Occurrences</p>
                                <p>{bug.occurrence_count}</p>
                              </div>
                              {bug.error_code && (
                                <div>
                                  <p className="text-muted-foreground font-medium">Error Code</p>
                                  <p className="font-mono">{bug.error_code}</p>
                                </div>
                              )}
                              {bug.endpoint && (
                                <div>
                                  <p className="text-muted-foreground font-medium">Endpoint</p>
                                  <p className="font-mono truncate">{bug.endpoint}</p>
                                </div>
                              )}
                              {bug.resolved_at && (
                                <div>
                                  <p className="text-muted-foreground font-medium">Resolved At</p>
                                  <p>{new Date(bug.resolved_at).toLocaleString()}</p>
                                </div>
                              )}
                            </div>

                            {/* Request Details / Extra Data */}
                            {bug.request_details && Object.keys(bug.request_details).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Additional Data</p>
                                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-40 border border-border">
                                  {JSON.stringify(bug.request_details, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Stack Trace */}
                            {bug.stack_trace && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Stack Trace</p>
                                <pre className="text-xs bg-red-50 text-red-800 rounded-lg p-3 overflow-x-auto max-h-40 border border-red-200">
                                  {bug.stack_trace}
                                </pre>
                              </div>
                            )}

                            {/* Notes */}
                            {bug.notes && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                                <p className="text-sm text-muted-foreground italic">{bug.notes}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-border">
                              {bug.status !== 'resolved' && (
                                <button
                                  onClick={() => updateBugStatus(bug.id, 'resolved')}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                                >
                                  Mark Resolved
                                </button>
                              )}
                              {bug.status === 'open' && (
                                <button
                                  onClick={() => updateBugStatus(bug.id, 'in_progress')}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                                >
                                  Mark In Progress
                                </button>
                              )}
                              {bug.status !== 'dismissed' && bug.status !== 'resolved' && (
                                <button
                                  onClick={() => updateBugStatus(bug.id, 'dismissed')}
                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-300"
                                >
                                  Dismiss
                                </button>
                              )}
                              {bug.status === 'resolved' && (
                                <button
                                  onClick={() => updateBugStatus(bug.id, 'open')}
                                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700"
                                >
                                  Reopen
                                </button>
                              )}
                              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                                ID: {bug.id.slice(0, 8)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {bugs.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 bg-muted/20 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {bugPage * bugsPerPage + 1}–{Math.min((bugPage + 1) * bugsPerPage, bugStats.total)} of {bugStats.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBugPage(p => Math.max(0, p - 1))}
                    disabled={bugPage === 0}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setBugPage(p => p + 1)}
                    disabled={(bugPage + 1) * bugsPerPage >= bugStats.total}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-muted disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* How it works info */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-3">How the Bug Tracker Works</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="text-lg">🤖</span>
                <div>
                  <p className="font-medium text-foreground">Automatic Scanning</p>
                  <p>The system automatically scans every 6 hours for database issues, security vulnerabilities, data integrity problems, stale data, and misconfigurations.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🔍</span>
                <div>
                  <p className="font-medium text-foreground">Manual Scans</p>
                  <p>Click &quot;Run Scan Now&quot; to immediately perform a comprehensive system check. Results are stored and tracked over time.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">🔄</span>
                <div>
                  <p className="font-medium text-foreground">Smart Deduplication</p>
                  <p>Recurring issues are tracked by occurrence count rather than creating duplicates. When an issue is no longer detected, it is automatically resolved.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">📊</span>
                <div>
                  <p className="font-medium text-foreground">Comprehensive Checks</p>
                  <p>Scans cover database health, API endpoints, data integrity, security audit, configuration validation, performance metrics, backup status, and stale data detection.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL SETTINGS ── */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-1">Email Configuration (Resend)</h3>
            <p className="text-sm text-muted-foreground mb-6">Configure email sending for automated notifications. Welcome emails with login credentials will be sent to new users when created by an admin.</p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={emailSettings.enabled} onChange={(e) => setEmailSettings({ ...emailSettings, enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
                <span className="text-sm font-medium">Enable Email Sending</span>
              </div>

              {emailSettings.enabled && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Sender Name</label>
                      <input type="text" value={emailSettings.fromName} onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })} className={inputCls} placeholder="e.g. Snackoh Bakers" />
                      <p className="text-xs text-muted-foreground mt-1">Display name shown in the &quot;From&quot; field of emails</p>
                    </div>
                    <div>
                      <label className={labelCls}>Sender Email Address</label>
                      <input type="email" value={emailSettings.fromEmail} onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })} className={inputCls} placeholder="e.g. noreply@yourdomain.com" />
                      <p className="text-xs text-muted-foreground mt-1">Must be a verified domain on Resend, or use onboarding@resend.dev for testing</p>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Resend API Key</label>
                    <input type="password" value={emailSettings.resendApiKey} onChange={(e) => setEmailSettings({ ...emailSettings, resendApiKey: e.target.value })} className={inputCls} placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                    <p className="text-xs text-muted-foreground mt-1">Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com/api-keys</a>. This is saved in settings and also requires the RESEND_API_KEY environment variable for server-side sending.</p>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={emailSettings.sendOnUserCreation} onChange={(e) => setEmailSettings({ ...emailSettings, sendOnUserCreation: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    <div>
                      <span className="text-sm font-medium">Send welcome email on user creation</span>
                      <p className="text-xs text-muted-foreground">Automatically email login credentials to new users when created by an admin</p>
                    </div>
                  </div>

                  {/* Test Email */}
                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-sm font-semibold mb-3">Test Email Configuration</h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={async () => {
                          setEmailTestSending(true);
                          setEmailTestResult(null);
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token || '';
                            const res = await fetch('/api/email/send-credentials', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({
                                recipientEmail: session?.user?.email || '',
                                recipientName: 'Test User',
                                loginEmail: 'test@example.com',
                                loginPassword: '••••••••',
                                loginRole: 'Viewer',
                                businessName: general.businessName,
                              }),
                            });
                            const result = await res.json();
                            setEmailTestResult({ success: result.success, message: result.success ? 'Test email sent successfully! Check your inbox.' : result.message });
                          } catch (err) {
                            setEmailTestResult({ success: false, message: err instanceof Error ? err.message : 'Failed to send test email' });
                          }
                          setEmailTestSending(false);
                        }}
                        disabled={emailTestSending}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm disabled:opacity-50"
                      >
                        {emailTestSending ? 'Sending...' : 'Send Test Email'}
                      </button>
                      <span className="text-xs text-muted-foreground">Sends a test email to your admin email address</span>
                    </div>
                    {emailTestResult && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${emailTestResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {emailTestResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Setup Guide */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-3">Setup Guide</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="font-medium text-foreground">Create a Resend account</p>
                  <p>Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">resend.com</a> and verify your domain for production use.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="font-medium text-foreground">Get your API key</p>
                  <p>Go to <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resend API Keys</a> and create a new key.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="font-medium text-foreground">Set environment variables</p>
                  <p>Add the following to your Netlify environment variables (Site Settings &gt; Environment Variables):</p>
                  <div className="mt-2 bg-secondary rounded-lg p-3 font-mono text-xs space-y-1">
                    <p>RESEND_API_KEY=re_your_api_key_here</p>
                    <p>RESEND_FROM_EMAIL=noreply@yourdomain.com</p>
                    <p>RESEND_FROM_NAME=Your Business Name</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <div>
                  <p className="font-medium text-foreground">Test the configuration</p>
                  <p>Use the &quot;Send Test Email&quot; button above to verify everything is working. For testing without a verified domain, use <code className="bg-secondary px-1 rounded">onboarding@resend.dev</code> as the sender email.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
