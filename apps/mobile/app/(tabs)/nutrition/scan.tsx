/**
 * apps/mobile/app/(tabs)/nutrition/scan.tsx — barcode scan screen (NUTR-08/09/10/22)
 *
 * Lookup chain (07-RESEARCH.md Barcode Scan Flow): CameraView.onBarcodeScanned -> local
 * `food` WHERE barcode=? (instant, offline, `findFoodByBarcode`) -> on miss, `offLookupBarcode`
 * (network, timeout-guarded) -> OFF hit: upsert `food` (source='off') -> confirm; OFF miss
 * (status:0 OR incomplete macros, Pitfall 7) -> fall through to the manual/custom-food entry
 * screen (`nutrition/log.tsx`, built in 07-06) — NEVER a dead end (NUTR-10).
 *
 * Permission gating follows `onboarding/healthkit.tsx`'s guard-flag + try/catch/finally +
 * loading-state shape exactly (07-PATTERNS.md), wrapping `requestCameraPermission`
 * (nutritionCameraAuth.ts, 07-07) rather than expo-camera's permission API directly.
 *
 * Barcode types are restricted to EAN-13/EAN-8/UPC-A/UPC-E — the actual product-barcode
 * symbologies OFF indexes against. QR is deliberately EXCLUDED here (diverges from the
 * RESEARCH.md sketch, which listed it for completeness): a QR hit would attempt an OFF product
 * lookup against non-barcode data, a confusing miss for no benefit on a food-logging screen.
 *
 * NUTR-22 (T-07-17, Information disclosure — mitigate): no barcode or macro value is ever
 * attached to a Sentry breadcrumb/extra/context call in this file — only a hardcoded
 * `[Apsis]`-prefixed string reaches `console.error` on failure (matches nutrition/index.tsx's
 * own convention). `sentrySanitize.ts`'s allowlist filter additionally guarantees this
 * structurally even if a future call site slipped up.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import { randomUUID } from 'expo-crypto';
import { db, food, findFoodByBarcode } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Radius, Spacing, Typography } from '../../../constants/theme';
import { offLookupBarcode } from '../../../lib/offClient';
import { requestCameraPermission } from '../../../lib/nutritionCameraAuth';

const PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

interface BarcodeScanResult {
  type: string;
  data: string;
}

export default function ScanScreen(): React.JSX.Element {
  const router = useRouter();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedFood, setSelectedFood] = useState<ConfirmableFood | null>(null);
  const scanningRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    void checkPermission();
  }, []);

  async function checkPermission(): Promise<void> {
    if (requestingPermission) return;
    setRequestingPermission(true);
    try {
      const granted = await requestCameraPermission();
      setPermissionGranted(granted);
    } catch (err: unknown) {
      // requestCameraPermission never throws (nutritionCameraAuth.ts), but the guard-flag +
      // try/catch/finally shape is the house convention (healthkit.tsx precedent) — keep it.
      console.error('[Apsis] Camera permission check failed:', err);
      setPermissionGranted(false);
    } finally {
      setRequestingPermission(false);
    }
  }

  async function handleBarcodeScanned({ data }: BarcodeScanResult): Promise<void> {
    if (scanningRef.current || selectedFood != null || data === lastCodeRef.current) return;
    scanningRef.current = true;
    lastCodeRef.current = data;
    setScanning(true);
    try {
      // Step 1: local cache (instant, offline) — never touches the network for a repeat scan.
      const localRows = await findFoodByBarcode(db, data);
      const localFood = localRows[0];
      if (localFood != null) {
        setSelectedFood({
          id: localFood.id,
          name: localFood.name,
          brand: localFood.brand,
          kcalPer100g: localFood.kcalPer100g,
          proteinGPer100g: localFood.proteinGPer100g,
          carbGPer100g: localFood.carbGPer100g,
          fatGPer100g: localFood.fatGPer100g,
          servingName: localFood.servingName,
          servingGrams: localFood.servingGrams,
        });
        return;
      }

      // Step 2: OFF network lookup (timeout-guarded, never throws — offClient.ts).
      const offProduct = await offLookupBarcode(data);
      if (offProduct == null) {
        // Miss (status:0 or incomplete macros) — NEVER a dead end (NUTR-10): fall through to
        // manual/custom entry rather than leaving the user stuck on the scan screen.
        router.push('/(tabs)/nutrition/log');
        return;
      }

      const id = randomUUID();
      await db.insert(food).values({
        id,
        name: offProduct.name,
        brand: offProduct.brand,
        barcode: data,
        source: 'off',
        kcalPer100g: offProduct.kcalPer100g,
        proteinGPer100g: offProduct.proteinGPer100g,
        carbGPer100g: offProduct.carbGPer100g,
        fatGPer100g: offProduct.fatGPer100g,
        fiberGPer100g: offProduct.fiberGPer100g ?? null,
        sodiumMgPer100g: offProduct.sodiumMgPer100g ?? null,
        servingName: offProduct.servingName,
        servingGrams: offProduct.servingGrams,
      });
      setSelectedFood({
        id,
        name: offProduct.name,
        brand: offProduct.brand,
        kcalPer100g: offProduct.kcalPer100g,
        proteinGPer100g: offProduct.proteinGPer100g,
        carbGPer100g: offProduct.carbGPer100g,
        fatGPer100g: offProduct.fatGPer100g,
        servingName: offProduct.servingName,
        servingGrams: offProduct.servingGrams,
      });
    } catch (err: unknown) {
      console.error('[Apsis] Barcode lookup chain failed:', err);
      // Still never a dead end, even on an unexpected error.
      router.push('/(tabs)/nutrition/log');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }

  function handleSheetClose(): void {
    setSelectedFood(null);
    // Allow rescanning the same code (e.g. logging a second unit of the same item).
    lastCodeRef.current = null;
  }

  if (permissionGranted == null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.dark.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permissionGranted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.deniedContainer}>
          <ScreenHeader kicker="NUTRITION" title="Scan" style={styles.screenHeader} />
          <Text style={styles.deniedText}>
            Camera access is off. Enable it in system Settings to scan a barcode — or use manual
            entry instead.
          </Text>
          <Pressable
            onPress={() => {
              void Linking.openSettings();
            }}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            style={styles.deniedButton}>
            <Text style={styles.deniedButtonLabel}>Open Settings</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/nutrition/log')}
            accessibilityRole="button"
            accessibilityLabel="Enter food manually"
            style={styles.manualButton}>
            <Text style={styles.manualButtonLabel}>Enter food manually</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader kicker="NUTRITION" title="Scan" style={styles.screenHeader} />
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: [...PRODUCT_BARCODE_TYPES] }}
          onBarcodeScanned={(result) => {
            void handleBarcodeScanned(result);
          }}
        />
        {scanning ? (
          <View style={styles.scanningOverlay}>
            <ActivityIndicator color={Colors.dark.accent} />
            <Text style={styles.scanningText}>Looking up product…</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={() => router.push('/(tabs)/nutrition/log')}
        disabled={scanning}
        accessibilityRole="button"
        accessibilityLabel="Enter food manually instead"
        style={[styles.manualLink, scanning && styles.manualLinkDisabled]}>
        <Text style={styles.manualLinkLabel}>Enter food manually instead</Text>
      </Pressable>

      <FoodConfirmSheet visible={selectedFood != null} food={selectedFood} onClose={handleSheetClose} />
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
  },
  screenHeader: {
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.dark.steel,
  },
  camera: {
    flex: 1,
  },
  scanningOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanningText: {
    ...Typography.label,
    color: Colors.dark.text,
  },
  manualLink: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
  },
  manualLinkDisabled: {
    opacity: DISABLED_OPACITY,
  },
  manualLinkLabel: {
    ...Typography.body,
    color: Colors.dark.mutedText,
  },
  deniedContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  deniedText: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xl,
  },
  deniedButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  deniedButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  manualButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  manualButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
