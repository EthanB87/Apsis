/**
 * apps/mobile/components/onboarding/ExplainerCards.tsx
 *
 * Phase 9 item 4 (D-15..D-19): the shared three-card swipeable explainer teaching HSS, the
 * readiness band, and the trend up front — "what you learn is literally what TODAY shows"
 * (D-18). Rendered by TWO thin route wrappers:
 *   - app/onboarding/explainer.tsx (wizard step 1, gated behind Stack.Protected's
 *     `!hasProfile` guard in app/_layout.tsx)
 *   - app/explainer.tsx (top-level standalone route — NOT under onboarding/ or (tabs)/) so
 *     it stays reachable once `hasProfile` flips true. The entire `onboarding` segment is a
 *     single nested Stack gated off by Stack.Protected once a profile exists — a Settings
 *     row pushing into `/onboarding/explainer` would silently fail to navigate for existing
 *     testers, defeating D-19's entire purpose (existing build-9 testers discovering this
 *     from Settings). Splitting the reachable route out of the guarded group, while keeping
 *     the card content itself here in one shared component, is the fix (Rule 2 deviation —
 *     09-08-PLAN.md's declared file list assumed a route-param toggle on one file would be
 *     enough; that assumption breaks under the guard architecture).
 *
 * Both wrappers pass sample data only (D-18) — this component never reads the DB, matching
 * T-09-13's mitigation (no profile/HSS read before onboarding completes).
 */

import { useRef, useState } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReadinessBand } from '@apsis/shared';

import HssRing from '../home/HssRing';
import ReadinessLight from '../home/ReadinessLight';
import TrendChart, { type TrendChartPoint } from '../home/TrendChart';
import Colors from '../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography } from '../../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Card 1 (HSS ring) sample — 'green' is deliberate: it is this card's one volt hero
// (DESIGN-SYSTEM.md §7 one-volt-per-screen), same rule WizardStep's Continue button
// already sidesteps by using bone/ghost styling below.
const SAMPLE_HSS = 132;
const SAMPLE_HSS_BAND: ReadinessBand = 'green';

// Card 2 (readiness light) sample — deliberately NOT 'green': ReadinessLight's 'green'
// state renders in volt too (BAND_COLOR.green === Colors.dark.accent), which would put a
// second volt element on this card alongside card 1's ring. 'amber' keeps every card to
// exactly one volt element total across the whole explainer (only card 1's ring).
const SAMPLE_READINESS_BAND: ReadinessBand = 'amber';

// Card 3 (trend chart) sample — 14-day window matching the engine's calibration period;
// ATL/CTL render in bone/ash (TrendChart never uses volt), so no conflict here either.
const SAMPLE_TREND: TrendChartPoint[] = [
  { day: 0, hss: 58, atl: 40, ctl: 38, tsb: -2, dateLabel: 'JUL 1' },
  { day: 1, hss: 0, atl: 37, ctl: 38, tsb: 1, dateLabel: 'JUL 2' },
  { day: 2, hss: 74, atl: 44, ctl: 40, tsb: -4, dateLabel: 'JUL 3' },
  { day: 3, hss: 0, atl: 40, ctl: 40, tsb: 0, dateLabel: 'JUL 4' },
  { day: 4, hss: 91, atl: 49, ctl: 43, tsb: -6, dateLabel: 'JUL 5' },
  { day: 5, hss: 62, atl: 49, ctl: 45, tsb: -4, dateLabel: 'JUL 6' },
  { day: 6, hss: 0, atl: 44, ctl: 45, tsb: 1, dateLabel: 'JUL 7' },
  { day: 7, hss: 118, atl: 55, ctl: 49, tsb: -6, dateLabel: 'JUL 8' },
  { day: 8, hss: 47, atl: 52, ctl: 49, tsb: -3, dateLabel: 'JUL 9' },
  { day: 9, hss: 0, atl: 47, ctl: 49, tsb: 2, dateLabel: 'JUL 10' },
  { day: 10, hss: 103, atl: 55, ctl: 52, tsb: -3, dateLabel: 'JUL 11' },
  { day: 11, hss: 68, atl: 55, ctl: 53, tsb: -2, dateLabel: 'JUL 12' },
  { day: 12, hss: 0, atl: 50, ctl: 53, tsb: 3, dateLabel: 'JUL 13' },
  { day: 13, hss: 132, atl: 58, ctl: 55, tsb: -3, dateLabel: 'JUL 14' },
];

export type ExplainerMode = 'wizard' | 'standalone';

export interface ExplainerCardsProps {
  /** 'wizard' shows Skip/Get started copy; 'standalone' shows Close/Done copy (D-19). */
  mode: ExplainerMode;
  /** Called from Skip/Close AND from the final card's Continue/Done button — both
   * affordances dismiss the explainer the same way, only the label differs by mode. */
  onDone: () => void;
}

type CardId = 'hss' | 'readiness' | 'trend';

interface CardSpec {
  id: CardId;
  kicker: string;
  title: string;
  copy: string;
  mathCopy: string;
}

