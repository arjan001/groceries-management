/**
 * Tests for Cart Context (lib/cart-context.tsx)
 * Covers: addItem, removeItem, updateQty, clearCart, cart calculations
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { CartProvider, useCart, type CartItem } from '@/lib/cart-context';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(CartProvider, null, children);
}

describe('Cart Context', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should start with empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.total).toBe(0);
  });

  // ────────────────────────────── addItem ──────────────────────────────
  describe('addItem', () => {
    it('should add an item to the cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper });
      act(() => {
        result.current.addItem({
          id: 'white-bread',
          name: 'White Bread',
          price: 80,
          image: '/bread.jpg',
          category: 'Bread',
        });
      });
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].name).toBe('White Bread');
      expect(result.current.items[0].quantity).toBe(1);
      expect(result.current.itemCount).toBe(1);
      expect(result.current.total).toBe(80);
    });

    it('should increment quantity when adding same item twice', () => {
      const { result } = renderHook(() => useCart(), { wrapper });
      const item = { id: 'bread-1', name: 'Bread', price: 50, image: '/b.jpg', category: 'Bread' };

      act(() => { result.current.addItem(item); });
      act(() => { result.current.addItem(item); });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].quantity).toBe(2);
      expect(result.current.itemCount).toBe(2);
      expect(result.current.total).toBe(100);
    });

    it('should add multiple different items', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'bread', name: 'Bread', price: 50, image: '', category: 'Bread' });
      });
      act(() => {
        result.current.addItem({ id: 'cake', name: 'Cake', price: 200, image: '', category: 'Cake' });
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.itemCount).toBe(2);
      expect(result.current.total).toBe(250);
    });

    it('should open cart when item is added', () => {
      const { result } = renderHook(() => useCart(), { wrapper });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.addItem({ id: '1', name: 'Item', price: 10, image: '', category: 'Test' });
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  // ────────────────────────────── removeItem ──────────────────────────────
  describe('removeItem', () => {
    it('should remove an item from the cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'item-1', name: 'Item 1', price: 100, image: '', category: 'Test' });
        result.current.addItem({ id: 'item-2', name: 'Item 2', price: 200, image: '', category: 'Test' });
      });
      act(() => {
        result.current.removeItem('item-1');
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('item-2');
      expect(result.current.total).toBe(200);
    });

    it('should handle removing non-existent item gracefully', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'item-1', name: 'Item', price: 50, image: '', category: 'Test' });
      });
      act(() => {
        result.current.removeItem('non-existent');
      });

      expect(result.current.items).toHaveLength(1);
    });
  });

  // ────────────────────────────── updateQty ──────────────────────────────
  describe('updateQty', () => {
    it('should update item quantity', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'item-1', name: 'Item', price: 100, image: '', category: 'Test' });
      });
      act(() => {
        result.current.updateQty('item-1', 5);
      });

      expect(result.current.items[0].quantity).toBe(5);
      expect(result.current.total).toBe(500);
    });

    it('should remove item when quantity is set to 0', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'item-1', name: 'Item', price: 100, image: '', category: 'Test' });
      });
      act(() => {
        result.current.updateQty('item-1', 0);
      });

      expect(result.current.items).toHaveLength(0);
    });

    it('should remove item when quantity is negative', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: 'item-1', name: 'Item', price: 100, image: '', category: 'Test' });
      });
      act(() => {
        result.current.updateQty('item-1', -1);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  // ────────────────────────────── clearCart ──────────────────────────────
  describe('clearCart', () => {
    it('should remove all items from the cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: '1', name: 'A', price: 10, image: '', category: 'X' });
        result.current.addItem({ id: '2', name: 'B', price: 20, image: '', category: 'X' });
        result.current.addItem({ id: '3', name: 'C', price: 30, image: '', category: 'X' });
      });
      act(() => {
        result.current.clearCart();
      });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.itemCount).toBe(0);
      expect(result.current.total).toBe(0);
    });
  });

  // ────────────────────────────── Cart Calculations ──────────────────────────────
  describe('Cart Calculations', () => {
    it('should calculate correct total with mixed quantities', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      act(() => {
        result.current.addItem({ id: '1', name: 'A', price: 100, image: '', category: 'X' });
        result.current.addItem({ id: '2', name: 'B', price: 200, image: '', category: 'X' });
      });
      act(() => {
        result.current.updateQty('1', 3); // 3 x 100 = 300
        result.current.updateQty('2', 2); // 2 x 200 = 400
      });

      expect(result.current.total).toBe(700);
      expect(result.current.itemCount).toBe(5);
    });
  });

  // ────────────────────────────── Cart Visibility ──────────────────────────────
  describe('Cart Visibility', () => {
    it('should open and close cart', () => {
      const { result } = renderHook(() => useCart(), { wrapper });

      expect(result.current.isOpen).toBe(false);

      act(() => { result.current.openCart(); });
      expect(result.current.isOpen).toBe(true);

      act(() => { result.current.closeCart(); });
      expect(result.current.isOpen).toBe(false);
    });
  });

  // ────────────────────────────── Error Handling ──────────────────────────────
  describe('Error Handling', () => {
    it('should throw when useCart is used outside CartProvider', () => {
      expect(() => {
        renderHook(() => useCart());
      }).toThrow('useCart must be used within CartProvider');
    });
  });
});
