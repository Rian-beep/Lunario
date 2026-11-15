import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { DSN_STATIONS } from '../lib/dsn';
import { horizonsUrl, parseHorizonsResponse, fetchStationGeometry, type GeometryRequest } from '../lib/engineering-evidence/horizons';
const root = 'public/data/engineering-evidence/';
const reference = JSON.parse(await readFile(root + 'spice-reference.json', 'utf8')) as {
    samples: Array<{
        stationId: string;
        utc: string;
        azimuthDeg: number;
        elevationDeg: number;
        rangeKm: number;
    }>;
    kernels: unknown;
};
let count = 0, maxAz = 0, maxEl = 0, maxRange = 0;
for (const station of DSN_STATIONS) {
    const path = root + station.id + '-horizons.json';
    const stored = JSON.parse(await readFile(path, 'utf8')) as {
        request: GeometryRequest;
        response: unknown;
        requestUrl: string;
    };
    if (process.argv.includes('--live')) {
        const geometry = await fetchStationGeometry(stored.request, AbortSignal.timeout(60000));
        stored.response = { result: geometry.rawResponse };
        stored.requestUrl = horizonsUrl(stored.request);
        if (process.argv.includes('--write'))
            await writeFile(path, JSON.stringify(stored, null, 2) + '\n');
    }
    const geometry = parseHorizonsResponse(stored.response, stored.request, '2026-11-14T20:00:00Z');
    for (const sample of geometry.samples) {
        const r = reference.samples.find(r => r.stationId === station.id && Date.parse(r.utc) === Date.parse(sample.utc));
        assert.ok(r, 'Independent station/epoch must exist');
        const az = Math.abs((sample.azimuthDeg - r.azimuthDeg + 540) % 360 - 180), el = Math.abs(sample.elevationDeg - r.elevationDeg), range = Math.abs(sample.rangeKm - r.rangeKm);
        maxAz = Math.max(maxAz, az);
        maxEl = Math.max(maxEl, el);
        maxRange = Math.max(maxRange, range);
        count++;
        assert.ok(az < .002 && el < .002 && range < .1, `${station.id} ${sample.utc}: ${az}° AZ / ${el}° EL / ${range} km`);
    }
}
assert.equal(count, 75);
console.log(JSON.stringify({ samples: count, maxAzResidualDeg: maxAz, maxElevationResidualDeg: maxEl, maxRangeResidualKm: maxRange, independentProducer: 'CSPICE DE440s LT+S / ITRF93 observer locus; independent ENU projection', referenceKernels: reference.kernels, qualification: 'Regression reference comparison only; no error distribution or operational qualification' }, null, 2));
if (process.argv.includes('--frame')) {
    const manual = await (await fetch('https://ssd.jpl.nasa.gov/horizons/manual.html', { signal: AbortSignal.timeout(60000) })).text();
    const fk = await (await fetch('https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf', { signal: AbortSignal.timeout(60000) })).text();
    assert.match(manual, /Lunar Mean-Earth Frame of DE421/);
    assert.match(fk, /MOON_ME_DE440_ME421/);
    console.log('Primary convention gate: current Horizons documents DE440 PA → DE421 ME; NAIF supplies MOON_ME_DE440_ME421. OPEN: original catalogue response headers/EOP/time settings and terrain error propagation are not archived or independently quantified. No canonical source-frame closure claimed.');
}
