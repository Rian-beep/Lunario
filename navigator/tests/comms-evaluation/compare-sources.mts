import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DSN_STATIONS } from '../../lib/dsn';
import { fetchStationGeometry, parseHorizonsResponse, horizonsSourceContext, type GeometryRequest } from '../../lib/engineering-evidence/horizons';

// Explicit CLI, never imported by the test suite. Existing CSPICE reference is retained unchanged.
const output = 'docs/qa/evaluation/comms';
const reference = JSON.parse(await readFile('public/data/engineering-evidence/spice-reference.json', 'utf8')) as {
  samples: Array<{ stationId: string; utc: string; azimuthDeg: number; elevationDeg: number; rangeKm: number }>;
};
const live = process.argv.includes('--live');
await mkdir(`${output}/sources`, { recursive: true });
const checkedUtc = new Date().toISOString();
const attempts = await Promise.allSettled(DSN_STATIONS.map(async station => {
  const stored = JSON.parse(await readFile(`public/data/engineering-evidence/${station.id}-horizons.json`, 'utf8')) as {
    request: GeometryRequest; response: unknown;
  };
  const geometry = live ? await fetchStationGeometry(stored.request, AbortSignal.timeout(45_000))
    : parseHorizonsResponse(stored.response, stored.request, checkedUtc);
  const comparisons = geometry.samples.map(sample => {
    const expected = reference.samples.find(r => r.stationId === station.id && Date.parse(r.utc) === Date.parse(sample.utc));
    assert.ok(expected);
    const azResidualDeg = Math.abs((sample.azimuthDeg - expected.azimuthDeg + 540) % 360 - 180);
    const elevationResidualDeg = Math.abs(sample.elevationDeg - expected.elevationDeg);
    const rangeResidualKm = Math.abs(sample.rangeKm - expected.rangeKm);
    assert.ok(azResidualDeg < .002 && elevationResidualDeg < .002 && rangeResidualKm < .1, `${station.id} ${sample.utc}`);
    return { utc: sample.utc, azResidualDeg, elevationResidualDeg, rangeResidualKm };
  });
  const bytes = JSON.stringify({ request: stored.request, geometry }, null, 2) + '\n';
  const path = `${output}/sources/${station.id}-${live ? 'live' : 'archived'}.json`;
  await writeFile(path, bytes);
  return { stationId: station.id, sourcePath: path, requestUrl: geometry.requestUrl,
    fetchedUtc: geometry.fetchedUtc, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex'),
    metadata: horizonsSourceContext(geometry.rawResponse), comparisons };
}));
const sources = attempts.flatMap(a => a.status === 'fulfilled' ? [a.value] : []);
const errors = attempts.flatMap((a, i) => a.status === 'rejected' ? [{ stationId: DSN_STATIONS[i].id,
  error: a.reason instanceof Error ? a.reason.message : String(a.reason) }] : []);
if (!errors.length) assert.equal(sources.reduce((n, s) => n + s.comparisons.length, 0), 75);
const all = sources.flatMap(s => s.comparisons);
const result = { checkedUtc, status: errors.length ? 'incomplete' : 'passed', errors, mode: live ? 'live' : 'archived', samples: all.length, comparisons: all.length * 3,
  maxAzResidualDeg: Math.max(...all.map(s => s.azResidualDeg)), maxElevationResidualDeg: Math.max(...all.map(s => s.elevationResidualDeg)),
  maxRangeResidualKm: Math.max(...all.map(s => s.rangeResidualKm)),
  tolerances: { azimuthDeg: .002, elevationDeg: .002, rangeKm: .1 },
  qualification: 'Current provider vs retained CSPICE DE440s LT+S/ITRF93 reference; different computation, not independent physical observation or acquisition qualification.', sources };
await writeFile(`${output}/${live ? 'live' : 'archived'}-source-comparison.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, sources: result.sources.map(({ comparisons, ...source }) => ({ ...source, sampleCount: comparisons.length })) }, null, 2));
if (errors.length) process.exitCode = 1;
