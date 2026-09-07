/**
 * apps/mobile/lib/__tests__/sentrySanitize.test.ts
 *
 * RED/GREEN coverage for the pure Sentry `beforeSend` allowlist filter (D-03, REL-03).
 * Mirrors healthkitMapping.test.ts's plain-vitest style — no @apsis/db, no
 * @sentry/react-native runtime import anywhere in this file or the module under test
 * (only a type-only import of ErrorEvent is allowed in sentrySanitize.ts).
 */

import { describe, expect, it } from 'vitest';
import { sanitizeSentryEvent } from '../sentrySanitize';

describe('sanitizeSentryEvent (D-03)', () => {
  it('preserves the exception field verbatim (error type/message/stack frames survive)', () => {
    const exception = {
      values: [{ type: 'TypeError', value: 'Cannot read property of undefined', stacktrace: { frames: [{ filename: 'index.ts', lineno: 42 }] } }],
    };
    const event = { exception, contexts: {}, extra: {}, breadcrumbs: [] } as any;
    const clean = sanitizeSentryEvent(event);
    expect(clean.exception).toEqual(exception);
  });

  it('reduces contexts to exactly device and app subfields, dropping any other key', () => {
    const event = {
      exception: {},
      contexts: {
        device: { model: 'iPhone15,3' },
        app: { app_version: '1.0.0' },
        // poisoned/unexpected context key that must never survive:
        healthProfile: { bodyweightKg: 82.5, restingHR: 48 },
      },
      extra: {},
      breadcrumbs: [],
    } as any;
    const clean = sanitizeSentryEvent(event);
    expect(clean.contexts).toEqual({ device: { model: 'iPhone15,3' }, app: { app_version: '1.0.0' } });
    expect(Object.keys(clean.contexts ?? {}).sort()).toEqual(['app', 'device']);
  });

  it('always sets user to undefined — no identity ever attached', () => {
    const event = {
      exception: {},
      contexts: {},
      extra: {},
      breadcrumbs: [],
      user: { id: 'user-123', email: 'athlete@example.com' },
    } as any;
    const clean = sanitizeSentryEvent(event);
    expect(clean.user).toBeUndefined();
  });

  it('always sets extra to undefined — a poisoned extra with health values does not survive', () => {
    const event = {
      exception: {},
      contexts: {},
      extra: { heartRate: 172, hss: 88.4, bodyweightKg: 82.5, distanceM: 5000, durationS: 1800 },
      breadcrumbs: [],
    } as any;
    const clean = sanitizeSentryEvent(event);
    expect(clean.extra).toBeUndefined();
  });

  it('always sets breadcrumbs to [] regardless of a non-empty input', () => {
    const event = {
      exception: {},
      contexts: {},
      extra: {},
      breadcrumbs: [
        { message: 'console.log: HR is 172bpm, HSS is 88.4' },
        { message: 'user navigated to /log/session' },
      ],
    } as any;
    const clean = sanitizeSentryEvent(event);
    expect(clean.breadcrumbs).toEqual([]);
  });

  it('strips a fabricated HR/HSS field from extra even if a future call site attaches it', () => {
    const poisoned = { extra: { heartRate: 172, hss: 88.4 }, exception: {}, contexts: {} } as any;
    const clean = sanitizeSentryEvent(poisoned);
    expect(clean.extra).toBeUndefined();
  });

  it('produces a fully-sanitized event from a maximally-poisoned input in one pass', () => {
    const poisoned = {
      exception: { values: [{ type: 'Error', value: 'boom' }] },
      contexts: {
        device: { model: 'iPhone15,3' },
        app: { app_version: '1.0.0' },
        profile: { bodyweightKg: 82.5 },
      },
      extra: { heartRate: 172, hss: 88.4, bodyweightKg: 82.5, distanceM: 5000, durationS: 1800 },
      breadcrumbs: [{ message: 'HR 172bpm' }],
      user: { id: 'user-123' },
    } as any;
    const clean = sanitizeSentryEvent(poisoned);
    expect(clean.extra).toBeUndefined();
    expect(clean.user).toBeUndefined();
    expect(clean.breadcrumbs).toEqual([]);
    expect(Object.keys(clean.contexts ?? {}).sort()).toEqual(['app', 'device']);
    expect(clean.exception).toEqual(poisoned.exception);
  });
});
