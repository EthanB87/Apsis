/**
 * apps/mobile/app/(tabs)/nutrition/search.tsx — local-first food search with remote fallback
 * (NUTR-03/04, WR-06)
 *
 * Local-first search box (07-RESEARCH.md Pattern 1): every debounced query hits
 * `searchLocalFoods` (instant, offline, op-sqlite JSI) and renders immediately. For queries of
 * ≥ MIN_REMOTE_QUERY_LENGTH chars, `nutritionSearch` additionally fires IN PARALLEL — it
 * re-runs the cheap local read internally to decide sparseness (< 3 local hits) and only then
 * calls the OFF + USDA clients, both of which own their own AbortController timeout and never
 * throw, so no-network/timeout degrades to "local results only" with zero error UI. Remote
 * results never delay the local list — they arrive later under their own "Online results"
 * section, with a subtle SEARCHING ONLINE… indicator while in flight.
 *
 * Remote rows are cache-through on tap (the same upsert-on-confirm shape scan.tsx uses for OFF
 * barcode hits): tapping a remote result inserts a `food` row (source 'off'/'usda') and opens
 * the shared FoodConfirmSheet on the new LOCAL id — anything actually logged is always backed
 * by a local `food` row, and the next search finds it offline. Remote candidates with
 * incomplete core macros are filtered out (Pitfall 7 — never surface a food that would log
 * zero-macro garbage).
 *
 * Recents/favorites (`recentFoods`/`favoriteFoods`) are surfaced above results whenever the
 * search box is empty, so a repeat food is reachable in the NUTR-04 ≤3-tap bar: tap a
 * recent/favorite row (1) -> FoodConfirmSheet opens preselected -> tap Log food (2).
 *
 * NUTR-22: no kcal/macro value is ever attached to a Sentry breadcrumb/extra/context call in
 * this file — only hardcoded `[Apsis]`-prefixed strings reach `console.error` on failure.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { db, favoriteFoods, food, recentFoods, searchLocalFoods } from '@apsis/db';

import { FoodConfirmSheet, type ConfirmableFood } from '../../../components/FoodConfirmSheet';
import { ScreenHeader } from '../../../components/ScreenHeader';
import Colors from '../../../constants/Colors';
import { HIT_TARGET_MIN, Mono, Radius, Spacing, Typography } from '../../../constants/theme';
import { nutritionSearch, type RemoteFoodResult } from '../../../lib/nutritionSearch';

const SEARCH_DEBOUNCE_MS = 300;
const RECENTS_LIMIT = 8;
const FAVORITES_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 20;
/** Below this many chars the remote fallback never fires — too little signal to spend a
 * network round-trip on (local search still runs from the first character). */
const MIN_REMOTE_QUERY_LENGTH = 3;

/** A remote candidate whose four core macros are all present (Pitfall 7 narrowing). */
type CompleteRemoteFood = RemoteFoodResult & {
  kcalPer100g: number;
  proteinGPer100g: number;
  carbGPer100g: number;
  fatGPer100g: number;
};

/** Pitfall 7: only remote candidates with COMPLETE core macros are shown/cacheable — an
 * undefined macro would otherwise clamp to a silent 0 at log time. */
function hasCompleteMacros(r: RemoteFoodResult): r is CompleteRemoteFood {
  return (
    r.kcalPer100g != null && r.proteinGPer100g != null && r.carbGPer100g != null && r.fatGPer100g != null
  );
}

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

interface RemoteFoodListRowProps {
  item: CompleteRemoteFood;
  onPress: (item: CompleteRemoteFood) => void;
}

/** A remote (not-yet-cached) OFF/USDA result row — same visual shape as FoodListRow, with the
 * source appended to the kcal line as the subtle provenance indicator (WR-06). */
