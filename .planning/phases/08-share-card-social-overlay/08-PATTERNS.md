# Phase 8: Share Card Social Overlay - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 6 (new/modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/mobile/app/session/share.tsx` (new compose screen) | route/controller | request-response (SQLite read) + file-I/O (export) | `apps/mobile/app/session/finish.tsx` (data-fetch shape) + `apps/mobile/app/(tabs)/nutrition/scan.tsx` (permission-gated screen shape) | role-match (composite of two analogs) |
| `apps/mobile/components/share/ShareCardCanvas.tsx` (new) | component (Skia canvas) | transform (data → pixels) | `apps/mobile/components/home/TrendChart.tsx` (Skia/victory-native canvas usage) + `apps/mobile/components/home/HssRing.tsx` (ring visual language to recompose) | role-match |
| `apps/mobile/lib/shareCard.ts` (new) | utility (pure) | transform | `apps/mobile/lib/runEntryLogic.ts` (pure, `@apsis/db`-free, vitest-testable extraction) | exact |
| `apps/mobile/lib/shareCardExport.ts` (new) | service (native glue) | file-I/O | `apps/mobile/lib/nutritionCameraAuth.ts` (native-module wrapper: never throws, logs `[Apsis]`-prefixed, returns a safe fallback) | role-match |
| `apps/mobile/app/session/finish.tsx` (modified — add secondary "Share card" button) | route/controller | request-response | itself (existing file, extend in place) | exact |
| `apps/mobile/app/session/detail.tsx` (modified — add Share entry point) | route/controller | request-response | itself (existing file, extend in place) | exact |
| `apps/mobile/app.json` (modified — add `expo-image-picker`/photo permission string) | config | — | existing `plugins` array (e.g. `expo-camera` entry) | exact |

## Pattern Assignments

### `apps/mobile/app/session/share.tsx` (new route, request-response + file-I/O)

**Analog:** `apps/mobile/app/session/finish.tsx` (data query shape) + `apps/mobile/app/(tabs)/nutrition/scan.tsx` (permission-gated screen shape)

**Imports pattern** (`finish.tsx` lines 17-39):
```typescript
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, enduranceSegment, exercise as exerciseTable, strengthSet, workout } from '@apsis/db';
import { sessionHSSDetailed } from '@apsis/engine';
import { formatPaceMinSec, kgToDisplayLb, kmToDisplayMi, paceSecPerKmToSecPerMi, type Units } from '@apsis/shared';

import HssRing from '../../components/home/HssRing';
import Colors from '../../constants/Colors';
import { Mono, Radius, Spacing, Typography } from '../../constants/theme';
import { fetchProfileSummary } from '../../lib/commitSet';
```
For `share.tsx`, follow this exact shape but pull `workout.hss` directly off the `workout` row (never re-derive via `sessionHSSDetailed` — Anti-Pattern in RESEARCH.md) since the persisted value is already the source of truth by the time `share.tsx` is reached from either entry point.

**SQLite-is-truth data-fetch pattern** (`finish.tsx` lines 136-269, `detail.tsx` lines 122-276): both screens re-derive everything from SQLite inside a `useEffect` keyed on `workoutId`, with a `cancelled` guard flag and a top-level `try/catch` that logs `[Apsis] <screen>.tsx ... failed:` and sets a safe fallback state rather than throwing. `share.tsx` MUST copy this exact shape for its stat-trio query (D-03) — read `workout.type`/`workout.hss`/`workout.localDate` plus the same `strengthSet`/`enduranceSegment` joins `finish.tsx` lines 144-209 and `detail.tsx` lines 182-197 already use, then hand the raw numbers to `lib/shareCard.ts`'s pure formatters (never recompute HSS).

**Permission-gated screen shape** (`scan.tsx` lines 60-72, 169-197 — see Shared Patterns "Native permission + graceful fallback" below): mirrors the `permissionGranted` state + guard-flag try/catch/finally + `Linking.openSettings()` denied-state UI that `share.tsx`'s photo-pick flow (D-16) should copy exactly, substituting `expo-image-picker`'s `requestMediaLibraryPermissionsAsync` for `Camera.requestCameraPermissionsAsync` and falling back to the void card (D-07) instead of a "manual entry" link.

**Error handling pattern** (`finish.tsx` lines 260-264):
```typescript
} catch (err: unknown) {
  console.error('[Apsis] finish.tsx summary query failed:', err);
  if (!cancelled) setHss(0);
}
```

