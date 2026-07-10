/**
 * apps/mobile/components/session/SetRow.tsx
 *
 * A single set's entry row (D-06/D-08/D-09): mono tabular-nums load/reps values flanked by
 * compact 24x24 -/+ steppers (44pt hit target via hitSlop, DESIGN-SYSTEM.md §5/§7), a
 * tap-to-open numeric keypad on the value itself (a plain TextInput — tapping it opens the
 * OS keyboard, no custom modal), an inline never-modal RPE 6-10 stepper pre-selected to the
 * exercise's last-used RPE, a leading neutral "W" warmup chip, and a trailing 32x32 checkmark
 * (44pt hit target via hitSlop) that commits/uncommits the set via `lib/commitSet.ts` (D-13
 * persist-then-recompute / D-09 uncheck-undoes).
 *
 * Layout (UAT Test 9 gap closure, Plan 03-10 — the plan's DELIBERATE two-line fallback,
 * activated by on-device checkpoint feedback: the single-line variant's ~326pt intrinsic
 * width overflowed the card on the tester's device, pushing the checkmark off-screen and
 * colliding with the swipe-delete panel):
 *   line 1 (values): W chip · load stepper group · reps-or-duration stepper group, at FIXED
 *     column widths (SET_ROW_* exports) that ExerciseCard's mono column-header row mirrors
 *     exactly so the unit labels sit over their columns;
 *   line 2 (actions): inline mono "RPE" caption + RPE stepper group · commit checkmark,
 *     right-aligned;
 *   then effective-load / commit-error / warning annotations as explicit rows beneath.
 * These are explicit rows — never the wrap-on-overflow property. Small visual control sizes
 * plus hitSlop supply the 44pt touch target (DESIGN-SYSTEM.md §7). The container paints the
 * card surface color so the swipe-to-delete action panel behind it can never show through.
 * (See .planning/debug/session-logger-ui-spacing.md for the original overflow defect.)
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '@apsis/db';
import { carryStressDetailed, estimateE1RM, estimateE1RMFromRepMaxTable, strengthStressDetailed } from '@apsis/engine';
import { kgToDisplayLbFractional, lbToKgExact, type Units } from '@apsis/shared';

import Colors from '../../constants/Colors';
import { Mono, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';
import { computeEffectiveLoad } from '../../lib/effectiveLoad';
import { commitSet, uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type SetDraft } from '../../stores/sessionStore';

/**
 * Fixed column geometry shared with ExerciseCard's column-header row — the header labels
 * (KG/LB · REPS/SEC) can only sit over their columns if both components use the same widths.
 */
export const SET_ROW_CHIP_WIDTH = 24;
export const SET_ROW_LOAD_GROUP_WIDTH = 112;
export const SET_ROW_VALUE_GROUP_WIDTH = 96;

const RPE_MIN = 6;
const RPE_MAX = 10;
const RPE_HEAT_THRESHOLD = 9;
const WEIGHT_STEP_KG = 2.5;
const WEIGHT_STEP_LB = 5;
const DURATION_STEP_S = 5;
const COMMIT_ERROR_MESSAGE = "Couldn't save that set. Nothing was lost — try the checkmark again.";

function formatWeightValue(kg: number, units: Units): string {
  // Fractional lb display (checkpoint fix): a typed "62.5" lb must re-display as 62.5,
  // never Math.round'd to 63 — storage was already the exact kg equivalent.
  const display = units === 'imperial' ? kgToDisplayLbFractional(kg) : Math.round(kg * 10) / 10;
  return Number.isInteger(display) ? String(display) : display.toFixed(1);
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
    // Fractional-aware stepping: ±5 lb from 62.5 lands on 67.5/57.5 — a whole-lb round
    // here would silently destroy an existing half-pound fraction.
    const nextLb = Math.max(0, kgToDisplayLbFractional(kg) + direction * WEIGHT_STEP_LB);
    return lbToKgExact(nextLb);
  }
  return Math.max(0, Math.round((kg + direction * WEIGHT_STEP_KG) * 10) / 10);
}

