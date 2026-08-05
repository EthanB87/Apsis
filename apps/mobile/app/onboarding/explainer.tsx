/**
 * apps/mobile/app/onboarding/explainer.tsx — wizard step 1 (D-15)
 *
 * Placement: FIRST step of the wizard, before any input, so the pitch lands at peak
 * attention and motivates the threshold HR/pace asks that follow (D-15). Made the
 * onboarding stack's initial route via `unstable_settings.initialRouteName` in
 * onboarding/_layout.tsx. Both Skip and the final card's "Get started" advance straight
 * to `sex` — the wizard's first real input step.
 *
 * Card content itself lives in the shared `ExplainerCards` component (also used by the
 * standalone Settings revisit at app/explainer.tsx — see that file's doc comment for why
 * the standalone entry point is NOT nested under onboarding/).
 */

import { useRouter } from 'expo-router';
import { ExplainerCards } from '../../components/onboarding/ExplainerCards';

export default function ExplainerStep(): React.JSX.Element {
  const router = useRouter();

  return <ExplainerCards mode="wizard" onDone={() => router.push('/onboarding/sex')} />;
}
