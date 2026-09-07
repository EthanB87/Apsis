/**
 * apps/mobile/app/(tabs)/settings/_layout.tsx — Settings tab stack (D-32)
 *
 * Plain expo-router `<Stack>` (no header) mirroring the Log tab's group layout
 * (apps/mobile/app/(tabs)/log/_layout.tsx) so the tab bar stays visible on `index`.
 * A single screen this plan (`index.tsx`) — kept as a Stack rather than a bare screen so
 * a future settings sub-screen can be added without a navigation-shape change.
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function SettingsLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
