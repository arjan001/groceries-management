'use client';

import { useState, useEffect, useCallback } from 'react';
import { dbFetchAll, dbInsert, dbUpdate, dbDelete } from './supabase';

/**
 * Generic hook for CRUD operations against a Supabase table.
 * Falls back to local state if Supabase is not available.
 */
export function useSupabaseTable<T extends { id: string }>(
  table: string,
  fallbackData: T[] = [],
  orderBy = 'created_at'
) {
  const [data, setData] = useState<T[]>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all rows
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await dbFetchAll<T>(table, orderBy, false);
      if (rows.length > 0) {
        setData(rows);
      } else {
        // If empty, keep fallback data (for first-time use)
        setData(fallbackData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`useSupabaseTable(${table}):`, msg);
      setError(msg);
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orderBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create
  const create = useCallback(async (row: Omit<T, 'id'>) => {
    try {
      const created = await dbInsert<T>(table, row as Partial<T>);
      if (created) {
        setData(prev => [created, ...prev]);
        return created;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Insert failed';
      setError(msg);
      // Fallback: add locally
      const local = { ...row, id: crypto.randomUUID() } as T;
      setData(prev => [local, ...prev]);
      return local;
    }
    return null;
  }, [table]);

  // Update
  const update = useCallback(async (id: string, updates: Partial<T>) => {
    try {
      const updated = await dbUpdate<T>(table, id, updates);
      if (updated) {
        setData(prev => prev.map(item => item.id === id ? updated : item));
        return updated;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setError(msg);
      // Fallback: update locally
      setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }
    return null;
  }, [table]);

  // Delete
  const remove = useCallback(async (id: string) => {
    try {
      await dbDelete(table, id);
      setData(prev => prev.filter(item => item.id !== id));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      // Fallback: remove locally
      setData(prev => prev.filter(item => item.id !== id));
      return false;
    }
  }, [table]);

  return { data, setData, loading, error, create, update, remove, refresh: fetchData };
}
