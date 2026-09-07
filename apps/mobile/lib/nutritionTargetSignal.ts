/**
 * apps/mobile/lib/nutritionTargetSignal.ts
 *
 * A tiny zustand version counter (mirrors `profileVersion.ts` exactly) that
 * `recomputeNutritionTarget` bumps after a successful `nutrition_target` upsert. The nutrition
 * tab's TODAY screen subscribes to this so a logging write elsewhere (e.g. finishing a workout
 * while the nutrition screen is mounted in the background stack) refreshes its displayed
 * targets without needing a query-invalidation library — same minimal-surface reasoning as
 * `profileVersion.ts`'s own doc comment.
 */

import { create } from 'zustand';

interface NutritionTargetSignalState {
  version: number;
  bump: () => void;
}

export const useNutritionTargetSignal = create<NutritionTargetSignalState>()((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));
