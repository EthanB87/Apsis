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
  it('has >= 40 entries', () => {
    expect(STARTER_EXERCISES.length).toBeGreaterThanOrEqual(40);
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
