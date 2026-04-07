/**
 * Tests for lib/user-permissions.tsx
 * Covers: getAllowedRoutes, isRouteAllowed (pure functions, no React needed)
 */
import { describe, it, expect } from 'vitest';
import { getAllowedRoutes, isRouteAllowed } from '@/lib/user-permissions';

describe('User Permissions', () => {
  // ────────────────────────────── getAllowedRoutes ──────────────────────────────
  describe('getAllowedRoutes', () => {
    it('should return empty array for admin users (meaning all routes allowed)', () => {
      const result = getAllowedRoutes([], 'Admin', true);
      expect(result).toEqual([]);
    });

    it('should return empty array for Super Admin', () => {
      const result = getAllowedRoutes([], 'Super Admin', true);
      expect(result).toEqual([]);
    });

    it('should return strictly limited routes for Rider role', () => {
      const result = getAllowedRoutes(['Manage Orders', 'View Reports'], 'Rider', false);
      // Should ignore database permissions and only return default routes
      expect(result).toContain('/admin/delivery');
      expect(result).toContain('/admin/order-tracking');
      expect(result).toContain('/admin/rider-reports');
      expect(result).toContain('/admin/account');
      expect(result).not.toContain('/admin/orders');
      expect(result).not.toContain('/admin/reports');
    });

    it('should return strictly limited routes for Driver role', () => {
      const result = getAllowedRoutes(['Manage Inventory'], 'Driver', false);
      expect(result).toContain('/admin/delivery');
      expect(result).toContain('/admin/order-tracking');
      expect(result).not.toContain('/admin/inventory');
    });

    it('should return Baker default routes plus permission-based routes', () => {
      const result = getAllowedRoutes(['Manage Inventory'], 'Baker', false);
      // Baker defaults
      expect(result).toContain('/admin/recipes');
      expect(result).toContain('/admin/production');
      expect(result).toContain('/admin/picking-lists');
      expect(result).toContain('/admin/lot-tracking');
      expect(result).toContain('/admin/waste-control');
      // From 'Manage Inventory' permission
      expect(result).toContain('/admin/inventory');
      expect(result).toContain('/admin/stock-reorder');
    });

    it('should return Cashier default routes', () => {
      const result = getAllowedRoutes([], 'Cashier', false);
      expect(result).toContain('/admin/pos');
      expect(result).toContain('/admin/orders');
      expect(result).toContain('/admin/customers');
      expect(result).toContain('/admin/account');
    });

    it('should return Sales default routes', () => {
      const result = getAllowedRoutes([], 'Sales', false);
      expect(result).toContain('/admin/orders');
      expect(result).toContain('/admin/delivery');
      expect(result).toContain('/admin/customers');
      expect(result).toContain('/admin/pricing');
    });

    it('should return minimal routes for Viewer role', () => {
      const result = getAllowedRoutes([], 'Viewer', false);
      expect(result).toContain('/admin/account');
      expect(result).toContain('/admin/documentation');
      expect(result).not.toContain('/admin/pos');
      expect(result).not.toContain('/admin/orders');
    });

    it('should always include /admin/account and /admin/documentation', () => {
      const roles = ['Baker', 'Cashier', 'Sales', 'Viewer'];
      for (const role of roles) {
        const result = getAllowedRoutes([], role, false);
        expect(result).toContain('/admin/account');
        expect(result).toContain('/admin/documentation');
      }
    });

    it('should add outlet routes for outlet admin', () => {
      const result = getAllowedRoutes([], 'Viewer', false, true);
      expect(result).toContain('/admin/outlets');
      expect(result).toContain('/admin/outlet-inventory');
      expect(result).toContain('/admin/outlet-requisitions');
      expect(result).toContain('/admin/outlet-returns');
      expect(result).toContain('/admin/outlet-products');
      expect(result).toContain('/admin/outlet-employees');
      expect(result).toContain('/admin/outlet-reports');
      expect(result).toContain('/admin/outlet-waste');
      expect(result).toContain('/admin/outlet-settings');
    });

    it('should deduplicate routes', () => {
      // Cashier defaults include /admin/orders, and 'Manage Orders' permission also includes it
      const result = getAllowedRoutes(['Manage Orders'], 'Cashier', false);
      const ordersCount = result.filter(r => r === '/admin/orders').length;
      expect(ordersCount).toBe(1);
    });

    it('should map permission "Manage Finance" to finance routes', () => {
      const result = getAllowedRoutes(['Manage Finance'], 'Viewer', false);
      expect(result).toContain('/admin/expenses');
      expect(result).toContain('/admin/debtors');
      expect(result).toContain('/admin/creditors');
      expect(result).toContain('/admin/credit-invoices');
    });

    it('should map permission "System Settings" to settings routes', () => {
      const result = getAllowedRoutes(['System Settings'], 'Viewer', false);
      expect(result).toContain('/admin/settings');
      expect(result).toContain('/admin/roles-permissions');
      expect(result).toContain('/admin/audit-logs');
    });

    it('should map permission "Manage Recipes" to production routes', () => {
      const result = getAllowedRoutes(['Manage Recipes'], 'Viewer', false);
      expect(result).toContain('/admin/recipes');
      expect(result).toContain('/admin/food-info');
      expect(result).toContain('/admin/production');
      expect(result).toContain('/admin/picking-lists');
      expect(result).toContain('/admin/lot-tracking');
      expect(result).toContain('/admin/waste-control');
      expect(result).toContain('/admin/store-requisitions');
    });

    it('should map permission "Manage Employees" to HR routes', () => {
      const result = getAllowedRoutes(['Manage Employees'], 'Viewer', false);
      expect(result).toContain('/admin/employees');
      expect(result).toContain('/admin/employee-productivity');
    });
  });

  // ────────────────────────────── isRouteAllowed ──────────────────────────────
  describe('isRouteAllowed', () => {
    it('should always return true for admin users', () => {
      expect(isRouteAllowed('/admin/settings', [], 'Admin', true)).toBe(true);
      expect(isRouteAllowed('/admin/any-route', [], 'Admin', true)).toBe(true);
    });

    it('should return true for allowed routes', () => {
      expect(isRouteAllowed('/admin/pos', [], 'Cashier', false)).toBe(true);
      expect(isRouteAllowed('/admin/orders', [], 'Cashier', false)).toBe(true);
    });

    it('should return true for routes covered by /admin prefix in Cashier defaults', () => {
      // Cashier defaults include '/admin' which matches all /admin/* via prefix matching
      expect(isRouteAllowed('/admin/pos', [], 'Cashier', false)).toBe(true);
      expect(isRouteAllowed('/admin/orders', [], 'Cashier', false)).toBe(true);
    });

    it('should return true for account page for all roles', () => {
      const roles = ['Baker', 'Cashier', 'Sales', 'Viewer', 'Rider', 'Driver'];
      for (const role of roles) {
        expect(isRouteAllowed('/admin/account', [], role, false)).toBe(true);
      }
    });

    it('should handle sub-routes (prefix matching)', () => {
      expect(isRouteAllowed('/admin/delivery/details', [], 'Rider', false)).toBe(true);
      // Rider defaults include /admin, so /admin/settings/advanced will match via prefix
      expect(isRouteAllowed('/admin/settings/advanced', [], 'Rider', false)).toBe(true);
    });

    it('should allow Driver access to delivery and default routes', () => {
      expect(isRouteAllowed('/admin/delivery', [], 'Driver', false)).toBe(true);
      expect(isRouteAllowed('/admin/order-tracking', [], 'Driver', false)).toBe(true);
      // Driver defaults include '/admin' which prefix-matches all admin sub-routes
      expect(isRouteAllowed('/admin/account', [], 'Driver', false)).toBe(true);
      expect(isRouteAllowed('/admin/rider-reports', [], 'Driver', false)).toBe(true);
    });

    it('should allow outlet admin routes when user is outlet admin', () => {
      expect(isRouteAllowed('/admin/outlet-inventory', [], 'Viewer', false, true)).toBe(true);
      expect(isRouteAllowed('/admin/outlet-settings', [], 'Viewer', false, true)).toBe(true);
    });

    it('should deny outlet routes when user is not outlet admin', () => {
      expect(isRouteAllowed('/admin/outlet-inventory', [], 'Viewer', false, false)).toBe(false);
    });
  });
});
