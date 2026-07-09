/**
 * @apsis/engine — loaded-carry/sled stress (D-20)
 * RED placeholder — behaviors not yet implemented (see __tests__/carry.test.ts).
 */

import type { CarrySet, CarryStressDetail, EngineConfig } from '@apsis/shared';

export function carryStressDetailed(
  _seg: CarrySet,
  _cfg?: Partial<EngineConfig>
): CarryStressDetail {
  throw new Error('not implemented');
}

export function carryStress(_seg: CarrySet, _cfg?: Partial<EngineConfig>): number {
  throw new Error('not implemented');
}
