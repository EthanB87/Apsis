# Apsis Design System — Implementation Contract

> Source of truth for all UI work. Supersedes prior component-level specs where they
> conflict (including per-phase UI-SPEC set-row details). Provided by Ethan 2026-07-10.
> Companion artifacts: `apsis_claude_design_prompt.md` (the Claude Design prompt that
> produced this system), `Apsis Design System.dc.html` (visual reference).
> Build tokens first, then components, then screens.

You are building **Apsis**, a hybrid athlete training app (React Native + Expo) for people who both lift and run. It logs both training types and computes a single **Hybrid Stress Score (HSS)**. Implement the design system below exactly — it is the source of truth for all UI work. Build tokens first, then components, then screens.

## Brand voice

Dark, instrument-panel aesthetic. Black is the canvas; volt green is the signal. Exactly **one** accent draws the eye per view — usually the score or the primary action. Numbers should read like telemetry, not like a lifestyle app. Crisp, not pillowy.

## 1. Color tokens

Create a single theme file (e.g. `src/theme/colors.ts`) — never hardcode hex values in components.

| Token | Hex | Use |
|---|---|---|
| `void` | `#0B0C0E` | Primary background |
| `carbon` | `#15171A` | Card / surface |
| `steel` | `#1F2329` | Raised surfaces, inactive tracks |
| `line` | `#2A2F36` | Hairline borders |
| `volt` | `#C6F23D` | ACCENT — HSS, CTAs, go/ready states, PRs |
| `molten` | `#FF5A1F` | Alerts, heat, overreaching, stop |
| `amber` | `#CDBE4A` | Caution readiness state |
| `ash` | `#8A9098` | Secondary text, metadata |
| `bone` | `#F2F1EC` | Primary text (off-white) |

Readiness maps to color: **READY → volt · CAUTION → amber · OVERREACHING → molten**. Volt is rationed: one volt-filled element per screen (the score or the primary button). Molten is reserved strictly for warnings.

## 2. Typography

Three voices, loaded via `expo-font` / `@expo-google-fonts`:

- **Archivo Expanded** (800–900) — display and big numbers. UPPERCASE, letter-spacing `-0.01em` to `-0.02em`, tight line-height (~0.86–0.95). Sizes: hero/HSS ≈ 68, H2 ≈ 30, H3 ≈ 22.
- **Archivo** (400–600) — UI and body copy. Line-height ~1.55.
- **JetBrains Mono** (400–500) — ALL data/telemetry: scores, paces, metadata lines, axis labels, timestamps. Wide tracking (0.2–0.34em) on uppercase mono labels, e.g. `HSS 68 · ATL 41 · CTL 55 · READY ▸ TRAIN`, `TUE · 05:42`, `5:30 /KM`, `RPE 8 · ×5`.

Rule: if it's a number or metadata, it's mono. If it's a headline or hero number, it's Archivo Expanded uppercase. Everything else is Archivo.

## 3. Spacing, radius, elevation

- Spacing scale, base 4: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48 · 4xl 64`.
- Corner radius stays small and sharp: `btn 6 · card 8 · sheet 10 · pill 9999`. Nothing pillowy.
- Elevation: prefer **hairline borders (`line`, 1px)** over shadows. Use a deep shadow only for sheets/modals.
- Optional ambient background: subtle radial glow at top of screen — `radial-gradient(circle at 50% -8%, rgba(198,242,61,0.06), transparent 52%)` equivalent (use an absolutely-positioned gradient or SVG in RN).

## 4. Logo / mark ("Plate-orbit")

A barbell plate in tilted perspective (rotated ~-30°, drawn as nested ellipses in bone `#F2F1EC`) is the orbit; a volt runner glyph laps it (slow continuous orbit animation, ~6s linear infinite). Plate = strength, runner = endurance, tilt = motion. Plate is bone on dark (or black on light); the runner is **always volt**. App icon shrinks on a ladder: full plate → simplified bevel → stride glyph at smallest sizes. Wordmark: `APSIS` in Archivo Expanded 900 uppercase with a volt period: `APSIS.`

## 5. Components

**Buttons**
- Primary: volt fill, void text, radius 6, Archivo semibold. **One primary per view.** Pressed = slightly darker volt; disabled = steel fill, ash text.
- Secondary: ghost — transparent fill, 1px `line` border, bone text.
- Icon buttons allowed. Minimum 44px hit target everywhere.

