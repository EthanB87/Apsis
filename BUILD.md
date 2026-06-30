# CONCURRENT — Hybrid Athlete Tracker · Build Spec for Claude Code

> **Read this whole file before writing any code.** This is the authoritative build
> brief. The companion document `hybrid_app_brief.docx` has the full product/market
> reasoning; this file is the executable plan. When the two disagree, **this file wins**
> for build decisions.

---

## 0. Mission & hard constraint

Build the MVP of a **hybrid-athlete training tracker** and submit it to the Apple App Store
**by end of July 2026**. Today is late June. That is ~4 weeks. **Scope discipline is the
single most important thing.** When in doubt, cut scope, don't add it.

The product's one defensible idea: log **lifting and running in one app**, compute **one
unified training-load number** (Hybrid Stress Score / HSS), and show a **readiness trend**.
Everything else is secondary.

### What "MVP for App Store" means here (LOCKED)
The submittable v1.0 is **four things only**:
1. Log a lifting session (exercises, sets, reps, load, RPE).
2. Log a run / conditioning session (distance, duration, pace, HR if available).
3. See a per-session and per-day **HSS**, plus a **readiness band** (green/amber/red).
4. Apple **HealthKit** import for runs/HR/weight + push workouts back.

### Explicitly CUT from v1.0 → fast-follow (v1.1, August)
- ❌ Nutrition / macro tracking (the whole Phase 3 in the docx). **Do NOT build it for v1.0.**
- ❌ Garmin integration (HealthKit only for launch).
- ❌ Programming/coaching, social, coach dashboards, hydration.
- ❌ Android (React Native keeps the door open, but **ship iOS first**).

> If the timeline slips, cut #4 (HealthKit) to fast-follow before you cut #1–#3.
> A working offline logger + HSS is the minimum lovable product.

---

## 1. Tooling: GSD workflow

This project uses **gsd** (get-stuff-done) to drive Claude Code. Operate in this loop:

1. **Plan** — At the start of each phase, read the relevant section here, restate the
   phase's acceptance criteria, and produce a short task list. Do not start coding until
   the plan is written down.
2. **Build** — Implement the smallest vertical slice that satisfies an acceptance
   criterion. Prefer working software over breadth.
3. **Verify** — Run tests/typecheck/lint after every meaningful change. Never mark a task
   done on a red build.
4. **Checkpoint** — Commit with a clear message, update `PROGRESS.md` (see §7), and stop
   to summarize before moving on.

**Rules of engagement for the agent:**
- Ask before introducing any dependency not listed in §3. Justify it in one sentence.
- Never touch App Store credentials, signing certs, or secrets — surface those as
  manual steps for the human (Ethan) in `PROGRESS.md`.
- If a phase's acceptance criteria can't be met within its time box, **stop and flag it**
  rather than silently expanding scope.
- Keep the **engine package pure** (§4). No React, no I/O, no dates-from-`Date.now()`
  inside it — pass time in. This is the IP; it must stay testable.

---

## 2. Architecture (locked for v1.0)

```
apps/
  mobile/            React Native (Expo) — iOS-first
packages/
  engine/            Pure TypeScript: HSS + readiness. NO UI, NO I/O. <-- the moat
  db/                Local SQLite schema + data access (WatermelonDB or op-sqlite + drizzle)
  shared/            Types shared across engine/db/mobile
```

- **Local-first.** All logging works fully offline. SQLite is the source of truth on
  device. No backend is required for v1.0 to function — a server is a v1.1 concern
  (sync/backup). Do NOT build a backend during the App Store push unless §6 says so.
- **Engine runs on-device** so HSS updates instantly when a set is logged. This instant
  feedback loop is the product; protect it.
- **Monorepo** via a simple workspace (pnpm or npm workspaces). Don't over-engineer the
  build tooling.

---

## 3. Approved dependencies

Use these; ask before adding others.

| Concern | Choice |
|---|---|
| App framework | Expo (React Native), TypeScript, expo-router |
| Local DB | op-sqlite + drizzle-orm  *(or WatermelonDB if reactive models preferred)* |
| State | Zustand (light) or React Query for async; avoid Redux |
| Health | `@kingstinct/react-native-healthkit` (or Expo HealthKit module) |
| Charts | victory-native or react-native-svg-charts (readiness/load trend) |
| Forms/inputs | plain RN components; keep logging UI hand-built for speed |
| Testing | vitest (engine + db logic), maybe react-native-testing-library for a few flows |
| Lint/format | eslint + prettier, strict tsconfig |

No backend stack is selected for v1.0 on purpose. (For v1.1 sync, the docx recommends
.NET or tRPC + Postgres on Azure — defer.)

---

## 4. The engine package — build this FIRST (Phase 0)

`packages/engine` is pure functions. Everything time-based is passed in as an argument.
Ship literature-default constants in a versioned `config` object so they can be tuned
without code changes.

