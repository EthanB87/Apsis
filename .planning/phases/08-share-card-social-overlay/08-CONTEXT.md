# Phase 8: Share Card Social Overlay - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

After finishing a workout (lift or run), the athlete can generate a Strava-style shareable
summary image — the athlete's own photo as the background with an Apsis-branded stat
overlay (session HSS hero + core stats) — and post it via the iOS share sheet. Entry
points are the finish screen and History session detail. Executes BEFORE 06-06
(production EAS build) so every native dependency lands in the single fresh build.

**Roadmap constraint update (owner decision during discussion):** the roadmap's
"zero-new-native-dep preferred" note is superseded for the photo picker — the owner chose
photo-first backgrounds knowing `expo-image-picker` is a new native module. It MUST land
before 06-06 and is a flagged 06-06 gate. The card *rendering* path should still prefer
existing deps (Skia snapshot + RN core `Share`); note that `expo-file-system` is NOT
currently installed (roadmap note assumed it was) — if research shows a file handoff is
required for the share sheet, that install is part of this phase and rides the same
06-06 gate.

</domain>

<decisions>
## Implementation Decisions

### Card content & format
- **D-01:** Single output format: square 1080×1080. No story (9:16) variant in v1.
- **D-02:** Hero element is the HSS ring + big session score — share-edition treatment of
  the existing HssRing visual language (volt ring, mono number).
- **D-03:** Supporting stats are a fixed core trio by session type — lift: total volume,
  sets, duration; run: distance, pace, duration. No HR, no exercise names, no per-stat
  toggles or customization. Fixed composition; if the athlete doesn't like the numbers,
  they don't share.
- **D-04:** Branding/metadata: subtle footer — small APSIS wordmark + plate-mark in a
  bottom corner, mono session-type + date caption (e.g. `LIFT — AUG 3`). Athlete's
  numbers stay the star.
- **D-05:** Session share ring carries NO readiness-band semantics (volt/neutral only) —
  carries forward the Phase 04 decision that a single-session ring never shows readiness.

### Card visual style
- **D-06:** Photo-first like Strava: the compose flow leads with picking a photo from the
  library; stats overlay the photo. — **Reversibility:** costly — commits
  `expo-image-picker` (new native module) into the 06-06 production binary and shapes the
  whole compose flow around photo selection; backing out later means a new EAS build and
  a compose-screen redesign.
- **D-07:** No-photo fallback: skipping the photo yields the pure void-black branded card
  with the SAME share-edition overlay composition — photo skip never blocks sharing.
- **D-08:** Photo source is library pick only (`expo-image-picker`). No camera-capture
  flow on the share path.
- **D-09:** Share edition styling: same design language as the app (void/volt palette,
  mono type, ring) but recomposed for 1080px social — bigger type, more dramatic ring,
  tuned spacing. Not a pixel-for-pixel reuse of in-app components' sizing.
- **D-10:** Overlay layout on photos: bottom-anchored — HSS ring + stat trio along the
  bottom over a void→transparent gradient scrim (Strava-style); footer branding sits
  inside the scrim zone. Photo stays the star.

### Entry points & flow
- **D-11:** Two entry points: finish screen (`apps/mobile/app/session/finish.tsx`) AND
  History session detail (`apps/mobile/app/session/detail.tsx`).
- **D-12:** Tapping Share opens a dedicated compose screen: pick/swap photo, live card
  preview, Share button → iOS share sheet.
- **D-13:** Finish-screen entry is a secondary bone-filled "Share card" button — the Done
  CTA keeps the volt fill (one-volt-per-screen hard rule).
- **D-14:** Sharing is purely user-initiated — no nudges, prompts, or milestone popups.
  Saving to Photos is covered by the share sheet's native "Save Image" action; no
  media-library write permission needed.

### Photo framing & edge cases
- **D-15:** Non-square photos are framed via the iOS native square-crop UI at pick time
  (`expo-image-picker` `allowsEditing`). No custom pan/zoom crop in compose.
- **D-16:** Photo permission denied (or limited access yields nothing): explain with an
  alert + "Open Settings" deep-link, THEN fall back to the void branded card. (Owner
  chose the discoverable path over the quiet-fallback recommendation.) Sharing still
  never hard-blocks.

### Claude's Discretion
- Output resolution/format/quality (e.g. 2× supersample, JPEG-vs-PNG per background
  type) — hard requirement is only that generation is instant and fully offline.
