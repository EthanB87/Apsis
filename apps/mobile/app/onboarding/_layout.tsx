/**
 * apps/mobile/app/onboarding/_layout.tsx — onboarding wizard stack (D-01)
 *
 * Plain expo-router `<Stack>` (no tab bar, no header) that auto-registers every step
 * screen file in this directory (sex.tsx, bodyweight.tsx, units.tsx, and — from Plan
 * 05 — threshold-hr.tsx, threshold-pace.tsx, review.tsx). Only reachable while the
 * root layout's Stack.Protected guard has `hasProfile === false` (app/_layout.tsx).
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
