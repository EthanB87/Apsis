# Claude Design Prompt — Apsis Design System

> Paste everything below the line into Claude Design. It is written to produce a **design system** (tokens + components + key screens), not a single mockup. The output becomes the visual contract that Claude Code builds against, so it should be specific, reusable, and consistent.

---

## ROLE & GOAL

You are designing the mobile UI **design system** for **Apsis** — an iOS-first fitness app for **hybrid athletes** (people who both lift weights and run, and refuse to choose between the two). Apsis logs lifting and running in one place and computes a single **Hybrid Stress Score (HSS)** plus a daily **readiness** state, so the athlete knows how hard they actually trained and whether to push or recover today.

Your job is to deliver a cohesive, premium, distinctive design system: color and type tokens, core reusable components, and a set of key screens that establish every important pattern. Everything must feel like **one product**, not a collection of screens. Prioritize consistency, reusability, and a strong, ownable visual identity over decoration.

## BRAND DIRECTION — "PERFORMANCE INSTRUMENT, NOT A DIARY"

The aesthetic is **gym-tech / hybrid-athlete performance** — think the Austin hybrid-coach, Bare Performance Nutrition, blacked-out-with-one-accent world. Clean and disciplined, but kinetic and a little aggressive. The app should feel like a **performance instrument / HUD readout**, not a soft wellness app and not a cluttered gym-bro tracker. Restraint is the brand: lots of black space, one high-voltage accent used like a weapon, numbers that read like telemetry.

Hard rule: **never neon-overload, never more than one accent competing in a single view.** Black is the canvas; volt is the signal.

## COLOR TOKENS (use these exact values)

- `--void` `#0B0C0E` — primary background (near-black)
- `--carbon` `#15171A` — card / surface
- `--steel` `#1F2329` — raised surface, inactive track
- `--line` `#2A2F36` — hairline borders, dividers
- `--bone` `#F2F1EC` — primary text / off-white
- `--ash` `#8A9098` — secondary / muted text, metadata
- `--volt` `#C6F23D` — PRIMARY ACCENT (acid lime): the HSS number, CTAs, active states, "go/ready", PRs, data highlights
- `--molten` `#FF5A1F` — ALERT/HEAT accent (orange): overreaching, red-zone readiness, warnings, "stop"

Readiness states map to color: **green/ready → volt**, **amber/caution → a muted yellow-green**, **red/overreaching → molten**. Use color sparingly and meaningfully — volt should draw the eye to exactly the thing that matters on each screen (usually the score or the primary action).

## TYPOGRAPHY (use these exact families)

- **Display / headlines / big numbers:** `Archivo Expanded` — weight 800–900, ALL CAPS, tight letter-spacing (~-0.01em). Use for the HSS value, screen titles, section headers, big stat numbers.
- **Body / UI / labels:** `Archivo` — weights 400–600. Buttons, body copy, list items.
- **Data / stats / metadata / telemetry:** `JetBrains Mono` — weight 400–500, often uppercase with wide letter-spacing (~0.1–0.2em). Use for metrics (HSS 68 · ATL 41 · CTL 55), timestamps, units, splits, set/rep data, tags. This mono-for-data rule is core to the identity — numbers must look like instrument readouts.

## LOGO / MARK

The brand mark is a **barbell plate shown in tilted perspective (an ellipse at ~30°) whose rim opens at the top and throws off volt-green motion streaks that resolve into a small sprinting figure** — strength (plate) + endurance (runner) fused into one continuous shape. Plate body is bone/white; the motion trail and runner are volt. There's a center sleeve hole in the plate. At small sizes (nav, favicon) it simplifies to the plate-ring + a volt stride glyph. Use a placeholder that captures this (tilted ring + volt trail + small runner) wherever the logo appears; keep it monochrome-volt-on-void in nav.

## SHAPE / TEXTURE LANGUAGE

- Small corner radii (≈6–10px on cards/buttons) — sharp, not pillowy. The app icon itself uses the iOS superellipse, but in-app surfaces are crisp.
- Hairline borders (`--line`) on cards rather than heavy shadows. If you use a shadow, keep it deep and subtle (large blur, low opacity, near-black) — no soft drop shadows.
- A subtle radial glow of volt at very low opacity behind the hero number is allowed (sparingly) to give the HUD feel.
- Generous negative space. Let the score and the primary action breathe.

## CORE CONCEPTS THE UI MUST EXPRESS

