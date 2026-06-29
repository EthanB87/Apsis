# Feature Research

**Domain:** Hybrid-athlete training tracker (HYROX / tactical) — iOS, local-first
**Researched:** 2026-06-29
**Confidence:** MEDIUM (cross-checked across multiple web sources; no primary user interviews)

> Scope is HARD-LOCKED to four v1.0 features: (1) lifting session log, (2) run/conditioning
> session log, (3) per-session HSS + readiness band, (4) HealthKit import + write-back.
> Everything else is deliberately out. This document only analyses within that boundary.

---

## Feature Landscape

### Table Stakes — Lifting Session Logger

Features users (Strong/Hevy refugees) assume exist. Missing any of these = product feels
broken compared to what they already use.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Previous-session recall inline | Strong's #1 killer feature. Every set auto-populates with the exact weight + reps from the last identical exercise. Without this, athletes must remember or dig through history mid-workout. | LOW | Store `loadKg` + `reps` from last matching `exerciseId` per user. Display beneath the current set row. This is the single most impactful quality-of-life feature in lifting logging. |
| Set entry in ≤ 3 taps from exercise view | Users expect sub-3-second logging per set (Strong benchmark). Keyboard appearing for every field kills speed. | MEDIUM | Use steppers or a numeric row for weight/reps; RPE via a 5-button quick-row (6/7/8/9/10 only — values below 6 are rarely used by serious athletes). Minimize keyboard usage. |
| Auto-rest timer after set | Strong and Hevy both auto-start a configurable countdown when a set is marked complete. Athletes now expect the app to track rest — they are back under the bar mentally. | LOW | Simple countdown timer in a persistent banner. Configurable per-exercise or global default. |
| Seeded exercise library with fast search | Hevy ships 400+ exercises; Strong ships a large seeded list. Athletes need to find "Romanian Deadlift" or "Sled Push" in < 2 taps. | LOW | Seed the 30-40 most common HYROX/tactical movements (squat, deadlift, bench, OHP, lunge, sled push/pull, sandbag carry, KB swing, row, erg). Full-text search filters inline. No pagination needed at this scale. |
| Warmup set flag | Both Strong and Hevy support warmup sets excluded from volume/load tracking. Athletes warm up and expect warmup data not to pollute their work-set stats. | LOW | Toggle per-set: `isWarmup`. Engine already accounts for this (warmup sets excluded from `strengthStress`). |
| Add / remove sets inline | Tap + to add another set; swipe to delete. Standard in every incumbent. | LOW | Simple list mutation — no modal, no confirmation dialog for delete (swipe gesture is reversible). |
| Session save / discard with confirmation | Clear terminal action. Loss of data mid-workout is catastrophic for trust. | LOW | Sticky "Finish" CTA at bottom of session screen. Confirm on destructive discard only. |
| Offline-first, always | Gym basements and trails have no signal. Strong's reliability is cited as a key loyalty driver. Any network dependency in the logging path kills the daily habit. | LOW | Already architecturally guaranteed (SQLite local, no backend). Surfaces as a feature because incumbents with social/cloud sometimes fail mid-workout. |

### Table Stakes — Run / Conditioning Session Logger

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Manual distance + duration → pace auto-calculated | Strava's manual entry baseline. Athlete enters two fields; pace appears automatically. Making users calculate pace is unacceptable friction. | LOW | `paceSecPerKm = durationS / (distanceM / 1000)`. Display formatted (e.g., "5:12 /km"). Update live as fields change. |
| Activity type selection | Athletes distinguish runs, erg rows, and general conditioning. The engine has separate intensityFactor paths. | LOW | Simple picker: Run / Erg / Conditioning. Defaults to Run. |
| Optional average HR field | For HealthKit imports this is automatic; for manual entry it's optional. HR drives intensityFactor in the engine. | LOW | Single numeric field, optional. If blank, fall back to pace-based intensityFactor vs thresholdPace. |
| Session date defaults to today | Standard across all logging apps. Athletes log immediately after a session. | LOW | Editable date picker defaulting to today. |
| Units toggle (km ↔ miles) | iOS users in different markets expect both. Strong and Strava both support this. | LOW | Global setting stored in user_profile. Display-layer conversion only; always store in metric (metres/seconds) internally. |
| Session notes / tag field | Strava's "perceived effort / description" field. Athletes annotate race-pace intervals, terrain, etc. | LOW | Single free-text field, optional, stored as `tag` on `endurance_segment`. Keep simple — no rich text. |

