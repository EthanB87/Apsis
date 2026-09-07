# Phase 2: HSS Engine - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 6 (new/modified)
**Analogs found:** 6 / 6 (all role-match or exact; codebase is a Phase-1 skeleton, no prior formula/compute code exists)

**Note:** No RESEARCH.md exists for this phase — pattern extraction is based entirely on CONTEXT.md
(`.planning/phases/02-hss-engine/02-CONTEXT.md`) and the existing Phase-1 skeleton in
`packages/engine`, `packages/shared`, and `packages/db`. Since no compute/formula code exists yet
anywhere in the repo, the closest real analogs are: (1) the engine's own Phase-1 skeleton files
(for module conventions, JSDoc header style, workspace wiring), and (2) `packages/db/src/seed.ts`
(for the only existing "pure logic + exported constant table + documented function" module in the
monorepo — closest stand-in for a formula/constants module even though its domain differs).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/shared/src/index.ts` (extend) | model (types) | transform | `packages/shared/src/index.ts` (itself, extend in place) | exact |
| `packages/engine/src/config.ts` (new — `EngineConfig`, `DEFAULT_CONFIG`) | config | transform | `packages/db/src/seed.ts` (exported const table pattern) | role-match |
| `packages/engine/src/strength.ts` (new — `strengthStress`, `sessionHSS`, `estimateE1RM`, detailed variants) | service (pure compute) | transform | `packages/engine/src/index.ts` (Phase-1 skeleton, JSDoc header + export style) | exact (module shell) |
| `packages/engine/src/endurance.ts` (new — `enduranceStress`, `ifFromPace`, `ifFromHR`, `resolveIF`) | service (pure compute) | transform | `packages/engine/src/index.ts` | exact (module shell) |
| `packages/engine/src/daily.ts` (new — `dailyHSS`) | service (pure compute) | transform | `packages/engine/src/index.ts` | exact (module shell) |
| `packages/engine/src/trend.ts` (new — `computeLoadTrend`, `computeLoadTrendSeries`, `readinessBand`) | service (pure compute) | batch (28-day window fold) | `packages/engine/src/index.ts` | exact (module shell) |
| `packages/engine/src/index.ts` (modify — re-export public API + `ENGINE_VERSION`) | config (barrel/public API) | transform | `packages/db/src/index.ts` (barrel export pattern) | role-match |
| `packages/engine/src/__tests__/*.test.ts` (new — replaces placeholder) | test | request-response (pure fn in/out assertions) | `packages/engine/src/__tests__/placeholder.test.ts`, `packages/db/src/__tests__/seed.test.ts` | exact |

## Pattern Assignments

### `packages/shared/src/index.ts` (extend)

**Analog:** itself (current state below) — extend in place, do not restructure.

**Full current file** (`packages/shared/src/index.ts` lines 1-16):
```typescript
/**
 * @apsis/shared — foundational shared types
 * Pure TypeScript; no runtime dependencies.
 */

/** Biological sex for engine calibration */
export type Sex = 'male' | 'female' | 'other';

/** Unit preference for display */
export type Units = 'metric' | 'imperial';

/** Readiness traffic-light band derived from ATL/CTL/TSB */
export type ReadinessBand = 'green' | 'amber' | 'red' | 'calibrating';

