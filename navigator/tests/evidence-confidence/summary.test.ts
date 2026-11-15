import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScenario, evidenceScopeKey } from '../../lib/assessment';
import { resolveAnalysisContext } from '../../lib/analysis-context';
import { engineeringScopeKey } from '../../lib/engineering-context';
import { decodeGlobalTerrain } from '../../lib/global-terrain';
import { evaluateDeclaredBounds, type UncertaintyEnvelope } from '../../lib/engineering-evidence/uncertainty';
import { evaluateEvidenceConfidence, exportEvidenceConfidence } from '../../lib/evidence-confidence';
import { catalog, manifest, provenance, scenario } from './fixtures';
import { readFileSync } from 'node:fs';

test('actual selected scenario retains canonical identity, outcome and terrain/sphere values', () => {
  const state = scenario(), a = evaluateScenario(catalog, state, manifest);
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(summary.scenarioKey, a.scenarioKey);
  assert.equal(summary.modelVersion, a.modelVersion);
  assert.equal(summary.datasetId, manifest.datasetId);
  assert.equal(summary.outcome, a.outcome);
  assert.deepEqual(summary.decisionLimits, a.constraints.filter(c => c.required && c.state !== 'pass'));
  assert.deepEqual(summary.metrics.map(m => [m.terrain, m.sphere]), [[a.mission.minBatteryWh, a.sphereMission.minBatteryWh], [a.mission.unmetWh, a.sphereMission.unmetWh], [a.mission.contactFraction, a.sphereMission.contactFraction]]);
  assert.deepEqual(summary.selection.heightsM, { display: 2, array: 2, antenna: 10 });
  assert.equal(summary.selection.startUtc, '2026-01-01T00:00:00.000Z');
  assert.equal(summary.selection.endUtcExclusive, '2026-01-01T04:00:00.000Z');
  assert.equal(summary.calibratedPhysicalUncertainty, 'not-supplied');
  assert.equal(summary.physicalOutcomeInterval, null);
  assert.match(summary.items.find(i => i.id === 'encoding')!.decisionLimit, /Neither storage precision/);
  assert.equal(summary.items.find(i => i.id === 'power')!.basis, 'assumed');
});

test('returned evidence is detached; neither inputs nor canonical arrays are mutated', () => {
  const state = scenario(), before = structuredClone({ state, manifest, catalog });
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  summary.heldScenario.mission.loadW = 999;
  summary.evidence[0].notes.push('modified output');
  assert.deepEqual({ state, manifest, catalog }, before);
});

test('custom borrowed horizons disclose actual cell/distance, never inherit a named location source', () => {
  const state = { ...scenario(), custom: { lat: -85.01, lon: 0.01 }, antennaHeightM: 2 };
  const context = resolveAnalysisContext(catalog, { ...state, displayHeightM: state.heightM }, manifest);
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(summary.selection.locationSource, 'Scenario input');
  assert.equal(summary.selection.name, 'Selected custom point');
  assert.equal(summary.evidence.find(e => e.id === 'array-horizon')!.coverage, 'borrowed');
  assert.ok(summary.items.find(i => i.id === 'array-terrain')!.detail.includes(`distance ${context.arrayTerrain.distanceKm} km`));
  assert.match(summary.items.find(i => i.id === 'array-terrain')!.detail, /No guaranteed safe borrowing distance/);
});

test('a missing subsystem horizon stays unknown while the smooth sphere remains beside it', () => {
  const state = { ...scenario(), custom: { lat: -85, lon: 0 }, arrayHeightM: 10, antennaHeightM: 2 };
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(summary.metrics[0].terrain, null);
  assert.equal(typeof summary.metrics[0].sphere, 'number');
  assert.match(summary.items.find(i => i.id === 'array-terrain')!.detail, /No matching horizon/);
  assert.match(summary.items.find(i => i.id === 'array-terrain')!.nextEvidence, /10 m/);
});

