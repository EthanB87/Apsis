---
phase: 05-healthkit-integration
verified: 2026-07-12T00:00:00Z
status: human_needed
score: 4/8 must-haves verified
behavior_unverified: 4
overrides_applied: 0
human_verification:
  - test: "CR-01 fix — dedupe classifies by provenance, not uuid nullability (HK-03, roadmap SC3). On a physical device with HealthKit connected, log a manual run in Apsis (which write-backs to Health and stores its own uuid on the row), then let an actual Apple Watch/Health workout of similar duration on the same day sync in (or manually add a same-day/similar-duration workout sample in the Health app)."
    expected: "The watch/Health sample does NOT import as a second Apsis session — the manual row (now source='manual' with its own write-back healthkitUuid) is still recognized as a manual duplicate via `source === 'manual'` classification, not skipped due to its non-null healthkitUuid. Day HSS must not double-count."
    why_human: "This is a state-transition/invariant (duplicate classification against live HealthKit data) that unit tests only prove at the SQL-generation level (dedupe-candidate-query.test.ts asserts `source` is SELECTed, not that runtime classification skips the right row). The only on-device build that ever exercised this code (694ca7a8) predates the CR-01 fix commit (6adae75) — no post-fix on-device evidence exists."
  - test: "CR-02 fix — bodyweightSetAt stamped on every manual bodyweight write, so most-recent-wins resolves correctly (HK-02, roadmap SC2). On a fresh onboarding flow, enter bodyweight, connect HealthKit immediately after — confirm a stale HK body-mass sample does NOT overwrite the just-entered value. Separately, edit bodyweight in Settings after a prior HK import — confirm a HK sample older than the edit does not silently overwrite it on the next foreground sync."
    expected: "The manually-entered/edited bodyweight persists; only a HealthKit body-mass sample newer than the last manual `bodyweightSetAt` timestamp should override it."
    why_human: "Conflict-resolution correctness against a real HK body-mass sample timeline cannot be exercised by the existing unit test (`bodyweightSampleIsNewer`) alone, since the bug was in the call sites that failed to stamp `bodyweightSetAt`, not in the tested comparator itself. No on-device build post-dating the CR-02 fix commit (2b70769) has been used for this specific check."
  - test: "CR-03 fix — a retried initial sync after a failure stays bounded to the 90-day window (HK-01/HK-03). Force an initial sync to fail partway (e.g. airplane-mode mid-sync, or kill the app during the first 90-day import before it completes), then relaunch and let the foreground sync retry."
    expected: "The retry imports only workouts from the last 90 days — never the user's entire HealthKit history."
    why_human: "This is an error-path/retry invariant that requires deliberately interrupting a sync to observe — not something the existing on-device checkpoints (which only observed a successful uninterrupted first-connect flow) ever exercised, and the fix commit (f193c8c) postdates every on-device build used in this phase."
  - test: "HK-04 — a saved lift/run appears in the Health app with correct distance/duration and an ApsisHSS metadata key (no calories), and discarding an Apsis-authored session removes that sample from Health while an imported session's sample is left untouched. Also verify a re-tapped 'Done'/crash-resume 'Finish Now' does not create a duplicate Health sample (WR-07), and a back-dated run write-back lands on the correct calendar day in Health (WR-08)."
    expected: "Health app shows the new workout with the right totals and ApsisHSS metadata (visible via a HealthKit sample inspector or the Health app's workout detail); discard removes only self-authored samples; re-invoking finish does not duplicate; back-dated runs appear on the logged date, not today."
    why_human: "05-06-PLAN.md (the plan that built the entire write-back/delete-sync engine) contains no `checkpoint:human-verify` task — HK-04's core behavior (the fourth roadmap Success Criterion) has never been observed on any physical device at any point in this phase, pre- or post-fix. This is a genuine gap in phase closure, not merely a staleness issue."
---

# Phase 05: HealthKit Integration Verification Report

**Phase Goal:** A user's existing Apple Health data flows into Apsis without duplicate entries, and Apsis writes logged sessions back to Health — the lowest-priority v1.0 feature, first to defer if the timeline slips.
**Verified:** 2026-07-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Context: Why This Verification Differs From the SUMMARYs

