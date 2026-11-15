import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ch3 from '../public/data/trajectories/chandrayaan-3-descent-reference.json';
import a15 from '../public/data/trajectories/apollo-15-csm-orbit-reconstructed.json';
import sourceVectors from '../public/data/trajectories/ch3-source-vectors.json';
import conversion from '../docs/qa/trajectories/conversion.json';
import { LANDING_SITES } from '../lib/landing-sites';
import { MISSION_TRAJECTORIES, MISSION_TRAJECTORY_COVERAGE, MISSION_TRAJECTORY_IDENTITIES, MISSION_TRAJECTORY_REASONS, missionTrajectoriesForSite, validateTrajectoryReasons } from '../lib/mission-trajectories-catalog';
import { parseMissionTrajectory, missionTrajectoryState, missionReplayClock, trajectorySceneKm, parseMissionHorizonsVectors, verifyTrajectoryBytes } from '../lib/mission-trajectories';
// Rebuild a minimal CSV envelope around archived original numeric vectors. Full raw downloads stay in /tmp.
const sourceText = `Target body name: Chandrayaan-3 (LANDER spacecraft) (-158)
Center body name: Moon (301)
Center-site name: BODY CENTER
Output units    : KM-S
Output type     : GEOMETRIC cartesian states
Reference frame : ICRF
JDTDB, Calendar Date (TDB), X,Y,Z,VX,VY,VZ,
$$SOE
${sourceVectors.rows.map(row => `${row.julianDateTdb}, A.D. epoch, ${[...row.positionKm, ...row.velocityKmS].join(',')},`).join('\n')}
$$EOE`;
const artifactBytes = readFileSync(new URL('../public/data/trajectories/chandrayaan-3-descent-reference.json', import.meta.url));
const artifactHash = conversion.artifacts.find(row => row.path.endsWith('chandrayaan-3-descent-reference.json'))!.sha256;

