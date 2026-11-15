'use client';

import { useId, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { iceReference, metricRange, type MapMetric } from '../../lib/map-overlays';
import type { ScreeningPoint } from '../../lib/suitability';
import type { MapLayerModel, MapLayerSettings } from './model';

export type MapLayerControlProps = {
  settings: MapLayerSettings; onChange: (settings: MapLayerSettings) => void; model: MapLayerModel;
  onInspect: (lat: number, lon: number) => void;
};
export const METRIC_LABELS: Record<MapMetric, string> = {
  combined: 'Combined preference index (0–100)', sun: 'Mean visible solar disk (%)', dark: 'Longest observed darkness (h)',
  slope: 'Regional slope (°)', comms: 'Earth-centre contact geometry (%)',
};
const FACTORS = [ ['sun', 'Visible solar disk'], ['dark', 'Shorter darkness'], ['slope', 'Lower regional slope'], ['comms', 'Earth-centre contact'] ] as const;
const fmt = (n: number | null, unit: string, lower = false) => n === null || !Number.isFinite(n) ? 'unknown' : `${lower ? '≥' : ''}${n.toFixed(1)}${unit}`;

function MetricExplanation() {
  return <details className="map-screening-help">
    <summary aria-label="Explain map ranking factors and units">ⓘ Factors and units</summary>
    <p>Visible solar disk is the mean fraction of the Sun’s disk above the terrain horizon during the selected dates. It is neither time sunlit nor electrical power.</p>
    <p>Darkness is the longest observed span with no visible solar limb within this stay, in hours. ≥ means the span touches a stay boundary and may extend beyond it.</p>
    <p>Earth-centre contact is the percentage of samples where the Earth centre clears both terrain and the absolute antenna elevation cutoff. It gives no ground-station access or RF strength.</p>
    <p>Regional slope comes from numerical elevations and their measured spacing. It does not describe landing-footprint safety.</p>
    <p>The combined 0–100 index is a weighted arithmetic mean of visible solar disk, 1 − darkness / stay hours, max(0, 1 − slope / slope scale), and Earth-centre contact. Weights and the 10° default scale are ranking preferences. An unknown factor with positive weight makes the index unknown; zero weight excludes that factor. This index is neither probability nor mission readiness.</p>
  </details>;
}

function IceEvidence({ model, onInspect }: Pick<MapLayerControlProps, 'model' | 'onInspect'>) {
  const [selection, setSelection] = useState('');
  const selected = model.iceFeatures.find(feature => feature.id === selection);
  const reference = selected && iceReference(selected);
  return <details className="map-screening-help">
    <summary>Published ice evidence and sources</summary>
    <p>Blue diamonds mark published reference locations of permanently shadowed regions (PSRs) associated with M3 surface-ice detections. A blue cross marks LCROSS water detected in impact ejecta. Symbols are enlarged annotations, never deposit footprints.</p>
    <p>Ice coverage within and outside each region, reserves and extractability remain unknown. Detection counts are not abundance, concentration or coverage. No hydrogen proxy is shown.</p>
    {model.iceSources.map(source => <details key={source.id}>
      <summary>{source.title}</summary>
      <p>{source.version}</p><p>{source.frame}</p><p>{source.projection}</p>
      <p><a href={source.publicationUrl} target="_blank" rel="noreferrer">Publication</a>{' · '}<a href={source.datasetUrl} target="_blank" rel="noreferrer">Dataset</a></p>
      <p>{source.credit}{' · '}<a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.license}</a></p>
      {source.processingNotes.map(note => <p key={note}>{note}</p>)}
    </details>)}
    {model.iceFeatures.length > 0 && <>
      <label>Published region or impact reference<select value={selection} onChange={event => setSelection(event.target.value)}>
        <option value="">Choose a reference location</option>
        {model.iceFeatures.filter(feature => iceReference(feature)).map(feature => <option key={feature.id} value={feature.id}>{feature.name}</option>)}
      </select></label>
      {selected && <><p>{selected.description}</p><p>{selected.resolutionM === null ? 'Sampling resolution unspecified' : `${selected.resolutionM} m source sampling; not location uncertainty`}{selected.value !== null ? `; ${selected.value} ${selected.unit}` : ''}</p>
        {reference && <Button variant="outline" size="sm" onClick={() => onInspect(reference.lat, reference.lon)}>Inspect published reference location</Button>}</>}
    </>}
  </details>;
}

