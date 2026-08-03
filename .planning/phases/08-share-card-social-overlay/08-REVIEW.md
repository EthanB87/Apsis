---
phase: 08-share-card-social-overlay
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - apps/mobile/app.json
  - apps/mobile/app/session/detail.tsx
  - apps/mobile/app/session/finish.tsx
  - apps/mobile/app/session/share.tsx
  - apps/mobile/components/share/ShareCardCanvas.tsx
  - apps/mobile/lib/__tests__/shareCard.test.ts
  - apps/mobile/lib/shareCard.ts
  - apps/mobile/lib/shareCardExport.ts
  - apps/mobile/package.json
  - packages/db/package.json
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-08-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the share-card feature end to end: the pure view-model (`shareCard.ts`, well covered by
`shareCard.test.ts`), the Skia canvas renderer (`ShareCardCanvas.tsx`), the export/share-sheet
pipeline (`shareCardExport.ts`), the compose screen (`share.tsx`), the two new entry points
(`finish.tsx`, `detail.tsx`), and the supporting config/manifest changes (`app.json`,
`apps/mobile/package.json`, `packages/db/package.json`).

The pure formatting layer (`shareCard.ts`) is solid and its test coverage is accurate. The
dependency/config additions (`expo-sharing`, `expo-image-picker`, `expo-file-system`, config
plugin entries) are correctly wired — `expo-sharing` and `expo-image-picker` both ship valid
`app.plugin.js` entry points, and the `File`/`Directory` `create()`/`write()` calls used in
`shareCardExport.ts` are synchronous JSI methods, not missing `await`s.

The one significant defect is in `share.tsx`: the Pitfall-4 "canvas settled" guard that the file's
own doc comments describe at length is a one-way latch keyed only on the *initial* data load
(`hss`/`fontsReady`). It never re-arms when the user swaps the background photo, so the Share
button stays enabled through the exact stale/blank-frame window the guard was built to prevent —
directly contradicting the documented intent. Two further robustness gaps: `exportAndShareCard`'s
boolean failure signal is silently discarded by its caller, and exported PNGs in the cache
directory are never cleaned up.

## Critical Issues

### CR-01: Share button isn't re-gated after a photo swap, risking a stale/blank export

**File:** `apps/mobile/app/session/share.tsx:186-200, 229-230, 243-244`

**Issue:** The Pitfall-4 settle guard —

```ts
useEffect(() => {
  if (hss == null || !fontsReady) return;
  const timer = setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
  return () => clearTimeout(timer);
}, [hss, fontsReady]);
```

only depends on `[hss, fontsReady]` and sets `canvasReady` to `true` exactly once, on the initial
data load. Once `true`, nothing ever sets it back to `false`.

`handleChoosePhoto` lets the user swap the background photo at any time after that initial
settle (`setSelectedPhotoUri(uri)` at line 230), which changes `ShareCardCanvas`'s
`backgroundPhotoUri` prop and triggers a brand-new async `useImage` load/decode plus a full
canvas repaint. `handleShare` (line 244) only checks `!canvasReady || sharing` — it has no
awareness of `selectedPhotoUri` or of whether the new photo has actually finished loading and
painted.

Concretely: user opens the compose screen, the initial void/placeholder card settles
(`canvasReady = true`), then taps "Swap photo," picks a new image, and immediately taps "Share"
(both buttons are enabled the instant the native picker returns). `makeImageSnapshot()` can then
capture the previous background, a blank frame, or a mid-decode frame — the exact "stale/blank
frame" failure mode the file's header comment and `CANVAS_SETTLE_MS` timer were built to prevent,
except the fix was never extended to cover photo swaps, only the first load.

**Fix:** Re-arm the settle guard whenever the resolved background image changes, not just on the
initial `hss`/`fontsReady` transition — track photo-readiness in `ShareCardCanvas` (e.g. surface an
`onBackgroundReady` callback fired from a `useEffect` on the resolved `photoImage`, mirroring the
existing `onFontsReady` pattern) and gate `canvasReady` on that too:

