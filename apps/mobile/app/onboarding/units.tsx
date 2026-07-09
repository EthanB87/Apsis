/**
 * apps/mobile/app/onboarding/units.tsx — wizard step 2 of 6 (D-01/D-05)
 *
 * Single metric/imperial choice -> draft.units, matching the schema's single
 * `user_profile.units` enum (covers both km<->mi and kg<->lb display together).
 * Storage always stays metric (ONB-04) — this only sets the display preference,
 * changeable later in Settings (D-05).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Units } from '@apsis/shared';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';

const OPTIONS: ReadonlyArray<{ value: Units; label: string; sub: string }> = [
  { value: 'metric', label: 'Metric', sub: 'km, kg' },
  { value: 'imperial', label: 'Imperial', sub: 'mi, lb' },
];

export default function UnitsStep(): React.JSX.Element {
  const router = useRouter();
  const units = useOnboardingDraft((state) => state.units);
  const setUnits = useOnboardingDraft((state) => state.setUnits);

  return (
    <WizardStep
      step="units"
      question="Which units do you use?"
      onNext={() => router.push('/onboarding/bodyweight')}>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = units === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setUnits(option.value)}
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
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  options: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  option: {
    minHeight: HIT_TARGET_MIN + 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  optionSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accent,
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
});
