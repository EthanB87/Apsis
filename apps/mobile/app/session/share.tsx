/**
 * apps/mobile/app/session/share.tsx
 *
 * Share-card compose screen (D-12) -- the end-to-end path 08-02 proved as a tracer.
 * Reached from finish.tsx's bone "Share card" button AND detail.tsx's Share entry point
 * (D-11) with a `workoutId` param. Re-derives the card's data straight from SQLite in a
 * `useEffect` keyed on `workoutId` (same cancelled-guard + try/catch + `[Apsis]`-prefixed
 * error-log shape as finish.tsx/detail.tsx -- "SQLite is truth"). Reads `workout.hss`
 * DIRECTLY off the persisted row -- this screen NEVER calls `sessionHSSDetailed` or any
 * other re-derivation, since a third independent computation could drift from the value
 * finish.tsx already computed and persisted (08-RESEARCH.md Anti-Pattern).
 *
 * 08-03 extends the query to also fetch the D-03 stat-trio inputs: for strength/hybrid,
 * total non-warmup volume + work-set count (same strengthSet/exercise join finish.tsx uses)
 * plus the lift session duration derived from workout.createdAt -> workout.finishedAt (the
 * same two session-boundary timestamps healthkitWriteback.ts uses); for endurance, the
 * summed endurance_segment distance/duration with pace derived from distance/duration
 * (divide-by-zero guarded, matching finish.tsx's formatEnduranceSummary convention).
 *
 * This screen renders only the D-07 no-photo void card -- the photo-pick flow (D-06/D-08/
 * D-15/D-16) is added by 08-04 on top of this same compose route.
 *
 * The Share button is the primary CTA on this screen, so it is volt-filled (the
 * one-volt-per-screen rule is scoped per-screen, and this screen has no other volt fill).
 * It stays disabled until the canvas has settled after its first paint (Pitfall 4 -- Skia's
 * `makeImageSnapshot()` can return null or a stale/blank frame if called before the first
 * layout/paint has flushed).
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, enduranceSegment, exercise as exerciseTable, strengthSet, workout } from '@apsis/db';
import { useCanvasRef } from '@shopify/react-native-skia';

import ShareCardCanvas, { SHARE_CARD_SIZE } from '../../components/share/ShareCardCanvas';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';
import { fetchProfileSummary } from '../../lib/commitSet';
import { exportAndShareCard } from '../../lib/shareCardExport';
import {
  buildEnduranceStatTrio,
  buildShareCaption,
  buildStrengthStatTrio,
  type ShareSessionType,
  type ShareStatPair,
} from '../../lib/shareCard';

// Pitfall 4: a short mount-settle delay after the card's data has loaded, gating the Share
// button until the Canvas has had at least one full render/paint cycle to flush.
const CANVAS_SETTLE_MS = 400;

export default function ShareScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ workoutId: string }>();
  const workoutId = params.workoutId;
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const canvasRef = useCanvasRef();

  const [hss, setHss] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [statTrio, setStatTrio] = useState<ShareStatPair[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await fetchProfileSummary(db);

        const rows = await db
          .select({
            type: workout.type,
            hss: workout.hss,
            localDate: workout.localDate,
            createdAt: workout.createdAt,
            finishedAt: workout.finishedAt,
          })
          .from(workout)
          .where(eq(workout.id, workoutId));
        const w = rows[0];
        if (!w) {
          if (!cancelled) {
            setHss(0);
            setStatTrio([]);
          }
          return;
        }

        // Anything non-endurance (strength, hybrid) captions as LIFT.
        const sessionType: ShareSessionType = w.type === 'endurance' ? 'endurance' : 'strength';

        let trio: ShareStatPair[];
        if (sessionType === 'endurance') {
          // D-03: sum across every endurance_segment row (usually one), never re-deriving HSS.
          const segmentRows = await db
            .select({ distanceM: enduranceSegment.distanceM, durationS: enduranceSegment.durationS })
            .from(enduranceSegment)
            .where(eq(enduranceSegment.workoutId, workoutId));

          const totalDurationS = segmentRows.reduce((sum, seg) => sum + seg.durationS, 0);
          const hasDistance = segmentRows.some((seg) => seg.distanceM != null);
          const totalDistanceM = hasDistance
            ? segmentRows.reduce((sum, seg) => sum + (seg.distanceM ?? 0), 0)
            : null;
          const paceSecPerKm =
            totalDistanceM != null && totalDistanceM > 0 ? totalDurationS / (totalDistanceM / 1000) : null;

          trio = buildEnduranceStatTrio(
            { distanceM: totalDistanceM, paceSecPerKm, durationS: totalDurationS },
            profile.units
          );
        } else {
          // strength (and hybrid) -- same strengthSet/exercise join finish.tsx/detail.tsx use.
          const setRows = await db
            .select({
              loadKg: strengthSet.loadKg,
              reps: strengthSet.reps,
              isWarmup: strengthSet.isWarmup,
              entryMode: exerciseTable.entryMode,
            })
            .from(strengthSet)
            .innerJoin(exerciseTable, eq(strengthSet.exerciseId, exerciseTable.id))
            .where(eq(strengthSet.workoutId, workoutId));

          let totalVolumeKg = 0;
          let setCount = 0;
          for (const row of setRows) {
            if (row.isWarmup) continue;
            setCount += 1;
            if (row.entryMode !== 'timed') totalVolumeKg += row.loadKg * row.reps;
          }

          // Lift session duration: the same two session-boundary timestamps
          // healthkitWriteback.ts uses. finishedAt may still be null on the D-14 crash-resume
          // path reached before a Done tap -- degrade to 0 rather than throwing.
          const durationS =
            w.finishedAt != null && w.createdAt != null
              ? Math.max(0, Math.round((w.finishedAt.getTime() - w.createdAt.getTime()) / 1000))
              : 0;

          trio = buildStrengthStatTrio({ totalVolumeKg, setCount, durationS }, profile.units);
        }

        if (!cancelled) {
          setHss(w.hss ?? 0);
          setCaption(buildShareCaption(sessionType, w.localDate));
          setStatTrio(trio);
        }
      } catch (err: unknown) {
        console.error('[Apsis] share.tsx workout query failed:', err);
        if (!cancelled) {
          setHss(0);
          setStatTrio([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  // Pitfall 4: only enable Share once the card has real data AND the canvas has settled.
  useEffect(() => {
    if (hss == null) return;
    const timer = setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hss]);

  async function handleShare(): Promise<void> {
    if (!canvasReady || sharing) return;
    setSharing(true);
    try {
      await exportAndShareCard(canvasRef);
    } catch (err: unknown) {
      // Defense in depth -- exportAndShareCard never throws, but this screen still guards.
      console.error('[Apsis] share.tsx export failed:', err);
    } finally {
      setSharing(false);
    }
  }

  const previewSize = windowWidth - Spacing.xl * 2;
  const previewScale = previewSize / SHARE_CARD_SIZE;
  const shareDisabled = !canvasReady || sharing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          style={styles.closeButton}>
          <Text style={styles.closeGlyph}>×</Text>
        </Pressable>
      </View>

      <View style={styles.cardArea}>
        <View style={[styles.previewClip, { width: previewSize, height: previewSize }]}>
          <View
            style={[
              styles.previewScale,
              { width: SHARE_CARD_SIZE, height: SHARE_CARD_SIZE, transform: [{ scale: previewScale }] },
            ]}>
            <ShareCardCanvas hss={hss ?? 0} caption={caption} statTrio={statTrio} canvasRef={canvasRef} />
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => void handleShare()}
        disabled={shareDisabled}
        accessibilityRole="button"
        accessibilityLabel="Share"
        accessibilityState={{ disabled: shareDisabled }}
        style={({ pressed }) => [
          styles.shareButton,
          shareDisabled && styles.shareButtonDisabled,
          pressed && !shareDisabled && styles.shareButtonPressed,
        ]}>
        <Text style={[styles.shareButtonLabel, shareDisabled && styles.shareButtonLabelDisabled]}>
          {sharing ? 'Sharing…' : 'Share'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
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
  },
  closeButton: {
    minWidth: HIT_TARGET_MIN,
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    ...Typography.heading,
    color: Colors.dark.mutedText,
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  previewClip: {
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  previewScale: {
    // transformOrigin keeps the scaled-down 1080x1080 canvas anchored to the clip
    // container's top-left corner rather than scaling around its own center.
    transformOrigin: 'top left',
  },
  shareButton: {
    minHeight: 48,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: Colors.dark.steel,
    opacity: DISABLED_OPACITY,
  },
  shareButtonPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  shareButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  shareButtonLabelDisabled: {
    color: Colors.dark.mutedText,
  },
});
