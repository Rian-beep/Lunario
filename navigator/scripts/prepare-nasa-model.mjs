import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const sourcePage = "https://svs.gsfc.nasa.gov/14959/";
const sourceUrl = "https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb";
const sourceSha256 = "c4b65fb4df622a37fd75366c2ed9bf9e163e41c0fde178b3b27e31b0173e6953";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const { values } = parseArgs({ options: {
  input: { type: "string" },
  "output-dir": { type: "string", default: fileURLToPath(new URL("../public/data/", import.meta.url)) },
} });
const source = values.input ? await readFile(values.input) : await download();
if (sha256(source) !== sourceSha256) throw new Error("NASA GLB SHA256 changed; inspect the new source before updating this pipeline.");
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2 || source.readUInt32LE(8) !== source.length)
  throw new Error("Invalid GLB header");
const jsonLength = source.readUInt32LE(12);
if (source.readUInt32LE(16) !== 0x4e4f534a) throw new Error("Missing GLB JSON chunk");
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString("utf8"));
const binStart = 28 + jsonLength;
if (source.readUInt32LE(binStart - 4) !== 0x004e4942 || binStart + source.readUInt32LE(binStart - 8) !== source.length)
  throw new Error("Invalid GLB BIN chunk");
const node = gltf.nodes[0];
if (gltf.nodes.length !== 1 || node.mesh !== 0 || node.matrix || node.translation || node.rotation || node.scale || gltf.meshes.length !== 1 || gltf.meshes[0].primitives.length !== 1)
  throw new Error("Source scene changed: inspect transforms and primitives");
const primitive = gltf.meshes[0].primitives[0];
if ((primitive.mode ?? 4) !== 4) throw new Error("Expected triangles");
function accessor(index, type, componentType, components) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const length = a.count * components * 4;
  if (a.type !== type || a.componentType !== componentType || a.sparse || a.normalized || v.byteStride || v.buffer !== 0 || offset + length > (v.byteOffset ?? 0) + v.byteLength)
    throw new Error("Unsupported NASA accessor layout");
  return { count: a.count, bytes: source.subarray(binStart + offset, binStart + offset + length), accessor: index, bufferView: a.bufferView, offset };
}
const position = accessor(primitive.attributes.POSITION, "VEC3", 5126, 3);
const uv = accessor(primitive.attributes.TEXCOORD_0, "VEC2", 5126, 2);
const index = accessor(primitive.indices, "SCALAR", 5125, 1);
if (position.count !== 2021340 || uv.count !== position.count || index.count !== 3047424)
  throw new Error("Unexpected NASA geometry counts");