### Table Stakes — HSS + Readiness Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session HSS visible on session summary | After logging any session, the athlete expects to see what it "cost" them. This is the core value proposition and must not require a separate navigation step. | MEDIUM | Compute and display HSS on the session finish screen. Engine call happens inline on save. |
| Today's readiness band prominently on home screen | Garmin's "Training Readiness" widget has trained users to expect a simple status indicator. Green/amber/red is universally legible and lowers cognitive load. | MEDIUM | Large coloured badge / pill on home screen. Must be the first thing visible without scrolling. |
| 14–30 day load trend chart | TrainingPeaks users and Garmin Connect users expect a trend line showing cumulative fatigue vs fitness over time. Without this the daily number has no context. | MEDIUM | Line chart (victory-native) showing ATL and CTL (or just TSB) over a rolling 28-day window. Tap to see individual day's HSS. |
| Per-day HSS on workout history | Athletes expect to see "what did I do this day" on a calendar or list. | LOW | Workout history list, grouped by date, showing day total HSS + session count. |

### Table Stakes — HealthKit Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Import runs from HealthKit / Apple Watch | Apple Watch users generate runs via the Workout app automatically. They will not manually re-enter runs they already have. This is the primary driver for HealthKit integration. | HIGH | Read `HKWorkoutActivityTypeRunning` workouts. Map distance, duration, avgHR to `endurance_segment`. Resolve intensityFactor from avgHR vs thresholdHR. Deduplicate against existing manual entries by comparing timestamp ranges. |
| Import bodyweight from HealthKit | Engine calibration uses bodyweight. Athletes using Apple Health for weight expect it to flow in. | MEDIUM | Read most-recent `HKQuantityTypeIdentifierBodyMass`. Pre-fill or update `user_profile.bodyWeight`. One-time import on onboarding + optional refresh. |
| Write logged workouts back to HealthKit | Athletes using Apple Health as a health record hub expect all their workouts to appear there. Strava and TrainRox both do this. Absence is noticed. | HIGH | Write `HKWorkout` entries for each logged session. For lifting: `HKWorkoutActivityTypeTraditionalStrengthTraining`. For runs: `HKWorkoutActivityTypeRunning`. Include duration, activeEnergyBurned (estimated), and distance for runs. |

---

### Differentiators — What No Incumbent Does Together

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified HSS — one number for lifting + running | Every incumbent is either a lift logger (Strong, Hevy, TrainHeroic) or a run logger (Strava) or a coaching platform (ROXFIT, HyTrack). None compute a single load number across both modalities in a free-form, offline log. This is the moat. | HIGH | Lives entirely in `packages/engine`. The calculation itself is straightforward; the moat is the concept, the calibration, and the data model that supports both modalities. |
| Readiness band on home screen — hybrid-aware | Garmin Training Readiness exists but requires Garmin hardware and ignores lifting stress. TrainingPeaks CTL/ATL/TSB exists but is endurance-only and paid. Apsis is the only app showing a readiness signal that genuinely accounts for both a 5x5 squat session and a tempo run. | MEDIUM | `readinessBand(tsb, ctl)` in the engine. The HSS normalisation (kStrength ≈ 2.0 ensures a hard 5x5 ≈ a threshold run in HSS units) makes the combined score meaningful. |
| Live HSS update as sets are logged | No incumbent shows fatigue cost mid-session. Athletes discover they are digging a hole they cannot recover from by the time they review their week. Real-time feedback can change the set 8 decision. | MEDIUM | Call `sessionHSS()` after each set is marked complete. Show the accumulating number in a session-level header. Requires engine to be callable synchronously in JS thread — already true (pure TS, no I/O). |
| Double-session fatigue penalty surfaced | When an athlete logs a second session in a day, the day HSS has a `doublePenalty` applied. Showing this explicitly ("Day total: 142 HSS — includes double-session penalty") makes visible something athletes know anecdotally but no tool communicates. | LOW | Simple label on day-view when `sessionCount > 1`. Engine already computes this in `dailyHSS()`. |
| Offline-always + instant local feedback loop | Every HYROX app with load scoring (HyTrack AI Load Balancer, ROXFIT visualisation) requires network. Apsis computes everything on-device. This is both a technical differentiator and a trust signal for athletes who train in basements and on trails. | LOW (architecture) | Already enforced by the no-backend constraint. Market it. |

---

### Anti-Features for v1.0 — Explicitly Do Not Build

