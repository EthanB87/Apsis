/**
 * apps/mobile/app/onboarding/review.tsx — wizard step 6 of 6 (D-04)
 *
 * Terminal wizard screen: renders the reusable ProfileReview component against the
 * onboarding draft. Save inserts the user_profile row via useSaveProfile.
 *
 * Phase 05 (05-07, Pitfall 2 fix): useSaveProfile no longer bumps the profile-version
 * signal on insert — doing so here would flip Plan 04's Stack.Protected gate to the tab
 * shell before the new terminal HealthKit onboarding step (D-23) is ever reached. After
 * a successful save, this screen explicitly pushes to /onboarding/healthkit; that
 * step's own accept/skip handlers bump the version and are what actually flips the gate
 * (ONB-01 completes there instead of here).
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProfileReview, type ProfileReviewField } from '../../components/onboarding/ProfileReview';
import { useOnboardingDraft } from '../../lib/onboardingDraft';
import { useSaveProfile } from '../../hooks/useSaveProfile';
import Colors from '../../constants/Colors';
import { Spacing, Typography } from '../../constants/theme';

const FIELD_ROUTE: Record<ProfileReviewField, string> = {
  sex: '/onboarding/sex',
  bodyweightKg: '/onboarding/bodyweight',
  thresholdHr: '/onboarding/threshold-hr',
  thresholdPaceSecPerKm: '/onboarding/threshold-pace',
  units: '/onboarding/units',
};

export default function ReviewStep(): React.JSX.Element {
  const router = useRouter();
  const draft = useOnboardingDraft();
  const { submitting, errorMessage, save } = useSaveProfile();

  function handleEditField(field: ProfileReviewField): void {
    router.push(FIELD_ROUTE[field]);
  }

  async function handleSubmit(): Promise<void> {
    if (
      draft.sex == null ||
      draft.bodyweightKg == null ||
      draft.thresholdHr == null ||
      draft.thresholdPaceSecPerKm == null
    ) {
      return;
    }
    const ok = await save({
      sex: draft.sex,
      bodyweightKg: draft.bodyweightKg,
      thresholdHr: draft.thresholdHr,
      thresholdPaceSecPerKm: draft.thresholdPaceSecPerKm,
      units: draft.units,
    });
    // Phase 05 (05-07, Pitfall 2 fix): the profile-version bump — and therefore the
    // Stack.Protected gate flip — no longer happens inside save() itself. Push to the
    // terminal HealthKit step explicitly; its accept/skip handlers bump the version.
    if (ok) {
      router.push('/onboarding/healthkit');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <Text style={styles.question}>Review your profile</Text>
      <ProfileReview
        values={{
          sex: draft.sex,
          bodyweightKg: draft.bodyweightKg,
          thresholdHr: draft.thresholdHr,
          thresholdPaceSecPerKm: draft.thresholdPaceSecPerKm,
          units: draft.units,
        }}
        estimated={{
          thresholdHr: draft.thresholdHrEstimated,
          thresholdPaceSecPerKm: draft.thresholdPaceEstimated,
        }}
        onEditField={handleEditField}
        primaryLabel="Save & Start Training"
        onSubmit={handleSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  question: {
    ...Typography.heading,
    color: Colors.dark.text,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxxxl,
    marginBottom: Spacing.xl,
  },
});
