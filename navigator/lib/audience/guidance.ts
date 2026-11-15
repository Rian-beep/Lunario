import {indexToMs} from '../astro';
import type {Catalog} from '../catalog';
import type {AssessmentResult} from '../planning-types';
import type {ScenarioState} from '../scenario';

export const OUTCOME_TEXT:Record<AssessmentResult['outcome'],string>={
 'fails-assessed':'The modeled stay breaks a required limit.',
 incomplete:'The whole stay cannot be judged: required evidence is missing.',
 conditional:'The tested requirements are met only under incomplete or assumed evidence.',
 'passes-assessed':'The tested requirements are met under the stated model assumptions.',
 'not-configured':'No whole-stay requirements have been configured.',
};
export type GuidanceEvent={label:string;earliestMs:number;latestMs:number;kind:'failure'|'sun'|'contact'|'unknown'};
export function audienceGuidance(catalog:Catalog,state:ScenarioState,assessment:AssessmentResult,playhead:number){
 const timeline=assessment.mission.timeline,sphere=assessment.sphereMission.timeline;
 const inStay=Number.isFinite(playhead)&&playhead>=state.startIndex&&playhead<state.endIndex+1;
 const local=inStay?Math.floor(playhead)-state.startIndex:-1;
 const current=timeline[local]??null,currentSphere=sphere[local]??null;
 const events:GuidanceEvent[]=[];
 if(inStay){
  for(const channel of ['sun','contact'] as const){
   const initial=current?.[channel];
   if(initial===null||initial===undefined)continue;
   for(let i=local+1;i<timeline.length;i++){
    const value=timeline[i][channel];
    if(value===null){events.push({kind:'unknown',label:channel==='sun'?'Sunlight evidence ends':'Earth-view evidence ends',earliestMs:indexToMs(catalog,state.startIndex+i-1),latestMs:indexToMs(catalog,state.startIndex+i)});break;}
    if(value!==initial){events.push({kind:channel,label:channel==='sun'?(value?'Sunlight returns':'Sunlight is lost'):(value?'Earth view returns':'Earth view is lost'),earliestMs:indexToMs(catalog,state.startIndex+i-1),latestMs:indexToMs(catalog,state.startIndex+i)});break;}
   }
  }
  for(const row of assessment.constraints){const e=row.required&&row.state==='fail'?row.firstViolation:null;if(e&&Date.parse(e.latestUtc)>=indexToMs(catalog,playhead))events.push({kind:'failure',label:row.label,earliestMs:Date.parse(e.earliestUtc),latestMs:Date.parse(e.latestUtc)});}
 }
 events.sort((a,b)=>a.latestMs-b.latestMs||Number(b.kind==='failure')-Number(a.kind==='failure'));
 const required=assessment.constraints.filter(r=>r.required);
 const counts={pass:0,fail:0,conditional:0,'not-assessed':0};for(const row of required)counts[row.state]++;
 const missing=assessment.constraints.filter(r=>r.relation==='evidence'&&r.state==='not-assessed');
 const failures=required.filter(r=>r.state==='fail');
 const powerProblem=failures.some(r=>r.id==='reserve'||r.id==='unmet-demand'||r.id==='screen:maxUnmetWh'||r.id==='screen:minBatteryWh');
 const percent=(samples:typeof timeline,key:'sun'|'contact')=>!samples.length||samples.some(r=>r[key]===null)?null:100*samples.filter(r=>r[key]).length/samples.length;
 const stay={sun:percent(timeline,'sun'),contact:percent(timeline,'contact'),sphereSun:percent(sphere,'sun'),sphereContact:percent(sphere,'contact')};
 const plainLabel=(sun:boolean|null|undefined,contact:boolean|null|undefined)=>`${sun==null?'We do not know whether sunlight reaches this point':sun?'Some sunlight reaches this point':'This point is in shadow'} · ${contact==null?'The antenna’s Earth view is unknown':contact?'Earth is high enough for the chosen antenna viewing limit':'Earth is hidden or too low for the chosen antenna viewing limit'}`;
 const currentLabel=(sun:boolean|null|undefined,contact:boolean|null|undefined)=>`${sun==null?'Sunlight unknown':sun?'Some sunlight':'In shadow'} · ${contact==null?'Earth view unknown':contact?'Earth above antenna cutoff':'Earth blocked or below cutoff'}`;
 return {currentPublic:inStay?plainLabel(current?.sun,current?.contact):'The displayed time is outside this stay',currentSpherePublic:inStay?plainLabel(currentSphere?.sun,currentSphere?.contact):'Outside this stay',current:inStay?currentLabel(current?.sun,current?.contact):'Playhead outside selected stay',currentSphere:inStay?currentLabel(currentSphere?.sun,currentSphere?.contact):'Outside selected stay',stay,counts,missing,failures,event:events[0]??null,whole:OUTCOME_TEXT[assessment.outcome],next:failures.length?'replan' as const:'inspect' as const,nextLabel:powerProblem?'Compare a different arrival or power setup':failures.length?'Compare a change to the failed requirement':'Inspect sunlight and Earth windows'};
}
