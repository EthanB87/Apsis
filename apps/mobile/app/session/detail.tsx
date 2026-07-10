/**
 * apps/mobile/app/session/detail.tsx
 *
 * Read-only session detail (HOME-05/HOME-06, D-25, UI-SPEC section 10) — reached by tapping a
 * session sub-row in History. Re-derives everything straight from SQLite (never from a store,
 * mirroring `app/session/finish.tsx`'s "SQLite is truth" invariant — this screen is reached
 * from a separate tab, well after any session store would have been reset) and branches on
 * `workout.type`: strength/hybrid renders per-exercise subtotal rows (re-running the same
 * per-set engine formulas `finish.tsx` already uses over the persisted, cached `e1rmKg`
 * column — never re-estimating it), endurance renders one row per `endurance_segment`. Both
 * branches end in a Heading-size, volt total row — this screen is never simultaneously visible
 * with the Home ring, so volt is fine here per 04-UI-SPEC.md's One-Volt Discipline (same
 * exception `HSSBreakdownSheet.tsx` already uses).
 *
 * No edit/delete controls: delete lives in History's swipe gesture; editing is deferred.
 * The native nav header (back button) is re-enabled via a nested `Stack.Screen` override,
 * since the root layout's `headerShown: false` default (matching `finish.tsx`'s bare full-
 * screen shape) would otherwise hide it here.
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, enduranceSegment, exercise as exerciseTable, strengthSet, workout } from '@apsis/db';
import { carryStressDetailed, enduranceStressDetailed, strengthStressDetailed } from '@apsis/engine';
import {
  formatPaceMinSec,
  kmToDisplayMi,
  paceSecPerKmToSecPerMi,
  type Units,
} from '@apsis/shared';

import Colors from '../../constants/Colors';
import { HAIRLINE_WIDTH, Mono, Spacing, Typography, tabularNums } from '../../constants/theme';
import { fetchProfileSummary } from '../../lib/commitSet';

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_NAME = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

interface DetailRow {
  id: string;
  label: string;
  meta: string;
  stress: number;
}

function isLowerBody(bodyPart: string | null): boolean {
  return bodyPart === 'lower';
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDetailDate(localDate: string): string {
  const [year, month, day] = localDate.split('-').map((part) => Number.parseInt(part, 10));
  const d = new Date(year, (month ?? 1) - 1, day);
  return `${WEEKDAY_NAME[d.getDay()]} · ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Compact h:mm:ss / m:ss duration -- matches finish.tsx's formatSessionDuration convention.
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Per-type endurance summary line -- mirrors finish.tsx's formatEnduranceSummary (not exported
// there, duplicated here as a small presentation-only helper, same convention already used a
// second time in app/(tabs)/index.tsx's formatEnduranceMeta).
function formatEnduranceMeta(
  activityType: 'run' | 'erg' | 'conditioning' | 'sled' | 'other',
  distanceM: number | null,
  durationS: number,
  avgHr: number | null,
  units: Units
): string {
  const durationLabel = formatDuration(durationS);

  if (activityType === 'conditioning') {
    return avgHr != null ? `${durationLabel} · ${avgHr} BPM` : durationLabel;
  }

  if (activityType === 'erg') {
    const pace = distanceM != null && distanceM > 0 ? durationS / (distanceM / 500) : null;
    const distanceLabel = distanceM != null ? `${Math.round(distanceM)} M` : null;
    const paceLabel = pace != null ? `${formatPaceMinSec(pace)} /500M` : null;
    return [distanceLabel, paceLabel, durationLabel].filter(Boolean).join(' · ');
  }

  const paceSecPerKm = distanceM != null && distanceM > 0 ? durationS / (distanceM / 1000) : null;
  const distanceLabel =
    distanceM != null
      ? units === 'imperial'
        ? `${kmToDisplayMi(distanceM / 1000).toFixed(1)} MI`
        : `${(distanceM / 1000).toFixed(1)} KM`
      : null;
  const paceLabel =
    paceSecPerKm != null
      ? `${formatPaceMinSec(units === 'imperial' ? paceSecPerKmToSecPerMi(paceSecPerKm) : paceSecPerKm)} /${units === 'imperial' ? 'MI' : 'KM'}`
      : null;
  return [distanceLabel, paceLabel, durationLabel].filter(Boolean).join(' · ');
}

export default function SessionDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = params.workoutId;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('Session');
  const [dateLabel, setDateLabel] = useState('');
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await fetchProfileSummary(db);

        const workoutRows = await db
          .select({ type: workout.type, title: workout.title, localDate: workout.localDate, hss: workout.hss })
          .from(workout)
          .where(eq(workout.id, workoutId));
        const w = workoutRows[0];
        if (!w) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (w.type === 'endurance') {
          const segmentRows = await db
            .select({
              id: enduranceSegment.id,
              activityType: enduranceSegment.activityType,
              distanceM: enduranceSegment.distanceM,
              durationS: enduranceSegment.durationS,
              avgHr: enduranceSegment.avgHr,
              intensityFactor: enduranceSegment.intensityFactor,
            })
            .from(enduranceSegment)
            .where(eq(enduranceSegment.workoutId, workoutId));

          const detailRows: DetailRow[] = segmentRows.map((seg) => ({
            id: seg.id,
            label: capitalize(seg.activityType),
            meta: formatEnduranceMeta(seg.activityType, seg.distanceM, seg.durationS, seg.avgHr, profile.units),
            stress: enduranceStressDetailed({
              durationS: seg.durationS,
              intensityFactor: seg.intensityFactor ?? 1.0,
            }).es,
          }));

          if (!cancelled) {
            setTitle(w.title ?? (segmentRows[0] ? capitalize(segmentRows[0].activityType) : 'Run'));
            setDateLabel(formatDetailDate(w.localDate));
            setRows(detailRows);
            setTotal(w.hss ?? 0);
            setLoading(false);
          }
          return;
        }

        // strength (and hybrid) — same SQLite-truth query shape as finish.tsx, grouped per
        // exercise for a subtotal row each.
        const setsWithExercise = await db
          .select({
            exerciseId: strengthSet.exerciseId,
            exerciseName: exerciseTable.name,
            entryMode: exerciseTable.entryMode,
            bodyPart: exerciseTable.bodyPart,
            loadKg: strengthSet.loadKg,
            reps: strengthSet.reps,
            rpe: strengthSet.rpe,
            isWarmup: strengthSet.isWarmup,
            e1rmKg: strengthSet.e1rmKg,
            durationS: strengthSet.durationS,
          })
          .from(strengthSet)
          .innerJoin(exerciseTable, eq(strengthSet.exerciseId, exerciseTable.id))
          .where(eq(strengthSet.workoutId, workoutId));

        interface ExerciseAcc {
          name: string;
          entryMode: 'reps' | 'timed';
          bodyPart: string | null;
          sets: typeof setsWithExercise;
        }
        const byExercise = new Map<string, ExerciseAcc>();
        for (const row of setsWithExercise) {
          let acc = byExercise.get(row.exerciseId);
          if (!acc) {
            acc = {
              name: row.exerciseName,
              entryMode: (row.entryMode ?? 'reps') as 'reps' | 'timed',
              bodyPart: row.bodyPart,
              sets: [],
            };
            byExercise.set(row.exerciseId, acc);
          }
          acc.sets.push(row);
        }

        const detailRows: DetailRow[] = Array.from(byExercise.entries()).map(([exerciseId, acc]) => {
          let stress = 0;
          let setCount = 0;

          if (acc.entryMode === 'timed') {
            for (const s of acc.sets) {
              if (s.isWarmup) continue;
              setCount += 1;
              stress += carryStressDetailed({
                loadKg: s.loadKg,
                bodyweightKg: profile.bodyweightKg,
                durationS: s.durationS ?? 0,
                rpe: s.rpe ?? 0,
                isWarmup: s.isWarmup ?? false,
              }).cs;
            }
          } else {
            const strengthSets = acc.sets
              .filter((s) => !s.isWarmup)
              .map((s) => ({
                loadKg: s.loadKg,
                reps: s.reps,
                rpe: s.rpe ?? 0,
                e1rmKg: s.e1rmKg ?? 0,
                isLowerBody: isLowerBody(acc.bodyPart),
                isWarmup: s.isWarmup ?? false,
              }));
            setCount = strengthSets.length;
            stress = strengthStressDetailed(strengthSets).ss;
          }

          return {
            id: exerciseId,
            label: acc.name,
            meta: `${setCount} set${setCount === 1 ? '' : 's'}`,
            stress,
          };
        });

        if (!cancelled) {
          setTitle(w.title ?? capitalize(w.type));
          setDateLabel(formatDetailDate(w.localDate));
          setRows(detailRows);
          setTotal(w.hss ?? 0);
          setLoading(false);
        }
      } catch (err: unknown) {
        console.error('[Apsis] session/detail.tsx query failed:', err);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerBackTitle: '',
          headerStyle: { backgroundColor: Colors.dark.background },
          headerShadowVisible: false,
          headerTintColor: Colors.dark.text,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.timestamp}>{dateLabel}</Text>
        <Text style={styles.title}>{title}</Text>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowMeta}>{row.meta}</Text>
            </View>
            <Text style={[styles.rowStress, tabularNums]}>{Math.round(row.stress)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.total, tabularNums]}>{Math.round(total)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  timestamp: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginTop: Spacing.lg,
  },
  title: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: HAIRLINE_WIDTH,
    borderBottomColor: Colors.dark.border,
  },
  rowText: {
    flexShrink: 1,
    paddingRight: Spacing.sm,
    gap: 2,
  },
  rowLabel: {
    ...Typography.label,
    color: Colors.dark.text,
  },
  rowMeta: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  rowStress: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  totalLabel: {
    ...Typography.heading,
    color: Colors.dark.text,
  },
  total: {
    ...Typography.heading,
    color: Colors.dark.accent,
  },
});
