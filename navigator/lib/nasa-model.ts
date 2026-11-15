import { publicAssetURL } from "./public-assets";
export type NasaMesh = {
  /** Original, unitless NASA GLB positions. Multiply by positionToKm for the scene. */
  positions: Float32Array;
  indices: Uint32Array;
  radiusNormalizationDivisor: number;
  referenceRadiusKm: number;
  positionToKm: number;
};

export type NasaModelMetadata = {
  version: number;
  source: { title: string; credit: string; page: string; url: string; sha256: string; bytes: number; generator: string };
  mesh: { url: string; sha256: string; bytes: number; decodedSha256: string; decodedBytes: number; format: string; originalVertexCount: number; vertexCount: number; indexCount: number; triangleCount: number; weld: string };
  texture: { url: string; sha256: string; bytes: number; width: number; height: number; mimeType: string; extraction: string; uv: string };
  coordinates: {
    longitude: string;
    axes: { primeMeridian: "+X"; north: "+Y"; east90: "-Z" };
    latLonToXyz: string;
    moonFixedToNasa: string;
    sourceHasNodeTransform: boolean;
    evidence: {
      method: string;
      samples: { originalVertex: number; weldedVertex: number; uv: [number, number]; position: [number, number, number] }[];
      maxAngularErrorDeg: number;
      rmsAngularErrorDeg: number;
      caveat: string;
    };
  };
  scale: {
    positionUnits: string;
    radiusNormalizationDivisor: number;
    normalizationMethod: string;
    referenceRadiusKm: number;
    positionToKm: number;
    sourceRadiusMin: number;
    sourceRadiusMax: number;
    normalizedRadiusMin: number;
    normalizedRadiusMax: number;
    visualizationRadiusMinKm: number;
    visualizationRadiusMaxKm: number;
    caveat: string;
  };
  limitations: string[];
};

export type EncodedNasaModel = {
  metadata: NasaModelMetadata;
  /** Base64 of the committed .bin.gz file, not of the decoded mesh. */
  meshGzipBase64: string;
  /** data:image/jpeg;base64,... of the unchanged NASA JPEG. */
  textureDataUrl: string;
};

declare global {
  interface Window {
    __SOLARREACH_NASA_MODEL__?: EncodedNasaModel;
  }
}

/** NASAMOON v1: 48-byte LE header, then packed Float32 XYZ and Uint32 triangles. */
export function decodeNasaMesh(buffer: ArrayBuffer): NasaMesh {
  if (buffer.byteLength < 48) throw new Error("NASA mesh header is truncated");
  const view = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 8)) !== "NASAMOON")
    throw new Error("Invalid NASA mesh magic");
  if (view.getUint32(8, true) !== 1 || view.getUint32(12, true) !== 48)
    throw new Error("Unsupported NASA mesh version or header size");
  if (view.getUint32(40, true) !== 0 || view.getUint32(44, true) !== 0)
    throw new Error("Invalid NASA mesh reserved header fields");
  const vertices = view.getUint32(16, true), count = view.getUint32(20, true);
  const radiusNormalizationDivisor = view.getFloat64(24, true);
  const referenceRadiusKm = view.getFloat64(32, true);
  const positionToKm = referenceRadiusKm / radiusNormalizationDivisor;
  if (!vertices || !count || count % 3 !== 0)
    throw new Error("Invalid NASA mesh vertex or triangle count");
  if (![radiusNormalizationDivisor, referenceRadiusKm, positionToKm].every((x) => Number.isFinite(x) && x > 0))
    throw new Error("Invalid NASA mesh radius scale");
  if (buffer.byteLength !== 48 + vertices * 12 + count * 4)
    throw new Error("NASA mesh byte length does not match its counts");
  // Read explicitly little-endian; this also works on a big-endian JS host.
  const positions = new Float32Array(vertices * 3);
  for (let i = 0; i < positions.length; i++) {
    const x = view.getFloat32(48 + i * 4, true);
    if (!Number.isFinite(x)) throw new Error("NASA mesh contains a non-finite position");
    positions[i] = x;
  }
  for (let i = 0; i < positions.length; i += 3)
    if (Math.hypot(positions[i], positions[i + 1], positions[i + 2]) === 0)
      throw new Error("NASA mesh contains a zero-radius position");
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const index = view.getUint32(48 + vertices * 12 + i * 4, true);
    if (index >= vertices) throw new Error("NASA mesh index is outside its vertex array");
    indices[i] = index;
  }
  return { positions, indices, radiusNormalizationDivisor, referenceRadiusKm, positionToKm };
}

