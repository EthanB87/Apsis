/**
 * Golden-file tests for the day-type adaptive macro target model (NUTR-16/17/18,
 * Phase 07 Plan 02). 07-RESEARCH.md Pattern 4 IS the model (no PRD §6 exists in this
 * repo) — these 5 cases compute the real output of that formula for fixed inputs and
 * lock the numbers, mirroring `calibration.test.ts`'s "compute the real number, assert
 * a defensible range, document why" discipline. Every EngineConfig constant used here is
 * a starting guess (see config.ts provenance comments), not a precisely-calibrated value.
 */
import { classifyDayType, dailyMacroTarget, trainingKcalFromHss } from '../nutrition';
import type { NutritionProfile } from '@apsis/shared';

describe('classifyDayType (NUTR-17) — maps session types to day type, >1-session-wins precedence', () => {
  it('no sessions logged → rest', () => {
    expect(classifyDayType([])).toBe('rest');
  });

  it('more than one session → double, regardless of type mix (mirrors dailyHSS precedence)', () => {
    expect(classifyDayType(['strength', 'strength'])).toBe('double');
    expect(classifyDayType(['strength', 'endurance'])).toBe('double');
    expect(classifyDayType(['endurance', 'hybrid'])).toBe('double');
  });

  it('single strength session → heavy_lift', () => {
    expect(classifyDayType(['strength'])).toBe('heavy_lift');
  });

  it('single endurance session → long_run', () => {
    expect(classifyDayType(['endurance'])).toBe('long_run');
  });

  it('single hybrid session → mixed', () => {
    expect(classifyDayType(['hybrid'])).toBe('mixed');
  });
});

describe('trainingKcalFromHss (NUTR-16) — converts a day HSS total into added training kcal', () => {
  it('a 100-HSS day adds 500 kcal (kcalPerHssPoint=5 default)', () => {
    expect(trainingKcalFromHss(100)).toBe(500);
  });

  it('negative HSS clamps to 0 kcal (never a negative training-kcal add)', () => {
    expect(trainingKcalFromHss(-10)).toBe(0);
  });

  it('non-finite HSS (NaN/Infinity) → 0, never propagates NaN', () => {
    expect(trainingKcalFromHss(NaN)).toBe(0);
    expect(trainingKcalFromHss(Infinity)).toBe(0);
  });
});

