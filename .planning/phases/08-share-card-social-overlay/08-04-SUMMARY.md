---
phase: 08-share-card-social-overlay
plan: 04
subsystem: ui
tags: [skia, expo-image-picker, useFont, expo-sharing, share-card, photo-picker, permissions]

# Dependency graph
requires:
  - phase: 08-share-card-social-overlay (plan 02)
    provides: "Tracer render->export->share pipeline (ShareCardCanvas, shareCardExport, share.tsx, finish.tsx entry)"
  - phase: 08-share-card-social-overlay (plan 03)
    provides: "Full card composition (stat trio + footer branding) and the History detail entry point"
provides:
  - "Photo-first compose flow: permission -> native square-crop pick -> photo background with bottom scrim (D-06/D-08/D-15/D-10)"
  - "Never-throws photo permission + pick wrappers (requestPhotoLibraryPermission, pickShareBackgroundPhoto) honoring iOS limited access"
  - "Denied/limited/skip all fall back to the void branded card; sharing never hard-blocks (D-16/D-07)"
  - "Skia-native font loading via useFont (raw TTF assets) - the pattern for ALL Skia text in this codebase"
  - "Variant-dependent ring: compact top-left badge on photo cards, large centered hero on void cards"
affects: [share-card, skia-text-rendering, trend-chart]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 8000
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skia text MUST load fonts via useFont(raw TTF asset) - matchFont(familyName) cannot see expo-font-registered families"
    - "Photo-variant vs void-variant composition switches on the RESOLVED useImage result, never the raw URI prop"
    - "Export gating: Share button disabled until Skia fonts resolve (onFontsReady) + canvas settle timer"

key-files:
  created: []
  modified:
    - apps/mobile/lib/shareCardExport.ts
    - apps/mobile/app/session/share.tsx
    - apps/mobile/components/share/ShareCardCanvas.tsx

key-decisions:
  - "Skia card fonts load via useFont(raw TTF from @expo-google-fonts packages), not matchFont(family name) - expo-font's useFonts registration is invisible to Skia's system font manager, which made every canvas <Text> silently blank on-device"
  - "Share button additionally gated on onFontsReady so an export can never produce a blank-text PNG while fonts are still loading"
  - "Photo cards render a compact top-left ring badge (radius 130/stroke 14/number 100px, footer-aligned 90px margin); void cards keep the large centered hero ring - user-chosen refinement from on-device UAT"
  - "Ring variant keys off the resolved photoImage (not backgroundPhotoUri), so a failed photo load falls back to the full void composition including the hero ring"

patterns-established:
  - "Skia font loading: useFont(require('...ttf'), size) with null-guarded <Text> elements; never matchFont for app-bundled families"
  - "Never-throws native wrapper convention extended to expo-image-picker (permission + pick), treating iOS limited access as usable"

requirements-completed: [D-06, D-07, D-08, D-10, D-15, D-16]

coverage:
  - id: D1
    description: "Photo-first compose flow: permission -> pick with iOS native square crop -> photo background card; swap and explicit skip affordances"
    requirement: D-06
    verification:
      - kind: manual_procedural
        ref: "08-04 Task 3 on-device UAT scenarios 1-4 (user-approved 2026-08-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Denied and limited-access-empty photo permission edges show Open Settings alert then fall back to the void card; sharing never hard-blocks"
    requirement: D-16
    verification:
      - kind: manual_procedural
        ref: "08-04 Task 3 on-device UAT scenarios 5-6 (user-approved 2026-08-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bottom void-to-transparent scrim keeps stat trio + footer legible over bright/busy photos; card text (stat trio, wordmark, caption, HSS number) renders on-device in both variants"
    requirement: D-10
    verification:
      - kind: manual_procedural
        ref: "08-04 UAT re-test after font fix a7f93e8 (user: 'works perfect exactly as expected')"
        status: pass
    human_judgment: false
  - id: D4
    description: "Compact top-left ring badge on photo cards / large centered hero ring on void cards; exported 1080x1080 PNG matches the preview in both variants and both session types"
    verification:
      - kind: manual_procedural
        ref: "08-04 UAT ring-refinement re-test after 52cb4c2 (user: 'Approved - looks right')"
        status: pass
    human_judgment: false

# Metrics
duration: ~55min (3 executor sessions across 2 on-device UAT rounds)
completed: 2026-08-03
status: complete
---

# Phase 8 Plan 04: Photo-First Compose Flow + On-Device UAT Summary

**Strava-style photo-first share compose: native square-crop photo pick with limited-access-aware permission fallbacks, bottom scrim overlay, Skia-native font loading fix, and a compact top-left ring badge on photo cards — full on-device UAT approved**

## Performance

- **Duration:** ~55 min wall (3 executor sessions: initial build, font-fix continuation, ring-refinement continuation)
- **Completed:** 2026-08-03
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint with 2 fix-forward rounds)
- **Files modified:** 3 app files (+2 planning ledger files)

## Accomplishments

