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
 * 08-04 makes the compose flow photo-first (D-06): on mount, the screen auto-launches the
 * photo-permission + pick flow (mirrors `scan.tsx`'s guard-flag + try/catch/finally shape,
 * substituting `requestPhotoLibraryPermission`/`pickShareBackgroundPhoto` for the camera
 * equivalents), tracks the picked `selectedPhotoUri`, and offers a pick/swap affordance plus
 * an explicit skip. Denied permission shows an alert with an Open Settings deep-link
 * (`scan.tsx`'s denied-UI shape, D-16); denied, limited-access-empty, or an explicit skip all
 * fall back to the SAME void card (D-07) -- sharing is never blocked by any photo-pick edge
 * case. This is a one-time-pushed screen (like `detail.tsx`), so a plain mount-once
 * `useEffect` + ref guard is used, not `useFocusEffect`.
 *
 * The Share button is the primary CTA on this screen, so it is volt-filled (the
 * one-volt-per-screen rule is scoped per-screen, and this screen has no other volt fill).
 * It stays disabled until the canvas has settled after its first paint (Pitfall 4 -- Skia's
 * `makeImageSnapshot()` can return null or a stale/blank frame if called before the first
 * layout/paint has flushed).
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { eq } from 'drizzle-orm';
import { db, enduranceSegment, exercise as exerciseTable, strengthSet, workout } from '@apsis/db';
import { useCanvasRef } from '@shopify/react-native-skia';

import ShareCardCanvas, { SHARE_CARD_SIZE } from '../../components/share/ShareCardCanvas';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';
import { fetchProfileSummary } from '../../lib/commitSet';
import { exportAndShareCard, pickShareBackgroundPhoto, requestPhotoLibraryPermission } from '../../lib/shareCardExport';
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
  const [fontsReady, setFontsReady] = useState(false);
  // CR-01: mirrors ShareCardCanvas's onFontsReady gate -- true when there's no photo (or the
  // current photo's async decode has settled), false the instant a photo swap starts. Starts
  // `true` to match the initial void-card state (no photo picked yet).
  const [backgroundReady, setBackgroundReady] = useState(true);
  const [sharing, setSharing] = useState(false);

  // D-06: photo-first background pick state.
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const autoPromptedRef = useRef(false);

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

  // Pitfall 4 + font-load + background-load guard: only enable Share once the card has real
  // data, the Skia fonts have finished loading (a blank-text export would be indistinguishable
  // from a successful share -- see ShareCardCanvas.tsx's onFontsReady doc comment), the
  // background photo's decode has settled (CR-01 -- ShareCardCanvas's onBackgroundReady, same
  // reasoning: a stale/blank frame mid photo-swap would otherwise be indistinguishable from a
  // successful share), AND the canvas has settled. Re-arms whenever ANY of these flips back to
  // not-ready (in practice: a photo swap flips `backgroundReady` false) -- the guard is not a
  // one-way latch.
  useEffect(() => {
    if (hss == null || !fontsReady || !backgroundReady) {
      setCanvasReady(false);
      return;
    }
    const timer = setTimeout(() => setCanvasReady(true), CANVAS_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [hss, fontsReady, backgroundReady]);

  // D-06: the compose flow leads with picking a photo -- auto-launch once on mount. One-time
  // pushed screen (matches detail.tsx's plain-useEffect precedent), guarded by a ref so a
  // re-render never re-triggers the native picker a second time.
  useEffect(() => {
    if (autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void handleChoosePhoto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChoosePhoto(): Promise<void> {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    try {
      const { usable } = await requestPhotoLibraryPermission();
      if (!usable) {
        // D-16: explain with an alert + Open Settings deep-link, THEN fall back to the void
        // card -- sharing never hard-blocks on a denied/limited-empty photo permission.
        Alert.alert(
          'Photo access needed',
          'Enable Photos access in Settings to add a background photo to your share card.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]
        );
        setSelectedPhotoUri(null);
        return;
      }

      // Pitfall 5: limited access can still yield a canceled/empty pick -- null falls back to
      // the void card exactly like an explicit skip (D-07).
      const uri = await pickShareBackgroundPhoto();
      setSelectedPhotoUri(uri);
    } catch (err: unknown) {
      console.error('[Apsis] share.tsx photo pick flow failed:', err);
      setSelectedPhotoUri(null);
    } finally {
      setPickingPhoto(false);
    }
  }

  function handleSkipPhoto(): void {
    setSelectedPhotoUri(null);
  }

  async function handleShare(): Promise<void> {
    if (!canvasReady || sharing) return;
    setSharing(true);
    try {
      // WR-01: exportAndShareCard's documented contract is a `false` resolution (never a
      // throw) on any failure -- surface that to the user instead of silently discarding it.
      const shared = await exportAndShareCard(canvasRef);
      if (!shared) {
        Alert.alert('Share failed', 'Could not share this card. Please try again.');
      }
    } catch (err: unknown) {
      // Defense in depth -- exportAndShareCard never throws per its documented contract, but
      // this screen still guards against an unexpected exception, with the same user-facing
      // feedback as the documented `false` failure path above (IN-02).
      console.error('[Apsis] share.tsx export failed:', err);
      Alert.alert('Share failed', 'Could not share this card. Please try again.');
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
            <ShareCardCanvas
              hss={hss ?? 0}
              caption={caption}
              statTrio={statTrio}
              backgroundPhotoUri={selectedPhotoUri}
              canvasRef={canvasRef}
              onFontsReady={setFontsReady}
              onBackgroundReady={setBackgroundReady}
            />
          </View>
        </View>
      </View>

      <View style={styles.photoControlsRow}>
        <Pressable
          onPress={() => void handleChoosePhoto()}
          disabled={pickingPhoto}
          accessibilityRole="button"
          accessibilityLabel={selectedPhotoUri ? 'Swap photo' : 'Choose photo'}
          style={({ pressed }) => [
            styles.photoButton,
            pickingPhoto && styles.photoButtonDisabled,
            pressed && !pickingPhoto && styles.photoButtonPressed,
          ]}>
          <Text style={styles.photoButtonLabel}>
            {pickingPhoto ? 'Choosing…' : selectedPhotoUri ? 'Swap photo' : 'Choose photo'}
          </Text>
        </Pressable>
        {selectedPhotoUri == null ? (
          <Pressable
            onPress={handleSkipPhoto}
            disabled={pickingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Skip photo"
            style={styles.skipLink}>
            <Text style={styles.skipLinkLabel}>Skip</Text>
          </Pressable>
        ) : null}
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
  // D-06/D-12: bone-outlined pick/swap affordance (mirrors scan.tsx's manualButton shape),
  // plus a muted "Skip" text link (mirrors scan.tsx's manualLink) shown only pre-pick.
  photoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  photoButton: {
    minHeight: HIT_TARGET_MIN,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonDisabled: {
    opacity: DISABLED_OPACITY,
  },
  photoButtonPressed: {
    backgroundColor: Colors.dark.surface,
  },
  photoButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  skipLink: {
    minHeight: HIT_TARGET_MIN,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLinkLabel: {
    ...Typography.body,
    color: Colors.dark.mutedText,
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
