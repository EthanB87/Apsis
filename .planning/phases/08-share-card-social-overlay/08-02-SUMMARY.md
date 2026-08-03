---
phase: 08-share-card-social-overlay
plan: 02
subsystem: ui
tags: [expo-router, skia, expo-file-system, expo-sharing, share-card, hss]

# Dependency graph
requires:
  - phase: 08-01
    provides: expo-image-picker, expo-file-system, expo-sharing native deps linked in an EAS dev build
provides:
  - End-to-end void-card share pipeline (finish screen -> compose route -> Skia snapshot -> PNG file -> native iOS share sheet)
  - apps/mobile/lib/shareCard.ts pure caption builder (unit-tested, @apsis/db-free)
  - apps/mobile/components/share/ShareCardCanvas.tsx share-edition Skia ring/number/caption renderer
  - apps/mobile/lib/shareCardExport.ts never-throws snapshot -> file -> shareAsync glue
  - apps/mobile/app/session/share.tsx compose screen reading persisted workout.hss/type/localDate
affects: [08-03, 08-04]

# Actuals (#2632)
actuals:
  tokens: 5400
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Share-edition Skia ring recomposed at 1080px scale reusing HssRing's RING_FILL_REFERENCE_HSS constant and capped fillFraction formula, never re-mounting the react-native-svg HssRing component"
    - "Native-glue modules (shareCardExport.ts) follow nutritionCameraAuth.ts's never-throws / [Apsis]-prefixed-log / boolean-return convention"
    - "Compose screens read persisted DB values directly (workout.hss) rather than re-deriving via the engine, keeping shared numbers from drifting across surfaces"

key-files:
  created:
    - apps/mobile/lib/shareCard.ts
    - apps/mobile/lib/__tests__/shareCard.test.ts
    - apps/mobile/components/share/ShareCardCanvas.tsx
    - apps/mobile/lib/shareCardExport.ts
    - apps/mobile/app/session/share.tsx
  modified:
    - apps/mobile/app/session/finish.tsx

key-decisions:
  - "Share-edition HSS ring built as a separate 1080px Skia Circle element (not a re-mount of HssRing), importing only RING_FILL_REFERENCE_HSS and the capped fillFraction formula, since Skia Canvas trees cannot embed react-native-svg components"
  - "share.tsx reads workout.hss/type/localDate directly off the persisted row and never calls sessionHSSDetailed, so the shared card always matches the on-device number"
  - "finish.tsx's new Share card button is bone-filled (Colors.dark.text / onAccent) so the existing volt Done button keeps sole ownership of the one-volt-per-screen rule"
  - "Phase 08's D-XX decision codes (D-01, D-02, D-05, D-07, D-11..D-14) are phase-local identifiers from 08-CONTEXT.md, not global REQUIREMENTS.md REQ-IDs -- requirements.mark-complete correctly reported all eight as not_found/no-op; nothing was written to REQUIREMENTS.md for this plan, which is expected for this phase's tracking scheme"

patterns-established:
  - "Pattern: phase-local D-XX decision codes (08-CONTEXT.md) are distinct from REQUIREMENTS.md REQ-IDs and are not expected to appear in the global traceability table"

requirements-completed: []  # D-01/D-02/D-05/D-07/D-11..D-14 are 08-CONTEXT.md decision codes, not REQUIREMENTS.md REQ-IDs; see key-decisions

coverage:
  - id: D1
    description: "Bone-filled Share card button on finish.tsx opens a dedicated compose screen (session/share.tsx)"
    verification:
      - kind: manual_procedural
        ref: "On-device spike (Task 2), approved on physical iPhone, fresh EAS build 4367a805"
        status: pass
    human_judgment: false
  - id: D2
    description: "Compose screen renders a 1080x1080 void-black card with a share-edition volt-only HSS ring (no readiness band) and a mono LIFT/RUN date caption, reading HSS/type/date from persisted SQLite"
    verification:
      - kind: unit
        ref: "apps/mobile/lib/__tests__/shareCard.test.ts#buildShareCaption"
        status: pass
      - kind: manual_procedural
        ref: "On-device spike (Task 2), approved on physical iPhone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tapping Share snapshots the Skia canvas, writes a PNG to cache, and opens the native iOS share sheet with the image attached (not a PDF-only fallback), for both a lift and a run session"
    verification:
      - kind: manual_procedural
        ref: "On-device spike (Task 2): share sheet opened with attached PNG thumbnail, Save Image/Messages/social targets present, for both session types; user response 'approved'"
        status: pass
    human_judgment: true
    rationale: "Native share-sheet content and image fidelity can only be confirmed by a human looking at the actual iOS UI on a physical device -- exactly what RESEARCH Open Question 1 required"

duration: 8min
completed: 2026-08-03
status: complete
---

# Phase 08 Plan 02: End-to-end void-card share tracer Summary

**Void-card share pipeline (finish screen -> compose -> Skia snapshot -> PNG -> native iOS share sheet) proven end-to-end and verified on a physical iPhone.**

## Performance

- **Duration:** 8 min (Task 1 execution) + on-device verification turnaround
- **Started:** 2026-08-03T17:32:02Z
- **Completed:** 2026-08-03
- **Tasks:** 2 (1 tracer implementation + 1 checkpoint:human-verify, now resolved)
- **Files modified:** 6

