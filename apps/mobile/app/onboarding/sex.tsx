/**
 * apps/mobile/app/onboarding/sex.tsx — wizard step 1 of 6 (D-01)
 *
 * One question per screen: three big segment buttons -> draft.sex. Sex feeds engine
 * calibration downstream; captured here, reviewed/edited on the review screen (Plan 05).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Sex } from '@apsis/shared';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';

const OPTIONS: ReadonlyArray<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export default function SexStep(): React.JSX.Element {
  const router = useRouter();
  const sex = useOnboardingDraft((state) => state.sex);
  const setSex = useOnboardingDraft((state) => state.setSex);

  return (
    <WizardStep
      step="sex"
      question="What's your sex?"
      onNext={() => router.push('/onboarding/units')}
      nextDisabled={sex == null}>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = sex === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSex(option.value)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
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
    gap: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  option: {
    minHeight: HIT_TARGET_MIN + 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
});
