/**
 * soft-delete.test.ts — D-28 discard/soft-delete query builder tests.
 *
 * Uses drizzle's `sqlite-proxy` driver purely for `.toSQL()` generation — no real
 * connection is ever opened (op-sqlite JSI requires a physical device).
 *
 * Threat: T-03-05 (Information Disclosure) — asserts every workout read path filters
 * `deletedAt IS NULL` via the shared `activeWorkoutFilter`, and T-03-03 (Tampering) —
 * asserts softDeleteWorkout binds its id parameter rather than interpolating it.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../schema';
import { previousSessionSet, selectActiveWorkouts, softDeleteWorkout } from '../queries';

const mockDb = drizzle(async () => ({ rows: [] }), { schema });

describe('soft-delete filtering (D-28)', () => {
  it('selectActiveWorkouts SQL contains deleted_at IS NULL', () => {
    const { sql } = selectActiveWorkouts(mockDb).toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('deleted_at');
    expect(lower).toContain('is null');
  });

  it('previousSessionSet SQL also contains deleted_at IS NULL', () => {
    const { sql } = previousSessionSet(mockDb, 'squat').toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('deleted_at');
    expect(lower).toContain('is null');
  });

  it('softDeleteWorkout sets deleted_at and binds the workout id as a parameter', () => {
    const deletedAt = new Date('2026-07-09T12:00:00Z');
    const { sql, params } = softDeleteWorkout(mockDb, 'workout-123', deletedAt).toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('deleted_at');
    expect(sql).not.toContain('workout-123');
    expect(params).toContain('workout-123');
  });
});
