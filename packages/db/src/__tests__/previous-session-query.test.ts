/**
 * previous-session-query.test.ts — LIFT-03/D-07 pre-fill query SQL-generation tests.
 *
 * Uses drizzle's `sqlite-proxy` driver purely for `.toSQL()` generation — no real
 * connection is ever opened. op-sqlite JSI requires a physical device and must never
 * be imported in vitest (see client.ts).
 *
 * Threat: T-03-03 (Tampering) — asserts previousSessionSet binds exerciseId as a
 * parameter rather than interpolating it into the SQL string.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../schema';
import { previousSessionSet } from '../queries';

const mockDb = drizzle(async () => ({ rows: [] }), { schema });

describe('previousSessionSet', () => {
  it('generates SQL with a deleted_at IS NULL filter, an order-by desc, and a limit of 1', () => {
    const { sql } = previousSessionSet(mockDb, 'squat').toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('deleted_at');
    expect(lower).toContain('is null');
    expect(lower).toContain('order by');
    expect(lower).toContain('desc');
    expect(lower).toMatch(/limit \?|limit 1/);
  });

  it('binds exerciseId as a parameter, never interpolated into the SQL string', () => {
    const { sql, params } = previousSessionSet(mockDb, 'squat').toSQL();

    expect(sql).not.toContain('squat');
    expect(params).toContain('squat');
  });

  it('filters on a finished (non-null finishedAt) workout', () => {
    const { sql } = previousSessionSet(mockDb, 'squat').toSQL();
    expect(sql.toLowerCase()).toContain('finished_at');
  });
});
