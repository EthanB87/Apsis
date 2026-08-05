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
 *
 * Phase 09 (D-01/D-02): the single `units` field is split into three independent
 * buckets — `liftsUnits`, `bodyweightUnits`, `runUnits` — so onboarding can offer a
 * Mixed path (imperial lifts + km runs) alongside the fast single Metric/Imperial
 * choice. `setAllUnits` is the single-choice convenience that sets all three buckets
 * at once; the individual setters back the Mixed path's three inline toggles.
 */

import { create } from 'zustand';
import type { Sex, Units } from '@apsis/shared';

export const WIZARD_STEP_ORDER = [
  'sex',
  'units',
  'bodyweight',
  'threshold-hr',
  'threshold-pace',
  'review',
] as const;

export type WizardStepName = (typeof WIZARD_STEP_ORDER)[number];

interface OnboardingDraftValues {
  sex: Sex | null;
  bodyweightKg: number | null;
  liftsUnits: Units;
  bodyweightUnits: Units;
  runUnits: Units;
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
  setLiftsUnits: (units: Units) => void;
  setBodyweightUnits: (units: Units) => void;
  setRunUnits: (units: Units) => void;
  /** Single-choice fast path (D-02): sets all three buckets to the same value. */
  setAllUnits: (units: Units) => void;
  setThresholdHr: (thresholdHr: number, estimated: boolean) => void;
  setThresholdPaceSecPerKm: (thresholdPaceSecPerKm: number, estimated: boolean) => void;
  reset: () => void;
}

const initialDraft: OnboardingDraftValues = {
  sex: null,
  bodyweightKg: null,
  liftsUnits: 'metric',
  bodyweightUnits: 'metric',
  runUnits: 'metric',
  thresholdHr: null,
  thresholdPaceSecPerKm: null,
  thresholdHrEstimated: false,
  thresholdPaceEstimated: false,
};

export const useOnboardingDraft = create<OnboardingDraftState>()((set) => ({
  ...initialDraft,
  setSex: (sex) => set({ sex }),
  setBodyweightKg: (bodyweightKg) => set({ bodyweightKg }),
  setLiftsUnits: (liftsUnits) => set({ liftsUnits }),
  setBodyweightUnits: (bodyweightUnits) => set({ bodyweightUnits }),
  setRunUnits: (runUnits) => set({ runUnits }),
  setAllUnits: (units) => set({ liftsUnits: units, bodyweightUnits: units, runUnits: units }),
  setThresholdHr: (thresholdHr, thresholdHrEstimated) => set({ thresholdHr, thresholdHrEstimated }),
  setThresholdPaceSecPerKm: (thresholdPaceSecPerKm, thresholdPaceEstimated) =>
    set({ thresholdPaceSecPerKm, thresholdPaceEstimated }),
  reset: () => set(initialDraft),
}));