| Anti-Feature | Why Tempting | Why Problematic | What to Do Instead |
|--------------|--------------|-----------------|-------------------|
| Plate calculator | Strong has one; lifters mention it | Nice-to-have; adds UI complexity for a 4-week build; athletes know their plates | Athlete enters target load directly. Plate calc can be Phase 2 or v1.1 polish. |
| Social feed / sharing | Hevy has one; accountability is real | Polarising (kills simplicity); requires backend + auth; not v1.0 | Offline personal tracking is the identity. Defer social to v1.1. |
| Custom exercise creation | Athletes always have niche movements | Exercise CRUD UI costs time; seeded list covers 90% of HYROX/tactical use cases | Ship 40-exercise seeded list; flag custom creation as v1.1. |
| Superset logging | Hevy feature; some HYROX athletes do circuit blocks | Complex UI state (alternating between exercises mid-session); rare for the target user compared to straight sets | Log circuits as sequential sets of each exercise. Athlete can mental-note the superset structure. |
| Structured programming / plan builder | TrainHeroic has it; coaches want it | Requires plan schema, calendar, percentage-based load tracking; entirely separate product surface | Log what you did, not what you planned. Planned programming is v1.1+. |
| Nutrition / macros | Brief mentions it; athletes want one app | Largest scope item; cut explicitly per BUILD.md §0 | Reference MacroFactor for v1.0 users. v1.1 integration. |
| Garmin import | Athletes use Garmin | Requires Garmin developer program access; HealthKit-only is the v1.0 contract | HealthKit imports Apple Watch + Garmin-via-Health-Sync (indirect path exists). |
| Cloud sync / backup | Users will ask for it | Backend is a v1.1 concern; adds auth, compliance, infra to a 4-week build | Ship local-first. v1.1 adds iCloud or Supabase backup. |
| Volume / tonnage analytics | Hevy has volume charts; lifters like them | Requires separate analytics surface; distracts from HSS as the single load number | HSS is the volume metric. Do not add a competing metric in v1.0. |
| Video exercise instructions | TrainHeroic ships instructional video | Storage / hosting cost; OOB for offline-first constraint | Short text description in exercise record is sufficient. |
| Wellness surveys before sessions | TrainHeroic's load management tool | Adds a daily gate; kills logging speed; HRV/sleep inputs are v1.1 when HK sleep data is in scope | TSB-based readiness band infers readiness from load history. No survey needed for v1.0. |
| Android | RN keeps the door open | Same binary cannot ship on both without Expo build change; HealthKit is iOS only | iOS-first per BUILD.md §0. Android is v1.1 or later. |

---

## Feature Dependencies

```
[User profile: sex, bodyweight, thresholdHR, thresholdPace]
    └──required by──> [Engine HSS calculation]
                          └──required by──> [Session HSS display]
                          └──required by──> [load_daily recompute]
                                               └──required by──> [Readiness band]
                                               └──required by──> [14-30 day trend chart]

[Exercise library (seeded)]
    └──required by──> [Lifting session logger]

[Lifting session logger]
    └──produces──> [strength_set rows]
                      └──feeds──> [sessionHSS (strength component)]

[Run/conditioning logger]
    └──produces──> [endurance_segment rows]
                      └──feeds──> [sessionHSS (endurance component)]

[HealthKit import]
    └──requires──> [expo-dev-client build (not Expo Go)]
    └──requires──> [HealthKit entitlement on bundle ID (human step)]
    └──requires──> [Real device for testing]
    └──produces──> [endurance_segment rows] + [user_profile.bodyWeight]
    └──enhances──> [Run/conditioning logger] (reduces manual entry friction)

[HealthKit write-back]
    └──requires──> [HealthKit import permissions already granted]
    └──depends on──> [session save completing successfully]

[RPE entry on set]
    └──required by──> [strengthStress engine function]
    └──must not slow down──> [set logging speed target ≤ 3 taps]

[Rest timer]
    └──enhances──> [Lifting session logger] (reduces friction between sets)
    └──no hard dependency] (safe to ship without, add early in Phase 1)
```

### Dependency Notes

- **User profile required before first HSS**: Onboarding must capture `thresholdHR`, `thresholdPace`, `bodyWeight`, and `sex` before the engine can produce meaningful numbers. Incomplete profile → disable readiness band with a clear prompt, do not show wrong numbers.
- **HealthKit gated behind physical device**: No simulator testing for actual HR import or workout write-back. Phase 2 (HealthKit) acceptance criteria cannot be signed off from Simulator alone.
- **RPE entry must not break 3-tap budget**: The RPE field is the one non-standard addition vs Strong/Hevy. If the RPE picker costs a full extra tap on every set it will feel worse than the incumbents. Design: show RPE as a persistent quick-select row (5 6 7 8 9 10) always visible on the set entry card, defaulting to the last used value. No modal.
- **Readiness band requires ≥ 14 days of data to be meaningful**: TSB on day 1 is zero. Show an empty-state message ("Log 14 sessions to unlock readiness score") rather than a misleading green band.