### 4.1 Public API (implement exactly these signatures)

```ts
// types live in packages/shared
export interface StrengthSet {
  loadKg: number;        // working load
  reps: number;
  rpe: number;           // 1..10, proximity to failure
  e1rmKg: number;        // estimated 1RM for this lift (from profile)
  isLowerBody: boolean;  // drives leg multiplier
  isWarmup: boolean;     // warmups excluded from stress
}

export interface EnduranceSegment {
  durationS: number;
  // intensity factor: workHR/thresholdHR OR pace/thresholdPace, caller-resolved
  intensityFactor: number; // ~0.5..1.2
}

export interface EngineConfig {
  kStrength: number;     // scales SS onto HSS axis      (default below)
  kEndurance: number;    // scales ES onto HSS axis
  legMultiplier: number; // systemic cost of heavy lower-body work
  doublePenalty: number; // same-day 2nd-session compounding (e.g. 1.1)
  atlDays: number;       // acute time constant  (default 7)
  ctlDays: number;       // chronic time constant (default 28)
}

export const DEFAULT_CONFIG: EngineConfig; // see 4.3

// --- core functions ---
export function strengthStress(sets: StrengthSet[], cfg?: EngineConfig): number;
export function enduranceStress(seg: EnduranceSegment, cfg?: EngineConfig): number;

export function sessionHSS(
  input: { strengthSets?: StrengthSet[]; enduranceSegments?: EnduranceSegment[] },
  cfg?: EngineConfig
): number;

// daily rollup: sum sessions, apply double penalty when >1 session that day
export function dailyHSS(sessionScores: number[], cfg?: EngineConfig): number;

// exponentially-weighted load from a chronological array of daily HSS values
export function computeLoadTrend(
  dailyHSSByDay: number[], // oldest -> newest, one per calendar day (0 for rest)
  cfg?: EngineConfig
): { atl: number; ctl: number; tsb: number }; // tsb = ctl - atl

export function readinessBand(tsb: number, ctl: number):
  'green' | 'amber' | 'red';
```

### 4.2 Formulas (starting point — must be unit-tested)

- **Endurance:** `ES = durationMin * intensityFactor^2 * kEndurance`
- **Strength (per working set):**
  `setStress = (loadKg / e1rmKg) * reps * rpeFactor`
  where `rpeFactor = rpe / 10`. Sum sets; multiply lower-body sets by `legMultiplier`.
  Then `SS = sumSetStress * kStrength`.
- **Session HSS:** `ES + SS` (a session may have either or both).
- **Daily HSS:** sum of session HSS; if >1 session, multiply the day total by `doublePenalty`.
- **ATL/CTL:** exponentially-weighted averages of daily HSS with time constants
  `atlDays` / `ctlDays`. **TSB = CTL − ATL.**
- **Readiness band:** start with thresholds on TSB normalized by CTL (e.g. red when
  TSB is strongly negative relative to CTL, green when neutral/positive). Encode the
  thresholds as named constants so they're easy to tune.

### 4.3 Default constants (tune later; just get sane numbers)
Pick defaults so a typical hard session lands in a readable HSS range (aim ~30–120 per
hard session). Suggested starting values to calibrate from:
`kEndurance ≈ 1.0`, `kStrength ≈ 2.0`, `legMultiplier ≈ 1.3`, `doublePenalty ≈ 1.1`,
`atlDays = 7`, `ctlDays = 28`. **Adjust kStrength/kEndurance so a 60-min threshold run
and a hard 5x5 squat session produce comparable HSS** — write a test that asserts they're
within a sensible ratio, then tune the constants to pass it.

### 4.4 Engine acceptance criteria (Phase 0 done when ALL true)
- [ ] All functions implemented with the exact signatures above.
- [ ] ≥ 20 unit tests incl. golden cases (a known lift session, a known run, a double day,
      a rest week decaying ATL/CTL correctly).
- [ ] A calibration test asserting threshold-run HSS ≈ hard-lift HSS within a chosen ratio.
- [ ] Zero dependencies in `packages/engine` (pure TS). `vitest` green. `tsc --noEmit` green.
- [ ] A short `packages/engine/README.md` documenting each formula and constant.

---

## 5. Data model (v1.0 local SQLite subset)

Only the training side. **No nutrition tables in v1.0.** Use UUID ids, store timestamps
UTC, and a `localDate` (YYYY-MM-DD) on workouts for daily rollups.

```
user_profile (single row for v1.0 — no auth needed at launch)
  id, sex, birthDate, units, thresholdHr, thresholdPaceSecPerKm

exercise
  id, name, category, isLowerBody, defaultUnit
  -- seed a starter list (squat, deadlift, bench, OHP, lunge, sled, etc.)

workout
  id, localDate, type('lift'|'run'|'erg'|'conditioning'),
  startedAt, durationS, hss, source('manual'|'healthkit')

strength_set
  id, workoutId, exerciseId, setIndex, loadKg, reps, rpe, e1rmKg, isWarmup

endurance_segment
  id, workoutId, distanceM, durationS, avgHr, avgPaceSecPerKm, intensityFactor, tag

load_daily   -- derived; recomputed on write
  localDate, dayHss, atl, ctl, tsb, readinessBand
```

