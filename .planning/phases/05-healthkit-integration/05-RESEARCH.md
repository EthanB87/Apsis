# Phase 5: HealthKit Integration - Research

**Researched:** 2026-07-11
**Domain:** Apple HealthKit read/write integration (React Native / Expo, native module)
**Confidence:** MEDIUM-HIGH (library API verified against actual shipped package source; integration-with-existing-codebase findings verified against actual repo files)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Initial depth):** Initial import reaches back **90 days**.
- **D-02 (Ongoing sync):** Silent delta-check **on app foreground**. No background delivery, no manual-only button. Sync never blocks logging.
- **D-03 (Permission entry points):** BOTH a new **onboarding step** (new users) and a permanent **"Connect Apple Health" row in Settings**.
- **D-04 (Type mapping):** Running → `run`, Rowing → `erg`, broad cardio (cycling, HIIT, hiking, swimming, elliptical, …) → `conditioning` (duration + HR only, no pace). Exact `HKWorkoutActivityType` list is Claude's discretion.
- **D-05 (Strength excluded):** Apple Watch "Traditional Strength Training" workouts are **never imported**.
- **D-06 (Overlap rule):** Duplicate = **same localDate + same activity type + duration within ~±15%**. Manual entries have no time-of-day.
- **D-07 (Manual wins):** Manual entry wins on duplicate; HK import is skipped; existing data never mutated.
- **D-08 (Source badge):** Imported sessions get a mono "APPLE HEALTH" chip on session detail + History row. Requires a `workout.source` column migration.
- **D-09 (Reverse-order dupes):** Soft inline hint on the run form if an imported session already covers the date; never blocks save.
- **D-10 (Import notice):** Quiet transient mono notice on TODAY when a foreground sync imports sessions. Silent when nothing new.
- **D-11 (Echo exclusion):** Apsis must never re-import its own write-backs. Mechanics Claude's discretion; pairs with D-14's HK UUID tracking.
- **D-12 (Timing):** Write to Health **immediately on finish/save**, fire-and-forget. Failed write logs and never blocks. No retry queue in v1.0.
- **D-13 (Payload):** **Basics + HSS metadata, no calories.** Runs → running workout w/ distance+duration; lifts → traditional strength training w/ duration; session HSS attached as custom metadata key (e.g. `ApsisHSS`).
- **D-14 (Delete sync):** Soft-deleting an Apsis session also deletes our written HK sample. Requires storing the HK UUID per written workout.
- **D-15 (No backfill):** Write-back is go-forward only from connection time.
- **D-16 (Ongoing silent sync):** Each foreground sync pulls most-recent HK bodyweight; if newer than profile's, update silently.
- **D-17 (Conflict rule):** Most recent wins by timestamp — manual edit vs HK sample compete on recency. Requires persisting when profile bodyweight was last set.
- **D-18 (Import-only):** Settings bodyweight edits never written to Health. One-way; no bodyweight write permission requested.
- **D-19 (Connected = sheet completed):** Settings row shows "Connected" once the iOS permission sheet completes.
- **D-20 (Decline UX):** Onboarding step explicitly skippable ("Not now"); no re-prompts.
- **D-21 (Disconnect):** Settings row is a sync toggle — off pauses all HK reads/writes; already-imported sessions stay.
- **D-22 (First-run import):** 90-day import runs in background after onboarding permission grant; onboarding finishes immediately.
- **D-23 (Onboarding step placement):** HealthKit step is **appended as the last step, after review/save**.
- **D-24 (Sync status):** Settings shows "LAST SYNC 9:41 AM" from a persisted last-successful-sync value.
- **D-25 (Failure handling):** Sync/write failures are **silent** — log to console, last-synced timestamp stops advancing, next foreground sync retries naturally. No error banners.

### Claude's Discretion

- Exact `HKWorkoutActivityType` → activityType mapping table (D-04) and the duration tolerance constant for dedupe (D-06, ~±15%).
- Echo-exclusion mechanics (source bundle-ID filter vs written-UUID set) and the `workout.source` / HK-UUID column shapes + migration.
- Deleted-imports-stay-deleted bookkeeping (imported HK UUID tombstones).
- HSS metadata key naming (D-13); HK anchor/anchored-query vs date-window delta mechanics for the foreground sync.
- Import IF resolution details: imported runs ride `resolveIF` (HR wins over pace, Phase 2 D-11); conditioning imports have HR only.
- TODAY import-notice presentation details (transient line vs toast, dismissal).
- Onboarding step copy and visual design.

### Deferred Ideas (OUT OF SCOPE)

- Nutrition/HealthKit dietary integration (v1.1, pairs with NUTR-01).
- Background delivery (`HKObserverQuery`) — push-style sync while Apsis is closed.
- Write-back retry queue — v1.0 is fire-and-forget.
- Historical backfill of pre-Phase-5 sessions to Health.
- HR merge into duplicate manual entries (backfilling a matched manual run's missing avgHr).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HK-01 | User grants HealthKit permission and the app imports runs (distance, duration, HR) | Verified `requestAuthorization`/`useHealthkitAuthorization` + `queryWorkoutSamplesWithAnchor` + `WorkoutActivityType` enum + `getStatistic` for avg HR (see Code Examples, Architecture Patterns) |
| HK-02 | App imports most-recent bodyweight from HealthKit | Verified `getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg')`; schema addition for `bodyweightSetAt` (see Pitfall 3) |
| HK-03 | Imported runs deduplicate against manual entries by timestamp range | Corrected to localDate+type+duration tolerance per D-06 schema fact (manual entries have no time-of-day); pure comparator pattern (see Architecture Patterns, Pitfall 9) |
| HK-04 | App writes logged sessions back to HealthKit (strength + runs) | Verified `saveWorkoutSample` signature, `WorkoutTotals.distance` unit behavior (native Swift source), delete-sync via `deleteObjects` (see Code Examples) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack is locked**: Expo SDK 56, TypeScript, expo-router, op-sqlite + drizzle, Zustand, no backend of any kind. This phase must not introduce a server or cloud dependency.
- **`@kingstinct/react-native-healthkit` is the locked HealthKit library** (only maintained Expo-compatible option) — confirmed still true, but **the pinned version (~8.2.0) is stale**. See "Critical Finding" below.
- **Local-first**: logging must never block on HealthKit I/O — directly matches D-12/D-25.
- **Engine purity**: `packages/engine` stays pure TS, no I/O, no `Date.now()` inside. This phase does not modify the engine; it reuses `resolveIF`/`resolveRunSegment`/`sessionHSSDetailed` as-is.
- **Expo Go is forbidden** — dev build (EAS or `expo run:ios`) required from day 1; native modules (op-sqlite, Skia, and now HealthKit) are incompatible with Expo Go.
- **`apps/mobile/AGENTS.md`** instructs reading exact versioned Expo SDK 56 docs before writing code — apply the same discipline to the HealthKit library given the version drift found below.

## Summary

`@kingstinct/react-native-healthkit` remains the correct library choice, but **BUILD.md/CLAUDE.md's pinned version (~8.2.0) is five major versions stale** `[VERIFIED: npm registry]` — the current published version is **14.0.2** (npm registry, published 2026-06-05). Starting at v9.0.0 the library was rewritten on top of **`react-native-nitro-modules`** (a peer dependency **not currently installed** in this project) `[VERIFIED: npm tarball @14.0.2 package.json]`. This is a load-bearing correction: installing the CLAUDE.md-pinned v8.2.0 would pull a pre-Nitro, bridge-era build that is not the maintained line and was not designed against React Native 0.85 / React 19.2 / New Architecture. The plan must install `@kingstinct/react-native-healthkit@^14.0.2` + `react-native-nitro-modules@^0.36.1`.

The library's actual shipped TypeScript definitions and native Swift source (read directly from the npm tarball, not from docs) give an exact, ground-truth API surface: `requestAuthorization`, `queryWorkoutSamplesWithAnchor` (anchor-based incremental sync — exactly what D-02's foreground delta-sync needs), `saveWorkoutSample` (workout write-back), `deleteObjects` (D-14 delete-sync), and `getMostRecentQuantitySample`/`queryQuantitySamplesWithAnchor` (bodyweight/HR reads). Every function in the Code Examples section below is copied from real `.d.ts` signatures, not paraphrased from prose docs.

