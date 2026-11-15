import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';
import {parseEvidenceManifest} from '../lib/provenance';
import {parseScenario} from '../lib/scenario';
import {DEFAULT_MISSION} from '../lib/mission';
import {DEFAULT_FLIGHT} from '../lib/flight';
import {evaluateScenario} from '../lib/assessment';
import {selectedSolarResponse} from '../lib/audience/experiments';
import {createLessonMaterial,lessonMaterialHtml,MATERIAL_TOPICS} from '../lib/education-materials';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),m=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const base=parseScenario({siteId:c.sites[0].id,custom:null,startIndex:100,endIndex:110,heightM:2,mission:DEFAULT_MISSION,flight:DEFAULT_FLIGHT},{siteIds:c.sites.map(s=>s.id),samples:c.meta.n})!;
test('teaching material captures exact scenario and authority results, without mutating inputs',()=>{
 const before=structuredClone(base),sheet=createLessonMaterial(c,m,base),a=evaluateScenario(c,base,m);
 assert.deepEqual(base,before);assert.equal(sheet.scenarioKey,a.scenarioKey);assert.equal(sheet.datasetId,a.datasetId);assert.equal(sheet.modelVersion,a.modelVersion);assert.deepEqual(sheet.questions.map(q=>q.topic),MATERIAL_TOPICS);
 assert.equal(sheet.questions[1].values[2].value,a.mission.minBatteryWh);assert.equal(sheet.questions[2].values[0].value,a.mission.generatedWh);assert.equal(sheet.questions[3].values[0].value,a.mission.contactFraction);
 const derivative=selectedSolarResponse(c,m,base,0).derivative;assert.ok(sheet.questions[0].answer.includes(derivative===null?'Unavailable':derivative.toLocaleString('en-GB',{maximumFractionDigits:6})));
 assert.equal(Date.parse(sheet.endExclusiveUtc)-Date.parse(sheet.arrivalUtc),(base.endIndex-base.startIndex+1)*c.meta.stepHours*3600000);
 const original=sheet.scenario.mission.loadW;const changed=structuredClone(base);changed.mission.loadW++;assert.equal(sheet.scenario.mission.loadW,original);
});
test('student export contains native notation and givens but no hidden answer key or scenario JSON',()=>{
 const sheet=createLessonMaterial(c,m,base);sheet.questions[0].answer='SECRET_TEACHER_ANSWER';
 const student=lessonMaterialHtml(sheet),teacher=lessonMaterialHtml(sheet,true);
 assert.match(student,/<math/);assert.match(student,/Space for your reasoning/);assert.ok(!student.includes('SECRET_TEACHER_ANSWER'));assert.ok(!student.includes('"scenario"'));assert.ok(teacher.includes('SECRET_TEACHER_ANSWER'));assert.match(teacher,/Teacher answer key/);
});
test('title and edited prompts are escaped in both exports, authored formulae alone render as markup',()=>{
 const sheet=createLessonMaterial(c,m,base,['reserve'],'<script>bad()</script>');sheet.questions[0].prompt='<img src=x onerror=bad()> ';sheet.questions[0].hint='</p><script>bad()</script>';
 for(const teacher of [false,true]){const html=lessonMaterialHtml(sheet,teacher);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.match(html,/<math/);}
 assert.throws(()=>createLessonMaterial(c,m,base,[]),/Choose/);assert.equal(createLessonMaterial(c,m,base,['reserve','reserve']).questions.length,1);
});
test('unknown mission values stay unavailable and the evidence lesson cannot certify readiness',()=>{
 const custom={...structuredClone(base),custom:{lat:25,lon:30}};const sheet=createLessonMaterial(c,m,custom);
 assert.equal(sheet.questions[1].values[2].value,null);assert.match(sheet.questions[1].answer,/Unavailable/);assert.match(sheet.questions[3].answer,/Unknown values remain unknown/);assert.match(sheet.questions[4].prompt,/prevent an operational approval/);
});
test('student problems include frozen collecting factors and assessment evidence required to solve them',()=>{
 const sheet=createLessonMaterial(c,m,base),response=selectedSolarResponse(c,m,base,0),a=evaluateScenario(c,base,m);
 assert.equal(sheet.questions[0].values.find(v=>v.label.startsWith('Combined'))?.value,response.activeFactor);
 assert.ok(sheet.questions[0].context?.some(v=>v.includes('share of this interval')));
 assert.ok(sheet.questions[4].context?.some(v=>v.includes(a.constraints[0].label)));
 assert.ok(sheet.questions[4].context?.some(v=>v.includes(a.evidence[0].label)));
 const frozen=JSON.stringify(sheet.questions);base.mission.loadW++;assert.equal(JSON.stringify(sheet.questions),frozen);base.mission.loadW--;
 const html=lessonMaterialHtml(sheet);assert.match(html,/Captured evidence and givens/);assert.match(html,/Combined visible-disk/);
});
test('reserve legends and givens use native symbolic subscripts rather than rejected literal identifiers',()=>{
 const sheet=createLessonMaterial(c,m,base,['reserve']);const html=lessonMaterialHtml(sheet);
 assert.doesNotMatch(html,/\b(?:M_reserve|E_B|C_B|f_reserve)\b/);assert.ok((html.match(/<math/g)??[]).length>=7);assert.match(html,/Protected reserve fraction/);assert.match(html,/Battery capacity/);
});
test('student givens distinguish a known zero collecting response from missing forcing with the same zero hardware',()=>{
 const zero={...structuredClone(base),mission:{...base.mission,areaM2:0}};
 const known=createLessonMaterial(c,m,zero,['solar']),unknown=createLessonMaterial(c,m,{...zero,custom:{lat:25,lon:30}},['solar']);
 assert.equal(selectedSolarResponse(c,m,zero,0).derivative,0);assert.equal(selectedSolarResponse(c,m,{...zero,custom:{lat:25,lon:30}},0).derivative,null);
 assert.match(known.questions[0].context![0],/is available/);assert.match(unknown.questions[0].context![0],/is unavailable/);
 const article=(sheet:typeof known)=>lessonMaterialHtml(sheet).match(/<article>[\s\S]*?<\/article>/)![0];assert.notEqual(article(known),article(unknown));assert.match(article(unknown),/Do not infer a numerical power response/);
});
