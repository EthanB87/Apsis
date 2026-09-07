/**
 * apps/mobile/app/(tabs)/nutrition/index.tsx — Nutrition TODAY screen (NUTR-19/16/17/22)
 *
 * The sellable increment's home: today's adaptive kcal/macro target vs. logged totals.
 * Gated behind a complete nutrition profile (NUTR-20, `useNutritionProfile`) — an incomplete
 * profile renders a Nutrition Setup call-to-action instead of ever computing/showing a target
 * derived from NULL fields.
 *
 * Rest-day lazy-compute fallback (07-PATTERNS.md Pitfall 5): `recomputeNutritionTarget` is
 * event-driven (fired from `finishWorkout`/`runEntry` after a session finish), so a day with NO
 * session yet (a pure rest day, or simply "haven't logged today's session yet") would otherwise
 * never get a `nutrition_target` row. On focus, if today's row is absent, this screen calls
 * `recomputeNutritionTarget` itself exactly once — `sessionTypesForDate` naturally returns `[]`
 * on a day with no finished sessions, folding to `dayType='rest'`/`sessionKcal=0` via the same
 * pure `computeNutritionTargetRow` path every other caller uses.
 *
 * `useFocusEffect` (never a bare `useEffect`, Pitfall-5/03-10 stacked-screen lesson) drives the
 * one DB-writing load path here; the write itself is idempotent (`onConflictDoUpdate` keyed on
 * the deterministic `auto-${localDate}` id), so a refocus can never double-write or oscillate.
 * Also subscribes to `nutritionTargetSignal` so a logging write elsewhere (e.g. finishing a
 * workout while this screen sits unfocused in the stack) refreshes the displayed numbers the
 * next time this screen regains focus — mirrors TODAY's `useHealthKitImportSignal` reactive-
 * selector pattern.
 *
 * NUTR-22 (T-07-09): no kcal/macro value is ever attached to a Sentry breadcrumb/extra/context
 * call anywhere in this file — only a hardcoded `[Apsis]`-prefixed string reaches
 * `console.error` on failure, never the loaded totals/target.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { dayTotals, db, nutritionTarget } from '@apsis/db';

import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../../constants/theme';
import { useNutritionProfile } from '../../../hooks/useNutritionProfile';
import { todayLocalDate } from '../../../lib/localDate';
import { useNutritionTargetSignal } from '../../../lib/nutritionTargetSignal';
import { recomputeNutritionTarget } from '../../../lib/recomputeNutritionTarget';

type DayType = 'heavy_lift' | 'long_run' | 'double' | 'rest' | 'mixed';

const DAY_TYPE_LABEL: Record<DayType, string> = {
  heavy_lift: 'HEAVY LIFT DAY',
  long_run: 'LONG RUN DAY',
  double: 'DOUBLE DAY',
  rest: 'REST DAY',
  mixed: 'MIXED DAY',
};

interface DayTarget {
  dayType: DayType;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

interface DayTotalsRow {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

interface NutritionState {
  loading: boolean;
  /** WR-04: a failed load must render an error + Retry, never an indefinite spinner. */
  error: boolean;
  target: DayTarget | null;
  totals: DayTotalsRow;
}

const ZERO_TOTALS: DayTotalsRow = { kcal: 0, p: 0, c: 0, f: 0 };

const INITIAL_STATE: NutritionState = {
  loading: true,
  error: false,
  target: null,
  totals: ZERO_TOTALS,
};

const LOAD_ERROR_MESSAGE = "Couldn't load today's nutrition. Try again.";

function ratio(value: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

function formatWhole(n: number): string {
  return String(Math.round(n));
}

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  accent: 'volt' | 'bone';
}

function MacroBar({ label, value, target, unit, accent }: MacroBarProps): React.JSX.Element {
  const pct = ratio(value, target);
  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeaderRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={[styles.macroValue, tabularNums, accent === 'volt' && styles.macroValueVolt]}>
          {`${formatWhole(value)} / ${formatWhole(target)} ${unit}`}
        </Text>
      </View>
      <View style={styles.trackOuter}>
        <View
          style={[
            styles.trackFill,
            { width: `${pct * 100}%` },
            accent === 'volt' ? styles.trackFillVolt : styles.trackFillBone,
          ]}
        />
      </View>
    </View>
  );
}

