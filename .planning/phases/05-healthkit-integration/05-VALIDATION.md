---
phase: 5
slug: healthkit-integration
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.9 (pure-TS unit tests; two workspaces) |
| **Config file** | `packages/db/vitest.config.mts` and `apps/mobile/vitest.config.mts` (both pre-exist) |
| **Quick run command** | `pnpm --filter @apsis/db vitest run <file>` or `pnpm --filter @apsis/mobile vitest run <file>` (target the touched suite) |
| **Full suite command** | `pnpm --filter @apsis/db test && pnpm --filter @apsis/mobile test` (each `test` script = `vitest run`) |
| **Estimated runtime** | ~5–10s per targeted file; ~15s full suite |

> Note: HealthKit is a native, on-device surface. Automated coverage is concentrated in the pure logic (`packages/db` query builders + `apps/mobile/lib/healthkitMapping.ts`) and grep/structural gates on the impure wrappers. Runtime import/write-back/permission behavior is physical-device UAT only (Simulator has minimal Health data — RESEARCH Pitfall 6).

---

## Sampling Rate

- **After every task commit:** Run the touched suite's quick command (e.g. `pnpm --filter @apsis/mobile vitest run lib/__tests__/healthkitMapping.test.ts`); for grep-gated tasks, run the task's `<automated>` command verbatim.
- **After every plan wave:** Run `pnpm --filter @apsis/db test && pnpm --filter @apsis/mobile test`.
- **Before `/gsd-verify-work`:** Full suite must be green; the three on-device manual verifications (below) must be signed off.
- **Max feedback latency:** ~15 seconds (full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | HK-01 | T-05-SC | Package legitimacy verified on npmjs.com before install (never auto-approved) | manual | N/A — blocking-human legitimacy checkpoint | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | HK-01 | T-05-03 | Scoped read/workout-write usage descriptions; background delivery disabled (D-02/D-18) | unit | `cd apps/mobile && node -e "const p=require('./package.json').dependencies; if(!/^\^?14\./.test(p['@kingstinct/react-native-healthkit']||''))throw new Error('healthkit version');if(!p['react-native-nitro-modules'])throw new Error('nitro missing');console.log('deps ok')"` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | HK-01 | T-05-SC | HK native module linked via a fresh dev build (stale client excluded) | manual | N/A — on-device human-verify (Pitfall 6) | ❌ device | ⬜ pending |
| 05-02-01 | 02 | 1 | HK-02, HK-03, HK-04 | T-05-05 / T-05-04 | Parameterized builders only; dedupe query is tombstone-inclusive (Pitfall 9) | unit | `cd packages/db && pnpm vitest run src/__tests__/dedupe-candidate-query.test.ts` | ✅ W0 (RED-first, new) | ⬜ pending |
| 05-02-02 | 02 | 1 | HK-02 | — | Bundled migration materializes all six columns on the device DB | integration | `ls packages/db/drizzle/0003_*.sql >/dev/null && grep -l "healthkit_uuid" packages/db/drizzle/0003_*.sql && grep -l "bodyweight_set_at" packages/db/drizzle/0003_*.sql` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | HK-01, HK-02, HK-03, HK-04 | T-05-02 | Clamp-and-warn hostile HK numerics before engine/SQLite (V5) | unit (tdd) | `cd apps/mobile && pnpm vitest run lib/__tests__/healthkitMapping.test.ts` | ✅ W0 (RED-first, new) | ⬜ pending |
| 05-03-02 | 03 | 2 | HK-01 | T-05-03 | Minimal read set + workout-only write set; no bodyweight write (D-18) | unit | `cd apps/mobile && grep -q "HKQuantityTypeIdentifierBodyMass" lib/healthkitAuth.ts && grep -q "HK_WRITE_TYPES" lib/healthkitAuth.ts` | ✅ | ⬜ pending |
| 05-03-03 | 03 | 2 | HK-02 | T-05-01 | Never-throw sync-state accessor; logs Errors only, never raw health values | unit | `cd apps/mobile && grep -q "getSyncState" lib/healthkitSyncState.ts && grep -q "setSyncState" lib/healthkitSyncState.ts && grep -qE "healthkitAnchor|healthkit_anchor" lib/healthkitSyncState.ts` | ✅ | ⬜ pending |
| 05-04-01 | 04 | 2 | HK-03 | T-05-06 | Provenance chip rendered source-conditionally (own-data display only) | unit | `cd apps/mobile && grep -q "APPLE HEALTH" components/history/DayRow.tsx && grep -q "source" 'app/(tabs)/history/index.tsx'` | ✅ | ⬜ pending |
| 05-04-02 | 04 | 2 | HK-03 | T-05-06 | Provenance chip on session detail, source-conditional | unit | `cd apps/mobile && grep -q "APPLE HEALTH" app/session/detail.tsx && grep -q "source" app/session/detail.tsx` | ✅ | ⬜ pending |
| 05-05-01 | 05 | 3 | HK-01, HK-02, HK-03 | T-05-02 / T-05-04 | Sanitize + echo-exclude (sources filter + tombstone UUID); single recompute | unit | `cd apps/mobile && grep -q "recomputeLoadDaily" lib/healthkitImport.ts && grep -q "candidatesForDedupe" lib/healthkitImport.ts && grep -q "getMostRecentQuantitySample" lib/healthkitImport.ts` | ✅ | ⬜ pending |
| 05-05-02 | 05 | 3 | HK-02 | T-05-01 | Silent, gated, debounced foreground sync off the logging path | unit | `cd apps/mobile && grep -q "AppState" hooks/useForegroundHealthKitSync.ts && grep -q "useForegroundHealthKitSync" 'app/(tabs)/_layout.tsx'` | ✅ | ⬜ pending |
| 05-06-01 | 06 | 3 | HK-04 | T-05-08 | Raw-meters distance, ApsisHSS metadata, no calories, never rethrow | unit | `cd apps/mobile && grep -q "saveWorkoutSample" lib/healthkitWriteback.ts && grep -q "deleteObjects" lib/healthkitWriteback.ts` | ✅ | ⬜ pending |
| 05-06-02 | 06 | 3 | HK-04 | T-05-07 | Delete-sync fires only for self-authored (source==='manual') samples (D-14) | unit | `cd apps/mobile && grep -q "writeBackRun" lib/runEntry.ts && grep -q "writeBackLift" lib/finishWorkout.ts && grep -q "deleteHealthKitSample" lib/finishWorkout.ts` | ✅ | ⬜ pending |
| 05-07-01 | 07 | 4 | HK-01 | — | Gate-timing fix: version bump moved out of save() (Pitfall 2) | unit | `cd apps/mobile && ! grep -q "bumpProfileVersion" hooks/useSaveProfile.ts && grep -q "onboarding/healthkit" app/onboarding/review.tsx` | ✅ | ⬜ pending |
| 05-07-02 | 07 | 4 | HK-01 | T-05-09 | Terminal skippable step; 90-day import off the completion path (D-22) | manual | N/A — on-device human-verify (Pitfall 6) | ❌ device | ⬜ pending |
| 05-08-01 | 08 | 4 | HK-01, HK-02 | T-05-03 / T-05-01 | Permanent scoped re-entry; status line renders labels only, no raw values | unit | `cd apps/mobile && grep -q "Apple Health" 'app/(tabs)/settings/index.tsx' && grep -q "SYNC PAUSED" 'app/(tabs)/settings/index.tsx' && grep -q "requestHealthKitAuthorization" 'app/(tabs)/settings/index.tsx'` | ✅ | ⬜ pending |
| 05-08-02 | 08 | 4 | HK-01, HK-02 | — | On-device connect/toggle/last-sync; imports persist across toggle (D-21) | manual | N/A — on-device human-verify (Pitfall 6) | ❌ device | ⬜ pending |
| 05-09-01 | 09 | 4 | HK-03 | T-05-05 | Non-blocking dedupe hint reusing the import pipeline's tolerance | unit | `cd apps/mobile && grep -q "saving will count both" 'app/(tabs)/log/run.tsx'` | ✅ | ⬜ pending |
| 05-09-02 | 09 | 4 | HK-03 | T-05-01 | Counts-only transient notice — no raw imported values rendered | unit | `cd apps/mobile && grep -q "FROM APPLE HEALTH" 'app/(tabs)/index.tsx'` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/db/src/__tests__/dedupe-candidate-query.test.ts` — created RED-first inside 05-02 Task 1 (tdd) for HK-02/03/04 (tombstone-inclusive dedupe SQL).
- [x] `apps/mobile/lib/__tests__/healthkitMapping.test.ts` — created RED-first inside 05-03 Task 1 (type=tdd) for HK-01/02/03/04 (mapping, dedupe tolerance, recency, metadata, clamp-and-warn).
- [x] Framework install — none needed: vitest 4.1.9 + `vitest.config.mts` already exist in both `packages/db` and `apps/mobile`; both `test` scripts are `vitest run`.

*No separate Wave 0 wave is required: the two new suites are authored RED-first within their own TDD tasks (test precedes implementation in-task), so the sampling contract holds from the first commit of each.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh EAS dev build boots on device with the HealthKit native module + Nitro codegen linked (no redbox) | HK-01 | Native module only links in a fresh dev build on a physical device; Simulator has minimal Health data (Pitfall 6); Windows host cannot prebuild iOS | 05-01 Task 3: confirm Apple Developer HealthKit capability enabled for com.apsis.app, `eas build --profile development --platform ios`, install on a physical iOS device, confirm the app boots and reaches TODAY without crash |
| Terminal onboarding HealthKit step: accept → iOS permission sheet + background 90-day import; skip → quiet advance, never re-prompt | HK-01 | iOS permission sheet + real Health import require a physical device (Pitfall 6); step reachability depends on the runtime gate flip (Pitfall 2) | 05-07 Task 2: fresh install/reset onboarding on device, complete wizard through "Save & Start Training", confirm the HK step appears AFTER save (not a jump to tabs), tap "Connect Apple Health" → sheet appears → TODAY live-updates as import lands; reset, tap "Not now" → advances with no dialog and never re-appears |
| Settings Apple Health section: connect → connected; toggle off → SYNC PAUSED + no foreground sync; toggle on → LAST SYNC + sync runs; imports persist across toggle | HK-01, HK-02 | Permission sheet, foreground sync, and last-sync timing are on-device runtime behaviors; Simulator has no Health data (Pitfall 6) | 05-08 Task 2: on a physical device open Settings → "Apple Health"; connect via the sheet → row flips to "Connected"; toggle OFF → "SYNC PAUSED" and no import on foreground; toggle ON → "LAST SYNC …" and a foreground sync runs; confirm already-imported sessions remain in History (D-21 pause, not unlink) |

*Security gate (not a phase behavior): 05-01 Task 1 is a blocking-human package-legitimacy checkpoint for `react-native-nitro-modules` [SUS] — verified on npmjs.com before install, never auto-approved (T-05-SC).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are documented manual-only (4 checkpoint tasks: 05-01-01 security gate, 05-01-03/05-07-02/05-08-02 on-device UAT)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every plan interleaves automated grep/vitest gates between checkpoints)
- [x] Wave 0 covers all MISSING references (both new test files authored RED-first within their TDD tasks; vitest infra pre-exists)
- [x] No watch-mode flags (every command uses `vitest run` / `pnpm ... test` = `vitest run`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-11
