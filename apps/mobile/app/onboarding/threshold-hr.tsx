/**
 * apps/mobile/app/onboarding/threshold-hr.tsx — wizard step 4 of 6 (D-01/D-02)
 *
 * Two paths per D-02: "I know my numbers" (direct bpm entry) or "Estimate for me"
 * (max HR x0.90, or the age-based fallback (220-age) x0.90 when max HR isn't known).
 * Soft validation (D-03): out-of-range values (100-220 bpm) show a warning but never
 * block Continue — only an empty/non-numeric result disables it.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import { thresholdHrFromMax, thresholdHrFromAge } from '../../lib/thresholdEstimates';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';

const MIN_PLAUSIBLE_HR = 100;
const MAX_PLAUSIBLE_HR = 220;

type Mode = 'direct' | 'estimate';
type EstimateSource = 'maxHr' | 'age';

export default function ThresholdHrStep(): React.JSX.Element {
  const router = useRouter();
  const thresholdHr = useOnboardingDraft((state) => state.thresholdHr);
  const thresholdHrEstimated = useOnboardingDraft((state) => state.thresholdHrEstimated);
  const setThresholdHr = useOnboardingDraft((state) => state.setThresholdHr);

  const [mode, setMode] = useState<Mode>(thresholdHrEstimated ? 'estimate' : 'direct');
  const [estimateSource, setEstimateSource] = useState<EstimateSource>('maxHr');
  const [directText, setDirectText] = useState(
    thresholdHr != null && !thresholdHrEstimated ? String(thresholdHr) : '',
  );
  const [maxHrText, setMaxHrText] = useState('');
  const [ageText, setAgeText] = useState('');

  const directParsed = Number(directText);
  const directValid = directText.trim().length > 0 && Number.isFinite(directParsed) && directParsed > 0;

  const maxHrParsed = Number(maxHrText);
  const maxHrValid = maxHrText.trim().length > 0 && Number.isFinite(maxHrParsed) && maxHrParsed > 0;

  const ageParsed = Number(ageText);
  const ageValid = ageText.trim().length > 0 && Number.isFinite(ageParsed) && ageParsed > 0;

  let resultHr: number | null = null;
  let resultEstimated = false;

  if (mode === 'direct') {
    resultHr = directValid ? Math.round(directParsed) : null;
  } else if (estimateSource === 'maxHr') {
    resultHr = maxHrValid ? thresholdHrFromMax(maxHrParsed) : null;
    resultEstimated = true;
  } else {
    resultHr = ageValid ? thresholdHrFromAge(ageParsed) : null;
    resultEstimated = true;
  }

  const outOfRange = resultHr != null && (resultHr < MIN_PLAUSIBLE_HR || resultHr > MAX_PLAUSIBLE_HR);

  function stripToDigits(setter: (next: string) => void) {
    return (next: string) => setter(next.replace(/[^0-9]/g, ''));
  }

  function handleNext(): void {
    if (resultHr != null) {
      setThresholdHr(resultHr, resultEstimated);
    }
    router.push('/onboarding/threshold-pace');
  }

  return (
    <WizardStep
      step="threshold-hr"
      question="What's your threshold heart rate?"
      onNext={handleNext}
      nextDisabled={resultHr == null}>
      <View style={styles.modeRow}>
        <ModeButton label="I know my numbers" selected={mode === 'direct'} onPress={() => setMode('direct')} />
        <ModeButton label="Estimate for me" selected={mode === 'estimate'} onPress={() => setMode('estimate')} />
      </View>

      {mode === 'direct' ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={directText}
            onChangeText={stripToDigits(setDirectText)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.dark.mutedText}
            autoFocus
            accessibilityLabel="Threshold heart rate"
          />
          <Text style={styles.unitLabel}>bpm</Text>
        </View>
      ) : (
        <>
          <View style={styles.modeRow}>
            <ModeButton
              label="I know my max HR"
              selected={estimateSource === 'maxHr'}
              onPress={() => setEstimateSource('maxHr')}
            />
            <ModeButton
              label="Use my age instead"
              selected={estimateSource === 'age'}
              onPress={() => setEstimateSource('age')}
            />
          </View>
          {estimateSource === 'maxHr' ? (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={maxHrText}
                onChangeText={stripToDigits(setMaxHrText)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.dark.mutedText}
                accessibilityLabel="Max heart rate"
              />
              <Text style={styles.unitLabel}>bpm max</Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={ageText}
                onChangeText={stripToDigits(setAgeText)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.dark.mutedText}
                accessibilityLabel="Age"
              />
              <Text style={styles.unitLabel}>years old</Text>
            </View>
          )}
          {resultHr != null ? (
            <Text style={styles.estimatePreview}>{`Estimated threshold HR: ${resultHr} bpm`}</Text>
          ) : null}
        </>
      )}

      {outOfRange ? (
        <Text style={styles.warning} accessibilityRole="alert">
          That looks unusual — are you sure?
        </Text>
      ) : null}
    </WizardStep>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.modeButton, selected && styles.modeButtonSelected]}>
      <Text style={[styles.modeButtonLabel, selected && styles.modeButtonLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  modeButton: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  modeButtonSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accent,
  },
  modeButtonLabel: {
    ...Typography.label,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  modeButtonLabelSelected: {
    color: Colors.dark.onAccent,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
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
  estimatePreview: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  warning: {
    ...Typography.label,
    color: Colors.dark.warning,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
