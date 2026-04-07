'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import { ClipboardList, Truck, MapPin, Phone, User, Package, Clock, CheckCircle, Navigation, AlertTriangle, ChevronRight, Plus, Eye, Search, Loader2, Radio, Zap, Settings2 } from 'lucide-react';
import { logAudit } from '@/lib/audit-logger';
import { useUserPermissions } from '@/lib/user-permissions';
import { useRiderLocationBroadcast } from '@/lib/use-delivery-tracking';
import { useBackgroundLocationTracking } from '@/lib/use-background-tracking';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  address: string;
  gpsLat: number;
  gpsLng: number;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  activeDeliveryCount?: number;
}

interface Vehicle {
  id: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
}

interface DeliveryItem {
  name: string;
  quantity: number;
  unit: string;
}

interface Delivery {
  id: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  customerAddress: string;
  customerGpsLat: number;
  customerGpsLng: number;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleName: string;
  status: 'Pending' | 'Assigned' | 'In Transit' | 'Delivered' | 'Failed';
  scheduledDate: string;
  timeSlot: string;
  items: DeliveryItem[];
  notes: string;
  specialInstructions: string;
  createdAt: string;
  departureLocation: string;
  distanceKm: number;
  tripStartMileage: number;
  tripEndMileage: number;
  assignmentMode: 'manual' | 'automatic';
}

const TIME_SLOTS = [
  '06:00 - 08:00',
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
];

const STATUSES: Delivery['status'][] = ['Pending', 'Assigned', 'In Transit', 'Delivered', 'Failed'];

const emptyItem: DeliveryItem = { name: '', quantity: 1, unit: 'pcs' };

