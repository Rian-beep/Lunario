// Reacquire the exact NASA source without geometry conversion or dependency installs.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const revision = "4dd37a50fdf79beadf7b2e3a407cedc63fda81de";
const source = `https://raw.githubusercontent.com/nasa/NASA-3D-Resources/${revision}/3D%20Models/Apollo%20Lunar%20Module/Apollo%20Lunar%20Module.glb`;
const response = await fetch(source);
if (!response.ok) throw new Error(`NASA download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== "379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e") throw new Error("NASA model checksum mismatch");
const root = new URL("../public/data/equipment/", import.meta.url);
await mkdir(root, { recursive: true });
await writeFile(new URL("apollo-lunar-module.glb", root), bytes);
console.log(JSON.stringify({ source, bytes: bytes.length, sha256 }));
