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
 * D-29 (discarded sessions never appear in any HSS/load computation): this is delete-aware,
 * not upsert-only. An empty input set fully clears `load_daily` (last session deleted), and
 * every recompute also deletes any previously-persisted row whose `localDate` falls outside
 * the freshly computed range (e.g. the earliest session was deleted, shrinking the window).
 *

 * Security (T-1-01/RESEARCH A1/Open Question 1): the batch `onConflictDoUpdate` `excluded.*`
 * idiom is UNVERIFIED against drizzle-orm 0.45.2 + op-sqlite, so this implements the safe,
 * guaranteed-correct form instead — a loop of single-row upserts, each `set` using that row's
 * own LITERAL values, never a raw interpolated `sql` template and never an `excluded` reference.
 * Errors are console.error'd for diagnostics then re-thrown (T-04-05) — never swallowed.
 */

import { and, isNotNull, isNull, notInArray } from 'drizzle-orm';
import { computeLoadDailyUpsertRows, loadDaily, workout, type DB } from '@apsis/db';
import { todayLocalDate } from './localDate';

/**
 * Reads every finished, non-deleted workout's `{ localDate, hss }`, folds it through
 * `computeLoadDailyUpsertRows`, and upserts every returned row into `load_daily` keyed on
 * `localDate`. Fully clears `load_daily` when there are no finished sessions left, and
 * deletes any stale out-of-range row on every recompute (D-29).
 */
export async function recomputeLoadDaily(database: DB): Promise<void> {
  try {
    const rows = await database
      .select({ localDate: workout.localDate, hss: workout.hss })
      .from(workout)
      .where(and(isNotNull(workout.finishedAt), isNull(workout.deletedAt)));

    if (rows.length === 0) {
      // D-29: the last remaining session was deleted -- clear every load_daily row so
      // TODAY falls back to the empty/0 state instead of rendering a ghost HSS/band.
      await database.delete(loadDaily);
      return;
    }

    const sessions = rows.map((row) => ({ localDate: row.localDate, hss: row.hss ?? 0 }));
    const upsertRows = computeLoadDailyUpsertRows(sessions, todayLocalDate());

    // Range-shrink cleanup: computeLoadDailyUpsertRows re-anchors `firstDate` to the
    // earliest remaining session, so any previously-persisted load_daily row outside the
    // new output window is stale (e.g. the earliest session was deleted). Delete those
    // before upserting so a discarded session's row never lingers (D-29).
    const keep = upsertRows.map((r) => r.localDate);
    await database.delete(loadDaily).where(notInArray(loadDaily.localDate, keep));

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
