# Deferred Items — Phase 08 (share-card-social-overlay)

## TrendChart.tsx may share the ShareCardCanvas matchFont bug

**Discovered during:** 08-04 Task 3 UAT fix-forward (on-device rendering gap diagnosis).

**Issue:** `ShareCardCanvas.tsx`'s missing-text bug (all Skia `<Text>` elements blank on-device)
was root-caused to `matchFont({ fontFamily: 'Archivo_900Black', ... })` resolving fonts through
Skia's SYSTEM font manager (`Skia.FontMgr.System().matchFamilyStyle`), which cannot see fonts
registered only via `expo-font`'s `useFonts()` (a React-Native-bridge-only alias, invisible to
Skia's native font manager). `apps/mobile/components/home/TrendChart.tsx` uses the exact same
`matchFont({ fontFamily: 'JetBrainsMono_500Medium', ... })` pattern for its x-axis labels
(`axisFont`), guarded by the same try/catch. It is plausible the trend chart's axis date labels
have never actually rendered on-device either — the chart's two data lines (ATL/CTL, no font
dependency) would still draw and look "correct enough" that a missing small axis label row
could go unnoticed in casual UAT.

**Why deferred, not auto-fixed:** `TrendChart.tsx` is outside this task's `<files>` scope
(`apps/mobile/components/share/ShareCardCanvas.tsx`, `apps/mobile/app/session/share.tsx`,
`apps/mobile/lib/shareCardExport.ts` — the 08-04 plan's `files_modified`). Fixing it belongs to
whichever phase/plan owns `TrendChart.tsx` (phase 04, per its file header).

**Suggested fix (same pattern as this fix):** replace `matchFont({ fontFamily:
'JetBrainsMono_500Medium', fontSize: AXIS_FONT_SIZE })` with `useFont(JetBrainsMono_500Medium,
AXIS_FONT_SIZE)`, importing the raw TTF asset module directly from
`@expo-google-fonts/jetbrains-mono` (same as the fix applied to `ShareCardCanvas.tsx` in commit
attached to this file's phase).

**Verification needed:** on next on-device pass through the home screen trend chart, confirm
whether the small "MON D" x-axis date labels beneath the ATL/CTL lines are actually visible.
