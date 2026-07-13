/**
 * apps/mobile/components/FoodConfirmSheet.tsx — shared food-log confirm/edit sheet
 * (NUTR-03/04/05/07, 07-RESEARCH.md system-architecture-diagram)
 *
 * The single confirm surface for logging a food: adjust qty (grams) and pick a meal, then
 * insert a denormalized `food_log` row via `buildFoodLogRow` (freeze-at-log-time, Pattern 2).
 * Food-source-agnostic by design — this sheet is reused as-is by the barcode flow (07-08) and
 * the label-OCR flow (07-09); it only needs a resolved `ConfirmableFood` (already has an `id`
 * and per-100g macros), never how that food was found.
 *
 * Sheet open/close ownership mirrors `ExercisePickerSheet.tsx`'s single-owner imperative-ref
 * pattern exactly (a `visible`-driven effect is the ONLY thing that calls `snapToIndex`/`close`)
 * — a second owner (e.g. deriving `index` from `visible` as a prop) is what caused the
 * open/close oscillation documented there; that lesson is intentionally not repeated here.
 *
 * Meal segmented control uses a bone active-fill (not volt) — the Log button below is already
 * this screen's one volt-filled element (DESIGN-SYSTEM.md §7 one-volt-per-screen rule; mirrors
 * the Nutrition Setup goal-mode selector's own bone-selected convention).
 *
 * Security/error-handling (T-1-01, house style): parameterized drizzle insert only; errors are
 * console.error'd with an `[Apsis]`-prefixed message — no kcal/macro value is ever attached to
 * a Sentry breadcrumb/extra/context call anywhere in this file (NUTR-22).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { randomUUID } from 'expo-crypto';
import { db, foodLog } from '@apsis/db';

import Colors from '../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../constants/theme';
import { buildFoodLogRow, type FoodPer100g, type Meal } from '../lib/logFood';
import { todayLocalDate } from '../lib/localDate';
import { useNutritionTargetSignal } from '../lib/nutritionTargetSignal';

/** The subset of a `food` row this sheet needs to preview + log — food-source-agnostic. */
export interface ConfirmableFood extends FoodPer100g {
  id: string;
  name: string;
  brand?: string | null;
  servingName?: string | null;
  servingGrams?: number | null;
}

export interface FoodConfirmSheetProps {
  visible: boolean;
  food: ConfirmableFood | null;
  onClose: () => void;
  /** Fires after a successful insert, before onClose. Optional — callers that don't need a
   * post-log hook (e.g. simple navigation) can omit it. */
  onLogged?: () => void;
}

