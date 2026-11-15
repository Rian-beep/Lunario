/** Historical ephemerides are separate from the editable flight solver. All time arguments are seconds from the declared epoch, never Unix milliseconds. */
export type TrajectoryKind = 'flown' | 'reconstructed' | 'planned' | 'reference' | 'educational-simulation';
export type TrajectoryPhase = 'earth-launch' | 'transfer' | 'orbit' | 'descent' | 'surface-ascent' | 'flyby';
export type Vector3 = [number, number, number];
export interface TrajectorySource { url: string; version: string; sha256: string }
export interface MissionTrajectory {
  schemaVersion: 1;
  id: string; missionId: string; siteId: string | null; vehicle: string;
  kind: TrajectoryKind; phase: TrajectoryPhase;
  epoch: { calendar: string; scale: 'TDB' | 'UTC'; utc: string };
  frame: { center: 'MOON'; centerId: 301; name: 'IAU_MOON' | 'J2000' | 'ICRF'; type: 'body-fixed' | 'inertial'; sourceFrame: string; positionUnit: 'km'; velocityUnit: 'km/s'; transform: string };
  coverage: { start: number; end: number; cadenceSeconds: number; interpolation: 'linear' | 'none'; maxGapSeconds: number; extrapolation: 'forbidden' };
  sources: TrajectorySource[]; uncertainty: string; missing: string[]; attitude: 'unavailable';
  samples: { t: number; position: Vector3; velocity: Vector3 }[];
}
export interface TrajectoryIdentity { vehicle: string; id: string; missionId: string; siteId: string | null; kind: TrajectoryKind; phase: TrajectoryPhase; primarySha256: string; primaryUrl: string; primaryVersion: string; frameName: MissionTrajectory['frame']['name']; epochCalendar: string; epochScale: MissionTrajectory['epoch']['scale'] }
const KINDS: TrajectoryKind[] = ['flown', 'reconstructed', 'planned', 'reference', 'educational-simulation'];
const PHASES: TrajectoryPhase[] = ['earth-launch', 'transfer', 'orbit', 'descent', 'surface-ascent', 'flyby'];
const fail = (message: string): never => { throw new Error(`Trajectory: ${message}`); };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('expected object');
const string = (value: unknown): string => typeof value === 'string' && value.trim().length > 0 ? value : fail('expected nonempty text');
const finite = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : fail('expected finite number');
const vector = (value: unknown): Vector3 => Array.isArray(value) && value.length === 3 ? [finite(value[0]), finite(value[1]), finite(value[2])] : fail('expected three coordinates');
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : fail('expected array');
const member = <T extends string>(value: unknown, allowed: readonly T[]): T => allowed.find(item => item === value) ?? fail('unsupported enum');
export function trajectorySourceUrl(value: unknown): string {
  const text = string(value);
  const url = new URL(text);
  if (url.protocol !== 'https:' || url.username || url.password) fail('expected public HTTPS citation');
  return text;
}
function calendar(value: unknown, utc: boolean): string {
  const text = string(value);
  if (!(utc ? /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/ : /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/).test(text)) fail('invalid epoch');
  const normalized = utc ? text : text + 'Z';
  const time = new Date(normalized);
  if (!Number.isFinite(time.getTime()) || time.toISOString().slice(0, 19) !== normalized.slice(0, 19)) fail('invalid calendar date');
  return text;
}
/** Structural validation does not authenticate provenance. Pass a trusted identity for shipped datasets; use verifyTrajectoryBytes before parsing untrusted file bytes. */
export function parseMissionTrajectory(value: unknown, expected?: TrajectoryIdentity): MissionTrajectory {
  const v = object(value), e = object(v.epoch), f = object(v.frame), c = object(v.coverage);
  if (v.schemaVersion !== 1 || f.center !== 'MOON' || f.centerId !== 301 || f.positionUnit !== 'km' || f.velocityUnit !== 'km/s' || c.extrapolation !== 'forbidden' || v.attitude !== 'unavailable') fail('unsupported schema, center, units, extrapolation or attitude');
  const name = member(f.name, ['IAU_MOON', 'J2000', 'ICRF'] as const);
  const type = member(f.type, ['body-fixed', 'inertial'] as const);
  if ((name === 'IAU_MOON') !== (type === 'body-fixed')) fail('frame/type mismatch');
  const sources = list(v.sources).map(item => {
    const s = object(item), sha256 = string(s.sha256);
    if (!/^[a-f0-9]{64}$/.test(sha256)) fail('invalid source SHA256');
    return { url: trajectorySourceUrl(s.url), version: string(s.version), sha256 };
  });
  if (!sources.length || sources.length > 32) fail('missing or excessive provenance');
  const coverage: MissionTrajectory['coverage'] = { start: finite(c.start), end: finite(c.end), cadenceSeconds: finite(c.cadenceSeconds), maxGapSeconds: finite(c.maxGapSeconds), interpolation: member(c.interpolation, ['linear', 'none'] as const), extrapolation: 'forbidden' };
  if (coverage.start !== 0 || coverage.end <= 0 || coverage.cadenceSeconds <= 0 || coverage.maxGapSeconds < coverage.cadenceSeconds) fail('invalid coverage');
  const samples = list(v.samples).map(item => { const s = object(item); return { t: finite(s.t), position: vector(s.position), velocity: vector(s.velocity) }; });
  if (samples.length < 2 || samples.length > 100000 || samples[0].t !== coverage.start || samples.at(-1)!.t !== coverage.end) fail('sample bounds disagree with coverage');
  for (let i = 0; i < samples.length; i++) {
    if (i && samples[i].t <= samples[i - 1].t) fail('sample times must increase');
    if (Math.hypot(...samples[i].position) === 0) fail('undefined body-center position');
  }
  const result: MissionTrajectory = {
    schemaVersion: 1, id: string(v.id), missionId: string(v.missionId), siteId: v.siteId === null ? null : string(v.siteId), vehicle: string(v.vehicle),
    kind: member(v.kind, KINDS), phase: member(v.phase, PHASES),
    epoch: { calendar: calendar(e.calendar, false), scale: member(e.scale, ['TDB', 'UTC'] as const), utc: calendar(e.utc, true) },
    frame: { center: 'MOON', centerId: 301, name, type, sourceFrame: string(f.sourceFrame), positionUnit: 'km', velocityUnit: 'km/s', transform: string(f.transform) },
    coverage, sources, samples, uncertainty: string(v.uncertainty), missing: list(v.missing).map(string), attitude: 'unavailable',
  };
  if (result.epoch.scale === 'UTC' && result.epoch.calendar !== result.epoch.utc.slice(0, 19)) fail('UTC epoch mismatch');
  if (expected && (result.vehicle !== expected.vehicle || result.id !== expected.id || result.missionId !== expected.missionId || result.siteId !== expected.siteId || result.kind !== expected.kind || result.phase !== expected.phase || sources[0].sha256 !== expected.primarySha256 || sources[0].url !== expected.primaryUrl || sources[0].version !== expected.primaryVersion || result.frame.name !== expected.frameName || result.epoch.calendar !== expected.epochCalendar || result.epoch.scale !== expected.epochScale)) fail('trusted source identity mismatch');
  return result;
}
export async function verifyTrajectoryBytes(bytes: Uint8Array, expectedSha256: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) fail('invalid trusted digest');
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes));
  if (Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') !== expectedSha256) fail('artifact digest mismatch');
}
export interface TrajectoryState { positionKm: Vector3; velocityKmS: Vector3; interpolated: boolean; attitude: null }
/** Piecewise Cartesian interpolation for display only; no dynamics, burns, collision, or attitude is inferred. */
export function missionTrajectoryState(data: MissionTrajectory, t: number): TrajectoryState | null {
  if (!Number.isFinite(t) || t < data.coverage.start || t > data.coverage.end) return null;
  let lo = 0, hi = data.samples.length - 1;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (data.samples[mid].t < t) lo = mid + 1; else hi = mid; }
  const b = data.samples[lo];
  if (b.t === t) return { positionKm: [...b.position], velocityKmS: [...b.velocity], interpolated: false, attitude: null };
  const a = data.samples[lo - 1];
  if (!a || data.coverage.interpolation === 'none' || b.t - a.t > data.coverage.maxGapSeconds) return null;
  const fraction = (t - a.t) / (b.t - a.t);
  const mix = (x: Vector3, y: Vector3): Vector3 => [0, 1, 2].map(i => x[i] + fraction * (y[i] - x[i])) as Vector3;
  return { positionKm: mix(a.position, b.position), velocityKmS: mix(a.velocity, b.velocity), interpolated: true, attitude: null };
}
/** 1 wall second = 1 mission second. Caller owns play/pause anchor and stops when ended; never extrapolate. */
export function missionReplayClock(data: MissionTrajectory, anchorSeconds: number, anchorPerfMs: number, nowPerfMs: number): { seconds: number; ended: boolean } | null {
  if (![anchorSeconds, anchorPerfMs, nowPerfMs].every(Number.isFinite) || anchorSeconds < 0 || anchorSeconds > data.coverage.end || nowPerfMs < anchorPerfMs) return null;
  const seconds = Math.min(data.coverage.end, anchorSeconds + (nowPerfMs - anchorPerfMs) / 1000);
  return { seconds, ended: seconds === data.coverage.end };
}
/** Conventional y-up display transform only. This does NOT register IAU_MOON to an ME-frame terrain map. */
export const trajectorySceneKm = ([x, y, z]: Vector3): Vector3 => [x, z, -y];