**Route push from entry points** (new pattern, no existing router.push with params precedent in this exact shape — nearest is `scan.tsx` line 188 `router.push('/(tabs)/nutrition/log')` and `finish.tsx`'s own `useLocalSearchParams<{ workoutId: string }>()` receiver pattern, lines 20/122):
```typescript
router.push({ pathname: '/session/share', params: { workoutId } });
```

---

### `apps/mobile/components/share/ShareCardCanvas.tsx` (new component, transform)

**Analog:** `apps/mobile/components/home/TrendChart.tsx` (Skia canvas + font pattern) + `apps/mobile/components/home/HssRing.tsx` (ring visual language, D-02/D-09 — recompose, don't re-mount)

**Imports pattern** (`TrendChart.tsx` lines 17-31):
```typescript
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, matchFont, Line as SkiaLine, vec } from '@shopify/react-native-skia';
import Colors from '../../constants/Colors';
import { Mono, Radius, Spacing } from '../../constants/theme';
```
`ShareCardCanvas.tsx` additionally needs `useCanvasRef`, `Image` (for the photo background), `RoundedRect`/`LinearGradient` (for the D-10 void→transparent scrim), and `Circle` (for the ring) from `@shopify/react-native-skia` — all exported from the same installed package `TrendChart.tsx` already imports from.

**Font-resolution pattern** (`TrendChart.tsx` lines 86-92):
```typescript
const axisFont = useMemo(() => {
  try {
    return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: AXIS_FONT_SIZE });
  } catch {
    return undefined;
  }
}, []);
```
Copy this exact try/catch-guarded `matchFont` pattern for the card's mono caption/footer text and the big share-edition HSS number — never let a font-resolution failure crash the export.

**Ring visual language to recompose, NOT re-mount** (`HssRing.tsx` lines 47, 77-145): the reference constant `RING_FILL_REFERENCE_HSS = 200` and the `fillFraction = min(hss/200, 1)` capped-arc formula must be reused verbatim (D-02) so the share-edition ring's fill logic never drifts from the in-app ring's semantics. The stroke/circle/rotation-90-origin SVG-equivalent Skia drawing shape (steel track circle drawn first, then a volt arc) is the pattern to recompose at 1080px scale — but per D-05/D-09, this is a **new, separately-sized Skia `<Circle>`-based element** in `ShareCardCanvas.tsx`, not an import/re-mount of the `react-native-svg`-based `HssRing` component (which is sized for 200px/84px in-app contexts, not offscreen 1080px export, and Skia `<Canvas>` trees cannot embed `react-native-svg` elements anyway).

**No readiness-band semantics** (`finish.tsx` line 344 comment + D-05): `HssRing` is invoked with a hardcoded `band="green"` on the finish screen specifically because a single-session ring never carries readiness meaning — `ShareCardCanvas.tsx`'s ring must be built the same "always volt arc, never steel-only calibrating state" way; there is no `band` prop needed at all since the share card never renders the calibrating variant.

---

### `apps/mobile/lib/shareCard.ts` (new utility, pure transform)

**Analog:** `apps/mobile/lib/runEntryLogic.ts` (pure, zero `@apsis/db`, vitest-testable)

**Full pattern** (`runEntryLogic.ts` lines 1-46, structure to copy):
```typescript
/**
 * apps/mobile/lib/shareCard.ts
 *
 * Pure share-card formatting logic, factored out so it is unit-testable under vitest without
 * importing `@apsis/db` (whose barrel eagerly opens the native op-sqlite JSI connection at
 * module load) or any Expo native module. Zero I/O, zero wall-clock reads.
 */

export type ShareSessionType = 'strength' | 'endurance';

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
export function buildShareCaption(sessionType: ShareSessionType, localDate: string): string {
  const [, month, day] = localDate.split('-').map((p) => Number.parseInt(p, 10));
  const label = sessionType === 'strength' ? 'LIFT' : 'RUN';
  return `${label} — ${MONTH_ABBR[(month ?? 1) - 1]} ${day}`;
}
```
This is the exact module RESEARCH.md's Code Examples section already specifies — copy it as the file's starting shape, then add the D-03 stat-trio formatters. For duration/distance/pace string formatting, copy `finish.tsx`'s `formatSessionDuration` (lines 74-81) and `formatEnduranceSummary`'s distance/pace math (lines 86-119) rather than inventing new formatting — same convention `detail.tsx` already duplicates (`formatEnduranceMeta`, lines 65-109, with its own comment acknowledging the duplication is the established convention, "not exported there, duplicated here as a small presentation-only helper").

**Test file location & scoping constraint:** `apps/mobile/lib/__tests__/shareCard.test.ts`, run via `pnpm --filter @apsis/mobile test -- shareCard`; `vitest.config.mts` scopes to `lib/**` with a documented zero-`@apsis/db`-import constraint (RESEARCH.md Validation Architecture) — `shareCard.ts` must never import `@apsis/db`.

---

### `apps/mobile/lib/shareCardExport.ts` (new service, file-I/O, native glue)

**Analog:** `apps/mobile/lib/nutritionCameraAuth.ts` (native-module wrapper convention)

**Never-throws / safe-fallback pattern** (`nutritionCameraAuth.ts` lines 32-40):
```typescript
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const response = await Camera.requestCameraPermissionsAsync();
    return response.granted;
  } catch (err: unknown) {
    console.error('[Apsis] Camera permission request failed:', err);
    return false;
  }
}
```
Copy this exact shape for both the photo-permission request (wrapping `expo-image-picker`'s `requestMediaLibraryPermissionsAsync`) and the export/share pipeline (wrapping the Skia-snapshot → `expo-file-system` → `expo-sharing` sequence from RESEARCH.md Pattern 1) — a native-capability gate in this codebase never throws to its caller; it logs an `[Apsis]`-prefixed `console.error` with the raw `Error` object and returns a safe sentinel (`false`/`null`) so the calling screen renders a fallback UI instead of crashing.

**Export pipeline** (RESEARCH.md Pattern 1, verified against installed package `.d.ts` files — greenfield, no existing codebase precedent):
```typescript
import { Canvas, useCanvasRef, ImageFormat } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportAndShareCard(canvasRef: ReturnType<typeof useCanvasRef>): Promise<boolean> {
  try {
    const image = canvasRef.current?.makeImageSnapshot();
    if (!image) return false;
    const bytes = image.encodeToBytes(ImageFormat.PNG);

    const file = new File(Paths.cache, `apsis-share-${Date.now()}.png`);
    file.create({ overwrite: true }); // defensive per Pitfall 2 — always create before write
    file.write(bytes);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
      return true;
    }
    return false;
  } catch (err: unknown) {
    console.error('[Apsis] shareCardExport failed:', err);
    return false;
  }
}
```
Not vitest-testable (native modules) — UAT-only, per RESEARCH.md Validation Architecture.

---

### `apps/mobile/app/session/finish.tsx` (modified — add secondary "Share card" button, D-13)

**Analog:** itself. The existing `handleDone`/button pattern (lines 271-285, 379-391, 515-537) is the shape to extend: add a second `Pressable` above/beside the Done button, styled **bone-filled** (background `Colors.dark.text`, label `Colors.dark.onAccent` — the exact `goalOptionSelected`/`goalLabelSelected` bone-active-fill convention at `apps/mobile/app/nutrition-setup/index.tsx` lines 297-309) so the Done CTA keeps sole ownership of the volt fill (`Colors.dark.accent`) per the one-volt-per-screen rule:
```typescript
// bone-filled, mirrors nutrition-setup/index.tsx's goalOptionSelected convention
const styles = StyleSheet.create({
  shareButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.text, // bone
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent, // void text on bone fill
  },
});
```
`onPress` should call `router.push({ pathname: '/session/share', params: { workoutId } })` (same `useRouter`/`useLocalSearchParams` already imported at lines 20/122).

---

### `apps/mobile/app/session/detail.tsx` (modified — add Share entry point, D-11)

**Analog:** itself. This screen already re-enables the native header via a nested `Stack.Screen` override (lines 280-289) for the back button; the Share entry point is the natural place to add a `headerRight` button in that same `Stack.Screen options` object, OR a bone-filled `Pressable` appended after the `totalRow` (lines 309-312) following the same `styles.totalRow`/`Spacing.xl` layout rhythm. Route push uses the same `workoutId` already held in `useLocalSearchParams<{ workoutId: string }>()` (line 112-113).

---

### `apps/mobile/app.json` (modified — add `expo-image-picker` plugin entry, D-06/D-15)

**Analog:** existing `expo-camera` plugin entry (lines 53-60):
```json
[
  "expo-camera",
  {
    "cameraPermission": "Apsis uses the camera only to scan food barcodes and photograph nutrition labels so you can log foods faster.",
    "microphonePermission": false,
    "recordAudioAndroid": false
  }
]
```
Add an `expo-image-picker` entry to the `plugins` array in the same shape, with an `NSPhotoLibraryUsageDescription`-equivalent permission string plugin config (per `docs.expo.dev/versions/v56.0.0/sdk/imagepicker/` config-plugin options — verify exact key name against the installed package's plugin schema once `expo-image-picker` is installed, per AGENTS.md's "read exact versioned docs" mandate). `expo-file-system` and `expo-sharing` require no plugin/permission entries (no user-facing permission string).

## Shared Patterns

### SQLite-is-truth data fetching
**Source:** `apps/mobile/app/session/finish.tsx` lines 136-269, `apps/mobile/app/session/detail.tsx` lines 122-276
**Apply to:** `share.tsx`
```typescript
useEffect(() => {
  if (!workoutId) return;
  let cancelled = false;
  (async () => {
    try {
      // ... db.select(...).from(...).where(eq(workout.id, workoutId))
      if (!cancelled) { /* setState */ }
    } catch (err: unknown) {
      console.error('[Apsis] <screen>.tsx query failed:', err);
      if (!cancelled) { /* safe fallback setState */ }
    }
  })();
  return () => { cancelled = true; };
}, [workoutId]);
```

### Native permission + graceful fallback (never hard-blocks)
**Source:** `apps/mobile/lib/nutritionCameraAuth.ts` (permission wrapper) + `apps/mobile/app/(tabs)/nutrition/scan.tsx` lines 60-72, 169-197 (screen-level guard-flag state + denied UI)
**Apply to:** `share.tsx`'s photo-pick flow, `lib/shareCardExport.ts`'s permission request
```typescript
// screen-level guard-flag shape (scan.tsx lines 60-72)
try {
  const granted = await requestPhotoLibraryPermission();
  setPermissionGranted(granted);
} catch (err: unknown) {
  console.error('[Apsis] Photo permission check failed:', err);
  setPermissionGranted(false);
} finally {
  setLoading(false);
}

// denied-state UI (scan.tsx lines 169-197) — alert/inline copy + Open Settings deep-link,
// THEN fall back rather than dead-ending (D-16: fall back to void card, not "manual entry")
<Pressable onPress={() => { void Linking.openSettings(); }} accessibilityRole="button" accessibilityLabel="Open Settings">
  <Text>Open Settings</Text>
</Pressable>
```

### One-volt-per-screen bone-fill secondary button
**Source:** `apps/mobile/app/nutrition-setup/index.tsx` lines 297-309 (`goalOptionSelected`/`goalLabelSelected`)
**Apply to:** `finish.tsx`'s new "Share card" button (D-13), any bone-filled affordance in `share.tsx`
```typescript
backgroundColor: Colors.dark.text,   // bone
color: Colors.dark.onAccent,          // void text on bone fill (never bone-on-volt)
```

### Native-capability wrapper: never throw, log `[Apsis]`-prefixed, return safe fallback
**Source:** `apps/mobile/lib/nutritionCameraAuth.ts` lines 32-40
**Apply to:** `lib/shareCardExport.ts` (photo permission request, Skia snapshot → file → share pipeline)
```typescript
try {
  // native call
} catch (err: unknown) {
  console.error('[Apsis] <capability> failed:', err);
  return <safe fallback: false | null>;
}
```

### Skia canvas + matchFont (guarded)
**Source:** `apps/mobile/components/home/TrendChart.tsx` lines 86-92
**Apply to:** `components/share/ShareCardCanvas.tsx`
```typescript
const font = useMemo(() => {
  try {
    return matchFont({ fontFamily: 'JetBrainsMono_500Medium', fontSize: SIZE });
  } catch {
    return undefined;
  }
}, []);
```

### Capped-ring-fill formula (must reuse the same reference constant, not redefine)
**Source:** `apps/mobile/components/home/HssRing.tsx` line 47, 86
**Apply to:** `components/share/ShareCardCanvas.tsx`'s share-edition ring
```typescript
export const RING_FILL_REFERENCE_HSS = 200; // import from HssRing.tsx, don't redefine
const fillFraction = Math.min(hss / RING_FILL_REFERENCE_HSS, 1);
```

## No Analog Found

None — every new/modified file has at least a role-match analog in the existing codebase.

## Metadata

**Analog search scope:** `apps/mobile/app/session/`, `apps/mobile/components/home/`, `apps/mobile/lib/`, `apps/mobile/app/(tabs)/nutrition/`, `apps/mobile/app/nutrition-setup/`, `apps/mobile/constants/`, `apps/mobile/app.json`
**Files scanned:** finish.tsx, detail.tsx, HssRing.tsx, TrendChart.tsx, runEntryLogic.ts, nutritionCameraAuth.ts, scan.tsx, nutrition-setup/index.tsx, Colors.ts, app.json, schema.ts (partial)
**Pattern extraction date:** 2026-08-03
