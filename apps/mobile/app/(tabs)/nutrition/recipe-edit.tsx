/**
 * apps/mobile/app/(tabs)/nutrition/recipe-edit.tsx — create/edit a recipe (NUTR-13)
 *
 * Name + servings + ingredients, built from the same local food-search pattern as
 * search.tsx (`searchLocalFoods`, 07-06): a debounced search box picks ingredient foods, each
 * tap appends a draft row (default 100g, editable) to an in-memory ingredient list. Saving
 * writes one `recipe` row (`createRecipe`) plus one `recipe_ingredient` row per draft ingredient
 * (`addRecipeIngredient`, Task 1) — a live per-serving macro preview is computed client-side
 * with the same per100g x (qtyGrams/100) / servings math as `computeRecipeServingMacros`, so the
 * user sees the number before committing.
 *
 * Edit mode (optional `?id=` param, set by recipes.tsx's row tap): prefills name/servings and
 * the existing ingredient list (read-only — no `removeRecipeIngredient` builder exists yet, so
 * existing rows can't be deleted from this screen); newly added ingredients are appended on
 * save via a batched `recipe`.update() + inserts. This mirrors `useProfile.ts`'s update-in-place
 * shape rather than introducing a new query-builder file.
 *
 * Security/error-handling (T-1-01, house style): parameterized drizzle calls only; errors are
 * console.error'd with an `[Apsis]`-prefixed message — no kcal/macro value ever reaches Sentry
 * (NUTR-22).
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { eq } from 'drizzle-orm';
import {
  addRecipeIngredient,
  createRecipe,
  db,
  food,
  recipe,
  recipeIngredient,
  searchLocalFoods,
} from '@apsis/db';

import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../../constants/theme';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_RESULT_LIMIT = 20;
const DEFAULT_INGREDIENT_QTY_GRAMS = 100;
const SAVE_ERROR_MESSAGE = "Couldn't save that recipe. Nothing was lost — try again.";
const LOAD_ERROR_MESSAGE = "Couldn't load that recipe.";

interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbGPer100g: number;
  fatGPer100g: number;
}

interface DraftIngredient {
  draftId: string;
  foodId: string;
  name: string;
  kcalPer100g: number;
  proteinGPer100g: number;
  carbGPer100g: number;
  fatGPer100g: number;
  /** WR-07: kept as RAW TEXT while editing (like every other numeric field in this phase) so
   * decimals can be typed ("12." must not re-render as "12") and clearing the field doesn't
   * fight the user with a phantom "0". Parsed to a number only for the preview computation and
   * at save time. */
  qtyText: string;
  /** True for ingredients already persisted (edit mode) — not removable from this screen. */
  existing: boolean;
}

