import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { decodeCatalog } from '../lib/catalog';
import { withLandingSites } from '../lib/landing-catalog';
import { LANDING_SITES } from '../lib/landing-sites';
import { parseEvidenceManifest } from '../lib/provenance';
import { evaluateScenario, evidenceScopeKey } from '../lib/assessment';
import { buildSeries } from '../lib/astro';
import type { ScenarioState } from '../lib/scenario';
import { caseCursor, clampCursor, compareInputs, controlledAlternative, editCapturedCandidate, cursorDomain, cursorFromIndex, prepareCase, resultDeltas, type PreparedCase, type ReplanningCase } from '../lib/replanning/model';
import { initialSelection, selectCase } from '../lib/replanning/selection';
import { comparisonCurves, curveSample } from '../lib/replanning/curves';
import { alternativePlan, MAX_SCAN_CASES, MAX_SCAN_INTERVALS, paretoOptions, scanAlternatives, type TestedOption } from '../lib/replanning/scan';

const catalog = withLandingSites(decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json', 'utf8'))), LANDING_SITES);
const manifest = parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json', 'utf8')));
const demo = JSON.parse(readFileSync('public/data/planning-demo.json', 'utf8')) as { cases: { role: string; state: ScenarioState }[] };
const byRole = (role: string) => demo.cases.find(c => c.role === role)!.state;
const baseline = byRole('baseline'), delayed = byRole('delayed'), alternative = byRole('alternative'), unknown = byRole('unknown-historical');
const item = (name: string, state: ScenarioState): ReplanningCase => ({ id: name, name, state });
const prepare = (name: string, state: ScenarioState): PreparedCase => {
  const result = prepareCase(catalog, manifest, item(name, state));
  assert.ok(result.value, result.error ?? undefined);
  return result.value;
};
const reference = prepare('Reference', baseline), candidate = prepare('Delayed', delayed);
const immediate = () => Promise.resolve();

// Node SSR loads styles as inert class-name maps; no browser, server or generated app build.
const requireForTest = createRequire(import.meta.url);
requireForTest.extensions['.css'] = (module: NodeJS.Module) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };
Object.assign(globalThis, { React });
const { ReplanningWorkspace } = requireForTest('../components/replanning/workspace') as typeof import('../components/replanning/workspace');
const { ComparisonPlot } = requireForTest('../components/replanning/curves') as typeof import('../components/replanning/curves');

test('actual audit cases recompute through the shared authority and preserve the reserve violation', () => {
  assert.deepEqual(reference.assessment, evaluateScenario(catalog, baseline, manifest));
  assert.deepEqual(candidate.assessment, evaluateScenario(catalog, delayed, manifest));
  assert.equal(reference.assessment.outcome, 'conditional');
  assert.equal(candidate.assessment.outcome, 'fails-assessed');
  assert.equal(candidate.assessment.firstFailure?.kind, 'reserve-crossing');
  assert.ok(candidate.assessment.mission.unmetWh! > 50000);
  assert.deepEqual(candidate.context.arraySeries, buildSeries(catalog, candidate.context.location.lat, candidate.context.location.lon, candidate.context.arrayTerrain, delayed.startIndex, delayed.endIndex));
});

test('captured reference survives later candidate edits, map alternatives and parent state mutation', () => {
  let selection = initialSelection(item('Current reference', baseline), item('First candidate', delayed));
  selection = selectCase(selection, { target: 'reference', item: selection.candidate });
  const referenceState = structuredClone(selection.reference);
  selection = selectCase(selection, { target: 'candidate', item: item('Site alternative', alternative) });
  assert.deepEqual(selection.reference, referenceState);
  assert.equal(selection.candidate.state.siteId, alternative.siteId);
  const mutableSource = item('New main view', structuredClone(baseline));
  const captured = selectCase(selection, { target: 'candidate', item: mutableSource });
  mutableSource.state.mission.loadW = 9999;
  assert.equal(captured.candidate.state.mission.loadW, baseline.mission.loadW);
  assert.deepEqual(captured.reference, referenceState);
});

