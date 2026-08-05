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
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { randomUUID } from 'expo-crypto';
import { eq } from 'drizzle-orm';
import { db, food as foodTable, foodLog } from '@apsis/db';

import Colors from '../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../constants/theme';
import { availableUnitsFor, gramsToDisplayQty, qtyToGrams, type FoodQtyUnit, type FoodUnitBasis } from '../lib/foodUnits';
import { buildFoodLogRow, type FoodPer100g, type Meal } from '../lib/logFood';
import { todayLocalDate } from '../lib/localDate';
import { useNutritionTargetSignal } from '../lib/nutritionTargetSignal';
import { useSettingsStore } from '../lib/settingsStore';
import { DECIMAL_PAD_ACCESSORY_ID, DecimalPadDoneBar } from './DecimalPadDoneBar';

/** The subset of a `food` row this sheet needs to preview + log — food-source-agnostic. */
export interface ConfirmableFood extends FoodPer100g {
  id: string;
  name: string;
  brand?: string | null;
  servingName?: string | null;
  servingGrams?: number | null;
  /** Phase 09 (D-09): the unit last picked when logging THIS food, e.g. 'oz'/'g'/'serving'.
   * Read to default the chip selection on open; written back after a successful log. Absent
   * or unrecognized values fall back to the bodyweight units pref (D-09). */
  lastUsedUnit?: string | null;
  /** True when this is a stand-in for a non-`food`-row source (e.g. a recipe serving,
   * recipes.tsx) — `buildFoodLogRow` then writes `foodId: null` instead of freezing an id
   * that would violate `food_log.food_id`'s FK to `food.id` (CR-02). Also skips the
   * `food.lastUsedUnit` write-back, since a virtual food has no real `food` row to update. */
  isVirtual?: boolean;
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

/** D-05: the full unit vocabulary, used to validate a stored `food.lastUsedUnit` string. */
const ALL_FOOD_QTY_UNITS: readonly FoodQtyUnit[] = ['g', 'kg', 'oz', 'lb', 'tsp', 'tbsp', 'serving'];

/** No serving basis — used when `food` is null but a hook still needs a `FoodUnitBasis`. */
const EMPTY_BASIS: FoodUnitBasis = { servingGrams: null, servingName: null };

const UNIT_LABELS: Record<FoodQtyUnit, string> = {
  g: 'g',
  kg: 'kg',
  oz: 'oz',
  lb: 'lb',
  tsp: 'tsp',
  tbsp: 'tbsp',
  serving: 'serving',
};

/** Time-of-day heuristic so the sheet opens with a sensible meal preselected — the user can
 * always override it before confirming. */
function defaultMealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function parseQtyInput(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Runtime guard for a `food.lastUsedUnit` TEXT column value — never trust it's a valid unit. */
function isFoodQtyUnit(value: string): value is FoodQtyUnit {
  return (ALL_FOOD_QTY_UNITS as readonly string[]).includes(value);
}

/** `ConfirmableFood`'s optional fields carry `| undefined`; `FoodUnitBasis` doesn't — normalize
 * once here rather than at every `foodUnits.ts` call site. */
function toUnitBasis(food: ConfirmableFood): FoodUnitBasis {
  return { servingGrams: food.servingGrams ?? null, servingName: food.servingName ?? null };
}

/** Display formatting for a converted quantity — 2 decimal places is enough resolution for
 * every unit here (whole oz, 0.1 lb, fractional g/kg/tsp/tbsp/serving) without a noisy tail. */
function formatQtyForDisplay(qty: number): string {
  if (!Number.isFinite(qty) || qty < 0) return '0';
  return String(Math.round(qty * 100) / 100);
}

export interface UnitChipRowProps {
  units: readonly FoodQtyUnit[];
  selectedUnit: FoodQtyUnit;
  onSelectUnit: (unit: FoodQtyUnit) => void;
}

/** D-08 chip row: g/kg/oz/lb always, tsp/tbsp/serving only when `units` includes them (driven
 * by `availableUnitsFor`). Bone active-fill, matching the meal selector above — the Log button
 * is this sheet's one volt-filled element. Reused as-is by nutrition/log.tsx (custom food) and
 * nutrition/recipe-edit.tsx (ingredient qty) so the chip visual/behavior never drifts (D-10). */
export function UnitChipRow({ units, selectedUnit, onSelectUnit }: UnitChipRowProps): React.JSX.Element {
  return (
    <View style={chipStyles.row}>
      {units.map((unit) => (
        <Pressable
          key={unit}
          onPress={() => onSelectUnit(unit)}
          accessibilityRole="button"
          accessibilityLabel={`Unit ${UNIT_LABELS[unit]}`}
          accessibilityState={{ selected: selectedUnit === unit }}
          style={[chipStyles.chip, selectedUnit === unit && chipStyles.chipSelected]}>
          <Text style={[chipStyles.chipLabel, selectedUnit === unit && chipStyles.chipLabelSelected]}>
            {UNIT_LABELS[unit]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FoodConfirmSheet({ visible, food, onClose, onLogged }: FoodConfirmSheetProps): React.JSX.Element {
  const [qtyText, setQtyText] = useState(String(DEFAULT_QTY_GRAMS));
  const [selectedUnit, setSelectedUnit] = useState<FoodQtyUnit>('g');
  const [meal, setMeal] = useState<Meal>(defaultMealForNow());
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qtyInputRef = useRef<ElementRef<typeof BottomSheetTextInput>>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const selectionMadeRef = useRef(false);
  // D-09 fallback for foods with no stored `lastUsedUnit` yet: bodyweight units pref
  // (imperial -> oz, metric -> g) — mirrors the same profile bucket `ProfileReview`/Settings use.
  const bodyweightUnits = useSettingsStore((s) => s.bodyweightUnits);

  const availableUnits = useMemo(() => (food != null ? availableUnitsFor(toUnitBasis(food)) : []), [food]);

  // Single-owner open/close (mirrors ExercisePickerSheet.tsx — see module doc comment).
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible) {
      selectionMadeRef.current = false;
      wasVisibleRef.current = true;
      const units = food != null ? availableUnitsFor(toUnitBasis(food)) : [];
      const fallbackUnit: FoodQtyUnit = bodyweightUnits === 'imperial' ? 'oz' : 'g';
      const stored = food?.lastUsedUnit;
      const initialUnit: FoodQtyUnit =
        stored != null && isFoodQtyUnit(stored) && units.includes(stored) ? stored : fallbackUnit;
      const initialGrams = food?.servingGrams ?? DEFAULT_QTY_GRAMS;
      const basis = food != null ? toUnitBasis(food) : EMPTY_BASIS;
      setSelectedUnit(initialUnit);
      setQtyText(formatQtyForDisplay(gramsToDisplayQty(initialGrams, initialUnit, basis)));
      setMeal(defaultMealForNow());
      setError(null);
      sheetRef.current?.snapToIndex(0);
    } else if (wasVisibleRef.current) {
      wasVisibleRef.current = false;
      qtyInputRef.current?.blur();
      Keyboard.dismiss();
      sheetRef.current?.close();
    }
  }, [visible, food, bodyweightUnits]);

  // D-05..D-08: qtyGrams is ALWAYS the storage value — every conversion happens through
  // `qtyToGrams`, so `buildFoodLogRow`/the preview never see a non-gram quantity.
  const qtyGrams = useMemo(() => {
    if (food == null) return 0;
    return qtyToGrams(parseQtyInput(qtyText), selectedUnit, toUnitBasis(food));
  }, [qtyText, selectedUnit, food]);

  const preview = useMemo(() => {
    if (food == null) return null;
    return buildFoodLogRow({ food, qtyGrams, meal, localDate: todayLocalDate() });
  }, [food, qtyGrams, meal]);

  /** D-08: switching chips preserves the REAL quantity — the displayed number converts via
   * `gramsToDisplayQty`, it does not reinterpret the same digits as a new unit. */
  function handleSelectUnit(unit: FoodQtyUnit): void {
    if (food == null || unit === selectedUnit) return;
    const basis = toUnitBasis(food);
    const grams = qtyToGrams(parseQtyInput(qtyText), selectedUnit, basis);
    setSelectedUnit(unit);
    setQtyText(formatQtyForDisplay(gramsToDisplayQty(grams, unit, basis)));
  }

  async function handleLog(): Promise<void> {
    if (food == null || logging || selectionMadeRef.current) return;
    setLogging(true);
    setError(null);
    try {
      const row = buildFoodLogRow({ food, qtyGrams, meal, localDate: todayLocalDate() });
      await db.insert(foodLog).values({ id: randomUUID(), ...row });
      selectionMadeRef.current = true;
      // D-09: persist the chosen unit for next time — skipped for virtual foods (recipes),
      // which have no real `food` row to update (CR-02 precedent).
      if (food.isVirtual !== true) {
        try {
          await db.update(foodTable).set({ lastUsedUnit: selectedUnit }).where(eq(foodTable.id, food.id));
        } catch (err: unknown) {
          console.error('[Apsis] Failed to persist last-used food unit:', err);
        }
      }
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
      <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                inputAccessoryViewID={DECIMAL_PAD_ACCESSORY_ID}
                style={styles.qtyInput}
                accessibilityLabel={`Quantity in ${UNIT_LABELS[selectedUnit]}`}
              />
              {food.servingName != null && food.servingName.length > 0 ? (
                <Text style={styles.servingHint}>{food.servingName}</Text>
              ) : null}
            </View>
            <UnitChipRow units={availableUnits} selectedUnit={selectedUnit} onSelectUnit={handleSelectUnit} />

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
      </BottomSheetScrollView>
      <DecimalPadDoneBar />
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

/** Exported alongside `UnitChipRow` so nutrition/log.tsx and nutrition/recipe-edit.tsx render
 * the exact same chip visual (D-10 — one shared component, not three style copies). */
export const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    minHeight: HIT_TARGET_MIN / 1.3,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bone active-fill, not volt — matches the meal selector's one-volt-per-screen convention.
  chipSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  chipLabel: {
    ...Typography.label,
    color: Colors.dark.text,
  },
  chipLabelSelected: {
    color: Colors.dark.onAccent,
  },
});
