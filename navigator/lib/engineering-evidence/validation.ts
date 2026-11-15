import type { Provenance, Span } from './types';
export function object(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('Expected an evidence object'); return v as Record<string, unknown>; }
export function text(v: unknown, max = 4000): string { if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw Error('Missing or oversized evidence text'); return v; }
export function number(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw Error(`Expected finite value in [${min}, ${max}]`); return v; }
export function utc(v: unknown): string { const s = text(v, 40); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().replace('.000Z', 'Z') !== s.replace('.000Z', 'Z'))
    throw Error('Expected exact UTC timestamp'); return s; }
export function list<T>(v: unknown, max: number, parse: (x: unknown) => T): T[] { if (!Array.isArray(v) || v.length > max)
    throw Error('Evidence list exceeds bounded size'); return v.map(parse); }
export function choice<T extends string>(v: unknown, options: readonly T[]): T { if (!options.includes(v as T))
    throw Error('Unsupported evidence choice'); return v as T; }
export function span(v: unknown): Span { const x = object(v), startUtc = utc(x.startUtc), endUtc = utc(x.endUtc); if (Date.parse(endUtc) <= Date.parse(startUtc) || Date.parse(endUtc) - Date.parse(startUtc) > 31 * 86400000)
    throw Error('Invalid or oversized UTC interval'); return { startUtc, endUtc }; }
export function ordered<T extends Span>(v: T[]): T[] { for (let i = 1; i < v.length; i++)
    if (Date.parse(v[i].startUtc) < Date.parse(v[i - 1].endUtc))
        throw Error('Evidence intervals must be sorted and non-overlapping'); return v; }
export function provenance(v: unknown): Provenance { const p = object(v); return { title: text(p.title, 300), sourceUrl: text(p.sourceUrl, 2000), author: text(p.author, 300), issuedUtc: utc(p.issuedUtc), kind: choice(p.kind, ['reference', 'user-assumption', 'observation', 'forecast']), notes: text(p.notes) }; }
