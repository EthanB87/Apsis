---
phase: 3
slug: 03-onboarding-lifting-logger
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-09
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|----------------|
| app -> engine | App passes numeric set/carry inputs (loadKg, reps, rpe, durationS) originating from user entry into `packages/engine` compute functions | numeric training-set values |
| app -> SQLite | User-entered exercise ids, workout ids, and set values reach SQLite via drizzle query builders | ids, load/rep/rpe/duration values |
| npm registry -> app bundle | New third-party/native packages (`@gorhom/bottom-sheet`, `expo-crypto`, `expo-notifications`, `expo-haptics`, `zustand`) enter the trusted build | package code |
| user input -> profile draft | Sex/bodyweight/units/threshold HR/pace entered in the onboarding wizard, held in an in-memory zustand draft | profile attributes |
| DB -> boot routing | Profile-exists + open-workout queries decide whether onboarding or the tab shell renders | boolean gate signal only |
| store -> engine -> DB | Every set commit recomputes session HSS and writes `workout.hss` | computed stress score |
| app -> OS notifications | Local rest-timer notification scheduling requires an OS permission grant | schedule/cancel call, no user profile data |
| user action -> workout lifecycle | Finish/Discard mutate `workout.finishedAt`/`workout.deletedAt` | workout state transition |
| user input -> user_profile update | Settings profile editor, units toggle, and rest-timer default all write `user_profile` | profile attributes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Denial of Service | bodyweight.ts / carry.ts numeric inputs | low | mitigate | `clampRange` (NaN-safe, never throws) applied to every numeric input in `packages/engine/src/bodyweight.ts` and `carry.ts` | closed |
| T-03-02 | Tampering | high-rep e1RM extrapolation | low | mitigate | `REP_MAX_TABLE` hard 30-rep floor row + clamp-and-warn in `bodyweight.ts` — never extrapolates Epley/Brzycki past valid range | closed |
| T-03-03 | Tampering | queries.ts builders | medium | mitigate | `packages/db/src/queries.ts` uses only drizzle parameterized builders (eq/and/isNull/isNotNull/desc); `previous-session-query.test.ts` + `soft-delete.test.ts` assert parameter binding (id/exerciseId never appear in the raw SQL string) | closed |
| T-03-04 | Tampering | drizzle migration integrity | medium | mitigate | `drizzle.config.ts` driver stays `'expo'`; `0000_mushy_satana.sql` byte-unchanged in git history; `0001_long_firebrand.sql` contains only `ALTER TABLE ... ADD COLUMN` statements, no table recreation; journal append-only | closed |
| T-03-05 | Information Disclosure | soft-deleted workouts leaking | low | mitigate | `activeWorkoutFilter` (`isNull(workout.deletedAt)`) applied in `selectActiveWorkouts`/`recentExerciseIds`; `previousSessionSet`/`openWorkout` apply the equivalent inline filter; `soft-delete.test.ts` asserts `deleted_at`/`is null` present in generated SQL | closed |
| T-03-SC | Tampering | npm installs (@gorhom/bottom-sheet, expo-crypto/notifications/haptics, zustand) | high | mitigate | Blocking-human legitimacy checkpoint (03-03 Task 1, `gate="blocking-human"`) executed and approved (03-03-SUMMARY: "human approved all five packages"); `apps/mobile/package.json` confirms all five present at SDK-56-aligned versions (not hand-pinned 57.x tags) | closed |
| T-03-06 | Spoofing | primary-key generation | low | mitigate | `expo-crypto` `randomUUID()` used in `sessionStore.ts` (x3) and `log/index.tsx`; grep confirms zero `Math.random()` usages for id generation anywhere in `apps/mobile` or `packages/*` | closed |
| T-03-07 | Tampering/DoS | onboarding numeric inputs | low | mitigate | `bodyweight.tsx`: `nextDisabled={!isValidNumber}` only (empty/non-numeric), out-of-range shows a warning label but never blocks Continue | closed |
| T-03-08 | Information Disclosure | profile values in logs/errors | low | mitigate | `BootStates.tsx` `ErrorScreen`/`ResumePrompt` render hardcoded strings only; `useSaveProfile.ts`/`useProfile.ts` console.error raw errors, render generic `SAVE_ERROR_MESSAGE`/`UPDATE_ERROR_MESSAGE`/`LOAD_ERROR_MESSAGE` only | closed |
| T-03-09 | Spoofing/Elevation | bypassing onboarding | low | mitigate | `app/_layout.tsx`: `Stack.Protected guard={!hasProfile}` (onboarding) / `guard={hasProfile}` ((tabs)) verified against installed expo-router 56.2.11 type declarations | closed |
| T-03-10 | Tampering | threshold inputs / estimate math | low | mitigate | `threshold-hr.tsx`/`threshold-pace.tsx`: `nextDisabled` gated only on a null result, not range; `thresholdEstimates.ts` helpers are pure (no Date/IO) | closed |
| T-03-11 | Information Disclosure | profile save error leaking paths | low | mitigate | `useSaveProfile.ts`: raw error console.error'd only, hardcoded `SAVE_ERROR_MESSAGE` rendered to the user | closed |
| T-03-12 | Tampering | profile insert | low | mitigate | `useSaveProfile.ts`: `db.insert(userProfile).values(...)` — parameterized drizzle insert, no raw sql | closed |
| T-03-13 | Tampering | per-set insert / workout.hss update | medium | mitigate | `commitSet.ts`: parameterized insert/update; `recomputeSessionHss` re-runs `sessionHSSDetailed` over ALL committed sets (never an incremental delta) — engine remains the single source of truth | closed |
| T-03-14 | DoS | malformed numeric set input | low | mitigate | `strength.ts`/`bodyweight.ts`/`carry.ts` clamp-and-warn (verified `clampRange` calls); `SetRow.tsx` `disabled` props gated only on `locked`/`committing`, never on numeric range | closed |
| T-03-15 | DoS | rest timer dies backgrounded | medium | mitigate | `restTimer.ts`: `startRest`/`remainingSec` derive countdown from a wall-clock `endsAt` timestamp, never `setTimeout`; `RestTimerBanner.tsx` recomputes on a 250ms interval AND on `AppState` foreground transition; `notifications.ts` schedules an OS-level local notification | closed |
| T-03-16 | Availability | notification permission denied | low | mitigate | `notifications.ts`: `ensureNotificationPermission`/`scheduleRestNotification`/`cancelRestNotification` all catch and tolerate denial/errors, returning `false`/`null` — countdown never depends on permission | closed |
| T-03-17 | Tampering/data loss | accidental discard | medium | mitigate | `finish.tsx`: Discard lives behind a "•••" menu (not adjacent to Done), confirm `Modal` with exact UI-SPEC copy; `finishWorkout.ts#discardWorkout` calls `softDeleteWorkout` only — no hard `db.delete()` on `workout` | closed |
| T-03-18 | Information Disclosure | breakdown sheet exposing internals | low | mitigate | `HSSBreakdownSheet.tsx`: renders only rolled-up per-exercise/session numbers; grep confirms `kStrength`/`kEndurance`/`kCarry` appear only in a doc-comment, never in rendered UI/logic | closed |
| T-03-19 | Tampering | profile update rewriting history | low | mitigate | `useProfile.ts#update`: `db.update(userProfile).set(patch).where(eq(userProfile.id, profile.id))` — touches `user_profile` only, never `workout.hss`/`load_daily`/`strength_set.stressScore` | closed |
| T-03-20 | Tampering | profile update injection | low | mitigate | `useProfile.ts#update`: parameterized drizzle update, no raw sql with user values | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Unregistered Flags

None. `03-09-SUMMARY.md` is the only phase summary carrying an explicit `## Threat Flags` section, and it reports "None." Cross-checked against a spot audit of code introduced by the post-execution code-review fixes (`03-REVIEW-FIX.md`, commits `3359055..f2f7ceb`): the WR-01 seed-upsert fix (`packages/db/src/seed.ts`) uses `sql\`excluded.bw_factor\`` / `sql\`excluded.entry_mode\`` fragments that reference only static column identifiers, never user-supplied values — consistent with the existing T-1-01/T-03-03 parameterization discipline, not a new attack surface.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*Accepted risks do not resurface in future audit runs.*

No accepted risks. Every threat in this register resolved to `mitigate` and was verified CLOSED against the implemented code.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-09 | 20 | 20 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-09
