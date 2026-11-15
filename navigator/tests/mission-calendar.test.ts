import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarFocusIndex,chronologicalCalendarRows} from '../lib/calendar-navigation';
test('calendar arrows move one or seven records and clamp at both boundaries',()=>{
 for(const [key,expected] of [['ArrowLeft',7],['ArrowRight',9],['ArrowUp',1],['ArrowDown',15],['Home',0],['End',30]] as const)assert.equal(calendarFocusIndex(8,31,key),expected);
 assert.equal(calendarFocusIndex(0,31,'ArrowLeft'),0);
 assert.equal(calendarFocusIndex(2,31,'ArrowUp'),0);
 assert.equal(calendarFocusIndex(29,31,'ArrowDown'),30);
 assert.equal(calendarFocusIndex(30,31,'ArrowRight'),30);
});
test('activation and unrelated keys remain native; empty and invalid focus requests are inert',()=>{
 for(const key of ['Enter',' ','Tab','Escape','PageDown'])assert.equal(calendarFocusIndex(0,31,key),null);
 for(const [index,count] of [[0,0],[-1,31],[31,31],[.5,31],[0,NaN]])assert.equal(calendarFocusIndex(index,count,'End'),null);
});
test('grid/table ordering retains all 31 exact assessment record identities without mutating results',()=>{
 const records=Array.from({length:31},(_,i)=>({state:{startIndex:30-i,siteId:'A'},assessment:{scenarioKey:`case-${i}`,outcome:i%2?'conditional':'fails-assessed'}}));
 const before=structuredClone(records),ordered=chronologicalCalendarRows(records);
 assert.equal(ordered.length,31);assert.deepEqual(ordered.map(r=>r.state.startIndex),Array.from({length:31},(_,i)=>i));
 for(const row of ordered)assert.equal(row,records.find(r=>r.assessment.scenarioKey===row.assessment.scenarioKey));
 assert.deepEqual(records,before);
 const tied=[{state:{startIndex:1,siteId:'B'}},{state:{startIndex:1,siteId:'A'}}];
 assert.deepEqual(chronologicalCalendarRows(tied).map(r=>r.state.siteId),['A','B']);
});
