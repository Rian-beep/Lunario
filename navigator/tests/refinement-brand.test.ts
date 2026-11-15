import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build, transform } from 'esbuild';
import { MODEL_RELATIONS } from '../lib/variable-notation';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const compiled = build({
  stdin: { contents: `export {LunarWindowBrand} from './components/branding/lunar-window-brand';
    export {LunarWindowLoader} from './components/branding/lunar-window-loader';
    export {EquationLesson} from './components/workbench/equation-lesson';
    export {NativeMath} from './components/workbench/native-math';`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, outfile: '/tmp/lunar-window-brand-test.cjs',
  format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
});
async function components() {
  const result = await compiled;
  const output = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  new Function('require', 'module', 'exports', result.outputFiles.find(f => f.path.endsWith('.cjs'))!.text)(createRequire(import.meta.url), output, output.exports);
  return output.exports;
}

// Exact vendor identity and startup lifecycle are covered by lunario-branding.test.ts.
// The superseded SolarReach Sun/caller-icon contract is intentionally retired.

test('native mathematical lessons keep semantic MathML, expanded content and chart identity', async () => {
  const { NativeMath, EquationLesson } = await components();
  const math = renderToStaticMarkup(createElement(NativeMath, { expression: MODEL_RELATIONS.solar, display: true }));
  assert.match(math, /<math/);
  assert.match(math, /<mi>η<\/mi>/);
  const lesson = renderToStaticMarkup(createElement(EquationLesson, { expression: MODEL_RELATIONS.solar, mode: 'plan', defaultOpen: true }));
  assert.match(lesson, /<details[^>]*open/);
  assert.match(lesson, /Every symbol and unit/);
  assert.match(lesson, /illustrative, not mission assessment/);
  assert.match(lesson, /<svg/);
  assert.match(lesson, /<math/);
});

test('web and real offline bundling put the mission theme after existing styles, with matching titles', async () => {
  const [layout, entry, script] = await Promise.all([read('app/layout.tsx'), read('standalone/main.tsx'), read('scripts/build-standalone.mjs')]);
  assert.ok(layout.indexOf('import "./mission-theme.css"') > layout.indexOf('import "./globals.css"'));
  assert.ok(entry.indexOf('import "../app/mission-theme.css"') > entry.indexOf('import { Navigator }'));
  const title = layout.match(/title: "([^"\n]+)"/)?.[1];
  assert.ok(title);
  assert.ok(script.includes(`<title>${title}</title>`), "Web and offline retain the same product title");
  // Exercise esbuild's actual dependency traversal, without generating the offline app.
  const result = await build({ entryPoints: ['standalone/main.tsx'], bundle: true, write: false,
    outdir: '/tmp/lunar-window-offline-theme-test', jsx: 'automatic', format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.url': 'document.baseURI' } });
  const css = result.outputFiles.find(f => f.path.endsWith('.css'))!.text;
  const themeAt = css.indexOf('/* app/mission-theme.css */');
  assert.ok(themeAt > css.indexOf('/* components/audience/audience.module.css */'));
  assert.ok(themeAt > css.indexOf('/* components/workbench/alternatives.module.css */'));
  assert.match(css.slice(themeAt), /color-scheme: (?:dark|light)/);
  assert.match(script, /fs.readFileSync\(cssPath, "utf8"\) \+ js.outputFiles.filter/);
});

test('theme CSS parses, states and reduced motion are explicit, and imagery receives no filters', async () => {
  const theme = await read('app/mission-theme.css');
  const warnings = (await transform(theme, { loader: 'css' })).warnings;
  assert.deepEqual(warnings, []);
  for (const selector of ['.inspector.glass', '.variable-tooltip', '.learning-dialog', '.workspace-dialog', '.chart-tick', '.chart-legend', 'math', ':focus-visible', ':disabled', '[aria-invalid="true"]', '[aria-busy="true"]']) assert.ok(theme.includes(selector), selector);
  assert.match(theme, /prefers-reduced-motion: reduce/);
  assert.match(theme, /animation: none !important/);
  assert.doesNotMatch(theme, /@keyframes|(?:^|[;{])\s*filter:/m);
  for (const [, value] of theme.matchAll(/(?:^|[;{])\s*animation:([^;}]*)/gm)) assert.equal(value.trim(), 'none !important');
  for (const block of theme.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/canvas|\bimg\b|texture/i.test(block[1])) assert.doesNotMatch(block[2], /(?:filter|opacity|mix-blend-mode)\s*:/);
  }
  const moduleFiles = ['audience/audience', 'replanning/workspace', ...['alternatives', 'audience-guide', 'data-connections', 'globe-navigation', 'physics-reference', 'solar-system-view', 'teaching-workbench', 'touchdown-lab', 'visibility-windows'].map(n => `workbench/${n}`)];
  for (const file of moduleFiles) {
    const css = await read(`components/${file}.module.css`);
    assert.deepEqual((await transform(css, { loader: 'css' })).warnings, [], file);
    assert.doesNotMatch(css, /(?:background|color):\s*#(?:fff|faf|f7f)/i, file);
    for (const [, token] of css.matchAll(/var\((--mission-[\w-]+)/g)) assert.ok(theme.includes(`${token}:`), `${file}: ${token}`);
  }
});

function luminance(hex: string) {
  const v = hex.match(/\w\w/g)!.map(s => parseInt(s, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test('text and meaningful colours meet 4.5:1 on every opaque interface surface', async () => {
  const theme = await read('app/mission-theme.css');
  const palette = theme.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  assert.ok(palette, 'Root interface palette is declared');
  const raw = new Map([...palette.matchAll(/(--[\w-]+):\s*(#[a-f\d]{6}|var\(--[\w-]+\));/gi)].map(m => [m[1], m[2]]));
  const token = (name: string, seen = new Set<string>()): string => {
    assert.ok(!seen.has(name), `No token cycle at ${name}`); seen.add(name);
    const value = raw.get(name); assert.ok(value, `Defined colour ${name}`);
    return value.startsWith('#') ? value.slice(1) : token(value.slice(4, -1), seen);
  };
  for (const surface of ['--background', '--card', '--secondary', '--mission-hover', '--mission-selected', '--mission-success-bg', '--mission-warning-bg']) {
    for (const text of ['--foreground', '--muted-foreground', '--primary', '--sun', '--earth', '--mission-success', '--destructive']) {
      assert.ok(contrast(token(text), token(surface)) >= 4.5, `${text} on ${surface}`);
    }
  }
  assert.ok(contrast(token('--primary-foreground'), token('--primary')) >= 4.5);
  for (const surface of ['--card', '--mission-hover', '--mission-selected']) assert.ok(contrast(token('--mission-control-border'), token(surface)) >= 3);
});
