# Phase 2: HSS Engine (the moat) - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 7 (5 engine modules grouped, plus shared types, db schema, migration, README, tests)
**Analogs found:** 7 / 7 (every new/modified file has an in-repo analog — no greenfield patterns needed)

This phase is almost entirely *internal* to `packages/engine` (pure TS) plus three small
ripples: extend `packages/shared` types, add one column to `packages/db` schema + generate a
migration, and add a README. All analogs are in `packages/db`, `packages/shared`, the root
tsconfig chain, and the existing vitest wiring. Because the engine is pure-TS with zero runtime
deps, the dominant patterns are: **barrel exports**, **strict-TS tsconfig compliance**, **named
tunable constants**, and **vitest golden-case tests** — not auth/CRUD/HTTP concerns.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/engine/src/index.ts` (rewrite barrel) | barrel/config | transform | `packages/db/src/index.ts` | exact (barrel) |
| `packages/engine/src/*.ts` (strength, endurance, hss, trend, readiness, e1rm, config) | pure-compute module | transform | `packages/db/src/seed.ts` (module + named const export) | role-match |
| `packages/engine/src/__tests__/*.test.ts` (≥20 tests) | test | transform | `packages/db/src/__tests__/seed.test.ts` | exact |
| `packages/shared/src/index.ts` (extend) | model/types | n/a | existing types in same file (lines 6-16) | exact (self) |
| `packages/db/src/schema.ts` (add `config_version`) | model/schema | n/a | `load_daily` table + columns in same file (lines 111-132) | exact (self) |
| `packages/db/drizzle/0001_*.sql` + meta (generate) | migration | n/a | `packages/db/drizzle/0000_mushy_satana.sql` + `_journal.json` | exact (tool-generated) |
| `packages/engine/README.md` (new) | docs | n/a | no README exists — use module doc-comment style (below) | no-analog (convention only) |

## Pattern Assignments

### `packages/engine/src/index.ts` — barrel rewrite (barrel/config, transform)

**Analog:** `packages/db/src/index.ts` (full file)

The db barrel is the canonical pattern: a top doc-comment describing re-export order, then
grouped `export` / `export *` / `export { ... }` / `export type` lines with intent comments.
The engine barrel must surface every public symbol from BUILD.md §4.1 plus `DEFAULT_CONFIG`,
`CONFIG_VERSION`, `ENGINE_VERSION`, and `epley1RM`.

**Re-export pattern to copy** (`packages/db/src/index.ts` lines 13-23):
```typescript
// Schema table references
export * from './schema';

// db singleton and DB type alias
export { db, type DB } from './client';

// Idempotent exercise seed
export { STARTER_EXERCISES, seedExercises } from './seed';
```

**Keep the existing version-constant pattern** (`packages/engine/src/index.ts` line 8) — keep/raise
`ENGINE_VERSION`, and add `CONFIG_VERSION` alongside it per D-08:
```typescript
export const ENGINE_VERSION = '0.0.1' as const;
```

Note: the current engine barrel *is* the implementation file. Decompose into focused modules
(`strength.ts`, `endurance.ts`, `hss.ts`, `trend.ts`, `readiness.ts`, `e1rm.ts`, `config.ts`) and
make `index.ts` a pure barrel like `db/src/index.ts` — internal file structure is explicitly
Claude's Discretion (CONTEXT D, line 98).

---

### `packages/engine/src/*.ts` — compute modules (pure-compute, transform)

**Analog:** `packages/db/src/seed.ts` (module header + named const export pattern, lines 1-25)

**Module doc-comment + named-export pattern** (`packages/db/src/seed.ts` lines 1-25):
```typescript
/**
 * @apsis/db — exercise library seed data
 *
 * STARTER_EXERCISES: >= 40 HYROX / tactical / strength / conditioning movements.
 * ...
 */
import { sql } from 'drizzle-orm';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { exercise } from './schema';