---

## MVP Definition

### Launch With (v1.0) — the four locked features only

- [ ] **Lifting session logger** — exercise search (seeded list), set entry (load/reps/RPE + warmup flag), previous-session recall, rest timer, offline save, session HSS computed on save. This is the minimum habit-forming action.
- [ ] **Run / conditioning logger** — activity type, distance, duration, auto-pace, optional avgHR, offline save, session HSS computed on save. Manual entry first; HealthKit import augments but does not replace.
- [ ] **Home screen: today's readiness band + 28-day trend** — large green/amber/red badge, HSS trend chart (ATL + CTL or TSB line), today's session list. The single screen that communicates "am I digging a hole?" at a glance.
- [ ] **HealthKit import** — read runs + HR + bodyweight on first open (with permission prompt); write logged workouts back after each save. Lower priority — defer before cutting #1-#3 if timeline slips.
- [ ] **Onboarding** — captures sex, bodyweight, thresholdHR, thresholdPace. Required for engine to function. Must gate readiness band behind completed onboarding.

### Add After Validation (v1.1 — August)

- [ ] **Plate calculator** — add when athletes flag it in feedback; well-understood to build
- [ ] **Custom exercise creation** — add when 40-exercise seeded list proves insufficient
- [ ] **iCloud / cloud backup** — add when first data-loss incident is reported or users ask
- [ ] **Garmin import** — gated on Garmin developer program access
- [ ] **Superset logging** — add if circuit athletes are a meaningful segment
- [ ] **Nutrition / macros** — per docx vision; significant effort, requires separate phase

### Future Consideration (v2+)

- [ ] **Android** — after iOS product-market fit confirmed
- [ ] **Coaching / programming layer** — entirely separate product surface
- [ ] **Social / sharing** — after cloud sync is established
- [ ] **HRV / sleep integration** — add HealthKit sleep + HRV to readiness model

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Lifting logger with previous-session recall | HIGH | LOW | P1 |
| Set entry ≤ 3 taps (RPE as quick-row) | HIGH | MEDIUM | P1 |
| Rest timer auto-start | HIGH | LOW | P1 |
| Seeded exercise library + search | HIGH | LOW | P1 |
| Run logger with auto-pace | HIGH | LOW | P1 |
| Session HSS on finish screen | HIGH | MEDIUM | P1 |
| Readiness band on home screen | HIGH | MEDIUM | P1 |
| 14–30 day load trend chart | HIGH | MEDIUM | P1 |
| Onboarding (profile capture) | HIGH | LOW | P1 |
| Offline-first (architecture) | HIGH | LOW (already true) | P1 |
| HealthKit run import | MEDIUM | HIGH | P2 |
| HealthKit write-back | MEDIUM | HIGH | P2 |
| HealthKit bodyweight import | MEDIUM | LOW | P2 |
| Live HSS update mid-session | MEDIUM | LOW | P2 |
| Double-session penalty label | MEDIUM | LOW | P2 |
| Units toggle (km/mi) | MEDIUM | LOW | P2 |
| Warmup set flag | MEDIUM | LOW | P1 |
| Session notes/tag field | LOW | LOW | P2 |
| Plate calculator | LOW | MEDIUM | P3 |
| Custom exercise creation | LOW | MEDIUM | P3 |

---

## Competitor Feature Analysis

| Feature | Strong | Hevy | HyTrack | Strava (run) | Apsis v1.0 |
|---------|--------|------|---------|-------------|------------|
| Previous-session recall per set | Yes (best in class) | Yes | Unknown | N/A | Yes — must match |
| Set entry taps | ~3 taps | ~3–4 taps | N/A | N/A | Target ≤ 3 taps |
| RPE per set | Optional | Optional | Unknown | N/A | Required (engine input) |
| Rest timer | Yes | Yes | N/A | N/A | Yes |
| Seeded exercise library | Yes | 400+ exercises | Strength + HYROX stations | N/A | ~40 HYROX/tactical exercises |
| Run logger | No | No | Yes (GPS) | Yes (GPS + manual) | Manual entry + HealthKit import |
| Unified load score (lifting + running) | No | No | Yes (AI, requires subscription) | No | Yes — free, offline, hybrid-aware |
| Readiness band | No | No | Yes (AI pro tier) | No | Yes — on home screen |
| ATL/CTL/TSB trend | No | No | Partial (AI tier) | No | Yes — 28-day trend chart |
| Offline-first | Yes | Partial (social requires network) | No (AI requires network) | No | Yes — hard constraint |
| HealthKit integration | No | No | Partial | Yes (export only) | Import + write-back |
| Social features | No | Yes | No | Yes | No — anti-feature for v1.0 |
| Coaching / programming | No | No | No (training plans only) | No | No — anti-feature for v1.0 |
| Free tier | 3 routines free | Full feature free | Free for 1 discipline | Freemium | TBD (pricing not in scope) |

