/**
 * apps/mobile/app/(tabs)/log/_layout.tsx — Log tab stack (D-22)
 *
 * Plain expo-router `<Stack>` (no header) auto-registering `index.tsx` (Start Workout entry)
 * and `session.tsx` (the active-session screen, Task 3). Nested inside the `(tabs)` group so
 * the tab bar stays visible on `index`, matching the Strong/Hevy shape where the active
 * session is reached by tapping the Log tab.
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function LogLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
