/**
 * apps/mobile/components/session/SetRow.tsx
 *
 * A single set's ledger row (D-06/D-08/D-09) — REDESIGNED under user-granted full creative
 * control at the Plan 03-10 checkpoint ("completely overhaul the UI... disregard any design
 * docs. The only thing I want to keep is the color palette"). DESIGN-SYSTEM.md's component
 * specs (inline -/+ steppers, compact visuals) are superseded for this surface; the color
 * palette remains binding.
 *
 * The design: one roomy tabular line per set — Strong/Hevy-class —
 *   SET (tap toggles warmup "W") · KG/LB field · REPS-or-SEC field · RPE field · LOG check
 * where every value is a tappable inset field opening the numeric keypad directly. No
 * steppers: typing two digits beats tapping +/- eight times, and stepper furniture is what
 * made every previous layout cramped. State is material: an uncommitted row renders raised
 * steel instrument fields; committing a set flattens its fields to recorded ink (borderless,
 * ash) and fills the LOG check volt — pending work is hot, recorded work recedes.
 *
 * Preserved behaviors (non-negotiable): per-set commit + lock (editable={!locked}, D-09),
 * tap-to-type decimal loads incl. fractional lb 62.5 (loadText local-state pattern, CR-02),
 * last-used RPE preselect + 6-10 clamp + molten at 9-10 (D-08), effective-load/commit-error/
 * warning annotation rows, D-13 persist-then-recompute via lib/commitSet.ts, rest-timer
 * start on commit (LIFT-05/D-25), 44pt touch targets, and no wrap-driven layout — every
 * line here is an explicit row.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '@apsis/db';
import { carryStressDetailed, estimateE1RM, estimateE1RMFromRepMaxTable, strengthStressDetailed } from '@apsis/engine';
import { kgToDisplayLbFractional, lbToKgExact, type Units } from '@apsis/shared';

import Colors from '../../constants/Colors';
import { Radius, Spacing } from '../../constants/theme';
import { computeEffectiveLoad } from '../../lib/effectiveLoad';
import { commitSet, uncommitSet } from '../../lib/commitSet';
import { useSessionStore, type SetDraft } from '../../stores/sessionStore';

/**
 * Ledger grid geometry shared with ExerciseCard's column-header row: fixed SET/RPE/LOG
 * column widths, equal-flex KG and REPS columns, and one shared gap. Both components build
 * the same grid, so the header labels always sit over their columns.
 */
export const SET_ROW_SET_COL = 28;
export const SET_ROW_RPE_COL = 52;
export const SET_ROW_LOG_COL = 44;
export const SET_ROW_GAP = Spacing.sm;
export const SET_ROW_H_PADDING = Spacing.lg;

const RPE_MIN = 6;
const RPE_MAX = 10;
const RPE_HEAT_THRESHOLD = 9;
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

