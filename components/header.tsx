'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit-logger';
import { useRouter } from 'next/navigation';
import { Bell, ShoppingBag, Volume2, VolumeX, Download } from 'lucide-react';
import Link from 'next/link';
import { usePwaInstall } from '@/components/pwa-install-prompt';
import { useUserPermissions } from '@/lib/user-permissions';

interface OnlineOrderNotif {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  createdAt: string;
  status: string;
  paymentMethod: string;
}

// ── Alarm Sound Generator using Web Audio API ──
// Generates a loud, attention-grabbing alarm tone that loops continuously
class OrderAlarm {
  private audioCtx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  private getContext(): AudioContext | null {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      try {
        this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playTone(freq: number, duration: number, volume: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    // Envelope: quick attack, sustain, quick release
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.setValueAtTime(volume, ctx.currentTime + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // Play a repeating alarm pattern: two-tone siren that keeps going
  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    const playPattern = () => {
      if (!this.isPlaying) return;
      // Ring pattern: high-low-high-low like a classic alarm
      this.playTone(880, 0.15, 0.9);   // A5 high
      setTimeout(() => {
        if (!this.isPlaying) return;
        this.playTone(660, 0.15, 0.9);  // E5 low
      }, 200);
      setTimeout(() => {
        if (!this.isPlaying) return;
        this.playTone(880, 0.15, 0.9);  // A5 high
      }, 400);
      setTimeout(() => {
        if (!this.isPlaying) return;
        this.playTone(660, 0.15, 0.9);  // E5 low
      }, 600);
    };

    // Play immediately, then repeat every 1.5 seconds
    playPattern();
    this.intervalId = setInterval(playPattern, 1500);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  dispose() {
    this.stop();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
  }
}

export function Header() {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [ringing, setRinging] = useState(false);
  const [muted, setMuted] = useState(false);
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  const { isAdmin } = useUserPermissions();
  const alarmRef = useRef<OrderAlarm | null>(null);
  // Track IDs of orders that have been acknowledged (clicked/dismissed)
  const acknowledgedRef = useRef<Set<string>>(new Set());

  const [user, setUser] = useState({
    name: 'Admin User',
    email: 'admin@bakery.com',
    role: 'Administrator',
    initials: 'AU',
  });

  const [notifications, setNotifications] = useState<OnlineOrderNotif[]>([]);
  const [adminLogoUrl, setAdminLogoUrl] = useState('');
  const [adminBusinessName, setAdminBusinessName] = useState('SNACKOH BAKERS');

  // Load branding for admin header
  useEffect(() => {
    async function loadBranding() {
      try {
        const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'general').single();
        if (!error && data?.value) {
          const g = data.value as Record<string, string>;
          if (g.logoUrl) setAdminLogoUrl(g.logoUrl);
          if (g.businessName) setAdminBusinessName(g.businessName);
          return;
        }
      } catch { /* table may not exist */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.general?.logoUrl) setAdminLogoUrl(parsed.general.logoUrl);
          if (parsed.general?.businessName) setAdminBusinessName(parsed.general.businessName);
        }
      } catch { /* ignore */ }
    }
    loadBranding();
  }, []);

  // Initialize alarm on mount
  useEffect(() => {
    alarmRef.current = new OrderAlarm();
    return () => {
      alarmRef.current?.dispose();
      alarmRef.current = null;
    };
  }, []);

  // ── Start/stop alarm based on unacknowledged notifications ──
  const updateAlarm = useCallback((notifs: OnlineOrderNotif[], isMuted: boolean) => {
    const hasUnacknowledged = notifs.some(n => !acknowledgedRef.current.has(n.id));
    if (hasUnacknowledged && !isMuted) {
      setRinging(true);
      alarmRef.current?.start();
    } else {
      setRinging(false);
      alarmRef.current?.stop();
    }
  }, []);

  // ── Fetch pending online orders on mount ──
  useEffect(() => {
    const fetchPendingOnline = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, total_amount, created_at, status, payment_method')
        .eq('source', 'Online')
        .in('status', ['Pending', 'On Hold', 'Confirmed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const mapped = data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          orderNumber: (r.order_number || '') as string,
          customerName: (r.customer_name || '') as string,
          total: (r.total_amount || 0) as number,
          createdAt: (r.created_at || '') as string,
          status: (r.status || 'Pending') as string,
          paymentMethod: (r.payment_method || '') as string,
        }));
        setNotifications(mapped);
        // Start alarm for existing unacknowledged pending orders
        updateAlarm(mapped, muted);
      }
    };
    fetchPendingOnline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Supabase real-time: listen for new Online orders ──
  useEffect(() => {
    const channel = supabase
      .channel('online-order-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          const source = (r.source as string) || '';
          // Alert for Online orders (WhatsApp, M-Pesa, Card) — NOT POS orders
          if (source === 'Online') {
            const newNotif: OnlineOrderNotif = {
              id: r.id as string,
              orderNumber: (r.order_number || '') as string,
              customerName: (r.customer_name || '') as string,
              total: (r.total_amount || 0) as number,
              createdAt: (r.created_at || new Date().toISOString()) as string,
              status: (r.status || 'Pending') as string,
              paymentMethod: (r.payment_method || '') as string,
            };
            setNotifications(prev => {
              const updated = [newNotif, ...prev.slice(0, 19)];
              // Start the alarm — new order just came in, it's unacknowledged
              updateAlarm(updated, muted);
              return updated;
            });
            // Show browser notification if permitted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification('NEW ORDER - Action Required!', {
                body: `${newNotif.customerName} - ${newNotif.orderNumber} - KES ${newNotif.total.toLocaleString()}`,
                icon: '/favicon.ico',
                requireInteraction: true,
              });
            }
          }
        }
      )
      .subscribe();

    // Request browser notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata || {};
        const name = meta.full_name || data.user.email?.split('@')[0] || 'User';
        setUser({
          name,
          email: data.user.email || '',
          role: meta.role || 'Administrator',
          initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
        });
      }
    });
  }, []);

  // ── Close dropdowns when clicking outside ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    // Clear online status
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.email) {
        await supabase
          .from('users')
          .update({ last_activity: null })
          .eq('email', currentUser.email);
      }
    } catch { /* non-critical */ }
    logAudit({
      action: 'LOGOUT',
      module: 'Authentication',
      details: { email: user.email },
    });
    // Clear impersonation state if present
    try { sessionStorage.removeItem('impersonation'); } catch { /* ignore */ }
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  // Acknowledge a notification (dismiss) — stops alarm if all acknowledged
  const dismissNotif = (id: string) => {
    acknowledgedRef.current.add(id);
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      updateAlarm(updated, muted);
      return updated;
    });
  };

  // Acknowledge all notifications and stop the alarm
  const acknowledgeAll = () => {
    notifications.forEach(n => acknowledgedRef.current.add(n.id));
    setRinging(false);
    alarmRef.current?.stop();
  };

  // Acknowledge + navigate to orders (clicking Review)
  const handleReviewClick = (id: string) => {
    acknowledgedRef.current.add(id);
    setShowNotifDropdown(false);
    // Check if all are now acknowledged
    const remaining = notifications.filter(n => !acknowledgedRef.current.has(n.id));
    if (remaining.length === 0) {
      setRinging(false);
      alarmRef.current?.stop();
    }
  };

  // Toggle mute
  const toggleMute = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (newMuted) {
      alarmRef.current?.stop();
      setRinging(false);
    } else {
      updateAlarm(notifications, newMuted);
    }
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <header className="border-b border-border bg-background px-6 py-3 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-2">
        {adminLogoUrl ? (
          <img src={adminLogoUrl} alt={adminBusinessName} className="h-8 w-auto object-contain rounded-lg" />
        ) : (
          <span className="text-xs text-muted-foreground font-semibold tracking-wide">{adminBusinessName}</span>
        )}
      </div>

      {/* Ringing banner — shows across the header when alarm is active */}
      {ringing && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-red-500 text-white rounded-full animate-pulse">
          <Bell size={14} className="animate-bounce" />
          <span className="text-xs font-bold">NEW ORDER — Click to acknowledge</span>
          <button
            onClick={acknowledgeAll}
            className="px-2 py-0.5 bg-white text-red-600 rounded text-[10px] font-bold hover:bg-red-50"
          >
            STOP ALARM
          </button>
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-2">

        {/* ── Install App Button ── */}
        {canInstall && !isInstalled && (
          <button
            onClick={triggerInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            title="Install Snackoh App"
          >
            <Download size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {/* ── Mute Toggle ── */}
        <button
          onClick={toggleMute}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${muted ? 'text-red-500 bg-red-50' : 'text-muted-foreground hover:bg-secondary'}`}
          title={muted ? 'Unmute alarm' : 'Mute alarm'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* ── Notification Bell ── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifDropdown(v => !v)}
            className={`relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-secondary transition-colors ${ringing ? 'text-red-500' : 'text-muted-foreground'}`}
            title="Online order notifications"
          >
            <Bell
              size={18}
              className={ringing ? 'animate-bounce' : ''}
              strokeWidth={ringing ? 2.5 : 2}
            />
            {notifications.length > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ${ringing ? 'animate-ping' : ''}`}>
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 bg-secondary/50 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-primary" />
                  <p className="text-sm font-bold">New Online Orders</p>
                </div>
                <div className="flex items-center gap-2">
                  {ringing && (
                    <button
                      onClick={acknowledgeAll}
                      className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded font-bold hover:bg-red-600"
                    >
                      Stop Alarm
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <Link
                      href="/admin/orders"
                      onClick={() => { acknowledgeAll(); setShowNotifDropdown(false); }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      View all
                    </Link>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No new online orders</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {notifications.map(n => (
                    <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors ${!acknowledgedRef.current.has(n.id) ? 'bg-red-50/50' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.status === 'On Hold' ? 'bg-amber-100' : !acknowledgedRef.current.has(n.id) ? 'bg-red-100 animate-pulse' : 'bg-blue-100'}`}>
                        <ShoppingBag size={14} className={n.status === 'On Hold' ? 'text-amber-600' : !acknowledgedRef.current.has(n.id) ? 'text-red-600' : 'text-blue-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{n.customerName}</p>
                        <p className="text-xs text-muted-foreground">{n.orderNumber} &bull; KES {n.total.toLocaleString()}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${n.status === 'On Hold' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {n.status}
                          </span>
                          {n.paymentMethod && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-gray-100 text-gray-600">
                              {n.paymentMethod}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Link
                          href="/admin/orders"
                          onClick={() => handleReviewClick(n.id)}
                          className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground rounded font-medium hover:opacity-90"
                        >
                          Review
                        </Link>
                        <button
                          onClick={() => dismissNotif(n.id)}
                          className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded hover:bg-secondary/70"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="px-4 py-2 border-t border-border bg-secondary/30">
                <Link
                  href="/admin/orders"
                  onClick={() => { acknowledgeAll(); setShowNotifDropdown(false); }}
                  className="block text-center text-xs text-primary hover:underline font-medium py-1"
                >
                  Go to Online Orders tab
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── User Profile Dropdown ── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
            <div className="w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
              {user.initials}
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-4 bg-secondary/50 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm shadow">
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">{user.role}</span>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <a href="/admin/account" onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                  <span className="text-base">⚙️</span><span>Account Settings</span>
                </a>
                <a href="/admin/account" onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                  <span className="text-base">👤</span><span>My Profile</span>
                </a>
                {isAdmin && (
                  <a href="/admin/roles-permissions" onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                    <span className="text-base">🔐</span><span>Roles & Permissions</span>
                  </a>
                )}
              </div>

              <div className="border-t border-border py-1">
                <button onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <span className="text-base">🚪</span><span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