All 9 plans report `status: complete`, and REQUIREMENTS.md marks HK-01 through HK-04 "Complete." A post-execution code review (05-REVIEW.md) then found 3 Critical + 10 Warning defects — all inside the exact dedupe/conflict-resolution/write-back logic that IS this phase's goal — and 05-REVIEW-FIX.md reports all 13 fixed and committed (`6adae75`..`2b28633`).

Every fix I checked against the current source tree is genuinely present (see Artifacts/Key Links below) and the full test suite (165 tests) plus root typecheck are clean of any new regressions. The gap is not in the code — it's in the evidence chain: **every on-device human-verification checkpoint this phase ever ran (05-01 Task 3, 05-07 Task 2, 05-08 Task 2) used EAS dev build `694ca7a8`, which was built and installed BEFORE any of the 13 review-fix commits existed** (build ~2026-07-11T23:50Z per 05-01-SUMMARY.md; fix commits authored through 2026-07-12T03:54Z per 05-REVIEW-FIX.md). Additionally, 05-06-PLAN.md (the write-back engine, HK-04) never scheduled an on-device checkpoint at all, in either its original or fixed form.

This means the three critical logic fixes (CR-01 dedupe-by-source, CR-02 bodyweightSetAt stamping, CR-03 bounded retry) and the entire write-back/delete-sync path (HK-04) are running in a state that has literally never been exercised on a physical device against real HealthKit data. This is exactly the class of runtime state-transition/invariant behavior that grep and unit tests cannot see (per verification methodology Step 3) — code presence and wiring are necessary but not sufficient here.

## Goal Achievement

### Observable Truths

