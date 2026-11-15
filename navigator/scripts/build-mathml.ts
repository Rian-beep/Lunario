import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import temml from 'temml';

const target = new URL('../lib/generated/native-mathml.json', import.meta.url);
const parser = { name: 'temml', version: '0.14.0' };
const options = {
  throwOnError: true, trust: false, annotate: false,
  maxExpand: 100, maxSize: [10, 10] as [number, number], xml: true,
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
    throw new Error('Usage: npx tsx scripts/build-mathml.ts [--check]');
  }
  if (temml.version !== parser.version) {
    throw new Error(`Expected Temml ${parser.version}; found ${temml.version}`);
  }
  const check = args[0] === '--check';
  let current: string | undefined;
  try {
    current = await readFile(target, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current === undefined && check) throw new Error('Native MathML manifest is missing. Run npx tsx scripts/build-mathml.ts');
  // The registry imports this file for runtime lookup. Bootstrap only this generated
  // artifact when rebuilding a clean checkout with a missing or malformed manifest.
  if (!check) {
    let validJson = false;
    if (current !== undefined) {
      try { JSON.parse(current); validJson = true; } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }
    if (!validJson) {
      await mkdir(new URL('../lib/generated/', import.meta.url), { recursive: true });
      await writeFile(target, '{"entries":{}}\n');
    }
  }
  const { listMathExpressions } = await import('../lib/math-typesetting');
  const expressions = listMathExpressions();
  const identitySource = { parser, options: { ...options, displayModes: [false, true] }, expressions };
  const identity = createHash('sha256').update(JSON.stringify(identitySource)).digest('hex');
  const entries = Object.fromEntries(expressions.map(({ expression, tex }) => [expression, {
    tex,
    inline: temml.renderToString(tex, { ...options, displayMode: false }),
    block: temml.renderToString(tex, { ...options, displayMode: true }),
  }]));
  const output = JSON.stringify({ schemaVersion: 1, identity, parser, options: identitySource.options, entries }, null, 2) + '\n';
  if (check) {
    if (current !== output) throw new Error('Native MathML manifest is stale. Run npx tsx scripts/build-mathml.ts');
  } else if (current !== output) {
    await writeFile(target, output);
  }
  console.log(`Native MathML ${check ? 'checked' : 'generated'}: ${expressions.length} expressions, SHA-256 ${identity}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
