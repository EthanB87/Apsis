/**
 * apps/mobile/components/session/SetRow.tsx
 *
 * A single set's entry row (D-06/D-08/D-09): tabular-nums load/reps flanked by 44×44 -/+
 * steppers, a tap-to-open numeric keypad on the value itself (a plain TextInput — tapping
 * it opens the OS keyboard, no custom modal), an inline never-modal RPE 6·7·8·9·10 segment
 * control pre-selected to the exercise's last-used RPE, a leading neutral "W" warmup chip,
 * and a trailing 44×44 checkmark that commits/uncommits the set via `lib/commitSet.ts`
 * (D-13 persist-then-recompute / D-09 uncheck-undoes). Small controls (RPE pills, steppers)
 * use `hitSlop` to reach the 44×44 minimum touch target without inflating the row's visual
 * width past what fits a single horizontal row on a phone screen (UI-SPEC Spacing Scale —
 * Exceptions: "even where the visible glyph is small... still sits in a 44×44 touchable
 * area").
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '@apsis/db';
import { carryStressDetailed, estimateE1RM, estimateE1RMFromRepMaxTable, strengthStressDetailed } from '@apsis/engine';
import { kgToDisplayLb, lbToKgExact, formatPaceMinSec, type Units } from '@apsis/shared';

import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';
import { computeEffectiveLoad } from '../../lib/effectiveLoad';
import { commitSet, uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type SetDraft } from '../../stores/sessionStore';

const RPE_OPTIONS = [6, 7, 8, 9, 10] as const;
const WEIGHT_STEP_KG = 2.5;
const WEIGHT_STEP_LB = 5;
const DURATION_STEP_S = 5;
const COMMIT_ERROR_MESSAGE = "Couldn't save that set. Nothing was lost — try the checkmark again.";

function formatWeightValue(kg: number, units: Units): string {
  if (units === 'imperial') {
    return String(kgToDisplayLb(kg));
  }
  const rounded = Math.round(kg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function weightUnitLabel(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg';
}

function parseWeightInput(text: string, units: Units): number {
  const parsed = Number.parseFloat(text.replace(/[^0-9.]/g, ''));
  const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  return units === 'imperial' ? lbToKgExact(safe) : safe;
}

function stepWeight(kg: number, units: Units, direction: 1 | -1): number {
  if (units === 'imperial') {
    const nextLb = Math.max(0, kgToDisplayLb(kg) + direction * WEIGHT_STEP_LB);
    return lbToKgExact(nextLb);
  }
  return Math.max(0, Math.round((kg + direction * WEIGHT_STEP_KG) * 10) / 10);
}

export interface SetRowProps {
  exerciseId: string;
  exerciseBwFactor: number | null;
  entryMode: 'reps' | 'timed';
  set: SetDraft;
}

export function SetRow({
  exerciseId,
  exerciseBwFactor,
  entryMode,
  set: draft,
}: SetRowProps): React.JSX.Element {
  const workoutId = useSessionStore((s) => s.workoutId);
  const profileBodyweightKg = useSessionStore((s) => s.profileBodyweightKg);
  const units = useSessionStore((s) => s.units);
  const updateSetDraft = useSessionStore((s) => s.updateSetDraft);
  const setCommitted = useSessionStore((s) => s.setCommitted);
  const setLiveHss = useSessionStore((s) => s.setLiveHss);
  const startRestTimer = useSessionStore((s) => s.startRestTimer);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  // While the load field is being typed into, keep the raw text locally so the controlled
  // value isn't re-formatted on every keystroke (formatting "62." back to "62" silently
  // drops the decimal point, turning an intended 62.5 into 625). The draft still receives
  // the parsed kg value on every change; the formatted value re-syncs on blur/steppers.
  const [loadText, setLoadText] = useState<string | null>(null);

  const isTimed = entryMode === 'timed';
  const isBodyweight = exerciseBwFactor != null;
  // A committed set's fields are locked until unchecked (D-09) — editing them in place
  // without going through commitSet/uncommitSet would silently drift the UI away from the
  // persisted SQLite row that's the actual source of truth for the live HSS.
  const locked = draft.committed;
  const effectiveLoadKg = computeEffectiveLoad(
    { bwFactor: exerciseBwFactor },
    draft.loadFieldKg,
    profileBodyweightKg
  );

  // D-29: engine warnings carry no set id, so a committed set's own warnings are derived
  // by re-running the SAME per-set formula `commitSet.ts` uses (single-set input) rather
  // than trying to attribute a warning string out of the session-wide flat list. Warmups
  // never warn — they're excluded from HSS entirely, same as the real recompute.
  const setWarnings = useMemo<string[]>(() => {
    if (!draft.committed || draft.isWarmup) return [];
    if (isTimed) {
      return carryStressDetailed({
        loadKg: effectiveLoadKg,
        bodyweightKg: profileBodyweightKg,
        durationS: draft.durationS,
        rpe: draft.rpe,
        isWarmup: draft.isWarmup,
      }).warnings;
    }
    const e1rmKg = isBodyweight
      ? estimateE1RMFromRepMaxTable(effectiveLoadKg, draft.reps)
      : estimateE1RM(effectiveLoadKg, draft.reps);
    return strengthStressDetailed([
      {
        loadKg: effectiveLoadKg,
        reps: draft.reps,
        rpe: draft.rpe,
        e1rmKg,
        isLowerBody: false,
        isWarmup: draft.isWarmup,
      },
    ]).warnings;
  }, [
    draft.committed,
    draft.isWarmup,
    draft.reps,
    draft.rpe,
    draft.durationS,
    effectiveLoadKg,
    isTimed,
    isBodyweight,
    profileBodyweightKg,
  ]);
  const [warningExpanded, setWarningExpanded] = useState(false);

  function patch(fields: Partial<SetDraft>): void {
    updateSetDraft(exerciseId, draft.id, fields);
  }

  async function handleToggleCommit(): Promise<void> {
    if (!workoutId || committing) return;
    setCommitting(true);
    setCommitError(null);
    try {
      if (!draft.committed) {
        const result = await commitSet(db, {
          id: draft.id,
          workoutId,
          exercise: { id: exerciseId, bwFactor: exerciseBwFactor, entryMode },
          setNumber: draft.setNumber,
          reps: draft.reps,
          loadFieldKg: draft.loadFieldKg,
          rpe: draft.rpe,
          isWarmup: draft.isWarmup,
          durationS: draft.durationS,
          profileBodyweightKg,
        });
        setCommitted(exerciseId, draft.id, true);
        setLiveHss(result.hss, result.warnings);
        // LIFT-05/D-25: the auto-rest timer starts on a successful set commit, never on an
        // uncommit (unchecking undoes the set, it shouldn't also restart a rest period).
        startRestTimer(exerciseId).catch((err: unknown) => {
          console.error('[Apsis] startRestTimer failed:', err);
        });
      } else {
        const result = await uncommitSet(db, workoutId, draft.id, profileBodyweightKg);
        setCommitted(exerciseId, draft.id, false);
        setLiveHss(result.hss, result.warnings);
      }
    } catch (err: unknown) {
      console.error('[Apsis] commitSet/uncommitSet failed:', err);
      setCommitError(COMMIT_ERROR_MESSAGE);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => patch({ isWarmup: !draft.isWarmup })}
        disabled={locked}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Warmup"
        accessibilityState={{ selected: draft.isWarmup, disabled: locked }}
        style={[styles.warmupChip, draft.isWarmup && styles.warmupChipActive]}>
        <Text style={styles.warmupChipLabel}>W</Text>
      </Pressable>

      <View style={styles.fieldGroup}>
        <Pressable
          onPress={() => {
            setLoadText(null);
            patch({ loadFieldKg: stepWeight(draft.loadFieldKg, units, -1), isBlank: false });
          }}
          disabled={locked}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Decrease load"
          style={styles.stepper}>
          <Text style={styles.stepperLabel}>-</Text>
        </Pressable>
        <TextInput
          value={loadText ?? (draft.isBlank ? '' : formatWeightValue(draft.loadFieldKg, units))}
          placeholder="0"
          placeholderTextColor={Colors.dark.mutedText}
          onChangeText={(text) => {
            const clean = text.replace(/[^0-9.]/g, '');
            setLoadText(clean);
            patch({ loadFieldKg: parseWeightInput(clean, units), isBlank: false });
          }}
          onBlur={() => setLoadText(null)}
          keyboardType="decimal-pad"
          autoFocus={draft.isBlank}
          editable={!locked}
          selectTextOnFocus
          style={[styles.valueInput, tabularNums]}
          accessibilityLabel={isBodyweight ? 'Added load' : 'Load'}
        />
        <Text style={styles.unitLabel}>{weightUnitLabel(units)}</Text>
        <Pressable
          onPress={() => {
            setLoadText(null);
            patch({ loadFieldKg: stepWeight(draft.loadFieldKg, units, 1), isBlank: false });
          }}
          disabled={locked}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Increase load"
          style={styles.stepper}>
          <Text style={styles.stepperLabel}>+</Text>
        </Pressable>
      </View>

      {isTimed ? (
        <View style={styles.fieldGroup}>
          <Pressable
            onPress={() =>
              patch({ durationS: Math.max(0, draft.durationS - DURATION_STEP_S), isBlank: false })
            }
            disabled={locked}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Decrease duration"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>-</Text>
          </Pressable>
          <TextInput
            value={draft.isBlank ? '' : String(draft.durationS)}
            placeholder="0"
            placeholderTextColor={Colors.dark.mutedText}
            onChangeText={(text) => {
              const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
              patch({ durationS: Number.isFinite(parsed) ? parsed : 0, isBlank: false });
            }}
            keyboardType="number-pad"
            editable={!locked}
            selectTextOnFocus
            style={[styles.valueInput, tabularNums]}
            accessibilityLabel="Duration in seconds"
          />
          <Text style={styles.unitLabel}>{formatPaceMinSec(draft.durationS)}</Text>
          <Pressable
            onPress={() => patch({ durationS: draft.durationS + DURATION_STEP_S, isBlank: false })}
            disabled={locked}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Increase duration"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.fieldGroup}>
          <Pressable
            onPress={() => patch({ reps: Math.max(0, draft.reps - 1), isBlank: false })}
            disabled={locked}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Decrease reps"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>-</Text>
          </Pressable>
          <TextInput
            value={draft.isBlank ? '' : String(draft.reps)}
            placeholder="0"
            placeholderTextColor={Colors.dark.mutedText}
            onChangeText={(text) => {
              const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
              patch({ reps: Number.isFinite(parsed) ? parsed : 0, isBlank: false });
            }}
            keyboardType="number-pad"
            editable={!locked}
            selectTextOnFocus
            style={[styles.valueInput, tabularNums]}
            accessibilityLabel="Reps"
          />
          <Text style={styles.unitLabel}>reps</Text>
          <Pressable
            onPress={() => patch({ reps: draft.reps + 1, isBlank: false })}
            disabled={locked}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Increase reps"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.rpeRow} accessibilityRole="adjustable" accessibilityLabel="RPE">
        {RPE_OPTIONS.map((option) => {
          const selected = draft.rpe === option;
          const isHot = selected && option >= 9;
          return (
            <Pressable
              key={option}
              onPress={() => patch({ rpe: option })}
              disabled={locked}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`RPE ${option}`}
              accessibilityState={{ selected, disabled: locked }}
              style={[styles.rpePill, selected && (isHot ? styles.rpePillHeat : styles.rpePillSelected)]}>
              <Text style={[styles.rpePillLabel, selected && styles.rpePillLabelSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleToggleCommit}
        disabled={committing}
        accessibilityRole="button"
        accessibilityLabel={draft.committed ? 'Uncommit set' : 'Commit set'}
        accessibilityState={{ checked: draft.committed, disabled: committing }}
        style={[styles.checkmark, draft.committed && styles.checkmarkChecked]}>
        {draft.committed ? <Text style={styles.checkmarkGlyph}>✓</Text> : null}
      </Pressable>

      {isBodyweight ? (
        <Text style={styles.effectiveLoadLabel}>
          {`≈ ${formatWeightValue(effectiveLoadKg, units)} ${weightUnitLabel(units)} effective`}
        </Text>
      ) : null}

      {commitError ? <Text style={styles.errorLabel}>{commitError}</Text> : null}

      {setWarnings.length > 0 ? (
        <Pressable
          onPress={() => setWarningExpanded((open) => !open)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Warning: ${setWarnings.join('; ')}`}
          style={styles.warningBadge}>
          <Text style={styles.warningBadgeGlyph}>⚠</Text>
        </Pressable>
      ) : null}

      {setWarnings.length > 0 && warningExpanded ? (
        <Text style={styles.warningMessage}>{setWarnings.join(' ')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: HIT_TARGET_MIN,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  warmupChip: {
    minWidth: 24,
    height: 24,
    borderRadius: 6,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.border,
  },
  // Visual size stays small ("small W chip" per UI-SPEC Component Notes); hitSlop below
  // brings the touchable area to the 44x44 minimum (Spacing Scale Exceptions).
  warmupChipActive: {
    backgroundColor: Colors.dark.warning,
  },
  warmupChipLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  fieldGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepper: {
    width: HIT_TARGET_MIN,
    height: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.steel,
  },
  stepperLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  valueInput: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 19,
    fontWeight: '600',
    color: Colors.dark.text,
    minWidth: 40,
    textAlign: 'center',
    paddingVertical: 0,
  },
  unitLabel: {
    ...Mono,
    fontSize: 9,
    color: Colors.dark.mutedText,
  },
  rpeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  rpePill: {
    minWidth: HIT_TARGET_MIN,
    height: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.border,
  },
  rpePillSelected: {
    backgroundColor: Colors.dark.accent,
  },
  rpePillHeat: {
    backgroundColor: Colors.dark.destructive,
  },
  rpePillLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  rpePillLabelSelected: {
    color: Colors.dark.onAccent,
  },
  checkmark: {
    width: HIT_TARGET_MIN,
    height: HIT_TARGET_MIN,
    borderRadius: HIT_TARGET_MIN / 2,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkChecked: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  checkmarkGlyph: {
    color: Colors.dark.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  effectiveLoadLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
    width: '100%',
  },
  errorLabel: {
    ...Typography.label,
    color: Colors.dark.destructive,
    width: '100%',
  },
  warningBadge: {
    width: 20,
    height: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.warning,
  },
  warningBadgeGlyph: {
    fontSize: 12,
    color: Colors.dark.background,
  },
  warningMessage: {
    ...Typography.label,
    color: Colors.dark.warning,
    width: '100%',
  },
});