| # | Truth (source) | Status | Evidence |
|---|------|--------|----------|
| 1 | User grants HealthKit permission and app imports existing runs (distance/duration/HR) (Roadmap SC1 / HK-01) | ✓ VERIFIED | Code present + wired (`healthkitImport.ts`, `healthkitAuth.ts`, `onboarding/healthkit.tsx`); on-device checkpoint (05-07 Task 2, build `694ca7a8`) confirmed the permission sheet, import, and live TODAY update. Caveat: build predates WR-01 (transactional writes)/WR-02 (cold-launch trigger)/WR-03 (concurrency guard)/WR-04 (deletion handling), none of which have been re-exercised, but the core "grant → import → appears" mechanic was directly observed once. |
| 2 | App imports the user's most-recent bodyweight from HealthKit (Roadmap SC2 / HK-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `healthkitImport.ts` calls `getMostRecentQuantitySample`/`bodyweightSampleIsNewer` correctly and CR-02 stamps `bodyweightSetAt` on every manual write (`useSaveProfile.ts:62`, `settings/index.tsx:330`) — code-complete. But the conflict-resolution correctness this fix restores has never been observed on-device (the bug and its fix are both in the manual-write call sites, not in the already-unit-tested comparator). See human-verification item 2. |
| 3 | Imported HealthKit runs never create duplicate entries alongside manual runs covering the same time range (Roadmap SC3 / HK-03) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | CR-01 fix confirmed in code: `healthkitImport.ts:230-237` and `queries.ts:190-211` classify by `source === 'manual'`, not `healthkitUuid == null`; regression test `dedupe-candidate-query.test.ts` asserts the SQL selects `source`. This is the phase's headline defect (double-counted day HSS) and its fix has zero post-fix on-device confirmation. See human-verification item 1. |
| 4 | After saving a lifting or running session, it appears in the Health app (Roadmap SC4 / HK-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `healthkitWriteback.ts`/`runEntry.ts`/`finishWorkout.ts` are complete, wired, and match the D-12/D-13/D-14 contract (raw meters, ApsisHSS-only metadata, source-gated delete-sync, WR-07 idempotency, WR-08 back-dated timestamp fix all present in code). No plan in this phase ever scheduled a `checkpoint:human-verify` task for this specific behavior — it has never been observed on a device. See human-verification item 4. |
| 5 | Manual sessions never get their Health sample deleted when they weren't authored by Apsis, and Apsis never deletes an imported sample (HK-04 sub-behavior) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `finishWorkout.ts:83-97` gates delete-sync on `source === 'manual' && healthkitUuid != null` — code correct. Bundled into human-verification item 4 (same missing checkpoint). |
| 6 | Provenance is visible: an imported session shows an "APPLE HEALTH" chip in History and session detail; manual sessions show none | ✓ VERIFIED | `SourceChip.tsx` extracted and reused by `DayRow.tsx:138` and `session/detail.tsx:295`, both gated on `source === 'healthkit'`; `history/index.tsx:118` threads `source` from `dayGroupedSessions` (which now selects `workout.source`, confirmed in `queries.ts:169`). Pure rendering of a DB column — no native runtime dependency, safely presence-verifiable. |
| 7 | Settings has a permanent Apple Health section (connect / connected+toggle / LAST SYNC or SYNC PAUSED) | ✓ VERIFIED | `settings/index.tsx` contains the section (`grep` confirms "Apple Health", "SYNC PAUSED", `requestHealthKitAuthorization`, `LAST SYNC`); on-device checkpoint (05-08 Task 2, build `694ca7a8`) confirmed connect/toggle/last-sync behavior. This UI-level toggle mechanic is unaffected by the CR-01/02/03 logic fixes (it only flips `healthkitConnected` and displays a timestamp), so the stale build is a lower-risk caveat here than for items 2-5. |
| 8 | Onboarding offers a terminal, skippable "Connect Apple Health" step; both paths complete onboarding without re-prompting | ✓ VERIFIED | `onboarding/healthkit.tsx` implements both paths bumping `useProfileVersion`; the Pitfall 2 gate-race fix (`useSaveProfile.ts`, `review.tsx`) is in place. On-device checkpoint (05-07 Task 2, build `694ca7a8`) confirmed step ordering, accept/skip, and no re-prompt. This routing/UI mechanic is unaffected by CR-01/02/03. |

**Score:** 4/8 truths fully verified; 4 present + wired but behavior-unverified (see `behavior_unverified_items`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `@kingstinct/react-native-healthkit@^14.0.2` + `react-native-nitro-modules@^0.36.1` | Installed, config plugin wired | ✓ VERIFIED | Present in `apps/mobile/package.json`; entitlement/usage strings in `app.json` (not re-read this pass, confirmed via 05-01-SUMMARY + build success) |
| `workout.source` / `workout.healthkitUuid` / `user_profile.bodyweightSetAt`/`healthkitConnected`/`healthkitLastSyncAt`/`healthkitAnchor` | Schema columns + migration | ✓ VERIFIED | All six columns present in `packages/db/src/schema.ts`; `0003_normal_hairball.sql` migration confirmed generated (05-02-SUMMARY) |
| `candidatesForDedupe` query builder | Tombstone-inclusive, source-classified | ✓ VERIFIED | `packages/db/src/queries.ts:190-211`; selects `durationS`, `healthkitUuid`, `source` (CR-01), `deletedAt` (WR-05); WHERE stays deletedAt-blind; 6 regression tests pass |
| `healthkitMapping.ts` (pure) | mapHKActivityType/isDuplicateOfExisting/bodyweightSampleIsNewer/buildHSSMetadata/sanitizeHKNumeric | ✓ VERIFIED | `apps/mobile/lib/healthkitMapping.ts` — zero I/O, all functions present, vitest-covered |
| `healthkitAuth.ts` | Minimal read/write identifier sets | ✓ VERIFIED | `HK_READ_TYPES` (workout+HR+bodyweight), `HK_WRITE_TYPES` (workout-only, no bodyweight write per D-18) |
| `healthkitSyncState.ts` | Never-throw drizzle accessor | ✓ VERIFIED | `getSyncState`/`setSyncState` present, wrapped try/catch |
| `healthkitImport.ts` | Anchored batch import + dedupe + bodyweight | ✓ VERIFIED (code) / ⚠️ UNVERIFIED (runtime) | All CR-01/CR-03/WR-01/WR-03/WR-04 fixes present in code (module-level in-flight guard, transactional per-sample writes, `dateStart` applied whenever `anchor == null`, deletedSamples soft-delete). Runtime correctness of the fixed logic is the open item. |
| `useForegroundHealthKitSync.ts` | AppState-driven, debounced, silent sync trigger | ✓ VERIFIED (code) | WR-02 cold-launch `triggerSync()` on mount present; hook mounted once in `app/(tabs)/_layout.tsx` |
| `healthkitWriteback.ts` | writeBackRun/writeBackLift/deleteHealthKitSample | ✓ VERIFIED (code) / ⚠️ UNVERIFIED (runtime, never checkpointed) | Raw-meters distance, ApsisHSS-only metadata, never-rethrow contract all present |
| Provenance chip (History + detail) | Ash APPLE HEALTH chip, source-conditional | ✓ VERIFIED | `SourceChip.tsx` shared component, gated correctly on both surfaces |
| Settings Apple Health section | Connect/connected+toggle/last-sync | ✓ VERIFIED | Present, on-device checkpointed (pre-fix build, low risk for this UI-only surface) |
| Onboarding terminal step | Connect/skip, no re-prompt | ✓ VERIFIED | Present, on-device checkpointed (pre-fix build, low risk for this UI-only surface) |
| Run-form dedupe hint (D-09) + TODAY notice (D-10) | Soft warning, transient notice | ✓ VERIFIED | `run.tsx` hint gated on `source === 'healthkit' && deletedAt == null` (WR-05 fix applied); `index.tsx` notice now reactive to the zustand selector (WR-10 fix applied) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `workout.source` (schema) | `dayGroupedSessions` select | `queries.ts:169` | ✓ WIRED | Confirmed present |
| `dayGroupedSessions.source` | `DaySession.source` | `history/index.tsx:118` | ✓ WIRED | `source: s.source ?? 'manual'` |
| `DaySession.source` | `SourceChip` render gate | `DayRow.tsx:138` | ✓ WIRED | Conditional render confirmed |
| `candidatesForDedupe` | `run.tsx` D-09 hint | `run.tsx:141-147` | ✓ WIRED | Filters `source === 'healthkit' && deletedAt == null` (post-WR-05) |
| `useForegroundHealthKitSync` last-import signal | TODAY notice | `index.tsx:368-373` | ✓ WIRED | Reactive zustand selector (post-WR-10), not a stale `getState()` snapshot |
| `runHealthKitSync` | `recomputeLoadDaily` | `healthkitImport.ts:317` | ✓ WIRED | Single call site, after the loop, confirmed by inspection (Pitfall 10 respected) |
| `saveRun`/`finishWorkout` | `writeBackRun`/`writeBackLift` | `runEntry.ts:140`, `finishWorkout.ts:63` | ✓ WIRED | Fire-and-forget tails, gated on `healthkitConnected`, uuid stored back on success |
| `discardWorkout` | `deleteHealthKitSample` | `finishWorkout.ts:94-96` | ✓ WIRED | Gated on `source === 'manual' && healthkitUuid != null` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (engine/db/shared/mobile) | `pnpm -r --if-present test` | 165/165 passed (21 shared, 81 engine, 33 db, 30 mobile) | ✓ PASS |
| Root typecheck introduces no new phase-05 errors | `pnpm run typecheck` | 2 pre-existing errors only (`review.tsx:39` field-edit push, `ExternalLink.tsx`), both documented in STATE.md/03-deferred-items.md as unrelated pre-existing typed-route issues | ✓ PASS |
| Dedupe-candidate SQL regression (CR-01/WR-05) | `pnpm vitest run src/__tests__/dedupe-candidate-query.test.ts` (via full suite) | 6/6 passed — asserts `source`/`deleted_at` selected, WHERE stays deletedAt-blind | ✓ PASS (structural only — does not exercise runtime classification against live data) |
| On-device HealthKit behavior (import/dedupe/write-back/bodyweight) | N/A — requires physical device + real Health data (Pitfall 6) | Not run this pass | ? SKIP — routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| HK-01 | 05-01, 05-03, 05-05, 05-07, 05-08 | Grant permission, import runs (distance/duration/HR) | ✓ SATISFIED (code) — human-verification recommended for full regression given WR-01/02/03/04 | On-device checkpoint exists but predates 4 warning-level fixes touching this exact path |
| HK-02 | 05-02, 05-03, 05-05, 05-08 | Import most-recent bodyweight | ? NEEDS HUMAN | CR-02 fix unverified on-device (human-verification item 2) |
| HK-03 | 05-02, 05-03, 05-04, 05-05, 05-09 | Dedup imported vs. manual entries | ? NEEDS HUMAN | CR-01 fix — the phase's headline defect — unverified on-device (human-verification item 1) |
| HK-04 | 05-02, 05-06 | Write logged sessions back to Health | ? NEEDS HUMAN | Never had an on-device checkpoint at all, pre- or post-fix (human-verification item 4) |

No orphaned requirements — REQUIREMENTS.md's Phase 05 traceability (HK-01..HK-04) exactly matches the four requirement IDs declared across the 9 plans' frontmatter.

**Note:** REQUIREMENTS.md currently marks all four HK-01..HK-04 as `[x] Complete`. Given the findings above, this verification recommends downgrading HK-02/HK-03/HK-04 to a "code-complete, on-device verification pending" state rather than leaving them checked as if fully closed — the checkbox currently overstates certainty relative to the evidence chain.

### Anti-Patterns Found

None. Scanned all HealthKit-specific files touched by this phase (`healthkitImport.ts`, `healthkitWriteback.ts`, `healthkitMapping.ts`, `healthkitAuth.ts`, `healthkitSyncState.ts`, `useForegroundHealthKitSync.ts`, `onboarding/healthkit.tsx`, `settings/index.tsx`, `run.tsx`, `(tabs)/index.tsx`, `runEntry.ts`, `finishWorkout.ts`, `schema.ts`, `queries.ts`) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/"not yet implemented" markers — zero matches. Info-level findings from 05-REVIEW.md (IN-01 through IN-05) remain unaddressed by design (`fix_scope: critical_warning` excluded them) — none are blockers; IN-04 (clamped-duration junk sessions) is worth noting as a known minor rough edge but is not a phase-goal blocker.

### Human Verification Required

See frontmatter `human_verification` for the full structured list. Summary:

1. **CR-01 re-verification (HK-03 / Roadmap SC3)** — confirm a manually-logged run that has been written back to Health (and thus carries a non-null `healthkitUuid`) is still correctly recognized as the "manual" side of the D-06/D-07 duplicate check, so a matching watch-recorded sample does not import as a second session and double-count day HSS. This is the single highest-priority item — it is the phase's namesake defect.
2. **CR-02 re-verification (HK-02 / Roadmap SC2)** — confirm a manually-entered/edited bodyweight is never silently overwritten by an older HealthKit body-mass sample.
3. **CR-03 re-verification (HK-01/HK-03)** — confirm a retried initial sync (after an interrupted/failed first attempt) stays bounded to the 90-day window rather than importing full HealthKit history.
4. **HK-04 first-ever on-device check (Roadmap SC4)** — confirm a saved lift/run actually appears in the Health app with correct totals + ApsisHSS metadata (no calories), that discard deletes only self-authored samples, that a re-tapped finish doesn't duplicate (WR-07), and that a back-dated run lands on the correct day in Health (WR-08).

All four should be run on a **fresh EAS dev build compiled from current `master`** (i.e., including commits `6adae75`..`2b28633`), not the `694ca7a8` build already used for 05-01/05-07/05-08's checkpoints.

### Gaps Summary

No structural gaps — every plan's declared artifacts exist, are substantively implemented (not stubs), are wired end-to-end, and pass the full automated test suite plus typecheck with no new regressions. All 13 code-review findings (3 Critical, 10 Warning) are genuinely fixed in the current source tree, confirmed by direct inspection of each fix's stated file/line, not merely by re-reading 05-REVIEW-FIX.md's claims.

The phase's actual open risk is an **evidence gap, not a code gap**: this phase's core value proposition — "flows in without duplicate entries, and writes back" — depends on exactly the runtime logic that was buggy (CR-01/02/03) and, separately, on write-back behavior (HK-04) that has never been checkpointed on any device at all. Given HealthKit behavior is fundamentally a native-runtime concern that unit tests and grep cannot observe, this phase cannot be marked fully verified until a fresh on-device pass (post-fix build) confirms the four items above.
