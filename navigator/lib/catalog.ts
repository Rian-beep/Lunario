import type {GlobalTerrainData} from "./global-terrain";
export type SiteGroup = "artemis" | "clps" | "contrast" | "reference" | "derived" | "apollo" | "robotic" | "attempt";

export type HorizonMask = {
  heightM: number;
  stepDeg: number;
  mask: Float64Array;
};

export type Site = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  group: SiteGroup;
  summary: string;
  source: string;
  sourceUrl: string;
  demHeightM: number | null;
  slopeDeg: number | null;
  horizons: HorizonMask[];
  mission?: {program:string;date:string;outcome:"landed"|"partial"|"attempt";approximate:boolean;coordinateKind?:"observed"|"approximate-region"|"planned-target";frame?:string;accuracy?:string;sourceNotes?:string;supportingSourceUrls?:string[]};
};

export type MapMeta = {
  width: number;
  height: number;
  tieX: number;
  tieY: number;
  scaleM: number;
  centerOffset: number;
  url: string;
};

export type Catalog = {
  globalTerrain?:GlobalTerrainData;
  meta: {
    title: string;
    generatedUtc: string;
    t0: string;
    t1: string;
    stepHours: number;
    n: number;
    moonRadiusM: number;
    earthRadiusKm: number;
    sunRadiusKm: number;
    observerHeightsM: number[];
    defaultHeightM: number;
    frame: string;
    ephemeris: string;
    demFine: string;
    demCoarse: string;
    demCitation: string;
    centerOffset: number;
    validation: {
      samples: number;
      maxAbsSunElevationDeg: number;
      maxAbsSunAzimuthDeg: number;
      maxAbsEarthElevationDeg: number;
      maxAbsEarthAzimuthDeg: number;
      odysseusLolaHeightM: number | null;
      odysseusNasaHeightM: number;
    };
    demo: { start: string; hours: number; siteId: string; reason: string };
    gridNote: string;
    samplingNote: string;
  };
  t0ms: number;
  subsolarLat: Float64Array;
  subsolarLon: Float64Array;
  subearthLat: Float64Array;
  subearthLon: Float64Array;
  earthRangeKm: Float64Array;
  sunRadiusDeg: Float64Array;
  map: MapMeta;
  sites: Site[];
  grid: {
    heightM: number;
    stepDeg: number;
    lat: Float64Array;
    lon: Float64Array;
    mask: Float64Array;
    nAz: number;
  };
};

type RawCatalog = {
  meta: Catalog["meta"];
  subsolarLat: string;
  subsolarLon: string;
  subearthLat: string;
  subearthLon: string;
  earthRangeKm: string;
  sunDiamArcsec: string;
  map: MapMeta;
  sites: Array<Omit<Site, "horizons"> & { horizons: { heightM: number; stepDeg: number; mask: string }[] }>;
  grid: { heightM: number; stepDeg: number; lat: string; lon: string; mask: string; nAz: number };
};

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeI16Centideg(b64: string): Float64Array {
  const u8 = bytesFromBase64(b64);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = u8.byteLength / 2;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = view.getInt16(i * 2, true);
    out[i] = v <= -32000 ? Number.NaN : v / 100;
  }
  return out;
}

function decodeU16(b64: string, divisor: number): Float64Array {
  const u8 = bytesFromBase64(b64);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = u8.byteLength / 2;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getUint16(i * 2, true) / divisor;
  return out;
}

function decodeF32(b64: string): Float64Array {
  const u8 = bytesFromBase64(b64);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = u8.byteLength / 4;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

export function decodeCatalog(raw: RawCatalog): Catalog {
  const sunDiam = decodeU16(raw.sunDiamArcsec, 1);
  const sunRadiusDeg = new Float64Array(sunDiam.length);
  for (let i = 0; i < sunDiam.length; i++) sunRadiusDeg[i] = sunDiam[i] / 3600 / 2;
  return {
    meta: raw.meta,
    t0ms: Date.parse(raw.meta.t0),
    subsolarLat: decodeI16Centideg(raw.subsolarLat),
    subsolarLon: decodeU16(raw.subsolarLon, 100),
    subearthLat: decodeI16Centideg(raw.subearthLat),
    subearthLon: decodeU16(raw.subearthLon, 100),
    earthRangeKm: decodeF32(raw.earthRangeKm),
    sunRadiusDeg,
    map: raw.map,
    sites: raw.sites.map((site) => ({
      ...site,
      horizons: site.horizons.map((h) => ({
        heightM: h.heightM,
        stepDeg: h.stepDeg,
        mask: decodeI16Centideg(h.mask),
      })),
    })),
    grid: {
      heightM: raw.grid.heightM,
      stepDeg: raw.grid.stepDeg,
      lat: decodeI16Centideg(raw.grid.lat),
      lon: decodeU16(raw.grid.lon, 100),
      mask: decodeI16Centideg(raw.grid.mask),
      nAz: raw.grid.nAz,
    },
  };
}

export async function loadCatalog(): Promise<Catalog> {
  const injected = (globalThis as { __SOLARREACH_CATALOG__?: RawCatalog }).__SOLARREACH_CATALOG__;
  if (injected) return decodeCatalog(injected);
  const response = await fetch("/data/catalog.json");
  if (!response.ok) {
    throw new Error("The precomputed catalog is not available. Run python3 pipeline/build_dataset.py.");
  }
  return decodeCatalog((await response.json()) as RawCatalog);
}

export const GROUP_LABEL: Record<SiteGroup, string> = {
  artemis: "Published polar study site",
  clps: "CLPS landing",
  contrast: "Shadowed contrast",
  reference: "Reference point",
  derived: "LOLA crest sample",
  apollo: "Apollo crewed landing",
  robotic: "Robotic landing",
  attempt: "Landing attempt",
};

export const SITE_COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#6B4C9A", "#0072B2", "#1c1915", "#8a5600", "#0b6ea8"];
