---
phase: quick
plan: 260709-qmv
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/constants/Colors.ts
  - apps/mobile/constants/theme.ts
  - apps/mobile/app/_layout.tsx
  - apps/mobile/package.json
  - apps/mobile/components/StyledText.tsx
  - apps/mobile/components/BootStates.tsx
  - apps/mobile/components/onboarding/WizardStep.tsx
  - apps/mobile/components/onboarding/ProfileReview.tsx
  - apps/mobile/components/session/LiveHssHeader.tsx
  - apps/mobile/components/session/SetRow.tsx
  - apps/mobile/components/session/ExerciseCard.tsx
  - apps/mobile/components/session/ExercisePickerSheet.tsx
  - apps/mobile/components/session/HSSBreakdownSheet.tsx
  - apps/mobile/components/session/RestTimerBanner.tsx
  - apps/mobile/app/(tabs)/_layout.tsx
  - apps/mobile/app/(tabs)/index.tsx
  - apps/mobile/app/(tabs)/log/index.tsx
  - apps/mobile/app/(tabs)/log/session.tsx
  - apps/mobile/app/(tabs)/settings/index.tsx
  - apps/mobile/app/onboarding/sex.tsx
  - apps/mobile/app/onboarding/bodyweight.tsx
  - apps/mobile/app/onboarding/units.tsx
  - apps/mobile/app/onboarding/threshold-hr.tsx
  - apps/mobile/app/onboarding/threshold-pace.tsx
  - apps/mobile/app/onboarding/review.tsx
  - apps/mobile/app/session/finish.tsx
  - apps/mobile/app/modal.tsx
  - apps/mobile/app/+not-found.tsx
  - apps/mobile/app/+html.tsx
  - apps/mobile/app.json
  - apps/mobile/assets/images/icon.png
  - apps/mobile/assets/images/splash-icon.png
  - apps/mobile/assets/images/favicon.png
  - apps/mobile/assets/images/apsis-plate-mark.png
  - app.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "Every app surface (onboarding, tab shell, lifting logger, settings, resume prompt, boot states) renders on the void #0B0C0E dark palette with volt #C6F23D as the single accent — zero blue #3E8EF7 remains anywhere."
    - "Primary CTAs render as volt fill with void (dark) text, never bone-on-volt."
    - "HSS numbers and screen titles render in the Archivo Expanded (heavy) display family; data/metrics/units/timestamps render in the JetBrains Mono family."
    - "The iOS app icon is the Apsis plate mark from apsis_icon_pack, and the splash + android backgrounds are void, not white/light-blue."
  artifacts:
    - "apps/mobile/constants/Colors.ts — design-system palette (void/carbon/steel/line/bone/ash/volt/molten + onAccent)"
    - "apps/mobile/constants/theme.ts — Radius tokens + fontFamily-bearing Typography roles + Mono role"
    - "apps/mobile/assets/images/icon.png — the new Apsis icon"
  key_links:
    - "All 23 styled screens/components import color from constants/Colors.ts (single source of truth) — the palette swap propagates through this import."
    - "app/_layout.tsx useFonts gate must load Archivo + JetBrains Mono before splash hides, or fontFamily references render as system fallback."
---

<objective>
Restyle the entire Apsis mobile UI to the Apsis dark design system defined in
`apsis_claude_design_prompt.md` (the authoritative visual contract), and wire the new app
icon from `apsis_icon_pack/`. Replace the current blue theme everywhere with the void/volt
palette, add the Archivo Expanded + Archivo + JetBrains Mono type system, and swap the icon.

This is a pure visual restyle + asset wiring task. Do NOT touch logging logic, the engine,
or the onboarding keyboard/unit-entry blocker (an explicitly separate follow-up).

Purpose: Give Apsis its ownable "performance instrument, not a diary" identity before the
July App Store build.
Output: A retheme centered on one source-of-truth token file, propagated across all screens
and components, plus the new app icon and dark splash.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apsis_claude_design_prompt.md

