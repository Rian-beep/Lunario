import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_TRAJECTORIES } from '../../lib/mission-trajectories-catalog';
import { missionTrajectoryState, parseMissionTrajectory } from '../../lib/mission-trajectories';
import { missionReplayCameraEase, missionReplayFrameError, missionReplayPath, missionReplayTimeLabels } from '../../lib/mission-replay';

const source = MISSION_TRAJECTORIES[0];

test('camera ease applies final destination immediately for reduced motion and exactly at/past normal duration', () => {
  for (const elapsed of [0, 1, 1500, 2999, 3000, 3001, 1e8]) assert.equal(missionReplayCameraEase(elapsed, true), 1);
  assert.equal(missionReplayCameraEase(-1, false), 0);
  assert.equal(missionReplayCameraEase(0, false), 0);
  assert.equal(missionReplayCameraEase(1500, false), .5);
  assert.ok(missionReplayCameraEase(2999, false) < 1);
  for (const elapsed of [3000, 3001, 1e8]) assert.equal(missionReplayCameraEase(elapsed, false), 1);
  let previous = 0;
  for (let elapsed = 0; elapsed <= 3000; elapsed++) {
    const ease = missionReplayCameraEase(elapsed, false);
    assert.ok(ease >= previous && ease <= 1); previous = ease;
  }
});

test('linear path splits at excessive gaps and keeps singleton observations', () => {
  const data = parseMissionTrajectory({ ...source, samples: source.samples.filter(s => s.t !== 10 && s.t !== 30) });
  const path = missionReplayPath(data);
  assert.equal(path.gapCount, 2);
  assert.deepEqual(path.points, [data.samples[0].position, data.samples[1].position]);
  assert.deepEqual(path.lines, [data.samples.slice(2).map(s => s.position)]);
  assert.equal(missionTrajectoryState(data, 10), null);
  assert.equal(missionTrajectoryState(data, 30), null);
  // Display structures cannot mutate the underlying source samples.
  path.points[0][0] = 0; path.lines[0][0][0] = 0;
  assert.notEqual(data.samples[0].position[0], 0);
  assert.notEqual(data.samples[2].position[0], 0);
});

test('the max-gap boundary is inclusive; all-isolated input has no lines', () => {
  const data = parseMissionTrajectory({ ...source, samples: source.samples.filter(s => s.t % 20 === 0),
    coverage: { ...source.coverage, maxGapSeconds: 20 } });
  assert.equal(missionReplayPath(data).lines.length, 1);
  assert.equal(missionReplayPath(data).gapCount, 0);
  assert.ok(missionTrajectoryState(data, 10));
  const isolated = parseMissionTrajectory({ ...data, coverage: { ...data.coverage, maxGapSeconds: 19.999 } });
  const path = missionReplayPath(isolated);
  assert.deepEqual(path.lines, []);
  assert.deepEqual(path.points, isolated.samples.map(s => s.position));
  assert.equal(path.gapCount, isolated.samples.length - 1);
});

test('interpolation none draws every exact sample as a point, never a joining line', () => {
  const data = parseMissionTrajectory({ ...source, coverage: { ...source.coverage, interpolation: 'none' } });
  const path = missionReplayPath(data);
  assert.deepEqual(path.lines, []);
  assert.deepEqual(path.points, data.samples.map(s => s.position));
  assert.equal(path.gapCount, 0);
  assert.equal(missionTrajectoryState(data, 5), null);
  assert.deepEqual(missionTrajectoryState(data, 10)!.positionKm, data.samples[1].position);
});

test('accepted inertial data receives an explicit unsupported-frame explanation', () => {
  assert.equal(missionReplayFrameError(source), null);
  for (const name of ['J2000', 'ICRF']) {
    const data = parseMissionTrajectory({ ...source, frame: { ...source.frame, name, type: 'inertial' } });
    assert.match(missionReplayFrameError(data)!, new RegExp(name));
    assert.match(missionReplayFrameError(data)!, /no inertial-to-Moon-fixed conversion/);
    assert.match(missionReplayFrameError(data)!, /Choose another published path or the educational simulation/);
  }
});

test('labels distinguish the supplied static UTC start from elapsed source-scale seconds without synthesizing UTC', () => {
  for (const data of MISSION_TRAJECTORIES) {
    const labels = missionReplayTimeLabels(data);
    assert.ok(labels.start.startsWith(`Starts ${data.epoch.utc} UTC`));
    assert.ok(labels.start.includes(`${data.epoch.calendar} ${data.epoch.scale}`));
    assert.equal(labels.elapsed, `Elapsed source time (${data.epoch.scale} seconds)`);
  }
  const utc = parseMissionTrajectory({ ...source, epoch: { calendar: '2023-08-23T12:16:00', scale: 'UTC', utc: '2023-08-23T12:16:00Z' } });
  assert.equal(missionReplayTimeLabels(utc).elapsed, 'Elapsed source time (UTC seconds)');
});

for (const siteId of ['odysseus', 'blue-ghost-1', 'athena']) {
  test(`${siteId}: actual reconstructed CLPS path keeps all samples, endpoints, source clock and limitations`, () => {
    const data = MISSION_TRAJECTORIES.find(d => d.siteId === siteId)!;
    const before = JSON.stringify(data);
    const path = missionReplayPath(data);
    assert.equal(data.kind, 'reconstructed'); assert.equal(data.phase, 'descent');
    assert.equal(missionReplayFrameError(data), null);
    assert.equal(path.gapCount, 0); assert.deepEqual(path.points, []);
    assert.deepEqual(path.lines, [data.samples.map(s => s.position)]);
    assert.deepEqual(missionTrajectoryState(data, 0)!.positionKm, path.lines[0][0]);
    assert.deepEqual(missionTrajectoryState(data, data.coverage.end)!.positionKm, path.lines[0].at(-1));
    assert.equal(missionTrajectoryState(data, data.coverage.end + .001), null);
    assert.equal(data.epoch.scale, 'TDB');
    assert.match(missionReplayTimeLabels(data).elapsed, /TDB seconds/);
    assert.ok(data.uncertainty); assert.ok(data.missing.length);
    if (siteId === 'athena') assert.match(data.missing.join(' '), /no EDL states between first contact/);
    assert.equal(JSON.stringify(data), before);
  });
}
