/**
 * dedupe-candidate-query.test.ts — HK-03/D-06 dedupe-candidate query SQL-generation tests.
 *
 * Uses drizzle's `sqlite-proxy` driver purely for `.toSQL()` generation — no real
 * connection is ever opened. op-sqlite JSI requires a physical device and must never
 * be imported in vitest (see client.ts).
 *
 * Threat: T-05-04 (Tampering) — asserts candidatesForDedupe deliberately omits any
 * deleted_at filter so soft-deleted (tombstoned) imported rows still block re-import
 * (Pitfall 9), and T-05-05 — asserts parameters are bound, never interpolated.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../schema';
import { candidatesForDedupe } from '../queries';

const mockDb = drizzle(async () => ({ rows: [] }), { schema });

describe('candidatesForDedupe', () => {
  it('does NOT filter on deleted_at — tombstoned rows must still be visible (Pitfall 9)', () => {
    const { sql } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();
    // WR-05: deleted_at IS selected (so display callers can exclude tombstones), but the
    // WHERE clause must stay deletedAt-blind so tombstoned rows still block re-import.
    const whereClause = sql.toLowerCase().split(' where ')[1] ?? '';
    expect(whereClause).not.toContain('deleted_at');
  });

  it('selects deleted_at so display callers can exclude soft-deleted tombstones (WR-05)', () => {
    const { sql } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();
    expect(sql.toLowerCase()).toContain('"workout"."deleted_at"');
  });

  it('filters on local_date and activity_type', () => {
    const { sql } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('local_date');
    expect(lower).toContain('activity_type');
  });

  it('binds localDate and activityType as parameters, never interpolated into the SQL string', () => {
    const { sql, params } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();

    expect(sql).not.toContain('2026-07-11');
    expect(sql).not.toContain("'run'");
    expect(params).toContain('2026-07-11');
    expect(params).toContain('run');
  });

  it('selects durationS and healthkitUuid for tolerance comparison', () => {
    const { sql } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();
    const lower = sql.toLowerCase();

    expect(lower).toContain('duration_s');
    expect(lower).toContain('healthkit_uuid');
  });

  it('selects source so callers classify manual rows by provenance, never by uuid nullability (CR-01)', () => {
    const { sql } = candidatesForDedupe(mockDb, '2026-07-11', 'run').toSQL();
    const lower = sql.toLowerCase();

    // A written-back manual run carries Apsis's own write-back uuid, so healthkitUuid
    // nullability cannot distinguish manual from imported rows — `source` must be selected.
    expect(lower).toContain('"workout"."source"');
  });
});
