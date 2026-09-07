/**
 * apps/mobile/lib/nutritionCameraAuth.ts
 *
 * Camera-permission wrapper for the nutrition camera features — barcode scanning (07-08,
 * NUTR-08). Consumes this one gate rather than calling expo-camera's permission API ad hoc,
 * mirroring how `healthkitAuth.ts` centralizes the HealthKit authorization request.
 *
 * House convention (healthkitAuth.ts analog): a native-capability permission gate never
 * throws — a rejected/failed request is logged (`[Apsis]`-prefixed, Error object only) and
 * reported as `false` so callers render a permission-denied UX instead of crashing.
 *
 * Privacy (T-07-13, Repudiation/privacy — mitigate): the camera is used ONLY for barcode
 * scan, as disclosed by app.json's NSCameraUsageDescription. No
 * microphone permission is requested (the expo-camera config plugin is configured with
 * `microphonePermission: false` / `recordAudioAndroid: false`).
 *
 * Uses `Camera.requestCameraPermissionsAsync()` (the non-hook API, verified against the
 * installed expo-camera 56.0.8 .d.ts) so this stays a plain async function callable from
 * event handlers/effects — same shape as `requestHealthKitAuthorization`. The hook form
 * (`useCameraPermissions`) is deliberately not used here: screens needing reactive
 * permission state can layer it on top, but the single request gate lives here.
 */

import { Camera } from 'expo-camera';

/**
 * Requests iOS camera permission (presents the system prompt on first call; afterwards
 * resolves from the recorded grant state). Resolves `true` only when permission is
 * granted. Never throws: any failure is logged and reported as `false` so the calling
 * screen (scan) can show its permission-denied state instead of crashing.
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const response = await Camera.requestCameraPermissionsAsync();
    return response.granted;
  } catch (err: unknown) {
    console.error('[Apsis] Camera permission request failed:', err);
    return false;
  }
}