Two integration risks matter more than the library itself: (1) the existing onboarding `Stack.Protected` gate flips to the tab shell the instant `user_profile` exists (driven by a `profileVersion` bump inside `useSaveProfile`), which **races** D-23's "HealthKit step appended after review/save" — the new step must defer that bump, not just be added as a route; and (2) `user_profile.updatedAt` is not currently maintained on update and cannot double as D-17's "bodyweight last-set" timestamp — a dedicated column is required.

**Primary recommendation:** Install `@kingstinct/react-native-healthkit@^14.0.2` + `react-native-nitro-modules@^0.36.1` (not the CLAUDE.md-pinned 8.2.0 line), add the config plugin + entitlement, budget a fresh EAS dev build early (Task 1, before any import/write-back logic), and build the sync/write-back logic as a pure-mapping + impure-I/O split mirroring the existing `runEntryLogic.ts`/`runEntry.ts` pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HealthKit permission request/status | Client (native module, iOS) | — | HealthKit is an on-device iOS framework; no server involved |
| Workout/HR/bodyweight read (import) | Client (native module → local SQLite) | — | Local-first; HK samples are mapped and persisted directly into `workout`/`endurance_segment`/`user_profile` via drizzle, no intermediate service |
| Dedupe & mapping logic | Client (pure TS, `lib/`) | — | Zero I/O; testable under vitest, mirrors `runEntryLogic.ts` |
| Session write-back to HealthKit | Client (native module, triggered from existing save/finish paths) | — | Fire-and-forget tail call, no new UI surface |
| Sync state (anchor, last-sync, bodyweight-set-at) | Client (SQLite, via drizzle) | — | No AsyncStorage dependency exists in this project; SQLite is already the single persistence layer |
| Foreground sync trigger | Client (`AppState` listener) | — | Precedented pattern already in `RestTimerBanner.tsx`; no background delivery per D-02 |
| Settings UI (connect/toggle/last-sync) | Client (React Native screen) | — | Existing `app/(tabs)/settings/index.tsx` |
| Onboarding step | Client (expo-router screen) | — | Existing `app/onboarding/` wizard |

No SSR/API/CDN tier applies — this is a fully local, single-tier client feature per the project's offline-only constraint.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@kingstinct/react-native-healthkit` | **14.0.2** `[VERIFIED: npm registry]` | HealthKit read/write bindings, Expo config plugin | Only maintained Expo-compatible HealthKit module (confirmed no official Expo HealthKit module exists); 126k weekly downloads, actively published (last publish 2026-06-05), real GitHub repo, no postinstall script `[VERIFIED: npm package-legitimacy check — OK]` |
| `react-native-nitro-modules` | **0.36.1** `[VERIFIED: npm registry]` | Native Nitro runtime — required peer dependency of `@kingstinct/react-native-healthkit@>=9.0.0` | Not optional: the healthkit package's `package.json` declares `"react-native-nitro-modules": ">=0.35"` as a hard peer dependency `[VERIFIED: npm tarball package.json]`. Maintained by `mrousavy` (also authors VisionCamera); 1M+ weekly downloads |

### Supporting

