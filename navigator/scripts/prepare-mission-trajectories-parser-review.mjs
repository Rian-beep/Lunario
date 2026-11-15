import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const raw = await readFile('/tmp/lunario-trajectory-sources/ch3-descent-horizons.txt', 'utf8');
const moduleFrom = async source => import('data:text/javascript;base64,'+Buffer.from((await transform(source,{loader:'ts',format:'esm'})).code).toString('base64'));
const base = await moduleFrom(execFileSync('git',['show','3c82b5a:./lib/mission-trajectories.ts'],{cwd:root,encoding:'utf8'}));
const current = await moduleFrom(await readFile(new URL('lib/mission-trajectories.ts',root),'utf8'));
const accepts = (module,text) => {try {module.parseMissionHorizonsVectors(text,-158);return true;} catch {return false;}};
assert.equal(base.parseMissionHorizonsVectors(raw,-158).length,109);
assert.equal(current.parseMissionHorizonsVectors(raw,-158).length,109);
const firstPosition = raw.split('$$SOE')[1].trim().split(',')[2].trim();
const cases = [
  ['conflicting-frame-headers',raw.replace('Reference frame : ICRF','Reference frame : ICRF\nReference frame : Ecliptic of J2000.0')],
  ['unit-prefix-spoof',raw.replace('Output units    : KM-S','Output units    : KM-SPOOF')],
  ['hexadecimal-position',raw.replace(firstPosition,'0x10')],
  ['binary-position',raw.replace(firstPosition,'0b10')],
].map(([id,text])=>({id,baselineAccepted:accepts(base,text),currentAccepted:accepts(current,text)}));
for (const row of cases) {assert.equal(row.baselineAccepted,true);assert.equal(row.currentAccepted,false);}
const evidence = {base:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',rawSha256:createHash('sha256').update(raw).digest('hex'),unmodifiedSamples:109,cases};
await writeFile(new URL('docs/qa/evaluation/trajectories/parser-before-after.json',root),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
