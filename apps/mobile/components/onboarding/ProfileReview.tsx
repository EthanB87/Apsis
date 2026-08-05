/**
 * apps/mobile/components/onboarding/ProfileReview.tsx
 *
 * Reusable review-and-save editor (D-04): a scrollable list of Label-caption +
 * Body-value rows, each row tappable to jump back to its source step for editing.
 * Estimated values (D-02 estimate paths) render a small "estimated" tag — the
 * "honest number" thesis extends to inputs, never presenting an estimate identically
 * to a directly-entered value.
 *
 * Purely presentational: takes values + callbacks as props only, no db/router import
 * inside it, so this same component backs both the onboarding review screen (this
 * plan) and the Settings profile editor (Plan 09, ONB-02).
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import type { Sex, Units } from '@apsis/shared';
import { kgToDisplayLb, paceSecPerKmToSecPerMi, formatPaceMinSec } from '@apsis/shared';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';

export interface ProfileReviewValues {
  sex: Sex | null;
  bodyweightKg: number | null;
  thresholdHr: number | null;
  thresholdPaceSecPerKm: number | null;
  units: Units;
  /** D-01: per-domain display buckets. Optional and fall back to `units` -- the onboarding
   * review screen only ever collects a single units choice (buckets don't diverge until a
   * later Settings edit), while a caller with split buckets (e.g. a future Settings editor)
   * can pass these to resolve bodyweight/pace independently. */
  bodyweightUnits?: Units;
  runUnits?: Units;
}

// bodyweightUnits/runUnits are display-resolution inputs, not editable rows -- excluded so
// callers' `Record<ProfileReviewField, ...>` maps (e.g. onboarding/review.tsx's FIELD_ROUTE)
// don't need an entry for them.
export type ProfileReviewField = keyof Omit<ProfileReviewValues, 'bodyweightUnits' | 'runUnits'>;

export interface ProfileReviewEstimatedFlags {
  thresholdHr?: boolean;
  thresholdPaceSecPerKm?: boolean;
}

export interface ProfileReviewProps {
  values: ProfileReviewValues;
  /** Which fields (if any) were derived via a D-02 estimate path — renders the "estimated" tag. */
  estimated?: ProfileReviewEstimatedFlags;
  /** Called with the field name when a row is tapped — caller decides where "edit" navigates. */
  onEditField: (field: ProfileReviewField) => void;
  primaryLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
  /** CR-01: hide the legacy "Units" row entirely. Defaults to true (onboarding review,
   * which has no split-bucket editor yet, still shows it). A caller with a dedicated
   * per-domain unit editor (e.g. Settings' three Lifts/Bodyweight/Runs rows, D-03)
   * should pass `false` so there is exactly one control per unit domain. */
  showUnitsRow?: boolean;
}

const SEX_LABEL: Record<Sex, string> = { male: 'Male', female: 'Female', other: 'Other' };

export function ProfileReview({
  values,
  estimated,
  onEditField,
  primaryLabel,
  onSubmit,
  submitting = false,
  errorMessage = null,
  showUnitsRow = true,
}: ProfileReviewProps): React.JSX.Element {
  const isImperial = values.units === 'imperial';
  // D-01: bodyweight resolves through bodyweightUnits, threshold pace through runUnits --
  // each falls back to the single `units` value when the caller hasn't split buckets yet.
  const bodyweightIsImperial = (values.bodyweightUnits ?? values.units) === 'imperial';
  const runIsImperial = (values.runUnits ?? values.units) === 'imperial';

  const bodyweightDisplay =
    values.bodyweightKg != null
      ? bodyweightIsImperial
        ? `${kgToDisplayLb(values.bodyweightKg)} lb`
        : `${Math.round(values.bodyweightKg)} kg`
      : '—';

  const thresholdPaceDisplay =
    values.thresholdPaceSecPerKm != null
      ? `${formatPaceMinSec(
          runIsImperial ? paceSecPerKmToSecPerMi(values.thresholdPaceSecPerKm) : values.thresholdPaceSecPerKm,
        )} ${runIsImperial ? '/mi' : '/km'}`
      : '—';

  const rows: Array<{ field: ProfileReviewField; label: string; value: string; estimated?: boolean }> = [
    { field: 'sex', label: 'Sex', value: values.sex != null ? SEX_LABEL[values.sex] : '—' },
    { field: 'bodyweightKg', label: 'Bodyweight', value: bodyweightDisplay },
    {
      field: 'thresholdHr',
      label: 'Threshold heart rate',
      value: values.thresholdHr != null ? `${values.thresholdHr} bpm` : '—',
      estimated: estimated?.thresholdHr,
    },
    {
      field: 'thresholdPaceSecPerKm',
      label: 'Threshold pace',
      value: thresholdPaceDisplay,
      estimated: estimated?.thresholdPaceSecPerKm,
    },
    ...(showUnitsRow
      ? [{ field: 'units' as const, label: 'Units', value: isImperial ? 'Imperial (mi, lb)' : 'Metric (km, kg)' }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {rows.map((row) => (
          <Pressable
            key={row.field}
            onPress={() => onEditField(row.field)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value}${row.estimated ? ', estimated' : ''}. Tap to edit.`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{row.label}</Text>
              <View style={styles.valueRow}>
                <Text style={styles.value}>{row.value}</Text>
                {row.estimated ? (
                  <View style={styles.estimatedTag}>
                    <Text style={styles.estimatedTagText}>estimated</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        accessibilityState={{ disabled: submitting }}
        style={({ pressed }) => [
          styles.button,
          submitting && styles.buttonDisabled,
          pressed && !submitting && styles.buttonPressed,
        ]}>
        {submitting ? (
          <ActivityIndicator color={Colors.dark.onAccent} />
        ) : (
          <Text style={styles.buttonLabel}>{primaryLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  row: {
    minHeight: HIT_TARGET_MIN + 12,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    justifyContent: 'center',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  value: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  estimatedTag: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    backgroundColor: Colors.dark.border,
  },
  estimatedTagText: {
    ...Typography.label,
    fontSize: 11,
    lineHeight: 14,
    color: Colors.dark.mutedText,
  },
  error: {
    ...Typography.label,
    color: Colors.dark.warning,
    textAlign: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  button: {
    minHeight: 48,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
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
});
