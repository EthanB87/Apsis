/**
 * @apsis/engine — bodyweight-movement e1RM: rep-max table estimator (D-18)
 * RED placeholder — behaviors not yet implemented (see __tests__/bodyweight.test.ts).
 */

export interface EstimateE1RMFromRepMaxTableDetail {
  e1rm: number;
  warnings: string[];
}

export function estimateE1RMFromRepMaxTableDetailed(
  _loadKg: number,
  _reps: number
): EstimateE1RMFromRepMaxTableDetail {
  throw new Error('not implemented');
}

export function estimateE1RMFromRepMaxTable(_loadKg: number, _reps: number): number {
  throw new Error('not implemented');
}