function LayerStatus({ model, ranking = true }: { model: MapLayerModel; ranking?: boolean }) {
  return <>
    {ranking && <p role="status" aria-live="polite">{model.status}</p>}
    {ranking && model.error && <p role="alert">{model.error}</p>}
    {model.iceError && <p role="alert">Ice evidence: {model.iceError}</p>}
    {((ranking && model.error) || model.iceError) && <Button variant="outline" size="sm" onClick={model.retry}>Retry map layers</Button>}
  </>;
}

export function MapLayerControls({ settings, onChange, model, onInspect }: MapLayerControlProps) {
  const id = useId();
  const [inputError, setInputError] = useState('');
  const updateWeight = (factor: keyof MapLayerSettings['weights'], value: string) => {
    const n = value.trim() ? Number(value) : NaN, weights = { ...settings.weights, [factor]: n };
    if (!Number.isFinite(n) || n < 0 || !Object.values(weights).some(weight => weight > 0)) {
      setInputError('Weights must be nonnegative; keep at least one positive weight.'); return;
    }
    setInputError(''); onChange({ ...settings, weights });
  };
  return <section className="map-screening-controls" aria-label="Regional map layers">
    <label className="map-screening-toggle"><input type="checkbox" checked={settings.enabled} onChange={event => onChange({ ...settings, enabled: event.target.checked })}/>Rank sampled map cells</label>
    {settings.enabled && <>
      <label>Map ranking factor<select value={settings.metric} onChange={event => onChange({ ...settings, metric: event.target.value as MapMetric })}>
        {Object.entries(METRIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label id={`${id}-opacity`}>Ranking overlay opacity · {Math.round(settings.opacity * 100)}%</label>
      <Slider aria-labelledby={`${id}-opacity`} value={[Math.round(settings.opacity * 100)]} min={0} max={100} step={5}
        onValueChange={value => onChange({ ...settings, opacity: (Array.isArray(value) ? value[0] : value) / 100 })}/>
      <details><summary>Ranking preferences</summary>
        <p>Higher weight gives a factor more influence. Zero excludes it from the index while preserving its reported value.</p>
        <div className="map-screening-weights">{FACTORS.map(([factor, label]) => <label key={factor}>{label} weight
          <Input type="number" min={0} step="any" value={settings.weights[factor]} onChange={event => updateWeight(factor, event.target.value)} aria-describedby={`${id}-weight-error`}/>
        </label>)}
        <label>Slope ranking scale (°)<Input type="number" min={.01} step="any" value={settings.slopeScaleDeg} onChange={event => {
          const value = event.target.value.trim() ? Number(event.target.value) : NaN;
          if (!Number.isFinite(value) || value <= 0) { setInputError('Slope ranking scale must be positive.'); return; }
          setInputError(''); onChange({ ...settings, slopeScaleDeg: value });
        }} aria-describedby={`${id}-weight-error`}/></label></div>
        <p>Default 10°: at this regional slope or above, the slope contribution is zero. This is a preference, never a safe-landing limit.</p>
        <p id={`${id}-weight-error`} role={inputError ? 'alert' : undefined}>{inputError}</p>
      </details>
      <MetricExplanation/>
      <LayerStatus model={model}/>
    </>}
    <label className="map-screening-toggle"><input type="checkbox" checked={settings.iceEnabled} onChange={event => onChange({ ...settings, iceEnabled: event.target.checked })}/>Published ice evidence references</label>
    {settings.iceEnabled && <><p role="status">{model.iceStatus}</p><IceEvidence model={model} onInspect={onInspect}/>{!settings.enabled && <LayerStatus model={model} ranking={false}/>}</>}
  </section>;
}

function SampleFactors({ point }: { point: ScreeningPoint }) {
  return <dl className="map-screening-factors">
    <dt>Mean visible solar disk</dt><dd>{fmt(point.sunFraction === null ? null : point.sunFraction * 100, '%')}</dd>
    <dt>Longest observed darkness</dt><dd>{fmt(point.longestDarkHours, ' h', point.darkLowerBound)}</dd>
    <dt>Regional slope</dt><dd>{fmt(point.slopeDeg, '°')}</dd>
    <dt>Earth-centre contact geometry</dt><dd>{fmt(point.commsFraction === null ? null : point.commsFraction * 100, '%')}</dd>
    <dt>Elevation stencil spacing</dt><dd>{fmt(point.spacingM, ' m')}</dd>
  </dl>;
}

export function MapLayerLegend({ settings, onChange, model, onInspect }: MapLayerControlProps) {
  const [minimized, setMinimized] = useState(false);
  const id = useId();
  if (!settings.enabled && !settings.iceEnabled) return null;
  const range = metricRange(settings.metric, model.points);
  const unit = settings.metric === 'dark' ? ' h' : settings.metric === 'slope' ? '°' : settings.metric === 'combined' ? '' : '%';
  const top = model.points.filter(point => point.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 6);
  return <aside className="map-screening-legend" aria-label="Regional map layer legend">
    <div className="map-screening-heading"><strong>Map layers</strong>
      <Button variant="ghost" size="sm" aria-expanded={!minimized} aria-controls={`${id}-legend`} onClick={() => setMinimized(value => !value)}>{minimized ? 'Expand legend' : 'Minimize legend'}</Button>
      <Button variant="ghost" size="sm" aria-label="Dismiss map layers and legend" onClick={() => onChange({ ...settings, enabled: false, iceEnabled: false })}>×</Button>
    </div>
    <div id={`${id}-legend`} hidden={minimized}>
      {settings.enabled && <>
        <p><strong>{METRIC_LABELS[settings.metric]}</strong></p>
        <div className="map-screening-ramp" role="img" aria-label="Violet lower, amber middle, mint higher displayed value"/>
        <div className="map-screening-range"><span>Lower {fmt(range[0], unit)}</span><span>Higher {fmt(range[1], unit)}</span></div>
        <p>Unknown is uncoloured. Cell colour represents its sampled centre; no spatial confidence or fine detail is implied.</p>
        {settings.metric === 'dark' && <p>≥ marks observed darkness touching a stay boundary; it may last longer outside these dates. Higher hours means longer darkness.</p>}
        {settings.metric === 'slope' && <p>Higher degrees means steeper regional elevations.</p>}
        <p className="map-screening-dates">{model.dates}</p><p>{model.sampling}</p>
        <details><summary>Sampling and source limits</summary><p>{model.source}</p><MetricExplanation/></details>
        <LayerStatus model={model}/>
        <details><summary>Top sampled preference indices ({top.length})</summary>
          {!top.length && <p>No known combined indices. Review unknown factors or preferences.</p>}
          {top.map(point => <article key={`${point.lat}:${point.lon}`} className="map-screening-sample">
            <Button variant="outline" size="sm" onClick={() => onInspect(point.lat, point.lon)} aria-label={`Inspect exact sampled coordinate ${point.lat} latitude, ${point.lon} east longitude`}>
              {point.lat.toFixed(4)}°, {point.lon.toFixed(4)}°E · {fmt(point.score, ' / 100')}
            </Button>
            <SampleFactors point={point}/>
            <details><summary>Sample sources and limits</summary><p>{point.source}</p>{point.notes.map((note, i) => <p key={i}>{note}</p>)}</details>
          </article>)}
        </details>
      </>}
      {settings.iceEnabled && <><p><span className="map-screening-ice-symbol" aria-hidden="true">◆ +</span> Ice evidence reference locations</p><p>{model.iceStatus}</p>
        <IceEvidence model={model} onInspect={onInspect}/>{!settings.enabled && <LayerStatus model={model} ranking={false}/>}</>}
    </div>
  </aside>;
}
