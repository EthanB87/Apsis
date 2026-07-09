/**
 * apps/mobile/lib/onboardingDraft.ts
 *
 * In-memory-only wizard draft store (D-01/D-04). NO persist middleware — the
 * `user_profile` row created on the review screen's Save is the durable store; losing
 * the draft on an app kill mid-onboarding is acceptable and matches 03-RESEARCH.md's
 * anti-pattern note (no zustand `persist` + AsyncStorage; DB stays the single source of
 * truth per D-13's pattern).
 *
 * `WIZARD_STEP_ORDER` lists every wizard route name in order so `WizardStep`'s progress
 * dots can compute the current position. Plan 04 builds sex/bodyweight/units; Plan 05
 * appends threshold-hr/threshold-pace/review against this same draft.
 */

import { create } from 'zustand';
import type { Sex, Units } from '@apsis/shared';

export const WIZARD_STEP_ORDER = [
  'sex',
  'bodyweight',
  'units',
  'threshold-hr',
  'threshold-pace',
  'review',
] as const;

export type WizardStepName = (typeof WIZARD_STEP_ORDER)[number];

interface OnboardingDraftValues {
  sex: Sex | null;
  bodyweightKg: number | null;
  units: Units;
  thresholdHr: number | null;
  thresholdPaceSecPerKm: number | null;
  /** True when thresholdHr was derived via the D-02 max-HR/age estimate path, not typed directly. */
  thresholdHrEstimated: boolean;
  /** True when thresholdPaceSecPerKm was derived via the D-02 race-time picker, not typed directly. */
  thresholdPaceEstimated: boolean;
}

interface OnboardingDraftState extends OnboardingDraftValues {
  setSex: (sex: Sex) => void;
  setBodyweightKg: (bodyweightKg: number) => void;
  setUnits: (units: Units) => void;
  setThresholdHr: (thresholdHr: number, estimated: boolean) => void;
  setThresholdPaceSecPerKm: (thresholdPaceSecPerKm: number, estimated: boolean) => void;
  reset: () => void;
}

const initialDraft: OnboardingDraftValues = {
  sex: null,
  bodyweightKg: null,
  units: 'metric',
  thresholdHr: null,
  thresholdPaceSecPerKm: null,
  thresholdHrEstimated: false,
  thresholdPaceEstimated: false,
};

export const useOnboardingDraft = create<OnboardingDraftState>()((set) => ({
  ...initialDraft,
  setSex: (sex) => set({ sex }),
  setBodyweightKg: (bodyweightKg) => set({ bodyweightKg }),
  setUnits: (units) => set({ units }),
  setThresholdHr: (thresholdHr, thresholdHrEstimated) => set({ thresholdHr, thresholdHrEstimated }),
  setThresholdPaceSecPerKm: (thresholdPaceSecPerKm, thresholdPaceEstimated) =>
    set({ thresholdPaceSecPerKm, thresholdPaceEstimated }),
  reset: () => set(initialDraft),
}));
