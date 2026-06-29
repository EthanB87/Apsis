# Architecture Research

**Domain:** Local-first Expo monorepo — hybrid athlete training tracker
**Researched:** 2026-06-29
**Confidence:** MEDIUM (Expo SDK/Metro patterns verified via official docs; derived-table recompute pattern synthesized from drizzle + data-flow research)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   apps/mobile (Expo RN, iOS-first)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Log screens │  │  Home screen │  │  HealthKit adapter   │  │
│  │  (lift/run)  │  │  HSS trend   │  │  (Phase 2 only)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │  Zustand store / React Query — UI state + query cache     │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │ useLiveQuery / mutations           │
└─────────────────────────────┼───────────────────────────────────┘
                              │
        ┌─────────────────────▼──────────────────────┐
        │          packages/db (SQLite + Drizzle)     │
        │  insertWorkout · insertStrengthSet          │
        │  insertEnduranceSegment · recomputeLoadDaily│
        │  useLiveQuery on workout + load_daily       │
        └────────┬────────────────────────────────────┘
                 │ calls engine functions for HSS/readiness
        ┌────────▼──────────────────┐
        │  packages/engine          │
        │  (pure TS — the moat)     │
        │  Zero deps. No I/O.       │
        │  Time passed in.          │
        │  Tested: vitest only.     │
        └────────┬──────────────────┘
                 │ imports types from
        ┌────────▼──────────────────┐
        │  packages/shared          │
        │  Types only.              │
        │  StrengthSet, EnduranceSeg│
        │  EngineConfig, etc.       │
        └───────────────────────────┘
```

### Component Boundaries (strict import rules)

| Package | Imports From | Must NOT Import |
|---------|-------------|-----------------|
| `packages/shared` | nothing | anything |
| `packages/engine` | `packages/shared` (types) | React, RN, db, mobile, Date.now() |
| `packages/db` | `packages/shared`, `packages/engine` | React, RN, mobile |
| `apps/mobile` | all three packages | nothing special — it's the app |

**Engine purity rule:** `packages/engine/package.json` must have an empty (or absent) `dependencies` field. `packages/shared` is types-only and compiled away. The only dev dep in engine is `vitest`. Any reviewer can verify engine purity by running `cat packages/engine/package.json | jq .dependencies` and getting `{}` or `null`.

## Recommended Project Structure

```
apsis/                          # monorepo root
├── package.json                # pnpm workspaces declaration
├── pnpm-workspace.yaml         # packages: ['apps/*', 'packages/*']
├── .npmrc                      # node-linker=hoisted  ← critical for Metro
├── tsconfig.base.json          # shared TS settings (strict, target ESNext)
│
├── packages/
│   ├── shared/
│   │   ├── package.json        # name: "@apsis/shared", main: "src/index.ts"
│   │   ├── tsconfig.json       # extends base, composite: true
│   │   └── src/
│   │       └── index.ts        # re-exports all types
│   │
│   ├── engine/
│   │   ├── package.json        # name: "@apsis/engine", main: "src/index.ts"
│   │   │                       # dependencies: {} (zero!)
│   │   │                       # devDependencies: { vitest, typescript }
│   │   ├── tsconfig.json       # extends base, composite: true, refs shared
│   │   ├── vitest.config.ts    # minimal — no plugins needed for pure TS
│   │   └── src/
│   │       ├── index.ts        # re-exports public API
│   │       ├── strength.ts     # strengthStress()
│   │       ├── endurance.ts    # enduranceStress()
│   │       ├── session.ts      # sessionHSS(), dailyHSS()
│   │       ├── load.ts         # computeLoadTrend()
│   │       ├── readiness.ts    # readinessBand()
│   │       ├── config.ts       # DEFAULT_CONFIG, constants
│   │       └── __tests__/      # ≥20 vitest unit tests
│   │
│   └── db/
│       ├── package.json        # name: "@apsis/db", main: "src/index.ts"
│       │                       # deps: drizzle-orm, @op-engineering/op-sqlite
│       ├── tsconfig.json       # composite: true, refs shared + engine
│       ├── drizzle.config.ts   # dialect: sqlite, driver: expo
│       ├── drizzle/            # generated SQL migration files
│       └── src/
│           ├── schema.ts       # drizzle table definitions (§5 data model)
│           ├── client.ts       # open() + drizzle() singleton
│           ├── migrations.ts   # import migrations; export for useMigrations
│           ├── workouts.ts     # insertWorkout, getWorkout, listWorkouts
│           ├── sets.ts         # insertStrengthSet, listSetsForWorkout
│           ├── segments.ts     # insertEnduranceSegment
│           ├── load.ts         # recomputeLoadDaily() — calls engine
│           └── index.ts        # public API re-exports
│
└── apps/
    └── mobile/
        ├── package.json        # name: "@apsis/mobile"
        │                       # deps: expo, @apsis/shared, @apsis/engine, @apsis/db
        ├── tsconfig.json       # extends base, refs all packages
        ├── metro.config.js     # expo/metro-config (auto-monorepo SDK 52+)
        ├── babel.config.js     # babel-plugin-inline-import for .sql files
        ├── app.json            # Expo config
        └── src/
            ├── app/            # expo-router file-based routes
            ├── components/     # shared UI components
            ├── hooks/          # useLiveQuery wrappers, custom hooks
            └── store/          # Zustand slices
