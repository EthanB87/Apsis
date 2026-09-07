/**
 * apps/mobile/app/nutrition-setup/_layout.tsx — Nutrition Setup stack (NUTR-15/NUTR-20)
 *
 * Plain expo-router `<Stack>` (no header) registering the standalone nutrition-setup prompt
 * screen. Reached from the nutrition tab (wired in Plan 05) when `useNutritionProfile`'s gate
 * reports `complete: false` — deliberately NOT part of the onboarding wizard stack (D-01
 * stays scoped to brand-new installs); this handles already-onboarded users whose new profile
 * fields are NULL (RESEARCH.md Pitfall 3).
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function NutritionSetupLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
