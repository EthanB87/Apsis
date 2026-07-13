/**
 * apps/mobile/app/(tabs)/nutrition/_layout.tsx — Nutrition tab stack (Plan 07-05)
 *
 * Plain expo-router `<Stack>` (no header), matching the Log tab-group convention exactly
 * (`(tabs)/log/_layout.tsx`) — auto-registers `index.tsx` (today's targets vs. totals) now,
 * and lets later-phase nutrition child screens (search/scan/label-scan/recipes) auto-route
 * once added under this same directory.
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function NutritionLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
