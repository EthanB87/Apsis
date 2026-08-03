# Phase 8: Share Card Social Overlay - Research

**Researched:** 2026-08-03
**Domain:** On-device image generation (Skia canvas snapshot) + native photo picker + iOS share sheet handoff, inside an Expo SDK 56 / React Native New Architecture app
**Confidence:** MEDIUM — architecture and library APIs are HIGH confidence (verified directly against installed package `.d.ts` files and official versioned Expo docs); the exact Skia-snapshot → file → `Share`/`Sharing` handoff has zero codebase precedent (greenfield) and is MEDIUM/LOW confidence pending an on-device spike.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card content & format**
- D-01: Single output format: square 1080×1080. No story (9:16) variant in v1.
- D-02: Hero element is the HSS ring + big session score — share-edition treatment of the existing HssRing visual language (volt ring, mono number).
- D-03: Supporting stats are a fixed core trio by session type — lift: total volume, sets, duration; run: distance, pace, duration. No HR, no exercise names, no per-stat toggles or customization.
- D-04: Branding/metadata: subtle footer — small APSIS wordmark + plate-mark in a bottom corner, mono session-type + date caption (e.g. `LIFT — AUG 3`).
- D-05: Session share ring carries NO readiness-band semantics (volt/neutral only) — carries forward the Phase 04 decision that a single-session ring never shows readiness.

**Card visual style**
- D-06: Photo-first like Strava: compose flow leads with picking a photo from the library; stats overlay the photo. Reversibility: costly — commits `expo-image-picker` (new native module) into the 06-06 production binary.
- D-07: No-photo fallback: skipping the photo yields the pure void-black branded card with the SAME share-edition overlay composition — photo skip never blocks sharing.
- D-08: Photo source is library pick only (`expo-image-picker`). No camera-capture flow on the share path.
- D-09: Share edition styling: same design language as the app (void/volt palette, mono type, ring) but recomposed for 1080px social — bigger type, more dramatic ring, tuned spacing. Not a pixel-for-pixel reuse of in-app components' sizing.
- D-10: Overlay layout on photos: bottom-anchored — HSS ring + stat trio along the bottom over a void→transparent gradient scrim (Strava-style); footer branding sits inside the scrim zone.

**Entry points & flow**
- D-11: Two entry points: finish screen (`apps/mobile/app/session/finish.tsx`) AND History session detail (`apps/mobile/app/session/detail.tsx`).
- D-12: Tapping Share opens a dedicated compose screen: pick/swap photo, live card preview, Share button → iOS share sheet.
- D-13: Finish-screen entry is a secondary bone-filled "Share card" button — the Done CTA keeps the volt fill (one-volt-per-screen hard rule).
- D-14: Sharing is purely user-initiated — no nudges, prompts, or milestone popups. Saving to Photos is covered by the share sheet's native "Save Image" action; no media-library write permission needed.

**Photo framing & edge cases**
- D-15: Non-square photos are framed via the iOS native square-crop UI at pick time (`expo-image-picker` `allowsEditing`). No custom pan/zoom crop in compose.
- D-16: Photo permission denied (or limited access yields nothing): explain with an alert + "Open Settings" deep-link, THEN fall back to the void branded card. Sharing still never hard-blocks.

### Claude's Discretion
- Output resolution/format/quality (e.g. 2× supersample, JPEG-vs-PNG per background type) — hard requirement is only that generation is instant and fully offline.
- Scrim gradient stops/opacity and exact overlay spacing — whatever keeps volt/bone text legible on bright/busy photos at feed size.
- Snapshot/share mechanics: Skia `makeImageSnapshot` vs alternate zero-dep capture, file handoff vs base64 URL into RN core `Share` — research decides; prefer existing deps, flag ANY new module (including `expo-file-system` if needed) as a 06-06 gate.
- Compose-screen route placement and navigation shape within expo-router conventions.

### Deferred Ideas (OUT OF SCOPE)
- Story (9:16) card variant — revisit post-v1 if athletes ask for IG-story-native output.
- Per-stat privacy toggles / HSS-only flex card — v1 ships the fixed composition.
- Camera-capture ("take photo now") on the share path — library pick only in v1.
- Milestone share nudges (PR volume, highest HSS) — would need milestone detection; v1 is purely user-initiated.
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal `REQUIREMENTS.md` IDs are mapped to Phase 8 (it postdates the locked v1.0 requirement set — see ROADMAP.md "Roadmap Evolution" entry, owner decision 2026-08-03). This phase is scoped entirely by `08-CONTEXT.md`'s D-01..D-16 decisions above, which this research treats as the requirement set.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01..D-16 | Share card content, style, entry points, and edge-case behavior (08-CONTEXT.md) | Architecture, Code Examples, and Common Pitfalls sections below map directly to these decisions |
</phase_requirements>

## Summary

The share card is a **Skia offscreen canvas → PNG file → native iOS share sheet** pipeline layered onto an app that has zero existing precedent for image export or file sharing (verified: `Share`, `expo-file-system`, `expo-sharing`, and `makeImageSnapshot` are used nowhere in the current codebase). Three of the four moving pieces are pinned by decisions already made: Skia (`@shopify/react-native-skia@2.6.9`, already installed, already used for `TrendChart.tsx`) renders the card and produces the image; `expo-image-picker` supplies the background photo and is an already-approved new native dependency riding the same 06-06 EAS build. The two open technical questions this research resolves are (1) how to get pixels out of the offscreen Skia `<Canvas>` and (2) how to hand the resulting file to iOS's share sheet reliably.

