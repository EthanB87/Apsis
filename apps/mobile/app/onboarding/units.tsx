/**
 * apps/mobile/app/onboarding/units.tsx — wizard step 2 of 6 (D-01/D-02/D-05)
 *
 * Single metric/imperial choice sets all three unit buckets at once via
 * `setAllUnits` (the fast one-tap path, matching the schema's legacy `units` enum
 * shape). A third "Mixed" option reveals three inline toggles — Lifts / Bodyweight /
 * Runs — so a user can independently pick imperial lifts alongside km runs (the
 * literal beta complaint, D-02). Storage always stays metric (ONB-04) — this only
 * sets the display preference, changeable later in Settings (D-05).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Units } from '@apsis/shared';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';

type Mode = 'metric' | 'imperial' | 'mixed';

const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string; sub: string }> = [
  { value: 'metric', label: 'Metric', sub: 'km, kg' },
  { value: 'imperial', label: 'Imperial', sub: 'mi, lb' },
  { value: 'mixed', label: 'Mixed', sub: 'choose per type' },
];

const BUCKET_OPTIONS: ReadonlyArray<{ value: Units; label: string }> = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

/** All three buckets already agree -> that single value is the active mode; otherwise Mixed. */
function deriveInitialMode(liftsUnits: Units, bodyweightUnits: Units, runUnits: Units): Mode {
  if (liftsUnits === bodyweightUnits && bodyweightUnits === runUnits) {
    return liftsUnits;
  }
  return 'mixed';
}

export default function UnitsStep(): React.JSX.Element {
  const router = useRouter();
  const liftsUnits = useOnboardingDraft((state) => state.liftsUnits);
  const bodyweightUnits = useOnboardingDraft((state) => state.bodyweightUnits);
  const runUnits = useOnboardingDraft((state) => state.runUnits);
  const setAllUnits = useOnboardingDraft((state) => state.setAllUnits);
  const setLiftsUnits = useOnboardingDraft((state) => state.setLiftsUnits);
  const setBodyweightUnits = useOnboardingDraft((state) => state.setBodyweightUnits);
  const setRunUnits = useOnboardingDraft((state) => state.setRunUnits);

  const [mode, setMode] = useState<Mode>(() =>
    deriveInitialMode(liftsUnits, bodyweightUnits, runUnits),
  );

  function handleModePress(next: Mode): void {
    setMode(next);
    if (next !== 'mixed') {
      setAllUnits(next);
    }
  }

  return (
    <WizardStep
      step="units"
      question="Which units do you use?"
      onNext={() => router.push('/onboarding/bodyweight')}>
      <View style={styles.options}>
        {MODE_OPTIONS.map((option) => {
          const selected = mode === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleModePress(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}, ${option.sub}`}
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
              <Text style={[styles.optionSub, selected && styles.optionLabelSelected]}>
                {option.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'mixed' ? (
        <View style={styles.mixedSection}>
          <UnitBucketRow label="Lifts" value={liftsUnits} onChange={setLiftsUnits} />
          <UnitBucketRow label="Bodyweight" value={bodyweightUnits} onChange={setBodyweightUnits} />
          <UnitBucketRow label="Runs" value={runUnits} onChange={setRunUnits} />
        </View>
      ) : null}
    </WizardStep>
  );
}

function UnitBucketRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Units;
  onChange: (units: Units) => void;
}): React.JSX.Element {
  return (
    <View style={styles.bucketRow}>
      <Text style={styles.bucketLabel}>{label}</Text>
      <View style={styles.bucketToggle}>
        {BUCKET_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityState={{ selected }}
              style={[styles.bucketOption, selected && styles.bucketOptionSelected]}>
              <Text
                style={[styles.bucketOptionLabel, selected && styles.bucketOptionLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    width: '100%',
    gap: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  option: {
    minHeight: HIT_TARGET_MIN + 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  // Bone active-fill (not volt): the WizardStep "Continue" button below is already the
  // one volt-filled element on this screen (DESIGN-SYSTEM.md §7 one-volt-per-screen rule).
  optionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  optionLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  optionLabelSelected: {
    color: Colors.dark.onAccent,
  },
  optionSub: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  mixedSection: {
    width: '100%',
    marginTop: Spacing.xl,
    gap: Spacing.lg,
  },
  bucketRow: {
    gap: Spacing.sm,
  },
  bucketLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  bucketToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bucketOption: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bone active-fill (not volt) — matches the mode-option rule above.
  bucketOptionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  bucketOptionLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  bucketOptionLabelSelected: {
    color: Colors.dark.onAccent,
  },
});
