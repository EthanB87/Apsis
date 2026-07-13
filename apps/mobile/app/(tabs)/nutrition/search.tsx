/**
 * apps/mobile/app/(tabs)/nutrition/search.tsx — inline local food search (NUTR-03/04)
 *
 * Local-first search box (07-RESEARCH.md Pattern 1): every query hits `searchLocalFoods`
 * (instant, offline, op-sqlite JSI) — no remote OFF/USDA fallback in this plan (that lands in
 * 07-08). Recents/favorites (`recentFoods`/`favoriteFoods`) are surfaced above results whenever
 * the search box is empty, so a repeat food is reachable in the NUTR-04 ≤3-tap bar: tap a
 * recent/favorite row (1) -> FoodConfirmSheet opens preselected -> tap Log food (2).
 *
 * Debounce (300ms) is a defensive habit carried over from the RESEARCH.md remote-search
 * pattern even though this plan's search never leaves the device — it keeps the query from
 * re-running on every keystroke once a network fallback is added in 07-08.
 *
 * No network/fetch call appears in this file (NUTR-10's remote fallback is out of scope here).
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { db, favoriteFoods, recentFoods, searchLocalFoods } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography } from '../../../constants/theme';

const SEARCH_DEBOUNCE_MS = 300;
const RECENTS_LIMIT = 8;
const FAVORITES_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 20;

type FoodRow = ConfirmableFood;

interface FoodListRowProps {
  food: FoodRow;
  onPress: (food: FoodRow) => void;
}

function FoodListRow({ food, onPress }: FoodListRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={() => onPress(food)}
      accessibilityRole="button"
      accessibilityLabel={food.name}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowTextGroup}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {food.name}
        </Text>
        {food.brand != null && food.brand.length > 0 ? (
          <Text style={styles.rowSubLabel} numberOfLines={1}>
            {food.brand}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowKcal}>{`${Math.round(food.kcalPer100g)} KCAL/100G`}</Text>
    </Pressable>
  );
}

export default function NutritionSearchScreen(): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<FoodRow[]>([]);
  const [recents, setRecents] = useState<FoodRow[]>([]);
  const [favorites, setFavorites] = useState<FoodRow[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    recentFoods(db, RECENTS_LIMIT)
      .then(setRecents)
      .catch((err: unknown) => {
        console.error('[Apsis] recentFoods query failed:', err);
        setRecents([]);
      });
    favoriteFoods(db, FAVORITES_LIMIT)
      .then(setFavorites)
      .catch((err: unknown) => {
        console.error('[Apsis] favoriteFoods query failed:', err);
        setFavorites([]);
      });
  }, []);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([]);
      return;
    }
    searchLocalFoods(db, debouncedQuery, SEARCH_RESULT_LIMIT)
      .then(setResults)
      .catch((err: unknown) => {
        console.error('[Apsis] searchLocalFoods query failed:', err);
        setResults([]);
      });
  }, [debouncedQuery]);

  function handleLogged(): void {
    // A fresh log may change what "most recent"/"most frequent" ranks as — re-fetch so the
    // next visit's recents/favorites reflect it without requiring a full screen remount.
    recentFoods(db, RECENTS_LIMIT)
      .then(setRecents)
      .catch((err: unknown) => console.error('[Apsis] recentFoods refresh failed:', err));
    favoriteFoods(db, FAVORITES_LIMIT)
      .then(setFavorites)
      .catch((err: unknown) => console.error('[Apsis] favoriteFoods refresh failed:', err));
  }

  const showBrowse = debouncedQuery.length === 0;
  const noResults = !showBrowse && results.length === 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader kicker="NUTRITION" title="Log food" style={styles.screenHeader} />

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          placeholderTextColor={Colors.dark.mutedText}
          style={styles.searchInput}
          accessibilityLabel="Search foods"
          autoCorrect={false}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {showBrowse ? (
          <>
            {favorites.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>Favorites</Text>
                {favorites.map((food) => (
                  <FoodListRow key={food.id} food={food} onPress={setSelectedFood} />
                ))}
              </>
            ) : null}
            {recents.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>Recents</Text>
                {recents.map((food) => (
                  <FoodListRow key={food.id} food={food} onPress={setSelectedFood} />
                ))}
              </>
            ) : null}
            {favorites.length === 0 && recents.length === 0 ? (
              <Text style={styles.emptyHint}>
                Log a food to see it here next time — search above to get started.
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.sectionHeader}>Results</Text>
            {results.map((food) => (
              <FoodListRow key={food.id} food={food} onPress={setSelectedFood} />
            ))}
            {noResults ? (
              <Text style={styles.emptyHint}>No matches. Create a custom food instead.</Text>
            ) : null}
          </>
        )}

        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/log')}
          accessibilityRole="button"
          accessibilityLabel="Create custom food or quick add"
          style={({ pressed }) => [styles.customButton, pressed && styles.customButtonPressed]}>
          <Text style={styles.customButtonLabel}>Custom food / quick add</Text>
        </Pressable>
      </ScrollView>

      <FoodConfirmSheet
        visible={selectedFood != null}
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onLogged={handleLogged}
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
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchInput: {
    ...Typography.body,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: Spacing.lg,
    minHeight: HIT_TARGET_MIN,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionHeader: {
    ...Mono,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_TARGET_MIN,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  rowPressed: {
    backgroundColor: Colors.dark.surface,
  },
  rowTextGroup: {
    flex: 1,
  },
  rowLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
  rowSubLabel: {
    ...Typography.label,
    color: Colors.dark.mutedText,
  },
  rowKcal: {
    ...Mono,
    color: Colors.dark.mutedText,
    fontSize: 11,
  },
  emptyHint: {
    ...Typography.body,
    color: Colors.dark.mutedText,
    paddingTop: Spacing.xl,
    textAlign: 'center',
  },
  customButton: {
    minHeight: HIT_TARGET_MIN,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
  },
  customButtonPressed: {
    backgroundColor: Colors.dark.surface,
  },
  customButtonLabel: {
    ...Typography.body,
    color: Colors.dark.text,
  },
});