```ts
// share.tsx
const [backgroundReady, setBackgroundReady] = useState(true);

useEffect(() => {
  if (selectedPhotoUri == null) return; // void card has no async background to wait on
  setBackgroundReady(false);
}, [selectedPhotoUri]);

// ShareCardCanvas fires onBackgroundReady(true) once `photoImage` resolves (non-null or
// confirmed-failed) for the CURRENT backgroundPhotoUri, same shape as onFontsReady.

useEffect(() => {
  if (hss == null || !fontsReady || !backgroundReady) return;
  const timer = setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
  return () => clearTimeout(timer);
}, [hss, fontsReady, backgroundReady]);
```

and reset `canvasReady` to `false` at the top of that effect (or via a separate `setCanvasReady(false)` call) whenever `backgroundReady` flips back to `false`.

## Warnings

### WR-01: `exportAndShareCard`'s failure result is silently discarded

**File:** `apps/mobile/app/session/share.tsx:243-254`
**Issue:** `exportAndShareCard` (per its own doc comment in `shareCardExport.ts:34-36`) "resolves
`true` only when the share sheet was actually presented; `false` on any failure ... never
throws." `handleShare` awaits the call but never inspects the resolved boolean:

```ts
async function handleShare(): Promise<void> {
  if (!canvasReady || sharing) return;
  setSharing(true);
  try {
    await exportAndShareCard(canvasRef);
  } catch (err: unknown) {
    console.error('[Apsis] share.tsx export failed:', err);
  } finally {
    setSharing(false);
  }
}
```

Since the function's documented failure path is a `false` return (not a throw), the `catch` block
here only handles the never-expected case. On a real failure (canvas not measured, sharing
unavailable on the device, snapshot returned `null`), the button silently flips from "Sharing…"
back to "Share" with zero indication to the user that nothing happened.
**Fix:**
```ts
const shared = await exportAndShareCard(canvasRef);
if (!shared) {
  Alert.alert('Share failed', 'Could not share this card. Please try again.');
}
```

### WR-02: Exported share-card PNGs accumulate in the cache directory with no cleanup

**File:** `apps/mobile/lib/shareCardExport.ts:44-49`
**Issue:** Every successful (and every attempted) export writes a new uniquely-named file
(`apsis-share-${Date.now()}.png`) into `Paths.cache` and never removes it — not after the share
sheet closes, not on a subsequent export, and not anywhere else in the codebase (no cleanup call
was found for this filename pattern). Each 1080x1080 PNG is a non-trivial file; a user who shares
several sessions accumulates an unbounded, ever-growing set of these files with no code path that
ever reclaims them.
**Fix:** Delete the file once `Sharing.shareAsync` resolves (or on any exit path), e.g.:
```ts
try {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
    return true;
  }
  return false;
} finally {
  file.delete();
}
```
(guard the `delete()` call itself against throwing, consistent with this file's never-throws
convention).

## Info

### IN-01: Three near-duplicate duration-formatting helpers

**File:** `apps/mobile/app/session/finish.tsx:74-81` (`formatSessionDuration`), `apps/mobile/app/session/detail.tsx:74-81` (`formatDuration`), `apps/mobile/lib/shareCard.ts:67-74` (`formatShareDuration`)
**Issue:** All three implement the identical `h>0 ? "h:mm:ss" : "m:ss"` formatting logic, each
re-implemented rather than shared. The in-file comments acknowledge this is an intentional
"established small-presentation-helper" convention, but it still means any future fix to the
formatting rule (e.g. supporting negative durations, or >99h sessions) has to be applied in three
places by hand, and the three copies could silently drift.
**Fix:** Consider promoting this to a single shared helper (e.g. in `@apsis/shared`) now that a
third near-identical copy has been added; not urgent given the explicit existing convention, but
worth reconsidering before a fourth copy appears.

### IN-02: `handleShare`'s `try/catch` documents a promise contract that can't fire

**File:** `apps/mobile/app/session/share.tsx:243-254`
**Issue:** The comment above the catch block says "Defense in depth -- exportAndShareCard never
throws, but this screen still guards" — which is accurate, but means the `catch` branch is
provably dead code under the documented contract of the function it wraps. This isn't wrong to
keep as a defensive measure, but combined with WR-01 it means the *only* code path currently
capable of running is one that (by contract) never executes, while the actual failure path
(`false` return) is unhandled.
**Fix:** No action needed beyond WR-01 — noting this because fixing WR-01 by adding the `!shared`
branch resolves both observations together.

---

_Reviewed: 2026-08-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