const MEAL_OPTIONS: ReadonlyArray<{ value: Meal; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const LOG_ERROR_MESSAGE = "Couldn't log that food. Nothing was lost — try again.";
const DEFAULT_QTY_GRAMS = 100;

/** Time-of-day heuristic so the sheet opens with a sensible meal preselected — the user can
 * always override it before confirming. */
function defaultMealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function parseGramsInput(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function FoodConfirmSheet({ visible, food, onClose, onLogged }: FoodConfirmSheetProps): React.JSX.Element {
  const [qtyText, setQtyText] = useState(String(DEFAULT_QTY_GRAMS));
  const [meal, setMeal] = useState<Meal>(defaultMealForNow());
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qtyInputRef = useRef<ElementRef<typeof BottomSheetTextInput>>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const selectionMadeRef = useRef(false);

  // Single-owner open/close (mirrors ExercisePickerSheet.tsx — see module doc comment).
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible) {
      selectionMadeRef.current = false;
      wasVisibleRef.current = true;
      setQtyText(String(food?.servingGrams ?? DEFAULT_QTY_GRAMS));
      setMeal(defaultMealForNow());
      setError(null);
      sheetRef.current?.snapToIndex(0);
    } else if (wasVisibleRef.current) {
      wasVisibleRef.current = false;
      qtyInputRef.current?.blur();
      Keyboard.dismiss();
      sheetRef.current?.close();
    }
  }, [visible, food]);

  const qtyGrams = useMemo(() => parseGramsInput(qtyText), [qtyText]);

  const preview = useMemo(() => {
    if (food == null) return null;
    return buildFoodLogRow({ food, qtyGrams, meal, localDate: todayLocalDate() });
  }, [food, qtyGrams, meal]);

  async function handleLog(): Promise<void> {
    if (food == null || logging || selectionMadeRef.current) return;
    setLogging(true);
    setError(null);
    try {
      const row = buildFoodLogRow({ food, qtyGrams, meal, localDate: todayLocalDate() });
      await db.insert(foodLog).values({ id: randomUUID(), ...row });
      selectionMadeRef.current = true;
      useNutritionTargetSignal.getState().bump();
      onLogged?.();
      onClose();
    } catch (err: unknown) {
      console.error('[Apsis] Failed to log food:', err);
      setError(LOG_ERROR_MESSAGE);
    } finally {
      setLogging(false);
    }
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['55%']}
      enablePanDownToClose
      onClose={onClose}
      keyboardBehavior="extend"
      keyboardBlurBehavior="none"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}>
      <BottomSheetView style={styles.content}>
        {food != null ? (
          <>
            <Text style={styles.foodName} numberOfLines={2}>
              {food.name}
            </Text>
            {food.brand != null && food.brand.length > 0 ? (
              <Text style={styles.foodBrand}>{food.brand}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>Meal</Text>
            <View style={styles.mealRow}>
              {MEAL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setMeal(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: meal === opt.value }}
                  style={[styles.mealOption, meal === opt.value && styles.mealOptionSelected]}>
                  <Text style={[styles.mealLabel, meal === opt.value && styles.mealLabelSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Quantity</Text>
            <View style={styles.qtyRow}>
              <BottomSheetTextInput
                ref={qtyInputRef}
                value={qtyText}
                onChangeText={(text) => setQtyText(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={styles.qtyInput}
                accessibilityLabel="Quantity in grams"
              />
              <Text style={styles.qtyUnit}>g</Text>
              {food.servingName != null && food.servingName.length > 0 ? (
                <Text style={styles.servingHint}>{food.servingName}</Text>
              ) : null}
            </View>

            {preview != null ? (
              <Text style={[styles.previewLine, tabularNums]}>
                {`${preview.kcal} KCAL · ${preview.p}P ${preview.c}C ${preview.f}F`}
              </Text>
            ) : null}

            {error != null ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={() => {
                void handleLog();
              }}
              disabled={logging}
              accessibilityRole="button"
              accessibilityLabel="Log food"
              accessibilityState={{ disabled: logging }}
              style={[styles.logButton, logging && styles.logButtonDisabled]}>
              <Text style={styles.logButtonLabel}>{logging ? 'Logging…' : 'Log food'}</Text>
            </Pressable>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: Colors.dark.surface,
  },
  handleIndicator: {
    backgroundColor: Colors.dark.border,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  foodName: {
    ...Typography.heading,
    color: Colors.dark.text,
    marginTop: Spacing.sm,
  },
  foodBrand: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    ...Mono,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  mealOption: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bone active-fill, not volt — the Log button is this sheet's one volt-filled element.
  mealOptionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  mealLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  mealLabelSelected: {
    color: Colors.dark.onAccent,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyInput: {
    ...Typography.heading,
    ...tabularNums,
    color: Colors.dark.text,
    minWidth: 100,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.steel,
  },
  qtyUnit: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  servingHint: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginLeft: Spacing.sm,
  },
  previewLine: {
    ...Mono,
    color: Colors.dark.accent,
    marginTop: Spacing.lg,
  },
  errorText: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginTop: Spacing.md,
  },
  logButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
  },
  logButtonDisabled: {
    opacity: 0.7,
  },
  logButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
