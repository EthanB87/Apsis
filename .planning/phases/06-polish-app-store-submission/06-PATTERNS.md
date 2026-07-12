# Phase 6: Polish & App Store Submission - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 9 (new + modified)
**Analogs found:** 7 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/mobile/lib/sentrySanitize.ts` | utility (pure transform) | transform | `apps/mobile/lib/healthkitMapping.ts` (pure functions, e.g. `sanitizeHKNumeric`) | exact — same "pure allowlist/clamp function, no I/O" shape |
| `apps/mobile/lib/__tests__/sentrySanitize.test.ts` | test | transform | `apps/mobile/lib/__tests__/healthkitMapping.test.ts` | exact |
| `apps/mobile/app/_layout.tsx` (MODIFIED — add Sentry.init/wrap) | provider/root-boot | event-driven | itself (existing boot sequence, console.error convention) | exact (in-place) |
| `apps/mobile/app.json` (MODIFIED — Sentry plugin block) | config | config | itself (existing `plugins` array, HealthKit plugin entry) | exact (in-place) |
| `apps/mobile/eas.json` (MODIFIED — fill `submit.production.ios`) | config | config | itself (existing `build.production` block) | exact (in-place) |
| `apps/mobile/metro.config.js` (NEW or MODIFIED) | config | config | none found in repo (no metro.config.js currently read) | no analog — follow RESEARCH.md Pattern 2 (`getSentryExpoConfig`) |
| `packages/db/src/seed.ts` (MODIFIED — 43→~150 entries + D-14 bwFactor fix) | model/seed-data | CRUD (idempotent upsert) | itself (existing `STARTER_EXERCISES` array + `seedExercises()` upsert) | exact (in-place, additive) |
| `packages/db/src/__tests__/seed.test.ts` (MODIFIED — raise threshold, extend `BODYWEIGHT_FACTORS`) | test | CRUD | itself | exact (in-place) |
| `docs-site/privacy/index.html`, `docs-site/support/index.html` (NEW, static) | static content | file-I/O (static HTML, no app code) | none in repo — greenfield static site | no analog — plain HTML, no project pattern to copy |

## Pattern Assignments

### `apps/mobile/lib/sentrySanitize.ts` (utility, transform)

**Analog:** `apps/mobile/lib/healthkitMapping.ts` (pure decision/sanitization functions) and `apps/mobile/lib/healthkitAuth.ts` (module doc-comment + logging convention)

**File header / doc-comment convention** (from `healthkitAuth.ts` lines 1-23):
```typescript
/**
 * apps/mobile/lib/healthkitAuth.ts
 *
 * ...what the module does, which decisions it encodes (D-XX)...
 *
 * Security (T-05-01, Information Disclosure — mitigate): only `Error` objects and booleans are
 * ever logged from this module — never a raw bodyweight or heart-rate value.
 */
```
Apply the same shape to `sentrySanitize.ts`: state which decision (D-03) it encodes, and state explicitly what must NEVER be forwarded (mirrors the "never log raw health values" convention one layer up, at the SDK-event boundary instead of console).

**Pure exported function shape** — mirror `sanitizeHKNumeric`/`mapHKActivityType` in `healthkitMapping.ts`: a single pure function, no I/O, no native imports, fully synchronous, taking a plain-object input and returning a plain-object output. This is what makes it independently vitest-testable exactly like the HealthKit mapping module (per RESEARCH.md Pattern 1). Do not import `@sentry/react-native` runtime init logic into this file — only the type import (`ErrorEvent`) — to keep the module native-import-free and cheaply testable (matches `healthkitMapping.ts`'s "no native-module import anywhere in this file" convention, confirmed in its own test-file doc comment).

**Core transform pattern** — explicit allowlist reconstruction (never spread), from RESEARCH.md Pattern 1:
```typescript
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    exception: event.exception,
    contexts: {
      device: event.contexts?.device,
      app: event.contexts?.app,
    },
    user: undefined,
    extra: undefined,
    breadcrumbs: [],
  };
}
```

---

### `apps/mobile/lib/__tests__/sentrySanitize.test.ts` (test)

**Analog:** `apps/mobile/lib/__tests__/healthkitMapping.test.ts`

**Test file header pattern** (lines 1-8):
```typescript
/**
 * apps/mobile/lib/__tests__/healthkitMapping.test.ts
 *
 * RED/GREEN coverage for the pure ... decision logic (D-XX ...).
 * Mirrors runEntryLogic.test.ts's plain-vitest style — no @apsis/db, no
 * native-module import anywhere in this file or the module under test.
 */
```

**Import + describe/it structure** (lines 10-24):
```typescript
import { describe, expect, it } from 'vitest';
import { sanitizeSentryEvent } from '../sentrySanitize';

