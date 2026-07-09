/**
 * apps/mobile/stores/sessionStore.ts
 *
 * Active-session UI state (LIFT-01..08). In-memory ONLY — no zustand `persist` middleware,
 * no AsyncStorage (RESEARCH.md Anti-Patterns). SQLite is the single durable source of truth
 * (D-13/D-14): every checked set is written to `strength_set` immediately by
 * `lib/commitSet.ts`, and a crash/kill loses nothing because the next launch's D-14
 * auto-resume flow rebuilds this exact shape from the DB via `rehydrateFromDb`.
 *
 * Set drafts key their `loadFieldKg` on "whatever the user types into the load field" —
 * the full load for an ordinary barbell lift, or just the added weight for a bodyweight
 * movement (D-17). `lib/effectiveLoad.ts#computeEffectiveLoad` turns that into the engine's
 * `loadKg` at commit time; this store never computes stress itself (D-13: persist THEN
 * recompute via the engine, never the reverse).
 */

import { create } from 'zustand';
import { randomUUID } from 'expo-crypto';
import { eq } from 'drizzle-orm';
import { db, exercise as exerciseTable, strengthSet, workout, previousSessionSet } from '@apsis/db';
import { formatPaceMinSec, type Units } from '@apsis/shared';

/** Pre-selected RPE for a set with no prior logged RPE to inherit (D-08). */
export const DEFAULT_RPE = 8;

export interface SetDraft {
  /** Client-generated id (expo-crypto randomUUID) — becomes the persisted strength_set.id
   * the moment this set is committed, so no id remapping is ever needed. */
  id: string;
  setNumber: number;
  /** Reps-mode only; ignored (persisted as 0) for entryMode 'timed' sets (D-19). */
  reps: number;
  /** What the user types/steps in the load field — full load for a barbell lift, added
   * weight only for a bodyweight movement (D-17). See lib/effectiveLoad.ts. */
  loadFieldKg: number;
  rpe: number;
  isWarmup: boolean;
  /** Timed-mode only (D-19); ignored for entryMode 'reps' sets. */
  durationS: number;
  /** True once this set's checkmark has persisted it to SQLite (D-09). */
  committed: boolean;
  /** True only for a genuinely first-ever, never-logged-before set (D-07) — the row must
   * render blank with keypad focus, no fabricated defaults, until the user types/steps. */
  isBlank: boolean;
  /** Engine warning for this specific committed set (D-29) — populated by Plan 08. */
  warning?: string;
}

export interface ExerciseCardState {
  exerciseId: string;
  name: string;
  bodyPart: string | null;
  bwFactor: number | null;
  entryMode: 'reps' | 'timed';
  restTimerSec: number | null;
  /** "Last: 100 kg × 5 @ RPE 8" style summary from the most recent prior finished session
   * (LIFT-03/D-07), or null if this is the athlete's first time logging this exercise. */
  lastSessionSummary: string | null;
  sets: SetDraft[];
}

export interface AddExerciseInput {
  id: string;
  name: string;
  bodyPart: string | null;
  bwFactor: number | null;
  entryMode: 'reps' | 'timed';
  restTimerSec: number | null;
}

interface SessionState {
  workoutId: string | null;
  profileBodyweightKg: number;
  units: Units;
  exercises: ExerciseCardState[];
  liveHss: number;
  warnings: string[];
  restTimerEndsAt: number | null;
  breakdownOpen: boolean;

  startSession: (workoutId: string, profile: { bodyweightKg: number; units: Units }) => void;
  addExercise: (exercise: AddExerciseInput) => Promise<void>;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSetDraft: (exerciseId: string, setId: string, patch: Partial<SetDraft>) => void;
  setCommitted: (exerciseId: string, setId: string, committed: boolean) => void;
  setLiveHss: (hss: number, warnings: string[]) => void;
  setRestTimerEndsAt: (endsAt: number | null) => void;
  setBreakdownOpen: (open: boolean) => void;
  rehydrateFromDb: (workoutId: string, profile: { bodyweightKg: number; units: Units }) => Promise<void>;
  reset: () => void;
}

