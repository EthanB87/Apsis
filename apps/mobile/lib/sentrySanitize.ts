/**
 * apps/mobile/lib/sentrySanitize.ts
 *
 * Pure Sentry `beforeSend` allowlist filter (D-01/D-02/D-03, REL-03). Sentry.init in
 * _layout.tsx wires `sanitizeSentryEvent` as `beforeSend` so an outgoing crash/error event
 * can NEVER carry a health-derived value (heart rate, HSS, bodyweight, distance, duration) —
 * this is an allowlist, not a denylist: only explicitly-named fields survive, so a future
 * call site that attaches a new field to `extra`/`contexts`/`breadcrumbs` is dropped by
 * construction, not by remembering to update a blocklist.
 *
 * This extends Phase 5's T-05-01 "never log a raw health value" convention
 * (apps/mobile/lib/healthkitAuth.ts, healthkitMapping.ts) up one layer, to the Sentry SDK
 * event boundary — the same discipline, enforced structurally instead of by code review.
 *
 * Zero I/O, zero native import — only a type-only import of `ErrorEvent` so this module
 * stays plain-Node/vitest runnable (mirrors healthkitMapping.ts's purity convention) and
 * never pulls `@sentry/react-native`'s native runtime into the test process.
 */

import type { ErrorEvent } from '@sentry/react-native';

/**
 * The ONLY fields ever forwarded to Sentry:
 *   - exception: error type/message/stack frames (verbatim — this is the entire point of
 *     crash reporting).
 *   - contexts.device / contexts.app: device/OS model + app version, nothing else.
 * Everything else is explicitly reset, never spread from the input event — spreading
 * `event.extra`/`event.contexts`/`event.breadcrumbs` verbatim is exactly how a future field
 * would leak, so this function never does it (D-03).
 */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    exception: event.exception,
    contexts: {
      device: event.contexts?.device,
      app: event.contexts?.app,
    },
    user: undefined,
    extra: undefined,
    breadcrumbs: [], // D-02/Pitfall 6: always emptied, defense in depth vs Console re-capture
  };
}
