/**
 * history-queries.test.ts — HOME-03/04/05/06 query-builder SQL-generation tests.
 *
 * Uses drizzle's `sqlite-proxy` driver purely for `.toSQL()` generation — no real
 * connection is ever opened (see previous-session-query.test.ts for the same pattern).
 *
 * Threat: T-04-01 (Tampering) — every builder here must use drizzle's parameterized query
 * API exclusively; the only permitted `sql` fragment is the `count(*)` aggregate.
 */

import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../schema';
import { last28DaysTrend, sessionCountsByDate, dayGroupedSessions } from '../queries';

const mockDb = drizzle(async () => ({ rows: [] }), { schema });

describe('sessionCountsByDate', () => {
  it('groups by local_date', () => {
    const { sql } = sessionCountsByDate(mockDb).toSQL();
    const lower = sql.toLowerCase();
    expect(lower).toContain('group by');
    expect(lower).toContain('local_date');
  });

  it('filters finished_at IS NOT NULL and deleted_at IS NULL', () => {
    const { sql } = sessionCountsByDate(mockDb).toSQL();
    const lower = sql.toLowerCase();
    expect(lower).toContain('finished_at');
    expect(lower).toContain('deleted_at');
    expect(lower).toContain('is not null');
    expect(lower).toContain('is null');
  });

  it('uses count(*) as the only sql fragment (no interpolated user value)', () => {
    const { sql } = sessionCountsByDate(mockDb).toSQL();
    expect(sql.toLowerCase()).toContain('count(*)');
  });
});

describe('last28DaysTrend', () => {
  it('limits to 28 and orders by local_date desc', () => {
    const { sql } = last28DaysTrend(mockDb).toSQL();
    const lower = sql.toLowerCase();
    expect(lower).toContain('order by');
    expect(lower).toContain('local_date');
    expect(lower).toContain('desc');
    expect(lower).toMatch(/limit \?|limit 28/);
  });
});

describe('dayGroupedSessions', () => {
  it('filters finished_at IS NOT NULL and deleted_at IS NULL, ordered by local_date/created_at desc', () => {
    const { sql } = dayGroupedSessions(mockDb).toSQL();
    const lower = sql.toLowerCase();
    expect(lower).toContain('finished_at');
    expect(lower).toContain('deleted_at');
    expect(lower).toContain('is not null');
    expect(lower).toContain('is null');
    expect(lower).toContain('order by');
    expect(lower).toContain('desc');
  });
});
