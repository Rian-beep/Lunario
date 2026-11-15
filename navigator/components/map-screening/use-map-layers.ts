'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMapScreenRaster } from '../../lib/map-overlays';
import type { MapLayerInput, MapLayerModel } from './model';
import { loadStaticIce, recolourScreening, ScreeningRunner, type PhysicalInput, type PhysicalResult } from './runner';

type JobState = { input: PhysicalInput | null; result: PhysicalResult | null; busy: boolean; progress: number; error: string };
const idle: JobState = { input: null, result: null, busy: false, progress: 0, error: '' };

export function useMapLayers({ catalog, state, terrain, projection, visible, settings, viewport }: MapLayerInput): MapLayerModel {
  const runner = useRef<ScreeningRunner | null>(null);
  if (!runner.current) runner.current = new ScreeningRunner();
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => { runner.current!.clear(); setRevision(n => n + 1); }, []);
  const [job, setJob] = useState<JobState>(idle);
  const [ice, setIce] = useState<Awaited<ReturnType<typeof loadStaticIce>> | null>(null);
  const [iceError, setIceError] = useState('');
  const [iceBusy, setIceBusy] = useState(false);
  const { startIndex, endIndex, arrayHeightM, antennaHeightM } = state ?? {};
  const antennaMaskDeg = state?.mission.antennaMaskDeg;
  const { west, east, south, north, cols, rows } = projection === 'global' ? viewport ?? {} : {};
  const input = useMemo<PhysicalInput | null>(() => {
    if (!catalog || startIndex === undefined || endIndex === undefined || arrayHeightM === undefined || antennaHeightM === undefined || antennaMaskDeg === undefined) return null;
    return { catalog, terrain, startIndex, endIndex, arrayHeightM, antennaHeightM, antennaMaskDeg, projection,
      ...(west !== undefined && east !== undefined && south !== undefined && north !== undefined && cols !== undefined && rows !== undefined
        ? { viewport: { west, east, south, north, cols, rows } } : {}) };
  }, [catalog, terrain, startIndex, endIndex, arrayHeightM, antennaHeightM, antennaMaskDeg, projection, west, east, south, north, cols, rows]);
  const ranking = settings.enabled && visible && input !== null;

  useEffect(() => {
    if (!ranking || !input) return;
    return runner.current!.schedule(input, {
      onStart: () => setJob({ input, result: null, busy: true, progress: 0, error: '' }),
      onProgress: progress => setJob(current => ({ ...current, input, progress })),
      onResult: result => setJob({ input, result, busy: false, progress: 1, error: '' }),
      onError: error => setJob({ input, result: null, busy: false, progress: 0, error: error instanceof Error ? error.message : String(error) }),
    });
  }, [input, ranking, revision]);

  const iceActive = settings.iceEnabled && visible;
  useEffect(() => {
    if (!iceActive) return;
    let cancelled = false;
    setIceBusy(true); setIceError('');
    void loadStaticIce().then(value => {
      if (!cancelled) { setIce(value); setIceBusy(false); }
    }).catch(error => {
      if (!cancelled) { setIceError(error instanceof Error ? error.message : String(error)); setIceBusy(false); }
    });
    return () => { cancelled = true; };
  }, [iceActive, revision]);

  // Identity guard hides earlier dates/viewport immediately, before effect cleanup or a debounce fires.
  const current = ranking && job.input === input ? job : idle;
  const result = current.result;
  const { sun, dark, slope, comms } = settings.weights;
  const { slopeScaleDeg, metric, opacity } = settings;
  const display = useMemo(() => {
    if (!result) return { points: [], raster: null, error: '' };
    try {
      const points = recolourScreening(result, { weights: { sun, dark, slope, comms }, slopeScaleDeg });
      return { points, raster: createMapScreenRaster({ catalog: result.request.catalog, points, projection: result.input.projection, viewport: result.viewport, metric, opacity }), error: '' };
    } catch (error) { return { points: [], raster: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [result, sun, dark, slope, comms, slopeScaleDeg, metric, opacity]);
  const dates = input ? `${new Date(input.catalog.t0ms + input.startIndex * input.catalog.meta.stepHours * 3600000).toISOString()} to ${new Date(input.catalog.t0ms + (input.endIndex + 1) * input.catalog.meta.stepHours * 3600000).toISOString()} (end exclusive)` : '';
  const waiting = ranking && job.input !== input;
  const status = !settings.enabled ? 'Regional ranking off' : !visible ? 'Regional ranking paused while map is hidden'
    : !input ? 'Select a supported date span to rank the map' : waiting ? input.viewport ? 'Waiting for viewport to settle' : 'Preparing regional screening'
      : current.busy ? `Sampling regional centres: ${Math.round(current.progress * 100)}%` : current.error || display.error ? 'Regional screening unavailable'
        : result ? `${display.points.length} sampled centres; ${display.points.filter(p => p.score === null).length} unknown combined indices` : 'Preparing regional screening';
  const global = result?.request.globalTerrain;
  const local = result?.request.terrain;
  const source = result ? [
    `Horizons forcing ${result.request.catalog.meta.stepHours} h; catalogue frame ${result.request.catalog.meta.frame}.`,
    `Array height ${result.request.arrayHeightM} m; antenna height ${result.request.antennaHeightM} m; absolute antenna cutoff ${result.request.antennaMaskDeg}°.`,
    `Prepared LOLA horizons: ${result.request.catalog.meta.demFine}, with ${result.request.catalog.meta.demCoarse} fallback.`,
    global ? `Coarse global rays/elevations: ${global.source.productId} ${global.source.version}; ${global.outputSpacingM.toFixed(1)} m output spacing, ${global.angularStepDeg}° angular step; frame ${global.source.frame}. Coverage is partial.` : 'Global numerical elevations unavailable; unsupported horizons remain unknown.',
    local ? `Local numerical elevations: ${local.source}; frame ${local.frame}. Regional slope uses only supported numerical stencils.` : 'Local numerical elevations unavailable.',
    'Cell spacing is not effective resolution. Frame equivalence, effective resolution and propagated uncertainty remain unresolved.',
  ].join(' ') : '';
  return { ...display, iceFeatures: iceActive ? ice?.features ?? [] : [],
    status, progress: current.progress, error: [current.error, display.error, ...(result?.warnings ?? [])].filter(Boolean).join(' '),
    busy: current.busy || waiting, iceStatus: !settings.iceEnabled ? 'Ice evidence off' : !visible ? 'Ice evidence paused while map is hidden' : iceBusy ? 'Loading published ice evidence' : iceError ? 'Ice evidence unavailable' : `${ice?.features.length ?? 0} published reference locations`,
    iceError: iceActive ? iceError : '', iceSources: iceActive ? ice?.sources ?? [] : [], dates, sampling: result?.sampling ?? '',
    source,
    viewport: result?.viewport, globalTerrain: result?.request.globalTerrain ?? null, retry };
}