function parseNumberInput(text: string): number {
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatWhole(n: number): string {
  return String(Math.round(n));
}

export default function RecipeEditScreen(): React.JSX.Element {
  const router = useRouter();
  const { id: recipeId } = useLocalSearchParams<{ id?: string }>();
  const isEditing = recipeId != null;

  const [name, setName] = useState('');
  const [servingsText, setServingsText] = useState('1');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing recipe + ingredients when editing.
  useEffect(() => {
    if (recipeId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const recipeRows = await db.select().from(recipe).where(eq(recipe.id, recipeId)).limit(1);
        const recipeRow = recipeRows[0];
        if (recipeRow == null) {
          if (!cancelled) setLoadError(LOAD_ERROR_MESSAGE);
          return;
        }
        const ingredientRows = await db
          .select({
            id: recipeIngredient.id,
            qtyGrams: recipeIngredient.qtyGrams,
            foodId: food.id,
            name: food.name,
            kcalPer100g: food.kcalPer100g,
            proteinGPer100g: food.proteinGPer100g,
            carbGPer100g: food.carbGPer100g,
            fatGPer100g: food.fatGPer100g,
          })
          .from(recipeIngredient)
          .innerJoin(food, eq(recipeIngredient.foodId, food.id))
          .where(eq(recipeIngredient.recipeId, recipeId));

        if (cancelled) return;
        setName(recipeRow.name);
        setServingsText(String(recipeRow.servings));
        setIngredients(
          ingredientRows.map((row) => ({
            draftId: row.id,
            foodId: row.foodId,
            name: row.name,
            kcalPer100g: row.kcalPer100g,
            proteinGPer100g: row.proteinGPer100g,
            carbGPer100g: row.carbGPer100g,
            fatGPer100g: row.fatGPer100g,
            qtyText: String(row.qtyGrams),
            existing: true,
          })),
        );
      } catch (err: unknown) {
        console.error('[Apsis] Failed to load recipe for edit:', err);
        if (!cancelled) setLoadError(LOAD_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([]);
      return;
    }
    searchLocalFoods(db, debouncedQuery, SEARCH_RESULT_LIMIT)
      .then((rows: FoodSearchResult[]) => setResults(rows))
      .catch((err: unknown) => {
        console.error('[Apsis] Ingredient search failed:', err);
        setResults([]);
      });
  }, [debouncedQuery]);

  function handleAddIngredient(f: FoodSearchResult): void {
    setIngredients((prev) => [
      ...prev,
      {
        draftId: randomUUID(),
        foodId: f.id,
        name: f.name,
        kcalPer100g: f.kcalPer100g,
        proteinGPer100g: f.proteinGPer100g,
        carbGPer100g: f.carbGPer100g,
        fatGPer100g: f.fatGPer100g,
        qtyText: String(DEFAULT_INGREDIENT_QTY_GRAMS),
        existing: false,
      },
    ]);
  }

  function handleQtyChange(draftId: string, text: string): void {
    // WR-07: sanitize but keep the raw text (never round-trip through a number mid-typing).
    const qtyText = text.replace(/[^0-9.]/g, '');
    setIngredients((prev) => prev.map((ing) => (ing.draftId === draftId ? { ...ing, qtyText } : ing)));
  }

  function handleRemoveIngredient(draftId: string): void {
    setIngredients((prev) => prev.filter((ing) => ing.draftId !== draftId || ing.existing));
  }

  const servings = useMemo(() => {
    const parsed = parseNumberInput(servingsText);
    return parsed > 0 ? parsed : 1;
  }, [servingsText]);

  const preview = useMemo(() => {
    if (ingredients.length === 0) return null;
    const totals = ingredients.reduce(
      (acc, ing) => {
        const factor = parseNumberInput(ing.qtyText) / 100;
        acc.kcal += ing.kcalPer100g * factor;
        acc.p += ing.proteinGPer100g * factor;
        acc.c += ing.carbGPer100g * factor;
        acc.f += ing.fatGPer100g * factor;
        return acc;
      },
      { kcal: 0, p: 0, c: 0, f: 0 },
    );
    return {
      kcal: totals.kcal / servings,
      p: totals.p / servings,
      c: totals.c / servings,
      f: totals.f / servings,
    };
  }, [ingredients, servings]);

  const newIngredients = ingredients.filter((ing) => !ing.existing);
  const canSave = name.trim().length > 0 && ingredients.length > 0 && !saving;

  async function handleSave(): Promise<void> {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      // WR-08: the recipe row + its ingredient rows are one logical write — a mid-loop failure
      // without a transaction leaves a partial recipe on disk while the error copy claims
      // "Nothing was lost", and the retry (fresh randomUUID recipe id in create mode /
      // re-inserted new ingredients in edit mode) duplicates rows. `db.transaction` rolls the
      // whole save back atomically, making the error message true and the retry safe.
      if (isEditing && recipeId != null) {
        await db.transaction(async (tx) => {
          await tx.update(recipe).set({ name: name.trim(), servings }).where(eq(recipe.id, recipeId));
          for (const ing of newIngredients) {
            await addRecipeIngredient(tx, {
              id: randomUUID(),
              recipeId,
              foodId: ing.foodId,
              qtyGrams: parseNumberInput(ing.qtyText),
            });
          }
        });
      } else {
        const id = randomUUID();
        await db.transaction(async (tx) => {
          await createRecipe(tx, { id, name: name.trim(), servings });
          for (const ing of newIngredients) {
            await addRecipeIngredient(tx, {
              id: randomUUID(),
              recipeId: id,
              foodId: ing.foodId,
              qtyGrams: parseNumberInput(ing.qtyText),
            });
          }
        });
      }
      if (router.canGoBack()) router.back();
      else router.push('/(tabs)/nutrition/recipes');
    } catch (err: unknown) {
      console.error('[Apsis] Failed to save recipe:', err);
      setSaveError(SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  const showBrowse = debouncedQuery.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          kicker="NUTRITION"
          title={isEditing ? 'Edit recipe' : 'New recipe'}
          style={styles.screenHeader}
        />

        {loadingExisting ? (
          <Text style={styles.emptyHint}>Loading…</Text>
        ) : loadError != null ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken & rice bowl"
              placeholderTextColor={Colors.dark.mutedText}
              style={styles.textInput}
              accessibilityLabel="Recipe name"
            />

            <Text style={styles.sectionLabel}>Servings</Text>
            <TextInput
              value={servingsText}
              onChangeText={(t) => setServingsText(t.replace(/[^0-9.]/g, ''))}
              placeholder="1"
              placeholderTextColor={Colors.dark.mutedText}
              keyboardType="decimal-pad"
              style={[styles.numericInput, tabularNums]}
              accessibilityLabel="Servings"
            />

            <Text style={styles.sectionLabel}>Ingredients</Text>
            {ingredients.length === 0 ? (
              <Text style={styles.emptyHint}>Search below to add ingredients.</Text>
            ) : (
              ingredients.map((ing) => (
                <View key={ing.draftId} style={styles.ingredientRow}>
                  <Text style={styles.ingredientName} numberOfLines={1}>
                    {ing.name}
                  </Text>
                  <TextInput
                    value={ing.qtyText}
                    onChangeText={(t) => handleQtyChange(ing.draftId, t)}
                    keyboardType="decimal-pad"
                    editable={!ing.existing}
                    style={[styles.ingredientQtyInput, tabularNums, ing.existing && styles.ingredientQtyInputLocked]}
                    accessibilityLabel={`${ing.name} quantity in grams`}
                  />
                  <Text style={styles.ingredientUnit}>g</Text>
                  {!ing.existing ? (
                    <Pressable
                      onPress={() => handleRemoveIngredient(ing.draftId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${ing.name}`}
                      style={styles.removeButton}>
                      <Text style={styles.removeButtonLabel}>×</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}

            {preview != null ? (
              <Text style={[styles.previewLine, tabularNums]}>
                {`Per serving: ${formatWhole(preview.kcal)} KCAL · ${formatWhole(preview.p)}P ${formatWhole(preview.c)}C ${formatWhole(preview.f)}F`}
              </Text>
            ) : null}

            <Text style={styles.sectionLabel}>Add ingredient</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods"
              placeholderTextColor={Colors.dark.mutedText}
              style={styles.textInput}
              accessibilityLabel="Search foods to add as ingredient"
              autoCorrect={false}
            />

            {!showBrowse ? (
              results.length === 0 ? (
                <Text style={styles.emptyHint}>No matches.</Text>
              ) : (
                results.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => handleAddIngredient(f)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${f.name}`}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}>
                    <View style={styles.resultTextGroup}>
                      <Text style={styles.resultLabel} numberOfLines={1}>
                        {f.name}
                      </Text>
                      {f.brand != null && f.brand.length > 0 ? (
                        <Text style={styles.resultSubLabel} numberOfLines={1}>
                          {f.brand}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.resultKcal}>{`${Math.round(f.kcalPer100g)} KCAL/100G`}</Text>
                  </Pressable>
                ))
              )
            ) : null}

            {saveError != null ? <Text style={styles.errorText}>{saveError}</Text> : null}

            <Pressable
              onPress={() => {
                void handleSave();
              }}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save recipe"
              accessibilityState={{ disabled: !canSave }}
              style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonLabel}>{saving ? 'Saving…' : 'Save recipe'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  emptyHint: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  ingredientName: {
    ...Typography.body,
    color: Colors.dark.text,
    flex: 1,
  },
  ingredientQtyInput: {
    ...Mono,
    color: Colors.dark.text,
    width: 64,
    textAlign: 'center',
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dark.steel,
  },
  ingredientQtyInputLocked: {
    opacity: 0.6,
  },
  ingredientUnit: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  removeButton: {
    minWidth: HIT_TARGET_MIN / 2,
    minHeight: HIT_TARGET_MIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonLabel: {
    ...Typography.heading,
    color: Colors.dark.mutedText,
  },
  previewLine: {
    ...Mono,
    fontSize: 11,
    color: Colors.dark.accent,
    marginTop: Spacing.lg,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_TARGET_MIN,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  resultRowPressed: {
    backgroundColor: Colors.dark.surface,
  },
  resultTextGroup: {
    flex: 1,
  },
  resultLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  resultSubLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  resultKcal: {
    ...Mono,
    color: Colors.dark.mutedText,
    fontSize: 11,
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
    opacity: 0.5,
  },
  primaryButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
