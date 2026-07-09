/**
 * apps/mobile/lib/effectiveLoad.ts
 *
 * Bodyweight-movement effective-load computation (D-15/D-16/D-17). This is an app-layer
 * helper, NOT part of `@apsis/engine` — the engine only ever receives the final `loadKg`;
 * it has no knowledge of bodyweight, per-exercise factors, or profile state.
 *
 * `loadFieldKg` is whatever number the user actually types/steps in the set row's load
 * field: for an ordinary barbell/implement lift (bwFactor == null) that IS the full load,
 * so `computeEffectiveLoad` returns it unchanged. For a bodyweight movement (bwFactor !=
 * null) the load field only captures "added weight" (vest, belt, dumbbells) per D-17, and
 * this function adds the bodyweight contribution on top.
 *
 * D-16: bodyweight is snapshotted AT LOG TIME (the caller passes the current profile
 * bodyweight) and the *result* is what gets persisted into `strength_set.loadKg` — historical
 * sets never drift when the profile's bodyweight later changes (D-05 edits-apply-forward).
 */

export function computeEffectiveLoad(
  exercise: { bwFactor: number | null },
  loadFieldKg: number,
  profileBodyweightKg: number
): number {
  if (exercise.bwFactor == null) {
    return loadFieldKg;
  }
  return profileBodyweightKg * exercise.bwFactor + loadFieldKg;
}
