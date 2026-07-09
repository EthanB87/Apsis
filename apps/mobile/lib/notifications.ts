/**
 * apps/mobile/lib/notifications.ts
 *
 * Thin wrapper around expo-notifications for the rest-timer's background completion signal
 * (D-26). Permission is requested lazily on first timer use — NOT during onboarding — and
 * every function tolerates a denial or native error gracefully: the timestamp-based countdown
 * (lib/restTimer.ts) stays the source of truth, the notification is a nice-to-have completion
 * signal, never a correctness dependency (RESEARCH Security Domain robustness note, T-03-16).
 *
 * A module-level notification handler is installed so the scheduled rest-completion
 * notification can double as the "sound at zero" requirement (D-25) without a new audio
 * dependency: when the notification is delivered while the JS runtime is foregrounded, the
 * handler suppresses the redundant visual banner (RestTimerBanner already shows completion)
 * but still lets the system play its sound. When the app is truly backgrounded/locked, iOS
 * delivers the notification natively (banner + sound) — this JS handler is never invoked in
 * that case, so it does not affect background delivery.
 */

import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Requests notification permission if not already granted; tolerates denial (returns false, never throws). */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (err: unknown) {
    console.error('[Apsis] ensureNotificationPermission failed:', err);
    return false;
  }
}

/**
 * Schedules a local notification to fire at `endsAt` (only if permission is granted, requested
 * lazily here on first use). Returns the notification id for later cancellation, or `null` if
 * it was not scheduled (permission denied or a native scheduling error) — the caller's
 * countdown must keep working regardless.
 */
export async function scheduleRestNotification(endsAt: number): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  try {
    const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: 'Time to get back to it.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
  } catch (err: unknown) {
    console.error('[Apsis] scheduleRestNotification failed:', err);
    return null;
  }
}

/** Cancels a previously scheduled rest notification (user returns early, hits Skip, or +30s reschedules). */
export async function cancelRestNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err: unknown) {
    console.error('[Apsis] cancelRestNotification failed:', err);
  }
}
