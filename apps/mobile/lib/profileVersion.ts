/**
 * apps/mobile/lib/profileVersion.ts
 *
 * A tiny zustand counter that `useSaveProfile` bumps after a successful
 * `user_profile` insert, and `useProfileExists` subscribes to so its count query
 * re-runs. Without this signal, the root layout's `hasProfile` state (queried once
 * when migrations settle, see app/_layout.tsx) would never notice a profile row
 * created later on the review screen, and Plan 04's Stack.Protected gate would never
 * flip from onboarding to the tab shell after Save (ONB-01) short of a full app
 * relaunch. Deliberately module-scoped (not part of onboardingDraft.ts) since it's a
 * cross-cutting "re-check profile existence" signal, not draft-form state.
 */

import { create } from 'zustand';

interface ProfileVersionState {
  version: number;
  bump: () => void;
}

export const useProfileVersion = create<ProfileVersionState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));
