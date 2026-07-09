/**
 * apps/mobile/app/onboarding/threshold-pace.tsx — wizard step 5 of 6 (D-01/D-02)
 *
 * Two paths per D-02: "I know my numbers" (direct mm:ss pace entry, honoring
 * draft.units) or "Estimate for me" (race-time picker: distance + finish time ->
 * thresholdPaceFromRace). Soft validation (D-03): out-of-range values (2:30-12:00
 * /km) show a warning but never block Continue. Storage is always sec/km (D-05);
 * imperial entry converts via paceSecPerMiToSecPerKm.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { paceSecPerMiToSecPerKm, paceSecPerKmToSecPerMi, formatPaceMinSec } from '@apsis/shared';
import { WizardStep } from '../../components/onboarding/WizardStep';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import { thresholdPaceFromRace, type RaceDistanceKey } from '../../lib/thresholdEstimates';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';

const MIN_PLAUSIBLE_SEC_PER_KM = 150; // 2:30 /km
const MAX_PLAUSIBLE_SEC_PER_KM = 720; // 12:00 /km

const RACE_OPTIONS: ReadonlyArray<{ value: RaceDistanceKey; label: string }> = [
  { value: '5k', label: '5K' },
  { value: '10k', label: '10K' },
  { value: 'half', label: 'Half' },
];

type Mode = 'direct' | 'estimate';

export default function ThresholdPaceStep(): React.JSX.Element {
  const router = useRouter();
  const units = useOnboardingDraft((state) => state.units);
  const thresholdPaceSecPerKm = useOnboardingDraft((state) => state.thresholdPaceSecPerKm);
  const thresholdPaceEstimated = useOnboardingDraft((state) => state.thresholdPaceEstimated);
  const setThresholdPaceSecPerKm = useOnboardingDraft((state) => state.setThresholdPaceSecPerKm);

  const [mode, setMode] = useState<Mode>(thresholdPaceEstimated ? 'estimate' : 'direct');

  // Direct-entry mm:ss, honoring draft.units for display.
  const initialDirectDisplaySec =
    thresholdPaceSecPerKm != null && !thresholdPaceEstimated
      ? units === 'imperial'
        ? paceSecPerKmToSecPerMi(thresholdPaceSecPerKm)
        : thresholdPaceSecPerKm
      : null;
  const [directMin, setDirectMin] = useState(
    initialDirectDisplaySec != null ? String(Math.floor(initialDirectDisplaySec / 60)) : '',
  );
  const [directSec, setDirectSec] = useState(
    initialDirectDisplaySec != null
      ? String(Math.round(initialDirectDisplaySec % 60)).padStart(2, '0')
      : '',
  );

  // Estimate: race distance + finish time.
  const [distanceKey, setDistanceKey] = useState<RaceDistanceKey>('5k');
  const [finishHr, setFinishHr] = useState('');
  const [finishMin, setFinishMin] = useState('');
  const [finishSec, setFinishSec] = useState('');

  const directMinVal = directMin.trim().length > 0 ? Number(directMin) : NaN;
  const directSecVal = directSec.trim().length > 0 ? Number(directSec) : 0;
  const directValid =
    Number.isFinite(directMinVal) &&
    directMinVal >= 0 &&
    Number.isFinite(directSecVal) &&
    directSecVal >= 0 &&
    directSecVal < 60 &&
    directMinVal * 60 + directSecVal > 0;
  const directTotalDisplaySec = directValid ? directMinVal * 60 + directSecVal : null;
  const directSecPerKm =
    directTotalDisplaySec != null
      ? units === 'imperial'
        ? paceSecPerMiToSecPerKm(directTotalDisplaySec)
        : directTotalDisplaySec
      : null;

  const finishHrVal = Number(finishHr) || 0;
  const finishMinVal = Number(finishMin) || 0;
  const finishSecVal = Number(finishSec) || 0;
  const totalFinishSec = finishHrVal * 3600 + finishMinVal * 60 + finishSecVal;
  const finishValid = totalFinishSec > 0;
  const estimateSecPerKm = finishValid ? thresholdPaceFromRace(distanceKey, totalFinishSec) : null;

  let resultSecPerKm: number | null = null;
  let resultEstimated = false;
  if (mode === 'direct') {
    resultSecPerKm = directSecPerKm;
  } else {
    resultSecPerKm = estimateSecPerKm;
    resultEstimated = true;
  }

  const outOfRange =
    resultSecPerKm != null &&
    (resultSecPerKm < MIN_PLAUSIBLE_SEC_PER_KM || resultSecPerKm > MAX_PLAUSIBLE_SEC_PER_KM);

  function stripToDigits(setter: (next: string) => void) {
    return (next: string) => setter(next.replace(/[^0-9]/g, ''));
  }

  function handleNext(): void {
    if (resultSecPerKm != null) {
      setThresholdPaceSecPerKm(resultSecPerKm, resultEstimated);
    }
    router.push('/onboarding/review');
  }

  const displayUnit = units === 'imperial' ? '/mi' : '/km';

  return (
    <WizardStep
      step="threshold-pace"
      question="What's your threshold pace?"
      onNext={handleNext}
      nextDisabled={resultSecPerKm == null}>
      <View style={styles.modeRow}>
        <ModeButton label="I know my numbers" selected={mode === 'direct'} onPress={() => setMode('direct')} />
        <ModeButton label="Estimate for me" selected={mode === 'estimate'} onPress={() => setMode('estimate')} />
      </View>

      {mode === 'direct' ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.paceInput}
            value={directMin}
            onChangeText={stripToDigits(setDirectMin)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={Colors.dark.mutedText}
            autoFocus
            accessibilityLabel="Pace minutes"
          />
          <Text style={styles.colon}>:</Text>
          <TextInput
            style={styles.paceInput}
            value={directSec}
            onChangeText={stripToDigits(setDirectSec)}
            keyboardType="number-pad"
            placeholder="00"
            placeholderTextColor={Colors.dark.mutedText}
            accessibilityLabel="Pace seconds"
          />
          <Text style={styles.unitLabel}>{displayUnit}</Text>
        </View>
      ) : (
        <>
          <View style={styles.modeRow}>
            {RACE_OPTIONS.map((option) => (
              <ModeButton
                key={option.value}
                label={option.label}
                selected={distanceKey === option.value}
                onPress={() => setDistanceKey(option.value)}
              />
            ))}
          </View>
          <Text style={styles.subLabel}>Finish time</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.paceInput}
              value={finishHr}
              onChangeText={stripToDigits(setFinishHr)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Finish time hours"
            />
            <Text style={styles.colon}>:</Text>
            <TextInput
              style={styles.paceInput}
              value={finishMin}
              onChangeText={stripToDigits(setFinishMin)}
              keyboardType="number-pad"
              placeholder="00"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Finish time minutes"
            />
            <Text style={styles.colon}>:</Text>
            <TextInput
              style={styles.paceInput}
              value={finishSec}
              onChangeText={stripToDigits(setFinishSec)}
              keyboardType="number-pad"
              placeholder="00"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Finish time seconds"
            />
          </View>
          {estimateSecPerKm != null ? (
            <Text style={styles.estimatePreview}>
              {`Estimated threshold pace: ${formatPaceMinSec(
                units === 'imperial' ? paceSecPerKmToSecPerMi(estimateSecPerKm) : estimateSecPerKm,
              )} ${displayUnit}`}
            </Text>
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
    borderRadius: Radius.lg,
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
  subLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  paceInput: {
    ...Typography.display,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 64,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  colon: {
    ...Typography.display,
    color: Colors.dark.text,
  },
  unitLabel: {
    ...Typography.heading,
    color: Colors.dark.mutedText,
    marginLeft: Spacing.xs,
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
