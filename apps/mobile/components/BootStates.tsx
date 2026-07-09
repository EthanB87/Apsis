/**
 * apps/mobile/components/BootStates.tsx
 *
 * Boot-sequence screens rendered by _layout.tsx before the app can hand off to
 * expo-router's file-system routing (migrations, then the D-14 crash-resume check).
 *
 * Security (V7 / T-1-02 — Error Handling):
 *   ErrorScreen renders a hardcoded generic string ONLY.
 *   It accepts NO message prop and interpolates NO error object, error.message,
 *   or file paths. Raw error details are console.error'd in _layout.tsx for
 *   developer diagnostics but must never reach the user's screen.
 *
 * ResumePrompt (D-14) follows the same discipline (T-03-08): it renders only a
 * formatted local clock time derived from the open workout's createdAt — never a raw
 * workout id, error object, or other profile/session detail.
 */

import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { HIT_TARGET_MIN, Spacing, Typography } from '../constants/theme';

// ---------------------------------------------------------------------------
// LoadingScreen
// ---------------------------------------------------------------------------

/**
 * Shown while useMigrations() is running (success === false and error is absent).
 * Uses ActivityIndicator so the user knows something is happening.
 */
export function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.container} testID="boot-loading">
      <ActivityIndicator size="large" color="#555" />
      <Text style={styles.loadingText}>Starting database...</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorScreen
// ---------------------------------------------------------------------------

/**
 * Shown when useMigrations() resolves with an error.
 *
 * HARD RULE (V7 / T-1-02): this component renders only the literal string below.
 * Do NOT add a `message` prop, do NOT interpolate `error.message`, do NOT render
 * any path that came from the error object. Log raw error in _layout.tsx only.
 */
export function ErrorScreen(): React.JSX.Element {
  return (
    <View style={styles.container} testID="boot-error">
      <Text style={styles.errorText}>
        Could not start the local database. Please reinstall the app.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ResumePrompt (D-14 crash/kill recovery)
// ---------------------------------------------------------------------------

export interface ResumePromptProps {
  /** When the open workout was created — formatted as a local 12-hour clock time. */
  startedAt: Date;
  onResume: () => void;
  onFinishNow: () => void;
  onDiscard: () => void;
}

/**
 * Rendered by the root layout before the tab shell whenever an unfinished, non-deleted
 * `workout` row exists on boot (D-14). Copy per 03-UI-SPEC.md's Copywriting Contract.
 */
export function ResumePrompt({
  startedAt,
  onResume,
  onFinishNow,
  onDiscard,
}: ResumePromptProps): React.JSX.Element {
  const time = formatLocal12Hour(startedAt);

  return (
    <SafeAreaView style={resumeStyles.safeArea} testID="boot-resume-prompt">
      <View style={resumeStyles.container}>
        <Text style={resumeStyles.question}>{`Resume workout from ${time}?`}</Text>
        <View style={resumeStyles.buttonColumn}>
          <Pressable
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel="Resume"
            style={({ pressed }) => [
              resumeStyles.button,
              resumeStyles.primaryButton,
              pressed && resumeStyles.buttonPressed,
            ]}>
            <Text style={resumeStyles.primaryButtonLabel}>Resume</Text>
          </Pressable>
          <Pressable
            onPress={onFinishNow}
            accessibilityRole="button"
            accessibilityLabel="Finish Now"
            style={({ pressed }) => [
              resumeStyles.button,
              resumeStyles.secondaryButton,
              pressed && resumeStyles.buttonPressed,
            ]}>
            <Text style={resumeStyles.secondaryButtonLabel}>Finish Now</Text>
          </Pressable>
          <Pressable
            onPress={onDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard"
            style={({ pressed }) => [
              resumeStyles.button,
              resumeStyles.destructiveButton,
              pressed && resumeStyles.buttonPressed,
            ]}>
            <Text style={resumeStyles.destructiveButtonLabel}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Formats a Date as a local 12-hour clock time, e.g. "2:32 PM". */
function formatLocal12Hour(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#c0392b',
    textAlign: 'center',
    lineHeight: 24,
  },
});

const resumeStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  question: {
    ...Typography.heading,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  buttonColumn: {
    width: '100%',
    gap: Spacing.md,
  },
  button: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  primaryButton: {
    backgroundColor: Colors.dark.accent,
  },
  primaryButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
  },
  secondaryButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  destructiveButton: {
    backgroundColor: 'transparent',
  },
  destructiveButtonLabel: {
    ...Typography.body,
    color: Colors.dark.destructive,
  },
});
