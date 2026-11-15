import sourceData from "../../public/data/ice/sources.json";

export type IceEvidence = "surface-ice-detection" | "ice-bearing-psr" | "impact-water-detection";

export type IceFeature = {
  id: string;
  name: string;
  geometry: { type: "Point"; coordinates: [number, number] } | { type: "Polygon"; coordinates: number[][][] };
  evidence: IceEvidence;
  sourceId: string;
  description: string;
  resolutionM: number | null;
  observationUtc: string | null;
  value: number | null;
  unit: string | null;
};

export type IceSource = {
  id: string;
  title: string;
  publicationUrl: string;
  datasetUrl: string;
  version: string;
  evidence: IceEvidence;
  license: string;
  licenseUrl: string;
  credit: string;
  frame: string;
  projection: string;
  originals: { url: string; sha256: string; bytes: number }[];
  processingNotes: string[];
};

export type IceCatalog = { schemaVersion: 1; features: IceFeature[] };

export const ICE_DATA_URL = "/data/ice/catalog.json";

function record(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${where}: expected object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${where}: expected nonempty text`);
  return value;
}

function evidence(value: unknown): IceEvidence {
  if (value !== "surface-ice-detection" && value !== "ice-bearing-psr" && value !== "impact-water-detection") {
    throw new Error("Unknown ice evidence method");
  }
  return value;
}

function finite(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${where}: expected finite number`);
  return value;
}

function https(value: unknown): string {
  const url = text(value, "source URL");
  if (new URL(url).protocol !== "https:") throw new Error("Source URL must use HTTPS");
  return url;
}

function parseSources(input: unknown): IceSource[] {
  if (!Array.isArray(input)) throw new Error("Expected ice sources array");
  const ids = new Set<string>();
  return input.map((item) => {
    const row = record(item, "source");
    const id = text(row.id, "source ID");
    if (ids.has(id)) throw new Error(`Duplicate ice source: ${id}`);
    ids.add(id);
    if (!Array.isArray(row.originals) || !row.originals.length || !Array.isArray(row.processingNotes) || !row.processingNotes.length) {
      throw new Error("Source needs original hashes and processing notes");
    }
    return {
      id, title: text(row.title, id), publicationUrl: https(row.publicationUrl), datasetUrl: https(row.datasetUrl),
      version: text(row.version, id), evidence: evidence(row.evidence), license: text(row.license, id),
      licenseUrl: https(row.licenseUrl), credit: text(row.credit, id), frame: text(row.frame, id),
      projection: text(row.projection, id), processingNotes: row.processingNotes.map((note) => text(note, id)),
      originals: row.originals.map((item) => {
        const original = record(item, "original source");
        const sha256 = text(original.sha256, "SHA256");
        const bytes = finite(original.bytes, "original bytes");
        if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0) throw new Error("Invalid source hash/size");
        return { url: https(original.url), sha256, bytes };
      }),
    };
  });
}

export const ICE_SOURCES: readonly Readonly<IceSource>[] = Object.freeze(parseSources(sourceData).map((source) => {
  source.originals.forEach(Object.freeze);
  Object.freeze(source.originals);
  Object.freeze(source.processingNotes);
  return Object.freeze(source);
}));

function coordinate(input: unknown): [number, number] {
  if (!Array.isArray(input) || input.length !== 2) throw new Error("Expected [east longitude, latitude]");
  const lon = finite(input[0], "longitude"), lat = finite(input[1], "latitude");
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error("Ice coordinate outside geographic range");
  return [lon, lat];
}

function geometry(input: unknown): IceFeature["geometry"] {
  const row = record(input, "geometry");
  if (row.type === "Point") return { type: "Point", coordinates: coordinate(row.coordinates) };
  if (row.type !== "Polygon" || !Array.isArray(row.coordinates) || !row.coordinates.length) {
    throw new Error("Expected Point or Polygon geometry");
  }
  const coordinates = row.coordinates.map((ring: unknown) => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error("Polygon ring needs at least four positions");
    const positions = ring.map(coordinate);
    const first = positions[0], last = positions[positions.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1] || new Set(positions.map((p) => `${p[0]},${p[1]}`)).size < 3) {
      throw new Error("Polygon ring must close and have three distinct vertices");
    }
    return positions;
  });
  return { type: "Polygon", coordinates };
}

function utc(value: unknown): string | null {
  if (value === null) return null;
  const time = text(value, "observation UTC");
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(time);
  if (!match || !Number.isFinite(Date.parse(time)) || new Date(time).toISOString() !== `${match[1]}.${(match[2] ?? "0").padEnd(3, "0")}Z`) {
    throw new Error("Invalid observation UTC");
  }
  return time;
}

/** Accept decoded JSON or a JSON string; no I/O, coordinate projection, filling or interpolation. */
export function parseIceCatalog(input: unknown): IceCatalog {
  const data = record(typeof input === "string" ? JSON.parse(input) : input, "ice catalogue");
  if (data.schemaVersion !== 1 || !Array.isArray(data.features)) throw new Error("Unsupported ice catalogue schema");
  const ids = new Set<string>();
  const features = data.features.map((item): IceFeature => {
    const row = record(item, "ice feature");
    const id = text(row.id, "feature ID"), sourceId = text(row.sourceId, "source ID");
    if (ids.has(id)) throw new Error(`Duplicate ice feature: ${id}`);
    ids.add(id);
    const method = evidence(row.evidence);
    const source = ICE_SOURCES.find((entry) => entry.id === sourceId);
    if (!source || source.evidence !== method) throw new Error(`Unknown or mismatched evidence source: ${sourceId}`);
    const shape = geometry(row.geometry);
    const resolutionM = row.resolutionM === null ? null : finite(row.resolutionM, "resolutionM");
    if (resolutionM !== null && resolutionM <= 0) throw new Error("Resolution must be positive or null");
    const value = row.value === null ? null : finite(row.value, "value");
    const unit = row.unit === null ? null : text(row.unit, "unit");
    if ((value === null) !== (unit === null)) throw new Error("Value and unit must both be known or both null");
    // This source supplies regional positive-detection counts, never concentrations or pixel locations.
    if (sourceId === "lemelin-2021-m3-psrs" && (
      shape.type !== "Point" || shape.coordinates[1] > -75 || resolutionM !== 280 ||
      value === null || !Number.isInteger(value) || value < 1 || value > 134 || unit !== "M3 detections" || row.observationUtc !== null
    )) throw new Error("Invalid published M3 PSR evidence fields");
    if (sourceId === "lcross-2009-centaur" && (
      shape.type !== "Point" || resolutionM !== null || value !== null || unit !== null
    )) throw new Error("LCROSS evidence must remain a location with no inferred extent or quantity");
    return {
      id, name: text(row.name, "feature name"), geometry: shape, evidence: method, sourceId,
      description: text(row.description, "feature description"), resolutionM, observationUtc: utc(row.observationUtc), value, unit,
    };
  });
  return { schemaVersion: 1, features };
}

/** Connected-mode convenience only. Offline consumers import/embed the JSON and call parseIceCatalog. */
export async function loadIceCatalog(options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<IceCatalog> {
  const response = await (options.fetcher ?? fetch)(ICE_DATA_URL, { signal: options.signal });
  if (!response.ok) throw new Error(`Ice catalogue load failed (HTTP ${response.status})`);
  return parseIceCatalog(await response.json());
}