test('result deltas use actual paired assessments and never replace unknown differences with zero', () => {
  const deltas = resultDeltas(reference, candidate);
  assert.equal(deltas.find(d => d.label === 'Unserved demand')!.terrain, candidate.assessment.mission.unmetWh! - reference.assessment.mission.unmetWh!);
  assert.equal(deltas.find(d => d.label === 'Geometric antenna contact')!.terrain, (candidate.assessment.mission.contactFraction! - reference.assessment.mission.contactFraction!) * 100);
  const missing = resultDeltas(reference, prepare('Missing', unknown));
  assert.equal(missing.find(d => d.label === 'Reserve margin')!.terrain, null);
  assert.equal(missing.find(d => d.label === 'Unserved demand')!.terrain, null);
  assert.ok(missing.find(d => d.label === 'Unserved demand')!.sphere !== null);
});

test('elapsed cursor aligns mission hours while preserving exact different UTCs', () => {
  const domain = cursorDomain(catalog, baseline, delayed, 'elapsed')!;
  const r = caseCursor(catalog, baseline, domain, 17)!;
  const c = caseCursor(catalog, delayed, domain, 17)!;
  assert.equal(r.elapsedHours, 17); assert.equal(c.elapsedHours, 17);
  assert.equal(r.index, baseline.startIndex + 17); assert.equal(c.index, delayed.startIndex + 17);
  assert.equal(c.utcMs - r.utcMs, (delayed.startIndex - baseline.startIndex) * 3600000);
  assert.notEqual(new Date(r.utcMs).toISOString(), new Date(c.utcMs).toISOString());
});

test('absolute UTC overlap aligns the actual catalog index, never the arrival offset', () => {
  const shifted = controlledAlternative(catalog, baseline, null, 24);
  const domain = cursorDomain(catalog, baseline, shifted, 'utc')!;
  const r = caseCursor(catalog, baseline, domain, 3)!, c = caseCursor(catalog, shifted, domain, 3)!;
  assert.equal(r.index, c.index); assert.equal(r.utcMs, c.utcMs);
  assert.equal(r.elapsedHours - c.elapsedHours, 24);
  assert.equal(domain.max, (baseline.endIndex - shifted.startIndex) * catalog.meta.stepHours);
});

test('disjoint stays cannot offer absolute UTC overlap; shorter elapsed case has no fabricated final sample', () => {
  const short = { ...baseline, endIndex: baseline.startIndex + 3 };
  const domain = cursorDomain(catalog, short, baseline, 'elapsed')!;
  assert.equal(caseCursor(catalog, short, domain, 4), null);
  assert.ok(caseCursor(catalog, baseline, domain, 4));
  assert.equal(cursorDomain(catalog, baseline, { ...baseline, startIndex: baseline.endIndex + 1, endIndex: baseline.endIndex + 8 }, 'utc'), null);
});

test('first-violation navigation uses the absolute catalog interval and roundtrips to its source bracket', () => {
  const event = candidate.assessment.firstFailure!;
  const domain = cursorDomain(catalog, baseline, delayed, 'elapsed')!;
  const index = delayed.startIndex + event.intervalIndex;
  const position = cursorFromIndex(catalog, delayed, domain, index);
  const cursor = caseCursor(catalog, delayed, domain, position)!;
  assert.equal(cursor.index, index); assert.equal(new Date(cursor.utcMs).toISOString(), event.earliestUtc);
  assert.equal(Date.parse(event.latestUtc) - cursor.utcMs, catalog.meta.stepHours * 3600000);
  assert.ok(event.modelOffsetHours! >= position && event.modelOffsetHours! <= position + domain.step);
});

test('cursor clamps to real forcing samples at both boundaries and works with non-hourly source steps', () => {
  const c = { ...catalog, meta: { ...catalog.meta, stepHours: 2 } };
  const domain = cursorDomain(c, baseline, baseline, 'elapsed')!;
  assert.equal(clampCursor(-3, domain), 0); assert.equal(clampCursor(Infinity, domain), 0);
  assert.equal(clampCursor(3, domain), 4);
  assert.equal(caseCursor(c, baseline, domain, domain.max + 100)!.index, baseline.endIndex);
});

test('input comparison shows date-only changes and all held requirements and separate instrument heights', () => {
  const rows = compareInputs(baseline, delayed);
  assert.deepEqual(rows.filter(r => r.changed).map(r => r.path), ['endIndex', 'startIndex']);
  assert.ok(rows.some(r => r.path === 'requirements.scope' && !r.changed));
  assert.ok(rows.some(r => r.path === 'arrayHeightM' && !r.changed));
  assert.ok(rows.some(r => r.path === 'antennaHeightM' && !r.changed));
});