test('explicit global-at-point context is coarse at requested coordinates rather than spatial borrowing', async () => {
  const globalTerrain = await decodeGlobalTerrain(JSON.parse(readFileSync('public/data/global-terrain.json', 'utf8')), new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
  const summary = evaluateEvidenceConfidence({ catalog: { ...catalog, globalTerrain }, state: { ...scenario(), custom: { lat: -85, lon: 0 }, terrainMode: 'global-at-point' }, manifest });
  assert.match(summary.items.find(i => i.id === 'array-terrain')!.detail, /Coarse global horizon at requested coordinates/);
  assert.doesNotMatch(summary.items.find(i => i.id === 'array-terrain')!.detail, /Borrowed from/);
  assert.equal(summary.evidence.find(e => e.id === 'array-horizon')!.coverage, 'partial');
  assert.equal(summary.physicalOutcomeInterval, null);
});

test('finite encoding/source spacing and complete metadata do not become physical calibration', () => {
  const complete = { ...manifest, entries: manifest.entries.map(e => ({ ...e, coverage: 'complete' as const, sourceSpacingM: 0.001, effectiveResolutionM: 0.001, outputSpacingM: 0.001 })) };
  const state = scenario(); state.mission.loadW = 0;
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest: complete });
  assert.equal(summary.outcome, 'passes-assessed');
  assert.equal(summary.calibratedPhysicalUncertainty, 'not-supplied');
  assert.equal(summary.physicalOutcomeInterval, null);
  assert.equal(summary.items.find(i => i.id === 'array-terrain')!.basis, 'unquantified');
});

test('final epoch cannot be extrapolated or a stay silently trimmed', () => {
  assert.throws(() => evaluateEvidenceConfidence({ catalog, state: { ...scenario(), startIndex: catalog.meta.n - 1, endIndex: catalog.meta.n - 1 }, manifest }), /Invalid scenario/);
  const shorter = { ...manifest, validUntilUtcExclusive: '2026-01-01T03:00:00Z' };
  assert.throws(() => evaluateEvidenceConfidence({ catalog, state: scenario(), manifest: shorter }), /outside prepared evidence coverage/);
  assert.equal(evaluateEvidenceConfidence({ catalog, state: { ...scenario(), startIndex: catalog.meta.n - 2, endIndex: catalog.meta.n - 2 }, manifest }).selection.endUtcExclusive, new Date(catalog.meta.t1).toISOString());
});

test('missing ephemeris metadata does not acquire a reference comparison claim', () => {
  const missing = { ...manifest, entries: manifest.entries.filter(e => e.id !== 'ephemeris') };
  const summary = evaluateEvidenceConfidence({ catalog, state: scenario(), manifest: missing });
  assert.equal(summary.items.find(i => i.id === 'directions')!.basis, 'unquantified');
  assert.equal(summary.metrics[0].terrain, null);
});

test('known failure retains canonical precedence over required external gaps', () => {
  const state = scenario(); state.mission.loadW = 1e6; state.requirements.scope = 'landing-readiness';
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(summary.outcome, 'fails-assessed');
  assert.ok(summary.decisionLimits.some(c => c.state === 'fail'));
  assert.ok(summary.decisionLimits.some(c => c.state === 'not-assessed'));
  assert.ok(summary.items.some(i => i.id === 'constraint:navigation-guidance'));
});

test('current reported passes remain externally reported; changed scope is stale', () => {
  const state = scenario(); state.requirements.requiredExternal = ['thermal-survival'];
  state.externalAssessments = [{ id: 'thermal-survival', status: 'reported-pass', source: 'Synthetic report', author: 'Test only', notes: '', scenarioKey: evidenceScopeKey(state, manifest.datasetId) }];
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(summary.decisionLimits.find(c => c.id === 'thermal-survival')!.state, 'conditional');
  assert.match(summary.items.find(i => i.id === 'constraint:thermal-survival')!.detail, /not internally verified/);
  state.mission.loadW += 1;
  const stale = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.equal(stale.decisionLimits.find(c => c.id === 'thermal-survival')!.reasonCode, 'external-report-stale');
});

