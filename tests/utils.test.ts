/**
 * Tests for lib/utils.ts
 * Covers: cn utility function
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn (className merger)', () => {
    it('should merge class names', () => {
      const result = cn('bg-red-500', 'text-white');
      expect(result).toContain('bg-red-500');
      expect(result).toContain('text-white');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const result = cn('base-class', isActive && 'active-class');
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
    });

    it('should remove conflicting Tailwind classes (last wins)', () => {
      const result = cn('bg-red-500', 'bg-blue-500');
      expect(result).toBe('bg-blue-500');
    });

    it('should handle falsy values', () => {
      const result = cn('base', false, null, undefined, '', 'extra');
      expect(result).toContain('base');
      expect(result).toContain('extra');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle arrays of class names', () => {
      const result = cn(['flex', 'items-center']);
      expect(result).toContain('flex');
      expect(result).toContain('items-center');
    });

    it('should merge padding classes correctly', () => {
      const result = cn('p-4', 'p-8');
      expect(result).toBe('p-8');
    });

    it('should handle complex conditional patterns', () => {
      const variant = 'primary';
      const result = cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
      );
      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
      expect(result).not.toContain('btn-secondary');
    });
  });
});
