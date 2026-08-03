---
phase: 08-share-card-social-overlay
plan: 03
subsystem: ui
tags: [expo-router, skia, share-card, hss, unit-conversion]

# Dependency graph
requires:
  - phase: 08-02
    provides: End-to-end void-card share pipeline (compose route, ShareCardCanvas skeleton, shareCardExport.ts, finish.tsx entry point) proven on a physical iPhone
provides:
  - lib/shareCard.ts D-03 stat-trio formatters (buildStrengthStatTrio, buildEnduranceStatTrio, ShareStatPair)
  - ShareCardCanvas.tsx full fixed composition -- ring + D-03 stat trio + D-04 footer (plate-mark + wordmark + caption)
  - share.tsx stat-trio SQLite aggregation (strength volume/sets/duration, endurance distance/pace/duration)
  - detail.tsx second Share entry point (D-11)
affects: [08-04]

# Actuals (#2632)
actuals:
  tokens: 7140
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skia footer icon: useImage(require(...)) resolves the already-palette-colored plate-mark asset with no tint needed -- useImage never throws (resolves null on failure), so the icon simply skips drawing rather than crashing the card"
    - "Stat-trio row: fixed 3-column layout at SHARE_CARD_SIZE/6, /2, 5/6 x-centers, value text over label text per column, matching the guarded-matchFont convention already used for the ring number/caption"

key-files:
  created: []
  modified:
    - apps/mobile/lib/shareCard.ts
    - apps/mobile/lib/__tests__/shareCard.test.ts
    - apps/mobile/components/share/ShareCardCanvas.tsx
    - apps/mobile/app/session/share.tsx
    - apps/mobile/app/session/detail.tsx

key-decisions:
  - "Work-set count (D-03 'sets') excludes warmup sets across BOTH reps-mode and timed-mode strength sets, diverging from finish.tsx's per-exercise setCount (which includes warmups) -- the plan explicitly asked for 'the work-set count', and a public-facing share card should show what was actually worked, not warmup reps"
  - "Lift session duration derives from workout.createdAt -> workout.finishedAt (same two timestamps healthkitWriteback.ts uses), degrading to 0 rather than throwing if finishedAt is still null (the D-14 crash-resume path can reach share.tsx before a Done tap sets it)"
  - "Endurance stat-trio inputs sum across ALL endurance_segment rows for the workout (not just the first), so a multi-segment session's distance/pace/duration reflects the whole session rather than only its first leg"
  - "Null distance/pace degrades to a dash ('—') rather than being omitted, since buildEnduranceStatTrio's contract is always exactly 3 pairs (unlike finish.tsx's variable-length filter(Boolean).join() line)"
  - "Plate-mark footer asset rendered undyed (no Skia ColorFilter tint) -- the PNG is already bone/ash/volt colored (same asset used, tinted, for the tab-bar icon), so it matches the palette as-is"
  - "detail.tsx's Share entry point is a Pressable appended after totalRow (not a headerRight button) -- keeps the same layout rhythm/spacing convention finish.tsx's bone shareButton already established, per 08-PATTERNS.md's either/or guidance"

patterns-established:
  - "Skia canvas footer icon via useImage(require(asset)) with no ColorFilter tint, for any pre-colored brand-asset PNG"

requirements-completed: []  # D-03/D-04/D-09/D-11 are 08-CONTEXT.md phase-local decision codes, not REQUIREMENTS.md REQ-IDs (same finding as 08-02); requirements.mark-complete correctly no-ops on them