test('supplied footprint measurements retain source and stale scope without claiming calibration', () => {
  const state = scenario();
  state.engineeringInputs = { footprint: { measuredSlopeDeg: 4, maxSlopeDeg: 10 } };
  state.engineeringEvidence = { footprint: { source: 'Synthetic survey fixture', author: 'Test surveyor', scopeKey: engineeringScopeKey(state, manifest.datasetId) } };
  const current = evaluateEvidenceConfidence({ catalog, state, manifest });
  const item = current.items.find(i => i.id === 'supplied-footprint')!;
  assert.equal(item.basis, 'reported-measurement');
  assert.match(item.detail, /Measured maximum footprint slope: 4 deg/);
  assert.match(item.detail, /Synthetic survey fixture/);
  assert.equal(current.calibratedPhysicalUncertainty, 'not-supplied');
  state.startIndex++;
  const stale = evaluateEvidenceConfidence({ catalog, state, manifest });
  assert.match(stale.items.find(i => i.id === 'supplied-footprint')!.detail, /Canonical screen: not-assessed/);
  assert.match(stale.items.find(i => i.id === 'supplied-footprint')!.detail, /another site, stay or dataset/);
});

function bounds(state = scenario()): UncertaintyEnvelope {
  return { schema: 'solarreach-declared-bounds-1', scenarioKey: evaluateScenario(catalog, state, manifest).scenarioKey, bounds: [{ field: 'loadW', lower: 200, upper: 300, provenance }] };
}
test('no cases, declared bounds, degenerate bounds and recomputed cases are distinct', async () => {
  const state = scenario(), declaredBounds = bounds(state);
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest }).finite.status, 'missing');
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, declaredBounds }).finite.status, 'declared');
  const stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest, declaredBounds, stability });
  assert.equal(summary.finite.status, 'current');
  assert.equal(summary.finite.result!.cases.length, 3);
  assert.deepEqual(summary.finite.result!.sampledBatteryRangeWh, stability.sampledBatteryRangeWh);
  assert.equal(summary.physicalOutcomeInterval, null);
  const point = bounds(); point.bounds[0].lower = point.bounds[0].upper = state.mission.loadW;
  const one = await evaluateDeclaredBounds(catalog, manifest, state, point);
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, stability: one }).finite.result!.cases.length, 1);
});

test('aggregate flags/extrema are derived; forged cases are rejected even with a current binding', async () => {
  const state = scenario(), declaredBounds = bounds(state);
  const stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
  const original = structuredClone(stability);
  stability.outcomeStable = !stability.outcomeStable; stability.sampledBatteryRangeWh = [-1e9, 1e9]; stability.allCasesHaveBattery = false;
  const corrected = evaluateEvidenceConfidence({ catalog, state, manifest, stability });
  assert.equal(corrected.finite.status, 'current');
  assert.equal(corrected.finite.result!.outcomeStable, original.outcomeStable);
  assert.deepEqual(corrected.finite.result!.sampledBatteryRangeWh, original.sampledBatteryRangeWh);
  stability.cases[0].minimumBatteryWh = -100;
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, stability }).finite.status, 'invalid');
});

test('finite evidence requires every case, nominal containment, canonical domains and held requirements', async () => {
  const state = scenario(), declaredBounds = bounds(state);
  const stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
  for (const mutate of [(r: typeof stability) => { r.cases.pop(); }, (r: typeof stability) => { r.heldRequirements.requireReserve = false; }, (r: typeof stability) => { r.heldOperations.maxChargeW = 0; }]) {
    const changed = structuredClone(stability); mutate(changed);
    assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, stability: changed }).finite.status, 'invalid');
  }
  for (const [field, lower, upper] of [['efficiency', 0, 1.1], ['loadW', 251, 300], ['loadW', NaN, 300], ['chargeEfficiency', 0, 1]] as const) {
    const invalid = { ...declaredBounds, bounds: [{ field, lower, upper, provenance }] };
    assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, declaredBounds: invalid }).finite.status, 'invalid');
  }
});

test('changed scenario/dataset and mismatched bounds hide old numerical case results', async () => {
  const state = scenario(), declaredBounds = bounds(state);
  const stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
  const changed = evaluateEvidenceConfidence({ catalog, state: { ...state, arrayHeightM: 10 }, manifest, stability });
  assert.equal(changed.finite.status, 'stale'); assert.equal(changed.finite.result, null);
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest: { ...manifest, datasetId: 'other' }, declaredBounds }).finite.status, 'stale');
  declaredBounds.bounds[0].upper = 350;
  assert.equal(evaluateEvidenceConfidence({ catalog, state, manifest, declaredBounds, stability }).finite.status, 'invalid');
});