```

### Structure Rationale

- **`packages/shared` with `main: "src/index.ts"`:** Metro resolves TypeScript source directly — no compile step needed for the mobile app. Same source consumed by vitest in engine tests.
- **`packages/engine` with `main: "src/index.ts"`:** Metro bundles engine source as part of the mobile bundle. Vitest runs engine tests in Node via Vite transform — no build artifact needed.
- **`packages/db` calling engine:** Keeps all HSS computation logic out of the mobile layer. `recomputeLoadDaily()` in db is the single place where engine functions are called for persistence.
- **`drizzle/` directory in packages/db:** Migration SQL files generated here by `drizzle-kit generate`, then inlined into the bundle via `babel-plugin-inline-import`.

## Architectural Patterns

### Pattern 1: Engine as Pure Function Module (the moat)

**What:** Every engine function takes all inputs as arguments, including any time-sensitive values. No module-level state. No singletons. No `Date.now()` inside the engine.

**When to use:** Always, for everything in `packages/engine`.

**Trade-offs:** Slightly more verbose call sites (caller must pass `now` / `dailyHSSByDay` array), but completely deterministic — unit tests run at any time and produce the same output.

**Example:**
```typescript
// packages/engine/src/load.ts
export function computeLoadTrend(
  dailyHSSByDay: number[],  // oldest → newest; caller builds from DB
  cfg: EngineConfig = DEFAULT_CONFIG
): { atl: number; ctl: number; tsb: number } {
  // EWA computation — no Date.now(), no I/O
  let atl = 0, ctl = 0;
  const atlDecay = 1 - 1 / cfg.atlDays;
  const ctlDecay = 1 - 1 / cfg.ctlDays;
  for (const hss of dailyHSSByDay) {
    atl = atl * atlDecay + hss * (1 - atlDecay);
    ctl = ctl * ctlDecay + hss * (1 - ctlDecay);
  }
  return { atl, ctl, tsb: ctl - atl };
}
```

### Pattern 2: Write → Recompute → useLiveQuery Reactive Chain

**What:** After any write to `workout`, `strength_set`, or `endurance_segment`, synchronously call `recomputeLoadDaily()` in the same db transaction or immediately after. `useLiveQuery` on `load_daily` then drives UI updates automatically.

**When to use:** Every save operation in the app. This is the core feedback loop.

**Trade-offs:** Recomputing `load_daily` on every set save adds a small overhead (~1ms for 30 days of data). Acceptable for v1.0; can be debounced later if needed.

**Example (db layer):**
```typescript
// packages/db/src/load.ts
import { sessionHSS, dailyHSS, computeLoadTrend, readinessBand } from '@apsis/engine';

