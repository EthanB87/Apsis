/**
 * apps/mobile/app/nutrition-setup/index.tsx — Nutrition Setup prompt (NUTR-15/NUTR-20)
 *
 * Standalone screen (not part of the onboarding wizard, RESEARCH.md Pitfall 3) collecting the
 * three profile fields `dailyMacroTarget` needs that already-onboarded users never provided:
 * height, birth year, and goal mode. Stages all three into local draft state and commits with
 * ONE batched `useProfile().update()` call on Save (mirrors Settings' D-04 staged-draft ->
 * single-UPDATE pattern) — this UPDATE only ever targets the profile table, never any logged
 * training tables — then bumps `useProfileVersion` so `useNutritionProfile`'s gate re-checks
 * without an app relaunch.
 *
 * Height entry respects the profile's stored display-units preference: metric shows a single
 * cm field; imperial shows feet + inches (mirroring the pace min:sec two-field pattern in
 * Settings), converted to metric cm for storage only — imperial values are never persisted.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '../../hooks/useProfile';
import { useProfileVersion } from '../../lib/profileVersion';
import { ScreenHeader } from '../../components/ScreenHeader';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Radius, Spacing, Typography, tabularNums } from '../../constants/theme';

const CM_PER_INCH = 2.54;
const MIN_PLAUSIBLE_CM = 120;
const MAX_PLAUSIBLE_CM = 230;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = CURRENT_YEAR - 100;
const MAX_BIRTH_YEAR = CURRENT_YEAR - 5;

type GoalMode = 'cut' | 'maintain' | 'bulk';

const GOAL_OPTIONS: ReadonlyArray<{ value: GoalMode; label: string }> = [
  { value: 'cut', label: 'Cut' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'bulk', label: 'Bulk' },
];

function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export default function NutritionSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const { profile, loading, submitting, errorMessage, update } = useProfile();
  const bumpProfileVersion = useProfileVersion((state) => state.bump);

  const [cmText, setCmText] = useState('');
  const [feetText, setFeetText] = useState('');
  const [inchesText, setInchesText] = useState('');
  const [birthYearText, setBirthYearText] = useState('');
  const [goalMode, setGoalMode] = useState<GoalMode | null>(null);
  const [focusedField, setFocusedField] = useState<'cm' | 'feet' | 'inches' | 'birthYear' | null>(
    null,
  );

  if (loading || profile == null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  const isImperial = profile.units === 'imperial';

  const heightCmValue: number | null = isImperial
    ? (() => {
        const feet = Number(feetText);
        const inches = Number(inchesText);
        if (feetText.trim().length === 0 || !Number.isFinite(feet) || feet < 0) return null;
        const safeInches = inchesText.trim().length === 0 ? 0 : inches;
        if (!Number.isFinite(safeInches) || safeInches < 0) return null;
        return feetInchesToCm(feet, safeInches);
      })()
    : (() => {
        const cm = Number(cmText);
        return cmText.trim().length > 0 && Number.isFinite(cm) && cm > 0 ? cm : null;
      })();

  const heightOutOfRange =
    heightCmValue != null && (heightCmValue < MIN_PLAUSIBLE_CM || heightCmValue > MAX_PLAUSIBLE_CM);

  const birthYearParsed = Number(birthYearText);
  const isValidBirthYear =
    birthYearText.trim().length === 4 &&
    Number.isFinite(birthYearParsed) &&
    birthYearParsed >= MIN_BIRTH_YEAR &&
    birthYearParsed <= MAX_BIRTH_YEAR;

  const canSave =
    heightCmValue != null && !heightOutOfRange && isValidBirthYear && goalMode != null && !submitting;

  async function handleSave(): Promise<void> {
    if (!canSave || heightCmValue == null || goalMode == null) return;
    const ok = await update({
      heightCm: heightCmValue,
      birthYear: Math.round(birthYearParsed),
      goalMode,
    });
    if (ok) {
      bumpProfileVersion();
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader kicker="NUTRITION" title="Nutrition setup" style={styles.screenHeader} />
        <Text style={styles.intro}>
          A few more details are needed to compute your daily calorie and macro targets.
        </Text>

        <Text style={styles.sectionLabel}>Height</Text>
        {isImperial ? (
          <View style={styles.heightRow}>
            <TextInput
              style={[styles.numericInput, focusedField === 'feet' && styles.inputFocused]}
              value={feetText}
              onChangeText={(next) => setFeetText(next.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocusedField('feet')}
              onBlur={() => setFocusedField(null)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Height feet"
            />
            <Text style={styles.unitLabel}>ft</Text>
            <TextInput
              style={[styles.numericInput, focusedField === 'inches' && styles.inputFocused]}
              value={inchesText}
              onChangeText={(next) => setInchesText(next.replace(/[^0-9]/g, ''))}
              onFocus={() => setFocusedField('inches')}
              onBlur={() => setFocusedField(null)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Height inches"
            />
            <Text style={styles.unitLabel}>in</Text>
          </View>
        ) : (
          <View style={styles.heightRow}>
            <TextInput
              style={[styles.numericInput, focusedField === 'cm' && styles.inputFocused]}
              value={cmText}
              onChangeText={(next) => setCmText(next.replace(/[^0-9.]/g, ''))}
              onFocus={() => setFocusedField('cm')}
              onBlur={() => setFocusedField(null)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.dark.mutedText}
              accessibilityLabel="Height"
            />
            <Text style={styles.unitLabel}>cm</Text>
          </View>
        )}
        {heightOutOfRange ? (
          <Text style={styles.warning} accessibilityRole="alert">
            That looks unusual — are you sure?
          </Text>
        ) : null}

        <Text style={styles.sectionLabel}>Birth year</Text>
        <View style={styles.heightRow}>
          <TextInput
            style={[styles.numericInput, focusedField === 'birthYear' && styles.inputFocused]}
            value={birthYearText}
            onChangeText={(next) => setBirthYearText(next.replace(/[^0-9]/g, '').slice(0, 4))}
            onFocus={() => setFocusedField('birthYear')}
            onBlur={() => setFocusedField(null)}
            keyboardType="number-pad"
            placeholder="YYYY"
            placeholderTextColor={Colors.dark.mutedText}
            maxLength={4}
            accessibilityLabel="Birth year"
          />
        </View>

        <Text style={styles.sectionLabel}>Goal</Text>
        <View style={styles.goalRow}>
          {GOAL_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setGoalMode(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: goalMode === opt.value }}
              style={[styles.goalOption, goalMode === opt.value && styles.goalOptionSelected]}>
              <Text style={[styles.goalLabel, goalMode === opt.value && styles.goalLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {errorMessage != null ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={() => {
            void handleSave();
          }}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !canSave }}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}>
          <Text style={styles.saveLabel}>{submitting ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  screenHeader: {
    paddingTop: Spacing.xl,
  },
  intro: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    marginTop: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  numericInput: {
    ...Typography.heading,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.surface,
  },
  inputFocused: {
    borderColor: Colors.dark.accent,
  },
  unitLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  warning: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginTop: Spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  goalOption: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bone active-fill (not volt): the Save CTA below is already the one volt-filled element
  // on this screen (DESIGN-SYSTEM.md §7 one-volt-per-screen rule) — mirrors Settings'
  // ChoiceButton/sexOption bone-selected convention.
  goalOptionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  goalLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  goalLabelSelected: {
    color: Colors.dark.onAccent,
  },
  errorText: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginTop: Spacing.lg,
  },
  saveButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
