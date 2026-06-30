/**
 * @apsis/shared — foundational shared types
 * Pure TypeScript; no runtime dependencies.
 */

/** Biological sex for engine calibration */
export type Sex = 'male' | 'female' | 'other';

/** Unit preference for display */
export type Units = 'metric' | 'imperial';

/** Readiness traffic-light band derived from ATL/CTL/TSB */
export type ReadinessBand = 'green' | 'amber' | 'red' | 'calibrating';

/** Activity type for workouts and segments */
export type ActivityType = 'strength' | 'endurance' | 'hybrid';