const readPosition = (i) => [0, 1, 2].map((c) => position.bytes.readFloatLE(i * 12 + c * 4));
const remap = new Uint32Array(position.count);
const unique = new Map();
const positions = Buffer.allocUnsafe(position.bytes.length);
let vertexCount = 0, radiusMin = Infinity, radiusMax = 0, maxUvErrorDeg = 0, sumUvError2 = 0;
const targets = [[0.5, 0.5], [0, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0], [0.5, 1]];
const samples = targets.map(() => ({ distance: Infinity }));
for (let i = 0; i < position.count; i++) {
  // Bit-identical Float32 triples only: no epsilon weld, quantization, smoothing or decimation.
  const key = `${position.bytes.readUInt32LE(i * 12)},${position.bytes.readUInt32LE(i * 12 + 4)},${position.bytes.readUInt32LE(i * 12 + 8)}`;
  let welded = unique.get(key);
  if (welded === undefined) {
    welded = vertexCount++;
    unique.set(key, welded);
    position.bytes.copy(positions, welded * 12, i * 12, i * 12 + 12);
  }
  remap[i] = welded;
  const p = readPosition(i), r = Math.hypot(...p);
  if (!p.every(Number.isFinite) || r <= 0) throw new Error("Invalid source position");
  radiusMin = Math.min(radiusMin, r); radiusMax = Math.max(radiusMax, r);
  const u = uv.bytes.readFloatLE(i * 8), v = uv.bytes.readFloatLE(i * 8 + 4);
  const lon = (u - 0.5) * 2 * Math.PI, lat = (0.5 - v) * Math.PI;
  const expected = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
  const actual = p.map((x) => x / r);
  const cross = [expected[1] * actual[2] - expected[2] * actual[1], expected[2] * actual[0] - expected[0] * actual[2], expected[0] * actual[1] - expected[1] * actual[0]];
  const error = Math.atan2(Math.hypot(...cross), expected.reduce((s, x, c) => s + x * actual[c], 0)) * 180 / Math.PI;
  maxUvErrorDeg = Math.max(maxUvErrorDeg, error); sumUvError2 += error * error;
  targets.forEach(([tu, tv], t) => {
    const distance = Math.hypot(u - tu, v - tv);
    if (distance < samples[t].distance) samples[t] = { distance, originalVertex: i, weldedVertex: welded, uv: [u, v], position: p };
  });
}
if (maxUvErrorDeg > 1.56) throw new Error("NASA axis/UV agreement changed");
const indices = Buffer.allocUnsafe(index.bytes.length);
let areaSum = 0, radiusAreaSum = 0;
for (let i = 0; i < index.count; i += 3) {
  const ids = [0, 1, 2].map((c) => index.bytes.readUInt32LE((i + c) * 4));
  if (ids.some((id) => id >= position.count)) throw new Error("Source index out of range");
  ids.forEach((id, c) => indices.writeUInt32LE(remap[id], (i + c) * 4));
  const [a, b, c] = ids.map(readPosition);
  const ab = b.map((x, j) => x - a[j]), ac = c.map((x, j) => x - a[j]);
  const area = Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]) / 2;
  areaSum += area; radiusAreaSum += area * (Math.hypot(...a) + Math.hypot(...b) + Math.hypot(...c)) / 3;
}
// Define the visualization's nominal radius without changing any source position bits.
// Source GLB has no documented conversion to physical terrain elevations.
const radiusNormalizationDivisor = radiusAreaSum / areaSum;
const referenceRadiusKm = 1737.4;
const header = Buffer.alloc(48);
header.write("NASAMOON"); header.writeUInt32LE(1, 8); header.writeUInt32LE(48, 12);
header.writeUInt32LE(vertexCount, 16); header.writeUInt32LE(index.count, 20);
header.writeDoubleLE(radiusNormalizationDivisor, 24); header.writeDoubleLE(referenceRadiusKm, 32);
const binary = Buffer.concat([header, positions.subarray(0, vertexCount * 12), indices]);
const gzip = gzipSync(binary, { level: 9 });
const image = gltf.images[gltf.textures[gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture.index].source];
const imageView = gltf.bufferViews[image.bufferView];
if (image.mimeType !== "image/jpeg" || imageView.buffer !== 0) throw new Error("Expected embedded JPEG");
const jpeg = source.subarray(binStart + imageView.byteOffset, binStart + imageView.byteOffset + imageView.byteLength);
function jpegDimensions(bytes) {
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error("Invalid JPEG");
  for (let i = 2; i < bytes.length;) {
    if (bytes[i++] !== 0xff) throw new Error("Invalid JPEG marker");
    while (bytes[i] === 0xff) i++;
    const marker = bytes[i++], length = bytes.readUInt16BE(i);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(i + 5), height: bytes.readUInt16BE(i + 3) };
    i += length;
  }
  throw new Error("JPEG dimensions missing");
}
const metadata = {
  version: 1,
  source: { title: "Moon 3D Models for Web, AR, and Animation — color map and height map", credit: "NASA's Goddard Space Flight Center", page: sourcePage, url: sourceUrl, sha256: sourceSha256, bytes: source.length, generator: gltf.asset.generator },
  mesh: { url: "/data/nasa-moon-mesh.bin.gz", sha256: sha256(gzip), bytes: gzip.length, decodedSha256: sha256(binary), decodedBytes: binary.length, format: "NASAMOON v1; little-endian; 48-byte header, Float32 XYZ, Uint32 triangle indices", originalVertexCount: position.count, vertexCount, indexCount: index.count, triangleCount: index.count / 3, weld: "Bit-identical Float32 XYZ only, first occurrence retained. Original triangle order and winding retained. No topography generated, no simplification.", positionAccessor: position, indexAccessor: index },
  texture: { url: "/data/imagery/nasa-moon-8k.jpg", sha256: sha256(jpeg), bytes: jpeg.length, ...jpegDimensions(jpeg), mimeType: image.mimeType, extraction: "Embedded JPEG copied byte-for-byte, no re-encoding", uv: "u = 0.5 + atan2(-z,x)/(2*pi); vTop = 0.5 - atan2(y,hypot(x,z))/pi. JPEG top row is north. Shader sampling must handle longitude wrap per fragment." },
  coordinates: { longitude: "Degrees east; prime meridian at texture center (NASA CGI Moon Kit https://svs.gsfc.nasa.gov/4720/)", axes: { primeMeridian: "+X", north: "+Y", east90: "-Z" }, latLonToXyz: "r * [cos(lat)*cos(lon), sin(lat), -cos(lat)*sin(lon)]", moonFixedToNasa: "[X,Y,Z] -> [X,Z,-Y] (right-handed)", sourceHasNodeTransform: false, evidence: { method: "Original TEXCOORD_0 interpreted as equirectangular u=(lon+180)/360, vTop=(90-lat)/180; compared against POSITION directions at every source vertex", samples: samples.map((s) => ({ originalVertex: s.originalVertex, weldedVertex: s.weldedVertex, uv: s.uv, position: s.position })), maxAngularErrorDeg: maxUvErrorDeg, rmsAngularErrorDeg: Math.sqrt(sumUvError2 / position.count), caveat: "Axis convention is verified, but the original deformed mesh/UVs do not coincide exactly with a mathematical sphere, especially near pinched poles. Derived direction UVs intentionally discard source seam duplication." } },
  scale: { positionUnits: "Original NASA GLB unitless Float32 positions, unchanged", radiusNormalizationDivisor, normalizationMethod: "Triangle-area-weighted mean of vertex radii over all original triangles; computed in Float64", referenceRadiusKm, positionToKm: referenceRadiusKm / radiusNormalizationDivisor, sourceRadiusMin: radiusMin, sourceRadiusMax: radiusMax, normalizedRadiusMin: radiusMin / radiusNormalizationDivisor, normalizedRadiusMax: radiusMax / radiusNormalizationDivisor, visualizationRadiusMinKm: radiusMin * referenceRadiusKm / radiusNormalizationDivisor, visualizationRadiusMaxKm: radiusMax * referenceRadiusKm / radiusNormalizationDivisor, caveat: "1737.4 km is the nominal lunar reference radius, not a recovered metric calibration of this artistic GLB. Its relief amplitude is preserved as supplied; mesh radii must not be interpreted as scientific heights." },
  limitations: ["Visualization only. Scientific illumination, line-of-sight, terrain, contact, and landing computations must continue to use Horizons and local LOLA numerical terrain.", "NASA documents pinched-pole mesh artifacts. Use local LOLA for ground rendering near a landing site, not this global mesh.", "NASA CGI Moon Kit color maps are optimized for aesthetics rather than science; polar color includes lower-resolution LOLA albedo."],
};
// Accessor provenance, not the megabytes of source Buffer data.
for (const a of [metadata.mesh.positionAccessor, metadata.mesh.indexAccessor]) delete a.bytes;
const out = resolve(values["output-dir"]);
await mkdir(resolve(out, "imagery"), { recursive: true });
await writeFile(resolve(out, "nasa-moon-mesh.bin.gz"), gzip);
await writeFile(resolve(out, "imagery/nasa-moon-8k.jpg"), jpeg);
await writeFile(resolve(out, "nasa-model.json"), JSON.stringify(metadata, null, 2) + "\n");
console.log(JSON.stringify({ vertexCount, triangleCount: index.count / 3, gzipBytes: gzip.length, textureBytes: jpeg.length, radiusNormalizationDivisor, maxUvErrorDeg, output: out }, null, 2));

async function download() {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`NASA GLB download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