test('published descent reference is never promoted to flown; CSM orbit never becomes landing/ascent', () => {
  assert.deepEqual(MISSION_TRAJECTORIES.map(t => [t.kind, t.phase]), [['reference', 'descent'], ['reconstructed', 'orbit']]);
  assert.equal(missionTrajectoriesForSite('apollo-11').length, 0);
  assert.match(MISSION_TRAJECTORIES[0].uncertainty, /prediction.*unresolved/);
  assert.match(MISSION_TRAJECTORIES[1].missing.join(' '), /Not the lunar module/);
  assert.deepEqual(MISSION_TRAJECTORY_COVERAGE.map(r => r.siteId), LANDING_SITES.map(s => s.id));
  assert.ok(MISSION_TRAJECTORY_COVERAGE.every(r => r.simulationAvailable));
});
test('trusted identity pins mission, vehicle role, source URL/version/hash, epoch and frame', () => {
  for (const patch of [{ vehicle: 'Apollo 11 LM' }, { missionId: 'apollo-11' }, { siteId: 'apollo-11' }, { kind: 'flown' }, { phase: 'surface-ascent' }, { id: 'fake' }]) {
    assert.throws(() => parseMissionTrajectory({ ...ch3, ...patch }, MISSION_TRAJECTORY_IDENTITIES[0]));
  }
  for (const patch of [{ sha256: 'a'.repeat(64) }, { url: 'https://example.com/path' }, { version: 'fake' }]) {
    const clone = structuredClone(ch3); Object.assign(clone.sources[0], patch);
    assert.throws(() => parseMissionTrajectory(clone, MISSION_TRAJECTORY_IDENTITIES[0]));
  }
  const clone = structuredClone(ch3); clone.epoch.scale = 'UTC';
  assert.throws(() => parseMissionTrajectory(clone, MISSION_TRAJECTORY_IDENTITIES[0]));
  assert.equal(sourceVectors.source.sha256, ch3.sources[0].sha256);
});
test('malformed units, center, frame, time, sample order and coverage are rejected atomically', () => {
  const mutations = [
    (v: typeof ch3) => { v.frame.positionUnit = 'm'; },
    (v: typeof ch3) => { v.frame.velocityUnit = 'm/s'; },
    (v: typeof ch3) => { v.frame.centerId = 399; },
    (v: typeof ch3) => { v.frame.name = 'ME'; },
    (v: typeof ch3) => { v.frame.type = 'inertial'; },
    (v: typeof ch3) => { v.epoch.calendar = '2023-02-30T12:00:00'; },
    (v: typeof ch3) => { v.epoch.utc = '2023-08-23T12:16:00'; },
    (v: typeof ch3) => { v.samples[1].t = 0; },
    (v: typeof ch3) => { v.samples[1].position[1] = NaN; },
    (v: typeof ch3) => { v.samples[1].velocity = [0, 0]; },
    (v: typeof ch3) => { v.coverage.end += 1; },
    (v: typeof ch3) => { v.coverage.maxGapSeconds = -1; },
    (v: typeof ch3) => { v.attitude = 'velocity-aligned'; },
  ];
  for (const mutate of mutations) { const clone = structuredClone(ch3); mutate(clone); assert.throws(() => parseMissionTrajectory(clone)); }
});
test('all sample positions survive exact lookup and no data is extrapolated', () => {
  for (const data of MISSION_TRAJECTORIES) {
    for (const sample of data.samples) {
      const state = missionTrajectoryState(data, sample.t)!;
      assert.deepEqual(state.positionKm, sample.position); assert.deepEqual(state.velocityKmS, sample.velocity);
      assert.equal(state.interpolated, false); assert.equal(state.attitude, null);
    }
    for (const time of [-.001, data.coverage.end+.001, NaN, Infinity]) assert.equal(missionTrajectoryState(data, time), null);
  }
});
test('linear interpolation, exact-only data and gaps remain explicit', () => {
  const data = MISSION_TRAJECTORIES[0];
  const state = missionTrajectoryState(data, 5)!;
  assert.equal(state.interpolated, true);
  assert.deepEqual(state.positionKm, data.samples[0].position.map((x, i) => x+(data.samples[1].position[i]-x)/2));
  const gap = parseMissionTrajectory({ ...ch3, samples: ch3.samples.filter(s => s.t !== 10) });
  assert.equal(missionTrajectoryState(gap, 10), null);
  const exact = parseMissionTrajectory({ ...ch3, coverage: { ...ch3.coverage, interpolation: 'none' } });
  assert.equal(missionTrajectoryState(exact, 5), null); assert.ok(missionTrajectoryState(exact, 10));
});
test('1× uses monotonic elapsed wall time, clamps at endpoint and rejects backwards/invalid clocks', () => {
  const data = MISSION_TRAJECTORIES[0];
  assert.deepEqual(missionReplayClock(data, 10, 100, 1100), { seconds: 11, ended: false });
  assert.deepEqual(missionReplayClock(data, 1079, 100, 5100), { seconds: 1080, ended: true });
  for (const args of [[10, 100, 99], [NaN, 100, 200], [-1, 100, 200], [1081, 100, 200]]) assert.equal(missionReplayClock(data, args[0], args[1], args[2]), null);
});
test('Horizons import binds target, body center, time scale, units and uncorrected ICRF frame', () => {
  const vectors = parseMissionHorizonsVectors(sourceText, -158);
  assert.equal(vectors.length, 109);
  assert.equal(vectors[0].julianDateTdb, 2460180.011111111);
  assert.throws(() => parseMissionHorizonsVectors(sourceText, -169));
  for (const [before, after] of [['Center body name: Moon (301)', 'Center body name: Earth (399)'], ['BODY CENTER', 'TOPOCENTRIC'], ['KM-S', 'AU-D'], ['Reference frame : ICRF', 'Reference frame : Ecliptic'], ['Calendar Date (TDB)', 'Calendar Date (UT)'], ['GEOMETRIC cartesian states', 'APPARENT cartesian states'], ['$$EOE', 'end']]) assert.throws(() => parseMissionHorizonsVectors(sourceText.replace(before, after), -158));
  for (let i = 0; i < vectors.length; i++) assert.ok(Math.abs(Math.hypot(...vectors[i].positionKm)-Math.hypot(...ch3.samples[i].position)) < 1e-7, 'body rotation preserves source radius');
});
test('numeric descent-shaped path is preserved without snapping to a historic pin or inventing attitude', () => {
  const data = MISSION_TRAJECTORIES[0];
  assert.ok(Math.hypot(...data.samples[0].velocity) > 1);
  assert.ok(Math.hypot(...data.samples.at(-1)!.velocity) < .01);
  assert.deepEqual(trajectorySceneKm([1, 2, 3]), [1, 3, -2]);
  assert.match(data.missing.join(' '), /do not snap/);
  assert.equal(a15.samples.length, 181);
});
test('source-derived reasons require citations and locators; model choices and assumptions stay distinct', () => {
  validateTrajectoryReasons(MISSION_TRAJECTORY_REASONS);
  const reason = MISSION_TRAJECTORY_REASONS[0];
  assert.throws(() => validateTrajectoryReasons([{ ...reason, citations: [] }]));
  assert.throws(() => validateTrajectoryReasons([{ ...reason, citations: [{ url: 'javascript:alert(1)', locator: 'bad' }] }]));
  assert.throws(() => validateTrajectoryReasons([{ ...reason, citations: [{ url: reason.citations[0].url, locator: '' }] }]));
  assert.ok(MISSION_TRAJECTORY_REASONS.some(r => r.basis === 'model-design'));
  assert.ok(MISSION_TRAJECTORY_REASONS.some(r => r.basis === 'unresolved'));
});
test('untrusted file byte integrity is checked before import', async () => {
  await verifyTrajectoryBytes(artifactBytes, artifactHash);
  await assert.rejects(verifyTrajectoryBytes(new TextEncoder().encode(artifactBytes.toString()+'x'), artifactHash));
});

test('Horizons rejects conflicting headers and non-decimal JavaScript numeric literals', () => {
  assert.throws(() => parseMissionHorizonsVectors(sourceText.replace('Reference frame : ICRF', 'Reference frame : ICRF\nReference frame : Ecliptic of J2000.0'), -158));
  assert.throws(() => parseMissionHorizonsVectors(sourceText.replace('Output units    : KM-S', 'Output units    : KM-SPOOF'), -158));
  const first = sourceVectors.rows[0].positionKm[0];
  assert.throws(() => parseMissionHorizonsVectors(sourceText.replace(String(first), '0x10'), -158));
  assert.throws(() => parseMissionHorizonsVectors(sourceText.replace(String(first), '0b10'), -158));
});
