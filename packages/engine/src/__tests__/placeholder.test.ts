/**
 * Smoke test — proves vitest 4 discovers and runs tests for @apsis/engine.
 * Real engine unit tests arrive in Phase 2.
 */
import { ENGINE_VERSION } from '../index';

describe('@apsis/engine smoke test', () => {
  it('basic arithmetic passes', () => {
    expect(1 + 1).toBe(2);
  });

  it('ENGINE_VERSION is exported and is a string', () => {
    expect(typeof ENGINE_VERSION).toBe('string');
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });
});
