/**
 * apps/mobile/components/session/RestTimerBanner.tsx
 *
 * STUB — mount point only. Plan 07 implements the full persistent countdown banner
 * (D-25/D-26): timestamp-based `endsAt`, +30s/skip ghost buttons, haptic + sound at zero,
 * and an `expo-notifications` local notification for when the app is backgrounded. This
 * plan only wires the read side of `sessionStore.restTimerEndsAt` so `session.tsx` can
 * mount this component now and Plan 07 can flesh it out without ever touching
 * `session.tsx` again (per this plan's stub-mount-point contract).
 */

import { useSessionStore } from '../../stores/sessionStore';

export function RestTimerBanner(): React.JSX.Element | null {
  // Read-only wiring for Plan 07 — nothing in this plan ever sets restTimerEndsAt, so this
  // always renders null today. Kept as a real store subscription (not a no-op) so Plan 07
  // only has to add rendering, not re-wire the read side.
  useSessionStore((s) => s.restTimerEndsAt);
  return null;
}
