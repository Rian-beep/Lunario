import {createHash} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,dirname} from 'node:path';import {spawnSync} from 'node:child_process';
const base=process.cwd(),binding='docs/qa/scientific-audit/integration/receipt-bindings.json';
test('scientific register refuses stale input, numerical implementation, inventory and failed receipts before writing outputs',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lunario-audit-register-'));try{
 const hashes=JSON.parse(readFileSync(binding,'utf8')).sha256 as Record<string,string>;
 const registered=(JSON.parse(readFileSync('docs/qa/scientific-audit/sources/inventory.json','utf8')).assets as {path:string;manifestMatches:boolean|null}[]).filter(row=>row.manifestMatches!==null).map(row=>row.path);
 for(const file of [binding,'scripts/compile-scientific-verification.py',...Object.keys(hashes),...registered]){mkdirSync(dirname(join(dir,file)),{recursive:true});copyFileSync(join(base,file),join(dir,file));}
 mkdirSync(join(dir,'lib/generated'),{recursive:true});
 const run=()=>spawnSync('python3',['scripts/compile-scientific-verification.py'],{cwd:dir,encoding:'utf8'});
 const valid=run();assert.equal(valid.status,0,valid.stderr);const output=join(dir,'lib/generated/scientific-verification.json'),originalOutput=readFileSync(output,'utf8');
 const check=spawnSync('python3',['scripts/compile-scientific-verification.py','--check'],{cwd:dir,encoding:'utf8'});assert.equal(check.status,0,check.stderr);assert.equal(readFileSync(output,'utf8'),originalOutput);
 const compiled=JSON.parse(originalOutput);assert.ok(compiled.compiledUtc&&!compiled.checkedUtc);for(const id of ['E01','E02','E06','E07']){const row=compiled.findings.find((r:{id:string})=>r.id===id);assert.equal(row.inputIdentity.catalogSha256,compiled.assetHashes['public/data/catalog.json']);assert.ok(row.historicalBaseline);assert.match(JSON.stringify(row.reproduce),/expected exit 0/);assert.doesNotMatch(JSON.stringify(row.reproduce),/expected exit 1/);}assert.match(compiled.findings.find((r:{id:string})=>r.id==='S14').scope,/all matching/);
 const cases:[string,(text:string)=>string][]=[
 ['public/data/catalog.json',text=>text+' '],
 ['lib/astro.ts',text=>text+'\n// numerical input mutation probe\n'],
 ['lib/engineering-evidence/communications.ts',text=>text+'\n// subsystem mutation probe\n'],
 ['docs/qa/scientific-audit/integration/terrain-registration-after.json',text=>JSON.stringify({...JSON.parse(text),errorM:1})],
 ['docs/qa/scientific-audit/integration/pipeline-after.json',text=>JSON.stringify({...JSON.parse(text),fixed:false,unknownRayBecameFinite:true,missingRayHorizonDeg:-.16})],
 ['docs/qa/scientific-audit/sources/inventory.json',text=>text+' '],
 ];
 for(const [file,mutate] of cases){const path=join(dir,file),original=readFileSync(path,'utf8');writeFileSync(path,mutate(original));const failed=run();assert.notEqual(failed.status,0,file);assert.match(failed.stderr,/Stale scientific evidence/);assert.equal(readFileSync(output,'utf8'),originalOutput,'Failed audit must not replace published findings');writeFileSync(path,original);}
 // Rebinding a failed CLPS comparison cannot turn it into a passing published claim.
 const clps='docs/qa/evaluation/integration/clps-source-comparison.json',clpsPath=join(dir,clps),clpsOriginal=readFileSync(clpsPath,'utf8'),bindingsOriginal=readFileSync(join(dir,binding),'utf8');
 const badClps=JSON.parse(clpsOriginal);badClps.datasets[0].maximumPositionComponentResidualKm=1;writeFileSync(clpsPath,JSON.stringify(badClps));
 const clpsBindings=JSON.parse(bindingsOriginal);clpsBindings.sha256[clps]=createHash('sha256').update(readFileSync(clpsPath)).digest('hex');writeFileSync(join(dir,binding),JSON.stringify(clpsBindings));
 const rejectedClps=run();assert.notEqual(rejectedClps.status,0);assert.match(rejectedClps.stderr,/CLPS source residual failed/);assert.equal(readFileSync(output,'utf8'),originalOutput);
 writeFileSync(clpsPath,clpsOriginal);writeFileSync(join(dir,binding),bindingsOriginal);
 // Even an explicitly rebound bad result cannot pass the outcome gate.
 const terrain='docs/qa/scientific-audit/integration/terrain-registration-after.json',path=join(dir,terrain);writeFileSync(path,JSON.stringify({...JSON.parse(readFileSync(path,'utf8')),errorM:1}));
 const binds=JSON.parse(readFileSync(join(dir,binding),'utf8'));binds.sha256[terrain]=createHash('sha256').update(readFileSync(path)).digest('hex');writeFileSync(join(dir,binding),JSON.stringify(binds));const failed=run();assert.notEqual(failed.status,0);assert.match(failed.stderr,/Terrain comparison failed/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
