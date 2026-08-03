/**
 * apps/mobile/lib/__tests__/shareCard.test.ts
 *
 * RED/GREEN coverage for `buildShareCaption` (D-04): mono "LIFT/RUN — MON D" caption for
 * both session types across several dates, including a single-digit day (no zero-padding)
 * and a December month-index boundary.
 */

import { describe, expect, it } from 'vitest';
import { buildShareCaption } from '../shareCard';

describe('buildShareCaption', () => {
  it('strength session -> "LIFT — AUG 3"', () => {
    expect(buildShareCaption('strength', '2026-08-03')).toBe('LIFT — AUG 3');
  });

  it('endurance session -> "RUN — AUG 3"', () => {
    expect(buildShareCaption('endurance', '2026-08-03')).toBe('RUN — AUG 3');
  });

  it('does not zero-pad single-digit days', () => {
    expect(buildShareCaption('strength', '2026-01-05')).toBe('LIFT — JAN 5');
  });

  it('resolves the December month-index boundary correctly', () => {
    expect(buildShareCaption('endurance', '2026-12-25')).toBe('RUN — DEC 25');
  });

  it('handles a two-digit day', () => {
    expect(buildShareCaption('strength', '2026-11-30')).toBe('LIFT — NOV 30');
  });
});
