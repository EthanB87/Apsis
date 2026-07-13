/**
 * apps/mobile/app/(tabs)/nutrition/recipes.tsx — saved recipes list + log-one-serving (NUTR-13/14)
 *
 * Lists saved recipes (`listRecipes`) with per-serving macros computed via
 * `computeRecipeServingMacros` (Task 1). "Log 1 serving" reuses the shared
 * `FoodConfirmSheet`/`buildFoodLogRow` confirm/log path exactly like search.tsx: the recipe's
 * per-serving macros are represented as a `ConfirmableFood` whose "per-100g" value IS the
 * per-serving macro (with `servingGrams: 100` / `servingName: '1 serving'` so the sheet's
 * quantity field defaults to exactly one serving) — food-source-agnostic reuse, no changes to
 * FoodConfirmSheet itself.
 *
 * `useFocusEffect` (not a bare `useEffect`, Pitfall-5/03-10 stacked-screen lesson) re-fetches on
 * every focus so a recipe just created in recipe-edit.tsx (or a fresh log) is reflected
 * immediately on return.
 *
 * Security/error-handling (T-1-01, house style): parameterized query builders only; errors are
 * console.error'd with an `[Apsis]`-prefixed message — no kcal/macro value is ever attached to a
 * Sentry breadcrumb/extra/context call anywhere in this file (NUTR-22).
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { computeRecipeServingMacros, db, listRecipes, type RecipeServingMacros } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography, tabularNums } from '../../../constants/theme';

interface RecipeRow {
  id: string;
  name: string;
  servings: number;
}

interface RecipeListItem extends RecipeRow {
  macros: RecipeServingMacros | null;
}

const LOAD_ERROR_MESSAGE = 'Failed to load recipes:';

function formatWhole(n: number): string {
  return String(Math.round(n));
}

/** Builds the food-source-agnostic ConfirmableFood the confirm sheet needs — the recipe's
 * per-serving macros stand in for a "per-100g" value, with servingGrams=100 so the sheet
 * defaults to logging exactly one serving. */
function recipeToConfirmableFood(recipe: RecipeRow, macros: RecipeServingMacros): ConfirmableFood {
  return {
    id: recipe.id,
    name: recipe.name,
    kcalPer100g: macros.kcal,
    proteinGPer100g: macros.p,
    carbGPer100g: macros.c,
    fatGPer100g: macros.f,
    servingName: '1 serving',
    servingGrams: 100,
  };
}

interface RecipeCardProps {
  item: RecipeListItem;
  onLog: (item: RecipeListItem) => void;
  onEdit: (item: RecipeListItem) => void;
}

function RecipeCard({ item, onLog, onEdit }: RecipeCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => onEdit(item)}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
        style={styles.cardHeaderRow}>
        <View style={styles.cardTextGroup}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardServings}>{`${item.servings} serving${item.servings === 1 ? '' : 's'}`}</Text>
        </View>
        {item.macros != null ? (
          <Text style={[styles.cardMacro, tabularNums]}>{`${formatWhole(item.macros.kcal)} KCAL / SERVING`}</Text>
        ) : null}
      </Pressable>

      {item.macros != null ? (
        <Text style={[styles.macroBreakdown, tabularNums]}>
          {`${formatWhole(item.macros.p)}P · ${formatWhole(item.macros.c)}C · ${formatWhole(item.macros.f)}F`}
        </Text>
      ) : null}

      <Pressable
        onPress={() => onLog(item)}
        disabled={item.macros == null}
        accessibilityRole="button"
        accessibilityLabel={`Log 1 serving of ${item.name}`}
        style={({ pressed }) => [
          styles.logButton,
          pressed && styles.logButtonPressed,
          item.macros == null && styles.logButtonDisabled,
        ]}>
        <Text style={styles.logButtonLabel}>Log 1 serving</Text>
      </Pressable>
    </View>
  );
}

export default function RecipesScreen(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selected, setSelected] = useState<ConfirmableFood | null>(null);

  const loadRecipes = useCallback(async () => {
    try {
      const rows = (await listRecipes(db)) as RecipeRow[];
      const withMacros = await Promise.all(
        rows.map(async (row) => {
          try {
            const macros = await computeRecipeServingMacros(db, row.id);
            return { ...row, macros };
          } catch (err: unknown) {
            console.error('[Apsis] Failed to compute recipe macros:', err);
            return { ...row, macros: null };
          }
        }),
      );
      setRecipes(withMacros);
    } catch (err: unknown) {
      console.error('[Apsis]', LOAD_ERROR_MESSAGE, err);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecipes();
    }, [loadRecipes]),
  );

  function handleLog(item: RecipeListItem): void {
    if (item.macros == null) return;
    setSelected(recipeToConfirmableFood(item, item.macros));
  }

  function handleEdit(item: RecipeListItem): void {
    router.push({ pathname: '/(tabs)/nutrition/recipe-edit', params: { id: item.id } });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader kicker="NUTRITION" title="Recipes" style={styles.screenHeader} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.dark.accent} />
          </View>
        ) : recipes.length === 0 ? (
          <Text style={styles.emptyHint}>
            No saved recipes yet — combine ingredient foods into a recipe to log a whole meal in
            one tap.
          </Text>
        ) : (
          recipes.map((item) => (
            <RecipeCard key={item.id} item={item} onLog={handleLog} onEdit={handleEdit} />
          ))
        )}

        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/recipe-edit')}
          accessibilityRole="button"
          accessibilityLabel="New recipe"
          style={({ pressed }) => [styles.newButton, pressed && styles.newButtonPressed]}>
          <Text style={styles.newButtonLabel}>New recipe</Text>
        </Pressable>
      </ScrollView>

      <FoodConfirmSheet
        visible={selected != null}
        food={selected}
        onClose={() => setSelected(null)}
        onLogged={() => {
          void loadRecipes();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  screenHeader: {
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  loadingContainer: {
    paddingTop: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyHint: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.xl,
    textAlign: 'center',
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardTextGroup: {
    flex: 1,
  },
  cardName: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  cardServings: {
    ...Typography.label,
    color: Colors.dark.mutedText,
    marginTop: Spacing.xs,
  },
  cardMacro: {
    ...Mono,
    color: Colors.dark.accent,
    fontSize: 11,
  },
  macroBreakdown: {
    ...Mono,
    color: Colors.dark.mutedText,
    fontSize: 11,
    marginTop: Spacing.sm,
  },
  logButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  logButtonPressed: {
    backgroundColor: Colors.dark.steel,
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  newButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  newButtonPressed: {
    backgroundColor: Colors.dark.accentPressed,
  },
  newButtonLabel: {
    ...Typography.body,
    color: Colors.dark.onAccent,
  },
});