/** Activity type for workouts and segments */
export type ActivityType = 'strength' | 'endurance' | 'hybrid';
```

**Convention to copy:** one-line JSDoc directly above each exported type, no barrel re-export
indirection, alphabetical-ish grouping isn't enforced — group by domain with a blank line between
groups. Add engine input/output interfaces here per BUILD.md §5 (e.g. `SetInput`, `SessionInput`,
`SessionHSSResult`, `DailyHSSResult`, `LoadTrendPoint`) using the same one-line-JSDoc-per-type
style. Keep this file dependency-free (`packages/shared/package.json` has zero `dependencies`
fields at all — see below).

**package.json convention** (`packages/shared/package.json`, full file):
```json
{
  "name": "@apsis/shared",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```
No test script yet on `@apsis/shared` — if type-level tests are desired, wire vitest the same way
`@apsis/engine`'s package.json does (see below); otherwise leave as pure `.d.ts`-style types with
no runtime.

---

### `packages/engine/src/*.ts` (new compute modules: `config.ts`, `strength.ts`, `endurance.ts`, `daily.ts`, `trend.ts`)

**Analog:** `packages/engine/src/index.ts` (Phase-1 skeleton, full file):
```typescript
/**
 * @apsis/engine — pure TypeScript HSS compute engine
 * Zero runtime dependencies. Time is always passed in (never Date.now() inside).
 * Implementation arrives in Phase 2; this is the Phase 1 skeleton.
 */

/** Semantic version constant for the engine package */
export const ENGINE_VERSION = '0.0.1' as const;
```

**Header pattern to copy:** module-level JSDoc block stating package name, purity constraint
restatement ("Zero runtime dependencies... time passed in"), followed by one-line JSDoc per
export. Every new engine file (`config.ts`, `strength.ts`, `endurance.ts`, `daily.ts`, `trend.ts`)
should open with a similar block naming its specific formula responsibility (e.g. "Strength-side
HSS: e1RM-normalized load stress + Epley estimator").

**Import pattern for types from `@apsis/shared`** (per `tsconfig.json` path alias, lines 1-13 of
`packages/engine/tsconfig.json`):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@apsis/shared": ["../shared/src/index.ts"]
    }
  },
  "references": [{ "path": "../shared" }],
  "include": ["src"],
  "exclude": ["src/**/__tests__"]
}
```
New engine files should `import type { SessionInput, ... } from '@apsis/shared';` using this
alias — never a relative `../../shared/src` path.

**Constants/config table pattern** — closest analog is `packages/db/src/seed.ts`'s exported
const-table + documented function shape (full file already read above). Key transferable pieces:
- Top-of-file comment block documents *why* a value/shape exists and any known caveat
  (mirrors D-15/D-02's need to document clamp ranges and the CTL floor rationale).
- `as const` on literal-typed data arrays/objects (see `STARTER_EXERCISES ... as const`) — use the
  same for `DEFAULT_CONFIG` so its numeric literals stay narrowly typed and importable.
- Exported pure function takes all state as parameters (`seedExercises(db)` takes the db instance
  in rather than importing a singleton) — mirrors the engine's own "time passed in, no hidden
  state" rule; `EngineConfig` should be an optional last parameter on every compute function,
  merged over `DEFAULT_CONFIG` (D: "Config override merging" — Claude's Discretion item).

**No-throw / clamp-and-warn pattern (D-15):** no existing analog for this in the repo (no
validation code exists yet). Recommended shape based on D-05/D-15 language in CONTEXT.md — build
a shared internal helper (e.g. `packages/engine/src/clamp.ts`) used by all compute modules:
```typescript
export interface ClampResult<T> {
  value: T;
  warning?: string;
}
export function clampRange(value: number, min: number, max: number, label: string): ClampResult<number> {
  if (value < min) return { value: min, warning: `${label} ${value} below min ${min}, clamped` };
  if (value > max) return { value: max, warning: `${label} ${value} above max ${max}, clamped` };
  return { value };
}
```
Every detailed compute function (`sessionHSSDetailed`, etc.) collects these warnings into its
`warnings: string[]` field per D-05/D-15 — no analog exists, this is new engine-only infrastructure.

---

### `packages/engine/src/index.ts` (modify to re-export public API)

**Analog:** `packages/db/src/index.ts` — read for barrel-export convention.

Convert the current single-constant file into a barrel: keep `ENGINE_VERSION`, add
`export * from './config'`, `export * from './strength'`, `export * from './endurance'`,
`export * from './daily'`, `export * from './trend'` (or named re-exports of only the BUILD.md
public API surface if the team prefers a curated public API — Claude's Discretion per CONTEXT.md
"file/module organization" note).

---

### `packages/engine/src/__tests__/*.test.ts` (new test files)

**Analog:** `packages/engine/src/__tests__/placeholder.test.ts` (full file, to be replaced) and
`packages/db/src/__tests__/seed.test.ts` (structure for a more substantial suite — read its
`describe`/`it` grouping if deeper example needed, not reproduced here since placeholder.test.ts
already gives the minimal vitest 4 shape):
```typescript
import { ENGINE_VERSION } from '../index';

describe('@apsis/engine smoke test', () => {
  it('basic arithmetic passes', () => {
    expect(1 + 1).toBe(2);
  });

  it('ENGINE_VERSION is exported and is a string', () => {
    expect(typeof ENGINE_VERSION).toBe('string');
    expect(ENGINE_VERSION.length).toBeGreaterThan(0);
  });
});
```

**Convention to copy:** relative import from `'../index'` (the barrel), `describe` block per
module/concern, `it` block per behavior. Per D-16 (behavioral + a few goldens), organize new test
files by concern, not 1:1 with source files necessarily — e.g.
`strength.test.ts`, `endurance.test.ts`, `daily.test.ts`, `trend.test.ts`, `readiness.test.ts`,
`calibration.test.ts` (dedicated file for the D-13 ±25% golden test since CONTEXT.md calls it a
"first-class deliverable"). Delete `placeholder.test.ts` once real coverage replaces it (≥20 tests
per phase boundary).

**vitest config/scripts** — no dedicated `vitest.config.ts` exists for `@apsis/engine`; test script
is just `"test": "vitest run"` in `packages/engine/package.json` (full file):
```json
{
  "name": "@apsis/engine",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "test": "vitest run" },
  "devDependencies": {
    "typescript": "6.0.3",
    "vite": "^6.4.3",
    "vitest": "4.1.9"
  }
}
```
No changes needed to this file unless a `@apsis/shared` runtime/dev dependency needs declaring —
check whether `packages/engine/package.json` needs a `"dependencies": { "@apsis/shared": "workspace:*" }`
entry added (currently absent; only the TS path alias + project reference wire it, which may be
sufficient for a type-only pure-TS workspace, but add the workspace dependency entry if the build
tooling requires it for pnpm resolution — verify during planning/implementation, not decided here).

## Shared Patterns

### Pure-TS, zero-runtime-dependency package convention
**Source:** `packages/engine/package.json`, `packages/shared/package.json` (both shown in full
above — neither has a `dependencies` key with runtime packages)
**Apply to:** every new file in `packages/engine/src/*.ts`. No `Date.now()`, no I/O, no
side effects — all state (time, config) passed as function parameters.

### JSDoc module header convention
**Source:** `packages/engine/src/index.ts`, `packages/db/src/seed.ts`
**Apply to:** every new engine module — top-of-file block comment naming the module's
responsibility + any caveats/assumptions, then one-line JSDoc per exported symbol.

### `as const` literal tables for config/constants
**Source:** `packages/db/src/seed.ts` (`STARTER_EXERCISES = [...] as const`)
**Apply to:** `packages/engine/src/config.ts`'s `DEFAULT_CONFIG` object and any named constant
groups (band thresholds, CTL floor, `kEndurance`/`kStrength`).

### Workspace type-only cross-package imports via tsconfig path alias
**Source:** `packages/engine/tsconfig.json` `paths: { "@apsis/shared": [...] }`
**Apply to:** all engine files importing shared types — always `from '@apsis/shared'`, never a
relative path into the sibling package.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Clamp/warning helper (`clamp.ts` or inline per-module) | utility | transform | No validation/clamping code exists anywhere in the repo yet; D-15's "clamp + warnings, never throw" pattern is new engine-only infrastructure — design per BUILD.md + CONTEXT.md D-15, no codebase precedent to copy. |
| EWMA/ATL-CTL-TSB rolling computation (`trend.ts` internals) | service | batch | No time-series/rolling-window compute exists elsewhere in the codebase (DB layer is schema/seed only); implement directly from BUILD.md §4 formula spec, no local analog. |
| Readiness-band threshold logic (`readinessBand`) | service | transform | No prior banding/threshold logic exists in repo; build from D-01–D-04 spec directly. |

## Metadata

**Analog search scope:** `packages/engine/src`, `packages/shared/src`, `packages/db/src`
(entire monorepo `packages/*` — no `apps/` code exists yet per current repo state)
**Files scanned:** 11 (all non-node_modules `.ts` files in `packages/`)
**Pattern extraction date:** 2026-07-08