No additional supporting libraries are needed. Sync state (anchor tokens, last-sync timestamp, bodyweight-set-at) belongs in SQLite via drizzle — **do not add AsyncStorage**, this project has zero AsyncStorage usage today and SQLite is already the single source of truth.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@kingstinct/react-native-healthkit@14.0.2` | `@kingstinct/react-native-healthkit@8.2.0` (CLAUDE.md's stated pin) | **Do not use.** v8.2.0 predates the Nitro Modules rewrite (v9.0.0+); it targets an older bridge/TurboModule architecture and is 20+ versions behind the actively maintained line. No evidence it's tested against RN 0.85.3/React 19.2/New Architecture, which this project is already on. |
| SQLite-persisted sync state | AsyncStorage / MMKV for anchor + last-sync | Would introduce a second persistence mechanism into a project that has deliberately kept SQLite as the only store; adds a dependency for no benefit since op-sqlite/drizzle is already synchronous and fast |
| HK `sources` filter for echo-exclusion | UUID-set tracking only | Sources filter (`NOT: [{ sources: [currentAppSource()] }]`) is cheaper (excludes at query time) but is a single point of failure if Apple ever changes source attribution; combine both (see Pitfall 8) |

**Installation (pnpm, matching this project's established package-manager convention — see STATE.md Phase 03 precedent):**
```bash
cd apps/mobile
pnpm add @kingstinct/react-native-healthkit@^14.0.2 react-native-nitro-modules@^0.36.1
```

**Version verification performed this session:**
```bash
npm view @kingstinct/react-native-healthkit version   # → 14.0.2
npm view @kingstinct/react-native-healthkit time.modified  # → 2026-06-05T07:56:15.342Z
npm view react-native-nitro-modules version            # → 0.36.1
npm view react-native-nitro-modules peerDependencies    # → { react: '*', 'react-native': '*' } (permissive)
```
Both packages' compatibility with `react: >=19` and `react-native: >=0.79` (healthkit's own peerDependencies) is satisfied by this project's installed `react@19.2.3` / `react-native@0.85.3` `[VERIFIED: npm tarball package.json + apps/mobile/package.json]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@kingstinct/react-native-healthkit` | npm | latest publish 2026-06-05 (package itself has years of history across 14 majors) | 126,305/wk | github.com/kingstinct/react-native-healthkit | **OK** | Approved |
| `react-native-nitro-modules` | npm | latest publish 2026-06-30 | 1,052,435/wk | github.com/mrousavy/nitro | **SUS** (reason: "too-new" — flags on latest-version publish recency, not package age) | Flagged — planner must add `checkpoint:human-verify` before install. Mitigating context: 1M+/week downloads, well-known maintainer (mrousavy, VisionCamera author), real active repo — the SUS signal here is a recency false-positive on a legitimate, widely-used package, but the gate still requires the checkpoint per protocol. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `react-native-nitro-modules` — planner must insert `checkpoint:human-verify` before this install, even though the evidence (download volume, maintainer reputation, active repo) strongly supports legitimacy.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   App foreground (AppState)  │
                         │   D-02 trigger, no background│
                         └───────────────┬───────────────┘
                                         │
                    ┌────────────────────┴─────────────────────┐
                    │                                            │
        ┌───────────▼────────────┐                  ┌───────────▼──────────────┐
        │ Onboarding: HK step     │                  │ Settings: sync toggle /   │
        │ (D-23, last step)       │                  │ Connect row (D-03/D-21)   │
        │ requestAuthorization()  │                  │ requestAuthorization()    │
        └───────────┬────────────┘                  └───────────┬──────────────┘
                    │  (background 90-day import, D-22)          │
                    └────────────────────┬─────────────────────┘
                                         │
                              ┌───────────▼────────────┐
                              │ HealthKit sync engine    │
                              │ (lib/healthkitImport.ts) │
                              └───────────┬────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
   ┌──────────▼──────────┐  ┌────────────▼────────────┐  ┌──────────▼─────────┐
   │ queryWorkoutSamples   │  │ getMostRecentQuantity    │  │ (echo-exclusion:    │
   │ WithAnchor (workouts) │  │ Sample(BodyMass, 'kg')   │  │ sources filter +    │
   │ D-01/D-02             │  │ D-02/D-16                │  │ healthkitUuid check) │
   └──────────┬──────────┘  └────────────┬────────────┘  └──────────┬─────────┘
              │                          │                          │
   ┌──────────▼──────────────────────────▼──────────────────────────▼─────────┐
   │ Pure mapping/dedupe (lib/healthkitMapping.ts — zero I/O, vitest-tested)   │
   │   activityType map (D-04) → dedupe check (D-06, localDate+type+±15%)     │
   │   → IF resolution (reuse resolveRunSegment)                              │
   └──────────┬─────────────────────────────────────────────────────────────┘
              │  (skip if duplicate — D-07 manual wins)
   ┌──────────▼──────────────────────────────────────────────────────────────┐
   │ Batch insert: workout(source='healthkit', healthkitUuid) +               │
   │ endurance_segment, OR user_profile.bodyweightKg update (D-17)            │
   └──────────┬─────────────────────────────────────────────────────────────┘
              │  (once per BATCH, not per row — existing recomputeLoadDaily contract)
   ┌──────────▼──────────┐        ┌───────────────────────────┐
   │ recomputeLoadDaily()  │──────▶│ TODAY/History react on     │
   │ (existing, reused)    │        │ next focus (D-10 notice)   │
   └───────────────────────┘        └───────────────────────────┘
              │
   ┌──────────▼──────────────────────────┐
   │ Persist newAnchor + lastSyncAt        │
   │ (only on full success — D-25)         │
   └────────────────────────────────────────┘


   ── Reverse direction (write-back, HK-04) ──

   ┌────────────────┐        ┌────────────────┐
   │ saveRun()        │        │ finishWorkout()  │
   │ (existing)        │        │ (existing)        │
   └────────┬────────┘        └────────┬────────┘
            │  (fire-and-forget tail, D-12)          │
            └──────────────────┬─────────────────────┘
                              │
                   ┌───────────▼────────────┐
                   │ lib/healthkitWriteback.ts │
                   │ saveWorkoutSample()        │
                   │ metadata: { ApsisHSS }     │
                   └───────────┬────────────┘
                              │  store returned uuid
                   ┌───────────▼────────────┐
                   │ UPDATE workout            │
                   │ SET healthkitUuid = ...   │
                   └────────────────────────────┘

   discardWorkout() (existing, shared soft-delete path)
        │  if workout.source==='manual' AND healthkitUuid present (D-14)
        ▼
   deleteObjects({ uuid: healthkitUuid })  — fire-and-forget
```

### Recommended Project Structure

```
apps/mobile/
├── lib/
│   ├── healthkitMapping.ts       # PURE — activityType map (D-04), dedupe comparator (D-06),
│   │                              #   HSS metadata key builder. Zero @apsis/db / native imports.
│   ├── healthkitAuth.ts          # requestAuthorization wrapper, read/write identifier sets
│   ├── healthkitImport.ts        # IMPURE — anchored query, batch insert, recomputeLoadDaily call
│   ├── healthkitWriteback.ts     # IMPURE — saveWorkoutSample tail calls, deleteObjects on discard
│   ├── healthkitSyncState.ts     # IMPURE — read/write anchor + lastSyncAt + bodyweightSetAt via drizzle
│   ├── runEntry.ts               # EXISTING — write-back hook point (saveRun)
│   ├── finishWorkout.ts          # EXISTING — write-back + delete-sync hook points
│   └── __tests__/
│       └── healthkitMapping.test.ts   # vitest — activityType map + dedupe tolerance + IF gating
├── hooks/
│   └── useForegroundHealthKitSync.ts  # AppState listener → healthkitImport batch, mirrors
│                                        #   RestTimerBanner.tsx's existing AppState pattern
├── app/
│   ├── onboarding/
│   │   └── healthkit.tsx         # NEW — terminal wizard step (D-23), skippable (D-20)
│   └── (tabs)/settings/
│       └── index.tsx             # EXTEND — Connect row, sync toggle, last-sync line (D-03/D-21/D-24)
packages/db/
├── src/schema.ts                 # EXTEND — workout.source, workout.healthkitUuid, user_profile.bodyweightSetAt
├── src/queries.ts                # EXTEND — dedupe-candidate query builder (same-day+type)
└── drizzle/000X_*.sql            # NEW migration (npx drizzle-kit generate)
```

### Pattern 1: Pure mapping/dedupe split (mirrors `runEntryLogic.ts`)

**What:** All decision logic (activity-type mapping, duplicate detection, HSS metadata shaping) lives in a zero-dependency pure module, unit-testable under the existing `apps/mobile/vitest.config.mts` (`lib/**/__tests__/*.test.ts`, no `@apsis/db`/native imports allowed).
**When to use:** Any HK-derived decision that doesn't itself need I/O.
**Example:**
```typescript
// apps/mobile/lib/healthkitMapping.ts (pattern — mirrors runEntryLogic.ts's zero-I/O convention)
import { WorkoutActivityType } from '@kingstinct/react-native-healthkit';
import type { RunActivityType } from './runEntryLogic';

// D-04: Running -> run, Rowing -> erg, broad cardio -> conditioning; strength never imported (D-05)
export function mapHKActivityType(hk: WorkoutActivityType): RunActivityType | null {
  switch (hk) {
    case WorkoutActivityType.running:
      return 'run';
    case WorkoutActivityType.rowing:
      return 'erg';
    case WorkoutActivityType.traditionalStrengthTraining:
    case WorkoutActivityType.functionalStrengthTraining:
      return null; // D-05 — never imported, Apsis is the strength source of truth
    case WorkoutActivityType.cycling:
    case WorkoutActivityType.highIntensityIntervalTraining:
    case WorkoutActivityType.hiking:
    case WorkoutActivityType.swimming:
    case WorkoutActivityType.elliptical:
    case WorkoutActivityType.walking:
    case WorkoutActivityType.mixedCardio:
    case WorkoutActivityType.mixedMetabolicCardioTraining:
      return 'conditioning';
    default:
      return null; // everything else: not imported (Claude's discretion boundary)
  }
}

const DUPE_TOLERANCE = 0.15; // D-06 discretion constant, ~±15%

// D-06: dedupe is localDate + activityType + duration-within-tolerance ONLY —
// manual workouts carry no time-of-day (schema fact), so time-range overlap is not viable.
export function isDuplicateOfExisting(
  candidateDurationS: number,
  existingDurationS: number,
): boolean {
  const delta = Math.abs(candidateDurationS - existingDurationS);
  return delta <= existingDurationS * DUPE_TOLERANCE;
}
```