function generateTrackingNumber(): string {
  const prefix = 'DEL';
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${rand}`;
}

function dbToDelivery(r: Record<string, unknown>): Delivery {
  let items: DeliveryItem[] = [];
  try {
    if (r.items && typeof r.items === 'string') items = JSON.parse(r.items);
    else if (Array.isArray(r.items)) items = r.items as DeliveryItem[];
  } catch { /* empty */ }
  return {
    id: r.id as string,
    trackingNumber: (r.tracking_number || '') as string,
    customerId: (r.customer_id || '') as string,
    customerName: (r.customer_name || '') as string,
    customerPhone: (r.customer_phone || '') as string,
    customerLocation: (r.customer_location || r.destination || '') as string,
    customerAddress: (r.customer_address || '') as string,
    customerGpsLat: (r.customer_gps_lat || 0) as number,
    customerGpsLng: (r.customer_gps_lng || 0) as number,
    driverId: (r.driver_id || '') as string,
    driverName: (r.driver || r.driver_name || '') as string,
    vehicleId: (r.vehicle_id || '') as string,
    vehicleName: (r.vehicle || r.vehicle_name || '') as string,
    status: (r.status || 'Pending') as Delivery['status'],
    scheduledDate: (r.scheduled_date || '') as string,
    timeSlot: (r.time_slot || '') as string,
    items,
    notes: (r.notes || '') as string,
    specialInstructions: (r.special_instructions || '') as string,
    createdAt: (r.created_at || '') as string,
    departureLocation: (r.departure_location || '') as string,
    distanceKm: (r.distance_km || 0) as number,
    tripStartMileage: (r.trip_start_mileage || 0) as number,
    tripEndMileage: (r.trip_end_mileage || 0) as number,
    assignmentMode: (r.assignment_mode || 'manual') as 'manual' | 'automatic',
  };
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: { productName: string; quantity: number }[];
}

interface OutletLocation {
  id: string;
  name: string;
  gps_lat: number;
  gps_lng: number;
  address: string;
}

export default function DeliveryPage() {
  const { role, isAdmin, fullName } = useUserPermissions();
  const isRider = role === 'Driver' || role === 'Rider';

  // If rider, show the rider-specific view
  if (isRider && !isAdmin) {
    return <RiderDeliveryView riderName={fullName} />;
  }

  return <AdminDeliveryView />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── RIDER DELIVERY VIEW (Modern Bolt-like UI) ──
// ═══════════════════════════════════════════════════════════════════════════════

function RiderDeliveryView({ riderName }: { riderName: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my_deliveries' | 'completed'>('available');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Background location tracking for PWA
  const { isTracking: isBgTracking, startTracking: startBgTracking, stopTracking: stopBgTracking } = useBackgroundLocationTracking();

  const fetchMyDeliveries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setDeliveries(data.map((r: Record<string, unknown>) => dbToDelivery(r)));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMyDeliveries(); }, [fetchMyDeliveries]);

  // Take an order (rider accepts it)
  const handleTakeOrder = async (id: string) => {
    await supabase.from('deliveries').update({
      status: 'Assigned',
      driver: riderName,
      driver_name: riderName,
    }).eq('id', id);
    logAudit({ action: 'UPDATE', module: 'Delivery', record_id: id, details: { status: 'Assigned', rider: riderName, action: 'Took order' } });
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'Assigned' as const, driverName: riderName } : d));
  };

  // Pick up the order (start transit)
  const handlePickUp = async (id: string) => {
    await supabase.from('deliveries').update({ status: 'In Transit' }).eq('id', id);
    logAudit({ action: 'UPDATE', module: 'Delivery', record_id: id, details: { status: 'In Transit', rider: riderName } });
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'In Transit' as const } : d));
    if (selectedDelivery?.id === id) setSelectedDelivery(prev => prev ? { ...prev, status: 'In Transit' as const } : null);
    // Start background location tracking for this delivery
    startBgTracking({ deliveryId: id, riderName });
  };

  const handleComplete = async (id: string) => {
    await supabase.from('deliveries').update({ status: 'Delivered' }).eq('id', id);
    logAudit({ action: 'UPDATE', module: 'Delivery', record_id: id, details: { status: 'Delivered', rider: riderName } });
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'Delivered' as const } : d));
    if (selectedDelivery?.id === id) setSelectedDelivery(prev => prev ? { ...prev, status: 'Delivered' as const } : null);
    // Stop background tracking when delivery is completed
    stopBgTracking();
  };

  const handleFailed = async (id: string) => {
    if (!confirm('Mark this delivery as failed?')) return;
    await supabase.from('deliveries').update({ status: 'Failed' }).eq('id', id);
    logAudit({ action: 'UPDATE', module: 'Delivery', record_id: id, details: { status: 'Failed', rider: riderName } });
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status: 'Failed' as const } : d));
    if (selectedDelivery?.id === id) setSelectedDelivery(prev => prev ? { ...prev, status: 'Failed' as const } : null);
    // Stop background tracking when delivery fails
    stopBgTracking();
  };

  const getMapUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  const getMapLinkUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  const isMyDelivery = (d: Delivery) =>
    d.driverName?.toLowerCase().includes(riderName.toLowerCase());

  const getGoogleMapsDirections = (destLat: number, destLng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;

  // GPS tracking for auto-delivery + live broadcast
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState('');

  // Maintain broadcast channels for In Transit deliveries
  const broadcastChannelsRef = useRef<Map<string, ReturnType<typeof supabase.channel>>>(new Map());

  // Setup/teardown broadcast channels when deliveries change
  useEffect(() => {
    const inTransit = deliveries.filter(d =>
      d.driverName?.toLowerCase().includes(riderName.toLowerCase()) && d.status === 'In Transit'
    );
    const currentChannels = broadcastChannelsRef.current;
    const activeIds = new Set(inTransit.map(d => d.id));

    // Remove channels for deliveries no longer in transit
    for (const [id, ch] of currentChannels.entries()) {
      if (!activeIds.has(id)) {
        supabase.removeChannel(ch);
        currentChannels.delete(id);
      }
    }

    // Create channels for new In Transit deliveries
    for (const d of inTransit) {
      if (!currentChannels.has(d.id)) {
        const ch = supabase.channel(`delivery-tracking-${d.id}`);
        ch.subscribe();
        currentChannels.set(d.id, ch);
      }
    }

    return () => {
      for (const [, ch] of currentChannels.entries()) {
        supabase.removeChannel(ch);
      }
      currentChannels.clear();
    };
  }, [deliveries, riderName]);

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setRiderLocation(loc);
        setLocationError('');

        // Broadcast rider location on all active broadcast channels
        for (const [deliveryId, channel] of broadcastChannelsRef.current.entries()) {
          channel.send({
            type: 'broadcast',
            event: 'rider-location',
            payload: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: Date.now(),
              deliveryId,
              riderName,
            },
          });
        }
      },
      (err) => setLocationError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    setWatchId(id);
  }, [riderName]);

  useEffect(() => {
    startLocationTracking();
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, [startLocationTracking]);

  // Check proximity for auto-delivery (within 100m)
  const checkProximity = useCallback((delivery: Delivery) => {
    if (!riderLocation || !delivery.customerGpsLat || !delivery.customerGpsLng) return false;
    const R = 6371000;
    const dLat = (delivery.customerGpsLat - riderLocation.lat) * (Math.PI / 180);
    const dLng = (delivery.customerGpsLng - riderLocation.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(riderLocation.lat * (Math.PI / 180)) * Math.cos(delivery.customerGpsLat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= 100;
  }, [riderLocation]);

  const calcDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Auto-deliver when rider reaches customer location
  useEffect(() => {
    if (!riderLocation) return;
    myActiveDeliveries.filter(d => d.status === 'In Transit').forEach(async (d) => {
      if (checkProximity(d)) {
        await supabase.from('deliveries').update({
          status: 'Delivered',
          auto_delivered: true,
          rider_lat: riderLocation.lat,
          rider_lng: riderLocation.lng,
        }).eq('id', d.id);
        logAudit({ action: 'UPDATE', module: 'Delivery', record_id: d.id, details: { status: 'Delivered', auto_delivered: true, rider: riderName } });
        setDeliveries(prev => prev.map(del => del.id === d.id ? { ...del, status: 'Delivered' as const } : del));
      }
    });
  }, [riderLocation, myActiveDeliveries, checkProximity, riderName]);

  // Tab filtering
  const availableDeliveries = deliveries.filter(d => d.status === 'Pending' && !isMyDelivery(d));
  const myActiveDeliveries = deliveries.filter(d =>
    isMyDelivery(d) && (d.status === 'Assigned' || d.status === 'In Transit')
  );
  const completedDeliveries = deliveries.filter(d =>
    isMyDelivery(d) && (d.status === 'Delivered' || d.status === 'Failed')
  );

  const displayList = activeTab === 'available' ? availableDeliveries
    : activeTab === 'my_deliveries' ? myActiveDeliveries
    : completedDeliveries;

  // Search filter
  const filtered = displayList.filter(d => {
    if (!searchTerm) return true;
    return `${d.trackingNumber} ${d.customerName} ${d.customerLocation} ${d.customerPhone}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchTerm]);

  const getStatusBadge = (s: Delivery['status']) => {
    switch (s) {
      case 'Pending': return 'bg-secondary text-foreground border border-border';
      case 'Assigned': return 'bg-foreground text-background';
      case 'In Transit': return 'bg-foreground/80 text-background';
      case 'Delivered': return 'bg-foreground text-background';
      case 'Failed': return 'bg-red-600 text-white';
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayActive = myActiveDeliveries.filter(d => d.scheduledDate === today).length;
  const todayCompleted = completedDeliveries.filter(d => d.scheduledDate === today).length;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg md:text-xl font-bold mb-1">My Deliveries</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Welcome back, {riderName || 'Rider'} &mdash; {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          {/* GPS Status */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${riderLocation ? 'bg-green-100 text-green-800' : locationError ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
              <div className={`w-2 h-2 rounded-full ${riderLocation ? 'bg-green-500 animate-pulse' : locationError ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
              {riderLocation ? 'GPS Active - Live Tracking' : locationError ? `GPS Error: ${locationError}` : 'Acquiring GPS...'}
            </div>
            {isBgTracking && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                <Radio size={12} className="animate-pulse" />
                Background Tracking Active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="border border-border rounded-lg p-3 md:p-4 bg-card">
          <p className="text-[10px] md:text-sm text-muted-foreground">Available Orders</p>
          <p className="text-lg md:text-2xl font-bold">{availableDeliveries.length}</p>
        </div>
        <div className="border border-border rounded-lg p-3 md:p-4 bg-card">
          <p className="text-[10px] md:text-sm text-muted-foreground">My Active</p>
          <p className="text-lg md:text-2xl font-bold">{myActiveDeliveries.length}</p>
        </div>
        <div className="border border-border rounded-lg p-3 md:p-4 bg-card">
          <p className="text-[10px] md:text-sm text-muted-foreground">Today Active</p>
          <p className="text-lg md:text-2xl font-bold">{todayActive}</p>
        </div>
        <div className="border border-border rounded-lg p-3 md:p-4 bg-card">
          <p className="text-[10px] md:text-sm text-muted-foreground">Today Completed</p>
          <p className="text-lg md:text-2xl font-bold">{todayCompleted}</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'available' ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-secondary'
            }`}
          >
            Available ({availableDeliveries.length})
          </button>
          <button
            onClick={() => setActiveTab('my_deliveries')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-l border-border ${
              activeTab === 'my_deliveries' ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-secondary'
            }`}
          >
            My Deliveries ({myActiveDeliveries.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-semibold transition-colors border-l border-border ${
              activeTab === 'completed' ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-secondary'
            }`}
          >
            Completed ({completedDeliveries.length})
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search deliveries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
          />
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading deliveries...</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Tracking #</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Location</th>
                <th className="px-4 py-3 text-left font-semibold">Date / Slot</th>
                <th className="px-4 py-3 text-center font-semibold">Items</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground font-medium">
                      {activeTab === 'available' ? 'No available orders right now' : activeTab === 'my_deliveries' ? 'No active deliveries' : 'No completed deliveries yet'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((d) => (
                  <tr key={d.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{d.trackingNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.customerName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{d.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">{d.customerLocation || d.customerAddress || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{d.scheduledDate || '—'}</div>
                      <div className="text-xs text-muted-foreground">{d.timeSlot}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{d.items.length}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded font-semibold ${getStatusBadge(d.status)}`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* Eye icon - view delivery details & destination */}
                        <button
                          onClick={() => setSelectedDelivery(d)}
                          className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                          title="View delivery details & destination"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Plus icon - take this order (only for available Pending orders) */}
                        {activeTab === 'available' && d.status === 'Pending' && (
                          <button
                            onClick={() => handleTakeOrder(d.id)}
                            className="p-2 rounded-lg bg-foreground text-background hover:opacity-80 transition-colors"
                            title="Take this order"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}

                        {/* Pick Up button (for assigned deliveries) */}
                        {activeTab === 'my_deliveries' && d.status === 'Assigned' && (
                          <button
                            onClick={() => handlePickUp(d.id)}
                            className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-colors"
                            title="Pick up delivery"
                          >
                            Pick Up
                          </button>
                        )}

                        {/* Delivered / Failed buttons (only for In Transit) */}
                        {activeTab === 'my_deliveries' && d.status === 'In Transit' && (
                          <>
                            <button
                              onClick={() => handleComplete(d.id)}
                              className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-80 transition-colors"
                              title="Mark as delivered"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFailed(d.id)}
                              className="p-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                              title="Mark as failed"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} deliveries
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${
                  page === currentPage
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Delivery Detail Modal (Rider View) ── */}
      <Modal
        isOpen={!!selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
        title={selectedDelivery ? `Delivery ${selectedDelivery.trackingNumber}` : ''}
        size="3xl"
      >
        {selectedDelivery && (
          <div className="space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getStatusBadge(selectedDelivery.status)}`}>{selectedDelivery.status}</span>
              <span className="text-xs text-muted-foreground">{selectedDelivery.scheduledDate} {selectedDelivery.timeSlot}</span>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-1">
              {(['Pending', 'Assigned', 'In Transit', 'Delivered'] as const).map((s, idx) => {
                const statusOrder = ['Pending', 'Assigned', 'In Transit', 'Delivered'];
                const currentIdx = statusOrder.indexOf(selectedDelivery.status);
                const isActive = idx <= currentIdx;
                const isFailed = selectedDelivery.status === 'Failed';
                return (
                  <div key={s} className="flex-1">
                    <div className={`h-1.5 rounded-full ${isFailed && idx === currentIdx ? 'bg-red-500' : isActive ? 'bg-foreground' : 'bg-secondary'}`} />
                    <p className={`text-[10px] mt-1 text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</p>
                  </div>
                );
              })}
            </div>

            {/* Customer Card */}
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Customer</p>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg">{selectedDelivery.customerName || 'Unknown'}</p>
                  {selectedDelivery.customerPhone && (
                    <a href={`tel:${selectedDelivery.customerPhone}`} className="flex items-center gap-1 text-foreground text-sm mt-1 hover:underline">
                      <Phone className="w-3.5 h-3.5" /> {selectedDelivery.customerPhone}
                    </a>
                  )}
                  {selectedDelivery.customerLocation && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="w-3.5 h-3.5" /> {selectedDelivery.customerLocation}
                    </div>
                  )}
                  {selectedDelivery.customerAddress && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedDelivery.customerAddress}</p>
                  )}
                </div>
              </div>

              {/* Map */}
              {selectedDelivery.customerGpsLat !== 0 && selectedDelivery.customerGpsLng !== 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">Customer Location</p>
                    <a
                      href={getMapLinkUrl(selectedDelivery.customerGpsLat, selectedDelivery.customerGpsLng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-foreground hover:underline font-semibold flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Navigate
                    </a>
                  </div>
                  <iframe
                    src={getMapUrl(selectedDelivery.customerGpsLat, selectedDelivery.customerGpsLng)}
                    width="100%"
                    height="200"
                    className="rounded-lg border border-border"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* Delivery Info */}
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Delivery Details</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Tracking:</span> <span className="font-mono font-semibold ml-1">{selectedDelivery.trackingNumber}</span></div>
                <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium ml-1">{selectedDelivery.vehicleName || '---'}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-medium ml-1">{selectedDelivery.scheduledDate || '---'}</span></div>
                <div><span className="text-muted-foreground">Time Slot:</span> <span className="font-medium ml-1">{selectedDelivery.timeSlot || '---'}</span></div>
              </div>
            </div>

            {/* Route & Distance */}
            {(selectedDelivery.departureLocation || selectedDelivery.distanceKm > 0) && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Route Information</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedDelivery.departureLocation && (
                    <div><span className="text-muted-foreground">From:</span> <span className="font-medium ml-1">{selectedDelivery.departureLocation}</span></div>
                  )}
                  {selectedDelivery.customerLocation && (
                    <div><span className="text-muted-foreground">To:</span> <span className="font-medium ml-1">{selectedDelivery.customerLocation}</span></div>
                  )}
                  {selectedDelivery.distanceKm > 0 && (
                    <div><span className="text-muted-foreground">Distance:</span> <strong className="ml-1">{selectedDelivery.distanceKm} km</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            {selectedDelivery.items.length > 0 && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Items for Delivery ({selectedDelivery.items.length})</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Item</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Qty</th>
                      <th className="text-left py-2 pl-3 text-muted-foreground font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDelivery.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2 text-right font-bold">{item.quantity}</td>
                        <td className="py-2 pl-3 text-muted-foreground">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {(selectedDelivery.notes || selectedDelivery.specialInstructions) && (
              <div className="space-y-3">
                {selectedDelivery.notes && (
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Delivery Notes</p>
                    <p className="text-sm">{selectedDelivery.notes}</p>
                  </div>
                )}
                {selectedDelivery.specialInstructions && (
                  <div className="border border-border rounded-lg p-4 bg-secondary">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Special Instructions</p>
                    <p className="text-sm">{selectedDelivery.specialInstructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-3 border-t border-border">
              {selectedDelivery.status === 'Pending' && !isMyDelivery(selectedDelivery) && (
                <button
                  onClick={() => { handleTakeOrder(selectedDelivery.id); setSelectedDelivery(prev => prev ? { ...prev, status: 'Assigned' as const, driverName: riderName } : null); }}
                  className="w-full py-3 bg-foreground text-background rounded-lg text-sm font-bold hover:opacity-80 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Take This Order
                </button>
              )}
              {(selectedDelivery.status === 'Pending' || selectedDelivery.status === 'Assigned') && isMyDelivery(selectedDelivery) && (
                <button
                  onClick={() => handlePickUp(selectedDelivery.id)}
                  className="w-full py-3 bg-foreground text-background rounded-lg text-sm font-bold hover:opacity-80 flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" /> Pick Up Delivery
                </button>
              )}
              {selectedDelivery.status === 'In Transit' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleComplete(selectedDelivery.id)}
                    className="flex-1 py-3 bg-foreground text-background rounded-lg text-sm font-bold hover:opacity-80 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark as Delivered
                  </button>
                  <button
                    onClick={() => handleFailed(selectedDelivery.id)}
                    className="py-3 px-4 border border-red-300 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" /> Failed
                  </button>
                </div>
              )}
              <button
                onClick={() => setSelectedDelivery(null)}
                className="w-full py-2.5 border border-border rounded-lg text-sm hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ADMIN DELIVERY VIEW (Original) ──
// ═══════════════════════════════════════════════════════════════════════════════

function AdminDeliveryView() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<Delivery | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    trackingNumber: '',
    customerId: '',
    driverId: '',
    vehicleId: '',
    status: 'Pending' as Delivery['status'],
    scheduledDate: '',
    timeSlot: '',
    items: [{ ...emptyItem }] as DeliveryItem[],
    notes: '',
    specialInstructions: '',
    departureLocation: '',
    distanceKm: 0,
    tripStartMileage: 0,
    tripEndMileage: 0,
  });

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [customerSearch, setCustomerSearch] = useState('');

  // Distance calculation state
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [distanceInfo, setDistanceInfo] = useState('');

  // Assignment mode: 'manual' or 'automatic'
  const [assignmentMode, setAssignmentMode] = useState<'manual' | 'automatic'>('automatic');
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Fetch assignment mode setting from business_settings
  useEffect(() => {
    const fetchAssignmentMode = async () => {
      const { data } = await supabase
        .from('business_settings')
        .select('value')
        .eq('key', 'delivery_assignment_mode')
        .single();
      if (data?.value) {
        try {
          const mode = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (mode === 'manual' || mode === 'automatic') setAssignmentMode(mode);
        } catch { /* keep default */ }
      }
    };
    fetchAssignmentMode();
  }, []);

  // Save assignment mode to business_settings
  const toggleAssignmentMode = async (mode: 'manual' | 'automatic') => {
    setAssignmentMode(mode);
    await supabase
      .from('business_settings')
      .upsert({ key: 'delivery_assignment_mode', value: JSON.stringify(mode) });
    logAudit({ action: 'UPDATE', module: 'Delivery Settings', record_id: 'delivery_assignment_mode', details: { mode } });
  };

  // Find the best available (free) rider - one who has the fewest active deliveries
  const findFreeRider = useCallback((currentDrivers: Driver[]): Driver | null => {
    const activeDrivers = currentDrivers.filter(d => d.status === 'Active');
    if (activeDrivers.length === 0) return null;
    // Sort by active delivery count (ascending) - rider with least active deliveries is "free"
    const sorted = [...activeDrivers].sort((a, b) => (a.activeDeliveryCount || 0) - (b.activeDeliveryCount || 0));
    // Return the rider with the fewest active deliveries (prefer truly free riders with 0)
    return sorted[0];
  }, []);

  // Auto-assign rider to a delivery
  const autoAssignRider = useCallback(async (deliveryId: string, currentDrivers: Driver[]) => {
    const freeRider = findFreeRider(currentDrivers);
    if (!freeRider) return null;

    const driverName = `${freeRider.firstName} ${freeRider.lastName}`;
    await supabase.from('deliveries').update({
      driver_id: freeRider.id,
      driver: driverName,
      driver_name: driverName,
      status: 'Assigned',
      assignment_mode: 'automatic',
      assigned_at: new Date().toISOString(),
    }).eq('id', deliveryId);

    logAudit({
      action: 'UPDATE',
      module: 'Delivery',
      record_id: deliveryId,
      details: { driver: driverName, status: 'Assigned', assignmentMode: 'automatic', autoAssigned: true },
    });

    return freeRider;
  }, [findFreeRider]);

  // Location suggestions for departure
  const [departureSuggestions, setDepartureSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [departureSearchTimeout, setDepartureSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch location suggestions using Nominatim
  const fetchLocationSuggestions = async (query: string) => {
    if (query.length < 3) {
      setDepartureSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ke&limit=5`);
      const data = await res.json();
      setDepartureSuggestions(data || []);
      setShowDepartureSuggestions(true);
    } catch {
      setDepartureSuggestions([]);
    }
  };

  const handleDepartureInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, departureLocation: value }));
    if (departureSearchTimeout) clearTimeout(departureSearchTimeout);
    const timeout = setTimeout(() => fetchLocationSuggestions(value), 400);
    setDepartureSearchTimeout(timeout);
  };

  const selectDepartureSuggestion = (suggestion: { display_name: string }) => {
    setFormData(prev => ({ ...prev, departureLocation: suggestion.display_name }));
    setShowDepartureSuggestions(false);
    setDepartureSuggestions([]);
  };

  // Calculate distance using Google Distance Matrix API via server endpoint
  const calculateDistance = async (origin: string, destination: string) => {
    if (!origin || !destination) return;
    setCalculatingDistance(true);
    setDistanceError('');
    setDistanceInfo('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ origin, destination }),
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, distanceKm: data.distanceKm }));
        setDistanceInfo(`${data.distanceText} — est. ${data.durationText}`);
      } else {
        setDistanceError(data.message || 'Could not calculate distance');
      }
    } catch {
      setDistanceError('Failed to connect to distance service');
    }
    setCalculatingDistance(false);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // Fetch deliveries
  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('deliveries').select('*').order('created_at', { ascending: false });
    if (data) {
      setDeliveries(data.map((r: Record<string, unknown>) => dbToDelivery(r)));
    }
    setLoading(false);
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name', { ascending: true });
    if (data) {
      setCustomers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        phone: (r.phone || '') as string,
        email: (r.email || '') as string,
        location: (r.location || '') as string,
        address: (r.address || '') as string,
        gpsLat: (r.gps_lat || 0) as number,
        gpsLng: (r.gps_lng || 0) as number,
      })));
    }
  }, []);

  // Fetch drivers (employees where category = 'Driver' or 'Rider')
  const fetchDrivers = useCallback(async () => {
    const { data } = await supabase.from('employees').select('*').in('category', ['Driver', 'Rider']).order('first_name', { ascending: true });
    if (data) {
      // Get active delivery counts per driver
      const { data: activeDeliveries } = await supabase
        .from('deliveries')
        .select('driver_id')
        .in('status', ['Assigned', 'In Transit']);

      const deliveryCounts: Record<string, number> = {};
      if (activeDeliveries) {
        for (const d of activeDeliveries) {
          const did = d.driver_id as string;
          if (did) deliveryCounts[did] = (deliveryCounts[did] || 0) + 1;
        }
      }

      setDrivers(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        firstName: (r.first_name || '') as string,
        lastName: (r.last_name || '') as string,
        phone: (r.phone || '') as string,
        status: (r.status || 'Active') as string,
        activeDeliveryCount: deliveryCounts[r.id as string] || 0,
      })));
    }
  }, []);

  // Fetch vehicles (assets where category contains 'Vehicle')
  const fetchVehicles = useCallback(async () => {
    const { data } = await supabase.from('assets').select('*').ilike('category', '%Vehicle%').order('name', { ascending: true });
    if (data) {
      setVehicles(data.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name || '') as string,
        category: (r.category || '') as string,
        serialNumber: (r.serial_number || '') as string,
        status: (r.status || 'Active') as string,
      })));
    }
  }, []);

  // Fetch recent orders for import
  const fetchRecentOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone')
      .in('status', ['Pending', 'Confirmed', 'Processing', 'Ready'])
      .order('created_at', { ascending: false })
      .limit(30);
    if (data && data.length > 0) {
      const withItems = await Promise.all(data.map(async (r: Record<string, unknown>) => {
        const { data: items } = await supabase.from('order_items').select('product_name, quantity').eq('order_id', r.id);
        return {
          id: r.id as string,
          orderNumber: (r.order_number || '') as string,
          customerName: (r.customer_name || '') as string,
          customerPhone: (r.customer_phone || '') as string,
          items: (items || []).map((i: Record<string, unknown>) => ({ productName: (i.product_name || '') as string, quantity: (i.quantity || 1) as number })),
        };
      }));
      setRecentOrders(withItems);
    }
  }, []);

  // Fetch outlet locations for auto-assign distance calculation
  const [outletLocations, setOutletLocations] = useState<OutletLocation[]>([]);
  const [autoAssignResult, setAutoAssignResult] = useState('');

  const fetchOutletLocations = useCallback(async () => {
    const { data } = await supabase
      .from('outlets')
      .select('id, name, gps_lat, gps_lng, address')
      .eq('status', 'Active')
      .order('is_main_branch', { ascending: false });
    if (data) {
      setOutletLocations(data.map((r: Record<string, unknown>) => ({
        id: (r.id || '') as string,
        name: (r.name || '') as string,
        gps_lat: (r.gps_lat || 0) as number,
        gps_lng: (r.gps_lng || 0) as number,
        address: (r.address || '') as string,
      })));
    }
  }, []);

  // Haversine distance (km) between two GPS points
  const calcDistKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Auto-assign the best available rider
  const handleAutoAssign = () => {
    setAutoAssignResult('');

    // Get the departure/outlet GPS coordinates
    let originLat = 0;
    let originLng = 0;

    // Try to get outlet GPS from departure location matching
    if (formData.departureLocation) {
      const matchedOutlet = outletLocations.find(o =>
        o.name.toLowerCase().includes(formData.departureLocation.toLowerCase()) ||
        formData.departureLocation.toLowerCase().includes(o.name.toLowerCase()) ||
        o.address.toLowerCase().includes(formData.departureLocation.toLowerCase())
      );
      if (matchedOutlet && matchedOutlet.gps_lat !== 0) {
        originLat = matchedOutlet.gps_lat;
        originLng = matchedOutlet.gps_lng;
      }
    }

    // If no departure match, use the customer's GPS as reference
    const customer = customers.find(c => c.id === formData.customerId);
    if (originLat === 0 && customer && customer.gpsLat !== 0) {
      originLat = customer.gpsLat;
      originLng = customer.gpsLng;
    }

    // If still no GPS reference, try the first outlet with GPS
    if (originLat === 0) {
      const outletWithGps = outletLocations.find(o => o.gps_lat !== 0);
      if (outletWithGps) {
        originLat = outletWithGps.gps_lat;
        originLng = outletWithGps.gps_lng;
      }
    }

    // Filter only active drivers
    const activeDrivers = drivers.filter(d => d.status === 'Active');
    if (activeDrivers.length === 0) {
      setAutoAssignResult('No active riders available');
      return;
    }

    // Scoring: prioritize riders with no active deliveries, then closest to origin
    type ScoredDriver = Driver & { score: number; distanceKm: number };
    const scoredDrivers: ScoredDriver[] = activeDrivers.map(d => {
      let distanceKm = 9999;
      if (originLat !== 0 && d.lastLat !== 0 && d.lastLng !== 0) {
        distanceKm = calcDistKm(originLat, originLng, d.lastLat, d.lastLng);
      }
      // Score: lower is better
      // Free riders (0 active deliveries) get a big bonus
      // Riders with known location get preference
      const deliveryPenalty = d.activeDeliveries * 50; // 50km penalty per active delivery
      const noLocationPenalty = d.lastLat === 0 ? 100 : 0; // penalty for unknown location
      const score = distanceKm + deliveryPenalty + noLocationPenalty;
      return { ...d, score, distanceKm };
    });

    // Sort by score (lowest first = best match)
    scoredDrivers.sort((a, b) => a.score - b.score);

    const best = scoredDrivers[0];
    setFormData(prev => ({ ...prev, driverId: best.id }));

    const distText = best.lastLat !== 0 && originLat !== 0
      ? `${best.distanceKm.toFixed(1)} km away`
      : 'location unknown';
    const deliveryText = best.activeDeliveries === 0
      ? 'no active deliveries'
      : `${best.activeDeliveries} active delivery(s)`;
    setAutoAssignResult(`Auto-assigned ${best.firstName} ${best.lastName} (${distText}, ${deliveryText})`);
  };

  useEffect(() => {
    fetchDeliveries();
    fetchCustomers();
    fetchDrivers();
    fetchVehicles();
    fetchRecentOrders();
    fetchOutletLocations();
  }, [fetchDeliveries, fetchCustomers, fetchDrivers, fetchVehicles, fetchRecentOrders, fetchOutletLocations]);

  // Import from order: populate customer + items
  const importFromOrder = (orderId: string) => {
    const order = recentOrders.find(o => o.id === orderId);
    if (!order) return;
    // Try to match customer from customers list
    const matchedCustomer = customers.find(
      c => c.name.toLowerCase() === order.customerName.toLowerCase()
        || c.phone === order.customerPhone
    );
    setFormData(prev => ({
      ...prev,
      customerId: matchedCustomer?.id || '',
      items: order.items.length > 0
        ? order.items.map(i => ({ name: i.productName, quantity: i.quantity, unit: 'pcs' }))
        : [{ ...emptyItem }],
    }));
    if (matchedCustomer) setCustomerSearch('');
  };

  // Get selected customer details
  const selectedCustomer = customers.find(c => c.id === formData.customerId);
  const selectedDriver = drivers.find(d => d.id === formData.driverId);
  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);

  // Filter customers by search
  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        `${c.name} ${c.phone} ${c.location}`.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find(c => c.id === formData.customerId);
    const driver = drivers.find(d => d.id === formData.driverId);
    const vehicle = vehicles.find(v => v.id === formData.vehicleId);

    const row: Record<string, unknown> = {
      tracking_number: formData.trackingNumber,
      customer_id: formData.customerId || null,
      customer_name: customer?.name || '',
      customer_phone: customer?.phone || '',
      customer_location: customer?.location || '',
      customer_address: customer?.address || '',
      customer_gps_lat: customer?.gpsLat || null,
      customer_gps_lng: customer?.gpsLng || null,
      destination: customer?.location || '',
      driver_id: formData.driverId || null,
      driver: driver ? `${driver.firstName} ${driver.lastName}` : '',
      driver_name: driver ? `${driver.firstName} ${driver.lastName}` : '',
      vehicle_id: formData.vehicleId || null,
      vehicle: vehicle?.name || '',
      vehicle_name: vehicle?.name || '',
      status: formData.status,
      scheduled_date: formData.scheduledDate || null,
      time_slot: formData.timeSlot || null,
      items: JSON.stringify(formData.items.filter(i => i.name.trim())),
      items_count: formData.items.filter(i => i.name.trim()).length,
      notes: formData.notes,
      special_instructions: formData.specialInstructions,
      departure_location: formData.departureLocation,
      distance_km: formData.distanceKm || null,
      trip_start_mileage: formData.tripStartMileage || null,
      trip_end_mileage: formData.tripEndMileage || null,
      assignment_mode: driver ? 'manual' : (assignmentMode === 'automatic' ? 'automatic' : 'manual'),
    };

    try {
      if (editingId) {
        await supabase.from('deliveries').update(row).eq('id', editingId);
        logAudit({
          action: 'UPDATE',
          module: 'Delivery',
          record_id: editingId,
          details: { driver: driver ? `${driver.firstName} ${driver.lastName}` : '', status: formData.status },
        });
      } else {
        const { data: inserted } = await supabase.from('deliveries').insert(row).select('id').single();
        logAudit({
          action: 'CREATE',
          module: 'Delivery',
          record_id: inserted?.id || formData.trackingNumber,
          details: { driver: driver ? `${driver.firstName} ${driver.lastName}` : '', status: formData.status },
        });

        // Auto-assign a free rider if assignment mode is 'automatic' and no driver was manually selected
        if (assignmentMode === 'automatic' && !formData.driverId && inserted?.id) {
          setAutoAssigning(true);
          const assignedRider = await autoAssignRider(inserted.id, drivers);
          setAutoAssigning(false);
          if (assignedRider) {
            logAudit({
              action: 'UPDATE',
              module: 'Delivery',
              record_id: inserted.id,
              details: {
                autoAssigned: true,
                rider: `${assignedRider.firstName} ${assignedRider.lastName}`,
                reason: 'Automatic assignment - rider had fewest active deliveries',
              },
            });
          }
        }
      }
      await fetchDeliveries();
    } catch {
      // fallback: update local state
    }
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      trackingNumber: '',
      customerId: '',
      driverId: '',
      vehicleId: '',
      status: 'Pending',
      scheduledDate: '',
      timeSlot: '',
      items: [{ ...emptyItem }],
      notes: '',
      specialInstructions: '',
      departureLocation: '',
      distanceKm: 0,
      tripStartMileage: 0,
      tripEndMileage: 0,
    });
    setCustomerSearch('');
    setDistanceError('');
    setDistanceInfo('');
    setDepartureSuggestions([]);
    setAutoAssignResult('');
  };

  const openNewForm = () => {
    resetForm();
    setFormData(prev => ({ ...prev, trackingNumber: generateTrackingNumber() }));
    setShowForm(true);
  };

  const handleEdit = (d: Delivery) => {
    setFormData({
      trackingNumber: d.trackingNumber,
      customerId: d.customerId,
      driverId: d.driverId,
      vehicleId: d.vehicleId,
      status: d.status,
      scheduledDate: d.scheduledDate,
      timeSlot: d.timeSlot,
      items: d.items.length > 0 ? d.items : [{ ...emptyItem }],
      notes: d.notes,
      specialInstructions: d.specialInstructions,
      departureLocation: d.departureLocation,
      distanceKm: d.distanceKm,
      tripStartMileage: d.tripStartMileage,
      tripEndMileage: d.tripEndMileage,
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this delivery?')) {
      const deletedDelivery = deliveries.find(d => d.id === id);
      await supabase.from('deliveries').delete().eq('id', id);
      logAudit({
        action: 'DELETE',
        module: 'Delivery',
        record_id: id,
        details: { driver: deletedDelivery?.driverName || '', status: deletedDelivery?.status || '' },
      });
      setDeliveries(deliveries.filter(d => d.id !== id));
    }
  };

  const handleStatusChange = async (id: string, newStatus: Delivery['status']) => {
    const oldDelivery = deliveries.find(d => d.id === id);
    await supabase.from('deliveries').update({ status: newStatus }).eq('id', id);
    logAudit({
      action: 'UPDATE',
      module: 'Delivery',
      record_id: id,
      details: { driver: oldDelivery?.driverName || '', status: newStatus, previousStatus: oldDelivery?.status || '' },
    });
    setDeliveries(deliveries.map(d => d.id === id ? { ...d, status: newStatus } : d));
  };

  // Items management
  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  };

  const removeItem = (idx: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
  };

  const updateItem = (idx: number, field: keyof DeliveryItem, value: string | number) => {
    const updated = formData.items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setFormData({ ...formData, items: updated });
  };

  // Status color helper
  const getStatusColor = (s: Delivery['status']) => {
    switch (s) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Assigned': return 'bg-purple-100 text-purple-800';
      case 'In Transit': return 'bg-blue-100 text-blue-800';
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'Failed': return 'bg-red-100 text-red-800';
    }
  };

  // Map helpers
  const getMapUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  const getMapLinkUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  // Filter and paginate
  const filtered = deliveries.filter(d => {
    const matchSearch = `${d.trackingNumber} ${d.customerName} ${d.driverName} ${d.customerLocation}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus]);

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const totalDeliveries = deliveries.length;
  const pendingCount = deliveries.filter(d => d.status === 'Pending' || d.status === 'Assigned').length;
  const inTransitCount = deliveries.filter(d => d.status === 'In Transit').length;
  const deliveredTodayCount = deliveries.filter(d => d.status === 'Delivered' && d.scheduledDate === today).length;

  // ── Batch Delivery Selection ──
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const [batchDriverId, setBatchDriverId] = useState('');
  const [batchVehicleId, setBatchVehicleId] = useState('');

  const pendingDeliveries = deliveries.filter(d => d.status === 'Pending' || d.status === 'Assigned');

  const toggleBatchSelect = (id: string) => {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBatch = () => {
    if (selectedBatchIds.size === pendingDeliveries.length) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(pendingDeliveries.map(d => d.id)));
    }
  };

  const handleBatchDispatch = async () => {
    if (selectedBatchIds.size === 0) return;
    const driver = drivers.find(d => d.id === batchDriverId);
    const vehicle = vehicles.find(v => v.id === batchVehicleId);
    const driverName = driver ? `${driver.firstName} ${driver.lastName}` : '';

    for (const deliveryId of selectedBatchIds) {
      const updateData: Record<string, unknown> = {
        status: 'In Transit',
      };
      if (batchDriverId) {
        updateData.driver_id = batchDriverId;
        updateData.driver = driverName;
        updateData.driver_name = driverName;
      }
      if (batchVehicleId) {
        updateData.vehicle_id = batchVehicleId;
        updateData.vehicle = vehicle?.name || '';
        updateData.vehicle_name = vehicle?.name || '';
      }
      await supabase.from('deliveries').update(updateData).eq('id', deliveryId);
      logAudit({
        action: 'UPDATE',
        module: 'Delivery',
        record_id: deliveryId,
        details: { driver: driverName, status: 'In Transit', batchDispatch: true, batchSize: selectedBatchIds.size },
      });
    }

    await fetchDeliveries();
    setSelectedBatchIds(new Set());
    setBatchDriverId('');
    setBatchVehicleId('');
    setShowBatchModal(false);
  };

  const handleBatchComplete = async () => {
    if (selectedBatchIds.size === 0) return;
    for (const deliveryId of selectedBatchIds) {
      await supabase.from('deliveries').update({ status: 'Delivered' }).eq('id', deliveryId);
      const del = deliveries.find(d => d.id === deliveryId);
      logAudit({
        action: 'UPDATE',
        module: 'Delivery',
        record_id: deliveryId,
        details: { driver: del?.driverName || '', status: 'Delivered', batchComplete: true, batchSize: selectedBatchIds.size },
      });
    }
    await fetchDeliveries();
    setSelectedBatchIds(new Set());
    setShowBatchModal(false);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2">Delivery Management</h1>
        <p className="text-muted-foreground">Schedule deliveries, assign drivers, and track shipments in real time</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Total Deliveries</p>
          <p className="text-2xl font-bold">{totalDeliveries}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">In Transit</p>
          <p className="text-2xl font-bold text-blue-600">{inTransitCount}</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">Delivered Today</p>
          <p className="text-2xl font-bold text-green-600">{deliveredTodayCount}</p>
        </div>
      </div>

      {/* Assignment Mode Toggle */}
      <div className="mb-6 border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Delivery Assignment Mode</p>
              <p className="text-xs text-muted-foreground">
                {assignmentMode === 'automatic'
                  ? 'Deliveries are automatically assigned to the least busy available rider when created without a driver.'
                  : 'Deliveries must be manually assigned to a driver by an admin.'}
              </p>
            </div>
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleAssignmentMode('manual')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                assignmentMode === 'manual'
                  ? 'bg-foreground text-background'
                  : 'bg-card text-foreground hover:bg-secondary'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => toggleAssignmentMode('automatic')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                assignmentMode === 'automatic'
                  ? 'bg-foreground text-background'
                  : 'bg-card text-foreground hover:bg-secondary'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Automatic
              </span>
            </button>
          </div>
        </div>
        {/* Show rider availability summary */}
        {assignmentMode === 'automatic' && drivers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Rider Availability</p>
            <div className="flex flex-wrap gap-2">
              {drivers.filter(d => d.status === 'Active').map(d => (
                <div key={d.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                  (d.activeDeliveryCount || 0) === 0
                    ? 'bg-green-50 text-green-800 border-green-200'
                    : (d.activeDeliveryCount || 0) <= 2
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    (d.activeDeliveryCount || 0) === 0 ? 'bg-green-500' : (d.activeDeliveryCount || 0) <= 2 ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  {d.firstName} {d.lastName}
                  <span className="text-[10px] opacity-75">
                    ({(d.activeDeliveryCount || 0) === 0 ? 'Free' : `${d.activeDeliveryCount} active`})
                  </span>
                </div>
              ))}
              {drivers.filter(d => d.status === 'Active').length === 0 && (
                <p className="text-xs text-muted-foreground">No active riders available. Add employees with category &quot;Driver&quot; or &quot;Rider&quot;.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mb-6 flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search deliveries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none w-64"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
          >
            <option value="All">All Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {pendingDeliveries.length > 1 && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 font-medium"
            >
              Batch Deliver ({pendingDeliveries.length} pending)
            </button>
          )}
          <button
          onClick={openNewForm}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
        >
          + Schedule Delivery
        </button>
        </div>
      </div>

      {/* ── Schedule / Edit Delivery Modal ── */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Delivery' : 'Schedule New Delivery'}
        size="3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* Section: Import from Order */}
          {recentOrders.length > 0 && (
            <div className="border border-primary/30 rounded-xl p-4 bg-primary/5">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                📦 Import from Recent Order
                <span className="text-xs font-normal text-muted-foreground">— auto-fills customer & items</span>
              </p>
              <select
                onChange={(e) => e.target.value && importFromOrder(e.target.value)}
                defaultValue=""
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              >
                <option value="">— Select an order to import —</option>
                {recentOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} · {o.customerName} · {o.items.length} item(s)
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">After selecting, review and adjust the items below as needed.</p>
            </div>
          )}

          {/* Section: Delivery Info */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3">Delivery Information</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background font-mono text-sm"
                  readOnly={!editingId}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Scheduled Date *</label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Time Slot *</label>
                <select
                  value={formData.timeSlot}
                  onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                  required
                >
                  <option value="">Select time slot</option>
                  {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                </select>
              </div>
            </div>
            {editingId && (
              <div className="mt-3">
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Delivery['status'] })}
                  className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Section: Customer Selection */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3">Customer</p>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search customer by name, phone, or location..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              />
            </div>
            <select
              value={formData.customerId}
              onChange={(e) => {
                setFormData({ ...formData, customerId: e.target.value });
                setCustomerSearch('');
              }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
              required
            >
              <option value="">Select a customer</option>
              {filteredCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.phone} {c.location ? `(${c.location})` : ''}
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-background border border-border rounded-lg text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Name:</span> <strong>{selectedCustomer.name}</strong></div>
                  <div><span className="text-muted-foreground">Phone:</span> <strong>{selectedCustomer.phone}</strong></div>
                  <div><span className="text-muted-foreground">Location:</span> <strong>{selectedCustomer.location || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Address:</span> <strong>{selectedCustomer.address || '—'}</strong></div>
                </div>
                {selectedCustomer.gpsLat !== 0 && (
                  <p className="text-xs text-muted-foreground mt-2">GPS: {selectedCustomer.gpsLat.toFixed(6)}, {selectedCustomer.gpsLng.toFixed(6)}</p>
                )}
              </div>
            )}
          </div>

          {/* Section: Route & Mileage */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <p className="text-sm font-semibold mb-3">Route & Mileage Details</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="relative">
                <label className="block text-xs text-muted-foreground mb-1">Departure Location</label>
                <input
                  type="text"
                  placeholder="e.g. Main Bakery, Nairobi"
                  value={formData.departureLocation}
                  onChange={(e) => handleDepartureInputChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDepartureSuggestions(false), 200)}
                  onFocus={() => { if (departureSuggestions.length > 0) setShowDepartureSuggestions(true); }}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                />
                {showDepartureSuggestions && departureSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {departureSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-secondary transition-colors border-b border-border last:border-0"
                        onMouseDown={() => selectDepartureSuggestion(s)}
                      >
                        <MapPin size={10} className="inline mr-1 text-muted-foreground" />
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Destination</label>
                <input
                  type="text"
                  value={selectedCustomer?.location || selectedCustomer?.address || ''}
                  readOnly
                  placeholder="Auto-filled from customer"
                  className="w-full px-3 py-2 border border-border rounded-lg outline-none bg-muted text-sm text-muted-foreground"
                />
              </div>
            </div>

            {/* Distance auto-calculation */}
            <div className="mb-3">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">Distance (km) — Auto-calculated via Google Maps</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={formData.distanceKm || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-border rounded-lg outline-none bg-muted text-sm font-medium"
                    placeholder="Will auto-fill when calculated"
                  />
                </div>
                <button
                  type="button"
                  disabled={calculatingDistance || !formData.departureLocation || !(selectedCustomer?.location || selectedCustomer?.address)}
                  onClick={() => {
                    const destination = selectedCustomer?.gpsLat && selectedCustomer?.gpsLng && selectedCustomer.gpsLat !== 0
                      ? `${selectedCustomer.gpsLat},${selectedCustomer.gpsLng}`
                      : selectedCustomer?.address || selectedCustomer?.location || '';
                    calculateDistance(formData.departureLocation, destination);
                  }}
                  className="px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5 whitespace-nowrap"
                >
                  {calculatingDistance ? <><Loader2 size={12} className="animate-spin" /> Calculating...</> : <><Navigation size={12} /> Calculate Distance</>}
                </button>
              </div>
              {distanceInfo && (
                <p className="text-xs text-green-600 mt-1.5 font-medium">{distanceInfo}</p>
              )}
              {distanceError && (
                <p className="text-xs text-red-600 mt-1.5">{distanceError}</p>
              )}
              {!formData.departureLocation && (
                <p className="text-xs text-muted-foreground mt-1">Enter departure location and select a customer to calculate distance</p>
              )}
            </div>

            {/* Odometer readings - manual entries */}
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Odometer Readings (Manual Entry)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Trip Start Mileage</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={formData.tripStartMileage || ''}
                    onChange={(e) => setFormData({ ...formData, tripStartMileage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    placeholder="Odometer reading at start"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Trip End Mileage</label>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={formData.tripEndMileage || ''}
                    onChange={(e) => setFormData({ ...formData, tripEndMileage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    placeholder="Odometer reading at end"
                  />
                </div>
              </div>
            </div>
            {formData.tripStartMileage > 0 && formData.tripEndMileage > formData.tripStartMileage && (
              <p className="text-xs text-muted-foreground mt-2">
                Trip distance from odometer: <strong>{(formData.tripEndMileage - formData.tripStartMileage).toFixed(1)} km</strong>
                {formData.distanceKm > 0 && (
                  <span className="ml-2">| Google Maps estimate: <strong>{formData.distanceKm.toFixed(1)} km</strong></span>
                )}
              </p>
            )}
          </div>

          {/* Section: Driver & Vehicle Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-4 bg-secondary/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Driver Assignment</p>
                {assignmentMode === 'automatic' && !editingId && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                    <Zap className="w-3 h-3" /> Auto-assign enabled
                  </span>
                )}
              </div>
              <select
                value={formData.driverId}
                onChange={(e) => { setFormData({ ...formData, driverId: e.target.value }); setAutoAssignResult(''); }}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
              >
                <option value="">
                  {assignmentMode === 'automatic' && !editingId ? '-- Auto-assign to free rider --' : 'Select a driver'}
                </option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName} {d.status !== 'Active' ? `(${d.status})` : ''} {(d.activeDeliveryCount || 0) > 0 ? `[${d.activeDeliveryCount} active]` : '[Free]'}
                  </option>
                ))}
              </select>
              {autoAssignResult && (
                <div className="mt-2 text-xs text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg">
                  {autoAssignResult}
                </div>
              )}
              {selectedDriver && !autoAssignResult && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Phone: {selectedDriver.phone || '—'} | Status: <span className={selectedDriver.status === 'Active' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{selectedDriver.status}</span>
                  {' | '}{(selectedDriver.activeDeliveryCount || 0) === 0
                    ? <span className="text-green-600 font-medium">Free</span>
                    : <span className="text-amber-600 font-medium">{selectedDriver.activeDeliveryCount} active delivery(ies)</span>
                  }
                </div>
              )}
              {!formData.driverId && assignmentMode === 'automatic' && !editingId && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <Zap className="w-3 h-3 inline mr-1" />
                    A free rider will be automatically assigned when you save this delivery. The system picks the rider with the fewest active deliveries.
                  </p>
                </div>
              )}
              {drivers.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">No drivers found. Add employees with category &quot;Driver&quot; in Employee Management.</p>
              )}
            </div>

            <div className="border border-border rounded-lg p-4 bg-secondary/30">
              <p className="text-sm font-semibold mb-3">Vehicle Assignment</p>
              <select
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background"
              >
                <option value="">Select a vehicle</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.serialNumber ? `(${v.serialNumber})` : ''} {v.status !== 'Active' ? `[${v.status}]` : ''}
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Category: {selectedVehicle.category} | Status: <span className={selectedVehicle.status === 'Active' ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>{selectedVehicle.status}</span>
                </div>
              )}
              {vehicles.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">No vehicles found. Add assets with category containing &quot;Vehicle&quot; in Asset Management.</p>
              )}
            </div>
          </div>

          {/* Section: Items List */}
          <div className="border border-border rounded-lg p-4 bg-secondary/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Delivery Items</p>
              <button
                type="button"
                onClick={addItem}
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {formData.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Item Name</label>}
                    <input
                      type="text"
                      placeholder="e.g. White Bread Loaves"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Qty</label>}
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <label className="block text-xs text-muted-foreground mb-1">Unit</label>}
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
                    >
                      <option value="pcs">Pieces</option>
                      <option value="trays">Trays</option>
                      <option value="boxes">Boxes</option>
                      <option value="kg">Kilograms</option>
                      <option value="crates">Crates</option>
                      <option value="packets">Packets</option>
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="px-2 py-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        title="Remove item"
                      >
                        X
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Notes & Special Instructions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Delivery Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                rows={3}
                placeholder="General delivery notes..."
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Special Instructions</label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                rows={3}
                placeholder="e.g. Call before delivery, gate code, fragile items..."
              />
            </div>
          </div>

          {/* Form actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={autoAssigning}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium disabled:opacity-50"
            >
              {autoAssigning ? (
                <span className="flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> Auto-assigning rider...</span>
              ) : editingId ? 'Update Delivery' : (
                assignmentMode === 'automatic' && !formData.driverId
                  ? 'Schedule & Auto-Assign'
                  : 'Schedule Delivery'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Detail View Modal ── */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail ? `Delivery ${showDetail.trackingNumber}` : ''}
        size="3xl"
      >
        {showDetail && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

            {/* Status bar */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getStatusColor(showDetail.status)}`}>
                {showDetail.status}
              </span>
              <div className="flex gap-2">
                {showDetail.status !== 'Delivered' && showDetail.status !== 'Failed' && (
                  <select
                    value={showDetail.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as Delivery['status'];
                      handleStatusChange(showDetail.id, newStatus);
                      setShowDetail({ ...showDetail, status: newStatus });
                    }}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            </div>

            {/* Status progress */}
            <div className="flex items-center gap-1">
              {STATUSES.map((s, idx) => {
                const currentIdx = STATUSES.indexOf(showDetail.status);
                const isActive = idx <= currentIdx;
                const isFailed = showDetail.status === 'Failed';
                return (
                  <div key={s} className="flex-1">
                    <div className={`h-2 rounded-full ${isFailed && idx === currentIdx ? 'bg-red-500' : isActive ? 'bg-green-500' : 'bg-gray-200'}`} />
                    <p className={`text-xs mt-1 text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</p>
                  </div>
                );
              })}
            </div>

            {/* Delivery info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm border border-border rounded-lg p-4">
              <div><span className="text-muted-foreground">Tracking #:</span> <span className="font-mono font-medium ml-2">{showDetail.trackingNumber}</span></div>
              <div><span className="text-muted-foreground">Scheduled:</span> <span className="font-medium ml-2">{showDetail.scheduledDate || '—'}</span></div>
              <div><span className="text-muted-foreground">Time Slot:</span> <span className="font-medium ml-2">{showDetail.timeSlot || '—'}</span></div>
              <div><span className="text-muted-foreground">Driver:</span> <span className="font-medium ml-2">{showDetail.driverName || '—'}</span></div>
              <div><span className="text-muted-foreground">Vehicle:</span> <span className="font-medium ml-2">{showDetail.vehicleName || '—'}</span></div>
              <div><span className="text-muted-foreground">Items:</span> <span className="font-medium ml-2">{showDetail.items.length} item(s)</span></div>
            </div>

            {/* Route & Mileage Details */}
            {(showDetail.departureLocation || showDetail.distanceKm > 0 || showDetail.tripStartMileage > 0) && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-3">Route & Mileage</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Departure:</span> <strong className="ml-2">{showDetail.departureLocation || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Destination:</span> <strong className="ml-2">{showDetail.customerLocation || '—'}</strong></div>
                  {showDetail.distanceKm > 0 && (
                    <div><span className="text-muted-foreground">Google Maps Distance:</span> <strong className="ml-2">{showDetail.distanceKm} km</strong></div>
                  )}
                </div>
                {(showDetail.tripStartMileage > 0 || showDetail.tripEndMileage > 0) && (
                  <div className="border-t border-border mt-3 pt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Odometer Readings</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {showDetail.tripStartMileage > 0 && (
                        <div><span className="text-muted-foreground">Start Reading:</span> <strong className="ml-2">{showDetail.tripStartMileage.toLocaleString()} km</strong></div>
                      )}
                      {showDetail.tripEndMileage > 0 && (
                        <div><span className="text-muted-foreground">End Reading:</span> <strong className="ml-2">{showDetail.tripEndMileage.toLocaleString()} km</strong></div>
                      )}
                      {showDetail.tripStartMileage > 0 && showDetail.tripEndMileage > showDetail.tripStartMileage && (
                        <div><span className="text-muted-foreground">Actual Trip Distance:</span> <strong className="ml-2">{(showDetail.tripEndMileage - showDetail.tripStartMileage).toFixed(1)} km</strong></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer details */}
            <div className="border border-border rounded-lg p-4">
              <p className="text-sm font-semibold mb-3">Customer Details</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Name:</span> <strong className="ml-2">{showDetail.customerName || '—'}</strong></div>
                <div><span className="text-muted-foreground">Phone:</span> <strong className="ml-2">{showDetail.customerPhone || '—'}</strong></div>
                <div><span className="text-muted-foreground">Location:</span> <strong className="ml-2">{showDetail.customerLocation || '—'}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Address:</span> <strong className="ml-2">{showDetail.customerAddress || '—'}</strong></div>
              </div>
              {showDetail.customerGpsLat !== 0 && showDetail.customerGpsLng !== 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">GPS: {showDetail.customerGpsLat.toFixed(6)}, {showDetail.customerGpsLng.toFixed(6)}</p>
                    <a
                      href={getMapLinkUrl(showDetail.customerGpsLat, showDetail.customerGpsLng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                  <iframe
                    src={getMapUrl(showDetail.customerGpsLat, showDetail.customerGpsLng)}
                    width="100%"
                    height="200"
                    className="rounded-lg border border-border"
                    style={{ border: 0 }}
                    loading="lazy"
                  />
                </div>
              )}
            </div>

            {/* Items */}
            {showDetail.items.length > 0 && (
              <div className="border border-border rounded-lg p-4">
                <p className="text-sm font-semibold mb-3">Delivery Items</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Item</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Quantity</th>
                      <th className="text-left py-2 pl-4 text-muted-foreground font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showDetail.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2 font-medium">{item.name}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 pl-4 text-muted-foreground">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {(showDetail.notes || showDetail.specialInstructions) && (
              <div className="grid grid-cols-2 gap-4">
                {showDetail.notes && (
                  <div className="border border-border rounded-lg p-4">
                    <p className="text-sm font-semibold mb-2">Delivery Notes</p>
                    <p className="text-sm text-muted-foreground">{showDetail.notes}</p>
                  </div>
                )}
                {showDetail.specialInstructions && (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">Special Instructions</p>
                    <p className="text-sm text-yellow-700">{showDetail.specialInstructions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-border">
              <button
                onClick={() => { setShowDetail(null); handleEdit(showDetail); }}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm"
              >
                Edit Delivery
              </button>
              <button
                onClick={() => setShowDetail(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Loading */}
      {loading && <p className="text-center py-4 text-muted-foreground text-sm">Loading deliveries...</p>}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Tracking #</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Location</th>
              <th className="px-4 py-3 text-left font-semibold">Driver</th>
              <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
              <th className="px-4 py-3 text-left font-semibold">Date / Slot</th>
              <th className="px-4 py-3 text-center font-semibold">Items</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Assigned</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No deliveries found</td>
              </tr>
            ) : (
              paginated.map((d) => (
                <tr key={d.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{d.trackingNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{d.customerName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{d.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{d.customerLocation || '—'}</td>
                  <td className="px-4 py-3 text-sm">{d.driverName || '—'}</td>
                  <td className="px-4 py-3 text-sm">{d.vehicleName || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{d.scheduledDate || '—'}</div>
                    <div className="text-xs text-muted-foreground">{d.timeSlot}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{d.items.length}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded font-semibold ${getStatusColor(d.status)}`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.assignmentMode === 'automatic' ? (
                      <span className="flex items-center justify-center gap-1 text-[10px] font-semibold text-blue-700">
                        <Zap className="w-3 h-3" /> Auto
                      </span>
                    ) : d.driverName ? (
                      <span className="text-[10px] font-medium text-muted-foreground">Manual</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setShowDetail(d)} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-medium">View</button>
                      <button onClick={() => handleEdit(d)} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium">Edit</button>
                      {d.status === 'Pending' && !d.driverName && assignmentMode === 'automatic' && (
                        <button
                          onClick={async () => {
                            const assigned = await autoAssignRider(d.id, drivers);
                            if (assigned) {
                              await fetchDeliveries();
                              await fetchDrivers();
                            }
                          }}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-medium flex items-center gap-0.5"
                          title="Auto-assign a free rider"
                        >
                          <Zap className="w-3 h-3" /> Assign
                        </button>
                      )}
                      <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} deliveries
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 border rounded-lg text-sm font-medium ${
                  page === currentPage
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Batch Delivery Modal ── */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => { setShowBatchModal(false); setSelectedBatchIds(new Set()); }}
        title={`Batch Delivery (${pendingDeliveries.length} pending)`}
        size="3xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-blue-900">Select Multiple Deliveries</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Select deliveries going in the same direction and dispatch or complete them all at once. This improves rider productivity by combining trips.
            </p>
          </div>

          {/* Driver & Vehicle Selection for batch */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Assign Driver</label>
              <select
                value={batchDriverId}
                onChange={(e) => setBatchDriverId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              >
                <option value="">Keep existing drivers</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Assign Vehicle</label>
              <select
                value={batchVehicleId}
                onChange={(e) => setBatchVehicleId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none bg-background text-sm"
              >
                <option value="">Keep existing vehicles</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBatchIds.size === pendingDeliveries.length && pendingDeliveries.length > 0}
                onChange={selectAllBatch}
                className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-medium">Select All ({pendingDeliveries.length})</span>
            </label>
            <span className="text-xs text-muted-foreground">{selectedBatchIds.size} selected</span>
          </div>

          {/* Delivery list */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 text-left font-semibold">Tracking #</th>
                  <th className="px-3 py-2 text-left font-semibold">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold">Location</th>
                  <th className="px-3 py-2 text-left font-semibold">Driver</th>
                  <th className="px-3 py-2 text-center font-semibold">Items</th>
                  <th className="px-3 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.map(d => (
                  <tr
                    key={d.id}
                    className={`border-b border-border cursor-pointer transition-colors ${selectedBatchIds.has(d.id) ? 'bg-orange-50' : 'hover:bg-secondary/50'}`}
                    onClick={() => toggleBatchSelect(d.id)}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedBatchIds.has(d.id)}
                        onChange={() => toggleBatchSelect(d.id)}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{d.trackingNumber}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{d.customerName || '-'}</div>
                      <div className="text-xs text-muted-foreground">{d.customerPhone}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{d.customerLocation || '-'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.driverName || '-'}</td>
                    <td className="px-3 py-2 text-center">{d.items.length}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded font-semibold ${getStatusColor(d.status)}`}>{d.status}</span>
                    </td>
                  </tr>
                ))}
                {pendingDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No pending deliveries</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button
              onClick={() => { setShowBatchModal(false); setSelectedBatchIds(new Set()); }}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchDispatch}
              disabled={selectedBatchIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-40"
            >
              Dispatch Selected ({selectedBatchIds.size})
            </button>
            <button
              onClick={handleBatchComplete}
              disabled={selectedBatchIds.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-40"
            >
              Mark Delivered ({selectedBatchIds.size})
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
