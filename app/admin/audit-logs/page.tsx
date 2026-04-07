'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '@/components/modal';
import { supabase } from '@/lib/supabase';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Shield,
  Activity,
  Users,
  BarChart3,
  X,
  Clock,
  User,
  Globe,
  FileText,
  Hash,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface FilterState {
  search: string;
  user: string;
  module: string;
  action: string;
  dateFrom: string;
  dateTo: string;
}

interface Stats {
  totalLogs: number;
  todayActivity: number;
  uniqueUsers: number;
  mostActiveModule: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-800' },
  UPDATE: { bg: 'bg-blue-100', text: 'text-blue-800' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-800' },
  LOGIN: { bg: 'bg-teal-100', text: 'text-teal-800' },
  LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-600' },
  VIEW: { bg: 'bg-purple-100', text: 'text-purple-800' },
  EXPORT: { bg: 'bg-amber-100', text: 'text-amber-800' },
};

const DEFAULT_ACTION_COLOR = { bg: 'bg-secondary', text: 'text-muted-foreground' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) + ' ' + d.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return '';
  } catch {
    return '';
  }
}

function truncateJson(obj: Record<string, unknown> | null, maxLength = 80): string {
  if (!obj) return '-';
  const str = JSON.stringify(obj);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

function formatJsonPretty(obj: Record<string, unknown> | null): string {
  if (!obj) return 'No details available';
  return JSON.stringify(obj, null, 2);
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalLogs: 0, todayActivity: 0, uniqueUsers: 0, mostActiveModule: '-' });

  // Main super admin ID — hidden from all audit log views
  const [mainSuperAdminId, setMainSuperAdminId] = useState<string | null>(null);

  // Filter options (populated from DB)
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [distinctModules, setDistinctModules] = useState<string[]>([]);
  const [distinctActions, setDistinctActions] = useState<string[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    user: '',
    module: '',
    action: '',
    dateFrom: '',
    dateTo: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Expanded details rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Live indicator
  const [liveUpdate, setLiveUpdate] = useState(false);
  const liveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch Logs ──────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Identify the main super admin (first registered user) to exclude from audit logs
      let superAdminId: string | null = null;
      const { data: firstUser } = await supabase
        .from('users')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (firstUser?.id) {
        superAdminId = firstUser.id;
        setMainSuperAdminId(superAdminId);
      }

      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) {
        console.error('Fetch audit_log:', error.message);
        setLogs([]);
        setLoading(false);
        return;
      }

      const rows: AuditLog[] = (data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        user_id: (r.user_id as string) || null,
        user_name: (r.user_name as string) || null,
        action: (r.action as string) || '',
        module: (r.module as string) || '',
        record_id: (r.record_id as string) || null,
        details: (r.details as Record<string, unknown>) || null,
        ip_address: (r.ip_address as string) || null,
        created_at: (r.created_at as string) || '',
      }))
      // Filter out the main super admin from audit logs
      .filter(row => !superAdminId || row.user_id !== superAdminId);

      setLogs(rows);

      // Compute stats
      const today = getTodayDateString();
      const todayLogs = rows.filter(l => l.created_at.startsWith(today));
      const userSet = new Set(rows.map(l => l.user_name).filter(Boolean));
      const moduleCounts: Record<string, number> = {};
      rows.forEach(l => {
        if (l.module) moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1;
      });
      const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0];

      setStats({
        totalLogs: rows.length,
        todayActivity: todayLogs.length,
        uniqueUsers: userSet.size,
        mostActiveModule: topModule ? topModule[0] : '-',
      });

      // Populate distinct filter options
      const users = [...new Set(rows.map(l => l.user_name).filter(Boolean))] as string[];
      const modules = [...new Set(rows.map(l => l.module).filter(Boolean))] as string[];
      const actions = [...new Set(rows.map(l => l.action).filter(Boolean))] as string[];
      setDistinctUsers(users.sort());
      setDistinctModules(modules.sort());
      setDistinctActions(actions.sort());
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ─── Real-time Subscription ──────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('audit_log_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_log' },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          const newLog: AuditLog = {
            id: r.id as string,
            user_id: (r.user_id as string) || null,
            user_name: (r.user_name as string) || null,
            action: (r.action as string) || '',
            module: (r.module as string) || '',
            record_id: (r.record_id as string) || null,
            details: (r.details as Record<string, unknown>) || null,
            ip_address: (r.ip_address as string) || null,
            created_at: (r.created_at as string) || '',
          };

          // Skip real-time entries from the main super admin
          if (mainSuperAdminId && newLog.user_id === mainSuperAdminId) return;

          setLogs(prev => [newLog, ...prev]);

          // Update stats incrementally
          setStats(prev => {
            const today = getTodayDateString();
            const isToday = newLog.created_at.startsWith(today);
            return {
              totalLogs: prev.totalLogs + 1,
              todayActivity: isToday ? prev.todayActivity + 1 : prev.todayActivity,
              uniqueUsers: prev.uniqueUsers, // Simplified; full refresh on next load
              mostActiveModule: prev.mostActiveModule,
            };
          });

          // Update distinct values if new
          if (newLog.user_name) {
            setDistinctUsers(prev => prev.includes(newLog.user_name!) ? prev : [...prev, newLog.user_name!].sort());
          }
          if (newLog.module) {
            setDistinctModules(prev => prev.includes(newLog.module) ? prev : [...prev, newLog.module].sort());
          }
          if (newLog.action) {
            setDistinctActions(prev => prev.includes(newLog.action) ? prev : [...prev, newLog.action].sort());
          }

          // Flash live indicator
          setLiveUpdate(true);
          if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
          liveTimerRef.current = setTimeout(() => setLiveUpdate(false), 2000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [mainSuperAdminId]);

  // ─── Filtering ───────────────────────────────────────────────────────────

  const filteredLogs = logs.filter(log => {
    // Search filter
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matchesSearch =
        (log.user_name || '').toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.module.toLowerCase().includes(term) ||
        (log.record_id || '').toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // User filter
    if (filters.user && log.user_name !== filters.user) return false;

    // Module filter
    if (filters.module && log.module !== filters.module) return false;

    // Action filter
    if (filters.action && log.action !== filters.action) return false;

    // Date from filter
    if (filters.dateFrom) {
      const logDate = log.created_at.split('T')[0];
      if (logDate < filters.dateFrom) return false;
    }

    // Date to filter
    if (filters.dateTo) {
      const logDate = log.created_at.split('T')[0];
      if (logDate > filters.dateTo) return false;
    }

    return true;
  });

  // ─── Pagination ──────────────────────────────────────────────────────────

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const pagedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // ─── Filter handlers ────────────────────────────────────────────────────

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: '', user: '', module: '', action: '', dateFrom: '', dateTo: '' });
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  // ─── Expand/Collapse details ─────────────────────────────────────────────

  const toggleExpandRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Export ──────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'User ID', 'Action', 'Module', 'Record ID', 'Details', 'IP Address'];
    const rows = filteredLogs.map(log => [
      formatTimestamp(log.created_at),
      log.user_name || '-',
      log.user_id || '-',
      log.action,
      log.module,
      log.record_id || '-',
      log.details ? JSON.stringify(log.details) : '-',
      log.ip_address || '-',
    ]);
    exportCSV('audit_logs', headers, rows);
  };

  // ─── Action badge helper ─────────────────────────────────────────────────

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action.toUpperCase()] || DEFAULT_ACTION_COLOR;
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 flex items-center gap-3">
              <Shield size={28} className="text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground">
              Track and monitor all system activities, user actions, and data changes across the platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              liveUpdate
                ? 'bg-green-100 text-green-800 ring-2 ring-green-300'
                : 'bg-secondary text-muted-foreground'
            }`}>
              <span className={`w-2 h-2 rounded-full ${liveUpdate ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
              {liveUpdate ? 'Live Update' : 'Listening'}
            </div>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
              title="Refresh logs"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Logs</p>
            <FileText size={18} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">All recorded events</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Today&apos;s Activity</p>
            <Activity size={18} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{stats.todayActivity.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Events today</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Unique Users</p>
            <Users size={18} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
          <p className="text-xs text-muted-foreground mt-1">Active system users</p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Most Active Module</p>
            <BarChart3 size={18} className="text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold truncate">{stats.mostActiveModule}</p>
          <p className="text-xs text-muted-foreground mt-1">Highest event count</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="border border-border rounded-lg p-4 bg-card mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by user, action, module, record ID..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
              />
            </div>
          </div>

          {/* User filter */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">User</label>
            <select
              value={filters.user}
              onChange={(e) => updateFilter('user', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
            >
              <option value="">All Users</option>
              {distinctUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          {/* Module filter */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Module</label>
            <select
              value={filters.module}
              onChange={(e) => updateFilter('module', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
            >
              <option value="">All Modules</option>
              {distinctModules.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
            >
              <option value="">All Actions</option>
              {distinctActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
            />
          </div>

          {/* Date To */}
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-sm bg-background"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        {/* Active filter count */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Info size={12} />
            Showing {filteredLogs.length.toLocaleString()} of {logs.length.toLocaleString()} logs
            ({Object.values(filters).filter(v => v !== '').length} filter{Object.values(filters).filter(v => v !== '').length !== 1 ? 's' : ''} active)
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} />
                  Timestamp
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <User size={14} />
                  User
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} />
                  Action
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Module</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Hash size={14} />
                  Record ID
                </div>
              </th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Details</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Globe size={14} />
                  IP Address
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw size={24} className="animate-spin text-primary" />
                    <p>Loading audit logs...</p>
                  </div>
                </td>
              </tr>
            ) : pagedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Shield size={32} className="text-muted-foreground/40" />
                    <p className="font-medium">No audit logs found</p>
                    <p className="text-xs">
                      {hasActiveFilters
                        ? 'Try adjusting your filters to see more results.'
                        : 'Audit logs will appear here as system events occur.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pagedLogs.map(log => {
                const actionColor = getActionColor(log.action);
                const isExpanded = expandedRows.has(log.id);
                const relativeTime = formatRelativeTime(log.created_at);
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm">{formatTimestamp(log.created_at)}</p>
                      {relativeTime && (
                        <p className="text-xs text-muted-foreground">{relativeTime}</p>
                      )}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{log.user_name || 'System'}</p>
                      {log.user_id && (
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[140px]" title={log.user_id}>
                          {log.user_id.substring(0, 8)}...
                        </p>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${actionColor.bg} ${actionColor.text}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-secondary text-foreground">
                        {log.module}
                      </span>
                    </td>

                    {/* Record ID */}
                    <td className="px-4 py-3">
                      {log.record_id ? (
                        <span className="font-mono text-xs bg-secondary px-2 py-1 rounded" title={log.record_id}>
                          {log.record_id.length > 16 ? log.record_id.substring(0, 16) + '...' : log.record_id}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3 max-w-[280px]" onClick={(e) => e.stopPropagation()}>
                      {log.details ? (
                        <div>
                          <button
                            onClick={() => toggleExpandRow(log.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? 'Collapse' : 'View Details'}
                          </button>
                          {isExpanded && (
                            <pre className="mt-2 text-xs bg-secondary rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
                              {formatJsonPretty(log.details)}
                            </pre>
                          )}
                          {!isExpanded && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]" title={JSON.stringify(log.details)}>
                              {truncateJson(log.details, 50)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* IP Address */}
                    <td className="px-4 py-3">
                      {log.ip_address ? (
                        <span className="font-mono text-xs">{log.ip_address}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length.toLocaleString()}
          </p>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) page = i + 1;
              else if (currentPage <= 4) page = i + 1;
              else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
              else page = currentPage - 3 + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    currentPage === page
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border hover:bg-secondary'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-border rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Log Details" size="2xl">
        {selectedLog && (
          <div className="space-y-5">
            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Log ID</p>
                <p className="font-mono text-sm bg-secondary px-3 py-1.5 rounded break-all">{selectedLog.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Timestamp</p>
                <p className="text-sm">{formatTimestamp(selectedLog.created_at)}</p>
                {formatRelativeTime(selectedLog.created_at) && (
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(selectedLog.created_at)}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
                <p className="text-sm font-medium">{selectedLog.user_name || 'System'}</p>
                {selectedLog.user_id && (
                  <p className="font-mono text-xs text-muted-foreground break-all">{selectedLog.user_id}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">IP Address</p>
                <p className="font-mono text-sm">{selectedLog.ip_address || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Action</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionColor(selectedLog.action).bg} ${getActionColor(selectedLog.action).text}`}>
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Module</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-secondary text-foreground">
                  {selectedLog.module}
                </span>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Record ID</p>
                {selectedLog.record_id ? (
                  <p className="font-mono text-sm bg-secondary px-3 py-1.5 rounded break-all">{selectedLog.record_id}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Details JSON */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Details</p>
              {selectedLog.details ? (
                <pre className="text-xs bg-secondary rounded-lg p-4 overflow-x-auto max-h-[320px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                  {formatJsonPretty(selectedLog.details)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground bg-secondary rounded-lg p-4">No additional details recorded for this event.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-secondary transition-colors text-sm font-medium"
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
