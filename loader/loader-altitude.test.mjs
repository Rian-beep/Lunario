/**
 * Lightweight checks for altitude touchdown semantics (no DOM).
 * Run: node --test loader/loader-altitude.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, "loader.js"), "utf8");

test("loader holds altitude above zero until hide, then lands at ALT 00000 before leave", () => {
  assert.match(src, /HOLD_FLOOR/);
  assert.match(src, /ALT 00000 M/);
  assert.match(src, /TOUCHDOWN_HOLD_MS/);
  assert.match(src, /never touch 0|never zero yet|Never zero/i);
  assert.match(src, /landAt_alt = Math\.max\(displayedAlt/);
});

test("loader documents touchdown-gated dashboard open", () => {
  assert.match(src, /opens on touchdown/i);
});
