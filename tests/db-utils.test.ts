/**
 * Tests for lib/db-utils.ts
 * Covers: toSnake, toCamel, mapFromDb, mapToDb
 */
import { describe, it, expect } from 'vitest';
import { toSnake, toCamel, mapFromDb, mapToDb } from '@/lib/db-utils';

describe('db-utils', () => {
  // ────────────────────────────── toSnake ──────────────────────────────
  describe('toSnake', () => {
    it('should convert camelCase keys to snake_case', () => {
      const input = { firstName: 'John', lastName: 'Doe', phoneNumber: '123' };
      const result = toSnake(input);
      expect(result).toEqual({ first_name: 'John', last_name: 'Doe', phone_number: '123' });
    });

    it('should handle single-word keys (no conversion needed)', () => {
      const input = { name: 'John', email: 'john@test.com' };
      const result = toSnake(input);
      expect(result).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should handle empty object', () => {
      expect(toSnake({})).toEqual({});
    });

    it('should handle keys with multiple uppercase letters', () => {
      const input = { createdAt: '2024-01-01', updatedAt: '2024-01-02', isActive: true };
      const result = toSnake(input);
      expect(result).toEqual({ created_at: '2024-01-01', updated_at: '2024-01-02', is_active: true });
    });

    it('should preserve values of different types', () => {
      const input = { myString: 'hello', myNumber: 42, myBool: true, myNull: null, myArray: [1, 2] };
      const result = toSnake(input);
      expect(result.my_string).toBe('hello');
      expect(result.my_number).toBe(42);
      expect(result.my_bool).toBe(true);
      expect(result.my_null).toBeNull();
      expect(result.my_array).toEqual([1, 2]);
    });

    it('should handle consecutive uppercase letters', () => {
      const input = { userID: '123', apiURL: 'http://example.com' };
      const result = toSnake(input);
      expect(result).toHaveProperty('user_i_d');
      expect(result).toHaveProperty('api_u_r_l');
    });
  });

  // ────────────────────────────── toCamel ──────────────────────────────
  describe('toCamel', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = { first_name: 'John', last_name: 'Doe', phone_number: '123' };
      const result = toCamel(input);
      expect(result).toEqual({ firstName: 'John', lastName: 'Doe', phoneNumber: '123' });
    });

    it('should handle single-word keys (no conversion needed)', () => {
      const input = { name: 'John', email: 'john@test.com' };
      const result = toCamel(input);
      expect(result).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should handle empty object', () => {
      expect(toCamel({})).toEqual({});
    });

    it('should handle database-style keys', () => {
      const input = { created_at: '2024-01-01', updated_at: '2024-01-02', is_active: true };
      const result = toCamel(input);
      expect(result).toEqual({ createdAt: '2024-01-01', updatedAt: '2024-01-02', isActive: true });
    });

    it('should preserve values of different types', () => {
      const input = { my_string: 'hello', my_number: 42, my_bool: true, my_null: null };
      const result = toCamel(input);
      expect(result.myString).toBe('hello');
      expect(result.myNumber).toBe(42);
      expect(result.myBool).toBe(true);
      expect(result.myNull).toBeNull();
    });
  });

  // ────────────────────────────── Roundtrip ──────────────────────────────
  describe('toSnake <-> toCamel roundtrip', () => {
    it('should roundtrip camelCase -> snake_case -> camelCase', () => {
      const original = { firstName: 'John', lastName: 'Doe', createdAt: '2024-01-01' };
      const snaked = toSnake(original);
      const cameled = toCamel(snaked);
      expect(cameled).toEqual(original);
    });

    it('should roundtrip snake_case -> camelCase -> snake_case', () => {
      const original = { first_name: 'Jane', last_name: 'Smith', created_at: '2024-01-01' };
      const cameled = toCamel(original);
      const snaked = toSnake(cameled);
      expect(snaked).toEqual(original);
    });
  });

  // ────────────────────────────── mapFromDb ──────────────────────────────
  describe('mapFromDb', () => {
    it('should convert array of snake_case rows to camelCase', () => {
      const rows = [
        { first_name: 'John', last_name: 'Doe', is_active: true },
        { first_name: 'Jane', last_name: 'Smith', is_active: false },
      ];
      const result = mapFromDb<{ firstName: string; lastName: string; isActive: boolean }>(rows);
      expect(result).toEqual([
        { firstName: 'John', lastName: 'Doe', isActive: true },
        { firstName: 'Jane', lastName: 'Smith', isActive: false },
      ]);
    });

    it('should handle empty array', () => {
      expect(mapFromDb([])).toEqual([]);
    });

    it('should handle single-item array', () => {
      const rows = [{ product_name: 'Bread', unit_price: 10 }];
      const result = mapFromDb(rows);
      expect(result).toEqual([{ productName: 'Bread', unitPrice: 10 }]);
    });
  });

  // ────────────────────────────── mapToDb ──────────────────────────────
  describe('mapToDb', () => {
    it('should convert camelCase to snake_case and exclude default keys', () => {
      const input = { id: '123', firstName: 'John', lastName: 'Doe', certificates: [] };
      const result = mapToDb(input);
      expect(result).toEqual({ first_name: 'John', last_name: 'Doe' });
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('certificates');
    });

    it('should exclude custom keys', () => {
      const input = { id: '123', name: 'Product', tempField: 'temp', status: 'active' };
      const result = mapToDb(input, ['id', 'tempField']);
      expect(result).toEqual({ name: 'Product', status: 'active' });
    });

    it('should exclude undefined values', () => {
      const input = { firstName: 'John', lastName: undefined, email: 'john@test.com' };
      const result = mapToDb(input);
      expect(result).toEqual({ first_name: 'John', email: 'john@test.com' });
      expect(result).not.toHaveProperty('last_name');
    });

    it('should handle empty object', () => {
      expect(mapToDb({})).toEqual({});
    });

    it('should keep null values (only exclude undefined)', () => {
      const input = { firstName: 'John', middleName: null };
      const result = mapToDb(input);
      expect(result).toEqual({ first_name: 'John', middle_name: null });
    });
  });
});