function RemoteFoodListRow({ item, onPress }: RemoteFoodListRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, online result`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowTextGroup}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {item.name}
        </Text>
        {item.brand != null && item.brand.length > 0 ? (
          <Text style={styles.rowSubLabel} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
      </View>
      <Text style={styles.rowKcal}>
        {`${Math.round(item.kcalPer100g)} KCAL/100G · ${item.source === 'off' ? 'OFF' : 'USDA'}`}
      </Text>
    </Pressable>
  );
}

export default function NutritionSearchScreen(): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<FoodRow[]>([]);
  const [remoteResults, setRemoteResults] = useState<CompleteRemoteFood[]>([]);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [recents, setRecents] = useState<FoodRow[]>([]);
  const [favorites, setFavorites] = useState<FoodRow[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  // Guards a double-tap on a remote row from inserting the same food twice (mirrors
  // scan.tsx's scanningRef discipline).
  const cachingRemoteRef = useRef(false);

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
      setRemoteResults([]);
      setRemoteSearching(false);
      return;
    }

    // Cancelled-flag cleanup (useNutritionProfile.ts precedent): with the remote fallback's
    // up-to-6s window in play, a superseded query's late resolution must never overwrite a
    // newer query's results (IN-06).
    let cancelled = false;

    // Local-first, always, instantly — never gated on (or delayed by) the network (NUTR-01).
    searchLocalFoods(db, debouncedQuery, SEARCH_RESULT_LIMIT)
      .then((rows: FoodRow[]) => {
        if (!cancelled) setResults(rows);
      })
      .catch((err: unknown) => {
        console.error('[Apsis] searchLocalFoods query failed:', err);
        if (!cancelled) setResults([]);
      });

    // WR-06: remote OFF/USDA fallback (NUTR-03), fired in parallel so it never blocks the
    // local render above. `nutritionSearch` owns the sparse-local gate (< 3 hits) and both
    // remote clients are timeout-guarded and never throw — offline/timeout degrades to
    // `remote: []` silently (local results remain, no error UI).
    if (debouncedQuery.length < MIN_REMOTE_QUERY_LENGTH) {
      setRemoteResults([]);
      setRemoteSearching(false);
    } else {
      setRemoteSearching(true);
      nutritionSearch(db, debouncedQuery, { isOnline: true })
        .then(({ remote }) => {
          if (!cancelled) setRemoteResults(remote.filter(hasCompleteMacros));
        })
        .catch((err: unknown) => {
          // nutritionSearch itself never throws past its clients; belt-and-braces only.
          console.error('[Apsis] remote food search failed:', err);
          if (!cancelled) setRemoteResults([]);
        })
        .finally(() => {
          if (!cancelled) setRemoteSearching(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  /** WR-06 cache-through: a tapped remote result becomes a local `food` row FIRST (source
   * 'off'/'usda', same shape as scan.tsx's OFF-hit insert), then the shared confirm sheet
   * opens on that local id — logging always references a cached local food. */
  async function handleRemotePress(item: CompleteRemoteFood): Promise<void> {
    if (cachingRemoteRef.current) return;
    cachingRemoteRef.current = true;
    try {
      const id = randomUUID();
      await db.insert(food).values({
        id,
        name: item.name,
        brand: item.brand,
        source: item.source,
        kcalPer100g: item.kcalPer100g,
        proteinGPer100g: item.proteinGPer100g,
        carbGPer100g: item.carbGPer100g,
        fatGPer100g: item.fatGPer100g,
      });
      setSelectedFood({
        id,
        name: item.name,
        brand: item.brand,
        kcalPer100g: item.kcalPer100g,
        proteinGPer100g: item.proteinGPer100g,
        carbGPer100g: item.carbGPer100g,
        fatGPer100g: item.fatGPer100g,
      });
    } catch (err: unknown) {
      console.error('[Apsis] Failed to cache remote food locally:', err);
    } finally {
      cachingRemoteRef.current = false;
    }
  }

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
  // Only claim "no matches" once BOTH sources have settled empty — while the remote fallback
  // is still in flight, its own indicator shows instead (WR-06).
  const noResults = !showBrowse && results.length === 0 && remoteResults.length === 0 && !remoteSearching;

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
            {remoteSearching ? <Text style={styles.remoteHint}>SEARCHING ONLINE…</Text> : null}
            {remoteResults.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>Online results</Text>
                {remoteResults.map((item, index) => (
                  <RemoteFoodListRow
                    key={`${item.source}-${item.name}-${index}`}
                    item={item}
                    onPress={(r) => {
                      void handleRemotePress(r);
                    }}
                  />
                ))}
              </>
            ) : null}
            {noResults ? (
              <Text style={styles.emptyHint}>No matches. Create a custom food instead.</Text>
            ) : null}
          </>
        )}

        {/* Rule 2 deviation (Plan 07-08): the only entry point into scan.tsx — without this the
         * barcode scan screen built in this plan is unreachable dead code, mirroring the
         * "Custom food / quick add" button's own precedent below. */}
        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
          style={({ pressed }) => [styles.customButton, pressed && styles.customButtonPressed]}>
          <Text style={styles.customButtonLabel}>Scan barcode</Text>
        </Pressable>

        {/* Rule 2 deviation (Plan 07-09): the only entry point into label-scan.tsx — without
         * this the nutrition-label OCR screen built in this plan is unreachable dead code,
         * mirroring the "Scan barcode" button's own precedent above. */}
        <Pressable
          onPress={() => router.push('/(tabs)/nutrition/label-scan')}
          accessibilityRole="button"
          accessibilityLabel="Scan nutrition label"
          style={({ pressed }) => [styles.customButton, pressed && styles.customButtonPressed]}>
          <Text style={styles.customButtonLabel}>Scan nutrition label</Text>
        </Pressable>

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
  // Subtle in-flight indicator for the remote fallback (WR-06) — mono/muted like a section
  // header, deliberately NOT a spinner: the local results above are already interactive.
  remoteHint: {
    ...Mono,
    color: Colors.dark.mutedText,
    fontSize: 11,
    paddingTop: Spacing.lg,
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
