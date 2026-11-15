import fs from "node:fs/promises";
import {LANDING_SITES} from "../lib/landing-sites";
import {withLandingSites} from "../lib/landing-catalog";
import { decodeCatalog } from "../lib/catalog";
import { sunAzEl, earthAzEl } from "../lib/astro";
async function main() {
  const base = decodeCatalog(
    JSON.parse(await fs.readFile("public/data/catalog.json", "utf8")),
  );
  const c=withLandingSites(base,LANDING_SITES);
  const t0 = Date.parse("2026-11-14T00:00:00Z");
  const rows: Array<{
    site: string;
    body: string;
    count: number;
    maxAzDeg: number;
    maxElDeg: number;
  }> = [];
  for (const site of c.sites.filter((s) =>
    ["malapert-massif", "connecting-ridge", "athena", "apollo-11"].includes(s.id),
  )) {
    for (const body of ["10", "399"]) {
      const p = new URLSearchParams({
        format: "json",
        COMMAND: `'${body}'`,
        CENTER: "'coord@301'",
        COORD_TYPE: "'GEODETIC'",
        SITE_COORD: `'${site.lon},${site.lat},0'`,
        EPHEM_TYPE: "'OBSERVER'",
        START_TIME: "'2026-11-14 00:00'",
        STOP_TIME: "'2026-11-14 06:00'",
        STEP_SIZE: "'1 h'",
        QUANTITIES: "'4'",
        CSV_FORMAT: "'YES'",
        APPARENT: "'AIRLESS'",
      });
      const response = await fetch(
        "https://ssd.jpl.nasa.gov/api/horizons.api?" + p,
      );
      if (!response.ok) throw new Error(`Horizons HTTP ${response.status}`);
      const d = await response.json();
      const raw = d.result?.split("$$SOE")[1]?.split("$$EOE")[0];
      if (!raw) throw new Error(d.error ?? "Missing ephemeris rows");
      const lines = raw.trim().split("\n");
      let maxAz = 0,
        maxEl = 0;
      for (let j = 0; j < lines.length; j++) {
        const f = lines[j].split(","),
          az = Number(f[3]),
          el = Number(f[4]);
        const i = Math.round((t0 + j * 3600000 - c.t0ms) / 3600000);
        const local =
          body === "10"
            ? sunAzEl(site.lat, site.lon, c.subsolarLat[i], c.subsolarLon[i])
            : earthAzEl(
                site.lat,
                site.lon,
                c.subearthLat[i],
                c.subearthLon[i],
                c.earthRangeKm[i],
              );
        if (![az, el, ...local].every(Number.isFinite))
          throw new Error("Invalid observer sample");
        maxAz = Math.max(maxAz, Math.abs(((local[0] - az + 540) % 360) - 180));
        maxEl = Math.max(maxEl, Math.abs(local[1] - el));
      }
      if (lines.length !== 7)
        throw new Error("Expected 7 samples per observer");
      rows.push({
        site: site.id,
        body: body === "10" ? "Sun" : "Earth",
        count: lines.length,
        maxAzDeg: maxAz,
        maxElDeg: maxEl,
      });
    }
  }
  const evidence = {
    checkedUtc: new Date().toISOString(),
    note: "Fresh Horizons observer tables versus decoded, quantized browser catalog; 4 sites (including Apollo 11) × 2 bodies × 7 hours. Terrain occlusion is not validated by this test.",
    toleranceDeg: 0.02,
    rows,
  };
  console.log(JSON.stringify(evidence, null, 2));
  await fs.mkdir("docs/qa", { recursive: true });
  await fs.writeFile(
    "docs/qa/horizons-decoded-validation.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  if (rows.some((r) => r.maxAzDeg > 0.02 || r.maxElDeg > 0.02))
    throw new Error(
      "Decoded ephemeris exceeds 0.02 degree quantization-aware tolerance",
    );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