test('input comparison includes changed requirement scope, configured flight fields and evidence metadata', () => {
  const changed = structuredClone(baseline);
  changed.requirements.scope = 'landing-readiness'; changed.flight.eastOffsetM = (changed.flight.eastOffsetM ?? 0) + 1;
  changed.externalAssessments = [];
  const paths = compareInputs(baseline, changed).filter(r => r.changed).map(r => r.path);
  assert.ok(paths.includes('requirements.scope')); assert.ok(paths.includes('flight.eastOffsetM'));
  assert.ok(paths.includes('externalAssessments'));
  const result = prepare('Broader scope', changed).assessment;
  assert.ok(result.constraints.some(c => c.required && c.state === 'not-assessed'));
  assert.notEqual(result.outcome, 'passes-assessed');
});

test('controlled alternatives retain hardware, scheduled operations, requirements and report bindings exactly', () => {
  const before = structuredClone(delayed);
  const shifted = controlledAlternative(catalog, delayed, alternative.siteId, 48);
  assert.deepEqual(compareInputs(delayed, shifted).filter(r => r.changed).map(r => r.path), ['endIndex', 'siteId', 'startIndex']);
  assert.deepEqual(shifted.mission, delayed.mission); assert.deepEqual(shifted.requirements, delayed.requirements);
  assert.deepEqual(shifted.operations, delayed.operations); assert.deepEqual(shifted.externalAssessments, delayed.externalAssessments);
  assert.deepEqual(delayed, before);
  assert.throws(() => controlledAlternative(catalog, delayed, null, 0.5), /multiple/);
  assert.throws(() => controlledAlternative(catalog, delayed, 'invented-pin', 0), /Unknown/);
});

test('independent instrument horizons use actual different prepared heights rather than the display observer', () => {
  const state = { ...delayed, arrayHeightM: 10, antennaHeightM: 0, heightM: 2 };
  const prepared = prepare('Independent instruments', state);
  assert.equal(prepared.context.arrayTerrain.heightM, 10);
  assert.equal(prepared.context.antennaTerrain.heightM, 0);
  assert.notDeepEqual(prepared.context.arrayTerrain.mask, prepared.context.antennaTerrain.mask);
  assert.deepEqual(prepared.context.antennaSeries, buildSeries(catalog, prepared.context.location.lat, prepared.context.location.lon, prepared.context.antennaTerrain, state.startIndex, state.endIndex));
});

test('controlled date changes retain external reports but expose their stale scope instead of carrying forward a pass', () => {
  const state = structuredClone(baseline);
  state.requirements.requiredExternal = ['thermal-survival'];
  const binding = evidenceScopeKey(state, manifest.datasetId);
  state.externalAssessments = [{ id: 'thermal-survival', status: 'reported-pass', source: 'Explicit test report fixture', author: 'Test', notes: 'Fixture only, no qualified mission evidence', scenarioKey: binding }];
  const initial = prepare('Bound report fixture', state);
  assert.equal(initial.assessment.constraints.find(c => c.id === 'thermal-survival')!.state, 'conditional');
  const shifted = controlledAlternative(catalog, state, null, 24);
  const changed = prepare('Changed date', shifted);
  assert.deepEqual(shifted.externalAssessments, state.externalAssessments);
  assert.equal(changed.assessment.constraints.find(c => c.id === 'thermal-survival')!.reasonCode, 'external-report-stale');
  assert.equal(changed.assessment.constraints.find(c => c.id === 'thermal-survival')!.state, 'not-assessed');
});

test('operation boundaries in the real model become exact plotted power and storage boundaries without extra sunlight samples', () => {
  const state = structuredClone(baseline);
  state.operations.deploymentDelayHours = 0.5;
  state.operations.loadSegments = [{ id: 'sample-task', startOffsetHours: 0.25, endOffsetHours: 0.75, additionalW: 100 }];
  const prepared = prepare('Scheduled operations', state);
  const domain = cursorDomain(catalog, state, state, 'elapsed')!;
  const curves = comparisonCurves([prepared, prepared], domain, catalog.meta.stepHours);
  const load = curves[0].lines.find(l => l.name === 'Reference · electrical load')!;
  assert.equal(curveSample(load.points, 0.1)!.y, state.mission.loadW);
  assert.equal(curveSample(load.points, 0.3)!.y, state.mission.loadW + 100);
  assert.equal(curveSample(load.points, 0.8)!.y, state.mission.loadW);
  assert.ok(curves[1].lines[0].points.some(p => p.x === 0.5));
  assert.equal(prepared.context.arraySeries.sunEl.length, baseline.endIndex - baseline.startIndex + 1);
});

