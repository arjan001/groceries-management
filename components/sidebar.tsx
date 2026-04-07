'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPermissions, getAllowedRoutes } from '@/lib/user-permissions';
import { useSidebarNotifications, SidebarBadge } from '@/lib/use-sidebar-notifications';
import {
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  UtensilsCrossed,
  Factory,
  ClipboardList,
  ScanLine,
  Trash2,
  Users,
  FileText,
  MapPinned,
  Truck,
  Tag,
  Package,
  ShoppingBag,
  Building2,
  Handshake,
  Wrench,
  TrendingDown,
  CreditCard,
  UserCheck,
  Shield,
  BarChart3,
  Settings,
  User,
  ScrollText,
  Receipt,
  Activity,
  RefreshCw,
  Download,
  LucideIcon,
  Store,
  PackageSearch,
  ClipboardCopy,
  AlertTriangle,
  RotateCcw,
  ShoppingBasket,
  UserCog,
  PieChart,
  Recycle,
  SlidersHorizontal,
  Search,
  X,
  Command,
  BookOpenText,
  ClipboardCheck,
  Clock,
  ShieldCheck,
  FileUp,
  History,
  QrCode,
} from 'lucide-react';
import { usePwaInstall } from '@/components/pwa-install-prompt';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  tip: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  color: string;
  items: NavItem[];
}

