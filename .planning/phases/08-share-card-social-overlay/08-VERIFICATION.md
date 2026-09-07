---
phase: 08-share-card-social-overlay
verified: 2026-08-03T20:22:00Z
status: passed
score: 16/16 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 15/16
  gaps_closed:
    - "Tapping Share on the compose screen produces a PNG file and opens the native iOS share sheet with the CURRENT card content (CR-01 stale-export race on photo swap) — fixed in 1ffe6a7"
  gaps_remaining: []
  regressions: []
---

# Phase 8: Share Card Social Overlay Verification Report

**Phase Goal:** After finishing a workout (lift or run), the athlete can generate a Strava-style
shareable summary image — Apsis branding, session HSS, key stats (exercises/volume or
distance/pace/duration) — and post it to social media via the iOS share sheet. Executes BEFORE
06-06 (production EAS build) so any native dependency lands in the single fresh build.
**Verified:** 2026-08-03T20:22:00Z (re-verification after CR-01/WR-01/WR-02 fixes)
**Status:** passed
**Re-verification:** Yes — after gap closure (initial verification 2026-08-03T20:06:38Z found 1 gap)

## Gap Closure (Re-verification)

The single blocker from the initial verification — **CR-01: canvasReady guard doesn't re-arm on
photo swap (possible stale/blank export)** — is **closed**, confirmed by direct code inspection
of the fix commits:

- `1ffe6a7` fix(08): re-arm canvas-settle guard on photo swap, surface share failures [CR-01, WR-01]
- `ac34eba` fix(08): delete exported share-card PNG after use [WR-02]
- `55d2001` docs(08): mark review findings fixed

All three commits verified present in git log. Fix mechanics verified against the actual code:

1. **Re-arm on photo change:** `ShareCardCanvas.tsx` (lines 214-229) fires
   `onBackgroundReady(false)` the instant `backgroundPhotoUri` changes to a new URI
   (`pendingUriRef` mismatch check); `share.tsx` (lines 194-201) — the settle effect now
   depends on `[hss, fontsReady, backgroundReady]` and explicitly calls
   `setCanvasReady(false)` whenever any dependency flips back to not-ready. The one-way
   latch is gone. React's guarantee that passive effects flush before the next discrete
   user event closes the tap-race window.
2. **Gate on background readiness:** `handleShare` still gates on `!canvasReady`, which is
   now transitively gated on `backgroundReady`; `onBackgroundReady={setBackgroundReady}`
   wired at `share.tsx:306`.
3. **Void/no-photo case immediately ready:** `backgroundReady` initializes `true`
   (`share.tsx:77`); the canvas effect fires `onBackgroundReady(true)` immediately when
   `backgroundPhotoUri == null` (`ShareCardCanvas.tsx:215-220`) — skip, denied, and
   limited-empty paths never wedge the Share button.
