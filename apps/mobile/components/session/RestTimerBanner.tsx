/**
 * apps/mobile/components/session/RestTimerBanner.tsx
 *
 * Persistent auto-rest-timer banner (LIFT-05/D-25/D-26) — a full-width band pinned above the
 * tab bar/below the sticky header (NOT a modal), Secondary surface, large tabular-nums
 * countdown, "+30s" and "Skip" as two 44px-tall ghost buttons. The countdown is recomputed
 * from `sessionStore.restTimerEndsAt` on an interval AND on every foreground transition — it
 * is never a paused JS counter (RESEARCH Pitfall 2 / D-26). At zero, a haptic buzz fires and
 * the store timer is cleared; the OS notification scheduled alongside the timer plays the
 * completion sound (see lib/notifications.ts's handler) without a redundant duplicate banner.
 *
 * Store-driven only: this component reads/writes `sessionStore` exclusively and never imports
 * `session.tsx` (Plan 06's stub-mount-point contract — session.tsx is never touched again).
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';
import { remainingSec } from '../../lib/restTimer';
import { useSessionStore } from '../../stores/sessionStore';

const TICK_MS = 250;

function formatCountdown(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimerBanner(): React.JSX.Element | null {
  const restTimerEndsAt = useSessionStore((s) => s.restTimerEndsAt);
  const addThirtySeconds = useSessionStore((s) => s.addThirtySeconds);
  const skipRest = useSessionStore((s) => s.skipRest);
  const setRestTimerEndsAt = useSessionStore((s) => s.setRestTimerEndsAt);
  const cancelPendingNotification = useSessionStore((s) => s.cancelPendingNotification);

  const [now, setNow] = useState(() => Date.now());
  const zeroHandledRef = useRef(false);

  // Timestamp-based recompute on an interval — never a resumed/paused JS counter (D-26). Only
  // ticks while a timer is actually running.
  useEffect(() => {
    if (restTimerEndsAt == null) return undefined;
    zeroHandledRef.current = false;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [restTimerEndsAt]);

  // Foreground recompute + returning-early notification cancel (D-26): when the app comes back
  // to the foreground before the timer has expired, the still-pending background notification
  // is cancelled since the live banner is the source of truth again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      const wallClockNow = Date.now();
      setNow(wallClockNow);
      if (restTimerEndsAt != null && restTimerEndsAt > wallClockNow) {
        cancelPendingNotification();
      }
    });
    return () => subscription.remove();
  }, [restTimerEndsAt, cancelPendingNotification]);

  // Zero-detection: fires the haptic once and clears the banner. Runs as an effect (not during
  // render) so the Haptics call and the store write stay outside the render body.
  useEffect(() => {
    if (restTimerEndsAt == null) return;
    if (remainingSec(restTimerEndsAt, now) > 0) return;
    if (zeroHandledRef.current) return;
    zeroHandledRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((err: unknown) => {
      console.error('[Apsis] rest-timer completion haptic failed:', err);
    });
    setRestTimerEndsAt(null);
  }, [now, restTimerEndsAt, setRestTimerEndsAt]);

  if (restTimerEndsAt == null) return null;

  const remaining = remainingSec(restTimerEndsAt, now);

  return (
    <View style={styles.banner}>
      <Text style={[styles.countdown, tabularNums]}>{formatCountdown(remaining)}</Text>
      <View style={styles.actions}>
        <Pressable
          onPress={addThirtySeconds}
          accessibilityRole="button"
          accessibilityLabel="Add 30 seconds"
          style={styles.ghostButton}>
          <Text style={styles.ghostButtonLabel}>+30s</Text>
        </Pressable>
        <Pressable
          onPress={skipRest}
          accessibilityRole="button"
          accessibilityLabel="Skip rest"
          style={styles.ghostButton}>
          <Text style={styles.ghostButtonLabel}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  countdown: {
    ...Mono,
    fontSize: 24,
    color: Colors.dark.text,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ghostButton: {
    minHeight: HIT_TARGET_MIN,
    minWidth: HIT_TARGET_MIN,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonLabel: {
    ...Typography.body,
    color: Colors.dark.accent,
  },
});