export async function recomputeLoadDaily(
  db: DrizzleDB,
  localDate: string,        // YYYY-MM-DD — the date that changed
  cfg: EngineConfig = DEFAULT_CONFIG,
  lookbackDays = 35          // enough for 28-day CTL + buffer
): Promise<void> {
  // 1. Fetch all workout HSS values in the window
  const rows = await db.query.workout.findMany({
    where: between(workout.localDate, dateMinus(localDate, lookbackDays), localDate),
    orderBy: asc(workout.localDate),
  });

  // 2. Build daily HSS array (one entry per calendar day, 0 for rest days)
  const dailyMap = buildDailyMap(rows, localDate, lookbackDays);
  const dailyHSSValues = dailyMap.map(({ scores }) => dailyHSS(scores, cfg));

  // 3. Call engine — no I/O inside
  const { atl, ctl, tsb } = computeLoadTrend(dailyHSSValues, cfg);
  const band = readinessBand(tsb, ctl);

  // 4. Upsert load_daily for the target date
  await db.insert(loadDaily)
    .values({ localDate, dayHss: dailyHSSValues.at(-1) ?? 0, atl, ctl, tsb, readinessBand: band })
    .onConflictDoUpdate({ target: loadDaily.localDate, set: { dayHss, atl, ctl, tsb, readinessBand: band } });
}
```

### Pattern 3: Instant In-Screen Feedback Before Save

**What:** Call `sessionHSS()` directly from the mobile UI layer on every set entry, before saving to SQLite, to show a live preview HSS. On save, the db layer computes the authoritative value and writes it.

**When to use:** The lift logging screen only — avoids a round-trip to SQLite for every keystroke.

**Trade-offs:** Two calls to `sessionHSS()` (one transient in UI, one authoritative in db). Because engine is pure, both calls with the same inputs produce the same result.

**Example:**
```typescript
// apps/mobile/src/hooks/useSessionHSS.ts
import { sessionHSS } from '@apsis/engine';

export function useSessionHSS(sets: StrengthSet[], segments: EnduranceSegment[]) {
  return useMemo(
    () => sessionHSS({ strengthSets: sets, enduranceSegments: segments }),
    [sets, segments]
  );
}
```

## Data Flow

### Primary Flow: "User Logs a Set" → UI Update

```
User taps "Add Set" (load, reps, RPE entered)
    │
    ▼
[mobile/src] useSessionHSS() → engine.sessionHSS()
  → live HSS preview shown (instant, no DB round-trip)
    │
User taps "Save Set"
    │
    ▼
[packages/db] insertStrengthSet(setData)
    │   ├─ INSERT INTO strength_set
    │   └─ UPDATE workout SET hss = sessionHSS(allSetsForWorkout)
    │
    ▼
[packages/db] recomputeLoadDaily(db, localDate)
    │   ├─ SELECT workouts in 35-day window
    │   ├─ engine.dailyHSS(sessionScores)    ← pure TS engine
    │   ├─ engine.computeLoadTrend(dailyArr)  ← pure TS engine
    │   ├─ engine.readinessBand(tsb, ctl)     ← pure TS engine
    │   └─ UPSERT load_daily
    │
    ▼
[packages/db] drizzle useLiveQuery detects write to load_daily + workout
    │
    ▼
[mobile/src] Home screen component re-renders
    │   ├─ Today's HSS (from workout.hss)
    │   ├─ Readiness band (from load_daily.readinessBand)
    │   └─ 14-30 day chart (from load_daily.atl / ctl / tsb)
    ▼
User sees updated HSS and readiness in <100ms
```

### State Management

```
SQLite (source of truth)
    │
    ▼ useLiveQuery (drizzle-orm reactive hook)
    │
    ├─► workout table queries   → lift/run log list screens
    ├─► load_daily table query  → home screen HSS trend + readiness band
    └─► user_profile query      → onboarding / settings screens

