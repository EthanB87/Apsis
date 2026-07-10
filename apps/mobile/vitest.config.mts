import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * apps/mobile vitest config — deliberately scoped to `lib/**` only.
 *
 * apps/mobile has no component/screen test harness (STATE.md deferred item): React Native
 * screens import native modules (op-sqlite JSI, expo-crypto, expo-router) that require a
 * physical device/Expo runtime and cannot run under plain Node/vitest. `@apsis/db`'s barrel
 * export in particular opens a native SQLite connection at import time (see
 * packages/db/src/client.ts) and must never be imported here.
 *
 * This config exists only to unit-test PURE logic modules under `lib/` (e.g.
 * `runEntryLogic.ts`) that have zero @apsis/db / native-module imports — mirroring
 * packages/db's own vitest.config.mts alias pattern.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@apsis/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@apsis/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['lib/**/__tests__/*.{test,spec}.ts'],
  },
});