- **HSS (Hybrid Stress Score):** the hero number. One score, per session and per day, combining lifting + running stress on one scale. Shown big, in Archivo Expanded, in volt, often inside a progress ring.
- **Readiness:** a green/amber/red state (ready / caution / overreaching) with a short label like "PRIMED · GREEN LIGHT." Drives a status-light treatment.
- **Load trend:** acute vs chronic load over time (think a clean line/area chart) — telemetry styling, mono labels.
- **Logging:** fast entry for a lift (exercise → sets: load / reps / RPE) and a run (distance / duration / pace / HR). Speed and low friction are paramount — logging must feel faster than the incumbents.

## DELIVERABLES (produce all of these)

**1. Foundations board**
- The full color palette as swatches with names + hex + usage note.
- Type scale: show Archivo Expanded display sizes, Archivo body sizes, JetBrains Mono data styles — each with a real example string (e.g. a headline, a paragraph, "HSS 68 · ATL 41 · CTL 55 · READY ▸ TRAIN").
- Spacing scale and corner-radius tokens.
- The logo mark in primary (volt on void), reversed (on volt), and mono.

**2. Core components (in default + active/pressed/disabled where relevant)**
- Primary button (volt fill, void text), secondary button (outline/ghost), icon button.
- Card / surface (carbon with hairline border).
- The **HSS ring** — circular progress with the big volt number centered and a mono caption beneath.
- **Readiness pill / status light** in all three states (volt / muted-yellow-green / molten) with a dot + mono label.
- **Stat tile** — a small metric block: big Archivo-Expanded number + mono label (used for tonnage, mileage, ATL/CTL, etc.).
- **Session row** — a list item for a logged workout: title (Archivo 600), mono metadata line (e.g. "LOWER · 6 LIFTS · RPE 8"), and the session's HSS value on the right.
- Input field, stepper/number input (for load/reps), segmented control, tab bar (bottom nav with the plate mark on the home tab), tag/chip (for run types: Z2, tempo, intervals).
- Line/area chart styling for the load trend (mono axis labels, volt line, steel gridlines).

**3. Key screens (high-fidelity, using the components above)**
- **Home / Today** — greeting in mono ("TUE · 05:42") + Archivo-Expanded line ("LET'S WORK"), the big HSS ring, the readiness status line, and today's logged sessions as session rows. This is the hero screen; make it feel like a HUD.
- **Log a lift** — fast set entry: exercise name, then rows of load / reps / RPE with steppers; an "add set" affordance; running session-stress preview.
- **Log a run** — distance / duration → pace, optional HR, a run-type chip selector.
- **Trends / load** — the acute-vs-chronic load chart over time, readiness history, key stat tiles.
- **Workout / session detail** — breakdown of one session with its HSS, the sets or splits, and its contribution to the day.
- (Optional if time) **Onboarding paywall** — captures bodyweight/sex/thresholds, presents the value, and a 7-day-trial → annual plan CTA. Premium, confident, not pushy.

## INTERACTION  & MOTION NOTES (describe, for handoff)

- The HSS ring should feel like it "fills" on load; the number can count up. The logo's motion trail can draw on.
- Transitions are quick and crisp (no slow fades). The product should feel fast — matching the "logging is faster than the competition" promise.
- Haptic-worthy moments: logging a set, hitting a PR, completing a session.

## OUTPUT FORMAT

- Organize as a scrollable design-system board: Foundations → Components → Screens, clearly labeled.
- Keep it a true **system** — components defined once, then reused in the screens so they're visibly the same elements.
- Annotate where useful (token names, usage rules) so it can be handed to Claude Code as a spec.
- Default to **dark theme** (void background) everywhere. Do not produce a light-theme version unless asked.

## DO NOT

- Do not make it look like a generic wellness/meditation app (no soft pastels, no rounded blobby everything, no sage-spa palette).
- Do not use more than the two accents; never let volt and molten fight in the same view.
- Do not clutter screens — one clear focal point each (usually the score or the primary CTA).
- Do not use stock-fitness clichés (no flexing-bicep icons, no flame emojis as UI).
- Do not introduce new fonts or colors outside the tokens above.

---

### One-line summary to lead with (optional, if the tool wants a short brief first)
"Design a dark, premium iOS design system for **Apsis**, a hybrid-athlete training tracker — blacked-out (`#0B0C0E`) with a single acid-volt accent (`#C6F23D`), Archivo Expanded for big numbers, JetBrains Mono for telemetry-style data, centered on one hero metric (the Hybrid Stress Score) and a green/amber/red readiness state. Performance instrument, not a wellness diary."
