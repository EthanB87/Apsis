/**
 * apps/mobile/app/session/share.tsx
 *
 * Share-card compose screen (D-12) -- the tracer end-to-end path this plan proves (08-02).
 * Reached from finish.tsx's bone "Share card" button with a `workoutId` param. Re-derives
 * the card's data straight from SQLite in a `useEffect` keyed on `workoutId` (same
 * cancelled-guard + try/catch + `[Apsis]`-prefixed error-log shape as finish.tsx/detail.tsx --
 * "SQLite is truth"). Reads `workout.hss` DIRECTLY off the persisted row -- this screen NEVER
 * calls `sessionHSSDetailed` or any other re-derivation, since a third independent
 * computation could drift from the value finish.tsx already computed and persisted
 * (08-RESEARCH.md Anti-Pattern).
 *
 * This tracer plan renders only the D-07 no-photo void card -- the photo-pick flow (D-06/
 * D-08/D-15/D-16) is added by 08-03/08-04 on top of this same compose route.
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
import { db, workout } from '@apsis/db';
import { useCanvasRef } from '@shopify/react-native-skia';

import ShareCardCanvas, { SHARE_CARD_SIZE } from '../../components/share/ShareCardCanvas';
import Colors from '../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../constants/theme';
import { buildShareCaption, type ShareSessionType } from '../../lib/shareCard';
import { exportAndShareCard } from '../../lib/shareCardExport';

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
  const [canvasReady, setCanvasReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!workoutId) return;
    let cancelled = false;

    (async () => {
      try {
        const rows = await db
          .select({ type: workout.type, hss: workout.hss, localDate: workout.localDate })
          .from(workout)
          .where(eq(workout.id, workoutId));
        const w = rows[0];
        if (!w) {
          if (!cancelled) setHss(0);
          return;
        }

        // Anything non-endurance (strength, hybrid) captions as LIFT.
        const sessionType: ShareSessionType = w.type === 'endurance' ? 'endurance' : 'strength';

        if (!cancelled) {
          setHss(w.hss ?? 0);
          setCaption(buildShareCaption(sessionType, w.localDate));
        }
      } catch (err: unknown) {
        console.error('[Apsis] share.tsx workout query failed:', err);
        if (!cancelled) setHss(0);
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
            <ShareCardCanvas hss={hss ?? 0} caption={caption} canvasRef={canvasRef} />
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
