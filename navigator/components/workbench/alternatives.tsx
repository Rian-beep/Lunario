"use client";

import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Catalog } from "@/lib/catalog";
import type { ScenarioState } from "@/lib/scenario";
import type { AlternativeCriteria, AlternativeMetrics, AlternativeResult } from "@/lib/alternative-types";
import { criteriaForBaseline, evaluateAlternative, nearbyCandidates } from "@/lib/alternatives";
import { buildSeries, formatUtc, indexToMs, summarize, terrainForCustom, terrainForSite, unavailableTerrain } from "@/lib/astro";
import { evaluateMission } from "@/lib/mission";
import { csvCell } from "@/lib/export";
import { AudienceContext, Info } from "./info";
import styles from "./alternatives.module.css";

type Props = {
  catalog: Catalog;
  baseline: ScenarioState;
  onOpen: (state: ScenarioState) => void;
  onSave: (state: ScenarioState, name: string) => void;
};
type Draft = Record<keyof AlternativeCriteria, string>;
type Cell = { result: AlternativeResult; sphere: AlternativeMetrics | null };
type Run = { cells: Cell[]; baseline: Cell; criteria: AlternativeCriteria; total: number; complete: boolean };

const STATUS = {
  conditional: { symbol: "≈", label: "Conditional evidence" },
  meets: { symbol: "✓", label: "Meets selected screens" },
  fails: { symbol: "×", label: "Fails screens" },
  unknown: { symbol: "?", label: "Insufficient data" },
  outside: { symbol: "—", label: "Outside catalog" },
} as const;
const FIELDS: { key: keyof AlternativeCriteria; label: string; planner?: string; unit: string; info: string; max?: number; required?: boolean }[] = [
  { key: "minSunFraction", label: "Minimum time in sunlight", planner: "Minimum any-limb sunlight", unit: "%", info: "Time in sunlight", max: 100 },
  { key: "minContactFraction", label: "Minimum Earth contact", planner: "Minimum geometric Earth contact", unit: "%", info: "Earth visibility", max: 100 },
  { key: "maxDarkHours", label: "Maximum darkness", unit: "h", info: "Longest darkness" },
  { key: "maxBlackoutHours", label: "Maximum contact blackout", unit: "h", info: "Longest blackout" },
  { key: "maxSlopeDeg", label: "Maximum surface slope", unit: "deg", info: "Surface slope", max: 90 },
  { key: "minBatteryWh", label: "Minimum battery energy", unit: "Wh", info: "Minimum battery", required: true },
  { key: "maxUnmetWh", label: "Maximum unmet energy", unit: "Wh", info: "Unmet load Wh", required: true },
];
const METRICS: { key: keyof AlternativeMetrics; label: string; info?: string; unit: string; scale?: number }[] = [
  { key: "sunFraction", label: "Time in sunlight", info: "Time in sunlight", unit: "%", scale: 100 },
  { key: "contactFraction", label: "Geometric Earth contact", info: "Earth visibility", unit: "%", scale: 100 },
  { key: "longestDarkHours", label: "Longest darkness", info: "Longest darkness", unit: "h" },
  { key: "longestBlackoutHours", label: "Longest contact blackout", info: "Longest blackout", unit: "h" },
  { key: "generatedWh", label: "Generated energy", info: "Generated energy", unit: "Wh" },
  { key: "minBatteryWh", label: "Minimum battery energy", info: "Minimum battery", unit: "Wh" },
  { key: "unmetWh", label: "Unmet energy", info: "Unmet load Wh", unit: "Wh" },
  { key: "slopeDeg", label: "Surface slope", info: "Surface slope", unit: "deg" },
  { key: "knownFraction", label: "Known Sun + Earth inputs", unit: "%", scale: 100 },
];
const CAVEAT = "Educational screening, not mission certification. This matrix does not validate radio performance, ground-station access, flight paths or landing hazards.";

export function parseDayOffsets(raw: string): { offsets: number[]; error: string } {
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.some((s) => !/^[+-]?\d+$/.test(s)))
    return { offsets: [], error: "Enter comma-separated whole days, with no empty entries." };
  const offsets = [...new Set(parts.map(Number))];
  if (offsets.some((n) => !Number.isSafeInteger(n) || n < -90 || n > 90))
    return { offsets: [], error: "Each day offset must be an integer from −90 to +90." };
  if (offsets.length > 12)
    return { offsets: [], error: "Choose at most 12 unique day offsets." };
  return { offsets: offsets.sort((a, b) => a - b), error: "" };
}

