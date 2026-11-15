import type {SensitivityCase,SensitivityResult} from './sensitivity';
const rank:Record<string,number>={'passes-assessed':0,conditional:1,'fails-assessed':2};
const comparable=(c:SensitivityCase)=>!!c.assessment&&Object.hasOwn(rank,c.assessment.outcome);
const margin=(c:SensitivityCase)=>c.assessment?.constraints.find(v=>v.id==='reserve')?.margin??null;
function compare(a:SensitivityCase,b:SensitivityCase){
 const order=rank[a.assessment!.outcome]-rank[b.assessment!.outcome];if(order)return Math.sign(order);
 const av=margin(a),bv=margin(b);return av===null||bv===null?0:av===bv?0:av>bv?-1:1;
}
export function summarizeSensitivity(result:SensitivityResult){
 const firstFailed=result.cases.find(c=>c.assessment?.constraints.some(v=>v.required&&v.state==='fail'))??null;
 const boundaries:Array<{axis:number;fixed:number|null;previous:number|null;failed:number;constraints:string[];unknownBefore:boolean}>=[];
 for(let axis=0;axis<result.axes.length;axis++){
  const other=axis===0?1:0,fixed=result.axes[other]?[...new Set(result.axes[other].values)]:[null];
  for(const condition of fixed){
   let previous:number|null=null,unknownBefore=false;
   for(const value of [...new Set(result.axes[axis].values)]){
    const c=result.cases.find(c=>c.values[axis]===value&&(condition===null||c.values[other]===condition));
    if(!c?.assessment||c.assessment.outcome==='incomplete'||c.assessment.outcome==='not-configured')unknownBefore=true;
    const failures=c?.assessment?.constraints.filter(v=>v.required&&v.state==='fail')??[];
    if(failures.length){boundaries.push({axis,fixed:condition,previous,failed:value,constraints:failures.map(v=>v.label),unknownBefore});break;}
    if(c&&comparable(c))previous=value;
   }
  }
 }
 const reversals:Array<{left:number;right:number;beforeCondition:number;afterCondition:number;beforePreferred:number;afterPreferred:number}>=[];
 if(result.axes.length===2){
  const candidates=[...new Set(result.axes[0].values)],conditions=[...new Set(result.axes[1].values)];
  for(let a=0;a<candidates.length;a++)for(let b=a+1;b<candidates.length;b++){
   let previous:{condition:number;order:number}|null=null;
   for(const condition of conditions){
    const left=result.cases.find(c=>c.values[0]===candidates[a]&&c.values[1]===condition),right=result.cases.find(c=>c.values[0]===candidates[b]&&c.values[1]===condition);
    if(!left||!right||!comparable(left)||!comparable(right)){previous=null;continue;}
    const order=compare(left,right);if(order===0){previous=null;continue;}
    if(previous&&previous.order!==order)reversals.push({left:candidates[a],right:candidates[b],beforeCondition:previous.condition,afterCondition:condition,beforePreferred:previous.order<0?candidates[a]:candidates[b],afterPreferred:order<0?candidates[a]:candidates[b]});
    previous={condition,order};
   }
  }
 }
 return {firstFailed,boundaries,reversals,excluded:result.cases.filter(c=>!comparable(c)).length,policy:'Compare assessed outcome first, then reserve margin (larger is preferred). Ties and missing margins establish no ordering. Invalid, incomplete and unconfigured cases do not establish a ranking.'};
}