function stepRpe(rpe: number, direction: 1 | -1): number {
  return Math.min(RPE_MAX, Math.max(RPE_MIN, rpe + direction));
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
    <View style={styles.container}>
      <View style={styles.valuesRow}>
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

        <View style={[styles.fieldGroup, styles.loadGroup]}>
          <Pressable
            onPress={() => {
              setLoadText(null);
              patch({ loadFieldKg: stepWeight(draft.loadFieldKg, units, -1), isBlank: false });
            }}
            disabled={locked}
            hitSlop={10}
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
          <Pressable
            onPress={() => {
              setLoadText(null);
              patch({ loadFieldKg: stepWeight(draft.loadFieldKg, units, 1), isBlank: false });
            }}
            disabled={locked}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Increase load"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>

        {isTimed ? (
          <View style={[styles.fieldGroup, styles.valueGroup]}>
            <Pressable
              onPress={() =>
                patch({ durationS: Math.max(0, draft.durationS - DURATION_STEP_S), isBlank: false })
              }
              disabled={locked}
              hitSlop={10}
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
            <Pressable
              onPress={() => patch({ durationS: draft.durationS + DURATION_STEP_S, isBlank: false })}
              disabled={locked}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Increase duration"
              style={styles.stepper}>
              <Text style={styles.stepperLabel}>+</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.fieldGroup, styles.valueGroup]}>
            <Pressable
              onPress={() => patch({ reps: Math.max(0, draft.reps - 1), isBlank: false })}
              disabled={locked}
              hitSlop={10}
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
            <Pressable
              onPress={() => patch({ reps: draft.reps + 1, isBlank: false })}
              disabled={locked}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Increase reps"
              style={styles.stepper}>
              <Text style={styles.stepperLabel}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.actionsRow}>
        <View
          style={styles.fieldGroup}
          accessibilityRole="adjustable"
          accessibilityLabel="RPE"
          accessibilityValue={{ min: RPE_MIN, max: RPE_MAX, now: draft.rpe }}>
          <Text style={styles.rpeCaption}>RPE</Text>
          <Pressable
            onPress={() => patch({ rpe: stepRpe(draft.rpe, -1) })}
            disabled={locked || draft.rpe <= RPE_MIN}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Decrease RPE"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>-</Text>
          </Pressable>
          <Text
            style={[
              styles.rpeValue,
              tabularNums,
              draft.rpe >= RPE_HEAT_THRESHOLD && styles.rpeValueHeat,
            ]}>
            {draft.rpe}
          </Text>
          <Pressable
            onPress={() => patch({ rpe: stepRpe(draft.rpe, 1) })}
            disabled={locked || draft.rpe >= RPE_MAX}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Increase RPE"
            style={styles.stepper}>
            <Text style={styles.stepperLabel}>+</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleToggleCommit}
          disabled={committing}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={draft.committed ? 'Uncommit set' : 'Commit set'}
          accessibilityState={{ checked: draft.committed, disabled: committing }}
          style={[styles.checkmark, draft.committed && styles.checkmarkChecked]}>
          {draft.committed ? <Text style={styles.checkmarkGlyph}>✓</Text> : null}
        </Pressable>
      </View>

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
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    // Opaque row surface (matches the card): without this the swipe-to-delete action
    // panel rendered behind the Swipeable content shows through the row.
    backgroundColor: Colors.dark.surface,
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
  },
  warmupChip: {
    width: SET_ROW_CHIP_WIDTH,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.border,
  },
  // Visual size stays small; hitSlop above brings the touchable area to the 44x44
  // minimum (DESIGN-SYSTEM.md §7 hard rule).
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
  // Fixed group widths (mirrored by ExerciseCard's column-header labels); the value
  // TextInput flexes to fill the space between the two 24px steppers.
  loadGroup: {
    width: SET_ROW_LOAD_GROUP_WIDTH,
  },
  valueGroup: {
    width: SET_ROW_VALUE_GROUP_WIDTH,
  },
  // Compact stepper visual (DESIGN-SYSTEM.md §5 "Steppers for LOAD KG / REPS / RPE"): the
  // 44px hit target comes from hitSlop={10} on the Pressable, not this box's own size.
  stepper: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.steel,
  },
  stepperLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 14,
    lineHeight: 16,
    color: Colors.dark.text,
  },
  valueInput: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    flex: 1,
  },
  rpeCaption: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  rpeValue: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 16,
    minWidth: 22,
    textAlign: 'center',
    color: Colors.dark.text,
  },
  rpeValueHeat: {
    color: Colors.dark.destructive,
  },
  // Compact commit checkmark: visual 32x32, hitSlop={6} brings the touchable area to 44x44.
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
