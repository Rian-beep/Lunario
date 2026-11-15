import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { updateLunarioStartup, type LunarioLoaderAPI } from "../components/branding/lunario-loader-runtime";
import { LUNARIO_WORDMARK, LUNARIO_MARK, LUNARIO_LOADER_CSS, LUNARIO_LOADER_JS } from "../components/branding/lunario-vendor.generated";

const vendor = new URL("../public/branding/lunario/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, vendor));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const PINNED_HASHES = {
  "README.md": "6e22efb9e9713acce2d15fe0adc0f355d0f1a5cc85af5a6848f1eecd1674ac3e",
  "index.html": "0cf9e9e0786d142c831d57e097cc8d652b37a1a8da9408923865a802e341c651",
  "css/site.css": "34650df91d44b04fa2e486d2dc6546416e58c4908938dffe7d6a79edc71dfdc9",
  "assets/logo-dark.svg": "f84ad5fa1e02b6ab53d677a96c3eb495c7c994e1ec42f97c4c5aa11251069656",
  "assets/logo-mark-dark.svg": "dc861e61cf6f41fdda048f524706a99eb8944c0d65df85ca2a3abc46fdf656ba",
  "assets/logo-mark.svg": "e6fbdf49b520df65a1bf0afb70d54277eee63d10d2f3ded552987706b6c03f69",
  "assets/logo-white.svg": "f0c7c591375782febb31b158cee473c21a5970be9339ee8cd378726ebfe34ae9",
  "assets/logo.svg": "572c14fcbd73139087c471ac7fa0da085a101fdde62815f960a7dd570be89ca0",
  "loader/loader.js": "7f7dfa0d123841c838f8c7a79db6456b582c297c674a0749f16ac4f44249a149",
  "loader/loader.css": "28ff62158122a223d875acf0da3ae42944aa1b7568bf90a68b596788c3a253f1",
  "loader/fonts/geist-mono-regular.woff2": "9dbb5abf4c6b640ddc777cb63c6e81266f76878b2c871a242f62cf16f8753905",
};

test("vendor bytes and provenance match the pinned original Lunario commit", () => {
  const manifest = JSON.parse(read("provenance.json").toString());
  assert.equal(manifest.repository, "https://github.com/Rian-beep/Lunario");
  assert.equal(manifest.commit, "aeb673fff6de377e5dba0982c0c55c8b0d874ee8");
  assert.deepEqual(Object.keys(manifest.files).sort(), Object.keys(PINNED_HASHES).sort());
  for (const [path, expected] of Object.entries(PINNED_HASHES)) {
    const bytes = read(path);
    assert.equal(hash(bytes), expected, path);
    assert.equal(manifest.files[path].sha256, expected, path);
    assert.equal(manifest.files[path].bytes, bytes.length, path);
  }
  execFileSync(process.execPath, ["components/branding/generate-lunario.mjs", "--check"]);
});