Zustand: transient UI state only
    ├─ current set being entered (not persisted until save)
    ├─ active workout session draft
    └─ UI toggles (unit system, active tab)
```

### Key Data Flows

1. **Onboarding → engine:** User sets `sex`, `bodyweight`, `thresholdHr`, `thresholdPaceSecPerKm` in `user_profile`. These resolve `intensityFactor` for endurance segments and inform e1RM estimates. The engine never reads the DB — caller resolves these and passes computed values in.

2. **HealthKit import (Phase 2):** HealthKit workout → map to `endurance_segment` (resolve `intensityFactor` from HR vs `thresholdHr`) → `insertEnduranceSegment()` → `recomputeLoadDaily()`. Same path as manual entry after the mapping step.

3. **e1RM derivation:** Estimated via Epley formula from the heaviest logged set. Computed in the db layer (`packages/db/src/sets.ts`), not in engine. Updated when a new PR is logged. Stored on `strength_set.e1rmKg` at insert time.

## Monorepo Wiring

### pnpm Workspace Setup

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```ini
# .npmrc  ← most critical file for Metro compat
node-linker=hoisted
```

**Why hoisted?** Metro expects a flat `node_modules` structure. pnpm's default isolated linker creates symlinks that Metro's resolver cannot follow reliably without additional config. Hoisted mode makes all packages available at the root `node_modules`, matching npm/Yarn v1 behavior. This is the lowest-friction path.

**Alternative (non-hoisted):** Add to `metro.config.js`:
```js
config.resolver.unstable_enableSymlinks = true;
config.watchFolders = [path.resolve(__dirname, '../..'), 
                       path.resolve(__dirname, '../../node_modules/.pnpm')];
```
This works but adds config surface area. Use hoisted unless there's a specific reason not to.

### TypeScript Project References

```jsonc
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-native",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "skipLibCheck": true
  }
}

// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}

// packages/engine/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": { "@apsis/shared": ["../shared/src/index.ts"] }
  },
  "references": [{ "path": "../shared" }],
  "include": ["src"]
}

// packages/db/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@apsis/shared": ["../shared/src/index.ts"],
      "@apsis/engine": ["../engine/src/index.ts"]
    }
  },
  "references": [{ "path": "../shared" }, { "path": "../engine" }],
  "include": ["src"]
}
```

**Key:** `paths` in tsconfig point to TypeScript source (`src/index.ts`), not compiled `dist/`. This means `tsc --noEmit` and IDE navigation work from source. Metro also resolves from source via `"main": "src/index.ts"` in each `package.json`.

### Package.json Main Field

Each workspace package uses TypeScript source as the entry point:

```jsonc
// packages/engine/package.json
{
  "name": "@apsis/engine",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

Metro transpiles the TypeScript source directly as part of the bundle — no separate build step. Vitest also works against source (Vite transform handles TypeScript natively).

### Metro Configuration (apps/mobile/metro.config.js)

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// SDK 52+: monorepo detection is automatic.
// Only add overrides if you hit resolution issues.

// Required if using op-sqlite (drizzle SQL migration files)
config.resolver.sourceExts.push('sql');

module.exports = config;
```

SDK 52+ (`expo/metro-config`) auto-detects the monorepo root and configures `watchFolders` and `nodeModulesPaths` automatically. The `sql` extension addition is required for drizzle migration inline-import.

**Gotcha — singleton packages:** If Metro resolves two copies of `react` or `react-native` (one in root `node_modules`, one in `apps/mobile/node_modules`), you get "Invalid hook call" errors. Hoisted node-linker prevents this by ensuring only one copy exists. If you see this error, add:
```js
config.resolver.nodeModulesPaths = [path.resolve(__dirname, '../../node_modules')];
```

### Vitest Engine Test Setup (packages/engine/vitest.config.ts)

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@apsis/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',  // no DOM, no React — pure TS
  },
});
```

No React test renderer, no Babel transforms, no JSDOM. Vitest's Vite transform handles TypeScript natively. Tests run in milliseconds.

**Running tests:** `cd packages/engine && pnpm vitest run` or from root `pnpm --filter @apsis/engine test`.

### Babel Configuration (apps/mobile/babel.config.js)

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['inline-import', { extensions: ['.sql'] }],  // for drizzle migrations
  ],
};
```

The `babel-plugin-inline-import` is required only in `apps/mobile` — the db package does not need Babel. The SQL files in `packages/db/drizzle/` are bundled into the app this way.

## Build Order and Why

```
Phase 0: packages/shared → packages/engine
Phase 1a: packages/db
Phase 1b: apps/mobile (scaffold only)
Phase 1c: apps/mobile feature-complete (lift + run + home screen)
Phase 2: apps/mobile HealthKit adapter
Phase 3: Polish + App Store
```

**Why shared first:** Engine and db both import from shared. Types must be defined before any logic that uses them.

**Why engine before db:** The db layer calls engine functions inside `recomputeLoadDaily()`. Engine must exist and be tested before db writes call into it.

**Why engine before mobile scaffold:** Even though the mobile app doesn't strictly need engine during scaffold, building the engine first de-risks the thesis (BUILD.md §4, §6 Phase 0 rationale). If the HSS model turns out to be unsatisfiable, you want to know before writing UI.

**Why db before mobile features:** The logging screens call db functions to save and query data. The home screen uses `useLiveQuery` on db tables. Mobile features are hollow without a working db layer.

**Why HealthKit last:** Pure platform integration; does not affect the engine or db contracts. Can be deferred to v1.1 without breaking anything else.

**Build commands per phase:**

```bash
# Phase 0 (engine)
cd packages/engine && pnpm vitest run   # validate engine
tsc --noEmit -p packages/engine/tsconfig.json

