import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {withLandingSites} from '../lib/landing-catalog';import {LANDING_SITES} from '../lib/landing-sites';
import {decodeCatalog} from '../lib/catalog';import {parseEvidenceManifest} from '../lib/provenance';import {parseScenario,type ScenarioState} from '../lib/scenario';import {DEFAULT_MISSION} from '../lib/mission';import {DEFAULT_FLIGHT} from '../lib/flight';import {evaluateScenario,PLANNING_MODEL_VERSION} from '../lib/assessment';import {diffScenarios} from '../lib/scenario-diff';
const catalogPath='public/data/catalog.json',manifestPath='public/data/evidence-manifest.json';
const catalogBytes=readFileSync(catalogPath),manifestBytes=readFileSync(manifestPath),c=withLandingSites(decodeCatalog(JSON.parse(catalogBytes.toString())),LANDING_SITES),m=parseEvidenceManifest(JSON.parse(manifestBytes.toString()));
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
const bounds={siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours};
let evaluations=0;const maxEvaluations=1000;
function assess(state:ScenarioState){if(++evaluations>maxEvaluations)throw Error('Bounded demonstration search exhausted; no fixture fabricated');return evaluateScenario(c,state,m);}
const met=(a:ReturnType<typeof assess>)=>a.outcome==='conditional'||a.outcome==='passes-assessed';
const energyFailure=(a:ReturnType<typeof assess>)=>a.constraints.some(row=>row.required&&['reserve','unmet-demand'].includes(row.id)&&row.state==='fail')&&a.firstFailure!==null;
const demoIndex=Math.round((Date.parse(c.meta.demo.start)-c.t0ms)/(c.meta.stepHours*3600000));
const staySamples=Math.round(336/c.meta.stepHours),daySamples=24/c.meta.stepHours;
if(!Number.isInteger(daySamples)||!Number.isInteger(staySamples))throw Error('Demo requires catalog steps dividing day/stay exactly');
const hardware=[{loadW:DEFAULT_MISSION.loadW,batteryWh:DEFAULT_MISSION.batteryWh},{loadW:100,batteryWh:10000},{loadW:250,batteryWh:5000},{loadW:100,batteryWh:5000},{loadW:500,batteryWh:20000}];
const offsets=[0,...Array.from({length:20},(_,i)=>i+1).flatMap(day=>[day,-day])];
let chosen:{baseline:ScenarioState;delayed:ScenarioState;alternative:ScenarioState;delayHours:number}|null=null;
outer:for(const h of hardware)for(const offset of offsets){
 const start=demoIndex+offset*daySamples;
 const base=parseScenario({siteId:c.meta.demo.siteId,custom:null,startIndex:start,endIndex:start+staySamples-1,heightM:2,mission:{...DEFAULT_MISSION,...h},flight:DEFAULT_FLIGHT},bounds);if(!base)continue;
 if(!met(assess(base)))continue;
 for(const delayDays of [1,3,7,14]){
  const delayed={...base,startIndex:base.startIndex+delayDays*daySamples,endIndex:base.endIndex+delayDays*daySamples};if(!parseScenario(delayed,bounds))continue;
  if(!energyFailure(assess(delayed)))continue;
  // First test other prepared study sites on the delayed dates; then later dates at the same site.
  const candidates=[...c.sites.filter(s=>s.id!==base.siteId&&s.group==='artemis').map(s=>({...delayed,siteId:s.id})),...[1,3,7,14].map(days=>({...delayed,startIndex:delayed.startIndex+days*daySamples,endIndex:delayed.endIndex+days*daySamples}))];
  for(const alternate of candidates){if(parseScenario(alternate,bounds)&&met(assess(alternate))){chosen={baseline:base,delayed,alternative:alternate,delayHours:delayDays*24};break outer;}}
 }
}
if(!chosen)throw Error('No bounded real baseline/delay/restoration set found; no demonstration written');
const unknownSite=c.sites.find(s=>!s.horizons.some(h=>Array.from(h.mask).some(Number.isFinite)));if(!unknownSite)throw Error('Missing historical horizon fixture unavailable');
const unknown={...chosen.baseline,siteId:unknownSite.id,custom:null};
function fixture(role:string,state:ScenarioState){const assessment=assess(state);return {role,state,siteName:c.sites.find(s=>s.id===state.siteId)!.name,startUtc:new Date(c.t0ms+state.startIndex*c.meta.stepHours*3600000).toISOString(),endUtcExclusive:new Date(c.t0ms+(state.endIndex+1)*c.meta.stepHours*3600000).toISOString(),assessment};}
const cases=[fixture('baseline',chosen.baseline),fixture('delayed',chosen.delayed),fixture('alternative',chosen.alternative),fixture('unknown-historical',unknown)];
if(cases[3].assessment.outcome==='passes-assessed'||cases[3].assessment.outcome==='conditional')throw Error('Missing historical evidence cannot be a passing or conditional restoration');
const output={schemaVersion:1,label:'Computed resource-screening demonstration; conditional evidence, not operational readiness',datasetId:m.datasetId,modelVersion:PLANNING_MODEL_VERSION,sources:{catalog:{path:catalogPath,sha256:hash(catalogBytes)},evidenceManifest:{path:manifestPath,sha256:hash(manifestBytes)},landingSites:{path:'lib/landing-sites.ts',sha256:hash(readFileSync('lib/landing-sites.ts'))},landingCatalog:{path:'lib/landing-catalog.ts',sha256:hash(readFileSync('lib/landing-catalog.ts'))}},validFromUtc:m.validFromUtc,validUntilUtcExclusive:m.validUntilUtcExclusive,stayHours:staySamples*c.meta.stepHours,delayHours:chosen.delayHours,search:{evaluations,maxEvaluations,hardwareCandidates:hardware,dateOffsetsDays:offsets,delayCandidatesDays:[1,3,7,14]},controlledDifferences:{baselineToDelay:diffScenarios(chosen.baseline,chosen.delayed),delayToAlternative:diffScenarios(chosen.delayed,chosen.alternative)},cases};
writeFileSync('public/data/planning-demo.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({evaluations,cases:cases.map(v=>({role:v.role,site:v.siteName,start:v.startUtc,outcome:v.assessment.outcome,firstFailure:v.assessment.firstFailure,unmetWh:v.assessment.mission.unmetWh}))},null,2));