test("offline runtime preserves the actual SVG outlines, vendor JS and CSS with only its font URL embedded", () => {
  for (const [uri, path] of [[LUNARIO_WORDMARK, "assets/logo-dark.svg"], [LUNARIO_MARK, "assets/logo-mark-dark.svg"]]) {
    assert.match(uri, /^data:image\/svg\+xml;base64,/);
    assert.deepEqual(Buffer.from(uri.split(",")[1], "base64"), read(path));
  }
  const svg = Buffer.from(LUNARIO_WORDMARK.split(",")[1], "base64").toString();
  assert.match(svg, /viewBox="0 0 303 64"/);
  assert.match(svg, /<path fill="#0B0D12" d="M88/); // Original letter outlines, not font-dependent text.
  assert.match(svg, /stroke="#D98A00"/);
  assert.doesNotMatch(svg, /<text|<image|href=|<script/);
  assert.equal(LUNARIO_LOADER_JS, read("loader/loader.js").toString());
  const font = `data:font/woff2;base64,${read("loader/fonts/geist-mono-regular.woff2").toString("base64")}`;
  assert.equal(LUNARIO_LOADER_CSS, read("loader/loader.css").toString().replace('url("fonts/geist-mono-regular.woff2")', `url("${font}")`));
  assert.doesNotMatch(LUNARIO_LOADER_JS + LUNARIO_LOADER_CSS, /fetch\(|XMLHttpRequest|sourceMappingURL|@import/);
  for (const match of LUNARIO_LOADER_CSS.matchAll(/url\("([^"]+)"\)/g)) assert.ok(match[1].startsWith("data:"));
});

test("legacy brand API renders the real Lunario SVG and ignores caller Sun markup; fallback retains original copy", async () => {
  const compiled = await build({
    stdin: { contents: `export {LunarWindowBrand} from './components/branding/lunar-window-brand'; export {LunarWindowLoader, LunarioStartup} from './components/branding/lunar-window-loader';`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, outfile: "/tmp/lunario-branding-test.cjs", format: "cjs", platform: "node", packages: "external", jsx: "automatic",
  });
  const exportsModule = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  new Function("require", "module", "exports", compiled.outputFiles.find(f => f.path.endsWith(".cjs"))!.text)(createRequire(import.meta.url), exportsModule, exportsModule.exports);
  const brand = renderToStaticMarkup(createElement(exportsModule.exports.LunarWindowBrand, { icon: createElement("span", { "data-legacy-sun": true }) }));
  assert.match(brand, /alt="Lunario"/);
  assert.ok(brand.includes(LUNARIO_WORDMARK));
  assert.doesNotMatch(brand, /legacy-sun|Lunar Window|brand-orbit|lucide|<text/);
  const fallback = renderToStaticMarkup(createElement(exportsModule.exports.LunarWindowLoader));
  assert.match(fallback, /aria-busy="true"/);
  assert.match(fallback, /role="status">Prepare for landing/);
  assert.doesNotMatch(fallback, /progressbar|aria-valuenow|\d+%|ALT /);
  assert.equal(renderToStaticMarkup(createElement(exportsModule.exports.LunarioStartup, { ready: true })), "");
  const browser = await build({ entryPoints: ["components/branding/lunario-startup.tsx"], bundle: true, write: false, platform: "browser", format: "iife", metafile: true });
  assert.ok(browser.outputFiles[0].text.includes("Prepare for landing"));
  assert.ok(Object.keys(browser.metafile!.inputs).every(path => !/node:|public\/|\.woff|\.svg|\.map$/.test(path)));
});

// Only the vendor's DOM/timer boundary is simulated. Its original script runs unmodified.
class ElementFixture {
  children: ElementFixture[] = [];
  parentNode: ElementFixture | null = null;
  className = "";
  textContent = "";
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  style: Record<string, string> = { overflow: "" };
  constructor(readonly tagName: string, private readonly appended?: (element: ElementFixture) => void) {}
  classList = {
    add: (name: string) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), name])].join(" "); },
    remove: (name: string) => { this.className = this.className.split(" ").filter(c => c !== name).join(" "); },
  };
  set innerHTML(html: string) {
    for (const [, className] of html.matchAll(/class="([^"]+)"/g)) {
      const element = new ElementFixture("vendor-element");
      element.className = className;
      this.appendChild(element);
    }
  }
  appendChild(element: ElementFixture) {
    element.parentNode = this;
    this.children.push(element);
    this.appended?.(element);
    return element;
  }
  removeChild(element: ElementFixture) {
    this.children = this.children.filter(child => child !== element);
    element.parentNode = null;
  }
  querySelector(selector: string): ElementFixture | null {
    const name = selector.slice(1);
    for (const child of this.children) {
      if (child.className.split(" ").includes(name)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
}

function documentFixture({ reduced = false, seen = false, blocked = false } = {}) {
  let time = 100;
  let serial = 0;
  let storageWrites = 0;
  let scriptCount = 0;
  let loadedEvents = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const schedule = (callback: () => void, delay: number) => {
    const id = ++serial;
    timers.set(id, { at: time + delay, callback });
    return id;
  };
  const onload = () => "unrelated caller handler";
  const window = {
    Lunario: undefined as { loader: LunarioLoaderAPI } | undefined,
    onload,
    performance: { now: () => time },
    matchMedia: () => ({ matches: reduced }),
    addEventListener() {},
    dispatchEvent(event: { type: string }) { if (event.type === "lunario:loaded") loadedEvents++; },
  };
  const document = {
    defaultView: window,
    currentScript: null as ElementFixture | null,
    documentElement: new ElementFixture("html"),
    head: new ElementFixture("head"),
    body: new ElementFixture("body", element => {
      if (element.tagName === "script") {
        scriptCount++;
        document.currentScript = element;
        runInContext(element.textContent, context);
        document.currentScript = null;
      }
    }),
    createElement: (tag: string) => new ElementFixture(tag),
  };
  const context = createContext({
    window, document,
    performance: window.performance,
    sessionStorage: {
      getItem: () => { if (blocked) throw new Error("Storage blocked"); return seen ? "1" : null; },
      setItem: () => { if (blocked) throw new Error("Storage blocked"); storageWrites++; },
    },
    requestAnimationFrame: (callback: () => void) => schedule(callback, 16),
    cancelAnimationFrame: (id: number) => timers.delete(id),
    setTimeout: schedule,
    CustomEvent: class { constructor(readonly type: string) {} },
  });
  return {
    document: document as unknown as Document,
    dom: document, window, onload,
    overlay: () => document.body.querySelector(".lunario-loader"),
    scriptCount: () => scriptCount,
    storageWrites: () => storageWrites,
    loadedEvents: () => loadedEvents,
    pending: () => timers.size,
    advance(ms: number) {
      const end = time + ms;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]);
        time = next[1].at;
        next[1].callback();
      }
      time = end;
    },
  };
}