test('observation provenance does not calibrate a declared physical bound', () => {
  const declaredBounds = bounds(); declaredBounds.bounds[0].provenance = { ...provenance, kind: 'observation' };
  const summary = evaluateEvidenceConfidence({ catalog, state: scenario(), manifest, declaredBounds });
  assert.equal(summary.items.find(i => i.id === 'bounds')!.basis, 'declared-bound');
  assert.equal(summary.calibratedPhysicalUncertainty, 'not-supplied');
});

test('sample range matches an independent constant-dark energy calculation, not a continuous enclosure', async () => {
  const darkCatalog = { ...catalog, sites: [{ ...catalog.sites[0], id: 'synthetic-dark', horizons: [2, 10].map(heightM => ({ heightM, stepDeg: 1, mask: new Float64Array(360).fill(90) })) }] };
  const state = { ...scenario(), siteId: 'synthetic-dark' };
  const declaredBounds: UncertaintyEnvelope = { ...bounds(), scenarioKey: evaluateScenario(darkCatalog, state, manifest).scenarioKey };
  const stability = await evaluateDeclaredBounds(darkCatalog, manifest, state, declaredBounds);
  const summary = evaluateEvidenceConfidence({ catalog: darkCatalog, state, manifest, stability });
  const expected = [10000 - 4 * 300 / 0.95, 10000 - 4 * 200 / 0.95];
  summary.finite.result!.sampledBatteryRangeWh!.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9));
  assert.match(summary.finite.explanation, /tested cases only/);
  assert.match(summary.items.find(i => i.id === 'bounds')!.detail, /200…300 W/);
});

test('all unknown finite battery cases retain null extrema instead of zero or fabricated bounds', async () => {
  const state = scenario();
  const missing = { ...manifest, entries: manifest.entries.filter(e => e.id !== 'ephemeris') };
  const declaredBounds = { ...bounds(), scenarioKey: evaluateScenario(catalog, state, missing).scenarioKey };
  const stability = await evaluateDeclaredBounds(catalog, missing, state, declaredBounds);
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest: missing, stability });
  assert.equal(summary.finite.status, 'current');
  assert.equal(summary.finite.result!.sampledBatteryRangeWh, null);
  assert.equal(summary.finite.result!.allCasesHaveBattery, false);
  assert.equal(summary.physicalOutcomeInterval, null);
});

test('export retains every nominal held input, source identity, null and finite case; replay is canonical', async () => {
  const state = scenario(); state.operations.loadSegments = [{ id: 'Unicode Δ experiment', startOffsetHours: 0.5, endOffsetHours: 2, additionalW: 75 }];
  state.operations.maxChargeW = 0; state.radio = { frequencyGHz: 8.4, txPowerW: 100 };
  const declaredBounds = bounds(state), stability = await evaluateDeclaredBounds(catalog, manifest, state, declaredBounds);
  // Demonstrate the old export's exact gap without modifying the old exporter.
  assert.equal('heldScenario' in JSON.parse(JSON.stringify(stability)), false);
  assert.equal('datasetId' in stability, false);
  const summary = evaluateEvidenceConfidence({ catalog, state, manifest, stability });
  const record = JSON.parse(exportEvidenceConfidence(summary, '2026-11-15T12:00:00Z'));
  assert.deepEqual(record.heldScenario, summary.heldScenario);
  assert.deepEqual(record.heldScenario.operations.loadSegments, state.operations.loadSegments);
  assert.equal(record.heldScenario.operations.maxChargeW, 0);
  assert.equal(record.physicalOutcomeInterval, null);
  assert.equal(record.evidence[0].sha256, summary.evidence[0].sha256);
  assert.deepEqual(record.finite.result.cases, stability.cases);
  assert.equal(evaluateScenario(catalog, record.heldScenario, manifest).scenarioKey, record.scenarioKey);
  assert.match(record.integrity, /does not rehash/);
  for (const bad of ['not a date', '2026-02-31T00:00:00Z', '2026-11-15T12:00:00+01:00']) assert.throws(() => exportEvidenceConfidence(summary, bad), /real ISO UTC/);
});