// D-17 two-layer content: the front conceptual copy stays terse/athlete-direct; "the math"
// on each card carries its own slice of the full ATL/CTL/TSB/14-day-calibration explanation
// (distributed across the three cards rather than repeated verbatim on each one).
const CARDS: ReadonlyArray<CardSpec> = [
  {
    id: 'hss',
    kicker: 'CARD 1 / 3',
    title: 'One number for everything',
    copy: 'You lift. You run. One number tells you what it cost. Hybrid Stress Score (HSS) turns a squat session and a threshold run into the same unit.',
    mathCopy:
      'Strength stress comes from load, reps, and RPE per set. Endurance stress comes from duration and intensity relative to your threshold pace/HR. Both land on the same HSS scale — a hard 5x5 squat session and a 60-minute threshold run both land near 100 HSS — so lifting and running finally share a currency.',
  },
  {
    id: 'readiness',
    kicker: 'CARD 2 / 3',
    title: 'A verdict, not just a number',
    copy: 'Every day gets a readiness call: green means primed, amber means hold steady, red means you are overreaching. No guessing.',
    mathCopy:
      'Readiness comes from Training Stress Balance (TSB = CTL − ATL) — the gap between your longer-term fitness (CTL, chronic load) and your recent fatigue (ATL, acute load). A big negative TSB means fatigue is outrunning fitness (red); a balanced or positive TSB means you can push (green).',
  },
  {
    id: 'trend',
    kicker: 'CARD 3 / 3',
    title: 'Trend, not just today',
    copy: 'ATL (acute) and CTL (chronic) plot your load over the last month, so a heavy week or a taper actually shows up — not just one day floating alone.',
    mathCopy:
      'ATL is a 7-day exponentially-weighted average of daily HSS; CTL is the same math over 28 days. Both need real data to mean anything, so the app runs a 14-day calibration window after you start logging before it shows a readiness verdict — you will see "BUILDING TREND · DAY N/14" until then.',
  },
];

export function ExplainerCards({ mode, onDone }: ExplainerCardsProps): React.JSX.Element {
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [expanded, setExpanded] = useState<Record<CardId, boolean>>({
    hss: false,
    readiness: false,
    trend: false,
  });

  const isLastCard = pageIndex === CARDS.length - 1;
  const dismissLabel = mode === 'wizard' ? 'Skip' : 'Close';
  const primaryLabel = isLastCard ? (mode === 'wizard' ? 'Get started' : 'Done') : 'Continue';

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  function toggleMath(id: CardId): void {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handlePrimaryPress(): void {
    if (isLastCard) {
      onDone();
      return;
    }
    const next = pageIndex + 1;
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    setPageIndex(next);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          style={styles.dismissButton}>
          <Text style={styles.dismissLabel}>{dismissLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}>
        {CARDS.map((card) => (
          <View key={card.id} style={[styles.card, { width: SCREEN_WIDTH }]}>
            <Text style={styles.kicker}>{card.kicker}</Text>
            <View style={styles.hero}>{renderHero(card.id)}</View>
            <Text style={styles.title}>{card.title}</Text>
            <Text style={styles.copy}>{card.copy}</Text>
            <Pressable
              onPress={() => toggleMath(card.id)}
              accessibilityRole="button"
              accessibilityLabel={expanded[card.id] ? 'Hide the math' : 'Show the math'}
              style={styles.mathToggle}>
              <Text style={styles.mathToggleLabel}>
                {expanded[card.id] ? 'THE MATH ▾' : 'THE MATH ▸'}
              </Text>
            </Pressable>
            {expanded[card.id] ? <Text style={styles.mathCopy}>{card.mathCopy}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <View
        style={styles.pageDots}
        accessibilityRole="progressbar"
        accessibilityLabel={`Card ${pageIndex + 1} of ${CARDS.length}`}>
        {CARDS.map((card, index) => (
          <View
            key={card.id}
            style={[styles.dot, index === pageIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>

      {/* Continue/Skip/Close/Done are deliberately NON-volt (ghost, bone text/border) — the
       * HSS ring on card 1 is this explainer's one volt element (DESIGN-SYSTEM.md §7). */}
      <Pressable
        onPress={handlePrimaryPress}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
        <Text style={styles.primaryLabel}>{primaryLabel}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function renderHero(id: CardId): React.JSX.Element {
  if (id === 'hss') {
    return <HssRing size={200} hss={SAMPLE_HSS} band={SAMPLE_HSS_BAND} animate={false} />;
  }
  if (id === 'readiness') {
    return <ReadinessLight band={SAMPLE_READINESS_BAND} />;
  }
  return <TrendChart data={SAMPLE_TREND} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  dismissButton: {
    minHeight: HIT_TARGET_MIN,
    minWidth: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  dismissLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
  },
  pager: {
    flex: 1,
  },
  card: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  kicker: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.xl,
  },
  hero: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.heading,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  copy: {
    ...Typography.body,
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  mathToggle: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  mathToggleLabel: {
    ...Mono,
    color: Colors.dark.accent,
  },
  mathCopy: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.dark.accent,
  },
  dotInactive: {
    backgroundColor: Colors.dark.border,
  },
  primaryButton: {
    minHeight: 48,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    backgroundColor: Colors.dark.steel,
  },
  primaryLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
