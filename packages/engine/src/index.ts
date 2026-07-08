/**
 * @apsis/engine — pure TypeScript HSS compute engine (public barrel)
 * Zero runtime dependencies (only the first-party @apsis/shared workspace link). Pure
 * functions only — no React, no I/O, no side effects; time is always passed in as a
 * parameter; the engine never reads the wall clock.
 *
 * This is the full public API surface for Phase 3/4 consumers: strength + endurance
 * per-set/segment stress, session/daily HSS composition, rolling ATL/CTL/TSB trend +
 * readiness banding, the versioned tunable config, and the engine version stamp.
 */

// Versioned tunable formula constants (DEFAULT_CONFIG) + the override-merge helper
export * from './config';

// Strength-side HSS: e1RM-normalized load stress + Epley estimator
export * from './strength';

// Endurance-side HSS: duration * IF^2 stress + IF-derivation helpers
export * from './endurance';

// Per-session HSS: composes strength + endurance into a version-stamped breakdown
export * from './session';

// Per-day HSS rollup: sum sessions + same-day double-session penalty
export * from './daily';

// Rolling load trend: EWMA ATL/CTL/TSB + readiness banding
export * from './trend';

// Semantic version constant for the engine package
export * from './version';