export const STARTER_EXERCISES = [ /* ... */ ];
```

**Imports pattern for engine modules:** Engine is zero-runtime-deps, so imports are limited to
(a) `import type { ... } from '@apsis/shared'` for input/config types, and (b) relative imports
between engine modules (`import { DEFAULT_CONFIG } from './config'`). The `@apsis/shared` alias is
already wired in both `tsconfig.json` (line 9) and `vitest.config.mts` (line 7) — see Shared
Patterns. Do NOT add any runtime dependency (BUILD.md §4.4: "Zero dependencies").

**Core compute pattern (the formulas — BUILD.md §4.2):** Each exported function takes its data
plus an optional `cfg?: EngineConfig` defaulting to `DEFAULT_CONFIG`, and returns a `number` (or
the `{ atl, ctl, tsb }` object for `computeLoadTrend`). Exact signatures are locked in
BUILD.md §4.1 (lines 141-159) — copy them verbatim. Encode all thresholds/factors as **named
tunable constants** (BUILD.md §4.2 line 174-175; D-06), e.g. readiness cutoffs `-0.30` / `-0.10`
as named consts, `defaultRpe`/`ctlCalibrationThreshold` as new `EngineConfig` fields (D-03, D-09).

**Guard pattern:** `computeReadiness`/`readinessBand` must guard the `CTL = 0` divide (D-06) —
that path returns `'calibrating'` via the `ctl < cfg.ctlCalibrationThreshold` check (D-03/D-05)
before any `TSB/CTL` division.

**Error handling:** There is no try/catch or thrown-error convention in this codebase's pure
modules — the engine deals in numbers, not failure. Prefer total functions (sane defaults, guarded
divides) over throwing. Missing RPE → `defaultRpe` (D-09); CTL=0 → calibrating (D-03).

---

### `packages/engine/src/__tests__/*.test.ts` — vitest golden tests (test, transform)

**Analog:** `packages/db/src/__tests__/seed.test.ts` (full file) and
`packages/engine/src/__tests__/placeholder.test.ts` (the smoke test to replace)

**Globals are on** (`vitest.config.mts` line 11 `globals: true`) — use `describe`/`it`/`expect`
with NO imports of test functions. Import only the code under test.

**Test structure pattern** (`packages/db/src/__tests__/seed.test.ts` lines 1-23):
```typescript
/**
 * Seed data unit tests — verifies ... meets DATA-02 requirements.
 */
import { STARTER_EXERCISES } from '../seed';

const REQUIRED_IDS = [/* ... */] as const;

