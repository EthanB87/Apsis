/**
 * apps/mobile/app/(tabs)/nutrition/label-scan.tsx — nutrition-label OCR screen (NUTR-11/12/09/22)
 *
 * Flow (07-RESEARCH.md Label OCR Flow, fully on-device, no network):
 *   CameraView.takePictureAsync -> {uri} -> expo-text-extractor's extractTextFromImage(uri)
 *   -> string[] -> labelOcrParse(lines) -> a pre-filled, editable custom-food form -> "Save &
 *   log" inserts `food` (source='user') -> the shared FoodConfirmSheet (qty/meal) -> `food_log`.
 *
 * Security (T-07-20, Tampering/data-integrity — mitigate): `labelOcrParse` already bounds-checks
 * every extracted numeric (dropping negative/absurd values to `undefined`, never `0`) before
 * this screen ever sees it. This screen adds the SECOND half of the mitigation NUTR-09 requires:
 * the parsed values only pre-fill editable text fields — nothing reaches the `food` table until
 * the user reviews/corrects them and explicitly taps "Save & log". `FoodConfirmSheet` itself has
 * no macro-editing UI (it only edits qty/meal, see its own module doc comment) — the review/edit
 * step for the OCR-parsed macros has to happen here, in this screen's own form, mirroring
 * `nutrition/log.tsx`'s "Custom food" mode exactly (same pre-food-row edit-then-save shape).
 *
 * Security (T-07-22, Denial of Service — mitigate): an OCR extraction failure, or a photo with
 * no recognizable label text, still lands on the same editable form with every field simply
 * blank — never a dead end back to the camera with no path forward.
 *
 * Permission gating follows `onboarding/healthkit.tsx`'s guard-flag + try/catch/finally +
 * loading-state shape (07-PATTERNS.md), wrapping `requestCameraPermission`
 * (nutritionCameraAuth.ts, 07-07) exactly like `scan.tsx`'s barcode screen does.
 *
 * NUTR-22 (T-07-17, Information disclosure — mitigate): no kcal/macro/OCR-text value is ever
 * attached to a Sentry breadcrumb/extra/context call in this file — only a hardcoded
 * `[Apsis]`-prefixed string reaches `console.error` on failure.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView } from 'expo-camera';
import { extractTextFromImage } from 'expo-text-extractor';
import { randomUUID } from 'expo-crypto';
import { db, food } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { DISABLED_OPACITY, HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../../constants/theme';
import { labelOcrParse, type LabelOcrResult } from '../../../lib/labelOcrParse';
import { requestCameraPermission } from '../../../lib/nutritionCameraAuth';

const CAPTURE_ERROR_MESSAGE = "Couldn't capture the label. Try again.";
const SAVE_ERROR_MESSAGE = "Couldn't save that food. Nothing was lost — try again.";

function parseNumberInput(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function numberToText(value: number | undefined): string {
  return value != null ? String(value) : '';
}

export default function LabelScanScreen(): React.JSX.Element {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const [reviewing, setReviewing] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [carbText, setCarbText] = useState('');
  const [fatText, setFatText] = useState('');
  const [servingNameText, setServingNameText] = useState('');
  const [servingGramsText, setServingGramsText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdFood, setCreatedFood] = useState<ConfirmableFood | null>(null);

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

  function applyParsed(parsed: LabelOcrResult): void {
    setKcalText(numberToText(parsed.kcalPer100g));
    setProteinText(numberToText(parsed.proteinGPer100g));
    setCarbText(numberToText(parsed.carbGPer100g));
    setFatText(numberToText(parsed.fatGPer100g));
    setServingNameText(parsed.servingName ?? '');
    setServingGramsText(numberToText(parsed.servingGrams));
  }

  async function handleCapture(): Promise<void> {
    if (capturing) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
      if (photo?.uri == null) {
        setCaptureError(CAPTURE_ERROR_MESSAGE);
        return;
      }

      let lines: string[] = [];
      try {
        lines = await extractTextFromImage(photo.uri);
      } catch (err: unknown) {
        // T-07-22: an OCR failure is never a dead end — fall through to a blank, fully manual
        // review form rather than stranding the user on the camera screen.
        console.error('[Apsis] Label OCR extraction failed:', err);
        lines = [];
      }

      applyParsed(labelOcrParse(lines));
      setReviewing(true);
    } catch (err: unknown) {
      console.error('[Apsis] Label photo capture failed:', err);
      setCaptureError(CAPTURE_ERROR_MESSAGE);
    } finally {
      setCapturing(false);
    }
  }

  function resetToCamera(): void {
    setReviewing(false);
    setName('');
    setBrand('');
    setKcalText('');
    setProteinText('');
    setCarbText('');
    setFatText('');
    setServingNameText('');
    setServingGramsText('');
    setCreateError(null);
  }

  const canSave = name.trim().length > 0 && !creating;

  async function handleSaveAndLog(): Promise<void> {
    if (!canSave) return;
    setCreating(true);
    setCreateError(null);
    try {
      const id = randomUUID();
      const newFood: ConfirmableFood = {
        id,
        name: name.trim(),
        brand: brand.trim().length > 0 ? brand.trim() : null,
        kcalPer100g: parseNumberInput(kcalText),
        proteinGPer100g: parseNumberInput(proteinText),
        carbGPer100g: parseNumberInput(carbText),
        fatGPer100g: parseNumberInput(fatText),
        servingName: servingNameText.trim().length > 0 ? servingNameText.trim() : null,
        servingGrams: servingGramsText.trim().length > 0 ? parseNumberInput(servingGramsText) : null,
      };
      // NUTR-12: every confirmed label scan saves as a custom food, source='user'. This is the
      // FIRST write in the flow — nothing was written directly from OCR (NUTR-09/T-07-20).
      await db.insert(food).values({
        id,
        name: newFood.name,
        brand: newFood.brand,
        source: 'user',
        kcalPer100g: newFood.kcalPer100g,
        proteinGPer100g: newFood.proteinGPer100g,
        carbGPer100g: newFood.carbGPer100g,
        fatGPer100g: newFood.fatGPer100g,
        servingName: newFood.servingName,
        servingGrams: newFood.servingGrams,
      });
      setCreatedFood(newFood);
    } catch (err: unknown) {
      console.error('[Apsis] Failed to save scanned label as a custom food:', err);
      setCreateError(SAVE_ERROR_MESSAGE);
    } finally {
      setCreating(false);
    }
  }

  function handleSheetClose(): void {
    setCreatedFood(null);
  }

  function handleLogged(): void {
    resetToCamera();
    if (router.canGoBack()) router.back();
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
          <ScreenHeader kicker="NUTRITION" title="Scan label" style={styles.screenHeader} />
          <Text style={styles.deniedText}>
            Camera access is off. Enable it in system Settings to scan a nutrition label — or use
            manual entry instead.
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

  if (reviewing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ScreenHeader kicker="NUTRITION" title="Confirm label" style={styles.screenHeader} />
          <Text style={styles.reviewHint}>
            Check the scanned values below — fix anything that looks off before saving.
          </Text>

          <Text style={styles.sectionLabel}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Protein bar"
            placeholderTextColor={Colors.dark.mutedText}
            style={styles.textInput}
            accessibilityLabel="Food name"
          />

          <Text style={styles.sectionLabel}>Brand (optional)</Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Quest"
            placeholderTextColor={Colors.dark.mutedText}
            style={styles.textInput}
            accessibilityLabel="Brand"
          />

          <Text style={styles.sectionLabel}>Per 100g</Text>
          <View style={styles.macroGrid}>
            <MacroField label="KCAL" value={kcalText} onChangeText={setKcalText} />
            <MacroField label="PROTEIN G" value={proteinText} onChangeText={setProteinText} />
            <MacroField label="CARB G" value={carbText} onChangeText={setCarbText} />
            <MacroField label="FAT G" value={fatText} onChangeText={setFatText} />
          </View>

          <Text style={styles.sectionLabel}>Serving (optional)</Text>
          <View style={styles.servingRow}>
            <TextInput
              value={servingNameText}
              onChangeText={setServingNameText}
              placeholder="e.g. 1 cup"
              placeholderTextColor={Colors.dark.mutedText}
              style={[styles.textInput, styles.servingNameInput]}
              accessibilityLabel="Serving name"
            />
            <TextInput
              value={servingGramsText}
              onChangeText={(t) => setServingGramsText(t.replace(/[^0-9.]/g, ''))}
              placeholder="grams"
              placeholderTextColor={Colors.dark.mutedText}
              keyboardType="decimal-pad"
              style={[styles.numericInput, styles.servingGramsInput, tabularNums]}
              accessibilityLabel="Serving grams"
            />
          </View>

          {createError != null ? <Text style={styles.errorText}>{createError}</Text> : null}

          <Pressable
            onPress={() => {
              void handleSaveAndLog();
            }}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save custom food"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}>
            <Text style={styles.primaryButtonLabel}>{creating ? 'Saving…' : 'Save & log'}</Text>
          </Pressable>

          <Pressable
            onPress={resetToCamera}
            disabled={creating}
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
            style={[styles.retakeLink, creating && styles.retakeLinkDisabled]}>
            <Text style={styles.retakeLinkLabel}>Retake photo</Text>
          </Pressable>
        </ScrollView>

        <FoodConfirmSheet visible={createdFood != null} food={createdFood} onClose={handleSheetClose} onLogged={handleLogged} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader kicker="NUTRITION" title="Scan label" style={styles.screenHeader} />
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} />
        {capturing ? (
          <View style={styles.scanningOverlay}>
            <ActivityIndicator color={Colors.dark.accent} />
            <Text style={styles.scanningText}>Reading label…</Text>
          </View>
        ) : null}
      </View>

      {captureError != null ? <Text style={styles.captureErrorText}>{captureError}</Text> : null}

      <Pressable
        onPress={() => {
          void handleCapture();
        }}
        disabled={capturing}
        accessibilityRole="button"
        accessibilityLabel="Capture nutrition label"
        accessibilityState={{ disabled: capturing }}
        style={[styles.captureButton, capturing && styles.captureButtonDisabled]}>
        <Text style={styles.captureButtonLabel}>{capturing ? 'Reading…' : 'Capture label'}</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(tabs)/nutrition/log')}
        disabled={capturing}
        accessibilityRole="button"
        accessibilityLabel="Enter food manually instead"
        style={[styles.manualLink, capturing && styles.manualLinkDisabled]}>
        <Text style={styles.manualLinkLabel}>Enter food manually instead</Text>
      </Pressable>
    </SafeAreaView>
  );
}

interface MacroFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}

function MacroField({ label, value, onChangeText }: MacroFieldProps): React.JSX.Element {
  return (
    <View style={styles.macroField}>
      <Text style={styles.macroFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
        placeholder="0"
        placeholderTextColor={Colors.dark.mutedText}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={[styles.numericInput, tabularNums]}
        accessibilityLabel={label}
      />
    </View>
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
  captureErrorText: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  captureButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  captureButtonDisabled: {
    opacity: DISABLED_OPACITY,
  },
  captureButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  reviewHint: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    marginTop: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  textInput: {
    ...Typography.body,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.lg,
    minHeight: HIT_TARGET_MIN,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  macroField: {
    width: '47%',
  },
  macroFieldLabel: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.mutedText,
    marginBottom: Spacing.xs,
  },
  numericInput: {
    ...Typography.heading,
    color: Colors.dark.text,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.steel,
  },
  servingRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  servingNameInput: {
    flex: 2,
  },
  servingGramsInput: {
    flex: 1,
  },
  errorText: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginTop: Spacing.lg,
  },
  primaryButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxxl,
  },
  primaryButtonDisabled: {
    opacity: DISABLED_OPACITY,
  },
  primaryButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
  retakeLink: {
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  retakeLinkDisabled: {
    opacity: DISABLED_OPACITY,
  },
  retakeLinkLabel: {
    ...Typography.body,
    color: Colors.dark.mutedText,
  },
});
