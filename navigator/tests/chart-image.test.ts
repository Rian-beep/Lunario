import { test } from "node:test";
import assert from "node:assert/strict";
import { chartClipboardProblem, chartImageDimensions, copyChartPng, escapeChartText } from "../lib/chart-image";

test("PNG dimensions use 2× without changing the chart aspect ratio", () => {
  assert.deepEqual(chartImageDimensions(760, 295), { width: 760, height: 295, pixelWidth: 1520, pixelHeight: 590 });
  assert.deepEqual(chartImageDimensions(480.25, 260.5), { width: 480.25, height: 260.5, pixelWidth: 961, pixelHeight: 521 });
  for (const [width, height] of [[0, 100], [-1, 100], [NaN, 100], [100, Infinity], [5000, 100], [4000, 4000]])
    assert.throws(() => chartImageDimensions(width, height), /size|large/);
});

test("export metadata is XML text, including user titles, units, and invalid control characters", () => {
  assert.equal(escapeChartText('<script x="a">&\'\u0000\nW/m²'), '&lt;script x=&quot;a&quot;&gt;&amp;&apos;\nW/m²');
});

function clipboard(write: (items: ClipboardItem[]) => Promise<void> = async () => undefined) {
  class Item {
    static supports = (type: string) => type === "image/png";
    constructor(public data: Record<string, Blob | Promise<Blob>>) {}
  }
  return { isSecureContext: true, navigator: { clipboard: { write } }, ClipboardItem: Item as unknown as typeof ClipboardItem };
}

test("insecure, missing and unsupported PNG clipboard capabilities give actionable fallback errors", async () => {
  let called = false;
  const makePng = async () => { called = true; return new Blob(); };
  for (const env of [
    { ...clipboard(), isSecureContext: false },
    { ...clipboard(), navigator: {} },
    { ...clipboard(), ClipboardItem: undefined },
    { ...clipboard(), ClipboardItem: class { static supports = () => false; } as unknown as typeof ClipboardItem },
  ]) {
    assert.match(chartClipboardProblem(env)!, /Download PNG/);
    await assert.rejects(copyChartPng(makePng, env), /Download PNG/);
  }
  assert.equal(called, false, "unsupported copy must not start expensive rendering");
});

test("clipboard write starts in the click gesture with a PNG promise and resolves only after success", async () => {
  let written = false;
  let resolve!: (blob: Blob) => void;
  const png = new Promise<Blob>((r) => { resolve = r; });
  const expected = new Blob(["png"], { type: "image/png" });
  const copying = copyChartPng(() => png, clipboard(async (items) => {
    written = true;
    const item = items[0] as unknown as { data: Record<string, Promise<Blob>> };
    assert.equal(await item.data["image/png"], expected);
  }));
  assert.equal(written, true);
  resolve(expected);
  await copying;
});

test("clipboard denial and encoding errors reject instead of reporting copy success", async () => {
  const denied = new Error("User refused"); denied.name = "NotAllowedError";
  await assert.rejects(copyChartPng(async () => new Blob(), clipboard(async () => { throw denied; })), /denied.*Download PNG/);
  await assert.rejects(copyChartPng(async () => { throw new Error("Encoding failed"); }, clipboard(async (items) => {
    await (items[0] as unknown as { data: Record<string, Promise<Blob>> }).data["image/png"];
  })), /Encoding failed/);
});