# Phase 1a (db schema)
cd packages/db && pnpm drizzle-kit generate  # generate migrations
tsc --noEmit -p packages/db/tsconfig.json

# All phases (type-check everything)
tsc --build tsconfig.json  # root references-based build

# Mobile (needs EAS / native build — no Expo Go for op-sqlite)
cd apps/mobile && npx expo run:ios
```

## Anti-Patterns

### Anti-Pattern 1: Date.now() Inside Engine

**What people do:** Call `new Date()` or `Date.now()` inside `computeLoadTrend()` to determine "how many days ago" a workout was.

**Why it's wrong:** Makes the function non-deterministic in tests. You can't golden-case a test without mocking the clock. The engine is the moat — it must be perfectly testable.

**Do this instead:** Have the db layer build the `dailyHSSByDay` array (one entry per calendar day, ordered oldest → newest, 0 for rest days) and pass the completed array to `computeLoadTrend()`. The engine never needs to know the current date.

### Anti-Pattern 2: Importing Engine or DB Directly in Mobile Components

**What people do:** Import `sessionHSS` from `@apsis/engine` deep inside a screen component and call `insertStrengthSet` directly from an onPress handler.

**Why it's wrong:** Scatters db calls across the component tree. Makes it impossible to guarantee `recomputeLoadDaily()` is called after every write. UI and data logic become entangled.

**Do this instead:** All persistence goes through a service hook in `apps/mobile/src/hooks/` that wraps db functions and always calls `recomputeLoadDaily()` after a write. UI calls the hook; hook calls db; db calls engine.

### Anti-Pattern 3: Metro Resolving Two Copies of React

**What people do:** Leave React as a dependency (not peerDependency) in a workspace package, or fail to configure `nodeModulesPaths` correctly.

**Why it's wrong:** Metro bundles two copies of `react`. Any hook in a shared package throws "Invalid hook call" at runtime.

**Do this instead:** Keep `react` and `react-native` as `peerDependencies` in any workspace package that uses them (db does not; engine does not; shared does not — only mobile declares them as direct deps). Use `node-linker=hoisted` to ensure a single copy at root `node_modules`.

### Anti-Pattern 4: Running op-sqlite in Expo Go

**What people do:** Try to run the development build in Expo Go to test database functionality.

**Why it's wrong:** op-sqlite is a JSI native module and is not supported in Expo Go. The app will crash at the `open()` call.

**Do this instead:** Use a development build from day one: `npx expo run:ios` or EAS Build. If rapid iteration without native builds is critical, use `expo-sqlite` instead of op-sqlite (simpler setup, Expo Go compatible, slightly lower performance). For v1.0 training data volumes, `expo-sqlite` is sufficient.

## Integration Points

### Internal Boundaries

| Boundary | Direction | Communication | Notes |
|----------|-----------|---------------|-------|
| mobile → db | mobile calls db | direct function import | all writes + queries go through db package |
| mobile → engine | mobile calls engine | direct function import | only for live in-screen preview (pre-save) |
| db → engine | db calls engine | direct function import | for `recomputeLoadDaily()` only |
| db → shared | both import | TypeScript types | no runtime coupling |
| engine → shared | engine imports | TypeScript types | StrengthSet, EnduranceSegment, EngineConfig |

### External Integrations

| Service | Integration Package | Location | Notes |
|---------|---------------------|----------|-------|
| HealthKit (Phase 2) | `@kingstinct/react-native-healthkit` | apps/mobile only | Requires native entitlement; not in engine or db |
| SQLite (runtime) | `@op-engineering/op-sqlite` | packages/db | JSI — needs native build |
| Migrations (build-time) | `drizzle-kit` | packages/db devDep | Generates SQL files; not bundled in app |
| Crash reporting (Phase 3) | Sentry (via Expo) | apps/mobile | Not in engine or db |

## Scaling Considerations

This is a single-user on-device app — traditional scaling (users, servers) does not apply. The relevant scaling axis is **data volume over time**.

| Data Scale | Concern | Approach |
|------------|---------|----------|
| 0–12 months usage (~365 workout days) | None — `recomputeLoadDaily` over 35-day window is fast | Keep as-is |
| 1–3 years usage (~1000+ workout days) | `computeLoadTrend` still O(n) over the window; window is fixed at 35 days — stays fast | No change needed |
| Historical import (3+ years of data) | Full history recompute on first import could take >100ms | Run in background; show stale readiness until complete |
| SQLite file size | Strength sets accumulate; 3 sets/workout × 4 workouts/week × 52 weeks = ~600 rows/year | Not a concern for 5+ years |

The only practical scaling concern for v1.0 is the HealthKit historical import (Phase 2): importing 1+ years of workouts should recompute `load_daily` in a background task, not on the main thread.

## Sources

- [Work with monorepos — Expo Documentation](https://docs.expo.dev/guides/monorepos/) — official Metro monorepo config for SDK 52+
- [metro.config.js — Expo Documentation](https://docs.expo.dev/versions/latest/config/metro/) — sourceExts and resolver options
- [Drizzle ORM — OP SQLite](https://orm.drizzle.team/docs/connect-op-sqlite) — setup guide, migration pattern
- [React Native Monorepo With pnpm Workspaces — Callstack](https://www.callstack.com/blog/react-native-monorepo-with-pnpm-workspaces) — singleton pinning, hoisted vs isolated
- [metro-resolver-symlinks — RNX Kit](https://microsoft.github.io/rnx-kit/docs/tools/metro-resolver-symlinks) — symlink resolution alternative to hoisted linker
- [Offline-First RN: SQLite + Drizzle 2026 — React Native Relay](https://reactnativerelay.com/article/building-offline-first-react-native-apps-2026-expo-sqlite-drizzle-orm-sync-strategies) — write → useLiveQuery reactive chain
- [TypeScript Project References — Nx Blog](https://nx.dev/blog/typescript-project-references) — composite, declarationMap, build order

---
*Architecture research for: Apsis — local-first Expo training tracker monorepo*
*Researched: 2026-06-29*