/** Degrees north/east, radius in caller-selected units; source NASA axes, no rotation guessed. */
export function nasaLatLonToXyz(lat: number, lon: number, radius = 1): [number, number, number] {
  if (![lat, lon, radius].every(Number.isFinite) || Math.abs(lat) > 90 || radius < 0)
    throw new Error("NASA coordinates require finite latitude, longitude and a nonnegative radius");
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  return [radius * Math.cos(p) * Math.cos(l), radius * Math.sin(p), -radius * Math.cos(p) * Math.sin(l)];
}

/** Dot with these NASA-axis unit vectors to obtain local east/up/north components.
 * E/U/N is left-handed: reverse triangle winding if baking this reflection into vertices.
 */
export function nasaSiteFrame(lat: number, lon: number) {
  const up = nasaLatLonToXyz(lat, lon);
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  const east: [number, number, number] = [-Math.sin(l), 0, -Math.cos(l)];
  const north: [number, number, number] = [-Math.sin(p) * Math.cos(l), Math.cos(p), Math.sin(p) * Math.sin(l)];
  return { east, up, north };
}

export async function loadNasaModel(options: { signal?: AbortSignal } = {}): Promise<NasaMesh & { metadata: NasaModelMetadata; textureUrl: string }> {
  const embedded = typeof window !== "undefined" ? window.__SOLARREACH_NASA_MODEL__ : undefined;
  if (typeof DecompressionStream === "undefined")
    throw new Error("NASA Moon model requires gzip DecompressionStream support in this browser");
  const metadata: NasaModelMetadata = embedded?.metadata ?? await (await checkedFetch("/data/nasa-model.json", options.signal)).json();
  if (!metadata || metadata.version !== 1 || metadata.mesh?.url !== "/data/nasa-moon-mesh.bin.gz" || metadata.texture?.url !== "/data/imagery/nasa-moon-8k.jpg")
    throw new Error("Unsupported NASA Moon model metadata");
  let compressed: ArrayBuffer;
  let textureUrl = metadata.texture.url;
  if (embedded) {
    if (!embedded.textureDataUrl.startsWith("data:image/jpeg;base64,"))
      throw new Error("Embedded NASA Moon texture must be a JPEG data URL");
    let raw: string;
    try { raw = atob(embedded.meshGzipBase64); }
    catch (cause) { throw new Error("Embedded NASA Moon mesh is not valid base64", {cause}); }
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    compressed = bytes.buffer;
    textureUrl = embedded.textureDataUrl;
  } else {
    compressed = await (await checkedFetch(metadata.mesh.url, options.signal)).arrayBuffer();
  }
  options.signal?.throwIfAborted();
  if (compressed.byteLength !== metadata.mesh.bytes) throw new Error("NASA Moon gzip length differs from metadata");
  let decoded: ArrayBuffer;
  try {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    decoded = await new Response(stream).arrayBuffer();
  } catch (cause) {
    throw new Error("NASA Moon gzip decompression failed", { cause });
  }
  options.signal?.throwIfAborted();
  const mesh = decodeNasaMesh(decoded);
  if (decoded.byteLength !== metadata.mesh.decodedBytes || mesh.positions.length / 3 !== metadata.mesh.vertexCount || mesh.indices.length !== metadata.mesh.indexCount || mesh.radiusNormalizationDivisor !== metadata.scale?.radiusNormalizationDivisor || mesh.referenceRadiusKm !== metadata.scale?.referenceRadiusKm || mesh.positionToKm !== metadata.scale?.positionToKm)
    throw new Error("NASA Moon binary and metadata disagree");
  return { ...mesh, metadata, textureUrl };
}

async function checkedFetch(url: string, signal?: AbortSignal) {
  const response = await fetch(publicAssetURL(url), { signal });
  if (!response.ok) throw new Error(`NASA Moon asset ${url} could not be loaded: HTTP ${response.status}`);
  return response;
}
