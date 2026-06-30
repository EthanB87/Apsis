import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@apsis/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@apsis/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,mts}'],
  },
});