test('out-of-coverage dates are rejected without changing or shortening the case', () => {
  const outside = controlledAlternative(catalog, baseline, null, -catalog.meta.n);
  const before = structuredClone(outside);
  const prepared = prepareCase(catalog, manifest, item('Outside', outside));
  assert.equal(prepared.value, null); assert.match(prepared.error!, /unsupported|invalid/i);
  assert.deepEqual(outside, before);
});

test('historical missing horizon remains unknown while its sphere comparison remains computed', () => {
  const prepared = prepare('Unknown historical', unknown);
  assert.equal(prepared.assessment.outcome, 'incomplete');
  assert.equal(prepared.assessment.mission.generatedWh, null);
  assert.ok(prepared.assessment.sphereMission.generatedWh !== null);
  assert.ok(Array.from(prepared.context.arraySeries.sunHorizon).every(Number.isNaN));
  assert.ok(Array.from(prepared.context.antennaSeries.earthHorizon).every(Number.isNaN));
});

test('actual plotted power, storage and contact reproduce evaluator subsegments for terrain and sphere', () => {
  const domain = cursorDomain(catalog, baseline, delayed, 'elapsed')!;
  const groups = comparisonCurves([reference, candidate], domain, catalog.meta.stepHours);
  const power = groups[0].lines.find(l => l.name === 'Candidate · terrain')!;
  const storage = groups[1].lines.find(l => l.name === 'Candidate · terrain')!;
  const contact = groups[2].lines.find(l => l.name === 'Candidate · smooth sphere')!;
  assert.deepEqual(power.points.map(p => p.y), candidate.assessment.mission.subsegments.map(t => t.powerW ?? NaN));
  assert.equal(storage.points[0].y, delayed.mission.batteryWh * delayed.mission.initialSoc);
  assert.equal(storage.points.at(-1)!.y, candidate.assessment.mission.finalBatteryWh);
  assert.equal(storage.points.at(-1)!.x, candidate.assessment.mission.timeline.length * catalog.meta.stepHours);
  assert.deepEqual(contact.points.map(p => p.y), candidate.assessment.sphereMission.timeline.map(t => t.contact === null ? NaN : Number(t.contact)));
  assert.ok(power.stepped); assert.ok(groups.every(g => g.lines.some(l => l.name.includes('smooth sphere'))));
});

test('UTC-aligned curve coordinates correspond to separate arrival epochs with no source-data substitution', () => {
  const shifted = prepare('Shifted', controlledAlternative(catalog, baseline, null, 24));
  const domain = cursorDomain(catalog, baseline, shifted.state, 'utc')!;
  const lines = comparisonCurves([reference, shifted], domain, catalog.meta.stepHours)[0].lines;
  assert.equal(lines.find(l => l.name === 'Reference · terrain')!.points[0].x, -24);
  assert.equal(lines.find(l => l.name === 'Candidate · terrain')!.points[0].x, 0);
});

test('unknown curves and outside-stay readouts remain gaps rather than zero or extrapolated endpoints', () => {
  const missing = prepare('Missing', unknown);
  const domain = cursorDomain(catalog, baseline, unknown, 'elapsed')!;
  const groups = comparisonCurves([reference, missing], domain, catalog.meta.stepHours);
  assert.ok(groups[0].lines.find(l => l.name === 'Candidate · terrain')!.points.every(p => Number.isNaN(p.y)));
  assert.ok(groups[2].lines.find(l => l.name === 'Candidate · terrain')!.points.every(p => Number.isNaN(p.y)));
  const points = [{ x: 0, y: 1, endX: 1 }, { x: 2, y: NaN, endX: 3 }];
  assert.equal(curveSample(points, -1), null); assert.equal(curveSample(points, 1.5), null);
  assert.equal(curveSample(points, 3), null); assert.ok(Number.isNaN(curveSample(points, 2)!.y));
});

test('curve readout lookup is logarithmic on long source series', () => {
  let reads = 0;
  const points = Array.from({ length: 100000 }, (_, x) => ({ get x() { reads++; return x; }, y: x, endX: x + 1 }));
  assert.equal(curveSample(points, 50000.5)!.y, 50000);
  assert.ok(reads < 40, `Expected bounded lookup; read ${reads} coordinates`);
});