const allNavGroups: NavGroup[] = [
  {
    title: 'CORE',
    color: 'border-l-blue-500',
    items: [
      { label: 'Dashboard', href: '/admin', tip: 'Overview of key metrics, recent activity & quick actions', icon: LayoutDashboard },
      { label: 'POS System', href: '/admin/pos', tip: 'Point of Sale — process sales, payments & receipts', icon: ShoppingCart },
    ],
  },
  {
    title: 'PRODUCTION',
    color: 'border-l-amber-500',
    items: [
      { label: 'Recipes & Products', href: '/admin/recipes', tip: 'Define recipes with ingredients, costs & output', icon: BookOpen },
      { label: 'Product Catalogue', href: '/admin/food-info', tip: 'Allergens, nutrition info & certifications', icon: UtensilsCrossed },
      { label: 'Catalog Upload', href: '/admin/catalog-upload', tip: 'Bulk-import products from CSV catalogue files', icon: FileUp },
      { label: 'Production Runs', href: '/admin/production', tip: 'Schedule & track production batches', icon: Factory },
      { label: 'Store Requisitions', href: '/admin/store-requisitions', tip: 'Request ingredients from store with approval flow', icon: ClipboardCopy },
      { label: 'Picking Lists', href: '/admin/picking-lists', tip: 'Ingredient lists for production batches', icon: ClipboardList },
      { label: 'Lot Tracking', href: '/admin/lot-tracking', tip: 'Track batches, expiry dates & traceability', icon: ScanLine },
      { label: 'Waste Control', href: '/admin/waste-control', tip: 'Record & analyze production waste', icon: Trash2 },
    ],
  },
  {
    title: 'SALES & ORDERS',
    color: 'border-l-green-500',
    items: [
      { label: 'Customers', href: '/admin/customers', tip: 'Customer profiles, geo-location & segmentation', icon: Users },
      { label: 'Orders', href: '/admin/orders', tip: 'Create & manage customer orders with delivery', icon: FileText },
      { label: 'Order Tracking', href: '/admin/order-tracking', tip: 'Track order status & delivery progress', icon: MapPinned },
      { label: 'Delivery', href: '/admin/delivery', tip: 'Schedule deliveries & assign drivers', icon: Truck },
      { label: 'Rider Reports', href: '/admin/rider-reports', tip: 'Waste & damage reports from riders/drivers', icon: AlertTriangle },
      { label: 'Pricing', href: '/admin/pricing', tip: 'Set retail & wholesale pricing tiers', icon: Tag },
    ],
  },
  {
    title: 'INVENTORY',
    color: 'border-l-purple-500',
    items: [
      { label: 'Inventory', href: '/admin/inventory', tip: 'Raw materials, packaging & stock levels', icon: Package },
      { label: 'Stock Reorder', href: '/admin/stock-reorder', tip: 'Stock requisitions, reorder alerts & batch production triggers', icon: RefreshCw },
      { label: 'Purchasing', href: '/admin/purchasing', tip: 'Purchase orders & supplier procurement', icon: ShoppingBag },
      { label: 'Suppliers', href: '/admin/distributors', tip: 'Manage inventory suppliers & pricing', icon: Building2 },
      { label: 'Distributors', href: '/admin/distribution', tip: 'Manage distribution agents & sales', icon: Handshake },
      { label: 'Assets', href: '/admin/assets', tip: 'Equipment, vehicles & depreciation tracking', icon: Wrench },
      { label: 'Stock Take', href: '/admin/stock-take', tip: 'Physical stock counts, variance & reconciliation', icon: ClipboardCheck },
    ],
  },
  {
    title: 'OUTLETS',
    color: 'border-l-orange-500',
    items: [
      { label: 'Branch Management', href: '/admin/outlets', tip: 'Manage main bakery and branch outlets', icon: Store },
      { label: 'Outlet Inventory', href: '/admin/outlet-inventory', tip: 'Manage inventory for individual outlets', icon: PackageSearch },
      { label: 'Outlet Requisitions', href: '/admin/outlet-requisitions', tip: 'Branch product requests from main bakery', icon: ClipboardCopy },
      { label: 'Outlet Returns', href: '/admin/outlet-returns', tip: 'Return unsold items to main bakery for freshness', icon: RotateCcw },
      { label: 'Outlet Products', href: '/admin/outlet-products', tip: 'Branch-specific product catalog & pricing', icon: ShoppingBasket },
      { label: 'Branch Employees', href: '/admin/outlet-employees', tip: 'Manage staff assigned to each branch', icon: UserCog },
      { label: 'Branch Reports', href: '/admin/outlet-reports', tip: 'Sales, inventory & performance reports per branch', icon: PieChart },
      { label: 'Branch Waste', href: '/admin/outlet-waste', tip: 'Record & track waste at each branch', icon: Recycle },
      { label: 'Branch Settings', href: '/admin/outlet-settings', tip: 'Receipt, POS & display settings per branch', icon: SlidersHorizontal },
      { label: 'Menu Generator', href: '/admin/outlet-menu-generator', tip: 'Generate QR codes & PDF menus for outlets', icon: QrCode },
    ],
  },
  {
    title: 'FINANCE',
    color: 'border-l-rose-500',
    items: [
      { label: 'Expenses', href: '/admin/expenses', tip: 'Track & manage business expenses', icon: Receipt },
      { label: 'Credit Invoices', href: '/admin/credit-invoices', tip: 'Invoicing for credit sales with payment tracking', icon: FileText },
      { label: 'Debtors', href: '/admin/debtors', tip: 'Track credit sales & customer debts', icon: TrendingDown },
      { label: 'Creditors', href: '/admin/creditors', tip: 'Supplier credit & payment schedules', icon: CreditCard },
      { label: 'Insurance', href: '/admin/insurance', tip: 'Vehicle, asset, employee & business insurance policies', icon: ShieldCheck },
    ],
  },
  {
    title: 'PEOPLE',
    color: 'border-l-teal-500',
    items: [
      { label: 'Employees', href: '/admin/employees', tip: 'Staff profiles, certificates & payroll info', icon: UserCheck },
      { label: 'User Creation', href: '/admin/roles-permissions', tip: 'Create users and assign system access permissions', icon: Shield },
      { label: 'Shift Management', href: '/admin/shifts', tip: 'Employee shifts, schedules & shift reports', icon: Clock },
      { label: 'Productivity Report', href: '/admin/employee-productivity', tip: 'Employee KPI tracking, performance & productivity metrics', icon: Activity },
    ],
  },
  {
    title: 'SYSTEM',
    color: 'border-l-gray-400',
    items: [
      { label: 'Reports & Ledger', href: '/admin/reports', tip: 'Financial reports, P&L, sales, debtors, creditors & ledger', icon: BarChart3 },
      { label: 'Audit Logs', href: '/admin/audit-logs', tip: 'Track system activity, user actions & access logs', icon: ScrollText },
      { label: 'Settings', href: '/admin/settings', tip: 'System config, receipt, theme & security', icon: Settings },
      { label: 'Changelog Report', href: '/admin/changelog', tip: 'System changelog, implementation report & PDF download', icon: History },
    ],
  },
  {
    title: 'MY ACCOUNT',
    color: 'border-l-indigo-500',
    items: [
      { label: 'Account Settings', href: '/admin/account', tip: 'Your profile, password & certificates', icon: User },
      { label: 'Documentation', href: '/admin/documentation', tip: 'Employee training manual & system guide', icon: BookOpenText },
    ],
  },
];

