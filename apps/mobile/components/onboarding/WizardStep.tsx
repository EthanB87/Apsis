/**
 * apps/mobile/components/onboarding/WizardStep.tsx
 *
 * Shared chrome for every onboarding wizard step (D-01): a Heading-size question at the
 * top (3xl top padding, per 03-UI-SPEC.md "Wizard step screens"), a centered content slot
 * for the step's own input control, a progress-dots row computed from WIZARD_STEP_ORDER,
 * and an Accent primary button pinned to the bottom safe area. All interactive controls
 * meet the 44x44 hit-target minimum (UI-SPEC Spacing Scale — Exceptions).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';
import { WIZARD_STEP_ORDER, type WizardStepName } from '../../lib/onboardingDraft';

export interface WizardStepProps {
  /** This screen's step name — used to compute progress-dot position. */
  step: WizardStepName;
  /** Heading-size question shown at the top of the step. */
  question: string;
  /** Called when the primary button is pressed. */
  onNext: () => void;
  /** Primary button label (default 'Continue'). */
  label?: string;
  /** Disables the primary button — reserved for "no value entered at all" (D-03: never
   * disable purely because a value is out of the plausible range). */
  nextDisabled?: boolean;
  children: React.ReactNode;
}

export function WizardStep({
  step,
  question,
  onNext,
  label = 'Continue',
  nextDisabled = false,
  children,
}: WizardStepProps): React.JSX.Element {
  const currentIndex = WIZARD_STEP_ORDER.indexOf(step);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.container} onPress={() => Keyboard.dismiss()} accessible={false}>
          <Text style={styles.question}>{question}</Text>
          <View style={styles.content}>{children}</View>
          <View
            style={styles.progressRow}
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${currentIndex + 1} of ${WIZARD_STEP_ORDER.length}`}>
            {WIZARD_STEP_ORDER.map((name, index) => (
              <View
                key={name}
                style={[styles.dot, index === currentIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={nextDisabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: nextDisabled }}
          style={({ pressed }) => [
            styles.button,
            nextDisabled && styles.buttonDisabled,
            pressed && !nextDisabled && styles.buttonPressed,
          ]}>
          <Text style={[styles.buttonLabel, nextDisabled && styles.buttonLabelDisabled]}>{label}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxxl,
  },
  question: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginBottom: Spacing.xxxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
    minHeight: HIT_TARGET_MIN / 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.dark.accent,
  },
  dotInactive: {
    backgroundColor: Colors.dark.border,
  },
  button: {
    minHeight: 48,
    marginHorizontal: Spacing.lg,
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
