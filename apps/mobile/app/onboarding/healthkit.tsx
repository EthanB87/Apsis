/**
 * apps/mobile/app/onboarding/healthkit.tsx
 *
 * Terminal onboarding step (D-23) — runs AFTER review.tsx's Save has already inserted
 * the user_profile row. NOT a WizardStep reuse: the wizard is functionally complete by
 * the time this screen renders, so it deliberately omits WizardStep's progress-dot
 * chrome (05-UI-SPEC.md Component Notes §1) and is a standalone screen instead.
 *
 * D-20 (skippable, quiet decline, no re-prompt) / D-22 (grant then background 90-day
 * import, onboarding finishes immediately): BOTH the "Connect Apple Health" and
 * "Not now" paths bump `useProfileVersion` and advance — that bump is what actually
 * flips Plan 04's Stack.Protected gate from onboarding to the tab shell (moved here from
 * useSaveProfile.save() per Pitfall 2, see hooks/useSaveProfile.ts). Once past this
 * screen it must never be shown again, regardless of which button was pressed.
 *
 * Security (T-05-03, Elevation of Privilege — mitigate): requestHealthKitAuthorization
 * requests only the shared minimal HK_READ_TYPES/HK_WRITE_TYPES (healthkitAuth.ts) — no
 * broader ad-hoc identifier is requested here.
 * Security (T-05-09, Denial of Service — mitigate): the initial 90-day import
 * (runHealthKitSync) is fired in the background (not awaited) so this screen — and
 * onboarding as a whole — completes immediately regardless of import duration (D-22).
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@apsis/db';
import { requestHealthKitAuthorization } from '../../lib/healthkitAuth';
import { setSyncState } from '../../lib/healthkitSyncState';
import { runHealthKitSync } from '../../lib/healthkitImport';
import { useProfileVersion } from '../../lib/profileVersion';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';

export default function HealthKitStep(): React.JSX.Element {
  const [connecting, setConnecting] = useState(false);
  const bumpProfileVersion = useProfileVersion((state) => state.bump);

  async function handleConnect(): Promise<void> {
    if (connecting) return;
    setConnecting(true);
    try {
      const granted = await requestHealthKitAuthorization();
      if (granted) {
        await setSyncState(db, { healthkitConnected: true });
        // D-22: fire the initial 90-day import in the BACKGROUND — never await/block
        // onboarding completion on it. Failures are silent (D-25); the next foreground
        // sync (useForegroundHealthKitSync) retries naturally.
        runHealthKitSync(db, { initial: true }).catch((err: unknown) => {
          console.error('[Apsis] onboarding initial healthkit sync failed:', err);
        });
      }
    } catch (err: unknown) {
      // D-25: never surface an error dialog here — log only, still advance below.
      console.error('[Apsis] onboarding requestHealthKitAuthorization failed:', err);
    } finally {
      // D-20: both accept and skip complete onboarding — this bump is what flips the
      // Stack.Protected gate to the tab shell (Pitfall 2).
      bumpProfileVersion();
    }
  }

  function handleNotNow(): void {
    bumpProfileVersion();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.headline}>Connect Apple Health?</Text>
        <Text style={styles.body}>
          We&apos;ll pull in your last 90 days of runs and rides — so your readiness
          number is real from day one, not after two weeks of waiting.
        </Text>
      </View>
      <View style={styles.actionBlock}>
        <Pressable
          onPress={handleConnect}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Connect Apple Health"
          accessibilityState={{ disabled: connecting }}
          style={({ pressed }) => [
            styles.button,
            connecting && styles.buttonDisabled,
            pressed && !connecting && styles.buttonPressed,
          ]}>
          <Text style={styles.buttonLabel}>Connect Apple Health</Text>
        </Pressable>
        <Pressable
          onPress={handleNotNow}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={styles.notNow}>
          <Text style={styles.notNowLabel}>Not now</Text>
        </Pressable>
        <Text style={styles.subCopy}>You can connect anytime in Settings.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxl,
  },
  headline: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginBottom: Spacing.xl,
  },
  body: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  actionBlock: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: DISABLED_OPACITY,
  },
  buttonPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  buttonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  notNow: {
    marginTop: Spacing.sm,
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  subCopy: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
  },
});