- Scrim gradient stops/opacity and exact overlay spacing — whatever keeps volt/bone text
  legible on bright/busy photos at feed size.
- Snapshot/share mechanics: Skia `makeImageSnapshot` vs alternate zero-dep capture, file
  handoff vs base64 URL into RN core `Share` — research decides; prefer existing deps,
  flag ANY new module (including `expo-file-system` if needed) as a 06-06 gate.
- Compose-screen route placement and navigation shape within expo-router conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design language (binding)
- `DESIGN-SYSTEM.md` — void/volt palette (binding), one-volt-per-screen rule, mono
  caption voice; the share card is a brand surface and must comply
- `.planning/ROADMAP.md` — Phase 8 goal + 06-06 sequencing constraint

### Surfaces this phase touches
- `apps/mobile/app/session/finish.tsx` — finish screen (share entry #1; existing volt CTA)
- `apps/mobile/app/session/detail.tsx` — History session detail (share entry #2)
- `apps/mobile/components/home/HssRing.tsx` (or equivalent path) — ring visual language
  the share-edition hero derives from
- `apps/mobile/components/home/TrendChart.tsx` — the existing direct Skia usage pattern
  (canvas setup, fonts in Skia) to mirror for card rendering

### Data the card reads
- `packages/db/src/schema.ts` — workout / endurance_segment / load_daily shapes (session
  HSS, volume, sets, distance, pace, duration sources)
- `apps/mobile/app.json` — plugins list (expo-image-picker config plugin + photo-library
  permission string land here; NSPhotoLibraryUsageDescription)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@shopify/react-native-skia` already installed (victory-native + TrendChart) — the
  snapshot-based render path adds zero new native deps.
- HssRing component exists with 200px/84px variants — visual reference for the
  share-edition ring (recompose, don't force-fit).
- JetBrains Mono + Archivo fonts already bundled (`@expo-google-fonts/*`) — card
  typography uses the same faces.
- `expo-haptics`, bottom-sheet, and ScreenHeader patterns available for compose-screen UI.
- Plate-mark branding asset exists (`apps/mobile/assets/images/icon.png` family) — footer
  mark source.

### Established Patterns
- RN core `Share`, `expo-file-system`, `expo-sharing`, and `makeImageSnapshot` are used
  NOWHERE in the codebase yet — the share/save mechanics are greenfield; research must
  validate the handoff (file URL vs base64) on iOS.
- One-volt-per-screen: finish.tsx's Done button owns volt; the share button is bone.
- Session HSS values: finish screen already computes/display session HSS (Phase 04 P06);
  detail.tsx shows persisted per-session data — card data should come from the same
  sources, never a re-derivation that could drift.
- New native module ⇒ pnpm-lock.yaml sync + fresh EAS dev build before on-device testing
  (Phase 04/05 lesson); budget an EAS build cycle into this phase.
- SDK-56-line installs via `expo install` only, never hand-pinned (Phase 03/07 precedent).

### Integration Points
- Compose screen is a new expo-router route (likely `app/session/share.tsx` or similar)
  pushed from finish.tsx and detail.tsx with a session id param.
- `expo-image-picker` config plugin + `NSPhotoLibraryUsageDescription` in app.json —
  ALSO ripples into 06-04 privacy policy / 06-07 privacy label review (photo access is
  on-device only; nothing leaves the device).
- 06-06 gate list gains: expo-image-picker (+ expo-file-system if research requires it).

</code_context>

<specifics>
## Specific Ideas

- "Strava-style" is the explicit reference: photo background, stats overlaid bottom,
  small brand watermark — but with Apsis's void/volt/mono identity instead of Strava
  orange.
- Caption voice matches the Phase 06 D-08 register: terse, mono, uppercase
  (e.g. `LIFT — AUG 3`).

</specifics>

<deferred>
## Deferred Ideas

- Story (9:16) card variant — revisit post-v1 if athletes ask for IG-story-native output.
- Per-stat privacy toggles / HSS-only flex card — v1 ships the fixed composition.
- Camera-capture ("take photo now") on the share path — library pick only in v1.
- Milestone share nudges (PR volume, highest HSS) — would need milestone detection;
  v1 is purely user-initiated.

</deferred>

---

*Phase: 08-share-card-social-overlay*
*Context gathered: 2026-08-03*
