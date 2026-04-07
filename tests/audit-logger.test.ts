/**
 * Tests for lib/audit-logger.ts
 * Covers: logAudit function with mocked Supabase
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => ({
    from: (table: string) => {
      if (table === 'audit_log') {
        return { insert: mockInsert };
      }
      // users table — used by isMainSuperAdmin
      return {
        select: () => ({
          order: () => ({
            limit: () => ({
              single: mockSingle,
            }),
          }),
        }),
      };
    },
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no super admin match (first user is someone else)
    mockSingle.mockResolvedValue({ data: { id: 'first-user-not-current' } });
  });

  it('should log an audit entry with user info', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'admin@test.com',
          user_metadata: { full_name: 'Admin User' },
        },
      },
    });
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');
    await logAudit({
      action: 'CREATE',
      module: 'Recipes',
      record_id: 'recipe-456',
      details: { name: 'New Recipe' },
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        user_name: 'Admin User',
        action: 'CREATE',
        module: 'Recipes',
        record_id: 'recipe-456',
        details: { name: 'New Recipe' },
      })
    );
  });

  it('should skip audit logging for the main super admin', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'super-admin-001',
          email: 'owner@test.com',
          user_metadata: { full_name: 'Owner' },
        },
      },
    });
    // The first registered user IS the current user
    mockSingle.mockResolvedValue({ data: { id: 'super-admin-001' } });
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');
    await logAudit({
      action: 'CREATE',
      module: 'Recipes',
      record_id: 'recipe-789',
    });

    // Insert should NOT be called — main super admin is excluded
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should log with "System" when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');
    await logAudit({
      action: 'DELETE',
      module: 'Inventory',
      record_id: 'inv-789',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        user_name: 'System',
        action: 'DELETE',
        module: 'Inventory',
      })
    );
  });

  it('should handle insert errors gracefully (fire-and-forget)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', user_metadata: {} } },
    });
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    const { logAudit } = await import('@/lib/audit-logger');
    // Should not throw
    await expect(
      logAudit({ action: 'UPDATE', module: 'Orders' })
    ).resolves.toBeUndefined();
  });

  it('should handle auth errors gracefully', async () => {
    mockGetUser.mockRejectedValue(new Error('Auth service down'));
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');
    await expect(
      logAudit({ action: 'CREATE', module: 'Customers' })
    ).resolves.toBeUndefined();
  });

  it('should use email prefix as name when full_name is not set', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-456',
          email: 'baker@snackoh.com',
          user_metadata: {},
        },
      },
    });
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');
    await logAudit({ action: 'VIEW', module: 'Reports' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_name: 'baker',
      })
    );
  });

  it('should support all audit action types', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockInsert.mockResolvedValue({ error: null });

    const { logAudit } = await import('@/lib/audit-logger');

    const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'APPROVE', 'REJECT'] as const;
    for (const action of actions) {
      await logAudit({ action, module: 'Test' });
    }

    expect(mockInsert).toHaveBeenCalledTimes(actions.length);
  });
});