describe('sanitizeSentryEvent (D-03)', () => {
  it('strips a fabricated HR/HSS field from extra even if a future call site attaches it', () => {
    const poisoned = { extra: { heartRate: 172, hss: 88.4 }, exception: {}, contexts: {} } as any;
    const clean = sanitizeSentryEvent(poisoned);
    expect(clean.extra).toBeUndefined();
  });
});
```
Apply the same per-field assertion granularity used across `healthkitMapping.test.ts` — one `describe` block per exported function/decision, one `it` per allowlist field (exception kept, contexts trimmed to device/app, user always undefined, extra always undefined, breadcrumbs always `[]`) plus one adversarial test per field proving a poisoned/future input can't leak through.

---

### `apps/mobile/app/_layout.tsx` (MODIFIED — provider/root-boot, event-driven)

**Analog:** itself — the file already establishes the project's boot-sequence and error-logging conventions (lines 1-24, 117-126).

**Existing error-logging convention to reuse for Sentry init errors** (lines 117-126):
```typescript
if (error) {
  // Log raw error for developer diagnostics; ErrorScreen renders a generic string only.
  console.error('[Apsis] useMigrations error — raw details (developer only):', error);
  return (
    <GestureHandlerRootView style={styles.fill}>
      <ErrorScreen />
    </GestureHandlerRootView>
  );
}
```
Sentry.init() belongs at module scope (top of file, alongside `SplashScreen.preventAutoHideAsync()` at line 48) — before the component function, same "runs once per app launch" placement as the splash-screen call. `Sentry.wrap(RootLayout)` replaces the current `export default function RootLayout()` — becomes `export default Sentry.wrap(RootLayout);` per RESEARCH.md Pattern 1, keeping `RootLayout` as a named (non-default) function declaration.

**Convention to preserve:** every catch block in this file follows `console.error('[Apsis] <context>:', err)` with no raw domain values interpolated into the message — same discipline the Sentry `beforeSend` allowlist must extend to the SDK layer (T-05-01 lineage, confirmed in this file's own doc comment, lines 14-18).

---

### `apps/mobile/app.json` (MODIFIED — config)

**Analog:** itself, existing `plugins` array entry for `@kingstinct/react-native-healthkit` (lines 32-52)

**Plugin registration pattern to copy** (lines 44-51):
```json
[
  "@kingstinct/react-native-healthkit",
  {
    "NSHealthShareUsageDescription": "...",
    "NSHealthUpdateUsageDescription": "...",
    "background": false
  }
]
```
Add the Sentry plugin entry in the same array-of-tuples shape (per RESEARCH.md Pattern 2):
```json
["@sentry/react-native/expo", {
  "organization": "<org-slug>",
  "project": "<project-slug>",
  "url": "https://sentry.io/"
}]
```
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false` (line 14) already satisfies D-18 — no change needed there, just confirm it stays present.

---

### `apps/mobile/eas.json` (MODIFIED — config)

**Analog:** itself — existing `build.production.ios` stub (lines 10-14) shows the nesting convention; `submit.production` (line 17) is the empty object to fill.

**Existing shape:**
```json
"build": {
  "production": {
    "ios": { "buildConfiguration": "Release" }
  }
},
"submit": {
  "production": {}
}
```
Fill `submit.production.ios` per RESEARCH.md Pattern 3 (API-key auth fields: `ascAppId`, `appleTeamId`, `ascApiKeyPath`, `ascApiKeyIssuerId`, `ascApiKeyId`) or add `appleId`/`ascAppId` for interactive auth per D-17/Open Question 3. Also add `"autoIncrement": true` to `build.production.ios` per D-17 (buildNumber auto-increments; marketing version 1.0.0 stays fixed in `app.json`).

**Pitfall to flag in the plan:** a stray root-level `app.json`/`eas.json` exists at the repo root with a *different* bundle id (`com.apsistraining.apsis` vs. the real `com.apsis.app`). Confirmed present via `find . -maxdepth 1 -iname "app.json" -o -maxdepth 1 -iname "eas.json"`. The plan must either delete these or explicitly document "always run `eas build`/`eas submit` from `apps/mobile/`."

---

### `packages/db/src/seed.ts` (MODIFIED — model/seed-data, CRUD)

**Analog:** itself — `STARTER_EXERCISES` array (lines 28-83) and `seedExercises()` upsert (lines 103-118) are both stable, additive-only patterns; no external analog needed.

**Entry shape to replicate for ~107 new movements** (lines 30, 61, 81-82):
```typescript
{ id: 'squat', name: 'Back Squat', type: 'strength' as const, bodyPart: 'lower', bwFactor: null, entryMode: 'reps' as const },
{ id: 'wall-ball', name: 'Wall Ball', type: 'hybrid' as const, bodyPart: 'full', bwFactor: 0.30, entryMode: 'reps' as const },
// D-14 target — currently bwFactor: null, must become a curated non-null value:
{ id: 'ab-wheel', name: 'Ab Wheel', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
{ id: 'hanging-leg-raise', name: 'Hanging Leg Raise', type: 'strength' as const, bodyPart: 'core', bwFactor: null, entryMode: 'reps' as const },
```
Rules embedded in existing data (must hold for all new entries): `id` is kebab-case and permanently stable (FK target, doc comment lines 4-5); `bwFactor: null` + `entryMode: 'reps'|'timed'` for externally-loaded movements; `bwFactor: <0-1 float>` + `entryMode: 'reps'` for bodyweight-moved movements (push-up-style semantics per D-14); `entryMode: null` + `bwFactor: null` reserved for pure endurance/cardio types (`run`, `ski-erg`, etc., lines 64-65, 75-76).

