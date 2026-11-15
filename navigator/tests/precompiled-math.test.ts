import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import temml from 'temml';
import manifest from '../lib/generated/native-mathml.json';
import { listMathExpressions, mathRelation, mathToTex, nativeMathMarkup } from '../lib/math-typesetting';
import { MODEL_RELATIONS, VARIABLE_NOTATION } from '../lib/variable-notation';
import { PHYSICS_TOPICS } from '../lib/physics-reference';

const root = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);
const options = {
  throwOnError: true, trust: false, annotate: false,
  maxExpand: 100, maxSize: [10, 10] as [number, number], xml: true,
};

test('every registered expression preserves exact Temml 0.14.0 XML in both modes', () => {
  assert.equal(temml.version, '0.14.0');
  const registry = listMathExpressions();
  assert.deepEqual(Object.keys(manifest.entries), registry.map(item => item.expression));
  assert.equal(new Set(registry.map(item => item.expression)).size, registry.length);
  assert.deepEqual(registry.map(item => item.expression), registry.map(item => item.expression).sort());
  for (const { expression, tex } of registry) {
    assert.equal(mathToTex(expression), tex);
    for (const displayMode of [false, true]) {
      assert.equal(nativeMathMarkup(expression, displayMode), temml.renderToString(tex, { ...options, displayMode }), expression);
    }
  }
  const required = new Set([
    ...Object.values(MODEL_RELATIONS),
    ...VARIABLE_NOTATION.map(item => item.equation),
    ...PHYSICS_TOPICS.flatMap(topic => topic.equations),
  ]);
  const expressions = new Set(registry.map(item => item.expression));
  for (const notation of VARIABLE_NOTATION) assert.ok(expressions.has(notation.symbol), notation.id);
  for (const expression of required) {
    assert.ok(expressions.has(expression), expression);
    assert.equal(mathRelation(expression).tex, mathToTex(expression));
    for (const symbol of mathRelation(expression).symbols) assert.ok(expressions.has(symbol.expression), symbol.expression);
  }
  // A caller may inspect or mutate its own snapshot without changing the registry.
  Object.assign(registry[0], { tex: 'changed snapshot' });
  assert.notEqual(listMathExpressions()[0].tex, 'changed snapshot');
});

test('manifest identity covers sorted authored expressions, TeX, parser and all render options', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.parser, { name: 'temml', version: '0.14.0' });
  assert.deepEqual(manifest.options, { ...options, displayModes: [false, true] });
  const source = { parser: manifest.parser, options: manifest.options, expressions: listMathExpressions() };
  assert.equal(manifest.identity, createHash('sha256').update(JSON.stringify(source)).digest('hex'));
});

