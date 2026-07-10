/**
 * apps/mobile/app/(tabs)/log/index.tsx — "Start Workout" entry (LIFT-01)
 *
 * The Log tab's landing screen while no session is active: a single Accent primary CTA
 * (UI-SPEC Copywriting Contract) that creates a new `workout` row (expo-crypto UUID,
 * localDate today, type strength, finishedAt null — an "open" session per D-14), primes
 * `sessionStore` for it via `startSession` (avoids an unnecessary rehydrate round-trip for a
 * session we already know is empty), and navigates to the active-session screen.
 *
 * Security (V7/T-1-02): raw errors are console.error'd for diagnostics only; the user sees a
 * hardcoded generic string, matching the rest of the app's error-handling discipline.
 */

import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { db, workout, openWorkout } from '@apsis/db';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '@/constants/theme';
import { useSessionStore } from '@/stores/sessionStore';
import { fetchProfileSummary } from '@/lib/commitSet';

const START_ERROR_MESSAGE = "Couldn't start a new workout. Check available storage and try again.";

/** Local (not UTC) YYYY-MM-DD — workout.localDate must reflect the athlete's own calendar day. */
function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function LogHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const startSession = useSessionStore((state) => state.startSession);
  const rehydrateFromDb = useSessionStore((state) => state.rehydrateFromDb);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart(): Promise<void> {
    if (starting) return;
    setStarting(true);
    setErrorMessage(null);
    try {
      const profile = await fetchProfileSummary(db);

      // WR-03: never create a second open workout. If an unfinished, non-deleted
      // workout already exists (e.g. the user back-swiped out of the session screen
      // and tapped Start again), resume it instead of inserting — otherwise the
      // abandoned row stays open forever and the D-14 resume prompt oscillates
      // between the orphans on subsequent launches.
      const existingOpen = (await openWorkout(db))[0];
      if (existingOpen != null) {
        await rehydrateFromDb(existingOpen.id, profile);
        router.push({ pathname: '/(tabs)/log/session', params: { workoutId: existingOpen.id } });
        return;
      }

      const workoutId = randomUUID();
      await db.insert(workout).values({
        id: workoutId,
        localDate: todayLocalDate(),
        type: 'strength',
      });
      startSession(workoutId, profile);
      router.push({ pathname: '/(tabs)/log/session', params: { workoutId } });
    } catch (err: unknown) {
      console.error('[Apsis] Failed to start workout:', err);
      setErrorMessage(START_ERROR_MESSAGE);
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ready to train?</Text>
      <Text
        style={styles.body}
        lightColor={Colors.light.mutedText}
        darkColor={Colors.dark.mutedText}>
        Log your lifts and watch your training load add up as you go.
      </Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <Pressable
        onPress={handleStart}
        disabled={starting}
        accessibilityRole="button"
        accessibilityLabel="Start Workout"
        accessibilityState={{ disabled: starting }}
        style={({ pressed }) => [
          styles.button,
          starting && styles.buttonDisabled,
          pressed && !starting && styles.buttonPressed,
        ]}>
        <Text style={[styles.buttonLabel, starting && styles.buttonLabelDisabled]}>Start workout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  title: {
    ...Typography.heading,
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.label,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  error: {
    ...Typography.label,
    color: Colors.dark.destructive,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  button: {
    minHeight: 48,
    minWidth: 200,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  buttonDisabled: {
    backgroundColor: Colors.dark.steel,
    opacity: DISABLED_OPACITY,
  },
  buttonPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  buttonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  buttonLabelDisabled: {
    color: Colors.dark.mutedText,
  },
});
