import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const root = new URL("../public/data/celestial-models/", import.meta.url);
const provenance = JSON.parse(await readFile(new URL("provenance.json", root), "utf8"));
const limit = 20_000_000;
for (const asset of provenance.assets) {
  if (!["sun", "earth"].includes(asset.kind) || !asset.sourceDownload.startsWith("https://assets.science.nasa.gov/")) throw new Error("Unexpected asset source");
  const controller = new AbortController();
  const response = await fetch(asset.sourceDownload, { signal: controller.signal });
  if (!response.ok || !response.body) throw new Error(`NASA ${asset.kind} download failed: ${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > limit) { controller.abort(); throw new Error(`${asset.kind} exceeds the 20 MB acquisition bound`); }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks), sha256 = createHash("sha256").update(bytes).digest("hex");
  if (size !== asset.bytes || sha256 !== asset.sha256) throw new Error(`Pinned NASA ${asset.kind} byte count/hash mismatch`);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== size) throw new Error("Invalid GLB container");
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
  if ([...(gltf.buffers ?? []), ...(gltf.images ?? [])].some((record) => record.uri)) throw new Error("Expected a self-contained NASA GLB");
  await mkdir(new URL("assets/", root), { recursive: true });
  await writeFile(new URL(`assets/${asset.kind}.glb`, root), bytes);
  console.log(JSON.stringify({ kind: asset.kind, source: asset.sourceDownload, bytes: size, sha256, images: gltf.images?.length ?? 0, conversion: "none" }));
}
