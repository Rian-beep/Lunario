import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const root = new URL("../", import.meta.url),
  out = new URL("public/data/imagery/", root);
await fs.mkdir(out, { recursive: true });
const cache = path.join(os.tmpdir(), "solarreach-nasa-imagery-v1");
await fs.mkdir(cache, { recursive: true });
const catalog = JSON.parse(
  await fs.readFile(new URL("public/data/catalog.json", root), "utf8"),
);
const endpoints = {
  polar: "https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02",
  global:
    "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02",
};
async function tile(kind, z, row, col) {
  const name = `${kind}-${z}-${row}-${col}`,
    file = path.join(cache, name);
  try {
    return await fs.readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const url = `${endpoints[kind]}/1.0.0/default/default028mm/${z}/${row}/${col}.${kind === "global" ? "jpg" : "png"}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  await fs.writeFile(file, bytes);
  return bytes;
}
async function mapBounded(items, fn) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < items.length) {
        const i = next++;
        result[i] = await fn(items[i]);
      }
    }),
  );
  return result;
}
async function polar(id, bbox, z) {
  const span = 2191860 / 2 ** z,
    mpp = span / 256,
    origin = 1095930,
    c0 = Math.floor((bbox[0] + origin) / span),
    c1 = Math.floor((bbox[2] + origin) / span),
    r0 = Math.floor((origin - bbox[3]) / span),
    r1 = Math.floor((origin - bbox[1]) / span);
  const jobs = [];
  for (let row = r0; row <= r1; row++)
    for (let col = c0; col <= c1; col++) jobs.push({ row, col });
  const composites = await mapBounded(jobs, async ({ row, col }) => ({
    input: await tile("polar", z, row, col),
    left: (col - c0) * 256,
    top: (row - r0) * 256,
  }));
  const width = (c1 - c0 + 1) * 256,
    height = (r1 - r0 + 1) * 256;
  await sharp({ create: { width, height, channels: 4, background: "#888881" } })
    .composite(composites)
    .flatten({ background: "#888881" })
    .jpeg({ quality: 88 })
    .toFile(fileURLToPath(new URL(`${id}.jpg`, out)));
  console.log(id, width, height);
  return {
    id,
    url: `/data/imagery/${id}.jpg`,
    width,
    height,
    x0: -origin + c0 * span,
    y0: origin - r0 * span,
    stepM: mpp,
    sourcePixelM: 100,
  };
}
async function exportPatch(id, bbox) {
  const response = await fetch(
    "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_SPole60_100m_v02/ImageServer/exportImage?" +
      new URLSearchParams({
        bbox: bbox.join(","),
        size: "1024,1024",
        format: "jpg",
        f: "image",
      }),
  );
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error("Direct image export failed: " + response.status);
  await fs.writeFile(
    new URL(`${id}.jpg`, out),
    Buffer.from(await response.arrayBuffer()),
  );
  const meta = {
    width: 1024,
    height: 1024,
    extent: { xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3] },
  };
  console.log(id, "NASA ImageServer", meta.width, meta.height);
  return {
    id,
    url: `/data/imagery/${id}.jpg`,
    width: meta.width,
    height: meta.height,
    x0: meta.extent.xmin,
    y0: meta.extent.ymax,
    stepM: (meta.extent.xmax - meta.extent.xmin) / meta.width,
    sourcePixelM: 100,
  };
}
const overview = await polar("polar", [-304000, -304000, 304000, 304000], 5),
  patches = [];
for (const s of catalog.sites) {
  const rho = 2 * 1737400 * Math.tan(Math.PI / 4 + (s.lat * Math.PI) / 360),
    l = (s.lon * Math.PI) / 180,
    x = rho * Math.sin(l),
    y = rho * Math.cos(l);
  patches.push(
    await exportPatch(s.id, [x - 20000, y - 20000, x + 20000, y + 20000]),
  );
}
const jobs = [];
for (let row = 0; row < 4; row++)
  for (let col = 0; col < 8; col++) jobs.push({ row, col });
const composites = await mapBounded(jobs, async ({ row, col }) => ({
  input: await tile("global", 2, row, col),
  left: col * 256,
  top: row * 256,
}));
await sharp({
  create: { width: 2048, height: 1024, channels: 3, background: "#555550" },
})
  .composite(composites)
  .jpeg({ quality: 90 })
  .toFile(fileURLToPath(new URL("global.jpg", out)));
const manifest = {
  retrievedUtc: new Date().toISOString(),
  source: "NASA Moon Trek / LROC LRO WAC",
  sourceUrl: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon",
  polarEndpoint: endpoints.polar,
  globalEndpoint: endpoints.global,
  frame:
    "South polar stereographic, Moon radius 1737400 m; global texture equirectangular lon -180..180, lat 90..-90.",
  note: "Real LROC imagery with historical acquisition lighting. It is not a date-specific illumination simulation or new numerical terrain.",
  overview,
  patches,
  global: { url: "/data/imagery/global.jpg", width: 2048, height: 1024 },
};
await fs.writeFile(
  new URL("public/data/imagery.json", root),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Wrote imagery metadata.");