## Accomplishments

- Wired the phase's highest-risk, zero-precedent pipeline (Skia `makeImageSnapshot` -> `encodeToBytes` -> `expo-file-system` `File` -> `expo-sharing` `shareAsync`) through every layer, from a single bone-filled "Share card" button on the finish screen.
- Built a pure, unit-tested caption builder (`shareCard.ts` / `buildShareCaption`) mirroring `runEntryLogic.ts`'s `@apsis/db`-free module convention.
- Built a share-edition Skia ring (`ShareCardCanvas.tsx`) at 1080px scale that reuses `HssRing`'s `RING_FILL_REFERENCE_HSS` constant and capped `fillFraction` formula instead of redefining ring math, with no `band` prop and no calibrating/steel-only variant (D-05).
- Built a never-throws native-glue module (`shareCardExport.ts`) following the `file.create` before `file.write` ordering and the `nutritionCameraAuth.ts` safe-fallback convention.
- Built the compose route (`app/session/share.tsx`) that reads `workout.hss`/`type`/`localDate` directly off the persisted SQLite row -- never re-deriving HSS via `sessionHSSDetailed` -- so the shared card can never drift from the on-device number.
- Validated the entire chain on a physical iPhone with a fresh EAS dev build: the native iOS share sheet opened with a real attached PNG for both a finished lift and a finished run, with the correct HSS and caption in each case.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end void-card share — one path, finish screen only** - `3f6af19` (feat)
2. **Task 2: On-device spike — validate the snapshot -> file -> share-sheet pipeline** - checkpoint:human-verify, no code changes; resolved by user approval on a physical iPhone (fresh EAS build 4367a805)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/mobile/lib/shareCard.ts` - Pure `buildShareCaption(sessionType, localDate)` + `ShareSessionType` type; zero I/O
- `apps/mobile/lib/__tests__/shareCard.test.ts` - Unit tests for both session types across multiple dates
- `apps/mobile/components/share/ShareCardCanvas.tsx` - 1080x1080 Skia canvas: void background, share-edition volt ring, HSS number (guarded matchFont), mono caption
- `apps/mobile/lib/shareCardExport.ts` - `exportAndShareCard(canvasRef)`: snapshot -> PNG bytes -> cache file -> native share sheet, never throws
- `apps/mobile/app/session/share.tsx` - New compose route reading persisted `workout.hss/type/localDate`, gates Share button until canvas has painted
- `apps/mobile/app/session/finish.tsx` - New secondary bone-filled "Share card" button pushing `/session/share` with `workoutId`; existing volt Done button unchanged

## Decisions Made

- Share-edition ring recomposed as a standalone 1080px Skia `Circle` element (not a re-mount of the react-native-svg `HssRing`), importing only `RING_FILL_REFERENCE_HSS` and the fill-fraction formula, since Skia Canvas trees cannot embed react-native-svg components.
- `share.tsx` reads `workout.hss` directly rather than recomputing via the engine, preventing any possibility of the shared number diverging from what the athlete already saw on the finish screen.
- `finish.tsx`'s new button is bone-filled (`Colors.dark.text` / `onAccent`) to preserve the one-volt-per-screen rule; the Done button remains the screen's sole volt CTA.
- Phase 08's `D-XX` codes (D-01, D-02, D-05, D-07, D-11–D-14) are phase-local decision identifiers defined in `08-CONTEXT.md`, not `REQUIREMENTS.md` REQ-IDs. Running `requirements mark-complete` against them correctly returned all eight as `not_found` (no-op, nothing written) -- this phase's requirements tracking lives in `08-CONTEXT.md`'s decision log, not the global traceability table.

## Deviations from Plan

None - plan executed exactly as written. Task 1 was implemented per the plan's file-by-file wiring instructions with no auto-fixes required; Task 2's on-device checkpoint was approved without any code changes.

## Issues Encountered

One transient on-device failure during the Task 2 spike: "Cannot find native module ExpoSharing" plus an expo-router `ErrorBoundary` render error, caused by a stale dev-client binary predating the 08-01 native dependency link. Resolved by deleting the old app and installing the fresh EAS dev build (4367a805) that includes the 08-01 native modules -- not a code defect, matches the STATE.md Phase 04/05 lesson that native-dep changes require a fresh EAS dev build before on-device testing.

## User Setup Required

None - no external service configuration required.

## Scope Confirmation for Later Waves

During Task 2 verification the user reiterated two pieces of already-in-scope feedback (not new asks, not deviations):
- A Share entry point on the session detail page -- already tracked as 08-03's D-11 second-entry-point requirement.
- The ability to add their own photo to the card -- already tracked as 08-04's D-06 photo-picker requirement.

No action taken in this plan; recorded here purely as confirmation that upcoming waves already cover the feedback.

## Next Phase Readiness

- The end-to-end share pipeline (render -> snapshot -> file -> share sheet) is now proven on-device, resolving RESEARCH Open Question 1 before 08-03/08-04 build the stat trio, footer branding, photo picker, and second entry point on top of it.
- `ShareCardCanvas.tsx` has clearly-marked room for the stat trio and footer branding that 08-03 adds.
- No blockers for 08-03 (session-detail entry point + stat trio/footer) or 08-04 (photo picker + full composition).

---
*Phase: 08-share-card-social-overlay*
*Completed: 2026-08-03*
