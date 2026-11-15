import { fromUrl } from "geotiff";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import {resampleRegisteredTerrain} from "./terrain-resample.mjs";
const source =
  "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF";
const root = new URL("../", import.meta.url);
const catalog = JSON.parse(
  await fs.readFile(new URL("public/data/catalog.json", root), "utf8"),
);
const tiff = await fromUrl(source, { allowFullFile: false });
const image = await tiff.getImage();
console.log(
  "NASA COG:",
  image.getWidth(),
  image.getHeight(),
  image.getBoundingBox(),
);
const R = 1737400;
function project(lat, lon) {
  const rho = 2 * R * Math.tan(Math.PI / 4 + (lat * Math.PI) / 360),
    l = (lon * Math.PI) / 180;
  return [rho * Math.sin(l), rho * Math.cos(l)];
}
async function patch(id, bbox, n) {
  const requestedStep = (bbox[2] - bbox[0]) / n;
  let selected = image,
    pixel = 80;
  for (let i = 1; i < (await tiff.getImageCount()); i++) {
    const candidate = await tiff.getImage(i);
    const res = (80 * image.getWidth()) / candidate.getWidth();
    if (res <= requestedStep * 2) {
      selected = candidate;
      pixel = res;
    }
  }
  const window = [
    Math.floor((bbox[0] + 304000) / pixel),
    Math.floor((304000 - bbox[3]) / pixel),
    Math.ceil((bbox[2] + 304000) / pixel),
    Math.ceil((304000 - bbox[1]) / pixel),
  ];
  const aligned = [
    -304000 + window[0] * pixel,
    304000 - window[3] * pixel,
    -304000 + window[2] * pixel,
    304000 - window[1] * pixel,
  ];
  let values;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const width=window[2]-window[0],height=window[3]-window[1];
      const raw=await selected.readRasters({window:[window[0],window[1],window[2]+1,window[3]+1],interleave:true,fillValue:NaN});
      values=resampleRegisteredTerrain(raw,width+1,height+1,n,n,width/n,height/n,selected.getGDALNoData());
      break;
    } catch (error) {
      console.warn(id, "read attempt", attempt + 1, error.message);
      if (attempt === 2) throw error;
    }
  }
  bbox = aligned;
  const step = (bbox[2] - bbox[0]) / n;
  const heights = Array.from(values, (v, i) => {
    const x = bbox[0] + pixel / 2 + (i % n) * step,
      y = bbox[3] - pixel / 2 - (Math.floor(i / n) * (bbox[3] - bbox[1])) / n;
    return x >= -304000 &&
      x <= 304000 &&
      y >= -304000 &&
      y <= 304000 &&
      Number.isFinite(v) &&
      Math.abs(v) < 1e5
      ? Math.round(v * 10) / 10
      : null;
  });
  console.log(
    id,
    "valid",
    heights.filter((v) => v != null).length,
    "of",
    heights.length,
  );
  return {
    id,
    width: n,
    height: n,
    x0: bbox[0] + pixel / 2,
    y0: bbox[3] - pixel / 2,
    stepM: step,
    stepYM: (bbox[3] - bbox[1]) / n,
    inputPixelM: pixel,
    heights,
  };
}
const overview = await patch(
  "overview",
  [-304000, -304000, 304000, 304000],
  513,
);
const patches = [];
for (const site of catalog.sites) {
  const [x, y] = project(site.lat, site.lon),
    h = 16384;
  patches.push(await patch(site.id, [x - h, y - h, x + h, y + h], 257));
}
const result = {
  version: 1,
  source,
  sourcePage: "https://pgda.gsfc.nasa.gov/products/90",
  retrievedUtc: new Date().toISOString(),
  frame: "MOON_ME / DE421, south polar stereographic, R=1737400m",
  sourcePixelM: 80,
  sampling:
    "Bilinear, COG overviews chosen by requested output resolution; mesh spacing is not source effective resolution.",
  overview,
  patches,
};
const json = JSON.stringify(result);
await fs.writeFile(new URL("public/data/terrain.json", root), json + "\n");
console.log(
  "Wrote terrain.json",
  json.length,
  "bytes; SHA256",
  crypto
    .createHash("sha256")
    .update(json + "\n")
    .digest("hex"),
);