describe('dailyMacroTarget (NUTR-16/18) — day-type adaptive kcal/macro golden cases', () => {
  it('golden 1: maintain + rest day lands in a defensible sanity range (moderate baseline athlete)', () => {
    // 80kg male, 180cm, 30yo, maintain, rest day, no session kcal.
    // BMR (Mifflin-St Jeor) = 10*80 + 6.25*180 - 5*30 + 5 = 1780; neat = 1780*1.2 = 2136.
    // protein = 1.8*80 = 144g; carb (rest, 2.5 g/kg) = 200g; fat fills the remainder, well
    // above the 32g floor (0.4*80) — computed via the real formula, not hand-waved.
    const profile: NutritionProfile = { sex: 'male', bodyweightKg: 80, heightCm: 180, age: 30, goalMode: 'maintain' };
    const result = dailyMacroTarget(profile, 'rest', 0);
    expect(result).toEqual({ kcal: 2135, p: 144, c: 200, f: 84, warnings: [] });
    // Sanity range: a moderate-activity maintenance target should land well within 1800-2500 kcal.
    expect(result.kcal).toBeGreaterThanOrEqual(1800);
    expect(result.kcal).toBeLessThanOrEqual(2500);
  });

  it('golden 2: cut + heavy_lift — kcal reduced by exactly cutDeltaKcal, protein highest relative to kcal', () => {
    // Same 80kg/180cm/30yo male, heavy_lift day, sessionKcal=750 (large enough that the
    // fat-floor clamp does NOT fire here — that's golden case 5's job, isolated).
    const cutProfile: NutritionProfile = { sex: 'male', bodyweightKg: 80, heightCm: 180, age: 30, goalMode: 'cut' };
    const maintainProfile: NutritionProfile = { ...cutProfile, goalMode: 'maintain' };
    const cutResult = dailyMacroTarget(cutProfile, 'heavy_lift', 750);
    const maintainResult = dailyMacroTarget(maintainProfile, 'heavy_lift', 750);

    expect(cutResult).toEqual({ kcal: 2385, p: 192, c: 320, f: 38, warnings: [] });
    // kcal is reduced by exactly cutDeltaKcal (-500) relative to an identical maintain day —
    // the fat-floor clamp never touches the `kcal` field, only c/f, so this holds exactly.
    expect(maintainResult.kcal - cutResult.kcal).toBe(500);
    // Protein's share of total kcal is higher on cut than on an identical maintain day
    // (2.4 g/kg cut vs 1.8 g/kg maintain — protein highest relative to kcal).
    const cutProteinShare = (cutResult.p * 4) / cutResult.kcal;
    const maintainProteinShare = (maintainResult.p * 4) / maintainResult.kcal;
    expect(cutProteinShare).toBeGreaterThan(maintainProteinShare);
  });

  it('golden 3: bulk + double — highest carb target of any day type, sessionKcal clearly additive', () => {
    // 90kg/185cm/26yo male, bulk, double-session day, sessionKcal=1500 (large double day).
    const profile: NutritionProfile = { sex: 'male', bodyweightKg: 90, heightCm: 185, age: 26, goalMode: 'bulk' };
    const result = dailyMacroTarget(profile, 'double', 1500);
    expect(result).toEqual({ kcal: 4120, p: 162, c: 720, f: 66, warnings: [] });
    // carbGPerKgDouble (8) is the highest of all 5 day-type carb rates — c should equal
    // exactly 8 * bodyweightKg when unclamped.
    expect(result.c).toBe(8 * profile.bodyweightKg);
    // sessionKcal is clearly additive: an otherwise-identical day with sessionKcal=0
    // must have exactly 1500 fewer kcal (kcal is unaffected by the fat-floor clamp).
    const zeroSessionResult = dailyMacroTarget(profile, 'double', 0);
    expect(result.kcal - zeroSessionResult.kcal).toBe(1500);
  });

  it('golden 4: invalid bodyweight (<=0 or non-finite) → all-zero result + warning, never NaN', () => {
    const base: Omit<NutritionProfile, 'bodyweightKg'> = { sex: 'male', heightCm: 180, age: 30, goalMode: 'maintain' };
    const expected = { kcal: 0, p: 0, c: 0, f: 0, warnings: ['invalid bodyweight — cannot compute targets'] };

    expect(dailyMacroTarget({ ...base, bodyweightKg: 0 }, 'rest', 0)).toEqual(expected);
    expect(dailyMacroTarget({ ...base, bodyweightKg: -10 }, 'rest', 0)).toEqual(expected);
    expect(dailyMacroTarget({ ...base, bodyweightKg: NaN }, 'rest', 0)).toEqual(expected);
    expect(dailyMacroTarget({ ...base, bodyweightKg: Infinity }, 'rest', 0)).toEqual(expected);

    // No field is ever NaN, no matter how the invalid input arrived.
    const result = dailyMacroTarget({ ...base, bodyweightKg: NaN }, 'rest', 0);
    expect(Number.isNaN(result.kcal)).toBe(false);
    expect(Number.isNaN(result.p)).toBe(false);
    expect(Number.isNaN(result.c)).toBe(false);
    expect(Number.isNaN(result.f)).toBe(false);
  });

  it('golden 5: extreme aggressive cut trips the fat-floor clamp — warnings populated, f pinned at fatFloorGPerKg*bodyweightKg', () => {
    // 55kg/160cm/35yo female, aggressive cut, long_run day, no session kcal — a deficit
    // small athlete scenario where protein (2.4 g/kg) + carb (7 g/kg long_run) alone
    // would push fat below the 0.4 g/kg floor.
    const profile: NutritionProfile = { sex: 'female', bodyweightKg: 55, heightCm: 160, age: 35, goalMode: 'cut' };
    const result = dailyMacroTarget(profile, 'long_run', 0);
    expect(result).toEqual({
      kcal: 1215,
      p: 132,
      c: 122,
      f: 22,
      warnings: ['fat target below floor — reduced carb target to compensate'],
    });
    // f is pinned exactly at fatFloorGPerKg (0.4) * bodyweightKg.
    expect(result.f).toBe(0.4 * profile.bodyweightKg);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
