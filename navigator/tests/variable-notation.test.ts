import test from 'node:test';import assert from 'node:assert/strict';
import {VARIABLE_NOTATION,resolveVariableNotation,MODEL_RELATIONS} from '../lib/variable-notation';
import {ENGINEERING_SCREEN_FIELDS} from '../lib/engineering-screens';
test('core notation gives actual Greek symbols and unit-aware model relations',()=>{
 for(const [label,symbol]of [['Cell efficiency','η'],['System loss','ℓ'],['Array tilt','β'],['Array azimuth','α'],['Latitude','φ'],['Longitude','λ'],['Specific impulse','Isp'],['Initial pitch','γ'],['Heading','χ']])assert.equal(resolveVariableNotation(label)?.symbol,symbol);
 assert.match(MODEL_RELATIONS.battery,/Δt/);assert.match(resolveVariableNotation('Battery capacity')!.limits,/HOURS/);assert.match(resolveVariableNotation('Battery capacity')!.limits,/3600 J/);assert.match(resolveVariableNotation('Latitude')!.limits,/radians/);
 assert.notEqual(resolveVariableNotation('Load start offset')?.id,resolveVariableNotation('Time UTC')?.id);assert.notEqual(resolveVariableNotation('Solar-array height')?.id,resolveVariableNotation('Antenna height')?.id);
});
test('every notation entry has complete explanations and unique identifiers',()=>{
 const ids=new Set<string>();for(const n of VARIABLE_NOTATION){assert.ok(!ids.has(n.id));ids.add(n.id);for(const key of ['symbol','label','unit','equation','meaning','measures','intuition','limits']as const)assert.ok(n[key].trim().length>0,`${n.id} missing ${key}`);assert.doesNotMatch(n.equation,/\\frac|\\alpha|\$\$/);}
 assert.equal(resolveVariableNotation('unmapped narrative status'),null);
});
test('all seven scoped engineering domains retain descriptor-backed meanings and limits',()=>{
 assert.equal(Object.keys(ENGINEERING_SCREEN_FIELDS).length,7);for(const[domain,fields]of Object.entries(ENGINEERING_SCREEN_FIELDS))for(const f of fields){const n=VARIABLE_NOTATION.find(n=>n.id===`engineering:${domain}:${f.id}`);assert.ok(n);assert.equal(n.unit,f.unit);assert.equal(n.intuition,f.intuition);assert.ok(n.limits.length>40);assert.ok(resolveVariableNotation(f.label));}
});

test('actual power input labels resolve without conflating initial and reserve charge',()=>{for(const label of ['Incident flux','Tilt from horizontal','Panel azimuth','Usable capacity','Initial charge','Reserve threshold','Time (UTC)'])assert.ok(resolveVariableNotation(label),label);assert.notEqual(resolveVariableNotation('Initial charge')!.id,resolveVariableNotation('Reserve threshold')!.id);});

test('actual flight and radio fields resolve to quantities with correct time and noise distinctions',()=>{
 for(const label of ['Start altitude','Horizontal speed','Vertical speed','Burn duration','Preview duration','Frequency','Transmit power','Total other losses','System noise','Data rate','Required Eb/N₀'])assert.ok(resolveVariableNotation(label),label);
 assert.match(resolveVariableNotation('System noise')!.limits,/not the station air temperature/);assert.match(resolveVariableNotation('Frequency')!.measures,/10⁹ Hz/);assert.notEqual(resolveVariableNotation('Preview duration')!.id,resolveVariableNotation('Surface stay')!.id);assert.match(resolveVariableNotation('Vertical speed')!.unit,/upward positive/);
});

test('Greek letter names are explained without renaming Latin quantities or confusing the antenna mask',()=>{assert.match(resolveVariableNotation('Cell efficiency')!.meaning,/η is eta/);assert.match(resolveVariableNotation('Initial pitch')!.meaning,/γ is gamma/);assert.match(resolveVariableNotation('Minimum antenna elevation')!.meaning,/θ is theta/);assert.match(resolveVariableNotation('Minimum antenna elevation')!.measures,/not the physical antenna height/);assert.equal(resolveVariableNotation('Thrust')!.symbol,'T');assert.equal(resolveVariableNotation('Battery capacity')!.symbol,'C_B');});

test('radio decoding threshold, computed margin and required margin remain distinct quantities',()=>{const labels=['Required Eb/N₀','Link margin','Minimum assumed radio margin'];assert.equal(new Set(labels.map(l=>resolveVariableNotation(l)!.id)).size,3);assert.notEqual(resolveVariableNotation('Flight time (s)')!.id,resolveVariableNotation('Preview duration')!.id);assert.match(resolveVariableNotation('Required Eb/N₀')!.limits,/no universal/);});

test('antenna notation matches the Earth-centre predicate and absolute zero-degree cutoff',()=>{
 for(const label of ['Antenna height','Minimum antenna elevation']){
  const item=resolveVariableNotation(label);assert.ok(item);
  assert.match(item.equation,/^contact = h⊕ > max\(horizon_ant,/);
  assert.doesNotMatch(item.equation,/diskFraction|ρ⊕/);
 }
 assert.match(resolveVariableNotation('Minimum antenna elevation')!.meaning,/Zero degrees remains an active/);
});