function blankSet(): SetDraft {
  return {
    id: randomUUID(),
    setNumber: 1,
    reps: 0,
    loadFieldKg: 0,
    rpe: DEFAULT_RPE,
    isWarmup: false,
    durationS: 0,
    committed: false,
    isBlank: true,
  };
}

function formatLastSessionSummary(
  prev: { loadKg: number; addedLoadKg: number | null; reps: number; rpe: number | null; durationS: number | null },
  meta: { bwFactor: number | null; entryMode: 'reps' | 'timed' }
): string {
  if (meta.entryMode === 'timed') {
    return `Last: ${formatPaceMinSec(prev.durationS ?? 0)} @ RPE ${prev.rpe ?? DEFAULT_RPE}`;
  }
  const displayLoad = meta.bwFactor != null ? (prev.addedLoadKg ?? 0) : prev.loadKg;
  const rounded = Math.round(displayLoad * 10) / 10;
  return `Last: ${rounded} kg × ${prev.reps} @ RPE ${prev.rpe ?? DEFAULT_RPE}`;
}

const INITIAL_SESSION = {
  workoutId: null as string | null,
  profileBodyweightKg: 0,
  units: 'metric' as Units,
  exercises: [] as ExerciseCardState[],
  liveHss: 0,
  warnings: [] as string[],
  restTimerEndsAt: null as number | null,
  breakdownOpen: false,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...INITIAL_SESSION,

  startSession: (workoutId, profile) => {
    set({
      ...INITIAL_SESSION,
      workoutId,
      profileBodyweightKg: profile.bodyweightKg,
      units: profile.units,
    });
  },

  addExercise: async (exercise) => {
    const state = get();
    if (!state.workoutId) return;
    if (state.exercises.some((card) => card.exerciseId === exercise.id)) return;

    let lastSessionSummary: string | null = null;
    let firstSet = blankSet();

    try {
      const prevRows = await previousSessionSet(db, exercise.id);
      const prev = prevRows[0];
      if (prev) {
        lastSessionSummary = formatLastSessionSummary(prev, exercise);
        firstSet = {
          id: randomUUID(),
          setNumber: 1,
          reps: prev.reps,
          loadFieldKg: exercise.bwFactor != null ? (prev.addedLoadKg ?? 0) : prev.loadKg,
          rpe: prev.rpe ?? DEFAULT_RPE,
          isWarmup: false,
          durationS: prev.durationS ?? 0,
          committed: false,
          isBlank: false,
        };
      }
    } catch (err: unknown) {
      // Pre-fill is a convenience, not a correctness requirement — fall back to a blank
      // first-ever set rather than blocking "Add exercise" on a failed query.
      console.error('[Apsis] previousSessionSet query failed:', err);
    }

    const card: ExerciseCardState = {
      exerciseId: exercise.id,
      name: exercise.name,
      bodyPart: exercise.bodyPart,
      bwFactor: exercise.bwFactor,
      entryMode: exercise.entryMode,
      restTimerSec: exercise.restTimerSec,
      lastSessionSummary,
      sets: [firstSet],
    };

    set((s) => ({ exercises: [...s.exercises, card] }));
  },

  addSet: (exerciseId) => {
    set((s) => ({
      exercises: s.exercises.map((card) => {
        if (card.exerciseId !== exerciseId) return card;
        const last = card.sets[card.sets.length - 1];
        const newSet: SetDraft = {
          id: randomUUID(),
          setNumber: card.sets.length + 1,
          reps: last?.reps ?? 0,
          loadFieldKg: last?.loadFieldKg ?? 0,
          rpe: last?.rpe ?? DEFAULT_RPE,
          isWarmup: false,
          durationS: last?.durationS ?? 0,
          committed: false,
          isBlank: false,
        };
        return { ...card, sets: [...card.sets, newSet] };
      }),
    }));
  },

  removeSet: (exerciseId, setId) => {
    set((s) => ({
      exercises: s.exercises.map((card) =>
        card.exerciseId !== exerciseId
          ? card
          : { ...card, sets: card.sets.filter((set_) => set_.id !== setId) }
      ),
    }));
  },

  updateSetDraft: (exerciseId, setId, patch) => {
    set((s) => ({
      exercises: s.exercises.map((card) =>
        card.exerciseId !== exerciseId
          ? card
          : {
              ...card,
              sets: card.sets.map((set_) => (set_.id === setId ? { ...set_, ...patch } : set_)),
            }
      ),
    }));
  },

  setCommitted: (exerciseId, setId, committed) => {
    set((s) => ({
      exercises: s.exercises.map((card) =>
        card.exerciseId !== exerciseId
          ? card
          : {
              ...card,
              sets: card.sets.map((set_) => (set_.id === setId ? { ...set_, committed } : set_)),
            }
      ),
    }));
  },

  setLiveHss: (hss, warnings) => set({ liveHss: hss, warnings }),

  setRestTimerEndsAt: (endsAt) => set({ restTimerEndsAt: endsAt }),

  setBreakdownOpen: (open) => set({ breakdownOpen: open }),

  rehydrateFromDb: async (workoutId, profile) => {
    set({
      ...INITIAL_SESSION,
      workoutId,
      profileBodyweightKg: profile.bodyweightKg,
      units: profile.units,
    });

    try {
      const rows = await db
        .select({
          id: strengthSet.id,
          exerciseId: strengthSet.exerciseId,
          setNumber: strengthSet.setNumber,
          loadKg: strengthSet.loadKg,
          reps: strengthSet.reps,
          rpe: strengthSet.rpe,
          isWarmup: strengthSet.isWarmup,
          addedLoadKg: strengthSet.addedLoadKg,
          durationS: strengthSet.durationS,
          exerciseName: exerciseTable.name,
          bodyPart: exerciseTable.bodyPart,
          bwFactor: exerciseTable.bwFactor,
          entryMode: exerciseTable.entryMode,
          restTimerSec: exerciseTable.restTimerSec,
        })
        .from(strengthSet)
        .innerJoin(exerciseTable, eq(strengthSet.exerciseId, exerciseTable.id))
        .where(eq(strengthSet.workoutId, workoutId))
        .orderBy(strengthSet.setNumber);

      const byExercise = new Map<string, ExerciseCardState>();
      for (const row of rows) {
        let card = byExercise.get(row.exerciseId);
        if (!card) {
          card = {
            exerciseId: row.exerciseId,
            name: row.exerciseName,
            bodyPart: row.bodyPart,
            bwFactor: row.bwFactor,
            entryMode: (row.entryMode ?? 'reps') as 'reps' | 'timed',
            restTimerSec: row.restTimerSec,
            lastSessionSummary: null,
            sets: [],
          };
          byExercise.set(row.exerciseId, card);
        }
        card.sets.push({
          id: row.id,
          setNumber: row.setNumber,
          reps: row.reps,
          loadFieldKg: row.bwFactor != null ? (row.addedLoadKg ?? 0) : row.loadKg,
          rpe: row.rpe ?? DEFAULT_RPE,
          isWarmup: row.isWarmup ?? false,
          durationS: row.durationS ?? 0,
          committed: true,
          isBlank: false,
        });
      }

      const workoutRows = await db
        .select({ hss: workout.hss })
        .from(workout)
        .where(eq(workout.id, workoutId))
        .limit(1);

      set({
        exercises: Array.from(byExercise.values()),
        liveHss: workoutRows[0]?.hss ?? 0,
      });
    } catch (err: unknown) {
      console.error('[Apsis] rehydrateFromDb failed:', err);
    }
  },

  reset: () => set({ ...INITIAL_SESSION }),
}));
