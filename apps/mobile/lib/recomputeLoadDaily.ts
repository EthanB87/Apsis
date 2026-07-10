/**
 * apps/mobile/lib/recomputeLoadDaily.ts
 *
 * The op-sqlite read + upsert wrapper around @apsis/db's pure `computeLoadDailyUpsertRows`
 * (RESEARCH Pattern 1 / Pitfall 1): every terminal write to `workout` (finish or discard) must
 * call this so `load_daily` reflects BOTH lifting and running sessions, not just runs.
 *
 * Mirrors `commitSet.ts`'s recompute-then-write shape at day scope: read every finished,
 * non-deleted workout's `{ localDate, hss }`, fold it through the engine-backed pure builder,
 * then upsert the full contiguous result into `load_daily`.
 *
 * Security (T-1-01/RESEARCH A1/Open Question 1): the batch `onConflictDoUpdate` `excluded.*`
 * idiom is UNVERIFIED against drizzle-orm 0.45.2 + op-sqlite, so this implements the safe,
 * guaranteed-correct form instead — a loop of single-row upserts, each `set` using that row's
 * own LITERAL values, never a raw interpolated `sql` template and never an `excluded` reference.
 * Errors are console.error'd for diagnostics then re-thrown (T-04-05) — never swallowed.
 */

import { and, isNotNull, isNull } from 'drizzle-orm';
import { computeLoadDailyUpsertRows, loadDaily, workout, type DB } from '@apsis/db';
import { todayLocalDate } from './localDate';

/**
 * Reads every finished, non-deleted workout's `{ localDate, hss }`, folds it through
 * `computeLoadDailyUpsertRows`, and upserts every returned row into `load_daily` keyed on
 * `localDate`. Returns early (no-op) when there are no finished sessions yet.
 */
export async function recomputeLoadDaily(database: DB): Promise<void> {
  try {
    const rows = await database
      .select({ localDate: workout.localDate, hss: workout.hss })
      .from(workout)
      .where(and(isNotNull(workout.finishedAt), isNull(workout.deletedAt)));

    if (rows.length === 0) {
      return;
    }

    const sessions = rows.map((row) => ({ localDate: row.localDate, hss: row.hss ?? 0 }));
    const upsertRows = computeLoadDailyUpsertRows(sessions, todayLocalDate());

    for (const row of upsertRows) {
      const updatedAt = new Date();
      await database
        .insert(loadDaily)
        .values({
          localDate: row.localDate,
          dayHss: row.dayHss,
          atl: row.atl,
          ctl: row.ctl,
          tsb: row.tsb,
          readinessBand: row.readinessBand,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: loadDaily.localDate,
          set: {
            dayHss: row.dayHss,
            atl: row.atl,
            ctl: row.ctl,
            tsb: row.tsb,
            readinessBand: row.readinessBand,
            updatedAt,
          },
        });
    }
  } catch (err: unknown) {
    console.error('[Apsis] Failed to recompute load_daily:', err);
    throw err;
  }
}
