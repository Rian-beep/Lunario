import {test} from 'node:test';
import assert from 'node:assert/strict';
import {explainAssessment,explainConstraint} from '../lib/assessment-explanation';
import type {AssessmentResult,ConstraintResult} from '../lib/planning-types';
const row=(id:string,state:ConstraintResult['state'],required=true):ConstraintResult=>({id,label:id,required,state,actual:0,limit:2000,margin:-2000,unit:'Wh',relation:'min',reasonCode:'modeled-requirement-violation',explanation:'raw model explanation',evidenceIds:['array-horizon'],firstViolation:null});
test('public explanation identifies the two pasted power failures and actionable differences',()=>{
 const reserve=explainConstraint(row('reserve','fail')),demand=explainConstraint(row('unmet-demand','fail'));
 assert.match(reserve.title,/battery/);assert.match(reserve.nextStep,/only when useful sunlight/);assert.match(demand.meaning,/cannot supply/);
 assert.equal(reserve.threshold,'2,000 Wh');assert.equal(reserve.margin,'-2,000 Wh');
});
test('required failures and unknown evidence remain separate from unchecked domains',()=>{
 const result={outcome:'fails-assessed',constraints:[row('reserve','fail'),row('unmet-demand','fail'),row('thermal-survival','not-assessed'),row('terrain-footprint','not-assessed',false)]} as AssessmentResult;
 const explanation=explainAssessment(result);assert.equal(explanation.failures.length,2);assert.equal(explanation.unknown.length,1);assert.equal(explanation.notRequested.length,1);assert.match(explanation.summary,/2 required checks fail; 1 more needs information/);
});
test('unavailable results are never presented as successful amounts',()=>{
 const c={...row('ground-support','not-assessed'),actual:null,limit:null,margin:null,unit:null};
 assert.equal(explainConstraint(c).actual,'Not available');
 assert.match(explainAssessment({outcome:'incomplete',constraints:[c]} as AssessmentResult).summary,/Missing information does not mean a safe result/);
});

test('unknown power and communication results never describe a known violation',()=>{
 for(const id of ['reserve','unmet-demand','geometric-outage','assumed-radio']){const c={...row(id,'not-assessed'),actual:null,limit:null,margin:null};const e=explainConstraint(c);assert.match(e.meaning,/not enough applicable information/);assert.doesNotMatch(e.meaning,/cannot supply|less stored energy|exceeds|does not meet/);}
});