### Pattern 2: Anchored incremental sync (D-02)

**What:** Store the opaque `newAnchor` string returned by each HealthKit anchored query; pass it back in as `anchor` on the next call to receive only new/deleted samples since last sync — this is HealthKit's own delta mechanism, not a manually-computed date window.
**When to use:** Every foreground sync after the initial 90-day import.
**Example:**
```typescript
// Source: verified against @kingstinct/react-native-healthkit@14.0.2 shipped .d.ts
// (lib/typescript/specs/WorkoutsModule.nitro.d.ts, lib/typescript/types/Workouts.d.ts)
import { queryWorkoutSamplesWithAnchor } from '@kingstinct/react-native-healthkit';

const { workouts, deletedSamples, newAnchor } = await queryWorkoutSamplesWithAnchor({
  limit: 0, // 0/-1 = fetch all matching, per verified d.ts comment
  anchor: storedAnchor, // undefined on first call (90-day initial import instead uses a date filter)
  filter: {
    NOT: [{ sources: [currentAppSource()] }], // D-11 echo-exclusion, primary defense
  },
});
// Persist `newAnchor` to SQLite ONLY after the batch fully succeeds (D-25 silent-failure rule —
// a failed sync must NOT advance the anchor, so the next foreground sync retries the same window).
```

### Pattern 3: Workout write-back (D-12/D-13)