- Photo-first compose flow (D-06/D-08): share.tsx auto-launches permission -> pick on mount, with swap and explicit skip affordances; iOS native square crop via `allowsEditing: true` (D-15)
- Never-throws wrappers `requestPhotoLibraryPermission` / `pickShareBackgroundPhoto` in shareCardExport.ts, treating iOS limited access as usable (Pitfall 5)
- Every permission edge (denied -> Open Settings alert, limited-empty, skip) falls back to the void branded card; sharing never hard-blocks (D-16/D-07)
- Photo background drawn as full-bleed cover-fit Skia `<Image>` under a void-to-transparent bottom scrim (D-10) with the identical trio/footer overlay in both variants
- **Fixed the phase-wide silent Skia text failure:** all card text (HSS number, stat trio, wordmark, caption) now reliably renders on-device
- **User-chosen UAT refinement:** photo cards render a compact top-left ring badge so the photo stays the hero; void cards keep the large centered hero ring

## Task Commits

1. **Task 1: Photo-library permission + pick wrappers** - `b7bfe5f` (feat)
2. **Task 2: Photo-first compose flow + scrim + void fallback** - `7a75d28` (feat)
3. **Task 3 fix-forward (a): Skia font loading** - `a7f93e8` (fix)
4. **Task 3 fix-forward (b): compact top-left ring on photo cards** - `52cb4c2` (fix)

## Files Created/Modified

- `apps/mobile/lib/shareCardExport.ts` - added requestPhotoLibraryPermission + pickShareBackgroundPhoto (never-throws, limited-access-aware)
- `apps/mobile/app/session/share.tsx` - photo-first auto-pick flow, swap/skip affordances, denied-alert + void fallback, fontsReady share gating
- `apps/mobile/components/share/ShareCardCanvas.tsx` - photo background + scrim layers, useFont-based font loading, onFontsReady callback, variant-dependent ring geometry

## Decisions Made

- `useFont` (raw TTF) over `matchFont` (family name) for all Skia canvas text — see deviation 1 root cause
- Share button gated on `onFontsReady` in addition to the canvas-settle timer, so a share can never export a blank-text PNG
- Photo-card ring: radius 130 / stroke 14 / 100px number, anchored top-left at the footer's 90px margin (user-approved on-device); void card unchanged
- Ring variant switches on the resolved `useImage` result so a failed photo load degrades to the complete void composition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Skia card text never rendered on-device (matchFont -> useFont)**
- **Found during:** Task 3 (on-device UAT — user reported "only the ring with no other information" and a lonely "small watermark logo")
- **Issue:** ShareCardCanvas resolved all five fonts via `matchFont({ fontFamily: 'Archivo_900Black' | 'JetBrainsMono_500Medium' })`, which queries Skia's SYSTEM font manager. expo-font's `useFonts()` (app/_layout.tsx) registers those families only as RN-bridge aliases — invisible to Skia — so every `matchFont` silently failed (caught by try/catch, font stayed undefined) and every canvas `<Text>` drew nothing, while the ring (Path/Circle) and plate-mark (useImage) rendered fine. Skia text had never rendered on-device in this phase (the 08-02 tracer's blank caption matches).
- **Fix:** Load the same physical TTF assets Skia-natively via `useFont(Archivo_900Black | JetBrainsMono_500Medium, size)`; added `onFontsReady` so share.tsx blocks export until fonts resolve.
- **Files modified:** apps/mobile/components/share/ShareCardCanvas.tsx, apps/mobile/app/session/share.tsx
- **Verification:** UAT re-test — "works perfect exactly as expected"; shareCard tests (11) + typecheck pass
- **Committed in:** `a7f93e8`

**2. [User-requested design refinement] Compact top-left ring badge on photo cards**
- **Found during:** Task 3 (UAT re-test — user chose this explicitly)
- **Issue:** The centered hero ring covered too much of the athlete's photo on photo-background cards.
- **Fix:** Photo variant renders a ~0.46x ring badge anchored fixed top-left (footer-aligned margin) with a proportionally scaled HSS number; void card composition unchanged; single render tree so preview and exported PNG cannot diverge.
- **Files modified:** apps/mobile/components/share/ShareCardCanvas.tsx
- **Verification:** UAT re-test — "Approved — looks right"; tests + typecheck pass
- **Committed in:** `52cb4c2`

---

**Total deviations:** 2 (1 auto-fixed bug, 1 user-directed refinement at the checkpoint)
**Impact on plan:** The font fix was a correctness requirement the automated verification (typecheck/unit tests) could not catch — device-only rendering behavior. The ring refinement is contained to the rendering layer. No scope creep; lib/shareCard.ts pure view-model untouched.

## Deferred Issues

- **TrendChart.tsx likely shares the matchFont bug** (axis date labels may never have rendered on-device). Out of this plan's file scope — logged to `.planning/phases/08-share-card-social-overlay/deferred-items.md` and `.planning/WINDOWS.md` (ledger entry #1, kind `todo`) for the phase-04 owner: verify on-device and switch to `useFont` if confirmed.

## Issues Encountered

None beyond the deviations above — the photo pick, permission, scrim, and export paths all worked first-try on-device.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 08 feature-complete: full share-card flow verified end-to-end on-device across all 7 UAT scenarios, both session types, both entry points
- Skia font-loading pattern (`useFont` + null-guarded `<Text>`) established for any future Skia text work
- Open ledger item: TrendChart matchFont verification (does not block this phase)

---
*Phase: 08-share-card-social-overlay*
*Completed: 2026-08-03*

## Self-Check: PASSED

All claimed files exist on disk; all four task/fix commits (b7bfe5f, 7a75d28, a7f93e8, 52cb4c2) verified in git log.
