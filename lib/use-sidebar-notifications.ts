'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface SidebarBadge {
  count: number;
  color: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'rose';
  pulse?: boolean;
  label?: string;
}

export type SidebarBadges = Record<string, SidebarBadge>;

export function useSidebarNotifications() {
  const [badges, setBadges] = useState<SidebarBadges>({});

  const fetchCounts = useCallback(async () => {
    const newBadges: SidebarBadges = {};

    try {
      // 1. Pending orders (online + offline) needing attention
      const [onlineOrders, pendingOrders] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'Online')
          .in('status', ['Pending', 'On Hold']),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Pending', 'On Hold']),
      ]);

      const onlineCount = onlineOrders.count || 0;
      const totalPending = pendingOrders.count || 0;

      if (totalPending > 0) {
        newBadges['/admin/orders'] = {
          count: totalPending,
          color: onlineCount > 0 ? 'red' : 'amber',
          pulse: onlineCount > 0,
          label: onlineCount > 0 ? `${onlineCount} online` : undefined,
        };
      }

      // 2. Active order tracking (orders in transit / being delivered)
      const { count: trackingCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['Confirmed', 'In Transit', 'Out for Delivery']);

      if (trackingCount && trackingCount > 0) {
        newBadges['/admin/order-tracking'] = {
          count: trackingCount,
          color: 'blue',
        };
      }

      // 3. Production runs that are active or scheduled
      const [activeRuns, scheduledRuns] = await Promise.all([
        supabase
          .from('production_runs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'In Progress'),
        supabase
          .from('production_runs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Scheduled'),
      ]);

      const activeCount = activeRuns.count || 0;
      const scheduledCount = scheduledRuns.count || 0;
      const prodTotal = activeCount + scheduledCount;

      if (prodTotal > 0) {
        newBadges['/admin/production'] = {
          count: prodTotal,
          color: activeCount > 0 ? 'amber' : 'blue',
          pulse: activeCount > 0,
          label: activeCount > 0 ? `${activeCount} active` : `${scheduledCount} scheduled`,
        };
      }

      // 4. Pending deliveries
      const { count: deliveryCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('fulfillment', ['Scheduled', 'Ready for Pickup', 'Out for Delivery']);

      if (deliveryCount && deliveryCount > 0) {
        newBadges['/admin/delivery'] = {
          count: deliveryCount,
          color: 'green',
          label: 'pending delivery',
        };
      }

      // 5. Store requisitions pending approval
      const { count: reqCount } = await supabase
        .from('store_requisitions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending');

      if (reqCount && reqCount > 0) {
        newBadges['/admin/store-requisitions'] = {
          count: reqCount,
          color: 'amber',
          pulse: true,
        };
      }

      // 6. Inventory items at or below reorder level
      const { data: lowStockItems } = await supabase
        .from('inventory_items')
        .select('id, quantity, reorder_level')
        .not('reorder_level', 'is', null)
        .gt('reorder_level', 0);

      if (lowStockItems) {
        const lowCount = lowStockItems.filter(
          (item: { quantity: number; reorder_level: number }) =>
            item.quantity <= item.reorder_level
        ).length;
        if (lowCount > 0) {
          newBadges['/admin/stock-reorder'] = {
            count: lowCount,
            color: 'red',
            pulse: lowCount >= 5,
            label: 'low stock',
          };
        }
      }

      // 7. Outlet requisitions pending
      const { count: outletReqCount } = await supabase
        .from('outlet_requisitions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending');

      if (outletReqCount && outletReqCount > 0) {
        newBadges['/admin/outlet-requisitions'] = {
          count: outletReqCount,
          color: 'purple',
          pulse: true,
        };
      }

      // 8. Overdue debtors (unpaid credit invoices)
      const { count: debtorCount } = await supabase
        .from('credit_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'Unpaid')
        .lt('due_date', new Date().toISOString().split('T')[0]);

      if (debtorCount && debtorCount > 0) {
        newBadges['/admin/debtors'] = {
          count: debtorCount,
          color: 'rose',
          label: 'overdue',
        };
      }

      // 9. Pending expenses awaiting approval
      const { count: expenseCount } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Pending');

      if (expenseCount && expenseCount > 0) {
        newBadges['/admin/expenses'] = {
          count: expenseCount,
          color: 'amber',
        };
      }

    } catch (err) {
      console.error('Sidebar notifications error:', err);
    }

    setBadges(newBadges);
  }, []);

  useEffect(() => {
    fetchCounts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30_000);

    // Also listen for real-time order changes to update badges faster
    const channel = supabase
      .channel('sidebar-badges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => { fetchCounts(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'production_runs' },
        () => { fetchCounts(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_requisitions' },
        () => { fetchCounts(); }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  return badges;
}