---

## Key Implementation Guidance for Roadmap

### Logging Speed — What "Match Strong" Actually Means

Strong's speed comes from three mechanisms working together:

1. **Pre-populated previous weight + reps.** The athlete sees their last performance as the default. Tap the checkmark if it is the same; tap weight to adjust with a stepper if different. No typing for most sets.

2. **Stepper buttons on weight/reps field.** +2.5 kg / -2.5 kg buttons reduce the keyboard to a fallback for unusual adjustments. Most athletes increment by a fixed amount each session.

3. **Rest timer as a structural element, not an afterthought.** The timer runs in a persistent banner or notification. The athlete can log the next set directly from the notification without reopening the app (Strong has this; Hevy partly has it).

For Apsis, the RPE field is the one addition Strong does not default to. **Do not put RPE behind a modal or a separate screen.** A horizontal 6-button row pinned to the set card (values 6/7/8/9/10, with last-used pre-selected) adds zero extra taps if the athlete's RPE did not change set-to-set.

### Run Logging — What "Fast Enough" Means

Manual run entry is a post-workout action, not an in-session action. Latency budget is 30-60 seconds, not 3-second per set. The friction kills are:

1. **Keyboard obscures input fields** — the most common UX complaint in run logging apps. Place numeric inputs at the top of the screen or use a bottom-sheet pattern that pushes content up.

2. **No auto-calculated pace** — if the athlete enters distance and duration, pace should appear instantly. This is table stakes; a missing pace field looks unprofessional.

3. **No default date** — every time the athlete must confirm "today" is a micro-friction event. Default to today and make it editable, not the reverse.

### HSS Readiness Presentation — Expected Behavior

The readiness band is only meaningful with context. Recommended home screen hierarchy:

1. **Large readiness badge** (green/amber/red + one-word label: "Ready" / "Caution" / "Rest") — above the fold.
2. **Today's HSS total** — secondary number below the badge.
3. **28-day chart** (ATL vs CTL line, or TSB bars) — visible on home without scrolling on a standard iPhone display.
4. **Today's sessions list** — cards below the chart.

Empty states: New users see a placeholder chart with "Log your first session to start tracking" copy. After 1-13 sessions: show the chart but display a badge that says "Building trend..." instead of a readiness band. At 14+ days of data, the readiness band activates.

---

## Sources

- Strong App Review 2025: https://repreturn.com/strong-app-review/
- Hevy vs Strong App Comparison 2026: https://setgraph.app/ai-blog/hevy-vs-strong-app-comparison-2026
- Hevy features — Supersets and Smart Superset Scrolling: https://www.hevyapp.com/features/what-are-supersets/
- Hevy — How to Log & Track Workouts: https://www.hevyapp.com/features/track-workouts/
- Best Strength Training Apps 2026: https://askvora.com/blog/best-strength-training-apps-2026
- Best Workout Tracker per Reddit: https://www.corahealth.app/blog/best-workout-tracker-reddit
- HYROX Training Apps Compared 2026: https://www.findyouredge.app/news/hyrox-training-apps-compared-2026-which-one-is-actually-built-for-hybrid-athletes
- HyTrack App Store listing: https://apps.apple.com/us/app/hytrack-hyrox-training-app/id6760627559
- ROXFIT 2026 feature overview: https://thetimeclub.co.uk/blogs/news/roxfit-2026-how-the-ai-powered-hybrid-training-app-is-shaping-garmin-apple-watch-performance
- Strava HealthKit integration: https://support.strava.com/hc/en-us/articles/216917527-Health-App-and-Strava
- @kingstinct/react-native-healthkit: https://github.com/kingstinct/react-native-healthkit
- TrainHeroic athlete features: https://www.trainheroic.com/athlete/
- CTL/ATL/TSB guide: https://www.trainingpeaks.com/coach-blog/a-coachs-guide-to-atl-ctl-tsb/
- Garmin Training Readiness feature: https://wiki.garminrumors.com/Training_Readiness
- Fitness App UX design principles: https://stormotion.io/blog/fitness-app-ux/

---
*Feature research for: Hybrid-athlete training tracker (HYROX / tactical), iOS*
*Researched: 2026-06-29*