**What:** `saveWorkoutSample` takes activity type, an array of associated quantity samples (can be empty — D-13's payload needs none), start/end dates, optional `totals` (distance in **meters**, hardcoded unit per native source — see Pitfall), and a `metadata` map for the custom HSS key.
**When to use:** Fire-and-forget tail call appended to `saveRun`/`finishWorkout`.
**Example:**
```typescript
// Source: verified against @kingstinct/react-native-healthkit@14.0.2 shipped native Swift
// (ios/WorkoutsModule.swift lines 80-146) — totals.distance is ALWAYS meters, no unit param exists.
import { saveWorkoutSample, WorkoutActivityType } from '@kingstinct/react-native-healthkit';

async function writeBackRun(distanceM: number | undefined, durationS: number, hss: number, startedAt: Date) {
  try {
    const endDate = new Date(startedAt.getTime() + durationS * 1000);
    await saveWorkoutSample(
      WorkoutActivityType.running,
      [], // D-13: no associated quantity samples needed — totals covers distance
      startedAt,
      endDate,
      distanceM != null ? { distance: distanceM } : undefined, // meters, matches Apsis's metric storage directly
      { ApsisHSS: hss }, // D-13 custom metadata key
    );
  } catch (err: unknown) {
    console.error('[Apsis] HealthKit write-back failed:', err); // D-12/D-25 — never rethrow, never block save
  }
}
```

### Pattern 4: Permission request (HK-01, must request full set up front)

**What:** `requestAuthorization` is called once with the complete `toRead`/`toShare` sets this app will ever query; requesting a type later that wasn't in the original set throws at query time.
**Example:**
```typescript
// Source: verified against @kingstinct/react-native-healthkit@14.0.2 shipped .d.ts
// (lib/typescript/specs/CoreModule.nitro.d.ts — requestAuthorization(toRequest: AuthDataTypes))
import { requestAuthorization, WorkoutTypeIdentifier } from '@kingstinct/react-native-healthkit';

await requestAuthorization({
  toRead: [
    WorkoutTypeIdentifier,               // "HKWorkoutTypeIdentifier"
    'HKQuantityTypeIdentifierHeartRate',
    'HKQuantityTypeIdentifierBodyMass',
  ],
  toShare: [WorkoutTypeIdentifier],      // write-back only needs workout write (D-18: no bodyweight write)
});
```

### Anti-Patterns to Avoid

- **Manually diffing date ranges for incremental sync:** HealthKit's anchor tokens already solve this; hand-rolling a "workouts since last sync timestamp" query risks missing deletions and re-processing edited samples. Use `queryWorkoutSamplesWithAnchor`'s `newAnchor`/`deletedSamples`.
- **Requesting HealthKit permissions lazily per-feature:** the library throws if you query a type you never requested. Request the full read/write set once (Pattern 4), not incrementally as new import types are added later.
- **Bumping `profileVersion` inside `useSaveProfile.save()` unconditionally now that a step follows it:** this races the `Stack.Protected` gate (see Pitfall 2) — the bump must move to the new terminal onboarding step.
- **Treating `totals.distance` like the `unit`-parameterized quantity-sample APIs:** it has no unit parameter and is always meters (verified native source) — do not run it through the app's `kg↔lb`/`km↔mi` display-unit conversion helpers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Incremental HK sync tracking | A manual "fetch workouts since date X" date-window query | `queryWorkoutSamplesWithAnchor`'s anchor token | Anchors correctly surface `deletedSamples` too; a date-window re-query would miss deletions and double-count edited samples |
| HealthKit permission state machine | Polling `authorizationStatusFor` per type to infer "connected" | D-19: track "connected" as a simple boolean set once the permission sheet completes | iOS deliberately hides granular read-grant status from apps (Apple privacy design) — there is no reliable way to know if the user granted read access to a specific type; building a status poller will produce false signals |
| Unit conversion for quantity samples | Manual factor math (e.g. HR count/s → bpm) | The library's typed `unit` parameter (`getMostRecentQuantitySample(id, 'count/min')`) + `isQuantityCompatibleWithUnit` | HealthKit's internal storage unit for HR is `count/s`, not bpm — a hand-rolled ×60 conversion is exactly the kind of easy-to-get-wrong-once conversion the library's typed unit param exists to prevent |
| Background sync scheduling | Any timer/interval polling loop | Nothing — D-02 explicitly rejected background delivery; just an `AppState` foreground listener (already precedented in `RestTimerBanner.tsx`) | Building an interval poller would silently violate the local-first "never block, never background-drain battery" decision the user explicitly made |
| Sync state persistence | A new file-based or AsyncStorage cache for the anchor/last-sync/bodyweight-set-at values | New nullable columns on `user_profile` (single-row table, matches existing pattern) or a new single-row `healthkit_sync_state` table via drizzle | This project has zero AsyncStorage dependency; SQLite via drizzle is the established single source of truth for all persisted state |

**Key insight:** Every "don't hand-roll" item here maps to a capability the HealthKit library or the existing SQLite/drizzle infrastructure already solves correctly — the risk in this phase is not missing library features, it's re-deriving something (a permission status, a unit conversion, a sync window) that the platform already tracks more reliably than app-level code can.

## Runtime State Inventory

> This phase is additive (new columns/tables), not a rename/refactor — but it introduces a **new external system of record** (Apple Health) that the project has never touched. This inventory addresses that novel surface, not a rename.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None yet — this is the first phase writing to HealthKit. Every write-back sample this phase creates becomes an item future phases must account for (v1.1 nutrition, uninstall/reinstall). | Store `workout.healthkitUuid` for every Apsis-authored HK sample now, so a future phase can enumerate/clean them up. |
| Live service config | None — HealthKit permissions are granted via the iOS system sheet, not a remote service config. | None. |
| OS-registered state | The `com.apple.developer.healthkit` and `.background-delivery` entitlements are added to the iOS provisioning profile via the config plugin at `expo prebuild`/EAS build time — this is a **human-only step** per BUILD.md §8 ("HealthKit capability + entitlement on the bundle id"). | Flag for Ethan: confirm the Apple Developer account has HealthKit capability enabled for `com.apsis.app` before the first EAS dev build of this phase (BUILD.md already lists this as human-only). |
| Secrets/env vars | None. | None — no new secrets. |
| Build artifacts | None yet (no native module previously required Nitro codegen) — `react-native-nitro-modules` is the first Nitro-based dependency in this project; its codegen output (`nitrogen/`) will appear in `apps/mobile` after `pnpm add` + `expo prebuild`. | First install of this dependency requires `expo prebuild` regeneration + fresh EAS dev build (see Environment Availability). |

## Common Pitfalls

### Pitfall 1: CLAUDE.md's pinned HealthKit version is 5 major versions stale
**What goes wrong:** Installing `@kingstinct/react-native-healthkit@~8.2.0` as CLAUDE.md literally states pulls a pre-Nitro-rewrite build with a different, older native module architecture.
**Why it happens:** CLAUDE.md's Technology Stack section was generated from training-data knowledge that predates the package's v9.0.0 rewrite (npm registry shows the current 14.0.2 was published 2026-06-05; the intervening majors 9–13 all shipped the Nitro Modules migration).
**How to avoid:** Install `^14.0.2` + the new required peer `react-native-nitro-modules@^0.36.1`. Treat this RESEARCH.md's verified version, not CLAUDE.md's, as authoritative for this specific package (CLAUDE.md's other pins — Expo 56, RN 0.85, React 19.2 — were independently spot-checked against this project's actual installed `package.json` versions and match).
**Warning signs:** `npm view @kingstinct/react-native-healthkit peerDependencies` returning anything other than a `react-native-nitro-modules` entry means the wrong major was resolved.

### Pitfall 2: Onboarding `Stack.Protected` gate races D-23's "step appended after review/save"
**What goes wrong:** `app/_layout.tsx`'s onboarding guard (`useProfileExists`) flips to the tab shell the instant the `user_profile` row exists — driven purely by `useProfileVersion`'s counter, which `useSaveProfile.save()` currently bumps immediately after insert (see `hooks/useSaveProfile.ts` line 57). If `healthkit.tsx` is simply added as a new route after `review.tsx` with no other change, the user is redirected out of the onboarding stack the moment Save succeeds — the new step is never reached.
**Why it happens:** `review.tsx`'s own doc comment confirms this is intentional today: "On success, `useProfileExists`' version-driven re-query flips Plan 04's `Stack.Protected` gate to the tab shell — no manual navigation needed here." Phase 5 needs to invert that for exactly one more step.
**How to avoid:** Move the `bumpProfileVersion()` call out of `useSaveProfile.save()` and into the new terminal `healthkit.tsx` step's "Continue"/"Not now" handler (both paths must bump it — declining still completes onboarding, D-20). `review.tsx`'s `handleSubmit` should `router.push('/onboarding/healthkit')` after a successful `save()` instead of relying on the gate to move the user.
**Warning signs:** On-device UAT where tapping "Save & Start Training" jumps straight to the tab shell instead of showing the HealthKit step.

### Pitfall 3: `user_profile.updatedAt` cannot double as D-17's "bodyweight last-set" timestamp
**What goes wrong:** D-17 needs "most recent wins by timestamp" between a manual Settings bodyweight edit and an HK bodyweight sample. The existing `updatedAt` column is whole-row scoped — a units or threshold edit would also need to leave it untouched for this comparison to be meaningful, but more importantly `useProfile.update()` (`hooks/useProfile.ts`) currently never sets `updatedAt` at all on UPDATE (verified — the `.set(patch)` call only includes the fields being changed), so the column is effectively dead after the initial insert.
**Why it happens:** `updatedAt` was designed as a generic audit column, not a field-specific "when was bodyweight last set" signal.
**How to avoid:** Add a dedicated `user_profile.bodyweightSetAt` (timestamp) column. Set it: (a) at onboarding insert (`useSaveProfile`) to the insert time, (b) on every Settings bodyweight edit (`useProfile.update` when `patch.bodyweightKg != null`) to now, (c) on HK bodyweight import to the HK sample's own `startDate` (not import time) — this is what makes the D-17 recency comparison correct even if the sample is being imported hours after it was recorded on the Watch.
**Warning signs:** A manual bodyweight edit gets silently overwritten by an older HK sample on the next foreground sync, or vice versa.

### Pitfall 4: `WorkoutTotals.distance` is unconditionally meters — no unit parameter exists
**What goes wrong:** Every other quantity API in this library takes an explicit `unit` string parameter. `saveWorkoutSample`'s `totals: WorkoutTotals` parameter does not — passing a value that isn't already in meters silently produces a wrong-by-a-conversion-factor distance in Health.
**Why it happens:** Confirmed by reading the actual native Swift source (`ios/WorkoutsModule.swift`): `totalDistance = HKQuantity(unit: .meter(), doubleValue: rawTotalDistance)` — hardcoded.
**How to avoid:** Pass Apsis's already-metric `distanceM` (ONB-04: storage is always metric) directly into `totals.distance` with **no** conversion helper call. This is one of the few HK write paths where the app's `km↔mi` display-unit helpers must NOT be used.
**Warning signs:** A written-back run shows a wildly wrong distance in the Health app (off by ~1.6x if miles were passed as meters, or ~1000x if km were passed as meters).

### Pitfall 5: Requesting a HealthKit type you never authorized crashes at query time
**What goes wrong:** Per the library's README, calling a query/save function for a type identifier that wasn't included in the original `requestAuthorization` call throws (can crash the app if unhandled).
**Why it happens:** This mirrors native `HKHealthStore` behavior — HealthKit requires the full authorization set to be declared up front.
**How to avoid:** Define the complete `toRead`/`toShare` identifier sets once (Pattern 4) and reuse that constant everywhere queries/writes happen — never add an ad-hoc new identifier to a single call site without also adding it to the authorization request.
**Warning signs:** A crash (not a silent failure) the first time a new query type is added without also touching the authorization call — treat this as the one HK failure mode that is NOT covered by D-25's "silent failure" policy, because it can be a hard crash, not a caught rejected promise.

### Pitfall 6: HealthKit has minimal data on the iOS Simulator
**What goes wrong:** Development/testing on the Simulator will show near-empty read results even with permissions granted, making the import/dedupe logic look broken when it's actually the environment.
**Why it happens:** Documented Apple/library limitation — the Simulator has no paired Watch and minimal seeded Health data.
**How to avoid:** Physical device required for on-device UAT of HK-01/02/03. This compounds with the existing native-dependency EAS build gate (see Environment Availability) — budget device testing time, not simulator time, for this phase's verification.

### Pitfall 7: First Nitro-based dependency in this project — de-risk the build before writing logic
**What goes wrong:** `op-sqlite` and Skia are both JSI-based but predate this package's Nitro Modules migration; if the Nitro codegen/autolinking step has any friction with this project's existing Metro/babel config (already customized for `.sql` inline-import per `packages/db/src/migrations.ts`), discovering that after writing all the import/write-back logic wastes the most time.
**Why it happens:** Nitro Modules use a code-generation step (`nitrogen`) distinct from both the old bridge and TurboModules codegen; this is genuinely new machinery for this repo.
**How to avoid:** Sequence Task 1 of this phase as install + config plugin + `expo prebuild` + a fresh EAS dev build + a trivial "is HealthKit available" smoke check, BEFORE writing any import/dedupe/write-back logic — mirrors the Phase 04 lesson already recorded in STATE.md ("stale dev client + out-of-sync lockfile blocked UAT start").
**Warning signs:** `pnpm-lock.yaml` not regenerated before an EAS build (EAS installs with `--frozen-lockfile` — same failure mode STATE.md already documents from Phase 04).

### Pitfall 8: Echo-exclusion needs two layers, not one
**What goes wrong:** Relying solely on the `sources` filter to exclude Apsis's own write-backs from the next import pass assumes Apple's source attribution never changes and that the filter is applied correctly on every query path.
**Why it happens:** `currentAppSource()` returns a `SourceProxy` synchronously usable inside `NOT: [{ sources: [...] }]` filters — a clean, cheap first-layer defense — but it's still worth a deterministic backstop.
**How to avoid:** Use the sources filter as the primary defense (Pattern 2) AND check the incoming sample's `uuid` against `workout.healthkitUuid` values already in SQLite (including soft-deleted rows — see next pitfall) before inserting. The second check also naturally solves the "deleted-imports-stay-deleted" discretion item for free.
**Warning signs:** A write-back run reappears as a new imported session on the very next foreground sync.

### Pitfall 9: Soft-deleted rows must stay in the dedupe/tombstone check
**What goes wrong:** If the import-dedupe query only looks at `activeWorkoutFilter` (non-deleted) rows for existing `healthkitUuid` values, a swipe-deleted imported run will resurrect on the next sync — the row that would have prevented re-import got filtered out.
**Why it happens:** `activeWorkoutFilter` (`isNull(workout.deletedAt)`) is the correct filter for every *display*/HSS read, but the *tombstone* check for "have we already processed this HK uuid" must intentionally include deleted rows.
**How to avoid:** The dedupe/tombstone lookup must query `workout.healthkitUuid` with NO `deletedAt` filter — this is a deliberate exception to the otherwise-universal `activeWorkoutFilter` convention (`packages/db/src/queries.ts`), and should be commented as such to avoid a future contributor "fixing" it to match the pattern.
**Warning signs:** A deleted imported run reappears after the next app foreground.

### Pitfall 10: `recomputeLoadDaily` must run once per batch, not once per row
**What goes wrong:** `recomputeLoadDaily` re-reads and folds the **entire** `workout` table on every call (verified in `apps/mobile/lib/recomputeLoadDaily.ts` — no incremental mode exists). A 90-day initial import inserting dozens of sessions, if it calls `recomputeLoadDaily` after each insert, turns an O(n) import into an O(n²) full-table-scan operation.
**Why it happens:** The existing function's contract (documented in its own header comment) already anticipates this — "every terminal write to `workout` ... must call this" — but that comment was written when "every write" meant one user action at a time, not a 90-row import batch.
**How to avoid:** Batch-insert every import-batch row first, then call `recomputeLoadDaily(db)` exactly once at the end of the batch (already flagged as a canonical-ref requirement in 05-CONTEXT.md).
**Warning signs:** The 90-day initial import taking visibly longer than a few seconds, or TODAY's ring flickering through dozens of intermediate states during first sync.

## Code Examples

Verified patterns from the actual shipped package (npm tarball, not paraphrased docs):

### Dedupe-candidate query builder (mirrors `packages/db/src/queries.ts` conventions)
```typescript
// packages/db/src/queries.ts — new builder, same QueryableDB/parameterized pattern as existing file
import { and, eq, isNull } from 'drizzle-orm';
import { enduranceSegment, workout } from './schema';

/** Active workouts on `localDate` matching `activityType`, for D-06 dedupe comparison.
 * Deliberately does NOT filter deletedAt — see Pitfall 9 (tombstone check must see soft-deleted rows). */
export function candidatesForDedupe(db: QueryableDB, localDate: string, activityType: string) {
  return db
    .select({ durationS: enduranceSegment.durationS, healthkitUuid: workout.healthkitUuid })
    .from(workout)
    .innerJoin(enduranceSegment, eq(enduranceSegment.workoutId, workout.id))
    .where(and(eq(workout.localDate, localDate), eq(enduranceSegment.activityType, activityType)));
}
```

### Bodyweight import (HK-02)
```typescript
// Source: verified against @kingstinct/react-native-healthkit@14.0.2 shipped .d.ts
import { getMostRecentQuantitySample } from '@kingstinct/react-native-healthkit';

const sample = await getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg');
if (sample != null) {
  // sample.quantity is already kg (unit param requested explicitly — no conversion needed)
  // sample.startDate is the HK sample's own recorded time — use for bodyweightSetAt (Pitfall 3)
}
```

### Delete-sync on discard (D-14, hooks into existing `discardWorkout`)
```typescript
// apps/mobile/lib/finishWorkout.ts — extend discardWorkout with a fire-and-forget tail call
import { deleteObjects } from '@kingstinct/react-native-healthkit';

export async function discardWorkout(database: DB, workoutId: string, deletedAt: Date): Promise<void> {
  const [row] = await database
    .select({ source: workout.source, healthkitUuid: workout.healthkitUuid })
    .from(workout)
    .where(eq(workout.id, workoutId));

  await softDeleteWorkout(database, workoutId, deletedAt);
  await recomputeLoadDaily(database);

  // D-14: only Apsis-authored HK samples (source==='manual', we wrote it) get deleted from Health —
  // an imported session's healthkitUuid refers to a sample WE DON'T OWN and must never be deleted.
  if (row?.source === 'manual' && row.healthkitUuid != null) {
    deleteObjects('HKWorkoutTypeIdentifier', { uuid: row.healthkitUuid }).catch((err: unknown) => {
      console.error('[Apsis] HealthKit delete-sync failed:', err); // D-25 — silent, never blocks
    });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@kingstinct/react-native-healthkit` v8.x (bridge/TurboModule based) | v9.0.0+ rewritten on `react-native-nitro-modules` (JSI, statically-compiled bindings) | v9.0.0 (exact date not confirmed this session, but 14.0.2 was published 2026-06-05 and is many releases past 9.0.0) | Requires adding `react-native-nitro-modules` as an explicit dependency — not previously in this project. Faster native calls (Nitro's stated purpose), but a new build-time codegen step (`nitrogen/`) this project hasn't encountered before. |

**Deprecated/outdated:**
- CLAUDE.md's `~8.2.0` pin for `@kingstinct/react-native-healthkit`: superseded by the current maintained 14.x line. See Pitfall 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | "Failing to request authorization, or requesting a permission you haven't requested yet, will result in the app crashing" | Pitfall 5 | Sourced from the GitHub README via WebFetch summary, not independently reproduced against native source this session. If overstated (e.g. it's a rejected promise, not a hard crash), the D-25 "silent failure" handling may already cover it without the extra defensive-set discipline recommended — low risk either way since the recommended mitigation (define the full auth set once) is good practice regardless. `[CITED: github.com/kingstinct/react-native-healthkit README]` |
| A2 | The exact `HKWorkoutActivityType` list mapped to `conditioning` in Pattern 1 (cycling, HIIT, hiking, swimming, elliptical, walking, mixedCardio, mixedMetabolicCardioTraining) is a reasonable/complete "broad cardio" set | Pattern 1, Code Examples | This is explicitly Claude's Discretion per D-04 — the planner/executor should treat this list as a starting point, not a locked mapping; other `WorkoutActivityType` enum values not listed (e.g. `crossTraining`, `stairClimbing`, `jumpRope`) may also deserve `conditioning` treatment and should be reviewed against the enum's full 84-value list (captured in full above) during planning |
| A3 | react-native-nitro-modules "too-new" SUS signal is a false positive rather than a genuine legitimacy concern | Package Legitimacy Audit | Low risk given corroborating signals (1M+/wk downloads, known maintainer, real repo) — but the checkpoint:human-verify gate should still run per protocol; if wrong, the phase would need a different HealthKit approach entirely (unlikely) |

**If this table is empty:** N/A — see entries above; all other API-shape claims (function signatures, enum values, unit behavior, config plugin shape) were verified directly against the npm tarball's shipped `.d.ts`/Swift source this session, not assumed.

## Open Questions

1. **Exact conditioning-type HKWorkoutActivityType allowlist (D-04 discretion)**
   - What we know: The full 84-value `WorkoutActivityType` enum (captured above) and the decision's examples (cycling, HIIT, hiking, swimming, elliptical).
   - What's unclear: Whether types like `crossTraining`, `stairClimbing`, `jumpRope`, `waterFitness`, `snowSports` etc. should also map to `conditioning` or be excluded (not imported at all).
   - Recommendation: The planner should finalize the full allowlist as an explicit table in the plan (not left to executor improvisation), erring toward inclusion for anything cardio/conditioning-like per the "a Zwift ride shouldn't be invisible stress" specifics note, and exclusion for anything ambiguous (dance, sports, mind/body) since those weren't discussed in CONTEXT.md.

2. **Does `saveWorkoutSample`'s `quantities` array need an average-HR sample for write-back, or is metadata-only sufficient?**
   - What we know: D-13 says "basics + HSS metadata, no calories" — HR isn't explicitly listed as part of the write-back payload.
   - What's unclear: Whether an empty `quantities: []` array (as shown in Pattern 3) is acceptable, or whether Health app / other apps expect an associated HR sample for a workout to look "complete."
   - Recommendation: Ship with `quantities: []` per the literal D-13 payload (basics + HSS metadata only); this is the simplest interpretation and matches "no fabricated data" — Apsis doesn't always have avgHR for lifting sessions anyway.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| EAS CLI | Dev build for native HealthKit module | ✓ | 20.5.1 | — |
| Node.js | Build tooling | ✓ | 20.16.0 | — |
| pnpm | Package install (project convention) | ✓ | 9.15.9 | — |
| Physical iOS device | HK-01/02/03 on-device testing (Simulator has minimal Health data — Pitfall 6) | Not verifiable from this environment (Windows host) | — | None — flagged in BUILD.md §8 as human-only ("Real-device testing for HealthKit") |
| macOS/Xcode for native iOS build step | `expo prebuild`/local iOS build | ✗ (Windows host) | — | EAS cloud build, consistent with Phase 04 P02 precedent ("iOS native link deferred to EAS cloud build — Windows host cannot prebuild ios/") |
| Apple Developer HealthKit entitlement on `com.apsis.app` | Any HK permission request to succeed at all | Not verifiable from this environment | — | None — BUILD.md §8 human-only step; flag for Ethan before first EAS dev build of this phase |

**Missing dependencies with no fallback:**
- Physical iOS device for on-device UAT of HK-01/02/03/04 (Simulator testing will look broken even with correct code, per Pitfall 6).
- Apple Developer HealthKit capability/entitlement — human action, not something this session or an agent can perform.

**Missing dependencies with fallback:**
- macOS/Xcode local build — falls back to EAS cloud build (same pattern already used successfully in Phase 04).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 |
| Config file | `apps/mobile/vitest.config.mts` (scoped to `lib/**/__tests__/*.{test,spec}.ts`, zero `@apsis/db`/native imports) |
| Quick run command | `cd apps/mobile && pnpm vitest run lib/__tests__/healthkitMapping.test.ts` |
| Full suite command | `cd apps/mobile && pnpm test` (equivalently `pnpm --filter @apsis/mobile test`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| HK-01 | Activity-type mapping (D-04) is correct per allowlist | unit | `pnpm vitest run lib/__tests__/healthkitMapping.test.ts -t mapHKActivityType` | ❌ Wave 0 |
| HK-01 | Permission grant + actual import from HealthKit on-device | manual-only | — (native module, physical device, Simulator has no real data) | n/a |
| HK-02 | Bodyweight import unit correctness (kg passthrough) | unit | `pnpm vitest run lib/__tests__/healthkitMapping.test.ts -t bodyweight` | ❌ Wave 0 |
| HK-02 | D-17 recency conflict resolution (manual edit vs HK sample) | unit | pure comparator test on `bodyweightSetAt` timestamps | ❌ Wave 0 |
| HK-03 | Dedupe: same-day+type+duration-within-15% flags duplicate | unit | `pnpm vitest run lib/__tests__/healthkitMapping.test.ts -t isDuplicateOfExisting` | ❌ Wave 0 |
| HK-03 | Dedupe: soft-deleted tombstones still prevent resurrection | unit (against a `sqlite-proxy` mock, per `packages/db/src/queries.ts` existing test convention) | `pnpm vitest run` in `packages/db` | ❌ Wave 0 |
| HK-04 | Write-back payload shape (no calories, HSS metadata key present) | unit | pure payload-builder test, no native call | ❌ Wave 0 |
| HK-04 | Actual write appears in Health app; delete-sync removes it | manual-only | — (native module, physical device) | n/a |

### Sampling Rate
- **Per task commit:** `cd apps/mobile && pnpm vitest run lib/__tests__/healthkitMapping.test.ts`
- **Per wave merge:** `pnpm test` (full monorepo test suite, matching existing Phase 02–04 convention)
- **Phase gate:** Full suite green before `/gsd-verify-work`; on-device UAT required for every manual-only row above (this phase has an unusually high manual-only ratio because the core value — HealthKit I/O — is inherently native/device-bound; the pure mapping/dedupe/payload logic is fully automatable and should carry the bulk of the automated coverage)

### Wave 0 Gaps
- [ ] `apps/mobile/lib/healthkitMapping.ts` — pure module, does not exist yet
- [ ] `apps/mobile/lib/__tests__/healthkitMapping.test.ts` — covers HK-01/02/03/04's pure-logic surface
- [ ] `packages/db/src/__tests__/` dedupe-candidate-builder test — extend existing `queries.ts` test file (already has a `sqlite-proxy` mock pattern per Phase 03/04 precedent)
- [ ] Framework install: none — vitest is already configured in both `apps/mobile` and `packages/db`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | No | Single-user, no auth, unchanged by this phase |
| V3 Session Management | No | n/a |
| V4 Access Control | Partial | iOS's own HealthKit authorization sheet is the access-control boundary — Apsis has no ability to circumvent it, only to request scoped read/write identifiers (Pattern 4) |
| V5 Input Validation | Yes | All HK-sourced values (duration, distance, HR, bodyweight) must go through the same clamp/warn discipline already used for manual entry (`enduranceStressDetailed`/`resolveIF`'s existing clamping) before being persisted or fed into the engine — never trust an external sample's numeric range blindly (a corrupted or malicious third-party Health app entry, e.g. `distanceM: -1` or `durationS: 0`, must be handled the same way a manual-entry bad value already is) |
| V6 Cryptography | No | No new cryptography; HealthKit's own on-device encryption is Apple's responsibility |
| V9 Communications | No | No network transmission — HK data flows device-local only, consistent with this project's fully-offline v1.0 scope |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-------------------------|
| Sensitive health data (bodyweight, HR, workout details) leaking into crash/analytics reporting | Information Disclosure | Never `console.log`/`console.error` raw HK sample payloads (actual bodyweight numbers, HR values) — log only counts, booleans, and durations, matching this codebase's existing convention of logging `Error` objects, not raw user data (`T-04-09` precedent already established in `runEntry.ts`/`recomputeLoadDaily.ts`). This directly feeds Phase 06's REL-03 Sentry-scrub requirement — code written in this phase should already be scrub-clean, not retrofitted later. |
| Over-broad authorization requests | Elevation of Privilege (of the app's own access, from a privacy-review standpoint) | Request exactly the read/write identifier set actually used (workouts, heart rate, body mass for read; workout only for write per D-18) — do not request broader HealthKit categories "for future use" |
| Malicious/corrupted third-party Health app data | Tampering | Apply the same clamp-and-warn discipline already used for manual entry (`enduranceStressDetailed`, `resolveIF`) to every HK-sourced value before it reaches the engine or SQLite — an imported `distanceM: -50000` or `durationS: NaN` from a rogue Health-writing app must never corrupt `load_daily`'s recompute |

## Sources

### Primary (HIGH confidence — direct package source inspection, this session)
- npm registry tarball for `@kingstinct/react-native-healthkit@14.0.2` (downloaded and read directly): `lib/typescript/specs/WorkoutsModule.nitro.d.ts`, `lib/typescript/specs/CoreModule.nitro.d.ts`, `lib/typescript/types/Workouts.d.ts`, `lib/typescript/types/QuantitySample.d.ts`, `lib/typescript/types/QueryOptions.d.ts`, `lib/typescript/types/QuantityType.d.ts`, `lib/typescript/generated/healthkit.generated.d.ts` (full `WorkoutActivityType` enum), `lib/typescript/healthkit.d.ts` (full function export list), `lib/typescript/specs/SourceProxy.nitro.d.ts`, `lib/typescript/types/Auth.d.ts`, `lib/typescript/types/Constants.d.ts` (`WorkoutTypeIdentifier` string), `ios/WorkoutsModule.swift` (native `saveWorkoutSample` implementation — confirms `totals.distance` unit behavior), `src/app.plugin.ts`/`app.plugin.js` (Expo config plugin — confirms entitlement/Info.plist keys and `background` option)
- `npm view @kingstinct/react-native-healthkit` (version, publish date, peerDependencies, dist-tags)
- `npm view react-native-nitro-modules` (version, peerDependencies)
- `gsd-tools query package-legitimacy check` (registry existence, download counts, repo URL, postinstall-script check for both packages)
- Direct repo inspection: `packages/db/src/schema.ts`, `apps/mobile/lib/runEntry.ts`, `apps/mobile/lib/finishWorkout.ts`, `apps/mobile/lib/recomputeLoadDaily.ts`, `apps/mobile/lib/runEntryLogic.ts`, `apps/mobile/lib/settingsStore.ts`, `apps/mobile/hooks/useProfile.ts`, `apps/mobile/hooks/useSaveProfile.ts`, `apps/mobile/hooks/useProfileExists.ts`, `apps/mobile/app/onboarding/_layout.tsx`, `apps/mobile/app/onboarding/review.tsx`, `apps/mobile/app/(tabs)/history/index.tsx`, `apps/mobile/vitest.config.mts`, `packages/db/src/queries.ts`, `packages/db/drizzle.config.ts`, `BUILD.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- GitHub README (`github.com/kingstinct/react-native-healthkit/blob/master/README.md`) via WebFetch — installation flow, authorization-crash-if-unrequested behavior (A1 in Assumptions Log), background delivery config option

### Tertiary (LOW confidence)
- WebSearch results on Nitro Modules' Expo config-plugin requirements (used only to confirm `react-native-nitro-modules` itself needs no separate config plugin beyond autolinking — not load-bearing for this phase's plan)

## Metadata

**Confidence breakdown:**
- Standard stack (library choice + version): HIGH — version and peer-dependency requirement independently confirmed via `npm view` AND direct tarball inspection, not training-data recall
- Architecture (integration with existing codebase): HIGH — every claim about `useProfileExists`/`useSaveProfile`/`recomputeLoadDaily`/`discardWorkout`/dedupe schema facts is drawn from reading the actual current source files in this repo, not inferred
- API surface (function signatures, enum values, unit behavior): HIGH — read directly from the shipped `.d.ts` and native Swift source, not paraphrased from documentation prose (which was independently found to contain a stale/inaccurate claim about HK-prefix removal that the actual type definitions contradict)
- Pitfalls: HIGH for the two integration-race pitfalls (gate race, bodyweight timestamp) since both are reproduced directly from reading the current code; MEDIUM for the authorization-crash claim (A1, sourced from README prose only)
- Package legitimacy: MEDIUM — `react-native-nitro-modules` flagged SUS by the automated gate on a recency heuristic that appears to be a false positive given corroborating popularity/maintainer signals, but the checkpoint gate must still run per protocol

**Research date:** 2026-07-11
**Valid until:** ~2026-08-11 (30 days) — shorter validity than usual for the `react-native-nitro-modules`/`@kingstinct/react-native-healthkit` pairing specifically, since both are actively-published, fast-moving native module packages; re-verify versions immediately before this phase's Task 1 install if execution starts more than a few days after this research
