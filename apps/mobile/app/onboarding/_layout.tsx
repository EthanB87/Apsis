/**
 * apps/mobile/app/onboarding/_layout.tsx — onboarding wizard stack (D-01)
 *
 * Plain expo-router `<Stack>` (no tab bar, no header) that auto-registers every step
 * screen file in this directory (explainer.tsx, sex.tsx, bodyweight.tsx, units.tsx,
 * threshold-hr.tsx, threshold-pace.tsx, review.tsx). Only reachable while the root
 * layout's Stack.Protected guard has `hasProfile === false` (app/_layout.tsx).
 *
 * Phase 09 (D-15): `explainer` is the wizard's FIRST step — before any input — so the
 * HSS/readiness/trend pitch lands at peak attention and motivates the threshold HR/pace
 * asks that follow. `unstable_settings.initialRouteName` is expo-router's supported way
 * to pin a directory stack's initial route (file-based stacks otherwise default to the
 * `index`-then-alphabetical convention, which would land on bodyweight.tsx).
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'explainer',
};

export default function OnboardingLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
