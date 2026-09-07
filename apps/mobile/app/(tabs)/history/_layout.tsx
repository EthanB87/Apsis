/**
 * apps/mobile/app/(tabs)/history/_layout.tsx — History tab stack (D-07/D-25..D-29)
 *
 * Plain expo-router `<Stack>` (no header) mirroring the Log/Settings tab group layouts
 * (`apps/mobile/app/(tabs)/log/_layout.tsx`, `apps/mobile/app/(tabs)/settings/_layout.tsx`)
 * so the tab bar stays visible on `index` and the custom `ScreenHeader` (Kicker "LEDGER" +
 * Title "History") is the only header rendered — no doubled native header.
 *
 * Navigation: expo-router only — no @react-navigation/* imports (SDK 56 fork).
 */

import { Stack } from 'expo-router';

export default function HistoryLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