test("Strict Mode replay and conditional branch remount retain one original overlay until real readiness", async () => {
  const fixture = documentFixture();
  updateLunarioStartup(fixture.document, false);
  const overlay = fixture.overlay()!;
  updateLunarioStartup(fixture.document, false);
  assert.equal(fixture.overlay(), overlay);
  assert.equal(fixture.scriptCount(), 1);
  assert.equal(fixture.dom.head.children.length, 1);
  assert.equal(fixture.storageWrites(), 1);
  assert.deepEqual(fixture.dom.body.children.find(el => el.tagName === "script")!.dataset, {
    lunarioVendor: "loader", autoHide: "false", once: "session", altitude: "0",
  });
  for (const selector of [".lunario-loader__grid", ".lunario-loader__ridge", ".lunario-loader__mark", ".lunario-loader__ring", ".lunario-loader__cursor"]) assert.ok(overlay.querySelector(selector), selector);
  assert.equal(overlay.querySelector(".lunario-loader__telemetry"), null);
  assert.equal(overlay.attributes["aria-label"], "Prepare for landing");
  fixture.advance(5_000);
  assert.equal(fixture.overlay(), overlay, "manual readiness must win over elapsed time");
  assert.equal(overlay.querySelector(".lunario-loader__chars")!.textContent, "Prepare for landing");
  const completion = updateLunarioStartup(fixture.document, true);
  const ready = fixture.window.Lunario!.loader.ready;
  assert.equal(completion, ready, "The onboarding gate receives the original completion promise");
  updateLunarioStartup(fixture.document, true);
  fixture.advance(600);
  await ready;
  assert.equal(fixture.overlay(), null);
  assert.equal(fixture.loadedEvents(), 1);
  assert.equal(fixture.pending(), 0);
  assert.equal(fixture.dom.body.style.overflow, "");
  assert.doesNotMatch(fixture.dom.documentElement.className, /lunario-loader-active|lunario-loading/);
  updateLunarioStartup(fixture.document, false);
  assert.equal(fixture.scriptCount(), 1);
  assert.equal(fixture.overlay(), null, "a later remount must not reopen the loader");
  assert.equal(fixture.window.onload, fixture.onload);
});

test("already-ready and terminal-error readiness finish the vendor's minimum and lift-away without trapping the app", async () => {
  const fixture = documentFixture();
  updateLunarioStartup(fixture.document, true);
  fixture.advance(1799);
  assert.ok(fixture.overlay(), "original minimum duration remains intact");
  fixture.advance(600);
  await fixture.window.Lunario!.loader.ready;
  assert.equal(fixture.overlay(), null);
  assert.equal(fixture.pending(), 0);
});

test("a session-suppressed document initializes once and hide remains safe", async () => {
  const fixture = documentFixture({ seen: true });
  updateLunarioStartup(fixture.document, false);
  updateLunarioStartup(fixture.document, true);
  updateLunarioStartup(fixture.document, false);
  await fixture.window.Lunario!.loader.ready;
  assert.equal(fixture.window.Lunario!.loader.skipped, true);
  assert.equal(fixture.scriptCount(), 1);
  assert.equal(fixture.overlay(), null);
  assert.equal(fixture.pending(), 0);
  assert.equal(fixture.dom.body.style.overflow, "");
});

test("blocked sessionStorage still completes and reduced motion uses the original still version", async () => {
  const fixture = documentFixture({ blocked: true, reduced: true });
  updateLunarioStartup(fixture.document, false);
  updateLunarioStartup(fixture.document, false);
  const overlay = fixture.overlay()!;
  const content = overlay.querySelector(".lunario-loader__content")!;
  assert.equal(overlay.querySelector(".lunario-loader__chars")!.textContent, "Prepare for landing");
  fixture.advance(500);
  assert.equal(overlay.querySelector(".lunario-loader__ring")!.attributes.transform, undefined);
  updateLunarioStartup(fixture.document, true);
  fixture.advance(550);
  await fixture.window.Lunario!.loader.ready;
  assert.equal(fixture.overlay(), null);
  assert.equal(content.style.transform, undefined);
  assert.equal(fixture.scriptCount(), 1);
  assert.equal(fixture.pending(), 0);
});