e1RM per lift can be stored on the profile as JSON or derived from logged top sets;
simplest path for v1.0: estimate e1RM from the heaviest logged set via Epley and cache it.

**Acceptance:** schema migrations run clean on a fresh install; seeding the exercise list
works; logging a workout writes sets/segments and triggers a `load_daily` recompute.

---

## 6. Phased plan with time boxes (≈4 weeks)

> Dates assume start ~June 30. Adjust but **keep the App Store submission target ~July 28**
> to leave review buffer before end of month.

### Phase 0 — Engine (Days 1–4)
Build `packages/engine` + `packages/shared` per §4. Pure TS, fully tested. **No UI yet.**
This de-risks the entire thesis. Exit: §4.4 all checked.

### Phase 1 — Local logger (Days 5–13)
- Expo app scaffold, navigation, strict TS.
- `packages/db` SQLite schema (§5) + data access + seed exercises.
- **Lifting log flow**: pick exercise → add sets (load/reps/RPE) → save. Plate math + PR
  detection are nice-to-have, not blocking.
- **Run/conditioning log flow**: manual entry (distance/duration → pace; optional HR).
- On save, call engine → store session HSS → recompute `load_daily`.
- **Home screen**: today's HSS, the readiness band, and a 14–30 day load/readiness chart.
- Exit: a user can log a lift and a run fully offline and watch HSS + readiness update.
  This is the minimum lovable product — if everything after slips, this still ships.

### Phase 2 — HealthKit (Days 14–18)
- Read workouts/HR/bodyweight from HealthKit → map to `workout`/`endurance_segment`.
- Resolve `intensityFactor` from HR vs profile thresholds.
- Write logged workouts back to HealthKit.
- Exit: an Apple Watch run appears in-app with a computed HSS without manual entry.

### Phase 3 — Polish + ship (Days 19–28)
- Empty states, onboarding (capture sex/bodyweight/thresholds), settings, app icon,
  splash, units toggle.
- Crash/analytics (Expo + Sentry).
- **App Store prep** (human-in-the-loop, see §8): bundle id, screenshots, privacy
  nutrition labels (HealthKit usage strings!), TestFlight build, submit.
- Exit: build uploaded to App Store Connect and submitted for review by ~July 28.

> **Buffer reality:** if Phase 2 (HealthKit) runs long, push it to v1.1 and submit the
> offline-only logger. Apple review can take 1–3 days; don't submit on July 31.

---

## 7. Progress tracking

Maintain a `PROGRESS.md` at repo root. After every checkpoint, update:
- Current phase + % of acceptance criteria met.
- What was built since last checkpoint (1–3 bullets).
- **Blockers / human actions needed** (signing, certs, paid Apple Developer account,
  HealthKit entitlement, physical device for HealthKit testing).
- Next task.

Keep it short. It's a status board, not a journal.

---

## 8. Human-only steps (flag, don't attempt)

The agent must NOT try to do these — list them in `PROGRESS.md` for Ethan:
- Apple Developer Program enrollment ($99/yr) + App Store Connect app record.
- Signing certificates / provisioning profiles (use EAS — but credentials are Ethan's).
- HealthKit capability + entitlement on the bundle id.
- Real-device testing for HealthKit (simulator HealthKit is limited).
- Screenshots, app description, keywords, privacy policy URL, support URL.
- Final "Submit for Review" click.

---

## 9. Definition of Done (v1.0 / App Store)

- [ ] Engine: pure, tested, documented (§4.4).
- [ ] iOS app logs lifting + running offline; HSS + readiness update live.
- [ ] HealthKit import working on a real device (or consciously deferred to v1.1).
- [ ] Onboarding captures the inputs the engine needs (bodyweight, sex, thresholds).
- [ ] No red builds; `tsc --noEmit`, lint, and tests green in CI or pre-commit.
- [ ] TestFlight build verified on device.
- [ ] Submitted to App Store review on/before ~July 28, 2026.

---

## 10. Guardrails recap (read again before each phase)

1. **Cut before you add.** Nutrition, Garmin, Android, social, coaching = NOT v1.0.
2. **Engine stays pure.** It's the moat and the thing most likely to be reused/relicensed.
3. **Local-first, offline-always.** Logging never blocks on a network.
4. **Match incumbents on logging speed** (Strong/Hevy). Slow entry kills the habit.
5. **Ship the lovable core even if extras slip.** Offline logger + HSS > a feature-rich
   app that misses the App Store window.
