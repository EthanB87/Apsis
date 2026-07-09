/**
 * apps/mobile/app/onboarding/review.tsx — wizard step 6 of 6 (D-04)
 *
 * Terminal wizard screen: renders the reusable ProfileReview component against the
 * onboarding draft. Save inserts the user_profile row via useSaveProfile, which bumps
 * the profile-version signal so useProfileExists re-queries and Plan 04's
 * Stack.Protected gate flips from onboarding to the tab shell (ONB-01 complete).
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
    await save({
      sex: draft.sex,
      bodyweightKg: draft.bodyweightKg,
      thresholdHr: draft.thresholdHr,
      thresholdPaceSecPerKm: draft.thresholdPaceSecPerKm,
      units: draft.units,
    });
    // On success, useProfileExists' version-driven re-query flips Plan 04's
    // Stack.Protected gate to the tab shell — no manual navigation needed here.
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
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xxxl,
    marginBottom: Spacing.lg,
  },
});