coverage:
  - id: D1
    description: "buildStrengthStatTrio/buildEnduranceStatTrio each return exactly 3 labeled stat pairs, reusing finish.tsx's exact volume/duration/distance/pace conventions, for both session types and both unit systems (metric/imperial), singular/plural sets, and a null-distance case"
    requirement: "D-03"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/shareCard.test.ts (buildStrengthStatTrio, buildEnduranceStatTrio describe blocks, 6 new tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ShareCardCanvas renders the full fixed composition on the void card: recomposed 1080px ring/number, the D-03 stat trio (3 columns, value over label), and the D-04 subtle footer (plate-mark + APSIS wordmark + mono caption); share.tsx aggregates the correct stat-trio inputs from SQLite per session type without ever calling sessionHSSDetailed"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "pnpm run typecheck (tsc --build) -- exits 0 across all 5 modified files"
        status: pass
    human_judgment: true
    rationale: "Skia canvas rendering (font layout, image placement, palette fidelity) can only be confirmed by looking at the actual exported card on a physical device -- deferred to 08-04's on-device checkpoint per this plan's own <verify> note, since 08-04 adds the photo background this same canvas will be checked against"
  - id: D3
    description: "History session detail (detail.tsx) has a bone-filled Share entry point below the volt total row that pushes /session/share with the workoutId, at a minimum 44pt hit target"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "pnpm run typecheck (tsc --build) -- exits 0; grep confirms router.push('/session/share', ...), styles.shareButton with HIT_TARGET_MIN"
        status: pass
    human_judgment: true
    rationale: "Tap-through navigation and bone-vs-volt visual correctness on the actual session detail screen requires a human looking at the running app -- no on-device checkpoint was run in this plan (deferred, matching 08-02's pattern of grouping on-device verification into a later plan)"

duration: 10min
completed: 2026-08-03
status: complete
---

# Phase 08 Plan 03: Full Card Composition + Second Entry Point Summary

**Expanded the 08-02 void-card tracer into the full fixed composition (D-03 stat trio + D-04 subtle footer branding, D-09 recomposed sizing) and wired History session detail as the second Share entry point (D-11).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-03T18:49:27Z
- **Completed:** 2026-08-03T18:59:15Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `buildStrengthStatTrio`/`buildEnduranceStatTrio` to `lib/shareCard.ts`, each returning exactly 3 labeled stat pairs and reusing `finish.tsx`'s exact volume/duration/distance/pace math (via `@apsis/shared`'s `kgToDisplayLb`/`kmToDisplayMi`/`paceSecPerKmToSecPerMi`/`formatPaceMinSec`) so the card's numbers can never drift from what the athlete already saw on the finish/detail screens.
- Extended `ShareCardCanvas.tsx`'s render tree with the D-03 fixed stat trio (3 equal columns, value-over-label) and the D-04 subtle footer (plate-mark icon + "APSIS" mono wordmark, bottom-left; mono session-type/date caption, bottom-right) -- every new font resolution guarded try/catch, the plate-mark `useImage` call never throws.
- Extended `share.tsx`'s SQLite-is-truth query to aggregate the stat-trio inputs directly from persisted rows: non-warmup reps-mode volume + work-set count + `workout.createdAt`/`finishedAt`-derived duration for strength/hybrid; summed `endurance_segment` distance/duration with a divide-by-zero-guarded pace for endurance -- still never calls `sessionHSSDetailed`.
- Added a bone-filled "Share card" entry point to `detail.tsx` below the existing volt total row, pushing `/session/share` with the already-held `workoutId` -- the phase's second entry point, confirmed-wanted scope per the user's on-device 08-02 feedback.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stat-trio + duration formatters in lib/shareCard.ts** - `4030f86` (feat)
2. **Task 2: Full card composition -- stat trio + footer branding in ShareCardCanvas + share.tsx stat data** - `4cce441` (feat)
3. **Task 3: Share entry point on History session detail (D-11)** - `1b6be6f` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/mobile/lib/shareCard.ts` - Added `ShareStatPair`, `ShareCardStrengthStats`, `ShareCardEnduranceStats` interfaces and `buildStrengthStatTrio`/`buildEnduranceStatTrio` formatters
- `apps/mobile/lib/__tests__/shareCard.test.ts` - 6 new vitest cases covering both trios, both unit systems, singular/plural sets, zero-duration, and null-distance
- `apps/mobile/components/share/ShareCardCanvas.tsx` - Recentered/resized the ring, added the D-03 stat-trio row and D-04 footer (plate-mark `Image` via `useImage`, "APSIS" wordmark, caption) to the render tree
- `apps/mobile/app/session/share.tsx` - Extended the `useEffect` query to fetch `workout.createdAt`/`finishedAt`, join `strengthSet`+`exercise` for volume/sets, query `endurance_segment` for distance/duration, fetch profile units, and build the correct stat trio
- `apps/mobile/app/session/detail.tsx` - Added `useRouter` import and a bone-filled Share entry point after `totalRow`

## Decisions Made

- Work-set count (D-03 "sets") excludes warmup sets across both reps-mode and timed-mode strength sets, diverging from `finish.tsx`'s per-exercise `setCount` (which includes warmups) -- the plan explicitly asked for "the work-set count," and a share-facing card should reflect what was actually worked.
- Lift session duration derives from `workout.createdAt` -> `workout.finishedAt` (same two timestamps `healthkitWriteback.ts` uses), degrading to `0` rather than throwing if `finishedAt` is still null.
- Endurance stat-trio inputs sum across *all* `endurance_segment` rows for the workout, not just the first, so a multi-segment session's numbers reflect the whole session.
- Null distance/pace degrades to a dash ("—") rather than being omitted, since the trio builders always return exactly 3 pairs.
- The plate-mark footer asset is rendered undyed (no Skia `ColorFilter` tint) -- it's the same PNG already used (tinted) for the tab-bar icon, and its native colors are already bone/ash/volt.
- `detail.tsx`'s Share entry point is a `Pressable` appended after `totalRow` (not a `headerRight` button), matching `finish.tsx`'s existing bone `shareButton` layout rhythm exactly, per `08-PATTERNS.md`'s either/or guidance.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated `<verify>` steps (vitest + `pnpm run typecheck`) passed on the first implementation without needing any Rule 1-3 auto-fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ShareCardCanvas.tsx` now renders the complete fixed void-card composition (ring, stat trio, footer branding) that 08-04 will layer the photo background + void→transparent scrim (D-10) on top of, plus the photo-picker compose flow (D-06/D-08/D-15/D-16).
- Both share entry points (finish screen, History session detail) are now live and push the same compose route.
- The full on-device visual/tap-through verification for this plan's D2/D3 deliverables (stat trio + footer rendering, detail.tsx Share button tap) is deferred to 08-04's on-device checkpoint, consistent with this plan's own `<verify>` note that full UAT happens there -- no blocker, since 08-04 needs a fresh on-device pass anyway once the photo picker lands.
- No blockers for 08-04.

---
*Phase: 08-share-card-social-overlay*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: apps/mobile/lib/shareCard.ts
- FOUND: apps/mobile/lib/__tests__/shareCard.test.ts
- FOUND: apps/mobile/components/share/ShareCardCanvas.tsx
- FOUND: apps/mobile/app/session/share.tsx
- FOUND: apps/mobile/app/session/detail.tsx
- FOUND: commit 4030f86
- FOUND: commit 4cce441
- FOUND: commit 1b6be6f