For (1): `useCanvasRef()` + `ref.current.makeImageSnapshot()` (synchronous) or `makeImageSnapshotAsync()` (async) return an `SkImage`, which exposes `.encodeToBase64(fmt, quality)` and `.encodeToBytes(fmt, quality)` — both verified directly from the installed package's type declarations. No new dependency needed here.

For (2): the codebase currently has **no `expo-file-system` or `expo-sharing` entry in `apps/mobile/package.json`** (confirmed by CONTEXT.md and by grepping the lockfile), but `expo-file-system@56.0.8` is *already resolved and present in `node_modules`* as a transitive runtime dependency of the `expo` package itself. This means the JS API is already importable without a `package.json` change, though CLAUDE.md's "SDK-56-line installs via `expo install` only" convention still means it should be added explicitly for correctness and lockfile clarity — that install still needs to ride the same 06-06 EAS build cycle as `expo-image-picker`, because a *new native autolink entry point* (even a dependency-of-a-dependency) is not guaranteed already linked into the current dev-client binary. Research recommends **`expo-sharing`** (not React Native's core `Share.share`) as the share-sheet mechanism: RN core `Share`'s iOS `url` field is documented only as "a URL to share" with no explicit local-file or base64-image contract, and cross-referenced community reports describe base64 image URLs frequently failing to attach on iOS (only a "Create PDF" action appears). `expo-sharing`'s SDK-56 docs explicitly state local file URI sharing is supported on iOS via the native share sheet — it is Expo's purpose-built module for exactly this handoff, is a small package with no postinstall script, and (per D-06's already-accepted precedent) is one more native module riding the same already-budgeted 06-06 build.

