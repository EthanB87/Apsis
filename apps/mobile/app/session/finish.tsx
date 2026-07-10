/**
 * apps/mobile/app/session/finish.tsx
 *
 * Finish summary (D-27): big Display-size session HSS, a per-exercise volume/set-count
 * list, and the full engine warnings list (D-29). "Done" calls `finishWorkout` (D-14
 * invariant — see lib/finishWorkout.ts) then returns to the tabs. Discard lives behind a
 * "•••" menu deliberately NOT adjacent to Done — opens a confirm dialog with the exact
 * UI-SPEC copy; confirming calls `discardWorkout` (soft delete, D-28) and also returns to
 * tabs — the discarded session then never appears in history or any HSS/load computation.
 *
 * This screen re-derives the summary straight from SQLite (never from `sessionStore`):
 * the D-14 "Finish Now" crash-resume path navigates here WITHOUT ever mounting
 * session.tsx, so the store may be empty/stale on arrival — the persisted `strength_set`
 * rows are the only reliable source for both entry paths (D-13: SQLite is truth).
 */

import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, enduranceSegment, exercise as exerciseTable, strengthSet, workout } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import {
  formatPaceMinSec,
  kgToDisplayLb,
  kmToDisplayMi,
  paceSecPerKmToSecPerMi,
  type CarrySet,
  type StrengthSet,
  type Units,
} from '@apsis/shared';

import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';
import { fetchProfileSummary } from '../../lib/commitSet';
import { discardWorkout, finishWorkout } from '../../lib/finishWorkout';
import { useSessionStore } from '../../stores/sessionStore';

const DISCARD_MESSAGE =
  "Discard this workout? All logged sets will be removed and can't be recovered from the app.";

interface ExerciseSummary {
  exerciseId: string;
  name: string;
  entryMode: 'reps' | 'timed';
  setCount: number;
  volumeKg: number;
  totalDurationS: number;
}

function isLowerBody(bodyPart: string | null): boolean {
  return bodyPart === 'lower';
}