test('explicit grid deduplicates states and enforces both case and source-interval budgets before evaluations', () => {
  const cases = alternativePlan(catalog, delayed, [delayed.siteId, alternative.siteId, alternative.siteId], [0, 24, 24]);
  assert.equal(cases.length, 4); assert.equal(new Set(cases.map(c => c.id)).size, 4);
  for (const c of cases) { assert.deepEqual(c.state.mission, delayed.mission); assert.deepEqual(c.state.requirements, delayed.requirements); }
  assert.throws(() => alternativePlan(catalog, delayed, [], []), /1–7/);
  assert.throws(() => alternativePlan(catalog, delayed, [], Array(8).fill(0)), /1–7/);
  const full = { ...baseline, startIndex: 0, endIndex: catalog.meta.n - 2 };
  assert.throws(() => alternativePlan(catalog, full, [alternative.siteId], [0, 24, 48, 72, 96]), /budget/);
  assert.ok(MAX_SCAN_CASES <= 48); assert.equal(MAX_SCAN_INTERVALS, 150000);
});

test('bounded actual scan computes the audit site alternative and records unsupported requests explicitly', async () => {
  const cases = alternativePlan(catalog, delayed, [alternative.siteId, unknown.siteId], [0]);
  const outside = item('Unsupported', controlledAlternative(catalog, delayed, null, catalog.meta.n));
  const progress: number[] = [];
  const result = await scanAlternatives(catalog, manifest, delayed, [...cases, outside], { signal: new AbortController().signal, yieldTask: immediate, onProgress: n => progress.push(n) });
  assert.equal(result.cancelled, false); assert.equal(result.rows.length, 4); assert.deepEqual(progress, [1, 2, 3, 4]);
  const restored = result.rows.find(r => r.state.siteId === alternative.siteId)!;
  assert.deepEqual(restored.assessment, evaluateScenario(catalog, alternative, manifest));
  assert.equal(restored.assessment!.outcome, 'conditional');
  assert.equal(result.rows.find(r => r.state.siteId === unknown.siteId)!.assessment!.outcome, 'incomplete');
  assert.equal(result.rows.at(-1)!.assessment, null); assert.ok(result.rows.at(-1)!.error);
});

test('scan cancellation retains only assessed cases and does not evaluate later work', async () => {
  const controller = new AbortController(), cases = alternativePlan(catalog, delayed, [alternative.siteId], [0, 24]);
  let yields = 0;
  const result = await scanAlternatives(catalog, manifest, delayed, cases, { signal: controller.signal, yieldTask: async () => { yields++; }, onProgress: n => { if (n === 1) controller.abort(); } });
  assert.equal(result.cancelled, true); assert.equal(result.rows.length, 1); assert.equal(yields, 2);
  const aborted = new AbortController(); aborted.abort();
  assert.equal((await scanAlternatives(catalog, manifest, delayed, cases, { signal: aborted.signal, yieldTask: immediate })).rows.length, 0);
});

test('Pareto ranking retains unknowns and conditional evidence instead of fabricating a best mission', async () => {
  const result = await scanAlternatives(catalog, manifest, delayed, alternativePlan(catalog, delayed, [alternative.siteId, unknown.siteId], [0, 24]), { signal: new AbortController().signal, yieldTask: immediate });
  const ranked = paretoOptions(result.rows);
  assert.ok(ranked.some(r => r.rank === 'non-dominated' && r.assessment!.outcome === 'conditional'));
  assert.ok(ranked.filter(r => r.state.siteId === unknown.siteId).every(r => r.rank === 'unranked'));
  assert.ok(ranked.some(r => r.rank === 'dominated'));
  for (const row of ranked) assert.equal(row.assessment, result.rows.find(r => r.id === row.id)!.assessment);
});

test('Pareto honors actual reserve versus blackout tradeoffs, ties and distinct evidence/requirement scopes', () => {
  const tested = (name: string, state: ScenarioState): TestedOption => ({ ...item(name, state), assessment: evaluateScenario(catalog, state, manifest), error: null, shiftHours: 0 });
  const lit = tested('Normal load', alternative), heavy = tested('Heavy load', { ...alternative, mission: { ...alternative.mission, loadW: 5000 } });
  assert.ok(lit.assessment!.mission.minBatteryWh! > heavy.assessment!.mission.minBatteryWh!);
  assert.equal(lit.assessment!.mission.longestBlackoutHours, heavy.assessment!.mission.longestBlackoutHours);
  const ranked = paretoOptions([lit, heavy, { ...lit, id: 'tie' }]);
  assert.deepEqual(ranked.map(r => r.rank), ['non-dominated', 'dominated', 'non-dominated']);
  const broader = tested('Different requirements', { ...alternative, requirements: { ...alternative.requirements, requireReserve: false } });
  assert.notEqual(paretoOptions([lit, broader])[0].cohort, paretoOptions([lit, broader])[1].cohort);
  const partial = structuredClone(heavy); partial.assessment!.evidence[0].coverage = 'borrowed';
  assert.deepEqual(paretoOptions([lit, partial]).map(r => r.rank), ['non-dominated', 'non-dominated']);
});