**Upsert mechanism (no change needed, already handles new rows + backfill):**
```typescript
await db.insert(exercise).values([...STARTER_EXERCISES]).onConflictDoUpdate({
  target: exercise.id,
  set: { bwFactor: sql`excluded.bw_factor`, entryMode: sql`excluded.entry_mode` },
});
```

---

### `packages/db/src/__tests__/seed.test.ts` (MODIFIED — test)

**Analog:** itself

**Threshold assertion to raise** (line 15):
```typescript
it('has >= 40 entries', () => {
  expect(STARTER_EXERCISES.length).toBeGreaterThanOrEqual(40); // → 150
});
```

**Fixture map to extend** (lines 46-60) — add every new bodyweight-moved D-13 entry here, plus the D-14 fix:
```typescript
const BODYWEIGHT_FACTORS: Record<string, number> = {
  'pull-up': 0.95,
  // ...
  'ab-wheel': 0.30,            // D-14 fix — was null
  'hanging-leg-raise': 0.20,   // D-14 fix — was null
  // ... new D-13 entries with non-null bwFactor go here too
};
```
The existing `it('every bodyweight movement has its literature-anchored bwFactor and entryMode "reps"')` (lines 66-73) then automatically asserts the D-14 fix — no new test needed, only fixture-map entries. Also extend `TIMED_IDS` (line 62) and `ENDURANCE_IDS` (line 64) for any new timed/endurance movements added under D-13.

---

## Shared Patterns

### Console/telemetry logging discipline (T-05-01, extended by D-02/D-03)
**Source:** `apps/mobile/lib/healthkitAuth.ts` (module doc-comment lines 21-23) and `apps/mobile/app/_layout.tsx` (lines 14-18, 68-71, 83-86, 119-120, 153-160)
**Apply to:** `sentrySanitize.ts`, and any Sentry `beforeSend`/`integrations` config in `_layout.tsx`
```typescript
// Existing convention repeated at every catch site in the codebase:
console.error('[Apsis] <module/operation> failed:', err); // Error object/boolean only, never raw domain values
```
Sentry's `beforeSend` allowlist (Pattern 1 in RESEARCH.md) is this same convention pushed one layer further — enforced structurally (allowlist) rather than by discipline (console-call review), because breadcrumbs/integrations could otherwise re-capture `console.*` output verbatim (RESEARCH.md Pitfall 6).

### Idempotent upsert / additive migration-free data change
**Source:** `packages/db/src/seed.ts` lines 89-118 (module doc-comment + `seedExercises()`)
**Apply to:** the D-13/D-14 catalog expansion only — confirms zero migration file is needed, this is purely an array + upsert-target sync.

### Pure, native-import-free, independently-testable utility modules
**Source:** `apps/mobile/lib/healthkitMapping.ts` (per its own test file's doc comment, `healthkitMapping.test.ts` lines 6-8) and `apps/mobile/lib/__tests__/runEntryLogic.test.ts` (referenced sibling convention)
**Apply to:** `sentrySanitize.ts` — no `@sentry/react-native` runtime import, no native module import, plain object in/out, vitest-only coverage.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/mobile/metro.config.js` | config | config | No `metro.config.js` currently exists in the repo (Expo SDK 56 default is implicit); this phase introduces the first explicit one, wrapped via `getSentryExpoConfig` per RESEARCH.md Pattern 2 — follow the Sentry/Expo docs example directly, no in-repo precedent to copy. |
| `docs-site/privacy/index.html`, `docs-site/support/index.html` | static content | file-I/O | No static marketing/legal site exists anywhere in this repo (mobile-app-only monorepo) — these are greenfield plain HTML pages hosted outside the app build (GitHub Pages per Claude's discretion, D-04). Content is dictated entirely by D-05/D-06/Pitfall 5, not by any existing code pattern. |

## Metadata

**Analog search scope:** `apps/mobile/lib/`, `apps/mobile/lib/__tests__/`, `apps/mobile/app/`, `apps/mobile/app.json`, `apps/mobile/eas.json`, `packages/db/src/`, `packages/db/src/__tests__/`, repo root (`app.json`/`eas.json` conflict check)
**Files scanned:** 11 (`_layout.tsx`, `app.json`, `eas.json` ×2 locations, `seed.ts`, `seed.test.ts`, `healthkitAuth.ts`, `healthkitMapping.test.ts`, plus directory listings)
**Pattern extraction date:** 2026-07-12
