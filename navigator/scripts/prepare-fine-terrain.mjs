import fs from "node:fs/promises";
import { fromUrl } from "geotiff";
import { packTerrain } from "./terrain-codec.mjs";
import {resampleRegisteredTerrain} from "./terrain-resample.mjs";
import os from "node:os";
import path from "node:path";
// NASA's static file server can close a keep-alive connection between range reads.
// Retry transport failures with a fresh connection; never accept a failed HTTP read as terrain.
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await nativeFetch(input, {
        ...options,
        headers: { ...options.headers, Connection: "close" },
      });
      if (response.status >= 500 && attempt < 2) {
        await response.arrayBuffer();
        continue;
      }
      return response;
    } catch (error) {
      last = error;
      if (attempt === 2) throw error;
    }
  }
  throw last;
};
const root = new URL("../", import.meta.url),
  terrainPath = new URL("public/data/terrain.json", root);
const data = JSON.parse(await fs.readFile(terrainPath, "utf8")),
  catalog = JSON.parse(
    await fs.readFile(new URL("public/data/catalog.json", root), "utf8"),
  );
const definitions = {
  fine5: "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif",
  fine10: "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF",
  fine40: "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ.TIF",
};
const sources = new Map();
const cache = path.join(os.tmpdir(), "solarreach-fine-patches-v2-registered-halo");
await fs.mkdir(cache, { recursive: true });
async function source(key) {
  if (sources.has(key)) return sources.get(key);
  const t = await fromUrl(definitions[key], {
    allowFullFile: false,
    blockSize: 262144,
    cacheSize: 512,
    headers: {
      "User-Agent": "SolarReach lunar terrain research (NASA Space Apps)",
    },
  });
  const im = await t.getImage();
  const value = {
    im,
    url: definitions[key],
    origin: im.getOrigin(),
    resolution: im.getResolution(),
  };
  sources.set(key, value);
  console.log("Opened", key, im.getWidth(), im.getHeight());
  return value;
}
const project = (lat, lon) => {
  const rho = 2 * 1737400 * Math.tan(Math.PI / 4 + (lat * Math.PI) / 360),
    l = (lon * Math.PI) / 180;
  return [rho * Math.sin(l), rho * Math.cos(l)];
};
async function patch(site, key, half, n) {
  const cacheFile = path.join(cache, `${site.id}-${key}-${half}-${n}.json`);
  try {
    return JSON.parse(await fs.readFile(cacheFile, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const { im, url, origin, resolution } = await source(key),
    [cx, cy] = project(site.lat, site.lon),
    pixel = resolution[0];
  const window = [
    Math.floor((cx - half - origin[0]) / pixel),
    Math.floor((origin[1] - (cy + half)) / pixel),
    Math.ceil((cx + half - origin[0]) / pixel),
    Math.ceil((origin[1] - (cy - half)) / pixel),
  ];
  const width = window[2] - window[0],
    height = window[3] - window[1],
    stepM = (width * pixel) / n,
    stepYM = (height * pixel) / n,
    x0 = origin[0] + (window[0] + 0.5) * pixel,
    y0 = origin[1] - (window[1] + 0.5) * pixel;
  let values;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw=await im.readRasters({window:[window[0],window[1],window[2]+1,window[3]+1],interleave:true,fillValue:NaN});
      values=resampleRegisteredTerrain(raw,width+1,height+1,n,n,width/n,height/n,im.getGDALNoData());
      break;
    } catch (e) {
      console.warn(site.id, key, "read failure", attempt + 1, e.message);
      if (attempt === 2) throw e;
    }
  }
  const heights = Array.from(values, (v, i) => {
    const col = window[0] + ((i % n) * width) / n,
      row = window[1] + (Math.floor(i / n) * height) / n;
    return col >= 0 &&
      row >= 0 &&
      col < im.getWidth() &&
      row < im.getHeight() &&
      Number.isFinite(v) &&
      Math.abs(v) < 20000
      ? Math.round(v * 100) / 100
      : null;
  });
  console.log(
    "Prepared",
    site.id,
    key,
    "source",
    pixel,
    "m, mesh",
    stepM.toFixed(2),
    "m",
  );
  const result = {
    id: site.id,
    lod: key,
    width: n,
    height: n,
    x0,
    y0,
    stepM,
    stepYM,
    inputPixelM: pixel,
    sourceUrl: url,
    heights,
  };
  await fs.writeFile(cacheFile, JSON.stringify(result));
  return result;
}
const fine = [];
for (const site of catalog.sites) {
  if (site.lat <= -87) fine.push(await patch(site, "fine5", 2048, 513));
  if (site.lat <= -83) fine.push(await patch(site, "fine10", 6144, 513));
  else fine.push(await patch(site, "fine40", 8192, 513));
}
data.patches = [
  ...fine.sort((a, b) => a.inputPixelM - b.inputPixelM),
  ...data.patches.filter((p) => !p.lod),
];
data.detailSources = definitions;
data.detailPreparedUtc = new Date().toISOString();
data.sampling +=
  " Fine nested cutouts from 5 m / 10 m / 40 m NASA DEMs are prioritized where covered; input resolution and output spacing remain distinct.";
await fs.writeFile(terrainPath, JSON.stringify(packTerrain(data)) + "\n");
console.log("Wrote", fine.length, "finer measured patches.");