4. **Failed decode falls back rather than wedging:** the `useImage` onError callback
   (`ShareCardCanvas.tsx:207-212`) fires ready-true for the current URI on a confirmed
   decode failure. The closure captures the URI current when that decode attempt started
   and compares it against `pendingUriRef`, so a superseded swap's late failure cannot
   falsely mark a newer pending URI ready. The known `useImage`-keeps-previous-data
   behavior is explicitly handled via the `settledImageRef` reference-inequality check
   (documented in the code's own comment, lines 191-204). In every branch, preview and
   export share one render tree, so they cannot diverge.

**Bonus closures (both review warnings also fixed):**
- **WR-01:** `handleShare` (`share.tsx:254-273`) now inspects `exportAndShareCard`'s boolean
  result and shows a "Share failed" alert on the documented `false` failure path (and on the
  defensive catch path — also resolving IN-02's dead-code observation).
- **WR-02:** `exportAndShareCard` (`shareCardExport.ts:57-67`) deletes the exported cache PNG
  in a guarded `finally` block after `shareAsync` resolves — deletion happens after the share
  sheet dismisses (the file remains available during the share), and a cleanup failure is
  logged but never overrides the share result, consistent with the file's never-throws
  convention.

**Post-fix gates re-confirmed locally in this re-verification:** `pnpm --filter @apsis/mobile
test -- shareCard` 11/11 pass; `pnpm run typecheck` exit 0. (Orchestrator additionally reports
full workspace suite 259/259 green.)

**Behavioral evidence note:** the re-arm invariant is a runtime state transition inside a
native Skia canvas boundary that is UAT-only by the phase's own validation architecture
(`shareCardExport.ts` header; vitest scope excludes native modules), so no unit test exercises
the race directly. Closure is verified by code inspection of a deterministic React state
machine whose correctness rests on framework-guaranteed effect ordering, matching the exact
fix 08-REVIEW.md prescribed; the surrounding swap-then-share flow was already exercised and
approved in on-device UAT (08-04 Task 3, scenario 3). No further human verification is
requested; if a future on-device pass occurs, a fast swap-then-immediately-share tap is the
one-line smoke check for this invariant.

## Requirement Traceability Note

Phase 8 has **no v1.0 REQUIREMENTS.md REQ-IDs** by design (confirmed: `grep -n -i "phase 8\|phase-8\|08-share" .planning/REQUIREMENTS.md` returns zero matches). The phase's traceability targets are the D-01..D-16 decisions in `08-CONTEXT.md`. All 16 IDs are accounted for across the four plans with no orphans and no double-counting gaps:

| D-ID | Plan(s) claiming it | Status |
|------|---------------------|--------|
| D-01 (1080×1080 format) | 08-01, 08-02, 08-04 | Verified — `SHARE_CARD_SIZE = 1080` in ShareCardCanvas.tsx |
| D-02 (HSS ring hero) | 08-02 | Verified |
| D-03 (fixed stat trio) | 08-03 | Verified |
| D-04 (subtle footer branding) | 08-02, 08-03 | Verified |
| D-05 (no readiness band on share ring) | 08-02 | Verified — no `band` prop in ShareCardCanvas |
| D-06 (photo-first flow) | 08-01, 08-04 | Verified (CR-01 caveat now resolved) |
| D-07 (no-photo void fallback) | 08-02, 08-04 | Verified |
| D-08 (library-pick only, no camera) | 08-01, 08-04 | Verified — `launchImageLibraryAsync` only |
| D-09 (recomposed share-edition sizing) | 08-02, 08-03 | Verified |
| D-10 (bottom scrim over photo) | 08-04 | Verified |
| D-11 (two entry points) | 08-02, 08-03 | Verified — finish.tsx + detail.tsx both push `/session/share` |
| D-12 (dedicated compose screen) | 08-02, 08-04 | Verified |
| D-13 (bone Share button, volt Done stays sole volt) | 08-02 | Verified |
| D-14 (purely user-initiated share) | 08-02 | Verified — no nudges/prompts found |
| D-15 (native square crop) | 08-01, 08-04 | Verified — `allowsEditing: true` |
| D-16 (denied → alert + Open Settings → void fallback) | 08-01, 08-04 | Verified |

No orphaned D-IDs; no D-ID claimed by zero plans.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | expo-image-picker, expo-file-system, expo-sharing appear in package.json at SDK-56 lines | ✓ VERIFIED | `apps/mobile/package.json`: `expo-file-system: ~56.0.8`, `expo-image-picker: ~56.0.22`, `expo-sharing: ~56.0.23` |
| 2 | app.json declares expo-image-picker plugin with photo-library permission string | ✓ VERIFIED | `app.json` plugins array: `expo-image-picker` entry with `photosPermission` string; `expo-sharing` bare entry present |
| 3 | Three new native deps recorded as a 06-06 production-build gate | ✓ VERIFIED | 08-01-SUMMARY.md documents the gate; STATE.md line 252 records the install decisions. (Enforcement happens when 06-06 actually runs — out of this phase's scope, correctly deferred.) |
| 4 | Finish-screen bone "Share card" button opens compose screen; Done stays volt (D-13) | ✓ VERIFIED | `finish.tsx:381-391` — `backgroundColor: Colors.dark.text` (bone), pushes `/session/share`; Done button unchanged (volt) |
| 5 | Compose screen renders a 1080×1080 void-black card with share-edition HSS ring + mono caption | ✓ VERIFIED | `ShareCardCanvas.tsx` — `SHARE_CARD_SIZE=1080`, `Fill` void background when no photo, volt-only ring (no `band` prop), caption text drawn |
| 6 | Tapping Share produces a PNG and opens the native iOS share sheet with the current card content | ✓ VERIFIED (re-verification) | `shareCardExport.ts:37-68` snapshot→file→shareAsync validated on-device (08-02 Task 2, approved); CR-01 stale-export race on photo swap closed in `1ffe6a7` (see Gap Closure section) |
| 7 | Card shows fixed core stat trio by session type (lift: volume/sets/duration; run: distance/pace/duration) (D-03) | ✓ VERIFIED | `shareCard.ts` — `buildStrengthStatTrio`/`buildEnduranceStatTrio`, both return exactly 3 pairs; unit tests pass (11/11); `ShareCardCanvas.tsx` renders 3 stat columns |
| 8 | Card shows subtle footer: APSIS wordmark + plate-mark + mono caption (D-04) | ✓ VERIFIED | `ShareCardCanvas.tsx` footer block; `apps/mobile/assets/images/apsis-plate-mark.png` exists on disk |
| 9 | History session detail has a Share entry point opening the same compose screen (D-11) | ✓ VERIFIED | `detail.tsx:327-337` — bone-filled, pushes `/session/share` with `workoutId`; total row remains sole volt element |
| 10 | Photo-first flow: picking a photo becomes the card background with stat overlay on top (D-06/D-08) | ✓ VERIFIED | `share.tsx` auto-launches `handleChoosePhoto` on mount; `ShareCardCanvas.tsx` draws full-bleed `<Image>` when `photoImage` resolved; same overlay composition in both variants |
| 11 | Non-square photos cropped square via iOS native crop UI at pick time (D-15) | ✓ VERIFIED | `pickShareBackgroundPhoto()` calls `launchImageLibraryAsync({ allowsEditing: true, ... })` — iOS forces square crop with `allowsEditing` |
| 12 | Stat overlay is bottom-anchored over a void→transparent gradient scrim for legibility (D-10) | ✓ VERIFIED | `ShareCardCanvas.tsx` — `LinearGradient` scrim drawn under trio/footer when photo present |
| 13 | Denied/limited-empty photo access shows alert + Open Settings deep-link, then falls back to void card; sharing never hard-blocks (D-16/D-07) | ✓ VERIFIED | `share.tsx:218-236` — `Alert.alert` with "Open Settings" → `Linking.openSettings()`; falls back to `selectedPhotoUri = null` (void card) in every failure branch; `backgroundReady` initializes true so the void card never wedges the Share button |
| 14 | Sharing is purely user-initiated — no nudges/prompts/milestone popups (D-14) | ✓ VERIFIED | No milestone-detection or auto-share code found; Share only fires on explicit button tap |
| 15 | Stat-trio numbers match finish.tsx/detail.tsx conventions (no drift) | ✓ VERIFIED | `shareCard.ts` imports and reuses `@apsis/shared`'s `kgToDisplayLb`/`kmToDisplayMi`/`paceSecPerKmToSecPerMi`/`formatPaceMinSec`; HSS read directly from `workout.hss`, never re-derived via `sessionHSSDetailed` (confirmed absent from `share.tsx` imports) |
| 16 | Card export/preview is a single render tree with no preview/export drift | ✓ VERIFIED | `ShareCardCanvas` is the same component used for on-screen preview (scaled via `previewScale` transform) and passed `canvasRef` for `makeImageSnapshot()` — one render tree |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/mobile/package.json` | 3 new native deps at SDK-56 lines | ✓ VERIFIED | Confirmed present |
| `apps/mobile/app.json` | expo-image-picker plugin + permission string | ✓ VERIFIED | Confirmed present |
| `pnpm-lock.yaml` | Synced entries | ✓ VERIFIED (per SUMMARY; typecheck-consistent) | |
| `apps/mobile/lib/shareCard.ts` | Pure caption + stat-trio formatters | ✓ VERIFIED | Exports `buildShareCaption`, `buildStrengthStatTrio`, `buildEnduranceStatTrio`; zero `@apsis/db` imports |
| `apps/mobile/lib/__tests__/shareCard.test.ts` | Unit coverage | ✓ VERIFIED | 11/11 tests pass (re-run post-fix) |
| `apps/mobile/components/share/ShareCardCanvas.tsx` | Full composition renderer + readiness signals | ✓ VERIFIED | Ring, stat trio, footer, photo+scrim, `onFontsReady` + `onBackgroundReady` (CR-01 fix) all present and wired |
| `apps/mobile/lib/shareCardExport.ts` | Export + photo permission/pick glue + cache cleanup | ✓ VERIFIED | Never-throws convention; WR-02 cache cleanup in guarded finally |
| `apps/mobile/app/session/share.tsx` | Compose screen with re-arming readiness gate | ✓ VERIFIED | CR-01 gate fixed; WR-01 failure alert added |
| `apps/mobile/app/session/finish.tsx` | Bone Share entry point | ✓ VERIFIED | |
| `apps/mobile/app/session/detail.tsx` | Bone Share entry point | ✓ VERIFIED | |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `finish.tsx` Share button | `/session/share` | `router.push({ pathname, params: { workoutId } })` | ✓ WIRED | |
| `detail.tsx` Share button | `/session/share` | `router.push({ pathname, params: { workoutId } })` | ✓ WIRED | |
| `share.tsx` SQLite query | `ShareCardCanvas` props | `hss`/`caption`/`statTrio`/`backgroundPhotoUri` state → props | ✓ WIRED | |
| `ShareCardCanvas` `useCanvasRef` | `shareCardExport.exportAndShareCard` | `canvasRef.current.makeImageSnapshot()` → `File` → `Sharing.shareAsync` | ✓ WIRED | Pipeline validated on-device; cache PNG now cleaned up after share |
| `share.tsx` photo pick | `ShareCardCanvas` `backgroundPhotoUri` prop | `setSelectedPhotoUri(uri)` → prop → `useImage` | ✓ WIRED | Preview updates on swap (on-device confirmed) |
| `ShareCardCanvas` photo readiness | `share.tsx` Share-button gate | `onBackgroundReady` → `setBackgroundReady` → settle effect → `canvasReady` | ✓ WIRED (new, CR-01 fix) | Re-arms false on URI change; true on resolve, confirmed failure, or no-photo |
| `package.json` deps | `pnpm-lock.yaml` | `expo install` | ✓ WIRED | |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| shareCard pure-formatter unit tests | `pnpm --filter @apsis/mobile test -- shareCard` | 11/11 passed (post-fix re-run) | ✓ PASS |
| Monorepo typecheck | `pnpm run typecheck` | Exit 0, no errors (post-fix re-run) | ✓ PASS |
| Native photo/export pipeline | Not runnable in this environment (native modules, no device) | — | ? SKIP — covered by on-device UAT (08-02/08-04 checkpoints, user-approved) |
| CR-01 re-arm invariant | Code inspection (native Skia boundary, UAT-only per validation architecture) | Deterministic React state machine matches 08-REVIEW.md's prescribed fix exactly | ✓ VERIFIED by inspection (see Gap Closure behavioral evidence note) |

### Requirements Coverage

No REQUIREMENTS.md REQ-IDs map to Phase 8 by design (confirmed via grep — zero matches). Traceability is via the D-01..D-16 decision table above. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/mobile/app/session/finish.tsx`, `detail.tsx`, `lib/shareCard.ts` | multiple | Three near-duplicate duration-formatting helpers (IN-01) | ℹ️ Info | Acknowledged intentional in-repo convention; drift risk if the rule ever changes. Not a blocker. |

Previously flagged CR-01 (blocker), WR-01, and WR-02 (warnings) are all resolved in commits `1ffe6a7`/`ac34eba`. No unresolved `TODO`/`FIXME`/`HACK`/`TBD`/`XXX`/`placeholder` markers in any phase-modified file.

### Human Verification Required

None. On-device UAT was performed and approved by the user during execution (08-02 Task 2 pipeline spike; 08-04 Task 3 full 7-scenario UAT: photo pick/swap/skip, both session types, permission fallbacks, both entry points, share sheet PNG attach). The codebase does not contradict those summaries. Optional (non-blocking) smoke check for a future on-device pass: fast swap-then-immediately-share to exercise the CR-01 re-arm window on hardware.

### Gaps Summary

None remaining. The initial verification's single blocker (CR-01 stale-export race on photo swap) is closed by `1ffe6a7`, with both review warnings (WR-01 silent share failure, WR-02 cache PNG accumulation) also fixed. Phase goal achieved: the athlete can generate a Strava-style shareable summary image (photo or void background, Apsis branding, session HSS hero, fixed per-type stat trio) from both the finish screen and History session detail, and post it via the iOS share sheet — with all three native dependencies landed ahead of the 06-06 production build and recorded as its gate.

---

*Verified: 2026-08-03T20:22:00Z (re-verification)*
*Verifier: Claude (gsd-verifier)*
