import test from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapLayerControls, MapLayerLegend, METRIC_LABELS } from '../../components/map-screening/controls';
import { DEFAULT_MAP_LAYERS, type MapLayerModel } from '../../components/map-screening/model';
import { useMapLayers } from '../../components/map-screening/use-map-layers';
import { loadStaticIce } from '../../components/map-screening/runner';
import { catalog } from '../suitability/fixtures';

Object.assign(globalThis, { React });
const noop = () => {};
const model: MapLayerModel = { raster: null, iceFeatures: [], points: [], status: 'Regional ranking off', progress: 0,
  error: '', busy: false, iceStatus: 'Ice evidence off', iceError: '', iceSources: [], dates: '2026-01-01 to 2026-01-08 UTC',
  sampling: '288 global centres; 15° latitude × 15° longitude cells.', source: 'Synthetic Horizons/LOLA fixture; effective resolution unknown.', globalTerrain: null, retry: noop };

test('defaults are disabled, contain equal weights and change no persistence schema', () => {
  assert.deepEqual(DEFAULT_MAP_LAYERS, { enabled: false, metric: 'combined', weights: { sun: 1, dark: 1, slope: 1, comms: 1 }, slopeScaleDeg: 10, opacity: .55, iceEnabled: false });
  const html = renderToStaticMarkup(createElement(MapLayerControls, { settings: DEFAULT_MAP_LAYERS, model, onChange: noop, onInspect: noop }));
  assert.match(html, /Rank sampled map cells/); assert.match(html, /Published ice evidence references/);
  assert.doesNotMatch(html, /checked=""|Ranking overlay opacity/);
  assert.equal(renderToStaticMarkup(createElement(MapLayerLegend, { settings: DEFAULT_MAP_LAYERS, model, onChange: noop, onInspect: noop })), '');
});

test('SSR controls label every factor, opacity, preferences and exact physical meanings', () => {
  const html = renderToStaticMarkup(createElement(MapLayerControls, { settings: { ...DEFAULT_MAP_LAYERS, enabled: true }, model, onChange: noop, onInspect: noop }));
  for (const label of Object.values(METRIC_LABELS)) assert.ok(html.includes(label), label);
  for (const text of ['Ranking overlay opacity', '55%', 'Visible solar disk weight', 'Shorter darkness weight', 'Lower regional slope weight', 'Earth-centre contact weight', 'Slope ranking scale (°)', 'aria-labelledby=', 'type="range"', 'aria-valuenow="55"', '10°', '1 − darkness / stay hours', 'unknown factor with positive weight', 'time sunlit', 'electrical power', 'RF strength', 'landing-footprint safety']) assert.ok(html.includes(text), text);
  assert.match(html, /summary aria-label="Explain map ranking factors and units"/);
});

test('legend reports selected dates, raw factors including zero and lower bounds, support and exact inspect coordinates', () => {
  const points = [{ lat: -88.123456, lon: 15.987654, sunFraction: 0, longestDarkHours: 168, darkLowerBound: true,
    slopeDeg: null, commsFraction: .5, score: 0, source: 'Exact synthetic prepared horizon', spacingM: 40, notes: ['Coarse obstacles unresolved.'] }];
  const html = renderToStaticMarkup(createElement(MapLayerLegend, { settings: { ...DEFAULT_MAP_LAYERS, enabled: true, metric: 'dark' }, model: { ...model, points }, onChange: noop, onInspect: noop }));
  for (const text of ['Minimize legend', 'Dismiss map layers and legend', 'aria-controls=', 'aria-expanded="true"', 'Unknown is uncoloured', model.dates, model.sampling, model.source, '≥168.0 h', '0.0%', 'unknown', '50.0%', '40.0 m', 'Exact synthetic prepared horizon', 'Coarse obstacles unresolved.', 'Higher hours means longer darkness', 'latitude, 15.987654 east longitude', 'Violet lower, amber middle, mint higher']) assert.ok(html.includes(text), text);
});

test('ice source descriptions retain PSR association, impact distinction, credits, frame limits and links', async () => {
  const ice = await loadStaticIce();
  const html = renderToStaticMarkup(createElement(MapLayerControls, { settings: { ...DEFAULT_MAP_LAYERS, iceEnabled: true }, model: { ...model, iceFeatures: ice.features, iceSources: ice.sources }, onChange: noop, onInspect: noop }));
  for (const text of ['not a measured ice pixel or a footprint', 'impact ejecta', 'never deposit footprints', 'reserves and extractability remain unknown', '280 m', 'No DE ephemeris frame realization', 'Mean Earth, selenocentric', 'CC-BY-4.0', 'Published region or impact reference', 'LCROSS Centaur', 'https://doi.org/10.5281/zenodo.4646092', 'https://doi.org/10.1126/science.1186986']) assert.ok(html.includes(text), text);
});

test('partial failures expose retry and retain rather than hide the rendered screen', () => {
  const html = renderToStaticMarkup(createElement(MapLayerControls, { settings: { ...DEFAULT_MAP_LAYERS, enabled: true, iceEnabled: true }, model: { ...model, error: 'Local elevations unavailable', iceError: 'Invalid ice catalogue' }, onChange: noop, onInspect: noop }));
  assert.match(html, /role="alert">Local elevations unavailable/);
  assert.match(html, /role="alert">Ice evidence: Invalid ice catalogue/);
  assert.match(html, /Retry map layers/);
});

test('useMapLayers supports SSR and disabled/hidden initial maps without fetching datasets', () => {
  const previous = globalThis.fetch; let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw Error('Unexpected initial fetch'); };
  function Probe({ visible }: { visible: boolean }) {
    const result = useMapLayers({ catalog: catalog(), state: null, terrain: null, projection: 'global', visible, settings: DEFAULT_MAP_LAYERS });
    assert.equal(result.raster, null); assert.equal(result.points.length, 0); assert.equal(result.iceFeatures.length, 0);
    return createElement('p', null, result.status);
  }
  try {
    for (const visible of [false, true]) assert.match(renderToStaticMarkup(createElement(Probe, { visible })), /Regional ranking off/);
    assert.equal(fetched, false);
  } finally { globalThis.fetch = previous; }
});
