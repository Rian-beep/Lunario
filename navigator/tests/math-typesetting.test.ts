import test from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MODEL_RELATIONS, VARIABLE_NOTATION } from '../lib/variable-notation';
import { PHYSICS_TOPICS } from '../lib/physics-reference';
import { mathToTex, mathRelation, nativeMathMarkup } from '../lib/math-typesetting';
import { NativeMath } from '../components/workbench/native-math';
Object.assign(globalThis, { React });
const visibleText = (html: string) => html.replace(/<[^>]*>/g, '');
const required = [...new Set([...Object.values(MODEL_RELATIONS), ...VARIABLE_NOTATION.map(item => item.equation), ...PHYSICS_TOPICS.flatMap(topic => topic.equations)])];

test('every required model, variable and physics relation has exact native MathML with a symbol/unit key', () => {
  for (const expression of required) {
    const relation = mathRelation(expression);
    assert.equal(mathToTex(expression), relation.tex, expression);
    assert.ok(relation.behavior.length > 50, expression);
    assert.ok(relation.symbols.length > 0, expression);
    for (const symbol of relation.symbols) {
      assert.ok(symbol.meaning && symbol.unit, `${expression}: ${symbol.expression}`);
      assert.equal(mathToTex(symbol.expression), symbol.tex);
    }
    const markup = nativeMathMarkup(expression);
    assert.match(markup, /^<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
    assert.doesNotMatch(markup, /merror|temml-error|<annotation|<script|<img|<svg/);
    assert.doesNotMatch(visibleText(markup), /_|\\|\$/);
  }
});

test('every notation symbol including all engineering descriptors is native, with no visible legacy underscores', () => {
  for (const notation of VARIABLE_NOTATION) {
    const markup = nativeMathMarkup(notation.symbol);
    assert.match(markup, /<math/);
    assert.doesNotMatch(visibleText(markup), /_|\\|\$/);
  }
});

test('missing mappings and untrusted markup fail explicitly instead of silently showing raw math', () => {
  for (const expression of ['M_new = E_B', '<img src=x onerror=alert(1)>', String.raw`\href{javascript:alert(1)}{x}`, '']) {
    assert.throws(() => nativeMathMarkup(expression), /Unmapped native math expression/);
    assert.throws(() => mathRelation(expression), /Unmapped required relation/);
  }
});

test('native structure includes Greek, real subscripts, powers, fractions, upright named operators and vector accents', () => {
  const reserve = nativeMathMarkup(MODEL_RELATIONS.reserve);
  assert.match(reserve, /<msub>/);
  assert.match(reserve, /<mi>min<\/mi>/);
  const battery = nativeMathMarkup(MODEL_RELATIONS.battery);
  assert.match(battery, /<mfrac>/);
  assert.match(battery, /η/);
  assert.match(nativeMathMarkup('P_rad = ε σ A_rad T⁴'), /<msup>/);
  assert.match(nativeMathMarkup('a⃗ = (T / m) û_thrust − μ r⃗ / |r⃗|³'), /<mover>/);
  assert.match(nativeMathMarkup('L_fs = 20 log₁₀(4π R f / c)'), /<mi>log<\/mi>/);
  assert.equal(mathRelation('E_B(arrival) = f₀ C_B').symbols.find(s => s.expression === 'f₀')?.unit, 'fraction (0–1)');
});

test('NativeMath keeps one semantic math root, the legacy accessible name and offline system math fonts', () => {
  const html = renderToStaticMarkup(createElement(NativeMath, { expression: MODEL_RELATIONS.reserve, display: true }));
  const root = html.match(/<math[^>]*>/)![0];
  assert.equal((html.match(/<math\b/g) ?? []).length, 1);
  assert.equal((root.match(/aria-label=/g) ?? []).length, 1);
  assert.equal((root.match(/style=/g) ?? []).length, 1);
  assert.doesNotMatch(html, /role="math"|@font-face|woff|<link|<script|src=/);
  assert.match(root, /aria-label="M_reserve = min\(E_B\) − f_reserve C_B"/);
  assert.match(root, /display="block"/);
  assert.match(root, /Cambria Math,STIX Two Math/);
  assert.doesNotMatch(visibleText(html), /_/);
  const named = renderToStaticMarkup(createElement(NativeMath, { expression: 'η', label: '<eta> "conversion"' }));
  assert.match(named, /aria-label="&lt;eta&gt; &quot;conversion&quot;"/);
  assert.doesNotMatch(named, /<eta>/);
});

test('inline and display output stay independent after rendering the whole catalog repeatedly', () => {
  for (let pass = 0; pass < 2; pass++) {
    for (const expression of [...required, ...VARIABLE_NOTATION.map(item => item.symbol)]) {
      assert.match(nativeMathMarkup(expression, true), /display="block"/);
      assert.doesNotMatch(nativeMathMarkup(expression, false), /display="block"/);
    }
  }
});