// Volume respects the profile unit preference (checkpoint QoL fix). Whole-lb rounding for
// this read-only summary follows the D-12 convention (same as the LAST lines).
function formatVolume(volumeKg: number, units: Units): string {
  return units === 'imperial'
    ? `${kgToDisplayLb(volumeKg)} lb volume`
    : `${Math.round(volumeKg)} kg volume`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} total`;
}

// Compact h:mm:ss / m:ss duration for the endurance summary line (no " total" suffix,
// since it's one segment of a "distance · pace · duration" compound line) — same
// h>0-branch convention as @apsis/shared's parseDurationDigits display format.
function formatSessionDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Builds the per-type endurance summary line (RUN-06, 04-UI-SPEC.md section 8): run/erg show
// distance + pace + duration; conditioning shows duration + AVG HR only (D-16, no distance/pace
// concept for conditioning).
function formatEnduranceSummary(
  activityType: 'run' | 'erg' | 'conditioning' | 'sled' | 'other',
  distanceM: number | null,
  durationS: number,
  avgHr: number | null,
  units: Units
): string {
  const durationLabel = formatSessionDuration(durationS);

  if (activityType === 'conditioning') {
    return avgHr != null ? `${durationLabel} · ${avgHr} BPM` : durationLabel;
  }

  if (activityType === 'erg') {
    const pace = distanceM != null && distanceM > 0 ? durationS / (distanceM / 500) : null;
    const distanceLabel = distanceM != null ? `${Math.round(distanceM)} M` : null;
    const paceLabel = pace != null ? `${formatPaceMinSec(pace)} /500M` : null;
    return [distanceLabel, paceLabel, durationLabel].filter(Boolean).join(' · ');
  }

  // run (and any other segment types default to the run-style distance/pace/duration format)
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

export default function FinishScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = params.workoutId;
  const router = useRouter();
  const reset = useSessionStore((s) => s.reset);

  const [hss, setHss] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [units, setUnits] = useState<Units>('metric');
  const [exerciseSummaries, setExerciseSummaries] = useState<ExerciseSummary[]>([]);
  const [enduranceSummaryLine, setEnduranceSummaryLine] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await fetchProfileSummary(db);

        const workoutRows = await db
          .select({ type: workout.type })
          .from(workout)
          .where(eq(workout.id, workoutId));
        const workoutType = workoutRows[0]?.type ?? 'strength';

        if (workoutType === 'endurance') {
          // RUN-06: re-derive the endurance summary straight from SQLite (never from a
          // store, matching this screen's D-14 invariant) — the run-save flow never mounts
          // a persistent session store the way lifting does.
          const segmentRows = await db
            .select({
              activityType: enduranceSegment.activityType,
              distanceM: enduranceSegment.distanceM,
              durationS: enduranceSegment.durationS,
              avgHr: enduranceSegment.avgHr,
              intensityFactor: enduranceSegment.intensityFactor,
            })
            .from(enduranceSegment)
            .where(eq(enduranceSegment.workoutId, workoutId));

          const result = sessionHSSDetailed({
            enduranceSegments: segmentRows.map((row) => ({
              durationS: row.durationS,
              intensityFactor: row.intensityFactor ?? 1.0,
            })),
          });

          const firstSegment = segmentRows[0];
          const summaryLine = firstSegment
            ? formatEnduranceSummary(
                firstSegment.activityType,
                firstSegment.distanceM,
                firstSegment.durationS,
                firstSegment.avgHr,
                profile.units
              )
            : null;

          if (!cancelled) {
            setHss(result.hss);
            setWarnings(result.warnings);
            setUnits(profile.units);
            setExerciseSummaries([]);
            setEnduranceSummaryLine(summaryLine);
          }
          return;
        }

        // strength (and hybrid) — existing per-exercise summary path, unchanged.
        const rows = await db
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

        const strengthSets: StrengthSet[] = [];
        const carrySets: CarrySet[] = [];
        const byExercise = new Map<string, ExerciseSummary>();

        for (const row of rows) {
          let summary = byExercise.get(row.exerciseId);
          if (!summary) {
            summary = {
              exerciseId: row.exerciseId,
              name: row.exerciseName,
              entryMode: (row.entryMode ?? 'reps') as 'reps' | 'timed',
              setCount: 0,
              volumeKg: 0,
              totalDurationS: 0,
            };
            byExercise.set(row.exerciseId, summary);
          }
          summary.setCount += 1;

          if (row.entryMode === 'timed') {
            if (!row.isWarmup) summary.totalDurationS += row.durationS ?? 0;
            carrySets.push({
              loadKg: row.loadKg,
              bodyweightKg: profile.bodyweightKg,
              durationS: row.durationS ?? 0,
              rpe: row.rpe ?? 0,
              isWarmup: row.isWarmup ?? false,
            });
          } else {
            if (!row.isWarmup) summary.volumeKg += row.loadKg * row.reps;
            strengthSets.push({
              loadKg: row.loadKg,
              reps: row.reps,
              rpe: row.rpe ?? 0,
              e1rmKg: row.e1rmKg ?? 0,
              isLowerBody: isLowerBody(row.bodyPart),
              isWarmup: row.isWarmup ?? false,
            });
          }
        }

        const result = sessionHSSDetailed({ strengthSets, carrySets });
        if (!cancelled) {
          setHss(result.hss);
          setWarnings(result.warnings);
          setUnits(profile.units);
          setExerciseSummaries(Array.from(byExercise.values()));
          setEnduranceSummaryLine(null);
        }
      } catch (err: unknown) {
        console.error('[Apsis] finish.tsx summary query failed:', err);
        if (!cancelled) setHss(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  async function handleDone(): Promise<void> {
    if (!workoutId || busy) return;
    setBusy(true);
    try {
      await finishWorkout(db, workoutId, new Date());
    } catch (err: unknown) {
      console.error('[Apsis] finishWorkout failed:', err);
    } finally {
      setBusy(false);
    }
    reset();
    router.replace('/(tabs)/log');
  }

  async function handleConfirmDiscard(): Promise<void> {
    if (!workoutId || busy) return;
    setBusy(true);
    try {
      await discardWorkout(db, workoutId, new Date());
    } catch (err: unknown) {
      console.error('[Apsis] discardWorkout failed:', err);
    } finally {
      setBusy(false);
    }
    setConfirmOpen(false);
    reset();
    router.replace('/(tabs)/log');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.menuRow}>
        <Pressable
          onPress={() => setMenuOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          hitSlop={8}
          style={styles.menuButton}>
          <Text style={styles.menuGlyph}>•••</Text>
        </Pressable>
      </View>

      {menuOpen ? (
        <>
          <Pressable
            style={styles.menuBackdrop}
            accessibilityLabel="Close menu"
            onPress={() => setMenuOpen(false)}
          />
          <View style={styles.menuDropdown}>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Discard Workout"
              style={styles.menuItem}>
              <Text style={styles.menuItemLabel}>Discard workout</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Session Complete</Text>
        <Text style={[styles.hss, tabularNums]}>{hss == null ? '—' : Math.round(hss)}</Text>

        {enduranceSummaryLine != null ? (
          <View style={styles.exerciseRow}>
            <Text style={styles.exerciseMeta}>{enduranceSummaryLine}</Text>
          </View>
        ) : (
          exerciseSummaries.map((summary) => (
            <View key={summary.exerciseId} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>{summary.name}</Text>
              <Text style={styles.exerciseMeta}>
                {`${summary.setCount} set${summary.setCount === 1 ? '' : 's'}`}
              </Text>
              <Text style={styles.exerciseMeta}>
                {summary.entryMode === 'timed'
                  ? formatDuration(summary.totalDurationS)
                  : formatVolume(summary.volumeKg, units)}
              </Text>
            </View>
          ))
        )}

        {warnings.length > 0 ? (
          <View style={styles.warningsSection}>
            <Text style={styles.warningsHeading}>Warnings</Text>
            {warnings.map((warning, index) => (
              <Text key={index} style={styles.warningItem}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={handleDone}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Done"
        accessibilityState={{ disabled: busy }}
        style={({ pressed }) => [
          styles.button,
          busy && styles.buttonDisabled,
          pressed && !busy && styles.buttonPressed,
        ]}>
        <Text style={[styles.buttonLabel, busy && styles.buttonLabelDisabled]}>Done</Text>
      </Pressable>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>{DISCARD_MESSAGE}</Text>
            <View style={styles.modalButtonColumn}>
              <Pressable
                onPress={() => setConfirmOpen(false)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Keep Training"
                style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryLabel}>Keep training</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmDiscard}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Discard Workout"
                style={styles.modalDestructiveButton}>
                <Text style={styles.modalDestructiveLabel}>Discard workout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
  },
  menuButton: {
    minWidth: HIT_TARGET_MIN,
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: {
    ...Typography.body,
    color: Colors.dark.mutedText,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  menuDropdown: {
    position: 'absolute',
    top: HIT_TARGET_MIN + Spacing.sm,
    right: Spacing.lg,
    zIndex: 2,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xs,
    minWidth: 180,
  },
  menuItem: {
    minHeight: HIT_TARGET_MIN,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  menuItemLabel: {
    ...Typography.body,
    color: Colors.dark.destructive,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  label: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  hss: {
    ...Typography.display,
    color: Colors.dark.accent,
    marginBottom: Spacing.xxxl,
  },
  exerciseRow: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    paddingVertical: Spacing.sm,
  },
  exerciseName: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  exerciseMeta: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  warningsSection: {
    width: '100%',
    marginTop: Spacing.xxl,
  },
  warningsHeading: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  warningItem: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.xs,
  },
  button: {
    minHeight: 48,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
  modalMessage: {
    ...Typography.body,
    color: Colors.dark.text,
    marginBottom: Spacing.xl,
  },
  modalButtonColumn: {
    gap: Spacing.sm,
  },
  modalSecondaryButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  modalDestructiveButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDestructiveLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