**Primary recommendation:** Skia canvas → `makeImageSnapshot()` → `SkImage.encodeToBytes(ImageFormat.PNG)` → write to a `File` at `Paths.cache` (new `expo-file-system` File/Directory API, not the deprecated `writeAsStringAsync`) → `Sharing.shareAsync(file.uri)` (new `expo-sharing` dependency). This adds `expo-file-system` and `expo-sharing` to the 06-06 native-dependency gate alongside the already-approved `expo-image-picker` — all three should land in the same single EAS dev-client build before on-device UAT, per the Phase 04/05 "new native dep needs a fresh build" lesson already logged in STATE.md.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Photo selection (library pick + native square crop) | Browser/Client (native module UI) | — | `expo-image-picker` presents the OS-native picker/crop UI; no app-layer crop logic needed (D-15) |
| Card composition (ring, stat trio, scrim, footer) | Browser/Client (Skia canvas, on-device) | — | Pure on-device rendering; matches "fully offline" hard constraint and existing `TrendChart.tsx` Skia precedent |
| Card data (HSS, stats, caption) | Browser/Client (read from local SQLite) | Database/Storage | Reads directly from `workout`/`strength_set`/`endurance_segment` via drizzle, same "SQLite is truth" pattern as `finish.tsx`/`detail.tsx` — never re-derives from a store |
| Image encode + file write | Browser/Client (Skia `encodeToBytes` + `expo-file-system`) | — | On-device only; no network tier involved anywhere in this phase |
| Share handoff to OS | Browser/Client (`expo-sharing` → native `UIActivityViewController`) | — | iOS-native share sheet; "Save Image" / social app targets are OS-owned, app has no control past the handoff |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@shopify/react-native-skia` | 2.6.9 (already installed, pinned) | Offscreen canvas render + `makeImageSnapshot`/`encodeToBytes` | Already the app's only canvas/image-composition library (`TrendChart.tsx`); zero new dependency for the render+encode path `[VERIFIED: node_modules/@shopify/react-native-skia/lib/commonjs/renderer/Canvas.d.ts:6-8, skia/types/Image/Image.d.ts:101-115]` — quoted below |
| `expo-image-picker` | `~56.0.22` (SDK-56 line; not yet installed) | Library photo pick + native square crop (D-08/D-15) | Only Expo-sanctioned photo picker; already an accepted 06-06 gate per CONTEXT.md D-06 |
| `expo-file-system` | `~56.0.8` (SDK-56 line; not yet in `package.json`, but already resolved transitively in `node_modules`) | Write the encoded PNG bytes to a shareable `file://` path | Only Expo-sanctioned filesystem module; needed to hand Skia's in-memory bytes to a real file `Sharing.shareAsync`/`Share.share` can reference |
| `expo-sharing` | `~56.0.23` (SDK-56 line; not yet installed) | Open the native iOS share sheet with the generated PNG | Purpose-built for local-file-URI sharing on iOS (see Common Pitfalls #1); RN core `Share` has no documented reliable image-file contract |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-reanimated` | 4.3.1 (already installed) | None strictly required for a static snapshot — the compose screen's live preview can render the same Skia tree that's on-screen already (no reanimated needed for the export path itself) | Only if the compose-screen preview reuses `HssRing.tsx`'s animated count-up for polish; the exported snapshot itself should capture the settled (non-animating) state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-sharing` | RN core `Share.share({ url: fileUri })` | Zero new dependency, but community reports (cross-referenced, not codebase-verified) describe iOS reliability issues with image attachment via `url`; `expo-sharing` is purpose-built and nearly as small — not worth the reliability risk on a launch-blocking feature |
| `expo-sharing` | `react-native-share` (third-party) | More share-target control (`shareSingle`, Instagram Stories deep link) but a non-Expo native module outside the "SDK-56-line, `expo install`" convention this project has followed for every other native dep (Phase 03/07 precedent) — rejected |
| Skia `makeImageSnapshot` | `react-native-view-shot` | Captures a real (non-Skia) RN view tree via native screenshot API — but adds a second, unrelated native image-capture module when Skia already renders everything needed; would also need Skia anyway for the ring/scrim, so it's pure duplication |
| `expo-file-system` new class API | `expo-file-system/legacy` (`writeAsStringAsync`) | Legacy exports still exist in SDK 56 but throw a deprecation error when called (confirmed by cross-referenced web sources on the SDK 54+ migration) — use the new `File`/`Directory`/`Paths` API only |

**Installation:**
```bash
cd apps/mobile
npx expo install expo-image-picker expo-file-system expo-sharing
```
This resolves each to the SDK-56-compatible line (matching CLAUDE.md's "SDK-56-line installs via `expo install` only, never hand-pinned" convention, and the Phase 03/07 precedent logged in STATE.md).

**Version verification:**
```
npm view expo-image-picker@56 version   →  56.0.22 (latest 56.x, confirmed on registry)
npm view expo-file-system@56 version    →  56.0.8  (latest 56.x, confirmed on registry — matches the version already resolved transitively in this repo's node_modules)
npm view expo-sharing@56 version        →  56.0.23 (latest 56.x, confirmed on registry)
```
All three are published by the official `expo` npm org (`repository: git+https://github.com/expo/expo.git`), release in lockstep with every other `expo-*` SDK-56 package already in this project.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-image-picker` | npm | package family since 2019 (SDK-56 point release published 2026-07-29) | 3.5M/wk | github.com/expo/expo | SUS ("too-new" heuristic) | Flagged — planner must add `checkpoint:human-verify`, see note below |
| `expo-file-system` | npm | package family multi-year (SDK-56 point release published 2026-07-15) | 7.6M/wk | github.com/expo/expo | SUS ("too-new" heuristic) | Flagged — planner must add `checkpoint:human-verify`, see note below |
| `expo-sharing` | npm | package family multi-year (SDK-56 point release published 2026-07-29) | 1.8M/wk | github.com/expo/expo | SUS ("too-new" heuristic) | Flagged — planner must add `checkpoint:human-verify`, see note below |

**Note on the SUS verdicts:** all three trip the legitimacy gate's "too-new" signal purely because Expo SDK packages release a new point version every few weeks in lockstep across the entire `expo-*` family (the same pattern already true of `expo-camera`, `expo-notifications`, etc. already installed in this app) — the *publish timestamp* of the latest patch is recent even though the package itself is old, official, and carries multi-million weekly downloads with no postinstall script (`npm view <pkg> scripts.postinstall` returned empty for all three). This is almost certainly a false positive of the "too-new" heuristic against monorepo-versioned SDKs, not a real slopsquatting risk — but per the Package Legitimacy Gate protocol the SUS verdict must still be surfaced and the planner must still gate each install behind a `checkpoint:human-verify` task (consistent with how this project's Phase 05/07 already required blocking-human legitimacy checkpoints for `@kingstinct/react-native-healthkit`, `expo-camera`, and `expo-text-extractor`).

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `expo-image-picker`, `expo-file-system`, `expo-sharing` — all three gated behind planner-inserted `checkpoint:human-verify`, all three ride the single 06-06 EAS build per CONTEXT.md's constraint.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐       ┌──────────────────────────────────────┐
│ finish.tsx (D-11)    │       │ session/detail.tsx (D-11)             │
│ secondary bone       │       │ (existing screen, unchanged except    │
│ "Share card" button  │       │  for a new Share entry point)         │
└──────────┬───────────┘       └───────────────┬────────────────────┘
           │ router.push({ pathname:'/session/share', params:{workoutId} })
           └───────────────────┬───────────────┘
                                ▼
              ┌───────────────────────────────────────┐
              │ session/share.tsx — compose screen     │
              │ (new expo-router route, D-12)          │
              │                                         │
              │ 1. Load card data from SQLite           │  ◄── db, sessionHSSDetailed
              │    (workout/strengthSet/enduranceSegment│      (same "SQLite is truth"
              │     — same query shape as finish.tsx)   │       pattern as finish.tsx)
              │                                         │
              │ 2. [optional] expo-image-picker         │  ◄── NEW native module
              │    launchImageLibraryAsync              │      (D-06/D-08, allowsEditing
              │    → native square-crop UI (D-15)       │       always square on iOS)
              │    → permission denied → alert +         │
              │      Settings deep-link, fall back to    │  (D-16)
              │      void card (D-07)                    │
              │                                         │
              │ 3. Render <Canvas> 1080×1080             │  ◄── @shopify/react-native-skia
              │    - photo background OR void fill       │      (already installed)
              │    - void→transparent scrim (D-10)       │
              │    - share-edition HssRing (D-02/D-05)   │
              │    - stat trio by session type (D-03)    │
              │    - footer wordmark+plate-mark+caption  │
              │      (D-04)                              │
              │                                         │
              │ 4. Tap Share →                           │
              │    canvasRef.makeImageSnapshot()          │  ◄── SkImage
              │    → .encodeToBytes(ImageFormat.PNG)      │
              │    → new File(Paths.cache,'apsis-share    │  ◄── NEW: expo-file-system
              │      -<id>.png').write(bytes)             │      (File/Directory API)
              │    → Sharing.shareAsync(file.uri)          │  ◄── NEW: expo-sharing
              │                                         │
              └───────────────────┬─────────────────────┘
                                   ▼
                     iOS UIActivityViewController
                (native share sheet — Messages, Instagram,
                 Photos "Save Image", etc. — all OS-owned)
```

### Recommended Project Structure
```
apps/mobile/
├── app/session/
│   └── share.tsx              # new compose-screen route (D-12); mirrors finish.tsx's
│                               #   "SQLite is truth" data-fetch pattern
├── components/share/
│   └── ShareCardCanvas.tsx    # new: the Skia <Canvas> tree (ring + stats + scrim + footer),
│                               #   used both for the live compose preview AND the export snapshot
│                               #   — one component, one render tree, per D-09's "recomposed, not
│                               #   pixel-copied" note and to avoid preview/export drift
├── lib/
│   └── shareCard.ts           # NEW pure-logic module: builds the fixed stat-trio strings +
│                               #   mono caption (`LIFT — AUG 3`) from already-computed session
│                               #   data — zero @apsis/db import, vitest-testable
│                               #   (mirrors lib/runEntryLogic.ts's extraction precedent)
│   └── shareCardExport.ts     # NEW: canvasRef → SkImage → bytes → File → Sharing.shareAsync
│                               #   orchestration; NOT vitest-testable (native modules), UAT-only
```

### Pattern 1: Offscreen Skia snapshot → file → share
**What:** Render a `<Canvas>` sized 1080×1080 (or supersampled 2×/3× per Claude's Discretion), capture it with `useCanvasRef()` + `makeImageSnapshot()`, encode to PNG bytes, write to a cache file, hand the file URI to `expo-sharing`.
**When to use:** Every "Share" tap from the compose screen (D-12), whether or not a photo was picked (D-07's void fallback renders through the exact same pipeline, just with a solid-fill background layer instead of a Skia `<Image>`).
**Example:**
```typescript
// Source: verified directly against installed @shopify/react-native-skia 2.6.9 .d.ts
// (renderer/Canvas.d.ts, skia/types/Image/Image.d.ts) — API shape only, not an official
// "share a card" tutorial (none exists for this exact pipeline).
import { Canvas, useCanvasRef, useImage } from '@shopify/react-native-skia';
import { ImageFormat } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const canvasRef = useCanvasRef();

async function exportAndShare(): Promise<void> {
  const image = canvasRef.current?.makeImageSnapshot();
  if (!image) return; // canvas not yet mounted/measured
  const bytes = image.encodeToBytes(ImageFormat.PNG); // Uint8Array

  const file = new File(Paths.cache, `apsis-share-${Date.now()}.png`);
  file.create({ overwrite: true }); // verified pattern in expo-file-system's own doc example
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
  }
}
```

### Pattern 2: Photo pick with mandatory native square crop + graceful permission fallback
**What:** `expo-image-picker`'s `launchImageLibraryAsync({ allowsEditing: true })` — the `aspect` option is documented as Android-only; **on iOS the crop rectangle is always square whenever `allowsEditing: true`**, which is exactly D-15's requirement with zero extra code.
**When to use:** Compose screen's photo-pick action (D-06/D-08).
**Example:**
```typescript
// Source: cross-referenced WebSearch + docs.expo.dev/versions/v56.0.0/sdk/imagepicker/
// (official versioned docs — AGENTS.md requires reading exact versioned Expo docs)
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

async function pickPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    // D-16: alert + Open Settings deep-link, THEN fall back to void card (never hard-block)
    Alert.alert('Photo access needed', 'Enable Photos access in Settings to add a background photo.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // D-15: iOS crop UI is square regardless of `aspect`
    quality: 1,
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}
```

### Anti-Patterns to Avoid
- **Re-deriving HSS/stats on the share screen instead of reading persisted values:** `finish.tsx` and `detail.tsx` both already compute/persist session HSS and the per-type stat lines — the share card MUST read the same source (persisted `workout.hss`, the same `strengthSet`/`enduranceSegment` query shapes), never a third independent computation that could drift (STATE.md precedent: "Session HSS values: card data should come from the same sources, never a re-derivation that could drift").
- **Reusing `HssRing.tsx` at in-app pixel sizes for the share card:** D-09 explicitly requires a *recomposed* share-edition ring (bigger type, more dramatic ring, 1080px-tuned spacing), not a literal re-mount of the 200px/84px component — treat `HssRing.tsx` as a visual-language reference, build a separate share-sized ring element.
- **Sharing a base64 `data:` URI instead of a file:** cross-referenced community reports describe iOS's `UIActivityViewController` unreliably attaching base64-encoded images (sometimes offering only "Create PDF"); always materialize a real file first.
- **Calling `expo-file-system`'s legacy `writeAsStringAsync`:** deprecated in SDK 54+, throws at call time — use the `File`/`Directory`/`Paths` class API only (see Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Square photo crop UI | A custom pan/zoom/crop overlay | `expo-image-picker`'s native `allowsEditing` crop (square on iOS) | D-15 explicitly rejects custom crop; the native picker already delivers exactly the required behavior for free |
| Native share sheet | A custom "share to X" menu | `expo-sharing` → `UIActivityViewController` | The OS share sheet already lists every installed compatible app plus "Save Image" — no reason to reimplement app-target discovery |
| Image encoding | Manual PNG byte-packing / canvas-to-blob shims | Skia's `SkImage.encodeToBytes(ImageFormat.PNG)` | Skia already renders the card; asking it to also encode the result is the natural, zero-extra-dependency path |

**Key insight:** every piece of this phase is a thin composition of platform-native capability (native picker, native crop, native share sheet) plus the app's existing Skia rendering stack. There is no domain-specific "hard problem" to solve here — the risk is entirely in getting the glue (file handoff, permission fallback, entry-point wiring) right, which is why the Common Pitfalls section below is the highest-value part of this research.

## Common Pitfalls

### Pitfall 1: RN core `Share.share()` may not reliably attach a local image on iOS
**What goes wrong:** Using `Share.share({ url: fileUri })` (zero-new-dependency temptation) can produce a share sheet where the image never actually attaches, or where only a "Create PDF" action appears instead of the expected image-sharing targets.
**Why it happens:** RN's `Share` module's iOS `url` field is documented only as "a URL to share" with no explicit contract for local image file URIs vs. remote URLs vs. base64 data URIs; the underlying `UIActivityViewController` behavior varies based on how the URL is packaged into an `NSItemProvider`.
**How to avoid:** Use `expo-sharing`'s `shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png' })` instead — it is purpose-built for local-file image sharing and is explicitly documented (SDK-56 docs) to work on iOS.
**Warning signs:** On-device UAT shows the share sheet opening but "Save Image" / Messages / Instagram not appearing, or only a generic file/PDF action showing.

### Pitfall 2: `expo-file-system`'s new `File.write()` may require `File.create()` first
**What goes wrong:** Calling `file.write(bytes)` on a `File` instance that hasn't been created yet could throw, silently no-op, or auto-create — the exact contract is not fully explicit in the available documentation for this SDK line.
**Why it happens:** SDK 54+'s new class-based File/Directory API is relatively new (introduced ~SDK 54); available documentation and examples consistently show `file.create()` called before `file.write()`, but no source explicitly states whether `write()` implicitly creates the file.
**How to avoid:** Defensively always call `file.create({ overwrite: true })` immediately before `file.write(bytes)` (as shown in Pattern 1) — cheap, idempotent-by-option, and removes the ambiguity regardless of the true underlying contract.
**Warning signs:** `write()` throwing a "file does not exist" error, or (worse) silently failing so `Sharing.shareAsync` opens with a missing/empty file.

### Pitfall 3: `expo-file-system` transitively present ≠ safe to use without a fresh build
**What goes wrong:** Assuming that because `expo-file-system@56.0.8` already resolves in `node_modules` (as a dependency of `expo` itself), it's "already linked" and importable without triggering the same EAS dev-client rebuild that `expo-image-picker`/`expo-sharing` require.
**Why it happens:** Expo's own internals (asset caching, updates, etc.) depend on `expo-file-system` at the JS/npm level, but that does not guarantee its native iOS module was compiled into the *specific dev-client binary currently installed on the test device* — autolinking happens at `expo prebuild`/EAS build time, tied to what's declared (directly or transitively resolvable) at that build's `pnpm install`.
**How to avoid:** Treat `expo-file-system` exactly like `expo-image-picker`/`expo-sharing` for build-planning purposes: add it explicitly to `apps/mobile/package.json`, sync `pnpm-lock.yaml`, and require it in the same fresh 06-06 EAS build — do not assume it's "free" just because it resolves today.
**Warning signs:** `TurboModuleRegistry.getEnforcing(...): 'ExpoFileSystem' could not be found` (or equivalent) at runtime on a stale dev-client build — matches the exact class of failure STATE.md already logged for Phase 04/05 ("native-dep changes require BOTH a pnpm-lock.yaml sync AND a fresh EAS dev build").

### Pitfall 4: Skia `makeImageSnapshot()` timing — canvas must be mounted and measured
**What goes wrong:** Calling `canvasRef.current.makeImageSnapshot()` before the `<Canvas>` has completed its first layout/paint returns `null` or a snapshot of stale/blank content.
**Why it happens:** `useCanvasRef()`'s ref is only populated once the native view exists, and drawing commands may not have flushed yet on the very first render pass — this is a well-known Skia/React timing gotcha, not specific to this codebase.
**How to avoid:** Only enable the Share button once an `onSize`/layout callback (or a short mount-settle delay) confirms the canvas has painted; guard `makeImageSnapshot()` for `null` and prefer `makeImageSnapshotAsync()` if the synchronous call proves flaky in on-device testing.
**Warning signs:** Exported PNG is blank, wrong-sized, or shows a stale previous card during rapid photo-swap interactions in compose.

### Pitfall 5: Photo permission "Limited Access" (iOS) is a silent partial-grant, not a clean grant/deny
**What goes wrong:** iOS's photo permission has three states (full, limited, denied) — treating "limited" the same as "denied" wrongly triggers the Settings-deep-link alert even though the picker would actually still work (with a reduced photo set); treating it the same as "full" risks missing the case where the user picked zero photos to share and the library returns nothing.
**Why it happens:** `requestMediaLibraryPermissionsAsync()`'s response includes an `accessPrivileges`/limited flag distinct from the boolean `granted`; CONTEXT.md's own D-16 phrasing ("limited access yields nothing") suggests the picker may return an empty result set under limited access with zero selectable photos.
**How to avoid:** Branch explicitly on the permission response's limited-access signal in addition to `granted`; if the picker returns `canceled: true` or an empty `assets` array even after a "granted" permission, fall back to the void card (D-07) exactly as the explicit-denial path does — never let an edge permission state hard-block sharing.
**Warning signs:** UAT tester with "Limited Photos Access" selected in iOS Settings sees the picker open with zero photos and no fallback, or is shown the "denied" alert copy despite having granted limited access.

## Code Examples

### Reading session stats for the card (mirrors `finish.tsx`'s existing query shape)
```typescript
// Source: verified directly from installed packages/db/src/schema.ts:78-99, 105-148
// (workout.hss, strengthSet.loadKg/reps, enduranceSegment.distanceM/durationS columns)
// — this is NOT new code to write from scratch; share.tsx should copy finish.tsx's
// existing SQLite-read pattern (see apps/mobile/app/session/finish.tsx:140-259) rather
// than invent a new query shape.
const workoutRows = await db
  .select({ type: workout.type, hss: workout.hss, localDate: workout.localDate })
  .from(workout)
  .where(eq(workout.id, workoutId));
```

### Building the fixed stat trio + caption (pure, vitest-testable)
```typescript
// lib/shareCard.ts — NEW pure module, zero @apsis/db import (mirrors lib/runEntryLogic.ts's
// extraction precedent, required because @apsis/db's barrel eagerly opens a native op-sqlite
// JSI connection at import time — see apps/mobile/vitest.config.mts's documented constraint).
export interface ShareCardStrengthStats {
  totalVolumeKg: number;
  setCount: number;
  durationS: number;
}
export interface ShareCardEnduranceStats {
  distanceM: number | null;
  paceSecPerKm: number | null;
  durationS: number;
}

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// D-04: mono session-type + date caption, e.g. "LIFT — AUG 3"
export function buildShareCaption(sessionType: 'strength' | 'endurance', localDate: string): string {
  const [, month, day] = localDate.split('-').map((p) => Number.parseInt(p, 10));
  const label = sessionType === 'strength' ? 'LIFT' : 'RUN';
  return `${label} — ${MONTH_ABBR[(month ?? 1) - 1]} ${day}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `expo-file-system`'s functional `writeAsStringAsync`/`readAsStringAsync`/`cacheDirectory` string constant | Class-based `File`/`Directory`/`Paths` API | SDK 54 (redesign), still current in this project's SDK 56 | Any new code in this phase must use `new File(Paths.cache, name)` — the legacy functions are still exported but throw a deprecation error when called |

**Deprecated/outdated:**
- `expo-file-system` legacy functional API (`writeAsStringAsync`, `FileSystem.cacheDirectory` string): superseded by the `File`/`Directory`/`Paths` class API; do not follow older SDK ≤53 tutorials that use the functional form.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-sharing`'s `shareAsync` is more reliable than RN core `Share.share` for local PNG images on iOS | Standard Stack, Pitfall 1 | Cross-referenced from WebSearch + official SDK-56 docs (not codebase-verified, since neither module is used anywhere yet) — if wrong, `expo-sharing` is still a safe, purpose-built choice with no real downside vs. RN core `Share`, so the risk is low even if the specific "RN core Share is less reliable" claim turns out overstated |
| A2 | `File.write()` requires `File.create()` to be called first (or is at minimum safe to call defensively) | Code Examples, Pitfall 2 | If `write()` in fact auto-creates, the extra `create({overwrite:true})` call is a harmless no-op; if `write()` truly requires a prior `create()` and this is skipped, the file write silently fails and the share sheet opens with nothing — mitigated by always including the `create()` call per Pattern 1 |
| A3 | A transitively-resolved `expo-file-system` in `node_modules` is NOT already autolinked into the current dev-client binary | Pitfall 3 | If wrong (i.e. it IS already linked because `expo`'s own internals use it), the planner over-budgets build risk by nothing more than one extra `pnpm install` + build cycle that was already required for `expo-image-picker`/`expo-sharing` anyway — safe assumption to make either way |
| A4 | iOS's `requestMediaLibraryPermissionsAsync()` "limited access" state can return zero photos from the picker, distinct from a clean "denied" | Pitfall 5 | Based on CONTEXT.md's own D-16 phrasing rather than an independently verified Expo API behavior test; if wrong, the fallback-to-void-card behavior (D-07) still covers the case safely regardless of exactly which permission state triggered it |

## Open Questions

1. **Does `expo-sharing`'s `shareAsync` on iOS reliably surface Instagram Stories / Messages / "Save Image" as targets for a PNG produced by this exact pipeline (Skia snapshot → File → shareAsync)?**
   - What we know: `expo-sharing`'s SDK-56 docs confirm local file URI sharing works on iOS via the native share sheet; the general mechanism is standard `UIActivityViewController`.
   - What's unclear: No source (official or community) documents this *exact* Skia-snapshot-to-share-sheet pipeline end to end — it's a reasonable composition of two independently-documented mechanisms, not a verified end-to-end recipe.
   - Recommendation: Treat this as the phase's one required on-device spike — build Pattern 1 early in Wave 1 and hand-verify the share sheet contents before building the rest of the compose screen around it, per the Validation Architecture section below.

2. **Does `File.write()` on a not-yet-`create()`d file throw, no-op, or auto-create?**
   - What we know: available example code always shows `create()` called first.
   - What's unclear: the exact failure/success contract if `create()` is skipped.
   - Recommendation: Always call `create({ overwrite: true })` defensively (Pattern 1); no further research needed, this is a "write defensively" resolution rather than a blocking unknown.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-image-picker` | Photo background pick (D-06/D-08) | ✗ (not in `package.json`; not in lockfile) | — | None — required install, gated at 06-06 per CONTEXT.md; already an accepted new dependency |
| `expo-file-system` | Writing the exported PNG to a shareable file | ✗ explicit install missing, though `56.0.8` is already resolvable transitively via `expo`'s own dependency tree (`[VERIFIED: pnpm-lock.yaml:7574, node_modules/expo-file-system/package.json]`) | 56.0.8 (transitively present) | Add explicit `package.json` entry; still needs 06-06 native rebuild per Pitfall 3 |
| `expo-sharing` | Native iOS share sheet handoff | ✗ (not in `package.json`; not in lockfile) | — | None — required install, gated at 06-06 |
| `@shopify/react-native-skia` | Card render + `makeImageSnapshot`/`encodeToBytes` | ✓ | 2.6.9 (pinned per Phase 04 legitimacy approval) | — |
| iOS physical device / dev-client build | On-device UAT of the full pipeline (share sheet cannot be meaningfully tested in a Windows dev environment or simulator with minimal Photos data) | ✗ (Windows host, per repo's established constraint — "Windows host cannot prebuild ios/", STATE.md Phase 04 P02) | — | EAS cloud build + physical device UAT, same pattern already used for every prior native-dependency phase (04, 05, 07) |

**Missing dependencies with no fallback:**
- `expo-image-picker`, `expo-sharing` — both required installs, both already budgeted into the 06-06 gate by CONTEXT.md.

**Missing dependencies with fallback:**
- `expo-file-system` — technically already resolvable via the transitive dependency, but should be installed explicitly and treated as requiring the same fresh build (Pitfall 3) rather than relied upon as "already there."

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.9 (`apps/mobile/vitest.config.mts`) |
| Config file | `apps/mobile/vitest.config.mts` — scoped to `lib/**/__tests__/*.{test,spec}.ts` only, **zero `@apsis/db`/native-module imports allowed** (verified: config file's own doc comment + `lib/__tests__/runEntryLogic.test.ts` precedent) |
| Quick run command | `pnpm --filter @apsis/mobile test -- shareCard` |
| Full suite command | `pnpm --filter @apsis/mobile test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-04 | `buildShareCaption` produces `LIFT — AUG 3` style mono caption for both session types | unit | `pnpm --filter @apsis/mobile test -- shareCard` | ❌ Wave 0 |
| D-03 | Fixed stat-trio formatting (lift: volume/sets/duration; run: distance/pace/duration) matches existing `finish.tsx`/`detail.tsx` formatting conventions | unit | `pnpm --filter @apsis/mobile test -- shareCard` | ❌ Wave 0 |
| D-02/D-05/D-09 | Share-edition ring renders with no readiness-band semantics, recomposed sizing | manual-only (Skia render, no component test harness in this repo — logged gap, STATE.md "apps/mobile has no component test harness") | on-device UAT | n/a |
| D-06/D-08/D-15 | Photo pick opens native library, `allowsEditing:true` forces square crop on iOS | manual-only (native picker UI, cannot run headless) | on-device UAT | n/a |
| D-07/D-16 | No-photo skip and permission-denied both fall back to the void card without blocking share | manual-only (permission-state simulation requires a physical device/simulator with Photos permission control) | on-device UAT | n/a |
| Pattern 1 (export pipeline) | Skia snapshot → file → share sheet completes and produces a valid attached PNG | manual-only (native share sheet, no automated harness) | on-device UAT, budgeted as the phase's required spike (Open Question 1) | n/a |

### Sampling Rate
- **Per task commit:** `pnpm --filter @apsis/mobile test -- shareCard`
- **Per wave merge:** `pnpm --filter @apsis/mobile test` (full suite) + a fresh EAS dev-client build once all three new native deps land (Pitfall 3)
- **Phase gate:** Full suite green + successful on-device share-sheet UAT (Open Question 1) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/lib/__tests__/shareCard.test.ts` — covers D-03/D-04's pure formatting logic
- [ ] No new vitest config/framework work needed — existing `vitest.config.mts` scoping already covers a new `lib/shareCard.ts` module as long as it stays `@apsis/db`-free

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched by this phase |
| V3 Session Management | no | — |
| V4 Access Control | no | Single-local-user app, no per-user data boundary (matches `packages/db/src/schema.ts`'s existing no-owner-column convention) |
| V5 Input Validation | n/a (no user-typed input in this phase — photo pick and share are OS-mediated) | — |
| V6 Cryptography | no | No new cryptographic surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache file left behind after share (exported PNG lingers in `Paths.cache` containing a photo the user picked) | Information Disclosure (minor — on-device only, no network egress) | `Paths.cache` is explicitly "a place to store files that can be deleted by the system when the device runs low on storage" — acceptable per Expo's own documented semantics; optionally delete the file after `Sharing.shareAsync` resolves (`file.delete()`), a nice-to-have, not a hard requirement given REL-03/the app's "everything stays on-device" posture already covers this class of risk |
| Crash/analytics reporting capturing a share-card screenshot or file path referencing a picked photo | Information Disclosure | Existing `lib/sentrySanitize.ts` allowlist (verified: `app/_layout.tsx`'s documented `beforeSend` contract — "only exception + contexts.device/app ever survive") already structurally prevents this; no new Sentry surface is introduced by this phase, so no new work needed here, but the planner should confirm no new `Sentry.setContext`/breadcrumb calls are added inside the compose screen that could leak a photo URI or HSS value |

## Sources

### Primary (HIGH confidence — verified directly against installed package source/types or this repo's own files)
- `node_modules/@shopify/react-native-skia/lib/commonjs/renderer/Canvas.d.ts` — `useCanvasRef`, `CanvasRef.makeImageSnapshot`/`makeImageSnapshotAsync` signatures
- `node_modules/@shopify/react-native-skia/lib/commonjs/skia/types/Image/Image.d.ts` — `SkImage.encodeToBase64`/`encodeToBytes`, `ImageFormat` enum
- `node_modules/@shopify/react-native-skia/lib/commonjs/skia/core/Image.d.ts` — `useImage` hook signature
- `node_modules/expo-file-system/build/*.d.ts` + `src/internal/NativeFileSystem.types.ts` — `File`/`Directory`/`Paths` class API, `FileWriteOptions`, `FileCreateOptions`
- `node_modules/react-native/Libraries/Share/Share.d.ts` — RN core `Share.share`/`ShareContent`/`ShareOptions` full signature
- `packages/db/src/schema.ts:78-99, 105-148` — `workout`, `strengthSet`, `enduranceSegment` column shapes used by the card's data layer
- `apps/mobile/constants/Colors.ts`, `constants/theme.ts` — verified hex/token values for the share-edition card's void/volt/mono styling
- `apps/mobile/vitest.config.mts` — verified `lib/**`-only test scoping and the no-`@apsis/db`-import constraint
- `pnpm-lock.yaml:7574` + `node_modules/expo-file-system/package.json` — confirmed `expo-file-system@56.0.8` already transitively resolved

### Secondary (MEDIUM confidence — official docs, cross-referenced)
- [docs.expo.dev/versions/v56.0.0/sdk/imagepicker/](https://docs.expo.dev/versions/v56.0.0/sdk/imagepicker/) — `launchImageLibraryAsync`, `allowsEditing`/`aspect` iOS-square-crop behavior, asset shape, config plugin
- [docs.expo.dev/versions/v56.0.0/sdk/filesystem/](https://docs.expo.dev/versions/v56.0.0/sdk/filesystem/) — `File`/`Paths.cache` usage pattern
- [docs.expo.dev/versions/v56.0.0/sdk/sharing/](https://docs.expo.dev/versions/v56.0.0/sdk/sharing/) — local file URI sharing support statement, UTI/mimeType options
- npm registry (`npm view expo-image-picker@56/expo-file-system@56/expo-sharing@56 version`) — SDK-56-line version confirmation for all three new packages

### Tertiary (LOW confidence — WebSearch only, flagged for on-device validation)
- WebSearch: RN core `Share` iOS base64/file-URL reliability reports (community issue trackers, not this app's own testing) — see Assumption A1
- WebSearch: `expo-file-system` SDK 54+ File/Directory API migration summary — cross-checked against this repo's own installed `.d.ts` (upgraded effectively to HIGH via direct verification)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library's exact API shape verified either against installed `.d.ts` files or official versioned Expo docs; only the *composition* of Skia+FileSystem+Sharing into one pipeline is unverified end-to-end (no existing tutorial covers this exact combination)
- Architecture: MEDIUM — the architecture is a straightforward composition of independently-documented pieces, but has zero codebase precedent (first file-export/native-share feature in this app) and zero cross-verified "recipe" source
- Pitfalls: MEDIUM — pitfalls are reasoned from official docs + cross-referenced community reports, not from this app's own on-device testing (that testing is exactly what Open Question 1 recommends as the required Wave 1 spike)

**Research date:** 2026-08-03
**Valid until:** 2026-09-02 (30 days — Expo SDK-56-line packages release frequent patches but the API shapes documented here are stable within the SDK-56 major line)
