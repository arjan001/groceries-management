/**
 * Tests for lib/products.ts
 * Covers: getProduct, getBestSellers, getOnOffer, getRelated, product data integrity
 */
import { describe, it, expect } from 'vitest';
import {
  products,
  getProduct,
  getBestSellers,
  getOnOffer,
  getRelated,
  CATEGORY_LIST,
  CIRCLE_CATEGORIES,
  type Product,
} from '@/lib/products';

describe('Products Module', () => {
  // ────────────────────────────── Product Data Integrity ──────────────────────────────
  describe('Product Data Integrity', () => {
    it('should have products loaded', () => {
      expect(products.length).toBeGreaterThan(0);
    });

    it('should have unique product IDs', () => {
      const ids = products.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('every product should have required fields', () => {
      for (const product of products) {
        expect(product.id).toBeTruthy();
        expect(product.name).toBeTruthy();
        expect(product.price).toBeGreaterThan(0);
        expect(product.image).toBeTruthy();
        expect(product.category).toBeTruthy();
        expect(product.description).toBeTruthy();
        expect(product.details).toBeTruthy();
        expect(typeof product.inStock).toBe('boolean');
        expect(typeof product.stock).toBe('number');
        expect(Array.isArray(product.tags)).toBe(true);
      }
    });

    it('every product should belong to a valid category', () => {
      const validCategories = ['Bread', 'Pastry', 'Cake', 'Cookies', 'Donuts'];
      for (const product of products) {
        expect(validCategories).toContain(product.category);
      }
    });

    it('should have products in each category', () => {
      const categories = ['Bread', 'Pastry', 'Cake', 'Cookies', 'Donuts'];
      for (const category of categories) {
        const count = products.filter(p => p.category === category).length;
        expect(count).toBeGreaterThan(0);
      }
    });

    it('all products should have stock > 0 and be in stock', () => {
      for (const product of products) {
        expect(product.stock).toBeGreaterThan(0);
        expect(product.inStock).toBe(true);
      }
    });
  });

  // ────────────────────────────── getProduct ──────────────────────────────
  describe('getProduct', () => {
    it('should find a product by ID', () => {
      const product = getProduct('white-bread');
      expect(product).toBeDefined();
      expect(product?.name).toBe('White Bread Loaf');
    });

    it('should return undefined for non-existent product', () => {
      const product = getProduct('nonexistent-product');
      expect(product).toBeUndefined();
    });

    it('should find products for all known IDs', () => {
      const knownIds = ['white-bread', 'butter-croissant', 'classic-donut', 'chocolate-cake', 'butter-cookies'];
      for (const id of knownIds) {
        expect(getProduct(id)).toBeDefined();
      }
    });
  });

  // ────────────────────────────── getBestSellers ──────────────────────────────
  describe('getBestSellers', () => {
    it('should return only products marked as best sellers', () => {
      const bestSellers = getBestSellers();
      expect(bestSellers.length).toBeGreaterThan(0);
      for (const product of bestSellers) {
        expect(product.isBestSeller).toBe(true);
      }
    });

    it('should return a subset of all products', () => {
      const bestSellers = getBestSellers();
      expect(bestSellers.length).toBeLessThan(products.length);
    });
  });

  // ────────────────────────────── getOnOffer ──────────────────────────────
  describe('getOnOffer', () => {
    it('should return products that are on sale or have offers', () => {
      const onOffer = getOnOffer();
      expect(onOffer.length).toBeGreaterThan(0);
      for (const product of onOffer) {
        expect(product.isSale || product.onOffer).toBeTruthy();
      }
    });

    it('should include products with originalPrice', () => {
      const onOffer = getOnOffer();
      const withOriginal = onOffer.filter(p => p.originalPrice !== undefined);
      expect(withOriginal.length).toBeGreaterThan(0);
    });
  });

  // ────────────────────────────── getRelated ──────────────────────────────
  describe('getRelated', () => {
    it('should return products in the same category', () => {
      const whiteBread = getProduct('white-bread')!;
      const related = getRelated(whiteBread);
      for (const product of related) {
        expect(product.category).toBe('Bread');
      }
    });

    it('should not include the original product', () => {
      const whiteBread = getProduct('white-bread')!;
      const related = getRelated(whiteBread);
      expect(related.find(p => p.id === 'white-bread')).toBeUndefined();
    });

    it('should return at most 4 products by default', () => {
      const whiteBread = getProduct('white-bread')!;
      const related = getRelated(whiteBread);
      expect(related.length).toBeLessThanOrEqual(4);
    });

    it('should respect custom count parameter', () => {
      const whiteBread = getProduct('white-bread')!;
      const related = getRelated(whiteBread, 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no related products exist for a unique category', () => {
      // Create a mock product with a unique category
      const unique: Product = {
        id: 'test', name: 'Test', price: 10, image: '', category: 'UniqueCategory',
        description: '', details: '', inStock: true, stock: 1, tags: [],
      };
      const related = getRelated(unique);
      expect(related).toEqual([]);
    });
  });

  // ────────────────────────────── Category Constants ──────────────────────────────
  describe('Category Constants', () => {
    it('CATEGORY_LIST should contain expected categories', () => {
      expect(CATEGORY_LIST).toContain('All');
      expect(CATEGORY_LIST).toContain('Bread');
      expect(CATEGORY_LIST).toContain('Pastry');
      expect(CATEGORY_LIST).toContain('Cake');
      expect(CATEGORY_LIST).toContain('Cookies');
      expect(CATEGORY_LIST).toContain('Donuts');
    });

    it('CIRCLE_CATEGORIES should have entries with required fields', () => {
      expect(CIRCLE_CATEGORIES.length).toBeGreaterThan(0);
      for (const cat of CIRCLE_CATEGORIES) {
        expect(cat.label).toBeTruthy();
        expect(cat.image).toBeTruthy();
        expect(cat.href).toBeTruthy();
      }
    });
  });
});