export function parseAlternativeCriteria(draft: Draft): { criteria: AlternativeCriteria | null; errors: Partial<Record<keyof AlternativeCriteria, string>> } {
  const errors: Partial<Record<keyof AlternativeCriteria, string>> = {};
  const values = {} as AlternativeCriteria;
  for (const field of FIELDS) {
    const raw = draft[field.key].trim();
    if (!raw && !field.required) {
      Object.assign(values, { [field.key]: null });
      continue;
    }
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < 0 || (field.max !== undefined && n > field.max)) {
      errors[field.key] = `Enter ${field.max === undefined ? "a finite value ≥ 0" : `0–${field.max}`} ${field.unit}${field.required ? "." : ", or leave blank."}`;
      continue;
    }
    Object.assign(values, { [field.key]: field.unit === "%" ? n / 100 : n });
  }
  return { criteria: Object.keys(errors).length ? null : values, errors };
}

const SCREEN_FOR_METRIC: Partial<Record<keyof AlternativeMetrics, [keyof AlternativeCriteria, string]>> = {
  sunFraction: ["minSunFraction", "≥"], contactFraction: ["minContactFraction", "≥"],
  longestDarkHours: ["maxDarkHours", "≤"], longestBlackoutHours: ["maxBlackoutHours", "≤"],
  minBatteryWh: ["minBatteryWh", "≥"], unmetWh: ["maxUnmetWh", "≤"], slopeDeg: ["maxSlopeDeg", "≤"],
};
function screenText(metric: typeof METRICS[number], criteria: AlternativeCriteria): string {
  const screen = SCREEN_FOR_METRIC[metric.key];
  if (!screen || criteria[screen[0]] == null) return "Not screened";
  return `${screen[1]} ${value(criteria[screen[0]], metric.scale)} ${metric.unit}`;
}
function initialDraft(baseline: ScenarioState): Draft {
  const c = criteriaForBaseline(baseline);
  return Object.fromEntries(FIELDS.map((f) => [f.key, c[f.key] == null ? "" : String(c[f.key]! * (f.unit === "%" ? 100 : 1))])) as Draft;
}
function value(n: number | null | undefined, scale = 1): string {
  return n == null || !Number.isFinite(n) ? "Unknown" : (n * scale).toLocaleString("en-GB", { maximumFractionDigits: 1 });
}
function coordinate(n: number): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 4 });
}
function percent(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "Unknown" : `${value(n, 100)}%`;
}
function delta(n: number | null | undefined, scale = 1): string {
  if (n == null || !Number.isFinite(n)) return "Unknown";
  const rounded = Math.round(n * scale * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${value(rounded)}`;
}
function offsetLabel(days: number): string {
  return days === 0 ? "No date slip" : `${days > 0 ? "+" : ""}${days} ${Math.abs(days) === 1 ? "day" : "days"}`;
}
function sameLocation(a: { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  return Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(((a.lon - b.lon + 540) % 360) - 180) < 1e-7;
}
function sphereMetrics(catalog: Catalog, result: AlternativeResult): AlternativeMetrics | null {
  if (result.status === "outside") return null;
  const { state, candidate } = result;
  const series = buildSeries(catalog, candidate.lat, candidate.lon, unavailableTerrain(state.heightM), state.startIndex, state.endIndex);
  const summary = summarize(series, catalog.meta.stepHours);
  const mission = evaluateMission(series, catalog.meta.stepHours, state.mission, true);
  let known = 0;
  const solarKnown = Array.from(series.sunEl, (el, k) => [el, series.sunAz[k], series.sunRadius[k]].every(Number.isFinite) && series.sunRadius[k] > 0);
  const contactKnown = Array.from(series.earthEl, (el, k) => Number.isFinite(el) && Number.isFinite(catalog.earthRangeKm[state.startIndex + k]) && catalog.earthRangeKm[state.startIndex + k] > 0);
  for (let k = 0; k < solarKnown.length; k++) if (solarKnown[k] && contactKnown[k]) known++;
  return {
    sunFraction: solarKnown.every(Boolean) && Number.isFinite(summary.sunlitSphere) ? summary.sunlitSphere : null,
    contactFraction: contactKnown.every(Boolean) ? mission.contactFraction : null,
    longestDarkHours: solarKnown.every(Boolean) ? summary.longestDarkSphere : null,
    longestBlackoutHours: contactKnown.every(Boolean) ? mission.longestBlackoutHours : null,
    generatedWh: solarKnown.every(Boolean) ? mission.generatedWh : null,
    minBatteryWh: solarKnown.every(Boolean) ? mission.minBatteryWh : null,
    unmetWh: solarKnown.every(Boolean) ? mission.unmetWh : null,
    slopeDeg: null,
    knownFraction: known / solarKnown.length,
  };
}
function coverage(catalog: Catalog, result: AlternativeResult): string {
  const { state, candidate } = result;
  const site = catalog.sites.find((s) => s.id === state.siteId);
  const terrain = state.custom ? terrainForCustom(catalog, candidate.lat, candidate.lon) : site ? terrainForSite(site, state.heightM) : null;
  if (!terrain || !Number.isFinite(terrain.distanceKm) || !terrain.mask.some(Number.isFinite) || terrain.heightM!==state.heightM) return "Terrain horizon unavailable; slope may also be unknown.";
  return state.custom
    ? `Derived custom point; nearest LOLA grid mask at ${terrain.cellLat == null ? "Unknown" : coordinate(terrain.cellLat)}°, ${terrain.cellLon == null ? "Unknown" : coordinate(terrain.cellLon)}°; ${value(terrain.distanceKm)} km from point; mask height ${value(terrain.heightM)} m. No measured local slope.`
    : `${site?.group === "derived" ? "Derived LOLA point. " : ""}${site?.source ?? "Catalog site"}; horizon height ${value(terrain.heightM)} m.`;
}

export function Alternatives(props: Props) {
  // A changed baseline remounts the session, invalidating results before they can be used.
  return <AlternativesSession key={`${props.catalog.meta.generatedUtc}:${JSON.stringify(props.baseline)}`} {...props} />;
}

function AlternativesSession({ catalog, baseline, onOpen, onSave }: Props) {
  const id = useId();
  const matrixRef=useRef<HTMLDivElement>(null);
  const detailRef=useRef<HTMLElement>(null);
  const [matrixMetric,setMatrixMetric]=useState<keyof AlternativeMetrics>('minBatteryWh');
  const activeMetric=METRICS.find(m=>m.key===matrixMetric)!;
  const scrollTo=(element:HTMLElement|null)=>element?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  function chooseCell(key:string){setSelected(key);setFeedback('');requestAnimationFrame(()=>scrollTo(detailRef.current));}
  const audience = useContext(AudienceContext);
  const [radius, setRadius] = useState("150");
  const [offsetText, setOffsetText] = useState("0, 1, 3, 7, 14, 30");
  const [draft, setDraft] = useState(() => initialDraft(baseline));
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");
  const token = useRef(0);
  useEffect(() => () => { token.current += 1; }, [catalog]);
  const radiusKm = Number(radius);
  const radiusError = radius.trim() === "" || !Number.isFinite(radiusKm) || radiusKm < 0 || radiusKm > 500 ? "Enter a radius from 0 to 500 km." : "";
  const { offsets, error: offsetError } = parseDayOffsets(offsetText);
  const { criteria, errors } = parseAlternativeCriteria(draft);
  const candidates = useMemo(() => {
    const site = catalog.sites.find((s) => s.id === baseline.siteId);
    const point = baseline.custom ?? site;
    if (!point) return [];
    const nearby = radiusError ? [] : nearbyCandidates(catalog, baseline, radiusKm, 12);
    const reference = nearby.find((c) => sameLocation(c, point)) ?? {
      id: "baseline", name: baseline.custom ? "Current custom point (derived)" : site!.name,
      lat: point.lat, lon: point.lon, siteId: baseline.siteId, custom: baseline.custom, distanceKm: 0,
    };
    return [reference, ...nearby.filter((c) => !sameLocation(c, point))].slice(0, 12);
  }, [catalog, baseline, radiusKm, radiusError]);
  const reference = candidates[0];
  const chosen = candidates.filter((c, i) => i === 0 || selectedIds === null || selectedIds.includes(c.id));
  const cell = run?.cells.find((c) => c.result.key === selected);
  const busy = !!run && !run.complete;
  const valid = !radiusError && !offsetError && !!criteria && chosen.length > 0;
  const stayHours = (baseline.endIndex - baseline.startIndex + 1) * catalog.meta.stepHours;
  const startMs = indexToMs(catalog, baseline.startIndex);
  const endMs = indexToMs(catalog, baseline.endIndex + 1);

  function invalidate(message = "Inputs changed. Run the comparison again.") {
    token.current += 1;
    setRun(null);
    setSelected(null);
    setFailure("");
    setFeedback(message);
  }
  async function compare() {
    if (!valid || !criteria || !reference) return;
    const current = ++token.current;
    setFailure("");
    setFeedback("Calculating the baseline and selected alternatives…");
    setSelected(null);
    const total = chosen.length * offsets.length;
    // Yield before the first evaluation, then after every three cells for input/cancel handling.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (current !== token.current) return;
    try {
      const baseResult = evaluateAlternative(catalog, baseline, reference, 0, criteria);
      const baseCell = { result: baseResult, sphere: sphereMetrics(catalog, baseResult) };
      const cells: Cell[] = [];
      setRun({ cells: [], baseline: baseCell, criteria, total, complete: false });
      for (const candidate of chosen) {
        for (const days of offsets) {
          if (current !== token.current) return;
          const result = candidate.id === reference.id && days === 0 ? baseResult : evaluateAlternative(catalog, baseline, candidate, days, criteria, baseResult.metrics);
          cells.push({ result, sphere: candidate.id === reference.id && days === 0 ? baseCell.sphere : sphereMetrics(catalog, result) });
          if (cells.length % 3 === 0 || cells.length === total) {
            if (current !== token.current) return;
            setRun({ cells: [...cells], baseline: baseCell, criteria, total, complete: cells.length === total });
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            if (current !== token.current) return;
          }
        }
      }
      setSelected(cells.find((c) => c.result.candidate.id === reference.id && c.result.offsetDays === 0)?.result.key ?? cells[0]?.result.key ?? null);
      setFeedback(`Comparison complete: ${total} site/date combinations. Select a cell to inspect its reasons.`);
      requestAnimationFrame(()=>{if(current===token.current)scrollTo(matrixRef.current);});
    } catch (error) {
      if (current !== token.current) return;
      setRun(null);
      setFailure(`Comparison could not finish: ${error instanceof Error ? error.message : "an unexpected calculation error occurred"}. Check the inputs and try again.`);
      setFeedback("");
    }
  }
  async function saveSelection() {
    if (!cell || !run?.complete || cell.result.status === "outside") return;
    const current = token.current;
    const name = `${cell.result.candidate.name} · ${formatUtc(indexToMs(catalog, cell.result.state.startIndex), false)} · ${offsetLabel(cell.result.offsetDays)}`;
    try {
      await onSave(cell.result.state, name);
      if (current === token.current) setFeedback(`Saved comparison: ${name}.`);
    } catch (error) {
      if (current === token.current) setFeedback(`Comparison could not be saved: ${error instanceof Error ? error.message : "storage is unavailable"}. Export CSV to keep these results.`);
    }
  }
  function exportCsv() {
    if (!run?.complete) return;
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const metricHeaders = METRICS.flatMap((m) => [`Terrain ${m.label} (${m.unit})`, `Smooth sphere ${m.label} (${m.unit})`, `Terrain delta from baseline (${m.scale === 100 ? "percentage points" : m.unit}): ${m.label}`]);
      const header = ["Site", "Latitude (deg)", "Longitude east (deg)", "Distance from baseline (km)", "Date slip (days)", "Start UTC", "End UTC (exclusive)", "Stay (h)", "Status", "Failed screens", "Missing data", ...metricHeaders, "Selected criteria JSON (fractions, h, deg, Wh; null = no screen)", "Full scenario state JSON", "Baseline scenario state JSON", "Baseline terrain metrics JSON (fractions, h, deg, Wh)", "Terrain coverage", "Site coordinate source", "Site source URL", "Ephemeris source", "Terrain source", "Catalog generated UTC", "Catalog coverage start UTC", "Catalog coverage end UTC (last sample)", "Sample interval (h)", "Sampling note", "Search radius (km)", "Selected candidate IDs JSON", "Selected day offsets JSON", "Limitations"];
      const rows = run.cells.map(({ result: r, sphere }) => {
        const site = catalog.sites.find((s) => s.id === r.state.siteId);
        return [r.candidate.name, r.candidate.lat, r.candidate.lon, r.candidate.distanceKm, r.offsetDays,
          new Date(indexToMs(catalog, r.state.startIndex)).toISOString(), new Date(indexToMs(catalog, r.state.endIndex + 1)).toISOString(), stayHours,
          STATUS[r.status].label, r.violations.join("; "), r.unknowns.join("; "),
          ...METRICS.flatMap((m) => [r.metrics[m.key] == null ? null : r.metrics[m.key]! * (m.scale ?? 1), sphere?.[m.key] == null ? null : sphere[m.key]! * (m.scale ?? 1), r.deltas[m.key] == null ? null : r.deltas[m.key]! * (m.scale ?? 1)]),
          JSON.stringify(run.criteria), JSON.stringify(r.state), JSON.stringify(baseline), JSON.stringify(run.baseline.result.metrics), coverage(catalog, r),
          r.state.custom ? "Derived custom point; nearest grid horizon, not a published landing coordinate" : site?.source, r.state.custom ? "" : site?.sourceUrl,
          catalog.meta.ephemeris, catalog.meta.demCitation, catalog.meta.generatedUtc, catalog.meta.t0, catalog.meta.t1, catalog.meta.stepHours, catalog.meta.samplingNote,
          radiusKm, JSON.stringify(chosen.map((c) => c.id)), JSON.stringify(offsets), CAVEAT];
      });
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "solarreach-contingency-comparison.csv";
      document.body.appendChild(anchor);
      anchor.click();
      setFeedback(`CSV download requested: ${rows.length} results, selected screens, full scenario states and source coverage.`);
    } catch (error) {
      setFeedback(`CSV export failed: ${error instanceof Error ? error.message : "downloads are unavailable"}. Try exporting again.`);
    } finally {
      anchor?.remove();
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Site × arrival date</p>
          <h2 id={`${id}-title`}>Compare delay contingencies</h2>
          <p>Shift the arrival date or move nearby. Keep the same stay, solar array, load, battery and antenna assumptions.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!run?.complete}>Export CSV</Button>
      </header>
      <div className={styles.baseline}>
        <strong>Baseline · {reference?.name ?? "Location unavailable"}</strong>
        <span>{formatUtc(startMs)} → {formatUtc(endMs)} (end exclusive)</span>
        <span>{value(stayHours)} h stay · {value(baseline.heightM)} m observer · {value(baseline.mission.loadW)} W load · {value(baseline.mission.batteryWh)} Wh battery</span>
      </div>
      <div className={styles.searchFields}>
        <div className={styles.field}>
          <label htmlFor={`${id}-radius`}>Nearby radius (km)</label>
          <Input id={`${id}-radius`} type="number" min={0} max={500} step="any" value={radius} aria-invalid={!!radiusError} aria-describedby={`${id}-radius-help`} onChange={(e) => { invalidate(); setRadius(e.target.value); setSelectedIds(null); }} />
          <small id={`${id}-radius-help`}>{radiusError || "Up to 500 km from the baseline."}</small>
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-offsets`}>Arrival offsets from baseline (days)</label>
          <Input id={`${id}-offsets`} value={offsetText} aria-invalid={!!offsetError} aria-describedby={`${id}-offset-help`} onChange={(e) => { invalidate(); setOffsetText(e.target.value); }} />
          <small id={`${id}-offset-help`}>{offsetError || "Comma-separated integers, −90 to +90; up to 12 unique dates. Negative means earlier."}</small>
        </div>
      </div>
      <details className={styles.disclosure} open>
        <summary>Nearby locations <span>{chosen.length} / 12 selected</span></summary>
        <p>Baseline stays included. Choose which of the nearest available catalog locations to compare. A custom baseline keeps its derived grid horizon.</p>
        <div className={styles.candidates}>
          {candidates.map((c, i) => (
            <label key={c.id} className={styles.candidate}>
              <input type="checkbox" checked={chosen.some((v) => v.id === c.id)} disabled={i === 0} onChange={(e) => {
                invalidate();
                const current = chosen.map((v) => v.id);
                setSelectedIds(e.target.checked ? [...current, c.id].slice(0, 12) : current.filter((v) => v !== c.id));
              }} />
              <span><strong>{c.name}</strong><small>{i === 0 ? "Baseline location" : `${value(c.distanceKm)} km away`}{c.custom ? " · derived grid horizon" : catalog.sites.find((s) => s.id === c.siteId)?.group === "derived" ? " · derived LOLA point" : ""}</small></span>
            </label>
          ))}
        </div>
        {candidates.length === 1 && !radiusError && <p>No other candidates were returned within this radius. Try a wider radius, up to 500 km.</p>}
      </details>
      <fieldset className={styles.criteria}>
        <legend>Selected screens</legend>
        <p>Blank optional fields mean no screening. These are your criteria; no universal safe thresholds are assumed. Battery and unmet-energy screens are always applied.</p>
        <div className={styles.criteriaFields}>
          {FIELDS.map((f) => (
            <div className={styles.field} key={f.key}>
              <div className={styles.fieldLabel}><label htmlFor={`${id}-${f.key}`}>{audience === "plan" ? f.planner ?? f.label : f.label} ({f.unit}){!f.required && <span> · optional</span>}</label><Info label={f.info} /></div>
              <Input id={`${id}-${f.key}`} type="number" min={0} max={f.max} step="any" required={f.required} placeholder={f.required ? undefined : "No screen"} value={draft[f.key]} aria-invalid={!!errors[f.key]} aria-describedby={errors[f.key] ? `${id}-${f.key}-error` : undefined} onChange={(e) => { invalidate(); setDraft({ ...draft, [f.key]: e.target.value }); }} />
              {errors[f.key] && <small id={`${id}-${f.key}-error`} className={styles.error}>{errors[f.key]}</small>}
            </div>
          ))}
        </div>
        <p className={styles.note}>Baseline reserve: {value(baseline.mission.batteryWh * baseline.mission.reserveSoc)} Wh ({value(baseline.mission.reserveSoc, 100)}% of usable capacity). Contact applies the configured {value(baseline.mission.antennaMaskDeg)}° antenna elevation mask.</p>
      </fieldset>
      <div className={styles.runbar}>
        <Button onClick={compare} disabled={!valid || busy}>Compare {valid ? `${chosen.length * offsets.length} combinations` : "alternatives"}</Button>
        {busy && <Button variant="outline" onClick={() => invalidate("Comparison cancelled. Results cleared; run again when ready.")}>Cancel comparison</Button>}
        <span>{run ? `${run.cells.length} / ${run.total} evaluated` : "Results appear below after you compare."}</span>
      </div>
      {busy && <progress className={styles.progress} value={run.cells.length} max={run.total} aria-label="Site/date combinations evaluated" />}
      <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
      {failure && <p className={styles.error} role="alert">{failure}</p>}
      {run && <>
        <div className={styles.legend} aria-label="Result legend">
          {Object.entries(STATUS).map(([key, s]) => <span key={key}><b aria-hidden="true">{s.symbol}</b> {s.label}</span>)}
        </div>
        <p className={styles.note}>Screens apply to terrain results. T = LOLA terrain horizon; S = smooth sphere. Percentages are sampled time, not power or a probability of mission success. Scroll the matrix horizontally for all dates.</p>
        <label className={styles.metricPicker}>Matrix variable <select aria-label="Matrix variable" value={matrixMetric} onChange={e=>setMatrixMetric(e.target.value as keyof AlternativeMetrics)}>{METRICS.map(m=><option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}</select>{activeMetric.info&&<Info label={activeMetric.info}/>}</label>
        <div ref={matrixRef} className={`${styles.tableScroll} ${styles.matrixScroll}`} role="region" aria-label="Contingency matrix, scroll horizontally" tabIndex={0}>
          <table className={styles.matrix}>
            <caption>Nearby locations by UTC arrival date. Select a result for reasons and baseline deltas.</caption>
            <thead><tr><th scope="col">Location / distance</th>{offsets.map((days) => <th scope="col" key={days}><strong>{formatUtc(startMs + days * 86400000, false)}</strong><span>{offsetLabel(days)}</span><small>{new Date(startMs).toISOString().slice(11, 16)} UTC</small></th>)}</tr></thead>
            <tbody>{chosen.map((c) => <tr key={c.id}><th scope="row"><strong>{c.name}</strong><span>{c.id === reference?.id ? "Baseline location" : `${value(c.distanceKm)} km away`}</span><small>{coordinate(c.lat)}°, {coordinate(c.lon)}°E{c.custom ? " · derived" : catalog.sites.find((s) => s.id === c.siteId)?.group === "derived" ? " · derived" : ""}</small></th>{offsets.map((days) => {
              const entry = run.cells.find((v) => v.result.candidate.id === c.id && v.result.offsetDays === days);
              const isBaseline = c.id === reference?.id && days === 0;
              return <td key={days} className={isBaseline ? styles.baselineCell : undefined}>
                {entry ? <button type="button" className={`${styles.cell} ${styles[entry.result.status]}`} aria-pressed={selected === entry.result.key} aria-label={`${c.name}, ${formatUtc(startMs + days * 86400000)}, ${STATUS[entry.result.status].label}${isBaseline ? ", baseline" : ""}`} onClick={() => chooseCell(entry.result.key)}>
                  {isBaseline && <span className={styles.baselineTag}>Baseline</span>}
                  <span className={styles.cellStatus}><b aria-hidden="true">{STATUS[entry.result.status].symbol}</b>{STATUS[entry.result.status].label}</span>
                  {entry.result.status !== "outside" && <><strong>{value(entry.result.metrics[matrixMetric],activeMetric.scale)} {activeMetric.unit}</strong><small>Δ baseline {delta(entry.result.deltas[matrixMetric],activeMetric.scale)} {activeMetric.unit==='%'?'pp':activeMetric.unit}</small><span>Sun T {percent(entry.result.metrics.sunFraction)} · S {percent(entry.sphere?.sunFraction)}</span><span>Contact T {percent(entry.result.metrics.contactFraction)} · S {percent(entry.sphere?.contactFraction)}</span></>}
                </button> : <span className={styles.pending}>Pending</span>}
              </td>;
            })}</tr>)}</tbody>
          </table>
        </div>
        {cell && <section ref={detailRef} className={styles.detail} aria-labelledby={`${id}-detail`}>
          <div className={styles.detailHeader}>
            <div><p className={styles.eyebrow}>Selected comparison</p><h3 id={`${id}-detail`}>{cell.result.candidate.name} · {offsetLabel(cell.result.offsetDays)}</h3><p>{formatUtc(indexToMs(catalog, cell.result.state.startIndex))} → {formatUtc(indexToMs(catalog, cell.result.state.endIndex + 1))} (end exclusive)</p></div>
            <div className={styles.actions}><Button variant="ghost" onClick={()=>scrollTo(matrixRef.current)}>Back to matrix</Button><Button variant="outline" disabled={!run.complete || cell.result.status === "outside"} onClick={() => {
              try { onOpen(cell.result.state); } catch (error) { setFeedback(`Scenario could not be opened: ${error instanceof Error ? error.message : "an unexpected error occurred"}.`); }
            }}>Open scenario</Button><Button disabled={!run.complete || cell.result.status === "outside"} onClick={saveSelection}>Save comparison</Button></div>
          </div>
          <p className={styles.verdict}><b aria-hidden="true">{STATUS[cell.result.status].symbol}</b> {STATUS[cell.result.status].label}</p>
          {cell.result.violations.length > 0 && <div><strong>Failed screens</strong><ul>{cell.result.violations.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div>}
          {cell.result.unknowns.length > 0 && <div><strong>Missing or unsupported data</strong><ul>{cell.result.unknowns.map((reason, i) => <li key={i}>{reason}</li>)}</ul></div>}
          {cell.result.status === "meets" && <p>All selected screens are met by the sampled terrain model for this stay. Unselected criteria are not assessed.</p>}
          {cell.result.status === "outside" && <p>The entire stay must fit within the bundled catalog. Dates are not clipped to produce a result. Open and save are unavailable for this cell.</p>}
          <div className={styles.tableScroll} role="region" aria-label="Selected result metrics, scroll horizontally" tabIndex={0}>
            <table className={styles.metrics}><caption>Terrain and smooth-sphere results with signed changes from the original baseline. A positive delta is an increase, not a rating.</caption><thead><tr><th scope="col">Measure</th><th scope="col">Terrain</th><th scope="col">Smooth sphere</th><th scope="col">Selected screen</th><th scope="col">Baseline terrain</th><th scope="col">Δ vs baseline terrain</th></tr></thead><tbody>{METRICS.map((m) => <tr key={m.key}><th scope="row">{m.label} ({m.unit}) {m.info && <Info label={m.info} />}</th><td>{value(cell.result.metrics[m.key], m.scale)}</td><td>{m.key === "slopeDeg" ? "Not applicable" : value(cell.sphere?.[m.key], m.scale)}</td><td>{screenText(m, run.criteria)}</td><td>{value(run.baseline.result.metrics[m.key], m.scale)}</td><td>{delta(cell.result.deltas[m.key], m.scale)}{m.scale === 100 ? " pp" : ` ${m.unit}`}</td></tr>)}</tbody></table>
          </div>
          <p><strong>Location:</strong> {coordinate(cell.result.candidate.lat)}°, {coordinate(cell.result.candidate.lon)}°E · {value(cell.result.candidate.distanceKm)} km from baseline. <strong>Date change:</strong> {offsetLabel(cell.result.offsetDays)}. Stay remains {value(stayHours)} h.</p>
          <p><strong>Coverage:</strong> {coverage(catalog, cell.result)} Known joint Sun/Earth-input samples: {value(cell.result.metrics.knownFraction, 100)}%. Missing data never count as passing a screen.</p>
          <details className={styles.disclosure}><summary>Held assumptions and source coverage</summary>
            <p>{catalog.meta.ephemeris}. {catalog.meta.demCitation}. Catalog: {formatUtc(indexToMs(catalog, 0))} to {formatUtc(indexToMs(catalog, catalog.meta.n - 1))} (last sample), {value(catalog.meta.stepHours)} h samples. {catalog.meta.samplingNote}</p>
            <p>Array: {value(baseline.mission.areaM2)} m², {baseline.mission.arrayMode === "tracking" ? "tracks the Sun" : `fixed at ${value(baseline.mission.tiltDeg)}° tilt and ${value(baseline.mission.azimuthDeg)}° azimuth`}; cell efficiency {percent(baseline.mission.efficiency)}, system losses {percent(baseline.mission.lossFraction)}, incident flux {value(baseline.mission.solarFlux)} W/m². Initial battery charge {percent(baseline.mission.initialSoc)}; reserve {percent(baseline.mission.reserveSoc)}; charge/discharge efficiencies {percent(baseline.mission.chargeEfficiency)} / {percent(baseline.mission.dischargeEfficiency)}. Load {value(baseline.mission.loadW)} W, usable capacity {value(baseline.mission.batteryWh)} Wh; antenna elevation mask {value(baseline.mission.antennaMaskDeg)}°.</p>
            <p>All baseline hardware, initial charge, array orientation, electrical efficiencies, solar flux, continuous load, antenna mask and observer height are held constant. Flight and radio inputs are carried into the scenario without validation by this matrix. No thermal, relay, ground-station scheduling or terrain-hazard model is added.</p>
            <p>Smooth sphere uses the same ephemeris and hardware with a constant 0° horizon. It is a reference, not a measured flat landing site. Slope is only available where the catalog supplies it.</p>
            {audience === "plan" && <pre>{JSON.stringify({ observerHeightM: baseline.heightM, mission: baseline.mission, flight: baseline.flight, radio: baseline.radio ?? null, criteria: run.criteria }, null, 2)}</pre>}
          </details>
        </section>}
      </>}
      <p className={styles.caveat}>{CAVEAT}</p>
    </section>
  );
}
