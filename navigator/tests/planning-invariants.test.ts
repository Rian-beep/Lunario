import { test } from "node:test";
import assert from "node:assert/strict";
import { runPlanningVerification } from "../scripts/verify-planning.mjs";

const verification = runPlanningVerification();
for (const id of ["celestial-analytic", "disk-and-ray-edges", "interpolation-is-not-evidence", "darkness-energy", "charge-rate-limit", "operations-energy-conservation", "initial-reserve-and-zero-capacity", "event-model-version", "radio-friis", "utc-endpoint", "independent-instrument-heights", "missing-horizon-no-pass", "missing-ephemeris-no-pass", "invalid-ephemeris-no-pass", "nan-no-pass", "unknown-gap-preserves-known-failure", "custom-slope-not-inherited", "no-default-external-certification", "report-identity-and-staleness", "bounded-first-failure", "search-open-reproduction", "sensitivity-determinism", "actual-frame-evidence-not-promoted", "actual-product-mask-sanity"]) {
  test(`planning invariant: ${id}`, async () => {
    const report = await verification;
    const check = report.checks.find((entry) => entry.id === id);
    assert.ok(check, "invariant was not run");
    assert.equal(check.status, "pass", `${check.reference}\nActual failure: ${check.error}`);
  });
}
test("scientific truth gate stays incomplete and archived Horizons is never presented as a fresh check", async () => {
  const report = await verification;
  assert.equal(report.scientificValidation, "INCOMPLETE");
  assert.equal(report.gates[0].status, "INCOMPLETE");
  assert.match(report.gates[0].reason, /DE421/);
  assert.match(report.gates[0].reason, /DE441/);
  assert.equal(report.skipped[0].id, "fresh-horizons");
  assert.equal(report.skipped[0].historicalRecord.toleranceDeg, 0.02);
  assert.equal(report.skipped[0].historicalRecord.rows.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 56);
  assert.ok(report.software.fileHashes.every((entry) => entry.sha256 === null || /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.equal(report.counts.fail, report.checks.filter((entry) => entry.status === "fail").length);
  assert.ok(report.checks.every((entry) => entry.actual !== undefined && Number.isFinite(entry.durationMs)));
});
