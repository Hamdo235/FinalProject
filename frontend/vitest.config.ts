import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'next/navigation': path.resolve(__dirname, 'tests/__mocks__/next-navigation.ts'),
      'next/dynamic': path.resolve(__dirname, 'tests/__mocks__/next-dynamic.ts'),
    },
  },
});
