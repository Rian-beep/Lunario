import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = new URL("../", import.meta.url),
  out = new URL("public/data/imagery/", root),
  metaFile = new URL("public/data/imagery.json", root),
  manifest = JSON.parse(await fs.readFile(metaFile, "utf8")),
  catalog = JSON.parse(
    await fs.readFile(new URL("public/data/catalog.json", root), "utf8"),
  );
const cache = path.join(os.tmpdir(), "solarreach-nac-textures-v1");
await fs.mkdir(cache, { recursive: true });
const surfaceDetail = process.argv.includes("--surface");
const z = surfaceDetail ? 12 : 11,
  span = 2191860 / 2 ** z,
  stepM = span / 256,
  top = 1095930,
  endpoint = "https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_1mpp_SP";
const empty = await sharp({
  create: {
    width: 256,
    height: 256,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();
async function tile(row, col) {
  const name = path.join(cache, `${z}-${row}-${col}.png`);
  try {
    return { bytes: await fs.readFile(name), missing: false };
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const r = await fetch(
    `${endpoint}/1.0.0/default/default028mm/${z}/${row}/${col}.png`,
  );
  if (r.status === 404) return { bytes: empty, missing: true };
  if (!r.ok) throw new Error("NAC tile HTTP " + r.status);
  const bytes = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(name, bytes);
  return { bytes, missing: false };
}
async function bounded(items, fn) {
  let i = 0;
  const result = [];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < items.length) {
        const n = i++;
        result[n] = await fn(items[n]);
      }
    }),
  );
  return result;
}
const patches = [];
for (const s of catalog.sites.filter((s) => s.lat <= -85.5)) {
  const rho = 2 * 1737400 * Math.tan(Math.PI / 4 + (s.lat * Math.PI) / 360),
    l = (s.lon * Math.PI) / 180,
    x = rho * Math.sin(l),
    y = rho * Math.cos(l),
    half = surfaceDetail ? 512 : 2048,
    c0 = Math.floor((x - half + top) / span),
    c1 = Math.floor((x + half + top) / span),
    r0 = Math.floor((top - y - half) / span),
    r1 = Math.floor((top - y + half) / span),
    width = (c1 - c0 + 1) * 256,
    height = (r1 - r0 + 1) * 256,
    x0 = -top + c0 * span,
    y0 = top - r0 * span;
  const jobs = [];
  for (let row = r0; row <= r1; row++)
    for (let col = c0; col <= c1; col++) jobs.push({ row, col });
  let missing = 0;
  const overlays = await bounded(jobs, async ({ row, col }) => {
    const t = await tile(row, col);
    if (t.missing) missing++;
    return { input: t.bytes, left: (col - c0) * 256, top: (row - r0) * 256 };
  });
  if (missing === jobs.length) {
    console.log(s.id, "NAC absent; WAC remains");
    continue;
  }
  const p = new URLSearchParams({
      bbox: [x0, y0 - height * stepM, x0 + width * stepM, y0].join(","),
      size: `${width},${height}`,
      format: "jpg",
      f: "image",
    }),
    base = await fetch(
      "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_SPole60_100m_v02/ImageServer/exportImage?" +
        p,
    );
  if (!base.ok) throw new Error("WAC backing HTTP " + base.status);
  const backing = Buffer.from(await base.arrayBuffer()),
    name = `${s.id}-${surfaceDetail ? "nac-surface" : "nac"}.jpg`;
  await sharp(backing)
    .resize(width, height)
    .composite(overlays)
    .jpeg({ quality: 93 })
    .toFile(fileURLToPath(new URL(name, out)));
  patches.push({
    id: `${s.id}-${surfaceDetail ? "nac-surface" : "nac"}`,
    url: `/data/imagery/${name}`,
    width,
    height,
    x0,
    y0,
    stepM,
    sourcePixelM: 1,
    sourceEndpoint: endpoint,
    note: "NAC detail with WAC imagery behind transparent/nodata gaps. Historical acquisition lighting.",
    missingTiles: missing,
  });
  console.log(
    "Prepared NAC",
    s.id,
    width,
    height,
    "sample",
    stepM.toFixed(2),
    "m",
  );
}
if (surfaceDetail && patches.length === 0) throw new Error("No surface-detail tiles were available; manifest was not changed.");
manifest.patches = [
  ...patches,
  ...manifest.patches.filter((p) => !patches.some((next) => next.id === p.id)),
];
manifest.note = "Real LROC imagery with historical acquisition lighting, not a date-specific illumination simulation or new numerical terrain. Available NAC source pixels are 1 m: bundled site-centre surface patches sample at approximately 2.09 m/pixel, broader NAC patches at 4.18 m/pixel; WAC fills source gaps. Other locations can have only coarse global imagery. No subpixel rocks or landing hazards are inferred.";
await fs.writeFile(metaFile, JSON.stringify(manifest, null, 2) + "\n");