// Badge color mappings
const badgeColors: Record<SidebarBadge['color'], { bg: string; text: string; ring: string }> = {
  red: { bg: 'bg-red-500', text: 'text-white', ring: 'ring-red-400' },
  amber: { bg: 'bg-amber-500', text: 'text-white', ring: 'ring-amber-400' },
  green: { bg: 'bg-green-500', text: 'text-white', ring: 'ring-green-400' },
  blue: { bg: 'bg-blue-500', text: 'text-white', ring: 'ring-blue-400' },
  purple: { bg: 'bg-purple-500', text: 'text-white', ring: 'ring-purple-400' },
  rose: { bg: 'bg-rose-500', text: 'text-white', ring: 'ring-rose-400' },
};

// Notification badge component
function NotificationBadge({ badge, collapsed }: { badge: SidebarBadge; collapsed: boolean }) {
  const colors = badgeColors[badge.color];
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${colors.bg} ${colors.text} ${badge.pulse ? 'animate-pulse ring-2 ring-offset-1 ' + colors.ring : ''} ${collapsed ? 'absolute -top-1 -right-1' : 'ml-auto shrink-0'}`}
      title={badge.label || `${badge.count} items`}
    >
      {badge.count > 99 ? '99+' : badge.count}
    </span>
  );
}

// Loading skeleton for the sidebar
function SidebarSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="py-3 px-1.5 space-y-4">
      {[1, 2, 3, 4].map(group => (
        <div key={group}>
          {!collapsed && (
            <div className="px-3 mb-2">
              <div className="h-2.5 w-16 bg-muted rounded animate-pulse" />
            </div>
          )}
          <div className="space-y-1">
            {[1, 2, 3].map(item => (
              <div key={item} className={`flex items-center gap-2.5 px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}>
                <div className="w-5 h-5 bg-muted rounded animate-pulse shrink-0" />
                {!collapsed && <div className="h-3.5 w-24 bg-muted rounded animate-pulse" />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Flat search result item with group context
interface SearchResult {
  item: NavItem;
  group: NavGroup;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [businessName, setBusinessName] = useState('SNACKOH');
  const { isAdmin, permissions, role, loading: permsLoading, isOutletAdmin } = useUserPermissions();
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  const badges = useSidebarNotifications();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Auto-collapse on mobile, expand on desktop
  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  // Auto-collapse sidebar on navigation when on mobile
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    }
  }, [pathname, isMobile]);

  // Load logo from database/localStorage
  useEffect(() => {
    async function loadBranding() {
      try {
        const { data, error } = await supabase.from('business_settings').select('value').eq('key', 'general').single();
        if (!error && data?.value) {
          const g = data.value as Record<string, string>;
          if (g.logoUrl) setLogoUrl(g.logoUrl);
          if (g.businessName) setBusinessName(g.businessName);
          return;
        }
      } catch { /* table may not exist */ }
      try {
        const saved = localStorage.getItem('snackoh_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.general?.logoUrl) setLogoUrl(parsed.general.logoUrl);
          if (parsed.general?.businessName) setBusinessName(parsed.general.businessName);
        }
      } catch { /* ignore */ }
    }
    loadBranding();
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (collapsed) setCollapsed(false);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // Escape to clear/blur search
      if (e.key === 'Escape' && searchFocused) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, searchFocused]);

  // Memoize filtered nav groups to avoid recalculating on every render
  const navGroups = useMemo(() => {
    if (permsLoading) return [];
    if (isAdmin) {
      const peopleGroup = allNavGroups.find(group => group.title === 'PEOPLE');
      const remainingGroups = allNavGroups.filter(group => group.title !== 'PEOPLE');
      return peopleGroup ? [peopleGroup, ...remainingGroups] : allNavGroups;
    }

    const allowedRoutes = getAllowedRoutes(permissions, role, isAdmin, isOutletAdmin);

    return allNavGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          allowedRoutes.some(route => item.href === route || item.href.startsWith(route + '/'))
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [isAdmin, permissions, role, permsLoading, isOutletAdmin]);

  // Search results - flat list of matching items
  const searchResults: SearchResult[] = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];
    for (const group of navGroups) {
      for (const item of group.items) {
        const matchLabel = item.label.toLowerCase().includes(q);
        const matchTip = item.tip.toLowerCase().includes(q);
        const matchGroup = group.title.toLowerCase().includes(q);
        if (matchLabel || matchTip || matchGroup) {
          results.push({ item, group });
        }
      }
    }
    return results;
  }, [searchQuery, navGroups]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults.length]);

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!searchResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchResults[selectedIndex];
      if (selected) {
        router.push(selected.item.href);
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    }
  }, [searchResults, selectedIndex, router]);

  // Scroll selected result into view
  useEffect(() => {
    if (searchResultsRef.current) {
      const el = searchResultsRef.current.children[selectedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const isSearching = searchQuery.trim().length > 0;

  // Count total badges for collapsed indicator
  const totalBadgeCount = useMemo(() => {
    return Object.values(badges).reduce((sum, b) => sum + b.count, 0);
  }, [badges]);

  const hasPulsingBadges = useMemo(() => {
    return Object.values(badges).some(b => b.pulse);
  }, [badges]);

  return (
    <aside className={`flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-64'}`}>
      {/* Header with logo and collapse button */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-8 w-auto object-contain rounded-lg" />
            ) : (
              <span className="text-lg font-black text-primary tracking-wide">{businessName}</span>
            )}
          </Link>
        )}
        {collapsed && logoUrl && (
          <Link href="/admin" className="mx-auto hover:opacity-80 transition-opacity">
            <img src={logoUrl} alt={businessName} className="h-7 w-7 object-contain rounded-lg" />
          </Link>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`rounded p-1.5 hover:bg-secondary text-muted-foreground text-xs ${collapsed ? 'mx-auto' : ''}`}
            >
              {collapsed ? '▶' : '◀'}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? 'Open Sidebar' : 'Close Sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search bar */}
      <div className={`border-b border-border ${collapsed ? 'px-1.5 py-2' : 'px-3 py-2.5'}`}>
        {collapsed ? (
          <button
            onClick={() => {
              setCollapsed(false);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors relative"
            title="Search modules (Ctrl+K)"
          >
            <Search size={18} />
            {totalBadgeCount > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ${hasPulsingBadges ? 'animate-pulse' : ''}`}>
                {totalBadgeCount > 99 ? '!' : totalBadgeCount}
              </span>
            )}
          </button>
        ) : (
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
            {searchQuery ? (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-muted-foreground/50 pointer-events-none">
                <Command size={10} />K
              </span>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-1.5">
        {permsLoading ? (
          <SidebarSkeleton collapsed={collapsed} />
        ) : isSearching ? (
          /* Search results view */
          <div ref={searchResultsRef}>
            {searchResults.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Search size={24} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No modules found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
              </div>
            ) : (
              <>
                <p className="px-3 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-0.5">
                  {searchResults.map((result, idx) => {
                    const { item, group } = result;
                    const isActive = pathname === item.href;
                    const isSelected = idx === selectedIndex;
                    const Icon = item.icon;
                    const badge = badges[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => { setSearchQuery(''); }}
                        title={item.tip}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14.5px] font-semibold transition-colors border-l-2 ${
                          isActive
                            ? `bg-primary/10 text-primary ${group.color}`
                            : isSelected
                              ? `border-l-transparent bg-secondary text-foreground`
                              : `border-l-transparent text-sidebar-foreground hover:bg-secondary/70`
                        }`}
                      >
                        <Icon size={17} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground font-normal truncate block">{group.title}</span>
                        </div>
                        {badge && <NotificationBadge badge={badge} collapsed={false} />}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Normal navigation view */
          navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group.title}</p>
              )}
              {collapsed && <div className="mb-1 border-b border-border/40 mx-1" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  const badge = badges[item.href];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={badge ? `${item.tip} (${badge.count} ${badge.label || 'pending'})` : item.tip}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14.5px] font-semibold transition-colors border-l-2 ${
                        isActive
                          ? `bg-primary/10 text-primary ${group.color}`
                          : `border-l-transparent text-sidebar-foreground hover:bg-secondary/70`
                      } ${collapsed ? 'justify-center px-0 relative' : ''}`}
                    >
                      <Icon
                        size={collapsed ? 20 : 17}
                        strokeWidth={isActive ? 2.5 : 2}
                        className="shrink-0"
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {badge && <NotificationBadge badge={badge} collapsed={false} />}
                        </>
                      )}
                      {collapsed && badge && <NotificationBadge badge={badge} collapsed={true} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        {canInstall && !isInstalled && (
          <button
            onClick={triggerInstall}
            title="Install Snackoh App"
            className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <Download size={collapsed ? 20 : 16} strokeWidth={2.5} className="shrink-0" />
            {!collapsed && <span>Install App</span>}
          </button>
        )}
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground text-center">v2.0 | Snackoh Bakers</p>
        )}
      </div>
    </aside>
  );
}
