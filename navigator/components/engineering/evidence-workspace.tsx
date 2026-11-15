'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { NativeMath } from '../workbench/native-math';
import { EvidenceConfidence } from '../evidence-confidence/summary';
import { StationEvidenceSummary } from '../comms-evaluation/evidence-summary';
import { evaluateEvidenceConfidence, exportEvidenceConfidence } from '../../lib/evidence-confidence';
import type { Catalog } from '../../lib/catalog';
import type { AssessmentResult, EvidenceManifest } from '../../lib/planning-types';
import type { ScenarioState } from '../../lib/scenario';
import { DSN_STATIONS } from '../../lib/dsn';
import { parseEnvelope, exportEnvelope } from '../../lib/engineering-evidence/import';
import { evaluateCommunications } from '../../lib/engineering-evidence/communications';
import { StationGeometryLoader, type ProviderState } from '../../lib/engineering-evidence/horizons';
import { importObserverGeometry, type ObserverArchive } from '../../lib/engineering-evidence/import-metadata';
import { ENGINEERING_SOURCES, EVIDENCE_LIMITS, type CommunicationsEnvelope, type LinkHardware, type Provenance } from '../../lib/engineering-evidence/types';
import { evaluateDeclaredBounds, parseUncertainty, UNCERTAINTY_FIELDS, type BoundField, type StabilityResult, type UncertaintyEnvelope } from '../../lib/engineering-evidence/uncertainty';
import { emptyEnvelope, HARDWARE_FIELDS, lunarProxy, scenarioStay } from '../../lib/engineering-evidence/workspace';
export type EngineeringEvidenceWorkspaceProps = {
    catalog: Catalog;
    manifest: EvidenceManifest;
    state: ScenarioState;
    assessment: AssessmentResult;
    onInspect(index: number): void;
    onClose?(): void;
};
function download(value: unknown, name: string) { const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
const initialProvider: ProviderState = { status: 'idle', geometry: null, error: null };
const statusLabel = { 'incomplete': 'Incomplete evidence', 'conditional-meets': 'Meets entered requirements conditionally', 'conditional-shortfall': 'Falls short under entered assumptions' };
export function EngineeringEvidenceWorkspace({ catalog, manifest, state, assessment, onInspect, onClose }: EngineeringEvidenceWorkspaceProps) {
    const stay = useMemo(() => scenarioStay(catalog, state), [catalog, state]);
    const [envelope, setEnvelope] = useState(() => emptyEnvelope(assessment.scenarioKey));
    const [provider, setProvider] = useState<ProviderState>(initialProvider);
    const loader = useRef(new StationGeometryLoader());
    const sequence = useRef(0), runController = useRef<AbortController | null>(null);
    const [error, setError] = useState<string | null>(null), [json, setJson] = useState('');
    const [source, setSource] = useState(''), [author, setAuthor] = useState(''), [notes, setNotes] = useState('');
    const [values, setValues] = useState<Record<string, string>>({});
    const [band, setBand] = useState<LinkHardware['band']>('X');
    const [boundField, setBoundField] = useState<BoundField>('loadW'), [lower, setLower] = useState(''), [upper, setUpper] = useState('');
    const [bounds, setBounds] = useState<UncertaintyEnvelope | null>(null), [stability, setStability] = useState<StabilityResult | null>(null), [progress, setProgress] = useState<string | null>(null);
    const [minimumBits, setMinimumBits] = useState('');
    const [originalRetrievedUtc, setOriginalRetrievedUtc] = useState('');
    const [observerArchive, setObserverArchive] = useState<ObserverArchive | null>(null);
    const [nowUtc, setNowUtc] = useState(() => new Date().toISOString());
    const stale = envelope.scenarioKey !== assessment.scenarioKey;
    useEffect(() => { const timer = setInterval(() => setNowUtc(new Date().toISOString()), 30000); return () => clearInterval(timer); }, []);
    useEffect(() => { const l = loader.current, counter = sequence, runner = runController; return () => { l.cancel(); counter.current++; runner.current?.abort(); }; }, []);
    useEffect(() => { loader.current.cancel(); sequence.current++; runController.current?.abort(); setProvider(initialProvider); setProgress(null); }, [assessment.scenarioKey]);
    const calculation = useMemo(() => { try {
        return { value: evaluateCommunications(envelope, assessment.scenarioKey, stay, nowUtc), error: null };
    }
    catch (e) {
        return { value: null, error: message(e) };
    } }, [envelope, assessment.scenarioKey, stay, nowUtc]);
    const confidence = useMemo(() => { try {
        return { summary: evaluateEvidenceConfidence({ catalog, manifest, state, declaredBounds: bounds, stability }), error: null };
    } catch (e) { return { summary: null, error: message(e) }; } }, [catalog, manifest, state, bounds, stability]);
    const cancelCases = () => { sequence.current++; runController.current?.abort(); setProgress(null); };
    const provenance = (title: string): Provenance => {
        if (!source.trim() || !author.trim() || !notes.trim())
            throw Error('Add an evidence title, author and scope/assumptions before applying inputs');
        return { title: `${title}: ${source}`, author, sourceUrl: 'user:declared-engineering-assumption', issuedUtc: new Date().toISOString(), kind: 'user-assumption', notes };
    };
    const numeric = (key: string) => { const raw = values[key]; if (!raw?.trim() || !Number.isFinite(Number(raw)))
        throw Error(`Enter ${key}; an empty value is unknown`); return Number(raw); };
    function apply(part: 'hardware' | 'horizon' | 'weather' | 'allocation' | 'lunar') {
        try {
            const next = structuredClone(envelope), p = provenance(part);
            if (stale)
                throw Error('Evidence belongs to another scenario. Start a new envelope or import evidence bound to this scenario');
            if (part === 'hardware')
                next.hardware = { provenance: p, value: { band, ...Object.fromEntries(HARDWARE_FIELDS.map(f => [f.key, numeric(f.key)])) } as LinkHardware };
            if (part === 'horizon')
                next.stationHorizon = { provenance: p, value: { minimumElevationDeg: numeric('stationCutoffDeg'), profile: [] } };
            if (part === 'weather')
                next.weather = { provenance: p, value: [{ ...stay, band, frequencyGHz: numeric('frequencyGHz'), attenuationDb: numeric('weatherDb') }] };
            if (part === 'allocation')
                next.allocations = { provenance: p, value: [{ ...stay, rateLimitBps: numeric('allocationBps') }] };
            if (part === 'lunar')
                next.lunarMask = lunarProxy(catalog, state, assessment, { ...p, notes: `${p.notes}; explicitly using computed Earth-center terrain + antenna cutoff as station proxy; station direction and unresolved terrain/frame errors are not qualified.` });
            setEnvelope(parseEnvelope(next));
            setError(null);
        }
        catch (e) {
            setError(message(e));
        }
    }
    async function fetchGeometry() {
        setError(null);
        if (stale) {
            setError('Start a new envelope before fetching for the changed scenario');
            return;
        }
        await loader.current.load({ stationId: envelope.stationId, ...stay }, s => { setProvider(s); if (s.geometry) {
            setObserverArchive(null);
            setNowUtc(new Date().toISOString());
            setEnvelope(e => ({ ...e, geometry: s.geometry })); } });
    }
    async function importFile(file: File) {
        if (file.size > EVIDENCE_LIMITS.bytes) {
            setError('Evidence file exceeds 2 MB');
            return;
        }
        try {
            const content = await file.text(), v = JSON.parse(content);
            if (v?.schema === 'solarreach-declared-bounds-1') {
                cancelCases();
                setBounds(parseUncertainty(v));
                setStability(null);
            }
            else if (typeof v?.result === 'string' || typeof v?.response?.result === 'string') {
                const { geometry, archive } = importObserverGeometry(v, { stationId: envelope.stationId, ...stay }, originalRetrievedUtc);
                loader.current.cancel();
                setEnvelope(e => ({ ...e, geometry }));
                setObserverArchive(archive);
                setNowUtc(new Date().toISOString());
                setProvider(initialProvider);
            }
            else {
                const e = parseEnvelope(v);
                loader.current.cancel();
                setEnvelope(e);
                setObserverArchive(null);
                setNowUtc(new Date().toISOString());
                setProvider(initialProvider);
            }
            setError(null);
        }
        catch (e) {
            setError(message(e));
        }
    }
    async function runBounds() {
        runController.current?.abort();
        const controller = new AbortController();
        runController.current = controller;
        const id = ++sequence.current;
        try {
            const input = bounds;
            if (!input)
                throw Error('Declare bounds first');
            setStability(null);
            setProgress('Preparing finite cases');
            setError(null);
            const result = await evaluateDeclaredBounds(catalog, manifest, state, input, { signal: controller.signal, onProgress: (done, total) => { if (id === sequence.current)
                    setProgress(`${done} / ${total} cases`); } });
            if (id === sequence.current) {
                setStability(result);
                setProgress(null);
            }
        }
        catch (e) {
            if (id === sequence.current) {
                setProgress(null);
                setError(message(e));
            }
        }
    }
    function addBound() { try {
        if (!lower.trim() || !upper.trim())
            throw Error('Both finite endpoints are required');
        const b = { field: boundField, lower: Number(lower), upper: Number(upper), provenance: provenance('Declared finite bound') };
        const next = parseUncertainty({ schema: 'solarreach-declared-bounds-1', scenarioKey: assessment.scenarioKey, bounds: [...(bounds?.scenarioKey === assessment.scenarioKey ? bounds.bounds.filter(b => b.field !== boundField) : []), b] });
        cancelCases();
        setBounds(next);
        setStability(null);
        setError(null);
    }
    catch (e) {
        setError(message(e));
    } }
    const field = (key: string, label: string, unit: string) => <label key={key} className="grid gap-1 text-xs">{label} ({unit})<Input type="number" value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} placeholder="Unknown"/></label>;
    const result = calculation.value;
    return <section className="mx-auto flex h-full max-w-6xl flex-col bg-background text-foreground" aria-label="Engineering evidence workspace">
  <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Planner · Evidence chain</p><h2 className="font-serif text-2xl">Station contact & finite stability</h2><p className="mt-1 text-sm">{stay.startUtc} → {stay.endUtc} exclusive</p><p className="mt-1 break-all text-xs text-muted-foreground">Scenario {assessment.scenarioKey} · {assessment.modelVersion} · {manifest.datasetId}</p></div>{onClose && <Button variant="outline" onClick={onClose}>Close engineering</Button>}</header>
  <div className="space-y-6 overflow-auto p-5">
   <div className="flex flex-wrap items-center gap-2"><label className="text-sm">Ground station <select className="ml-2 rounded border bg-background p-2" value={envelope.stationId} onChange={e => { loader.current.cancel(); setProvider(initialProvider); setObserverArchive(null); setEnvelope(emptyEnvelope(assessment.scenarioKey, e.target.value as CommunicationsEnvelope['stationId'])); }}>{DSN_STATIONS.map(s => <option key={s.id} value={s.id}>{s.name} · {s.antenna}</option>)}</select></label><Button variant="outline" onClick={() => { loader.current.cancel(); setEnvelope(emptyEnvelope(assessment.scenarioKey, envelope.stationId)); setObserverArchive(null); setProvider(initialProvider); setError(null); }}>New envelope for current scenario</Button><Button variant="outline" onClick={() => download(exportEnvelope({ ...envelope, exportedUtc: new Date().toISOString() }), 'station-evidence.json')}>Export evidence</Button><label className="text-sm">Import evidence, observer JSON or bounds <input className="ml-2 max-w-60 text-xs" type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f)
        void importFile(f); e.target.value = ''; }}/></label></div>
   <label className="grid gap-1 text-xs">Original observer retrieval UTC (only when valid metadata is absent)<Input value={originalRetrievedUtc} onChange={e => setOriginalRetrievedUtc(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ssZ"/><span>Enter when the source was originally retrieved, then select the observer JSON again. Importing does not refresh evidence.</span></label>
   {observerArchive && <details className="rounded-xl border p-3"><summary>Original observer JSON metadata</summary><p className="mt-2 text-xs">Retrieved {observerArchive.fetchedUtc}. API signature: {observerArchive.response.signature == null ? 'Unknown — not supplied in raw response' : JSON.stringify(observerArchive.response.signature)}.</p><p className="mt-2 text-xs">The station envelope retains the raw table; export this observer archive separately to retain its complete API JSON and signature.</p><Button className="mt-2" variant="outline" onClick={() => download(observerArchive, 'original-observer-archive.json')}>Export original observer JSON</Button></details>}
   {stale && <p role="status" className="rounded border p-3 text-sm">Stale evidence: the site, stay or assumptions changed. Archived values remain inspectable; adequacy is unavailable.</p>}
   {(error || calculation.error || provider.error) && <p role="alert" className="rounded border p-3 text-sm">{error ?? calculation.error ?? provider.error}</p>}
   <StationEvidenceSummary envelope={envelope} scenarioKey={assessment.scenarioKey} stay={stay} nowUtc={nowUtc}/>
   <section className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-serif text-xl">{result ? statusLabel[result.status] : 'Evidence cannot be evaluated'}</h3><p className="text-sm">Delivered data: {result?.deliveredBits === null || !result ? 'unknown' : `${result.deliveredBits.toLocaleString()} bits`} · Contact: {result?.contactSeconds === null || !result ? 'unknown' : `${result.contactSeconds.toLocaleString()} s`}</p></div><Button variant="outline" onClick={() => download({ envelope, result, stay, assessedUtc: new Date().toISOString() }, 'station-capacity-result.json')}>Export chain result</Button></div><p className="mt-2 text-xs text-muted-foreground">All complete results remain conditional. Hourly left-held geometry, supplied mask, RF assumptions and allocation do not establish acquisition, scheduling commitment or operational approval. Unknown intervals are excluded from the known subtotal ({result?.knownDeliveredBits.toLocaleString() ?? '—'} bits), never treated as zero.</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">{(['geometry', 'stationHorizon', 'lunarMask', 'hardware', 'weather', 'allocations'] as const).map(key => <span key={key} className="rounded border px-2 py-1">{key}: {envelope[key] ? 'supplied' : 'unknown'}</span>)}</div>
    <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">Required delivered data (bits)<Input className="max-w-48" type="number" value={minimumBits} placeholder="Enter requirement" onChange={e => setMinimumBits(e.target.value)}/><Button variant="outline" onClick={() => { try {
        if (!minimumBits.trim())
            throw Error('Enter a delivered-data requirement');
        setEnvelope(parseEnvelope({ ...envelope, requirements: { ...envelope.requirements, minimumBits: Number(minimumBits) } }));
        setError(null);
    }
    catch (e) {
        setError(message(e));
    } }}>Set requirement</Button></label>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="outline" disabled={!state.requirements.criticalContacts.length || stale} onClick={() => { try {
        const start = Date.parse(stay.startUtc);
        setEnvelope(parseEnvelope({ ...envelope, requirements: { ...envelope.requirements, critical: state.requirements.criticalContacts.map(c => ({ id: c.id, startUtc: new Date(start + c.startOffsetHours * 3600000).toISOString(), endUtc: new Date(start + c.endOffsetHours * 3600000).toISOString(), minimumBits: 0, minimumContactSeconds: (c.endOffsetHours - c.startOffsetHours) * 3600 })) } }));
        setError(null);
    }
    catch (e) {
        setError(message(e));
    } }}>Use scenario critical windows for continuous contact</Button><span className="text-xs">{envelope.requirements.critical.length} critical windows; edit per-window data/seconds in JSON.</span></div>{result?.critical.map(c => <p key={c.id} className="mt-2 text-sm">Critical {c.id}: {statusLabel[c.status]} · {c.bits ?? 'unknown'} bits · {c.seconds ?? 'unknown'} s</p>)}
   </section>
   <section className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-4"><h3 className="font-serif text-lg">Dated station → Moon geometry</h3><p className="mt-2 text-sm">{DSN_STATIONS.find(s => s.id === envelope.stationId)?.description} These are terrestrial ground locations. Fetch only on request; import/export retains raw observer tables for disconnected use. Maximum 31 days / 745 endpoints.</p><div className="mt-3 flex gap-2"><Button onClick={() => void fetchGeometry()} disabled={provider.status === 'loading'}>Fetch selected stay from Horizons</Button><Button variant="outline" onClick={() => { loader.current.cancel(); setProvider({ status: 'cancelled', geometry: null, error: null }); }}>Cancel fetch</Button></div><p role="status" className="mt-2 text-xs">{provider.status} · {envelope.geometry ? `${envelope.geometry.samples.length} samples; retrieved ${envelope.geometry.fetchedUtc}` : 'No station geometry imported'}</p>{envelope.geometry && <p className="mt-2 text-xs">Age {result?.geometryAgeHours?.toFixed(1)} h · {result?.futureGeometry ? 'Future ephemeris prediction' : 'Dated ephemeris calculation'}; inspect archived EOP coverage in JSON. The adapter does not fetch or infer weather.</p>}<a className="mt-2 block text-xs underline" href={ENGINEERING_SOURCES.api} target="_blank" rel="noreferrer">Horizons observer API conventions</a></div>
    <div className="rounded-xl border p-4"><h3 className="font-serif text-lg">Provenance for entered assumptions</h3><p className="mt-2 text-sm">Inputs below are explicit user assumptions over this stay. For dated reference profiles, forecasts or measured masks, import a sourced envelope. Observations cannot cover a later interval as forecast.</p><div className="mt-3 grid gap-2"><label className="text-xs">Evidence title<Input value={source} onChange={e => setSource(e.target.value)}/></label><label className="text-xs">Author<Input value={author} onChange={e => setAuthor(e.target.value)}/></label><label className="text-xs">Scope and assumption rationale<Input value={notes} onChange={e => setNotes(e.target.value)}/></label></div></div></section>
   <section className="rounded-xl border p-4"><h3 className="font-serif text-lg">Lunar mask → station horizon → radio link → allocation</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{HARDWARE_FIELDS.map(f => field(f.key, f.label, f.unit))}<label className="grid gap-1 text-xs">Band<select className="rounded border bg-background p-2" value={band} onChange={e => setBand(e.target.value as LinkHardware['band'])}>{['S', 'X', 'Ka', 'other'].map(b => <option key={b}>{b}</option>)}</select></label></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => apply('hardware')}>Apply hardware assumptions</Button><Button variant="outline" onClick={() => apply('lunar')}>Assume current Earth-center contact as station proxy</Button></div><p className="mt-2 text-xs text-muted-foreground">The proxy reuses the current antenna-height terrain mask and minimum elevation, with its unknown samples. Station direction differs from Earth center; a reference station-specific lunar mask can replace this via import. No lunar mask is silently populated.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{field('stationCutoffDeg', 'Station horizon / minimum elevation', '°')}{field('weatherDb', 'Band-specific weather attenuation over stay', 'dB')}{field('allocationBps', 'Assumed allocated rate over stay', 'bit/s')}</div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => apply('horizon')}>Assume constant station horizon</Button><Button variant="outline" onClick={() => apply('weather')}>Assume weather loss for stay</Button><Button variant="outline" onClick={() => apply('allocation')}>Assume allocation for stay</Button></div><p className="mt-2 text-xs">Zero is an explicit input. Station clearance also retains a conservative 0° local-horizontal floor. No allocation is represented by a dated zero-rate interval; an absent interval is unknown. Gains are vacuum gains; total system noise must include the relevant sky and lunar noise. Avoid counting atmospheric loss twice.</p>
    <div className="mt-4 overflow-x-auto rounded border p-3" aria-label="Downlink capacity equations"><NativeMath display expression="L_fs = 20 log₁₀(4π R f / c)"/><NativeMath display expression="Eb/N0[dB] = P_rx[dBW] − 10 log₁₀(k_B T_noise) − 10 log₁₀(R_bit)"/><NativeMath display expression="M_link = (Eb/N0)_assumed − (Eb/N0)_req"/><p className="text-xs">R in metres, f in Hz, c = 299,792,458 m/s; powers and losses in dB units. Margin = C/N₀ − 10 log₁₀(rate) − required Eb/N₀. Delivered bits = Σ available rate × overlap seconds. Rate is capped by entered allocation; negative margin supplies zero usable rate.</p></div>
   </section>
   <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Inspect intervals and critical contacts</summary><p className="my-2 text-xs">First 200 intervals shown; exports retain every interval and exact source bytes. Use JSON editor below for dated allocation/weather changes, azimuth horizon profiles, station-specific lunar masks and critical contact requirements.</p><div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>UTC interval</th><th>Station elevation / cutoff</th><th>Margin</th><th>Rate</th><th>Evidence / inspect</th></tr></thead><tbody>{result?.slices.slice(0, 200).map(s => <tr key={s.startUtc} className="border-t"><td className="py-2">{s.startUtc}<br />{s.endUtc}</td><td>{s.stationElevationDeg?.toFixed(2) ?? '?'}° / {s.horizonDeg?.toFixed(2) ?? '?'}°</td><td>{s.marginDb?.toFixed(2) ?? '?'} dB</td><td>{s.rateBps ?? '?'} bit/s</td><td>{s.unknown.length ? s.unknown.join('; ') : 'Conditional sample'}<Button variant="ghost" size="xs" onClick={() => onInspect(Math.floor((Date.parse(s.startUtc) - catalog.t0ms) / (catalog.meta.stepHours * 3600000)))}>Inspect</Button></td></tr>)}</tbody></table></div></details>
   <section className="rounded-xl border p-4"><h3 className="font-serif text-xl">Declared bounds & outcome stability</h3><p className="mt-2 text-sm">Run lower, nominal and upper combinations for at most three independent declared input bounds (≤27 cases). Requirements, operations, dates and all other inputs stay fixed. The sample range is not a continuous uncertainty interval or a probability.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs">Input (nominal shown)<select className="rounded border bg-background p-2" value={boundField} onChange={e => setBoundField(e.target.value as BoundField)}>{UNCERTAINTY_FIELDS.map(f => <option key={f} value={f}>{f} ({state.mission[f]})</option>)}</select></label><label className="grid gap-1 text-xs">Declared lower<Input type="number" value={lower} onChange={e => setLower(e.target.value)}/></label><label className="grid gap-1 text-xs">Declared upper<Input type="number" value={upper} onChange={e => setUpper(e.target.value)}/></label></div><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={addBound}>Add / replace bound with provenance</Button><Button onClick={() => void runBounds()} disabled={!!progress || !bounds}>Run finite cases</Button><Button variant="outline" onClick={() => { sequence.current++; runController.current?.abort(); setProgress(null); }}>Cancel cases</Button><Button variant="outline" onClick={() => { cancelCases(); setBounds(null); setStability(null); }}>Clear bounds</Button>{bounds && <Button variant="outline" onClick={() => download(bounds, 'declared-bounds.json')}>Export bounds</Button>}</div><p role="status" className="mt-2 text-xs">{progress ?? (bounds ? `${bounds.bounds.length} declared bounds; ${bounds.scenarioKey === assessment.scenarioKey ? 'current binding' : 'stale binding'}` : 'Unquantified — no declared bounds')}</p>{bounds?.bounds.map(b => <p key={b.field} className="mt-1 text-xs">{b.field}: {b.lower}…{b.upper} · {b.provenance.kind} · {b.provenance.author} <Button variant="ghost" size="xs" onClick={() => { cancelCases(); setBounds({ ...bounds, bounds: bounds.bounds.filter(x => x.field !== b.field) }); setStability(null); }}>Remove {b.field}</Button></p>)}
    {stability && <div className="mt-4"><p className="text-sm">{stability.baselineKey !== assessment.scenarioKey ? 'Stale result · ' : ''}{stability.cases.length} cases · outcome {stability.outcomeStable ? 'unchanged in tested cases' : 'changes in tested cases'} · sampled minimum battery {stability.sampledBatteryRangeWh?.map(n => n.toFixed(2)).join('…') ?? 'unknown'} Wh {stability.allCasesHaveBattery ? '' : '(some cases unknown)'}</p><Button className="mt-2" variant="outline" disabled={confidence.summary?.finite.status !== 'current'} onClick={() => { if (confidence.summary?.finite.status === 'current') download(exportEvidenceConfidence(confidence.summary, new Date().toISOString()), 'finite-stability-evidence.json'); }}>Export cases & held scenario</Button><div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>Case identity / inputs</th><th>Outcome</th><th>Minimum battery</th><th>Unmet demand</th></tr></thead><tbody>{stability.cases.map(c => <tr key={c.id} className="border-t"><td className="py-2">{c.id}<br />{JSON.stringify(c.values)}</td><td>{c.outcome}</td><td>{c.minimumBatteryWh ?? '?'} Wh</td><td>{c.unmetWh ?? '?'} Wh</td></tr>)}</tbody></table></div><p className="mt-2 text-xs">Unquantified: {stability.unquantified.join('; ')}.</p></div>}
   </section>
   <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Offline evidence JSON editor</summary><p className="my-2 text-xs">Load current evidence, edit dated intervals and provenance, then apply. Imports reject overlapping coverage, incompatible values, oversized files and computed geometry that differs from archived source bytes. Evidence is module-owned and does not change the scenario.</p><div className="mb-2 flex gap-2"><Button variant="outline" onClick={() => setJson(exportEnvelope(envelope))}>Load current evidence</Button><Button variant="outline" onClick={() => { try {
        const parsed = parseEnvelope(json);
        loader.current.cancel();
        setEnvelope(parsed);
        setObserverArchive(null);
        setNowUtc(new Date().toISOString());
        setProvider(initialProvider);
        setError(null);
    }
    catch (e) {
        setError(message(e));
    } }}>Apply JSON</Button></div><label className="grid gap-1 text-xs">Evidence JSON<textarea className="min-h-72 w-full rounded border bg-background p-3 font-mono text-xs" value={json} onChange={e => setJson(e.target.value)} maxLength={EVIDENCE_LIMITS.bytes}/></label></details>
   <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Reference evidence & open validation gate</summary><p className="mt-2 text-sm">Independent fixtures compare 75 station epochs from CSPICE DE440s, ITRF93 and LT+S against fresh Horizons DE441 airless observer tables. This tests the adapter’s station/time/units parsing; it does not qualify antennas or operations. Current Horizons documentation specifies the DE421 mean-Earth convention via a fixed DE440 PA rotation. Original catalog response headers and effective terrain/frame error propagation remain unresolved.</p><p className="mt-2 font-mono text-xs">node_modules/.bin/tsx scripts/verify-engineering-evidence.mts --live --frame</p><ul className="mt-2 space-y-1 text-xs">{Object.entries(ENGINEERING_SOURCES).map(([key, url]) => <li key={key}><a href={url} target="_blank" rel="noreferrer" className="underline">{key}: primary reference</a></li>)}</ul>{result?.reasons.map(r => <p key={r} className="mt-2 text-xs">{r}</p>)}</details>
   {confidence.summary ? <EvidenceConfidence summary={confidence.summary} audience="planner"/> : <p role="status">Evidence summary unavailable: {confidence.error}</p>}
  </div>
 </section>;
}
