/** false means absence, null means unknown. A boundary-touching run is censored by the observation window. */
export function observedAbsence(visible:readonly (boolean|null)[],stepHours:number):{hours:number;lowerBound:boolean;entireWindow:boolean}|null{
 if(!Number.isFinite(stepHours)||stepHours<=0)throw new RangeError('Sampling hours must be positive and finite.');
 if(!visible.length||visible.some(v=>v===null))return null;
 let start=-1,best=0,boundary=false;
 for(let i=0;i<=visible.length;i++){
  if(i<visible.length&&visible[i]===false){if(start<0)start=i;}
  else if(start>=0){const count=i-start,edge=start===0||i===visible.length;if(count>best){best=count;boundary=edge;}else if(count===best)boundary ||=edge;start=-1;}
 }
 return {hours:best*stepHours,lowerBound:boundary,entireWindow:best===visible.length};
}
export function observedAbsenceNote(run:ReturnType<typeof observedAbsence>,kind:string):string{
 if(!run)return 'Source coverage is incomplete; no complete-window duration is known.';
 return run.entireWindow?`No ${kind} in the entire selected stay. At least ${run.hours.toLocaleString('en-US')} h observed; the actual run may extend beyond these dates.`:run.lowerBound?'The longest observed run touches a selected-date boundary; its full duration may be longer.':'Longest complete run inside the selected dates; limited by source sampling.';
}