**HSS ring (hero metric)**
- ~200px SVG circle, steel track, volt progress stroke; ring **fills on load** (animated stroke-dashoffset) while the number **counts up**. Big volt number in Archivo Expanded, mono label `HYBRID STRESS` beneath.
- Smaller 84px variant for per-session rings.
- Readiness status light below the ring: `PRIMED · GREEN LIGHT` (volt) / `CAUTION · HOLD STEADY` (amber) / `OVERREACHING · RED ZONE` (molten) — dot + mono label, dot can pulse.

**Stat tiles**
- Big Archivo Expanded number (with a small unit suffix, e.g. `12.4t`, `38.6km`), mono label under it (`TONNAGE · WK`, `MILEAGE · WK`, `ATL · ACUTE`, `CTL · CHRONIC`). Carbon card, hairline border, radius 8.

**Session rows**
- Title (Archivo semibold) + mono metadata line (`LOWER · 6 LIFTS · RPE 8`, `6.2 KM · 5:30 /KM · 142 BPM`) + session HSS number right-aligned in volt mono/expanded.

**Inputs**
- Text field: carbon fill, hairline border, mono uppercase floating label (`EXERCISE`), volt border on focus. Placeholder in ash.
- Segmented control: `LIFT / RUN / NOTE` — steel track, active segment volt (or bone) with void text.
- Steppers for LOAD KG / REPS / RPE: big mono value, +/- buttons, 44px targets. Logging must feel faster than incumbent apps — minimal taps.
- Run-type chips: `Z2 · TEMPO · INTERVALS · LONG` — pill radius, ghost by default, volt fill when selected.

**Charts (load trend)**
- Acute (ATL) vs chronic (CTL) over 6 weeks. Telemetry styling: mono axis labels (`W-5 … NOW`), steel gridlines, volt primary line, ash/secondary line for the other series. No chart junk.

**Bottom nav**
- 5 tabs: `TODAY · LOG · TRENDS · HISTORY · PROFILE`, mono uppercase labels, plate mark anchors the home tab. Active = volt icon+label, inactive = ash. Void background, hairline top border.

## 6. Screens

Build these from the components above — no one-off styles:

1. **Home / Today (hero HUD):** mono timestamp (`TUE · 05:42`), greeting (`LET'S WORK` in Archivo Expanded), 200px HSS ring with count-up + readiness light, then `TODAY · 2 SESSIONS` list of session rows.
2. **Log a lift:** segmented control (LIFT active), exercise field, set rows (each: load KG / reps / RPE steppers), `+ Add set` ghost button, `SESSION STRESS — PROJECTED HSS +42` footer, volt `Save session` button.
3. **Log a run:** segmented control (RUN active), distance/duration/avg pace/avg HR fields, run-type chips, projected HSS footer, volt `Save run`.
4. **Trends:** ATL vs CTL chart (6 wk), readiness stat tiles: `41 ATL · 55 CTL · .74 RATIO`.
5. **Session detail:** header (mono timestamp + duration), title, 84px session ring, per-exercise breakdown rows with HSS contribution, `CONTRIBUTION TO DAY 42 / 68` footer.
6. **Onboarding paywall:** `REFUSE TO CHOOSE.` display headline, three benefit rows (Unified Hybrid Stress Score / Daily readiness verdict / Acute vs chronic load) each with icon + mono sub-label, plan card (`7 DAYS FREE`, `ANNUAL · $59.99 ≈ $5/MO`), volt `Start free trial`, mono footer links `RESTORE · TERMS · PRIVACY`.

## 7. Hard rules

- No hardcoded colors, fonts, spacing, or radii — tokens only.
- One volt-filled element per screen. Molten only for warnings/overreaching.
- All numbers and metadata in JetBrains Mono; all display text uppercase Archivo Expanded.
- Hairline borders instead of shadows (except sheets).
- Radius never exceeds 10 except pills.
- 44px minimum hit targets.
- Rings animate fill + count-up on mount; keep animations under ~800ms except the logo orbit.
- Dark theme only (void background) — no light mode for v1.

---

## Phase applicability notes (GSD)

- **Phase 3 surfaces (now):** tokens, buttons, inputs, steppers, set rows, session logging screens, onboarding, tab bar styling of existing tabs, settings.
- **Phase 4 surfaces (later):** Home/Today hero HUD + HSS ring, run logging screen, trends chart, session rows on home, TRENDS/HISTORY tabs.
- **Out of v1.0 scope:** onboarding paywall / pricing (no payments in v1.0 per PROJECT.md), marketing wordmark usage beyond app icon. Logo orbit animation is nice-to-have, not gating.
