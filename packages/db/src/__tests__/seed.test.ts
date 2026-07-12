/**
 * Seed data unit tests — verifies STARTER_EXERCISES array meets DATA-02 requirements.
 * Tests the array ONLY; seedExercises() DB function is validated on device (Plan 01-04).
 *
 * ASVS / Threat: T-1-01 (parameterized-query discipline established in seedExercises).
 */

import { STARTER_EXERCISES } from '../seed';

const REQUIRED_IDS = ['squat', 'deadlift', 'bench', 'ohp', 'lunge', 'sled-push'] as const;
const VALID_TYPES = new Set(['strength', 'endurance', 'hybrid']);

describe('STARTER_EXERCISES seed data', () => {
  it('has >= 150 entries', () => {
    expect(STARTER_EXERCISES.length).toBeGreaterThanOrEqual(150);
  });

  it('contains all required core movements by id', () => {
    const ids = new Set(STARTER_EXERCISES.map((e) => e.id));
    for (const required of REQUIRED_IDS) {
      expect(ids.has(required), `missing required movement: ${required}`).toBe(true);
    }
  });

  it('every entry has a non-empty id, name, and a valid type', () => {
    for (const entry of STARTER_EXERCISES) {
      expect(entry.id.length, `empty id in entry: ${JSON.stringify(entry)}`).toBeGreaterThan(0);
      expect(entry.name.length, `empty name for id=${entry.id}`).toBeGreaterThan(0);
      expect(
        VALID_TYPES.has(entry.type),
        `invalid type "${entry.type}" for id=${entry.id}`,
      ).toBe(true);
    }
  });

  it('all ids are unique (no duplicates)', () => {
    const ids = STARTER_EXERCISES.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size, `duplicate ids found: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`).toBe(ids.length);
  });
});

describe('STARTER_EXERCISES bwFactor/entryMode (D-15/D-21)', () => {
  const byId = new Map(STARTER_EXERCISES.map((e) => [e.id, e]));

  const BODYWEIGHT_FACTORS: Record<string, number> = {
    'pull-up': 0.95,
    'chin-up': 0.95,
    dip: 0.95,
    'push-up': 0.65,
    lunge: 0.85,
    'split-squat': 0.85,
    'step-up': 0.90,
    'box-step-over': 0.90,
    'box-jump': 1.0,
    'burpee-broad-jump': 1.0,
    'wall-ball': 0.30,
    'kb-swing': 0.30,
    'sandbag-lunge': 0.85,
    // D-14 fix — previously bwFactor: null (scored ~0 HSS at 0 entered load)
    'ab-wheel': 0.25,
    'hanging-leg-raise': 0.35,
    // D-13 additions — lower body
    'walking-lunge': 0.85,
    'reverse-lunge': 0.85,
    'curtsy-lunge': 0.85,
    'cossack-squat': 0.85,
    'pistol-squat': 0.95,
    'glute-bridge': 0.60,
    'nordic-curl': 0.80,
    'glute-ham-raise': 0.75,
    // D-13 additions — upper body
    'ring-row': 0.55,
    'archer-pull-up': 0.95,
    'muscle-up': 1.0,
    'decline-push-up': 0.75,
    'incline-push-up': 0.50,
    'diamond-push-up': 0.65,
    'close-grip-push-up': 0.65,
    // D-13 additions — HYROX hybrid
    'devils-press': 0.30,
    'man-maker': 0.30,
    // D-13 additions — core
    crunch: 0.15,
    'sit-up': 0.35,
    'leg-raise': 0.30,
    'v-up': 0.40,
    'russian-twist': 0.20,
    'dead-bug': 0.15,
    'bird-dog': 0.15,
  };

  const TIMED_IDS = [
    'farmers-carry',
    'yoke-carry',
    'sled-push',
    'sled-pull',
    'plank',
    'battle-rope',
    // D-13 additions
    'bear-crawl',
    'sandbag-carry',
    'sled-drag',
    'shuttle-run',
    'ruck-carry',
    'keg-carry',
    'sledgehammer-swing',
    'weighted-vest-carry',
    'suitcase-carry',
    'overhead-carry',
    'mountain-climber',
    'side-plank',
  ];

  const ENDURANCE_IDS = [
    'run',
    'ski-erg',
    'rowing-erg',
    'assault-bike',
    // D-13 additions
    'cycling',
    'swimming',
    'stair-climber',
    'elliptical',
    'jump-rope',
    'incline-walk',
  ];

  it('every bodyweight movement has its literature-anchored bwFactor and entryMode "reps"', () => {
    for (const [id, factor] of Object.entries(BODYWEIGHT_FACTORS)) {
      const entry = byId.get(id);
      expect(entry, `missing seed entry for ${id}`).toBeDefined();
      expect(entry?.bwFactor, `bwFactor mismatch for ${id}`).toBe(factor);
      expect(entry?.entryMode, `entryMode mismatch for ${id}`).toBe('reps');
    }
  });

  it('pull-up has bwFactor 0.95 and entryMode "reps"', () => {
    const pullUp = byId.get('pull-up');
    expect(pullUp?.bwFactor).toBe(0.95);
    expect(pullUp?.entryMode).toBe('reps');
  });

  it('farmers-carry has entryMode "timed" and bwFactor null', () => {
    const farmersCarry = byId.get('farmers-carry');
    expect(farmersCarry?.entryMode).toBe('timed');
    expect(farmersCarry?.bwFactor).toBeNull();
  });

  it('every timed movement has entryMode "timed" and bwFactor null', () => {
    for (const id of TIMED_IDS) {
      const entry = byId.get(id);
      expect(entry, `missing seed entry for ${id}`).toBeDefined();
      expect(entry?.entryMode, `entryMode mismatch for ${id}`).toBe('timed');
      expect(entry?.bwFactor, `bwFactor should be null for ${id}`).toBeNull();
    }
  });

  it('every endurance-type seed row has bwFactor null and entryMode null (Pitfall 5)', () => {
    for (const id of ENDURANCE_IDS) {
      const entry = byId.get(id);
      expect(entry, `missing seed entry for ${id}`).toBeDefined();
      expect(entry?.type, `expected endurance type for ${id}`).toBe('endurance');
      expect(entry?.bwFactor, `bwFactor should be null for endurance row ${id}`).toBeNull();
      expect(entry?.entryMode, `entryMode should be null for endurance row ${id}`).toBeNull();
    }
  });

  it('workout table definition contains finished_at and deleted_at columns', async () => {
    const { workout } = await import('../schema');
    expect(workout.finishedAt).toBeDefined();
    expect(workout.deletedAt).toBeDefined();
  });
});
