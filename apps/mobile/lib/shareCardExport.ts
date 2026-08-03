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
 * expo-sharing) -- UAT-only, per 08-RESEARCH.md's Validation Architecture.
 */

import type { RefObject } from 'react';
import { ImageFormat, type CanvasRef } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Snapshots the given canvas ref, writes it to a PNG file in the cache directory, and opens
 * the native iOS share sheet with that file. Resolves `true` only when the share sheet was
 * actually presented; `false` on any failure (canvas not yet mounted/measured -- Pitfall 4,
 * a thrown error from any step, or sharing unavailable on this device) -- never throws.
 */
export async function exportAndShareCard(canvasRef: RefObject<CanvasRef | null>): Promise<boolean> {
  try {
    const image = canvasRef.current?.makeImageSnapshot();
    if (!image) return false; // Pitfall 4 -- canvas not yet mounted/measured

    const bytes = image.encodeToBytes(ImageFormat.PNG);

    const file = new File(Paths.cache, `apsis-share-${Date.now()}.png`);
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
  }
}