export default function NutritionScreen(): React.JSX.Element {
  const router = useRouter();
  const { complete, loading: profileLoading } = useNutritionProfile();
  const [state, setState] = useState<NutritionState>(INITIAL_STATE);
  const targetVersion = useNutritionTargetSignal((s) => s.version);

  const loadNutrition = useCallback(async () => {
    try {
      const today = todayLocalDate();
      let targetRows = await db.select().from(nutritionTarget).where(eq(nutritionTarget.localDate, today));

      if (targetRows.length === 0) {
        // Rest-day lazy-compute fallback (Pitfall 5) — no event has written today's row yet.
        await recomputeNutritionTarget(db, today);
        targetRows = await db.select().from(nutritionTarget).where(eq(nutritionTarget.localDate, today));
      }

      const totalsRows = await dayTotals(db, today);
      const targetRow = targetRows[0];
      const totalsRow = totalsRows[0];

      setState({
        loading: false,
        error: false,
        target:
          targetRow != null
            ? {
                dayType: targetRow.dayType,
                kcal: targetRow.kcal,
                proteinG: targetRow.proteinG,
                carbG: targetRow.carbG,
                fatG: targetRow.fatG,
              }
            : null,
        totals: totalsRow != null ? { kcal: totalsRow.kcal, p: totalsRow.p, c: totalsRow.c, f: totalsRow.f } : ZERO_TOTALS,
      });
    } catch (err: unknown) {
      console.error('[Apsis] Nutrition TODAY load failed:', err);
      // WR-04: flag the failure so the render below shows the error + Retry state (matching
      // the Settings load-failure precedent) instead of spinning forever on a null target.
      setState((prev) => ({ ...prev, loading: false, error: true }));
    }
  }, [targetVersion]);

  function handleRetry(): void {
    setState(INITIAL_STATE);
    void loadNutrition();
  }

  useFocusEffect(
    useCallback(() => {
      if (complete) {
        void loadNutrition();
      }
    }, [complete, loadNutrition])
  );

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.dark.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!complete) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.setupContainer}>
          <ScreenHeader kicker="NUTRITION" title="Nutrition" style={styles.screenHeader} />
          <Text style={styles.setupIntro}>
            A few more profile details are needed to compute your daily calorie and macro targets.
          </Text>
          <Pressable
            // Typed-routes emit the collapsed '/nutrition-setup' form for this standalone
            // top-level index route; the generated .d.ts shape shifts between regenerations
            // (Phase 06 precedent: adapt to the generated shape rather than fighting it).
            onPress={() => router.push('/nutrition-setup')}
            accessibilityRole="button"
            accessibilityLabel="Set up nutrition targets"
            style={styles.setupButton}>
            <Text style={styles.setupButtonLabel}>Set up nutrition targets</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.dark.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // WR-04: load failed OR the recompute returned without writing (e.g. profile raced to
  // incomplete) — show the generic error string + Retry, never an indefinite spinner.
  if (state.error || state.target == null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText} accessibilityRole="alert">
            {LOAD_ERROR_MESSAGE}
          </Text>
          <Pressable
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={styles.retryButton}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { target, totals } = state;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ScreenHeader kicker="NUTRITION" title="Today" style={styles.screenHeader} />
        <Text style={styles.dayTypeLabel}>{DAY_TYPE_LABEL[target.dayType]}</Text>

        <MacroBar label="CALORIES" value={totals.kcal} target={target.kcal} unit="KCAL" accent="volt" />
        <MacroBar label="PROTEIN" value={totals.p} target={target.proteinG} unit="G" accent="bone" />
        <MacroBar label="CARBS" value={totals.c} target={target.carbG} unit="G" accent="bone" />
        <MacroBar label="FAT" value={totals.f} target={target.fatG} unit="G" accent="bone" />

        {/* Rule 2 deviation (Plan 07-06): the only entry point into search/log — without this
         * the two screens built in this plan are unreachable dead code. Ghost/bone style, not
         * volt — the calories bar above is already this screen's one volt-filled element. */}
        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/search')}
          accessibilityRole="button"
          accessibilityLabel="Log food"
          style={({ pressed }) => [styles.logFoodButton, pressed && styles.logFoodButtonPressed]}>
          <Text style={styles.logFoodButtonLabel}>Log food</Text>
        </Pressable>

        {/* Rule 2 deviation (Plan 07-10): the only entry point into recipes.tsx — without this
         * the recipes list/create/log-one-serving flow built in this plan is unreachable dead
         * code. Same ghost/bone style as the Log food button above. */}
        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/recipes')}
          accessibilityRole="button"
          accessibilityLabel="Recipes"
          style={({ pressed }) => [styles.logFoodButton, pressed && styles.logFoodButtonPressed]}>
          <Text style={styles.logFoodButtonLabel}>Recipes</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  loadErrorText: {
    ...Typography.body,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 48,
    minWidth: 120,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  retryLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  screenHeader: {
    paddingTop: Spacing.xl,
  },
  dayTypeLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  macroRow: {
    marginBottom: Spacing.xl,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  macroLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  macroValue: {
    ...Mono,
    color: Colors.dark.text,
  },
  macroValueVolt: {
    color: Colors.dark.accent,
  },
  trackOuter: {
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.dark.steel,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  trackFillVolt: {
    backgroundColor: Colors.dark.accent,
  },
  trackFillBone: {
    backgroundColor: Colors.dark.text,
  },
  setupContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  setupIntro: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    marginTop: Spacing.md,
  },
  setupButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  setupButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  logFoodButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  logFoodButtonPressed: {
    backgroundColor: Colors.dark.steel,
  },
  logFoodButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
