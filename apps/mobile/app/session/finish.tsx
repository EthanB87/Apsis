/**
 * apps/mobile/app/session/finish.tsx
 *
 * MINIMAL STUB (D-27): reads `workout.hss` and shows the Display-size session HSS + "Done"
 * (UI-SPEC Copywriting Contract). Plan 08 fleshes this out with per-exercise volume/set
 * counts, the engine warnings list (D-29), and the Discard menu (D-28) behind a confirm
 * dialog. `workout.finishedAt` is already set by `LiveHssHeader`'s "Finish" button before
 * navigating here (D-14: the D-13/D-14 open-session invariant must never be left dangling
 * after a normal finish flow) — this screen only displays and clears the session store.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, workout } from '@apsis/db';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Spacing, Typography } from '../../constants/theme';
import { useSessionStore } from '../../stores/sessionStore';

export default function FinishScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const router = useRouter();
  const reset = useSessionStore((s) => s.reset);
  const [hss, setHss] = useState<number | null>(null);

  useEffect(() => {
    if (!params.workoutId) return;
    let cancelled = false;
    db.select({ hss: workout.hss })
      .from(workout)
      .where(eq(workout.id, params.workoutId))
      .limit(1)
      .then((rows) => {
        if (!cancelled) setHss(rows[0]?.hss ?? 0);
      })
      .catch((err: unknown) => {
        console.error('[Apsis] finish.tsx workout query failed:', err);
        if (!cancelled) setHss(0);
      });
    return () => {
      cancelled = true;
    };
  }, [params.workoutId]);

  function handleDone(): void {
    reset();
    router.replace('/(tabs)/log');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Session Complete</Text>
      <Text style={styles.hss}>{hss == null ? '—' : Math.round(hss)}</Text>
      <Pressable
        onPress={handleDone}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={styles.button}>
        <Text style={styles.buttonLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    paddingHorizontal: Spacing.lg,
  },
  label: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.sm,
  },
  hss: {
    ...Typography.display,
    color: Colors.dark.accent,
    marginBottom: Spacing.xxl,
  },
  button: {
    minHeight: HIT_TARGET_MIN,
    minWidth: 160,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
