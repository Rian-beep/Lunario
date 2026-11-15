import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = fs.mkdtempSync(
  path.join(os.tmpdir(), "solarreach-standalone-"),
);
try {
  const cssPath = path.join(scratch, "app.css");
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/@tailwindcss/cli/dist/index.mjs"),
      "-i",
      path.join(root, "app/globals.css"),
      "-o",
      cssPath,
      "--minify",
    ],
    { cwd: root, stdio: "inherit" },
  );
  const js = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ["standalone/main.tsx"],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
    outdir: scratch,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "import.meta.url": "document.baseURI" },
    target: ["es2020"],
  });
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "public/data/catalog.json"), "utf8"),
  );
  catalog.map.url =
    "data:image/png;base64," +
    fs.readFileSync(path.join(root, "public/data/map.png")).toString("base64");
  const terrain = JSON.parse(
    fs.readFileSync(path.join(root, "public/data/terrain.json"), "utf8"),
  );
  const imagery = JSON.parse(
    fs.readFileSync(path.join(root, "public/data/imagery.json"), "utf8"),
  );
  const sharedMoonAtlas = imagery.global.url === "/data/imagery/nasa-moon-8k.jpg";
  for (const image of [imagery.overview, ...imagery.patches, imagery.global]) {
    if (image === imagery.global && sharedMoonAtlas) continue;
    if (!image.url.startsWith("/data/imagery/"))
      throw new Error("Unexpected bundled imagery path");
    image.url =
      "data:image/jpeg;base64," +
      fs
        .readFileSync(path.join(root, "public", image.url.slice(1)))
        .toString("base64");
  }
  const safe = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
  const nasaMetadata = JSON.parse(fs.readFileSync(path.join(root,"public/data/nasa-model.json"),"utf8"));
  const nasaModel = {
    metadata:nasaMetadata,
    meshGzipBase64:fs.readFileSync(path.join(root,"public/data/nasa-moon-mesh.bin.gz")).toString("base64"),
    textureDataUrl:"data:image/jpeg;base64,"+fs.readFileSync(path.join(root,"public/data/imagery/nasa-moon-8k.jpg")).toString("base64"),
  };
  const equipment = Object.fromEntries([["/data/equipment/apollo-lunar-module.glb","model/gltf-binary"],["/data/equipment/draco/draco_decoder.js","application/javascript"]].map(([asset,mime])=>[asset,`data:${mime};base64,${fs.readFileSync(path.join(root,"public",asset.slice(1))).toString("base64")}`]));
  const globalTerrain=JSON.parse(fs.readFileSync(path.join(root,"public/data/global-terrain.json"),"utf8"));
  globalTerrain.encodedHeights=fs.readFileSync(path.join(root,"public",globalTerrain.packed.url.slice(1))).toString("base64");
  const celestialModels=Object.fromEntries(["sun","earth"].map(kind=>{const asset=`/data/celestial-models/assets/${kind}.glb`;return [asset,"data:model/gltf-binary;base64,"+fs.readFileSync(path.join(root,"public",asset.slice(1))).toString("base64")];}));
  const dsnEarthTexture="data:image/jpeg;base64,"+fs.readFileSync(path.join(root,"public/data/dsn/earth-blue-marble-2048.jpg")).toString("base64");
  const planningDemo = JSON.parse(fs.readFileSync(path.join(root,"public/data/planning-demo.json"),"utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(root,"public/data/evidence-manifest.json"),"utf8"));
  const css =
    fs.readFileSync(cssPath, "utf8") + js.outputFiles.filter(f=>f.path.endsWith('.css')).map(f=>f.text).join('\n') +
    `\n@font-face{font-family:"Lunario Geist";src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root,"public/fonts/lunario/geist-var.woff2")).toString("base64")}) format("woff2");font-weight:100 900;font-display:swap}:root{--font-sans:"Lunario Geist","Segoe UI",Arial,sans-serif;--font-display:var(--font-sans);--font-serif:var(--font-sans)}body{font-family:var(--font-sans)}`;
  const favicon = "data:image/x-icon;base64," + fs.readFileSync(path.join(root,"app/favicon.ico")).toString("base64");
  const fontLicense = fs.readFileSync(path.join(root,"public/fonts/lunario/OFL.txt"),"utf8").replace(/-->/g,"-- >");
  const orbitalLicenses = ["satellite-js.txt","gods-eye-view.txt"].map(file=>fs.readFileSync(path.join(root,"public/licenses",file),"utf8")).join("\n\n").replace(/-->/g,"-- >");
  const html = `<!doctype html><html lang="en"><head><!-- Orbital source licences: ${orbitalLicenses} --><!-- Lunario Geist font: ${fontLicense} --><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lunario — Lunar Landing Site Navigator</title><link rel="icon" href="${favicon}"><style>${css}</style></head><body><div id="root"></div><script>window.__SOLARREACH_CATALOG__=${safe(catalog)};window.__SOLARREACH_TERRAIN__=${safe(terrain)};window.__SOLARREACH_IMAGERY__=${safe(imagery)};window.__SOLARREACH_NASA_MODEL__=${safe(nasaModel)};${sharedMoonAtlas?"window.__SOLARREACH_IMAGERY__.global.url=window.__SOLARREACH_NASA_MODEL__.textureDataUrl;":""}window.__SOLARREACH_EQUIPMENT__=${safe(equipment)};window.__SOLARREACH_EVIDENCE__=${safe(evidence)};window.__SOLARREACH_PLANNING_DEMO__=${safe(planningDemo)};window.__SOLARREACH_GLOBAL_TERRAIN__=${safe(globalTerrain)};window.__SOLARREACH_CELESTIAL_MODELS__=${safe(celestialModels)};window.__SOLARREACH_DSN_EARTH_TEXTURE__=${safe(dsnEarthTexture)};</script><script>${js.outputFiles.find(f=>f.path.endsWith('.js')).text}</script></body></html>`;
  const target = process.env.SOLARREACH_STANDALONE_OUTPUT ? path.resolve(process.env.SOLARREACH_STANDALONE_OUTPUT) : path.join(root, "public/solarreach-navigator.html");
  fs.writeFileSync(target, html);
  console.log(
    `Wrote ${target} (${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB), including numerical terrain, science and 3D code.`,
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
