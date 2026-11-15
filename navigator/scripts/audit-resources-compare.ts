import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import reference from '../docs/qa/scientific-audit/resources/reference.json';
import { DEFAULT_MISSION, evaluateMission, linkBudget, type MissionAssumptions } from '../lib/mission';
import { DEFAULT_OPERATIONS } from '../lib/planning-types';
import { DSN_STATIONS, stationEcefKm } from '../lib/dsn';
import { atmosphericNoiseK, slantAttenuationDb } from '../lib/engineering-evidence/atmosphere';
import type { SampleSeries } from '../lib/astro';
import { parseHorizonsResponse } from '../lib/engineering-evidence/horizons';

export function forcing(n: number, elevation: number): SampleSeries {
  const a = (v: number) => new Float64Array(n).fill(v);
  return { index0: 0, sunEl: a(elevation), sunAz: a(0), sunHorizon: a(0), sunRadius: a(.27),
    earthEl: a(20), earthAz: a(0), earthHorizon: a(0), earthRadius: a(1) };
}
export function auditResources() {
  const comparisons: Array<{ id: string; actual: number | null; expected: number; error: number | null; tolerance: number; unit: string }> = [];
  const compare = (id: string, actual: number | null, expected: number, tolerance: number, unit: string) => {
    comparisons.push({ id, actual, expected, error: actual === null ? null : Math.abs(actual - expected), tolerance, unit });
  };
  for (const row of reference.energy) {
    const a = { ...DEFAULT_MISSION, areaM2: 1, efficiency: 1, lossFraction: 0, ...row.assumptions } as MissionAssumptions;
    const r = evaluateMission(forcing(1, row.sun), row.hours, a, false,
      { operations: { ...DEFAULT_OPERATIONS, ...row.operations } });
    for (const [key, expected] of Object.entries(row.expected))
      compare(`${row.id}/${key}`, r[key as keyof typeof row.expected], expected, 1e-9, key.endsWith('Hours') ? 'h' : 'Wh');
    for (const [kind, expected] of Object.entries(row.eventHours ?? {}))
      compare(`${row.id}/${kind}`, r.events?.find(e => e.kind === kind)?.modelOffsetHours ?? null, expected!, 1e-12, 'h');
    for (const segment of r.subsegments) {
      const balance = segment.generatedWh! + segment.deliveredWh! + segment.unmetWh! - segment.loadWh - segment.chargeInputWh! - segment.curtailedWh!;
      compare(`${row.id}/bus-energy-balance`, balance, 0, 1e-9, 'Wh');
    }
  }
  for (const [i, row] of reference.solar.entries()) {
    const s = forcing(1, row.elevation);
    s.sunAz[0] = row.azimuth; s.sunHorizon[0] = row.horizon;
    const r = evaluateMission(s, 1, { ...DEFAULT_MISSION, areaM2: 2, efficiency: .3, lossFraction: .15,
      solarFlux: 1000, loadW: 0, arrayMode: 'fixed', tiltDeg: row.tilt, azimuthDeg: row.facing });
    compare(`solar-${i}/power`, r.peakPowerW, row.expectedPowerW, .001, 'W');
  }
  for (const [i, row] of reference.rf.entries()) {
    const result = linkBudget(row.input);
    for (const key of ['pathLossDb', 'receivedDbw', 'ebN0Db', 'marginDb'] as const)
      compare(`rf-${i}/${key}`, result?.[key] ?? null, row.expected[key], 1e-10, key === 'receivedDbw' ? 'dBW' : 'dB');
  }
  for (const station of DSN_STATIONS) {
    const actual = stationEcefKm(station).map(v => v * 1000);
    const expected = reference.stationsM[station.id];
    for (let i = 0; i < 3; i++) compare(`${station.id}/ecef-${'xyz'[i]}`, actual[i], expected[i], .002, 'm');
  }
  const a = reference.atmospheric, slant = slantAttenuationDb(a.zenithDb, a.elevationDeg);
  compare('jpl-105E/slant', slant, a.printedSlantDb, .0005, 'dB');
  compare('jpl-105E/noise', atmosphericNoiseK(slant, a.meanRadiatingK), a.printedNoiseK, .06, 'K');
  const spice = JSON.parse(readFileSync('public/data/engineering-evidence/spice-reference.json', 'utf8')) as {
    samples: Array<{ stationId: string; utc: string; azimuthDeg: number; elevationDeg: number; rangeKm: number }>;
  };
  const sourceManifest = JSON.parse(readFileSync('docs/qa/scientific-audit/resources/sources/manifest.json', 'utf8')) as Array<{ file: string; retrievedUtc: string }>;
  for (const station of DSN_STATIONS) {
    const response = JSON.parse(readFileSync(`docs/qa/scientific-audit/resources/sources/${station.id}-fresh-horizons.json`, 'utf8'));
    const source = sourceManifest.find(s => s.file === `${station.id}-fresh-horizons.json`)!;
    const geometry = parseHorizonsResponse(response, { stationId: station.id, startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z' }, new Date(source.retrievedUtc).toISOString());
    for (const sample of geometry.samples) {
      const expected = spice.samples.find(s => s.stationId === station.id && Date.parse(s.utc) === Date.parse(sample.utc));
      if (!expected) throw Error('Independent CSPICE sample missing');
      compare(`station-geometry/${station.id}/${sample.utc}/azimuth`, (sample.azimuthDeg - expected.azimuthDeg + 540) % 360 - 180, 0, .002, 'deg');
      compare(`station-geometry/${station.id}/${sample.utc}/elevation`, sample.elevationDeg, expected.elevationDeg, .002, 'deg');
      compare(`station-geometry/${station.id}/${sample.utc}/range`, sample.rangeKm, expected.rangeKm, .1, 'km');
    }
  }
  return comparisons;
}
export function sourceIntegrity() {
  const root = 'docs/qa/scientific-audit/resources/sources/';
  const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8')) as Array<{ file: string; sha256: string; bytes: number; error?: string }>;
  return manifest.map(row => {
    if (row.error) throw Error(`${row.file}: ${row.error}`);
    const data = readFileSync(root + row.file);
    return { file: row.file, bytesMatch: data.length === row.bytes,
      hashMatch: createHash('sha256').update(data).digest('hex') === row.sha256 };
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const comparisons = auditResources(), sources = sourceIntegrity();
  const failed = comparisons.filter(c => c.error === null || !Number.isFinite(c.error) || c.error > c.tolerance);
  console.log(JSON.stringify({ comparisons, sources, count: comparisons.length, failed }, null, 2));
  if (failed.length || sources.some(s => !s.bytesMatch || !s.hashMatch)) process.exitCode = 1;
}
