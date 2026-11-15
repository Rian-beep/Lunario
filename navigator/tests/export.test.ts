import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "../lib/export";
test("spreadsheet formulas in user metric names are neutralized", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(-10), '"-10"');
});
test("CSV quotes preserve commas and literal quotes", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(null), '"Unknown"');
});