describe('STARTER_EXERCISES seed data', () => {
  it('has >= 40 entries', () => {
    expect(STARTER_EXERCISES.length).toBeGreaterThanOrEqual(40);
  });
  // custom assertion-message pattern:
  it('...', () => {
    expect(ids.has(required), `missing required movement: ${required}`).toBe(true);
  });
});
```

**Test file location:** `packages/engine/src/__tests__/` (matched by `include` glob in
`vitest.config.mts` line 13: `src/**/*.{test,spec}.{ts,mts}`). Tests are excluded from the build
tsconfig (`packages/engine/tsconfig.json` line 16 `"exclude": ["src/**/__tests__"]`).

**Required test coverage (BUILD.md §4.4 + CONTEXT decisions):**
- ≥ 20 tests total; golden cases: known lift session, known run, double-day (doublePenalty),
  rest-week ATL/CTL decay.
- **Calibration test (D-01/D-02):** assert `runHSS / liftHSS ∈ [1.05, 1.75]` (±25% of the 1.4×
  target) — tune `kStrength`/`kEndurance` until green.
- **Cold-start test (D-04):** a single moderate session yields `computeReadiness(...) === 'calibrating'`
  and **never** `'red'`.
- **Replace** `packages/engine/src/__tests__/placeholder.test.ts` with real golden tests
  (CONTEXT line 147-148).

---

### `packages/shared/src/index.ts` — extend with engine types (model/types)

**Analog:** the existing type declarations in the SAME file (lines 6-16)

**Pattern to extend** (`packages/shared/src/index.ts` lines 1-16): JSDoc-commented exported
`type`/`interface` declarations, pure TS, zero deps. Add `StrengthSet`, `EnduranceSegment`,
`EngineConfig` here per BUILD.md §4.1 line 113 ("types live in packages/shared"). Copy the exact
interface shapes from BUILD.md §4.1 lines 114-136, and EXTEND `EngineConfig` with the new tunable
fields the decisions require:
- `ctlCalibrationThreshold: number` (default 10, D-03)
- `defaultRpe: number` (default 8, D-09)
- `configVersion: number` carried by `DEFAULT_CONFIG` (D-08; `CONFIG_VERSION` const lives in engine)

```typescript
/** Readiness traffic-light band derived from ATL/CTL/TSB */
export type ReadinessBand = 'green' | 'amber' | 'red' | 'calibrating';
```
`ReadinessBand` already exists (line 13) and already includes `'calibrating'` — `computeReadiness`
returns this exact union (D-05). Reuse it; do not redefine.

**Strict-TS note:** these interfaces are consumed by the engine compiled under
`exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` (see Shared Patterns). Optional fields
on `sessionHSS` input (`strengthSets?`, `enduranceSegments?`) must be handled with that in mind.

---

### `packages/db/src/schema.ts` — add `config_version` to `load_daily` (model/schema)

**Analog:** the `load_daily` table definition + sibling columns in the SAME file (lines 111-132)

**Column pattern to copy** (`packages/db/src/schema.ts` lines 117-122) — `real(...).default(...)`
with a JSDoc intent comment:
```typescript
dayHss: real('day_hss').default(0),
atl: real('atl').default(0),
ctl: real('ctl').default(0),
tsb: real('tsb').default(0),
readinessBand: text('readiness_band', {
  enum: ['green', 'amber', 'red', 'calibrating'],
}),
```

Add a column following this exact style (snake_case DB name, camelCase key, JSDoc comment, sensible
default matching `CONFIG_VERSION` start value of 1):
```typescript
/** Constant-set version that produced this row — enables post-launch re-fit (D-08) */
configVersion: integer('config_version').default(1),
```
Use `integer(...)` (import already present, line 16) since `CONFIG_VERSION` starts at `1`. Keep the
column inside the existing table-body object; the `(table) => ({ dateIdx: ... })` index block
(lines 125-131) stays unchanged.

---

### `packages/db/drizzle/0001_*.sql` + meta — generate migration (migration)

**Analog:** `packages/db/drizzle/0000_mushy_satana.sql`, `drizzle/meta/_journal.json`,
`drizzle/migrations.js` (all tool-generated)

**This is a generated artifact — never hand-write it.** The workflow is documented authoritatively
in three places already in the repo:

- `packages/db/drizzle.config.ts` lines 19-26 — config (`dialect: 'sqlite'`, **`driver: 'expo'`** —
  CRITICAL, any other driver silently produces empty DBs per RESEARCH Pitfall 5). Run command:
  ```
  cd packages/db && npx drizzle-kit generate
  ```
- `packages/db/src/migrations.ts` lines 13-19 — append-only rule: "drizzle/ is append-only; run
  `npx drizzle-kit generate` after schema changes" and "never hand-edit migrations.js".
- `_journal.json` (current state): one entry, `idx: 0`, `tag: "0000_mushy_satana"`. Generation will
  append `idx: 1` and a new `0001_*.sql` automatically.

**Planner sequencing (D-08, CONTEXT lines 86-90) — MUST be ordered this way:**
1. Edit `schema.ts` (add `config_version` column).
2. `npx drizzle-kit generate` from `packages/db` → produces `0001_*.sql` + updates `meta/`.
3. Commit the generated migration (it ships bundled; run via `useMigrations()`, NOT pushed to a
   live DB — `migrations.ts` lines 5-8).
4. Engine emits `CONFIG_VERSION`; db `recomputeLoadDaily()` writes it (Phase 3 wiring — out of scope
   here, but the column must exist now).

The mobile babel/metro inline-`.sql` plumbing is already wired (Plan 01-02, noted in
`migrations.ts` lines 16-18) — no config changes needed for the new migration to load.

---

### `packages/engine/README.md` — formula/constant docs (docs)

**Analog:** No README exists anywhere in the repo (`Glob README.md` → none). Use the established
**module doc-comment voice** instead (see `packages/db/src/schema.ts` lines 1-14 and
`packages/db/src/seed.ts` lines 1-15): purpose line, then per-item explanation with the governing
constraint/requirement ID in parens.

BUILD.md §4.4 (line 191) requires: "A short `packages/engine/README.md` documenting each formula and
constant." Content to document (pull verbatim from BUILD.md §4.2-§4.3):
- Each formula: endurance `ES = durationMin * IF^2 * kEndurance`; per-set strength
  `(loadKg/e1rmKg) * reps * rpeFactor` with `legMultiplier`; session `ES + SS`; daily sum +
  `doublePenalty`; ATL/CTL EWMA; `TSB = CTL − ATL`; readiness bands on `TSB/CTL`.
- Each `EngineConfig` constant + its `DEFAULT_CONFIG` value, including the new `ctlCalibrationThreshold`
  (10), `defaultRpe` (8), and `CONFIG_VERSION` (1).
- The calibration target (1.4× run-vs-lift, D-01/D-02) and the cold-start `calibrating` rule (D-03).

## Shared Patterns

### Strict-TS tsconfig compliance (engine is the moat — over-typed)
**Source:** `packages/engine/tsconfig.json` + `tsconfig.base.json`
**Apply to:** all `packages/engine/src/*.ts` and the new `packages/shared` types

The base (`tsconfig.base.json` lines 2-12) sets `"strict": true` plus `composite`, `declaration`,
`declarationMap`. The engine project ADDS the two extra strictness flags PROJECT.md mandates:
```json
// packages/engine/tsconfig.json lines 4-10
"exactOptionalPropertyTypes": true,
"noUncheckedIndexedAccess": true,
"paths": { "@apsis/shared": ["../shared/src/index.ts"] }
```
Practical implications for the engine code:
- `noUncheckedIndexedAccess`: array element access (e.g. `dailyHSSByDay[i]` in `computeLoadTrend`)
  yields `T | undefined` — guard or assert. Critical for the EWMA loop.
- `exactOptionalPropertyTypes`: `sessionHSS`'s `strengthSets?` / `enduranceSegments?` optional props
  cannot be assigned `undefined` explicitly — use presence checks.

### Project-reference + path-alias wiring (already in place — do not re-add)
**Source:** `packages/engine/tsconfig.json` lines 8-14, root `tsconfig.json` lines 3-8
**Apply to:** engine consuming `@apsis/shared`

The engine already references shared via tsconfig `references: [{ "path": "../shared" }]` (line 13)
and the `@apsis/shared` path alias (line 9). Root `tsconfig.json` orders refs shared → engine → db →
mobile (lines 4-7). **No wiring changes needed** for this phase — the engine→shared edge exists.
The db→engine edge also already exists (`packages/db/tsconfig.json` lines 8, 13) for Phase 3.

### Vitest config (already wired — tests just need writing)
**Source:** `packages/engine/vitest.config.mts`
**Apply to:** all engine test files
```typescript
// vitest.config.mts — globals on, node env, @apsis/shared aliased for test runtime
resolve: { alias: { '@apsis/shared': path.resolve(__dirname, '../shared/src/index.ts') } },
test: { globals: true, environment: 'node', include: ['src/**/*.{test,spec}.{ts,mts}'] },
```
Run via `pnpm --filter @apsis/engine test` (`package.json` line 8: `"test": "vitest run"`).
Typecheck gate (BUILD.md §4.4): `tsc --noEmit` must also be green.

### Named-tunable-constant convention
**Source:** D-06 (CONTEXT lines 58-61) + BUILD.md §4.2 line 174-175
**Apply to:** readiness module, config module

All magic numbers (readiness cutoffs `-0.30`/`-0.10`, the 1.4× calibration target, `defaultRpe`,
`ctlCalibrationThreshold`) must be named constants — either fields on `EngineConfig` (when tunable
per-config and version-tracked) or module-level named `const`s (when structural). This is what makes
the post-launch re-fit (D-08) and the calibration tuning (D-02) tractable.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/engine/README.md` | docs | n/a | No README exists in the repo. Use the module doc-comment voice from `schema.ts`/`seed.ts` headers; content is fully specified by BUILD.md §4.2-§4.4. |

Everything else has a strong in-repo analog. There are NO HTTP/auth/CRUD/streaming concerns in this
phase — it is pure synchronous numeric transform code, so the usual controller/middleware/service
pattern categories do not apply.

## Metadata

**Analog search scope:** `packages/engine`, `packages/db`, `packages/shared`, root `tsconfig.json`,
`tsconfig.base.json`, drizzle migration artifacts.
**Files scanned:** 20 (all source/config files across the three packages + root tsconfigs).
**Pattern extraction date:** 2026-06-30
