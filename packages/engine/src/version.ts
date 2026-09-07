/**
 * @apsis/engine — semantic version constant
 * Isolated in its own module (not index.ts) so downstream modules like session.ts can
 * import ENGINE_VERSION without creating a circular import once index.ts becomes the
 * full public barrel (plan 02-06): index.ts -> session.ts -> index.ts would otherwise
 * cycle if session.ts imported ENGINE_VERSION directly from './index'.
 */

/** Semantic version constant for the engine package */
export const ENGINE_VERSION = '0.0.1' as const;
