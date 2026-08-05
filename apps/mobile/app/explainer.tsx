/**
 * apps/mobile/app/explainer.tsx — standalone "How Apsis works" revisit (D-19)
 *
 * Deliberately a TOP-LEVEL route, not `app/onboarding/explainer.tsx` reused via a route
 * param — the entire `onboarding` segment is wrapped in `Stack.Protected guard={!hasProfile}`
 * in app/_layout.tsx, so once an existing user's profile exists, the whole onboarding nested
 * stack (and everything under it, including an explainer living there) is excluded from the
 * navigator and unreachable by `router.push`. Existing build-9 testers — the exact audience
 * D-19 targets — have a profile already, so this screen must live outside that guarded group.
 * Other top-level routes (`app/session/*`, `app/modal.tsx`, `app/nutrition-setup/*`) follow
 * the same "not nested under onboarding/ or (tabs)/" shape and are reachable regardless of
 * `hasProfile`, confirming the pattern.
 *
 * Card content lives in the shared `ExplainerCards` component (also used by the wizard-step
 * entry point at app/onboarding/explainer.tsx). Close returns to the previous screen
 * (Settings).
 */

import { useRouter } from 'expo-router';
import { ExplainerCards } from '../components/onboarding/ExplainerCards';

export default function ExplainerStandalone(): React.JSX.Element {
  const router = useRouter();

  return <ExplainerCards mode="standalone" onDone={() => router.back()} />;
}