function clampRpe(value: number): number {
  return Math.min(RPE_MAX, Math.max(RPE_MIN, value));
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
  // the parsed kg value on every change; the formatted value re-syncs on blur.
  const [loadText, setLoadText] = useState<string | null>(null);
  // Same local-text pattern for RPE: typing "10" must not be clamped at the intermediate
  // "1". The draft gets the clamped 6-10 value on blur; display falls back to the draft's
  // preselected last-used RPE (D-08).
  const [rpeText, setRpeText] = useState<string | null>(null);

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

  function commitRpeText(): void {
    if (rpeText != null) {
      const parsed = Number.parseInt(rpeText, 10);
      if (Number.isFinite(parsed)) {
        patch({ rpe: clampRpe(parsed) });
      }
    }
    setRpeText(null);
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

  const rpeHot = draft.rpe >= RPE_HEAT_THRESHOLD;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {/* SET column — the set's ledger number; tapping toggles warmup (amber "W"). */}
        <Pressable
          onPress={() => patch({ isWarmup: !draft.isWarmup })}
          disabled={locked}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Warmup"
          accessibilityState={{ selected: draft.isWarmup, disabled: locked }}
          style={styles.setCell}>
          <Text style={[styles.setCellLabel, draft.isWarmup && styles.setCellLabelWarmup]}>
            {draft.isWarmup ? 'W' : String(draft.setNumber)}
          </Text>
        </Pressable>

        {/* KG/LB column — tap-to-type decimal load. */}
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
          style={[styles.valueField, styles.flexField, locked && styles.valueFieldLocked]}
          accessibilityLabel={isBodyweight ? 'Added load' : 'Load'}
        />

        {/* REPS or SEC column. */}
        {isTimed ? (
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
            style={[styles.valueField, styles.flexField, locked && styles.valueFieldLocked]}
            accessibilityLabel="Duration in seconds"
          />
        ) : (
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
            style={[styles.valueField, styles.flexField, locked && styles.valueFieldLocked]}
            accessibilityLabel="Reps"
          />
        )}

        {/* RPE column — keypad entry, clamped to 6-10 on blur, molten at 9-10 (D-08). */}
        <TextInput
          value={rpeText ?? String(draft.rpe)}
          onChangeText={(text) => setRpeText(text.replace(/[^0-9]/g, '').slice(0, 2))}
          onBlur={commitRpeText}
          keyboardType="number-pad"
          editable={!locked}
          selectTextOnFocus
          style={[
            styles.valueField,
            styles.rpeField,
            locked && styles.valueFieldLocked,
            rpeHot && rpeText == null && styles.valueFieldHot,
          ]}
          accessibilityLabel="RPE"
        />

        {/* LOG column — per-set commit: persists + locks the set, updates the live HSS. */}
        <Pressable
          onPress={handleToggleCommit}
          disabled={committing}
          accessibilityRole="button"
          accessibilityLabel={draft.committed ? 'Uncommit set' : 'Commit set'}
          accessibilityState={{ checked: draft.committed, disabled: committing }}
          style={[styles.logCheck, draft.committed && styles.logCheckCommitted]}>
          <Text style={[styles.logCheckGlyph, draft.committed && styles.logCheckGlyphCommitted]}>
            ✓
          </Text>
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
    paddingHorizontal: SET_ROW_H_PADDING,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.xs,
    // Opaque row surface (matches the card): without this the swipe-to-delete action
    // panel rendered behind the Swipeable content shows through the row.
    backgroundColor: Colors.dark.surface,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SET_ROW_GAP,
  },
  setCell: {
    width: SET_ROW_SET_COL,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCellLabel: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 14,
    color: Colors.dark.mutedText,
    fontVariant: ['tabular-nums'],
  },
  setCellLabelWarmup: {
    color: Colors.dark.warning,
  },
  // The instrument field: inset steel, hairline edge, roomy mono value. Tapping it opens
  // the numeric keypad directly — this IS the entry affordance (no steppers).
  valueField: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    color: Colors.dark.text,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: Spacing.xs,
  },
  flexField: {
    flex: 1,
  },
  rpeField: {
    width: SET_ROW_RPE_COL,
  },
  // Committed = recorded ink: the field chrome flattens away and the value recedes to ash.
  // Pending sets stay "hot" instruments; the ledger reads at a glance.
  valueFieldLocked: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: Colors.dark.mutedText,
  },
  valueFieldHot: {
    color: Colors.dark.destructive,
  },
  logCheck: {
    width: SET_ROW_LOG_COL,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logCheckCommitted: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  logCheckGlyph: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.border,
  },
  logCheckGlyphCommitted: {
    color: Colors.dark.onAccent,
  },
  effectiveLoadLabel: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.5,
    color: Colors.dark.mutedText,
    paddingLeft: SET_ROW_SET_COL + SET_ROW_GAP,
  },
  errorLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 12,
    color: Colors.dark.destructive,
  },
  warningBadge: {
    width: 20,
    height: 20,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.warning,
    marginLeft: SET_ROW_SET_COL + SET_ROW_GAP,
  },
  warningBadgeGlyph: {
    fontSize: 12,
    color: Colors.dark.background,
  },
  warningMessage: {
    fontFamily: 'Archivo_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: Colors.dark.warning,
  },
});