# Design system source of truth (color tokens):
#   void   #0B0C0E  primary background        -> Colors key: background
#   carbon #15171A  card / surface            -> Colors key: surface
#   steel  #1F2329  raised surface / inactive -> Colors key: steel (NEW)
#   line   #2A2F36  hairline borders          -> Colors key: border
#   bone   #F2F1EC  primary text              -> Colors key: text
#   ash    #8A9098  secondary / muted text    -> Colors key: mutedText
#   volt   #C6F23D  PRIMARY accent            -> Colors key: accent / tint
#   molten #FF5A1F  alert / red readiness     -> Colors key: destructive (heat)
#   (amber readiness -> muted yellow-green)   -> Colors key: warning
#   void as text on volt fills                -> Colors key: onAccent (NEW)
#
# Current files touching color (verified via grep):
@apps/mobile/constants/Colors.ts
@apps/mobile/constants/theme.ts
@apps/mobile/components/BootStates.tsx
@apps/mobile/components/session/LiveHssHeader.tsx
@apps/mobile/app/(tabs)/_layout.tsx
@apps/mobile/app.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite the token source of truth (palette + type + radii) and load fonts</name>
  <files>apps/mobile/constants/Colors.ts, apps/mobile/constants/theme.ts, apps/mobile/app/_layout.tsx, apps/mobile/package.json</files>
  <action>
    Establish the design system as one source of truth so the rest of the app inherits it via existing imports.

    1. Colors.ts — replace the blue palette with the design tokens (keep the existing exported key shape so all 23 consumers keep compiling; add two new keys). Map: background = void #0B0C0E; surface = carbon #15171A; add a new `steel` key = #1F2329 (raised surface + inactive track); border = line #2A2F36; text = bone #F2F1EC; mutedText = ash #8A9098; accent + tint = volt #C6F23D; add a new `onAccent` key = #0B0C0E (void — the label color for volt-filled CTAs); destructive = molten #FF5A1F; warning = a muted yellow-green amber (use #A8B545 or similar desaturated yellow-green, NOT pure volt) for amber readiness; tabIconSelected = volt; tabIconDefault = ash. Keep the dark-only `{ light: darkPalette, dark: darkPalette }` export shape.

    2. theme.ts — add design shape + type:
       - Add a `Radius` token export: `{ sm: 6, md: 8, lg: 10 }` (sharp, per the 6–10px rule). Replace ad-hoc `borderRadius: 12` usages in Task 2 with these.
       - Add `fontFamily` to the Typography roles. `display` and `heading` use the Archivo Expanded heavy family (the pragmatic mapping is `Archivo_900Black` for display and `Archivo_800ExtraBold` for heading — true "Expanded" width is not on expo-google-fonts, and the design brief explicitly permits heavy Archivo as the fallback). Add `textTransform: 'uppercase'` and tight `letterSpacing: -0.5` to display/heading per the ALL-CAPS tight-tracking rule. `body` uses `Archivo_400Regular`; `label` uses `Archivo_500Medium`. Bump display fontSize to ~40 so the HSS reads as a hero number.
       - Add a NEW `Mono` typography role for data/telemetry: `{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }` (wide-tracked instrument readout). Export it alongside `Typography`.
       - Keep `Spacing`, `HIT_TARGET_MIN`, `HAIRLINE_WIDTH`, `tabularNums` unchanged.

    3. package.json — add the Google Font packages via `npx expo install @expo-google-fonts/archivo @expo-google-fonts/jetbrains-mono` (run from apps/mobile so versions resolve against SDK 56). These are official Expo-maintained packages (see threat model T-QMV-SC).

    4. _layout.tsx — load fonts before the splash hides. Import `useFonts` and the specific weights from the two packages (`Archivo_400Regular, Archivo_500Medium, Archivo_800ExtraBold, Archivo_900Black` and `JetBrainsMono_400Regular, JetBrainsMono_500Medium`). Add the `useFonts(...)` hook near `useMigrations`. Extend the existing loading gate so `LoadingScreen` also shows while `!fontsLoaded`, and extend the splash-hide effect so it only fires once fonts AND migrations have settled. Do not otherwise change the boot/resume/gating logic.

    Do NOT hardcode any hex outside Colors.ts. Do NOT introduce a light theme.
  </action>
  <verify>
    <automated>cd apps/mobile && node -e "const c=require('./constants/Colors.ts'? null:null)" 2>/dev/null; grep -q 'C6F23D' constants/Colors.ts && grep -q '0B0C0E' constants/Colors.ts && ! grep -q '3E8EF7' constants/Colors.ts && grep -q 'onAccent' constants/Colors.ts && grep -q "steel" constants/Colors.ts && grep -q 'JetBrainsMono' constants/theme.ts && grep -q 'Archivo_900Black' constants/theme.ts && grep -q 'Radius' constants/theme.ts && grep -q '@expo-google-fonts/archivo' package.json && grep -q '@expo-google-fonts/jetbrains-mono' package.json && grep -q 'useFonts' app/_layout.tsx && echo TOKENS_OK</automated>
  </verify>
  <done>Colors.ts carries the full void/volt palette with `steel` + `onAccent` keys and no blue; theme.ts exports Radius, fontFamily-bearing Typography, and a Mono role; both font packages are in package.json; _layout.tsx gates on useFonts.</done>
