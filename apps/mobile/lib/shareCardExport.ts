/**
 * apps/mobile/lib/shareCardExport.ts
 *
 * Native glue for the share-card export pipeline (08-RESEARCH.md Pattern 1, Open Question 1
 * -- the phase's required on-device spike): Skia canvas snapshot -> encode to PNG bytes ->
 * write to a cache file -> hand the file URI to the native iOS share sheet.
 *
 * House convention (`nutritionCameraAuth.ts` analog): a native-capability wrapper never
 * throws to its caller -- any failure is logged `[Apsis]`-prefixed and reported as a safe
 * fallback (`false`) so the calling screen can render its own fallback UX instead of
 * crashing.
 *
 * Not vitest-testable (native modules: Skia canvas snapshot, expo-file-system,
 * expo-sharing, expo-image-picker) -- UAT-only, per 08-RESEARCH.md's Validation Architecture.
 *
 * 08-04 adds the photo-first background pick (D-06/D-08/D-15/D-16): a permission wrapper and
 * a pick wrapper, both following this file's existing never-throws convention. Per the
 * installed `expo-image-picker` 56.0.22 `.d.ts` (`ImagePicker.types.d.ts`), the permission
 * response's `granted` boolean is already `true` for iOS's "limited" access state (not just
 * "all") -- `accessPrivileges` is checked in addition purely as an explicit belt-and-braces
 * signal per Pitfall 5, since only `accessPrivileges === 'none'` (or a false `granted`) is a
 * true deny.
 */

import type { RefObject } from 'react';
import { ImageFormat, type CanvasRef } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';

/**
 * Snapshots the given canvas ref, writes it to a PNG file in the cache directory, and opens
 * the native iOS share sheet with that file. Resolves `true` only when the share sheet was
 * actually presented; `false` on any failure (canvas not yet mounted/measured -- Pitfall 4,
 * a thrown error from any step, or sharing unavailable on this device) -- never throws.
 */
export async function exportAndShareCard(canvasRef: RefObject<CanvasRef | null>): Promise<boolean> {
  let file: File | undefined;
  try {
    const image = canvasRef.current?.makeImageSnapshot();
    if (!image) return false; // Pitfall 4 -- canvas not yet mounted/measured

    const bytes = image.encodeToBytes(ImageFormat.PNG);

    file = new File(Paths.cache, `apsis-share-${Date.now()}.png`);
    file.create({ overwrite: true }); // Pitfall 2 -- always create before write, defensively
    file.write(bytes);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png' });
      return true;
    }
    return false;
  } catch (err: unknown) {
    console.error('[Apsis] shareCardExport failed:', err);
    return false;
  } finally {
    // WR-02: the exported PNG has served its purpose once the share sheet has resolved (or the
    // pipeline bailed out early) -- delete it so cache PNGs don't accumulate unboundedly.
    // Best-effort only: a cleanup failure must never surface to the caller or override the
    // already-decided share result (this file's never-throws convention).
    try {
      file?.delete();
    } catch (err: unknown) {
      console.error('[Apsis] shareCardExport cache cleanup failed:', err);
    }
  }
}

export interface PhotoLibraryPermissionResult {
  /**
   * True when the photo library picker will actually work -- full ('all') OR limited access.
   * Only a clean deny (`accessPrivileges === 'none'` / `granted === false`) is unusable
   * (Pitfall 5: iOS's "Limited Access" is a silent partial-grant, not a deny).
   */
  usable: boolean;
}

/**
 * Requests iOS photo-library permission for the share-card background picker (D-06/D-16).
 * Never throws: any failure is logged `[Apsis]`-prefixed and reported as unusable, so the
 * calling screen can render its permission-denied alert + void-card fallback instead of
 * crashing.
 */
export async function requestPhotoLibraryPermission(): Promise<PhotoLibraryPermissionResult> {
  try {
    const response = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const usable = response.granted || response.accessPrivileges === 'all' || response.accessPrivileges === 'limited';
    return { usable };
  } catch (err: unknown) {
    console.error('[Apsis] Photo library permission request failed:', err);
    return { usable: false };
  }
}

/**
 * Launches the native photo library picker with `allowsEditing: true` -- on iOS this forces
 * the native crop UI to a square regardless of the (Android-only) `aspect` option, giving
 * D-15's square-crop requirement for free with no custom crop code. Resolves the picked
 * asset's `uri`, or `null` when the user canceled or the result has no assets (D-07 skip /
 * Pitfall 5 empty-under-limited-access). Never throws.
 */
export async function pickShareBackgroundPhoto(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  } catch (err: unknown) {
    console.error('[Apsis] Photo pick failed:', err);
    return null;
  }
}