const noop = () => {};
test('workspace SSR exposes explicit cases, exact dates, paired curves, horizons, spatial context and next actions', () => {
  const html = renderToStaticMarkup(createElement(ReplanningWorkspace, { catalog, manifest, current: delayed, scenarios: [item('Saved reference', baseline)], referenceId: 'Saved reference', onOpen: noop, onInspect: noop, onSave: noop, onCalendar: noop, onClose: noop }));
  for (const text of ['Reference case', 'Candidate case', 'Inspect first violation', 'Open failure in main view', 'What changed?', 'requirements.scope', 'Whole-Moon map', 'Geometric antenna contact', 'Elapsed mission time (h)', 'Show Sun / Earth horizons', 'Smooth sphere', 'Open candidate', 'Save candidate', 'Test a bounded date/site grid', 'unquantified']) assert.ok(html.includes(text), text);
  assert.ok(html.includes(reference.context.startUtc)); assert.ok(html.includes(candidate.context.startUtc));
  assert.match(html, /role="slider"/); assert.match(html, /role="tooltip"/); assert.match(html, /aria-valuetext=/);
  assert.match(html, /planning-4/);
  const visibleText = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, '');
  assert.doesNotMatch(visibleText, /\bNaN\b|\bInfinity\b|lorem/i);
  assert.doesNotMatch(html, /(?:d|cx|cy)="[^"]*(?:NaN|Infinity)/);
});

test('missing/invalid selected data renders explicit rejection without shortening the scenario or claiming readiness', () => {
  const state = { ...unknown, startIndex: -1 };
  const html = renderToStaticMarkup(createElement(ReplanningWorkspace, { catalog, manifest, current: state, scenarios: [], onOpen: noop, onInspect: noop, onSave: noop }));
  assert.match(html, /Reference unavailable/); assert.match(html, /Candidate unavailable/);
  assert.doesNotMatch(html, /Open candidate|passes-assessed/);
});

test('keyboard plot semantics retain unknown tooltip values and explicit contact units', () => {
  const prepared = prepare('Unknown', unknown), domain = cursorDomain(catalog, baseline, unknown, 'elapsed')!;
  const group = comparisonCurves([reference, prepared], domain, catalog.meta.stepHours)[2];
  const html = renderToStaticMarkup(createElement(ComparisonPlot, { group, domain, cursor: 0, onCursor: noop }));
  assert.match(html, /Candidate · terrain: Unknown/); assert.match(html, /Contact \(0 = no, 1 = yes\)/);
  assert.match(html, /Use arrows/); assert.match(html, /aria-describedby=/); assert.doesNotMatch(html, /NaN/);
});


test('quick candidate changes preserve captured reference, full equipment and exclusive stay length',()=>{
 const original=item('Reference',baseline), before=structuredClone(original);
 const next=editCapturedCandidate(catalog,original,null,168);
 assert.deepEqual(original,before);assert.equal(next.state.startIndex,baseline.startIndex+168);
 assert.equal(next.state.endIndex-next.state.startIndex,baseline.endIndex-baseline.startIndex);
 for(const key of ['mission','flight','requirements','operations','arrayHeightM','antennaHeightM'] as const)assert.deepEqual(next.state[key],baseline[key]);
 const moved=editCapturedCandidate(catalog,next,alternative.siteId,0);
 assert.equal(moved.state.siteId,alternative.siteId);assert.equal(moved.state.startIndex,next.state.startIndex);
 assert.deepEqual(moved.state.requirements,next.state.requirements);
});
test('quick edits reject unavailable arrivals without shortening or mutating the candidate',()=>{
 const original=item('Reference',baseline), before=structuredClone(original);
 assert.throws(()=>editCapturedCandidate(catalog,original,null,catalog.meta.n*catalog.meta.stepHours),/outside.*not shortened/);
 assert.throws(()=>editCapturedCandidate(catalog,original,null,.5),/multiple/);
 assert.deepEqual(original,before);
});
