/**
 * apps/mobile/app/(tabs)/nutrition/log.tsx — custom food + quick-add entry (NUTR-05/06)
 *
 * Two modes behind a segmented control:
 *  - Custom food: full manual macro entry (name + per-100g kcal/P/C/F + optional
 *    brand/serving) inserts a `food` row (source='user'), then opens `FoodConfirmSheet` so the
 *    user picks a meal/qty before it's logged — the same confirm surface search.tsx uses.
 *  - Quick add: macro-only entry with no `food` row — `buildQuickAddRow` (foodId null,
 *    quickAdd true) is inserted directly into `food_log` after picking a meal.
 *
 * All logging here is local-only (no network calls anywhere in this plan — remote OFF/USDA
 * fallback lands in 07-08).
 *
 * Segmented control + numeric fields mirror `app/nutrition-setup/index.tsx`'s staged-entry
 * style exactly (bone-selected pills, mono tabular numeric inputs) — the closest existing
 * analog for a manual-entry form in this codebase.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { db, food, foodLog } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../../constants/theme';
import { buildQuickAddRow, type Meal } from '../../../lib/logFood';
import { todayLocalDate } from '../../../lib/localDate';
import { useNutritionTargetSignal } from '../../../lib/nutritionTargetSignal';

type Mode = 'custom' | 'quickAdd';

const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: 'custom', label: 'Custom food' },
  { value: 'quickAdd', label: 'Quick add' },
];

const MEAL_OPTIONS: ReadonlyArray<{ value: Meal; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const CREATE_ERROR_MESSAGE = "Couldn't save that food. Nothing was lost — try again.";
const QUICK_ADD_ERROR_MESSAGE = "Couldn't log that entry. Nothing was lost — try again.";

function defaultMealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function parseNumberInput(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function NutritionLogScreen(): React.JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('custom');

  // Custom-food form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [carbText, setCarbText] = useState('');
  const [fatText, setFatText] = useState('');
  const [servingName, setServingName] = useState('');
  const [servingGramsText, setServingGramsText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdFood, setCreatedFood] = useState<ConfirmableFood | null>(null);

  // Quick-add form state
  const [qaKcalText, setQaKcalText] = useState('');
  const [qaProteinText, setQaProteinText] = useState('');
  const [qaCarbText, setQaCarbText] = useState('');
  const [qaFatText, setQaFatText] = useState('');
  const [qaMeal, setQaMeal] = useState<Meal>(defaultMealForNow());
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddDone, setQuickAddDone] = useState(false);

  const canCreate = name.trim().length > 0 && !creating;

  async function handleCreateFood(): Promise<void> {
    if (!canCreate) return;
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
        servingName: servingName.trim().length > 0 ? servingName.trim() : null,
        servingGrams: servingGramsText.trim().length > 0 ? parseNumberInput(servingGramsText) : null,
      };
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
      console.error('[Apsis] Failed to create custom food:', err);
      setCreateError(CREATE_ERROR_MESSAGE);
    } finally {
      setCreating(false);
    }
  }

  function resetCustomForm(): void {
    setName('');
    setBrand('');
    setKcalText('');
    setProteinText('');
    setCarbText('');
    setFatText('');
    setServingName('');
    setServingGramsText('');
  }

  const canQuickAdd = qaKcalText.trim().length > 0 && !quickAdding;

  async function handleQuickAdd(): Promise<void> {
    if (!canQuickAdd) return;
    setQuickAdding(true);
    setQuickAddError(null);
    setQuickAddDone(false);
    try {
      const row = buildQuickAddRow({
        kcal: parseNumberInput(qaKcalText),
        p: parseNumberInput(qaProteinText),
        c: parseNumberInput(qaCarbText),
        f: parseNumberInput(qaFatText),
        meal: qaMeal,
        localDate: todayLocalDate(),
      });
      await db.insert(foodLog).values({ id: randomUUID(), ...row });
      useNutritionTargetSignal.getState().bump();
      setQaKcalText('');
      setQaProteinText('');
      setQaCarbText('');
      setQaFatText('');
      setQuickAddDone(true);
    } catch (err: unknown) {
      console.error('[Apsis] Failed to quick-add food entry:', err);
      setQuickAddError(QUICK_ADD_ERROR_MESSAGE);
    } finally {
      setQuickAdding(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader kicker="NUTRITION" title="Log food" style={styles.screenHeader} />

        <View style={styles.modeRow}>
          {MODE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setMode(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: mode === opt.value }}
              style={[styles.modeOption, mode === opt.value && styles.modeOptionSelected]}>
              <Text style={[styles.modeLabel, mode === opt.value && styles.modeLabelSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'custom' ? (
          <>
            <Text style={styles.sectionLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken breast"
              placeholderTextColor={Colors.dark.mutedText}
              style={styles.textInput}
              accessibilityLabel="Food name"
            />

            <Text style={styles.sectionLabel}>Brand (optional)</Text>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Kirkland"
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
                value={servingName}
                onChangeText={setServingName}
                placeholder="e.g. 1 breast"
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
                void handleCreateFood();
              }}
              disabled={!canCreate}
              accessibilityRole="button"
              accessibilityLabel="Save custom food"
              accessibilityState={{ disabled: !canCreate }}
              style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonLabel}>{creating ? 'Saving…' : 'Save & log'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Macros</Text>
            <View style={styles.macroGrid}>
              <MacroField label="KCAL" value={qaKcalText} onChangeText={setQaKcalText} />
              <MacroField label="PROTEIN G" value={qaProteinText} onChangeText={setQaProteinText} />
              <MacroField label="CARB G" value={qaCarbText} onChangeText={setQaCarbText} />
              <MacroField label="FAT G" value={qaFatText} onChangeText={setQaFatText} />
            </View>

            <Text style={styles.sectionLabel}>Meal</Text>
            <View style={styles.mealRow}>
              {MEAL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setQaMeal(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: qaMeal === opt.value }}
                  style={[styles.mealOption, qaMeal === opt.value && styles.mealOptionSelected]}>
                  <Text style={[styles.mealLabel, qaMeal === opt.value && styles.mealLabelSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {quickAddError != null ? <Text style={styles.errorText}>{quickAddError}</Text> : null}
            {quickAddDone ? <Text style={styles.successText}>Logged.</Text> : null}

            <Pressable
              onPress={() => {
                void handleQuickAdd();
              }}
              disabled={!canQuickAdd}
              accessibilityRole="button"
              accessibilityLabel="Quick add"
              accessibilityState={{ disabled: !canQuickAdd }}
              style={[styles.primaryButton, !canQuickAdd && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonLabel}>{quickAdding ? 'Logging…' : 'Quick add'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <FoodConfirmSheet
        visible={createdFood != null}
        food={createdFood}
        onClose={() => setCreatedFood(null)}
        onLogged={() => {
          resetCustomForm();
          if (router.canGoBack()) router.back();
        }}
      />
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
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  screenHeader: {
    paddingTop: Spacing.xl,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  modeOption: {
    flex: 1,
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionSelected: {
    borderColor: Colors.dark.text,
    backgroundColor: Colors.dark.text,
  },
  modeLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  modeLabelSelected: {
    color: Colors.dark.onAccent,
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
  errorText: {
    ...Typography.label,
    color: Colors.dark.warning,
    marginTop: Spacing.lg,
  },
  successText: {
    ...Typography.label,
    color: Colors.dark.accent,
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
    opacity: 0.5,
  },
  primaryButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
