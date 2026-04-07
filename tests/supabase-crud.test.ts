/**
 * Tests for lib/supabase.ts — Generic CRUD helpers
 * All Supabase calls are mocked to test logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the Supabase client ───────────────────────────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

function createChainMock(finalResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  // For queries that don't call .single()
  chain.then = undefined;
  // Make the chain itself act as a promise for queries ending at .order()
  Object.defineProperty(chain, 'then', {
    get: () => {
      return (resolve: (value: unknown) => void) => resolve(finalResult);
    },
    configurable: true,
  });
  return chain;
}

let mockChain: ReturnType<typeof createChainMock>;

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    from: (table: string) => mockChain,
  }),
}));

describe('CRUD Helpers (lib/supabase.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────── dbFetchAll ──────────────────────────────
  describe('dbFetchAll', () => {
    it('should fetch all rows from a table ordered by created_at descending', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', created_at: '2024-01-02' },
        { id: '2', name: 'Item 2', created_at: '2024-01-01' },
      ];
      mockChain = createChainMock({ data: mockData, error: null });

      const { dbFetchAll } = await import('@/lib/supabase');
      const result = await dbFetchAll('recipes');

      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockData);
    });

    it('should return empty array on error', async () => {
      mockChain = createChainMock({ data: null, error: { message: 'Table not found' } });

      const { dbFetchAll } = await import('@/lib/supabase');
      const result = await dbFetchAll('nonexistent_table');

      expect(result).toEqual([]);
    });

    it('should accept custom ordering', async () => {
      const mockData = [{ id: '1', name: 'Alpha' }];
      mockChain = createChainMock({ data: mockData, error: null });

      const { dbFetchAll } = await import('@/lib/supabase');
      const result = await dbFetchAll('products', 'name', true);

      expect(mockChain.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(mockData);
    });

    it('should return empty array when data is null', async () => {
      mockChain = createChainMock({ data: null, error: null });

      const { dbFetchAll } = await import('@/lib/supabase');
      const result = await dbFetchAll('empty_table');

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────── dbFetchWithFilter ──────────────────────────────
  describe('dbFetchWithFilter', () => {
    it('should fetch rows with filters applied', async () => {
      const mockData = [{ id: '1', name: 'Active Item', status: 'active' }];
      mockChain = createChainMock({ data: mockData, error: null });

      const { dbFetchWithFilter } = await import('@/lib/supabase');
      const result = await dbFetchWithFilter('orders', { status: 'active' });

      expect(mockChain.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toEqual(mockData);
    });

    it('should apply multiple filters', async () => {
      const mockData = [{ id: '1' }];
      mockChain = createChainMock({ data: mockData, error: null });

      const { dbFetchWithFilter } = await import('@/lib/supabase');
      await dbFetchWithFilter('orders', { status: 'active', category: 'bread' });

      expect(mockChain.eq).toHaveBeenCalledTimes(2);
    });

    it('should return empty array on error', async () => {
      mockChain = createChainMock({ data: null, error: { message: 'Permission denied' } });

      const { dbFetchWithFilter } = await import('@/lib/supabase');
      const result = await dbFetchWithFilter('orders', { status: 'pending' });

      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────── dbInsert ──────────────────────────────
  describe('dbInsert', () => {
    it('should insert a row and return the result', async () => {
      const newRow = { name: 'New Recipe', category: 'Bread' };
      const insertedRow = { id: 'abc-123', ...newRow, created_at: '2024-01-01' };
      mockChain = createChainMock({ data: insertedRow, error: null });

      const { dbInsert } = await import('@/lib/supabase');
      const result = await dbInsert('recipes', newRow);

      expect(mockChain.insert).toHaveBeenCalledWith(newRow);
      expect(result).toEqual(insertedRow);
    });

    it('should throw error on insert failure', async () => {
      mockChain = createChainMock({ data: null, error: { message: 'Duplicate key' } });

      const { dbInsert } = await import('@/lib/supabase');
      await expect(dbInsert('recipes', { name: 'Duplicate' })).rejects.toThrow();
    });
  });

  // ────────────────────────────── dbUpdate ──────────────────────────────
  describe('dbUpdate', () => {
    it('should update a row by id and return the result', async () => {
      const updates = { name: 'Updated Recipe' };
      const updatedRow = { id: 'abc-123', name: 'Updated Recipe', category: 'Bread' };
      mockChain = createChainMock({ data: updatedRow, error: null });

      const { dbUpdate } = await import('@/lib/supabase');
      const result = await dbUpdate('recipes', 'abc-123', updates);

      expect(mockChain.update).toHaveBeenCalledWith(updates);
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'abc-123');
      expect(result).toEqual(updatedRow);
    });

    it('should throw error on update failure', async () => {
      mockChain = createChainMock({ data: null, error: { message: 'Row not found' } });

      const { dbUpdate } = await import('@/lib/supabase');
      await expect(dbUpdate('recipes', 'nonexistent', { name: 'X' })).rejects.toThrow();
    });
  });

  // ────────────────────────────── dbDelete ──────────────────────────────
  describe('dbDelete', () => {
    it('should delete a row by id and return true', async () => {
      mockChain = createChainMock({ data: null, error: null });
      // Override: dbDelete doesn't call .single(), it resolves after .eq()
      mockChain.eq = vi.fn().mockResolvedValue({ error: null });

      const { dbDelete } = await import('@/lib/supabase');
      const result = await dbDelete('recipes', 'abc-123');

      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'abc-123');
      expect(result).toBe(true);
    });

    it('should throw error on delete failure', async () => {
      mockChain = createChainMock({ data: null, error: null });
      mockChain.eq = vi.fn().mockResolvedValue({ error: { message: 'Foreign key constraint' } });

      const { dbDelete } = await import('@/lib/supabase');
      await expect(dbDelete('orders', 'abc-123')).rejects.toThrow();
    });
  });

  // ────────────────────────────── dbUpsert ──────────────────────────────
  describe('dbUpsert', () => {
    it('should upsert a row and return the result', async () => {
      const row = { id: 'abc-123', name: 'Upserted Recipe', category: 'Cake' };
      mockChain = createChainMock({ data: row, error: null });

      const { dbUpsert } = await import('@/lib/supabase');
      const result = await dbUpsert('recipes', row);

      expect(mockChain.upsert).toHaveBeenCalledWith(row);
      expect(result).toEqual(row);
    });

    it('should throw error on upsert failure', async () => {
      mockChain = createChainMock({ data: null, error: { message: 'Constraint violation' } });

      const { dbUpsert } = await import('@/lib/supabase');
      await expect(dbUpsert('recipes', { name: 'Bad' })).rejects.toThrow();
    });
  });

  // ────────────────────────────── isSupabaseConfigured ──────────────────────────────
  describe('isSupabaseConfigured', () => {
    it('should return true when environment variables are set', async () => {
      const { isSupabaseConfigured } = await import('@/lib/supabase');
      expect(isSupabaseConfigured()).toBe(true);
    });
  });
});
