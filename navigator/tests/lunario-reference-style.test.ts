import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const css = readFileSync(new URL('../app/mission-theme.css', import.meta.url), 'utf8');
const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
const root = source.match(/:root\s*\{([^}]+)\}/)![1];
const tokens = new Map([...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
function value(name: string): string {
  const token = tokens.get(name);
  assert.ok(token, `Undefined theme token ${name}`);
  const alias = token.match(/^var\((--[\w-]+)\)$/);
  return alias ? value(alias[1]) : token;
}
function rgb(name: string) {
  const hex = value(name);
  assert.match(hex, /^#[a-f\d]{6}$/i, name);
  return hex.slice(1).match(/../g)!.map(n => parseInt(n, 16));
}
function luminance(name: string) {
  const c = rgb(name).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a: string, b: string) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + .05) / (lo + .05);
}
const rules = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), body: m[2] }));
function hasRule(selector: string, declaration: RegExp) {
  assert.ok(rules.some(rule => rule.selector.includes(selector) && declaration.test(rule.body)), `${selector}: ${declaration}`);
}

test('reference uses light peach paper, cream, orange, mint and a yellow/chartreuse backing', () => {
  assert.match(root, /color-scheme:\s*light/);
  const [r, g, b] = rgb('--card');
  assert.ok(r > g && g > b && luminance('--card') > .7, 'Opaque light peach paper');
  assert.ok(luminance('--mission-cream') > .9, 'Cream frame and reading surfaces');
  const [or, og, ob] = rgb('--mission-title');
  assert.ok(or > og && og > ob && or > 230 && ob < 100, 'Orange title strip');
  const [mr, mg, mb] = rgb('--mission-selected');
  assert.ok(mg > mr && mg > mb && luminance('--mission-selected') > .6, 'Mint selected tabs');
  const [yr, yg, yb] = rgb('--mission-backing');
  assert.ok(yr > 200 && yg > 200 && yb < 140, 'Yellow/chartreuse backing');
  hasRule('.app-header', /background:\s*var\(--mission-cream\)/);
  for (const heading of ['.drawer-heading', '.inspector-nav', '.learn-heading', '.header-context-toolbar']) {
    hasRule(heading, /background:\s*var\(--mission-title\)/);
  }
});

test('ink frames and offset hard shadows decorate existing panels without changing placement', () => {
  for (const panel of ['.inspector.glass', '.site-drawer.glass', '.workspace-dialog', '.variable-tooltip']) {
    hasRule(panel, /border:\s*2px solid var\(--mission-ink\)/);
    hasRule(panel, /box-shadow:[^;]*var\(--mission-panel-shadow\)/);
  }
  assert.match(value('--mission-panel-shadow'), /^4px 4px 0 var\(--mission-title\), 5px 5px 0 1px var\(--mission-ink\)$/);
  hasRule('.inspector-nav [aria-pressed="true"]', /background:\s*var\(--mission-selected\)/);
  // Safe viewport/HUD geometry stays in globals.css; this layer supplies paint only.
  assert.doesNotMatch(source, /(?:^|[;{])\s*(?:position|inset(?:-[\w-]+)?|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|display|grid[^:]*|gap|transform|z-index|pointer-events|touch-action)\s*:/m);
});

test('reading ink and semantic colours have measured contrast on the actual light surfaces', () => {
  for (const surface of ['--card', '--secondary', '--mission-hover', '--mission-selected', '--mission-success-bg', '--mission-warning-bg']) {
    for (const text of ['--foreground', '--muted-foreground', '--primary', '--sun', '--earth', '--mission-success', '--mission-warning', '--destructive', '--mission-link']) {
      assert.ok(contrast(text, surface) >= 4.5, `${text} on ${surface}`);
    }
  }
  assert.ok(contrast('--primary-foreground', '--primary') >= 4.5);
  assert.ok(contrast('--mission-ink', '--mission-title') >= 4.5);
  for (const mark of ['--sun', '--earth']) assert.ok(contrast(mark, '--mission-title') >= 3, `${mark} on title strip`);
  assert.ok(contrast('--mission-on-space', '--mission-space') >= 4.5);
  hasRule('.header-context-toolbar', /--muted-foreground:\s*var\(--mission-ink\)/);
  hasRule('math', /color:\s*var\(--foreground\)/);
});

test('renderer and independent loader palettes remain isolated, with readable stage annotations', async () => {
  assert.deepEqual((await transform(css, { loader: 'css' })).warnings, []);
  hasRule('.workspace', /background:\s*var\(--mission-space\)/);
  hasRule('[aria-label="Sun, Earth and Moon explorer"] > :is(header, p:last-child)', /color:\s*var\(--mission-on-space\)/);
  hasRule('[data-controls] > div:first-child', /color:\s*var\(--mission-on-space\)/);
  hasRule('[aria-label="Touchdown experiment controls"] [role="tooltip"]', /background:\s*var\(--mission-cream\)/);
  assert.doesNotMatch(source, /lunario-loader|@font-face|url\(|background-image\s*:|(?:^|[;{])\s*(?:filter|mix-blend-mode)\s*:/m);
  for (const rule of rules) {
    assert.doesNotMatch(rule.selector, /(?:^|[\s>+~,])(?:canvas|img)(?=[\s.#[:>+~,]|$)|(?:\.viewport|\.map-pane|\.terrain-pane)::(?:before|after)/);
    if (/\bsvg\b/.test(rule.selector)) assert.match(rule.selector, /chart|figure|lesson|inspector-section/);
  }
  hasRule(':focus-visible', /outline:\s*2px solid var\(--ring\)/);
  hasRule(':focus-visible', /box-shadow:\s*0 0 0 3px var\(--mission-cream\)/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /forced-colors:\s*active/);
});