test('production browser bridge contains no Temml parser or Node generator dependency', async () => {
  const result = await build({
    entryPoints: [join(root, 'lib/math-typesetting.ts')], bundle: true, write: false,
    minify: true, platform: 'browser', format: 'esm', target: 'es2017', metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  for (const input of Object.keys(result.metafile!.inputs)) {
    assert.doesNotMatch(input, /(?:^|\/)temml(?:\/|$)|scripts\/build-mathml|node:crypto/, input);
  }
  assert.doesNotMatch(result.outputFiles[0].text, /renderToString|ParseError|MacroExpander|\\href\{/);
  for (const expression of ['', '__proto__', 'constructor', '<img src=x onerror=alert(1)>', String.raw`\frac{1}{2}`]) {
    assert.throws(() => nativeMathMarkup(expression), /Unmapped native math expression/);
  }
});

test('generator is deterministic, repairs missing output, and checks drift without changing files', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'solarreach-precompiled-math-'));
  try {
    await mkdir(join(fixture, 'scripts'));
    await mkdir(join(fixture, 'lib/generated'), { recursive: true });
    await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    for (const file of ['scripts/build-mathml.ts', 'lib/math-typesetting.ts', 'lib/variable-notation.ts', 'lib/engineering-screens.ts']) {
      await copyFile(join(root, file), join(fixture, file));
    }
    const target = join(fixture, 'lib/generated/native-mathml.json');
    const run = (...args: string[]) => execute(process.execPath, ['--import', 'tsx', 'scripts/build-mathml.ts', ...args], { cwd: fixture });
    const rejectedCheck = async (message: RegExp) => {
      await assert.rejects(run('--check'), (error: unknown) => {
        const result = error as { code: number; stderr: string };
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, message);
        return true;
      });
    };
    await rejectedCheck(/manifest is missing/);
    await assert.rejects(readFile(target), { code: 'ENOENT' });
    await run();
    const expected = await readFile(join(root, 'lib/generated/native-mathml.json'), 'utf8');
    assert.equal(await readFile(target, 'utf8'), expected);
    await run();
    assert.equal(await readFile(target, 'utf8'), expected);
    await run('--check');

    const edited = JSON.parse(expected);
    const entry = edited.entries['η'];
    const drifts = [
      { ...edited, identity: '0'.repeat(64) },
      { ...edited, parser: { ...edited.parser, version: '0.0.0' } },
      { ...edited, options: { ...edited.options, trust: true } },
      { ...edited, entries: { ...edited.entries, 'η': { ...entry, tex: 'x' } } },
      { ...edited, entries: { ...edited.entries, 'η': { ...entry, inline: '<math>drift</math>' } } },
      { ...edited, entries: { ...edited.entries, 'η': { ...entry, block: '' } } },
      { ...edited, entries: { ...edited.entries, 'η': undefined } },
      { ...edited, entries: { ...edited.entries, 'extra': entry } },
    ];
    for (const drift of [...drifts.map(value => JSON.stringify(value)), expected + '\n']) {
      await writeFile(target, drift);
      await rejectedCheck(/manifest is stale/);
      assert.equal(await readFile(target, 'utf8'), drift, '--check must never write');
    }

    const checkRuntime = (expression: string, display = false) => execute(process.execPath, ['--import', 'tsx', '-e',
      `const {nativeMathMarkup}=require('./lib/math-typesetting.ts'); console.log(nativeMathMarkup(${JSON.stringify(expression)},${display}));`,
    ], { cwd: fixture });
    for (const drift of [drifts[3], drifts[5], drifts[6]]) {
      await writeFile(target, JSON.stringify(drift));
      await assert.rejects(checkRuntime('η', true), /Missing or stale native math compilation/);
    }
    await writeFile(target, JSON.stringify(drifts[5]));
    assert.equal((await checkRuntime('η')).stdout.trim(), entry.inline);
    await run();
    assert.equal(await readFile(target, 'utf8'), expected);

    await writeFile(target, '{broken json');
    await assert.rejects(run('--check'));
    assert.equal(await readFile(target, 'utf8'), '{broken json');
    await run();
    assert.equal(await readFile(target, 'utf8'), expected);

    // Changing authored TeX must invalidate identity even if old XML is untouched.
    const registryFile = join(fixture, 'lib/math-typesetting.ts');
    const source = await readFile(registryFile, 'utf8');
    await writeFile(registryFile, source.replace("['S','S','Solar irradiance", "['S','S_0','Solar irradiance"));
    await rejectedCheck(/manifest is stale/);
    await assert.rejects(checkRuntime('S'), /Missing or stale native math compilation/);
    await run();
    assert.notEqual(JSON.parse(await readFile(target, 'utf8')).identity, manifest.identity);
    await run('--check');

    await writeFile(registryFile, source + "\nsymbol('new-authored-symbol', 'x', 'Fixture only', '1');\n");
    await assert.rejects(checkRuntime('new-authored-symbol'), /Missing or stale native math compilation/);
    await rejectedCheck(/manifest is stale/);
    await run();
    assert.match((await checkRuntime('new-authored-symbol')).stdout, /<mi>x<\/mi>/);
    await run('--check');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