</task>

<task type="auto">
  <name>Task 2: Propagate the design system across every screen and component</name>
  <files>apps/mobile/components/StyledText.tsx, apps/mobile/components/BootStates.tsx, apps/mobile/components/onboarding/WizardStep.tsx, apps/mobile/components/onboarding/ProfileReview.tsx, apps/mobile/components/session/LiveHssHeader.tsx, apps/mobile/components/session/SetRow.tsx, apps/mobile/components/session/ExerciseCard.tsx, apps/mobile/components/session/ExercisePickerSheet.tsx, apps/mobile/components/session/HSSBreakdownSheet.tsx, apps/mobile/components/session/RestTimerBanner.tsx, apps/mobile/app/(tabs)/_layout.tsx, apps/mobile/app/(tabs)/index.tsx, apps/mobile/app/(tabs)/log/index.tsx, apps/mobile/app/(tabs)/log/session.tsx, apps/mobile/app/(tabs)/settings/index.tsx, apps/mobile/app/onboarding/sex.tsx, apps/mobile/app/onboarding/bodyweight.tsx, apps/mobile/app/onboarding/units.tsx, apps/mobile/app/onboarding/threshold-hr.tsx, apps/mobile/app/onboarding/threshold-pace.tsx, apps/mobile/app/onboarding/review.tsx, apps/mobile/app/session/finish.tsx, apps/mobile/app/modal.tsx, apps/mobile/app/+not-found.tsx, apps/mobile/app/+html.tsx</files>
  <action>
    Sweep every styled surface so the new tokens actually show. Work file by file; most files already import `Colors` + `Typography` and only need the rules below applied. Because Colors.ts changed in Task 1, base colors already propagate — this task fixes the semantic mismatches and applies the type system.

    RULES (apply everywhere they occur):

    1. Volt-fill CTA text = void. Every primary/filled button that uses `Colors.dark.accent` (volt) as its `backgroundColor` must set its LABEL color to `Colors.dark.onAccent` (void), NOT `Colors.dark.text` (bone). Known sites: BootStates `primaryButtonLabel`, LiveHssHeader `finishLabel`, onboarding "Continue"/primary buttons (WizardStep + each onboarding step), review.tsx submit, finish.tsx "Done". Bone-on-volt is a hard design violation.

    2. HSS numbers + big stats = display family, volt. The live/session/day HSS value and any hero number uses `Typography.display` (Archivo Expanded heavy) in `Colors.dark.accent`. LiveHssHeader `hssValue` already uses `Typography.display` + `accent` — keep, it now inherits the new family automatically.

    3. Screen titles + section headers = display/heading family, ALL CAPS. Apply `Typography.display` or `Typography.heading` (they now carry uppercase + tight tracking) to onboarding step titles, tab screen titles, settings section headers, sheet titles.

    4. Data / metrics / units / timestamps / set-rep data = Mono role. Apply the new `Mono` typography role (JetBrains Mono, wide-tracked, uppercase) to: SetRow load/reps/RPE values and unit labels, ExerciseCard metadata line, HSSBreakdownSheet numeric breakdown, RestTimerBanner countdown, LiveHssHeader elapsed timer, session metadata lines, settings numeric values. Combine with `tabularNums` where digits change live (elapsed, countdown).

    5. Replace hardcoded hex with tokens. Fix the literals that bypass the palette: BootStates `LoadingScreen` ActivityIndicator `color="#555"` -> `Colors.dark.accent`; `loadingText` `#666666` -> `Colors.dark.mutedText`; `errorText` `#c0392b` -> `Colors.dark.destructive`; `container` `backgroundColor: '#ffffff'` -> `Colors.dark.background`. Also fix any remaining hex in modal.tsx, +not-found.tsx, +html.tsx (route them through `Colors.dark.*`; +html.tsx sets the web document background — set it to void #0B0C0E via the token or the literal void value, since it is the one place a raw string is unavoidable for SSR).

    6. StyledText.tsx `MonoText` — change `fontFamily: 'SpaceMono'` to `'JetBrainsMono_500Medium'` so the shared mono helper matches the design system.

    7. Tab bar ((tabs)/_layout.tsx) — active tint = volt (already `accent`), inactive = ash (already `tabIconDefault`), `tabBarStyle.backgroundColor` = carbon (`surface`), and add a hairline top border: `borderTopColor: Colors[colorScheme].border, borderTopWidth: 1`. For the Home tab icon, replace the `house.fill` SF Symbol with the Apsis plate mark image (`require('../../assets/images/apsis-plate-mark.png')`) rendered in an `Image` tinted with the `color` param (`tintColor: color`, width/height 28) so it reads volt when active — per the design brief's "plate mark on the home tab". Leave Log/Settings as SF Symbols.

    8. Corner radii — where components hardcode `borderRadius: 12` (BootStates buttons, etc.), switch to `Radius.lg` (10) or `Radius.md` (8) from theme.ts for the sharp-not-pillowy look.

    9. One-accent rule — do not let volt and molten appear as competing fills in the same view. Readiness/alert uses molten; everything "go/primary" uses volt. If a screen shows both, keep molten reserved for the warning/alert element only.

    Do NOT change component logic, props, data flow, or the onboarding keyboard/unit blocker — style only. Do NOT add new hex literals; pull from `Colors.dark.*` and `Typography`/`Mono`/`Radius`.
  </action>
  <verify>
    <automated>cd apps/mobile && ! grep -rns '3E8EF7\|#3e8ef7' app components && ! grep -rns "fontFamily: 'SpaceMono'" components && ! grep -rns 'color="#555"\|#666666\|#c0392b' components/BootStates.tsx && grep -q 'onAccent' components/BootStates.tsx && grep -q 'apsis-plate-mark' 'app/(tabs)/_layout.tsx' && grep -q 'Mono' components/session/SetRow.tsx && echo SWEEP_OK</automated>
    <automated>cd apps/mobile/../.. && pnpm run typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>No blue hex remains under app/ or components/; every volt-filled CTA label uses `onAccent`; data/metric text uses the Mono role; the Home tab shows the plate mark; the shared MonoText helper uses JetBrains Mono; `pnpm run typecheck` passes.</done>
</task>

<task type="auto">
  <name>Task 3: Wire the Apsis app icon and dark splash; reconcile the stray root app.json</name>
  <files>apps/mobile/assets/images/icon.png, apps/mobile/assets/images/splash-icon.png, apps/mobile/assets/images/favicon.png, apps/mobile/assets/images/apsis-plate-mark.png, apps/mobile/app.json, app.json</files>
  <action>
    Wire the brand assets from `apsis_icon_pack/` (repo root) into the mobile app.

    1. Copy the icon assets into apps/mobile/assets/images (overwrite the placeholder files so app.json paths keep working):
       - `apsis_icon_pack/png/apsis_icon_1024.png` -> `apps/mobile/assets/images/icon.png` (the iOS app icon).
       - `apsis_icon_pack/png/apsis_icon_1024.png` -> `apps/mobile/assets/images/splash-icon.png` (or use `apsis_mark_1024.png` if a bare-mark splash reads better on void).
       - `apsis_icon_pack/png/apsis_icon_256.png` -> `apps/mobile/assets/images/favicon.png`.
       - `apsis_icon_pack/png/apsis_mark_512.png` -> `apps/mobile/assets/images/apsis-plate-mark.png` (the in-app home-tab mark referenced by Task 2 rule 7). Use a transparent-background mark PNG so `tintColor` works.
       On Windows use the Bash tool with `cp` and forward-slash absolute paths.

    2. apps/mobile/app.json — dark-theme the launch chrome (D design-system: void everywhere):
       - `expo.splash` / the `expo-splash-screen` plugin `backgroundColor`: `#ffffff` -> `#0B0C0E` (void).
       - `expo.android.adaptiveIcon.backgroundColor`: `#E6F4FE` -> `#0B0C0E` (void).
       - Leave `expo.icon` path as `./assets/images/icon.png` (the file was replaced in step 1). Leave bundleIdentifier `com.apsis.app` as-is.

    3. Stray root app.json — the root-level `app.json` (repo root, bundleId `com.apsistraining.apsis`) is misplaced; the authoritative config the Expo build reads is `apps/mobile/app.json`. Delete the root `app.json` to remove the ambiguity. Before deleting, note in the SUMMARY the bundleIdentifier discrepancy (root `com.apsistraining.apsis` vs mobile `com.apsis.app`) so the developer can confirm which bundle id is intended for the App Store — do not silently change the mobile bundle id.

    Do NOT run `expo prebuild` here (the icon is picked up on the next dev/EAS build); this task only wires config + assets.
  </action>
  <verify>
    <automated>cd apps/mobile && test -f assets/images/icon.png && test -f assets/images/apsis-plate-mark.png && grep -q '0B0C0E' app.json && ! grep -q 'E6F4FE' app.json && ! grep -q '#ffffff' app.json && test ! -f ../../app.json && echo ICON_OK</automated>
  </verify>
  <done>The new Apsis icon + plate mark are in apps/mobile/assets/images; app.json splash and android backgrounds are void; the stray root app.json is removed and its bundleId discrepancy noted in the SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry -> build | New font packages pulled from npm at install time |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QMV-SC | Tampering | `@expo-google-fonts/archivo`, `@expo-google-fonts/jetbrains-mono` installs | low | accept | Both are official Expo-maintained packages (expo.dev org, millions of weekly downloads, OFL-licensed fonts). Installed via `npx expo install` so versions resolve against the pinned SDK 56 lockfile. No `[ASSUMED]`/`[SUS]` packages — legitimacy verifiable on npmjs.com/package/@expo-google-fonts/archivo. No blocking checkpoint required. |
</threat_model>

<verification>
- `pnpm run typecheck` passes from repo root (no type regressions from token/font/style edits).
- Zero occurrences of the old blue `#3E8EF7` anywhere under `apps/mobile/app` or `apps/mobile/components`.
- `Colors.ts` carries the full void/volt palette including new `steel` and `onAccent` keys.
- Both `@expo-google-fonts/*` packages present in `apps/mobile/package.json`; `_layout.tsx` gates the splash on `useFonts`.
- `apps/mobile/assets/images/icon.png` is the new Apsis icon; splash + android backgrounds are void `#0B0C0E`; stray root `app.json` removed.
</verification>

<success_criteria>
- Every app surface (onboarding wizard, tab shell + tab bar, lifting logger session/set-rows/rest banner/finish/breakdown, settings, resume prompt, boot states) renders on void with volt as the single accent — no blue remains.
- Primary CTAs are volt fill with void text; HSS/hero numbers use Archivo Expanded (heavy) in volt; data/metrics/units/timestamps use JetBrains Mono.
- The iOS app icon is the Apsis plate mark; splash and android backgrounds are void; the Home tab shows the plate mark.
- `pnpm run typecheck` passes and the app boots to the restyled UI.
</success_criteria>

<output>
Create `.planning/quick/260709-qmv-restyle-app-ui-to-apsis-dark-design-syst/260709-qmv-SUMMARY.md` when done.
</output>