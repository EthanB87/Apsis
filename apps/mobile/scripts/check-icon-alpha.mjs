#!/usr/bin/env node
// Guards against RESEARCH.md Pitfall 1: an RGBA app icon (has an alpha channel)
// getting submitted to the App Store, where opaque icons are required.
//
// Reads the PNG IHDR chunk directly (no external deps) and checks the
// colorType byte at offset 25:
//   0 = grayscale        (opaque)  -> OK
//   2 = RGB               (opaque)  -> OK
//   3 = indexed-color      (palette; alpha only via optional tRNS, not checked here)
//   4 = grayscale + alpha (has alpha) -> FAIL
//   6 = RGB + alpha        (has alpha) -> FAIL
//
// Usage: node apps/mobile/scripts/check-icon-alpha.mjs [path-to-png]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ICON_PATH = path.resolve(__dirname, "../assets/images/icon.png");

const OPAQUE_COLOR_TYPES = new Set([0, 2]);
const ALPHA_COLOR_TYPES = new Set([4, 6]);

const COLOR_TYPE_NAMES = {
  0: "grayscale",
  2: "RGB (truecolor)",
  3: "indexed-color (palette)",
  4: "grayscale + alpha",
  6: "RGB + alpha (RGBA)",
};

function checkIconAlpha(iconPath) {
  const buf = readFileSync(iconPath);

  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${iconPath} is not a valid PNG file (bad signature).`);
  }

  // IHDR is always the first chunk, immediately after the 8-byte signature:
  // 4 bytes length + 4 bytes "IHDR" type + 13 bytes of IHDR data + 4 bytes CRC.
  // IHDR data layout: width(4) height(4) bitDepth(1) colorType(1) ...
  const ihdrType = buf.toString("ascii", 12, 16);
  if (ihdrType !== "IHDR") {
    throw new Error(`${iconPath}: expected IHDR as first chunk, found "${ihdrType}".`);
  }

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);

  return { width, height, bitDepth, colorType };
}

function main() {
  const iconPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ICON_PATH;
  const { width, height, bitDepth, colorType } = checkIconAlpha(iconPath);

  const colorTypeName = COLOR_TYPE_NAMES[colorType] ?? `unknown (${colorType})`;
  console.log(`Checked: ${iconPath}`);
  console.log(`  ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType} (${colorTypeName})`);

  if (ALPHA_COLOR_TYPES.has(colorType)) {
    console.error(
      `FAIL: icon has an alpha channel (colorType=${colorType}, ${colorTypeName}). ` +
        `App Store icons must be fully opaque. Flatten onto a solid background and re-export as RGB (colorType 2).`
    );
    process.exit(1);
  }

  if (!OPAQUE_COLOR_TYPES.has(colorType)) {
    console.error(
      `FAIL: unexpected colorType=${colorType} (${colorTypeName}). Expected opaque RGB (2) or grayscale (0).`
    );
    process.exit(1);
  }

  console.log("PASS: icon is opaque (no alpha channel).");
  process.exit(0);
}

main();
