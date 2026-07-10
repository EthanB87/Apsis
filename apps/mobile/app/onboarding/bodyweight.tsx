/**
 * apps/mobile/app/onboarding/bodyweight.tsx — wizard step 3 of 6 (D-01)
 *
 * Numeric entry honoring the draft's unit preference (kg direct, or lb converted to
 * exact kg via lbToKgExact for storage — D-05). Soft validation (D-03): accept any
 * numeric input, show an inline out-of-range warning (30-250 kg plausible band), but
 * never block Continue on range alone — only an empty/non-numeric field disables it.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { kgToDisplayLb, lbToKgExact } from '@apsis/shared';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import Colors from '../../constants/Colors';
import { Spacing, Typography, tabularNums } from '../../constants/theme';

const MIN_PLAUSIBLE_KG = 30;
const MAX_PLAUSIBLE_KG = 250;

export default function BodyweightStep(): React.JSX.Element {
  const router = useRouter();
  const units = useOnboardingDraft((state) => state.units);
  const bodyweightKg = useOnboardingDraft((state) => state.bodyweightKg);
  const setBodyweightKg = useOnboardingDraft((state) => state.setBodyweightKg);

  // WR-08: seed the input from the draft so re-entering this step (the review screen's
  // D-04 tap-to-edit path) shows the previously entered value — same pattern as the
  // threshold-hr/threshold-pace steps. Rendered as rounded display units.
  const seededText =
    bodyweightKg != null
      ? units === 'imperial'
        ? String(kgToDisplayLb(bodyweightKg))
        : String(Math.round(bodyweightKg * 10) / 10)
      : '';
  const [text, setText] = useState(seededText);

  const parsed = Number(text);
  const isValidNumber = text.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
  const kgValue = isValidNumber ? (units === 'imperial' ? lbToKgExact(parsed) : parsed) : null;
  const outOfRange = kgValue != null && (kgValue < MIN_PLAUSIBLE_KG || kgValue > MAX_PLAUSIBLE_KG);

  function handleChangeText(next: string): void {
    // Soft validation (D-03): strip non-numeric characters only — never block typing
    // based on the plausible-range check, that's surfaced as a warning, not a block.
    setText(next.replace(/[^0-9.]/g, ''));
  }

  function handleNext(): void {
    // If the seeded display text was left unedited, keep the exact stored kg rather
    // than round-tripping the rounded display back to metric (D-12 exact round-trip —
    // same guard as the Settings bodyweight editor).
    const unedited = seededText !== '' && text === seededText;
    if (kgValue != null && !unedited) {
      setBodyweightKg(kgValue);
    }
    router.push('/onboarding/threshold-hr');
  }

  return (
    <WizardStep
      step="bodyweight"
      question="What's your bodyweight?"
      onNext={handleNext}
      nextDisabled={!isValidNumber}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={Colors.dark.mutedText}
          autoFocus
          accessibilityLabel="Bodyweight"
        />
        <Text style={styles.unitLabel}>{units === 'imperial' ? 'lb' : 'kg'}</Text>
      </View>
      {outOfRange ? (
        <Text style={styles.warning} accessibilityRole="alert">
          That looks unusual — are you sure?
        </Text>
      ) : null}
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  input: {
    ...Typography.display,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  unitLabel: {
    ...Typography.heading,
    color: Colors.dark.mutedText,
  },
  warning: {
    ...Typography.label,
    color: Colors.dark.warning,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
