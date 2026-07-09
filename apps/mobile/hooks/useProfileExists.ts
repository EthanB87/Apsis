/**
 * apps/mobile/hooks/useProfileExists.ts
 *
 * Drizzle count query over `user_profile` — feeds the root-layout onboarding gate
 * (D-01, Stack.Protected in app/_layout.tsx). Must only run once migrations have
 * succeeded (an op-sqlite JSI query against a not-yet-migrated table would throw), so
 * the caller passes a `ready` flag; the hook stays 'loading' until `ready` is true and
 * the query resolves.
 *
 * Security (V7 / T-1-02): query failures are console.error'd for diagnostics only.
 * On failure this resolves to `false` (no profile) rather than throwing — the safe
 * default is routing the user back into onboarding, never silently unlocking the app.
 */

import { useEffect, useState } from 'react';
import { count } from 'drizzle-orm';
import { db, userProfile } from '@apsis/db';

export type ProfileExistsState = 'loading' | boolean;

export function useProfileExists(ready: boolean): ProfileExistsState {
  const [state, setState] = useState<ProfileExistsState>('loading');

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    db.select({ count: count() })
      .from(userProfile)
      .then((rows) => {
        if (cancelled) return;
        setState((rows[0]?.count ?? 0) > 0);
      })
      .catch((err: unknown) => {
        console.error('[Apsis] useProfileExists count query failed:', err);
        if (!cancelled) setState(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  return state;
}
