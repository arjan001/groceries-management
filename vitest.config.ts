import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-report.json',
    },
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'lib/**/*.tsx', 'app/api/**/*.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