/** Bounded Horizons VEC_TABLE=2 CSV import. Preserves TDB; performs no frame or time-scale conversion. Source hash must be verified separately. */
export function parseMissionHorizonsVectors(text: string, targetId: number): { julianDateTdb: number; positionKm: Vector3; velocityKmS: Vector3 }[] {
  if (text.length > 10_000_000 || !Number.isSafeInteger(targetId)) fail('invalid bounded source');
  const head = text.split('$$SOE')[0];
  for (const required of [`(${targetId})`, 'Center body name: Moon (301)', 'Center-site name: BODY CENTER', 'Output units    : KM-S', 'Output type     : GEOMETRIC cartesian states', 'Reference frame : ICRF', 'Calendar Date (TDB)']) {
    if (!head.includes(required)) fail('Horizons source identity/frame/time/units mismatch');
  }
  if (!head.split('\n').some(line => line.startsWith('Target body name:') && line.includes(`(${targetId})`))) fail('wrong Horizons target');
  const parts = text.split('$$SOE');
  if (parts.length !== 2 || parts[1].split('$$EOE').length !== 2) fail('missing/duplicate Horizons bounds');
  const rows = parts[1].split('$$EOE')[0].trim().split(/\r?\n/).map(line => {
    const fields = line.split(',').map(field => field.trim());
    if (fields.length !== 9 || fields[8] !== '' || !fields[1].startsWith('A.D.') || [fields[0], ...fields.slice(2, 8)].some(field => !field)) fail('invalid Horizons vector record');
    const numbers = [fields[0], ...fields.slice(2, 8)].map(field => finite(Number(field)));
    return { julianDateTdb: numbers[0], positionKm: vector(numbers.slice(1, 4)), velocityKmS: vector(numbers.slice(4, 7)) };
  });
  if (rows.length < 2 || rows.length > 100000) fail('invalid Horizons sample count');
  rows.forEach((row, i) => { if (i && row.julianDateTdb <= rows[i - 1].julianDateTdb) fail('Horizons times must increase'); });
  return rows;
}
