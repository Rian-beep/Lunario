type Visibility = {sun:boolean|null;contact:boolean|null};
export function nextVisibilityChange(values:Array<boolean|null>,current:number):{kind:'change';index:number;visible:boolean}|{kind:'unknown'}|{kind:'outside'} {
  const start=Math.max(0,Math.floor(current));
  const initial=values[start];
  if(initial==null)return {kind:'unknown'};
  for(let i=start+1;i<values.length;i++){
    if(values[i]===null)return {kind:'unknown'};
    if(values[i]!==initial)return {kind:'change',index:i,visible:values[i]!};
  }
  return {kind:'outside'};
}
export function visibilityBreakdown(samples:Visibility[]){
  const result={both:0,sun:0,earth:0,neither:0,unknown:0,total:samples.length};
  for(const p of samples){if(p.sun===null||p.contact===null)result.unknown++;else if(p.sun&&p.contact)result.both++;else if(p.sun)result.sun++;else if(p.contact)result.earth++;else result.neither++;}
  return result;
}
/** A sampled transition bounds the physical event between adjacent epochs. */
export function visibilityCountdown(values:Array<boolean|null>,current:number,stepHours:number){
 if(!Number.isFinite(current)||!Number.isFinite(stepHours)||stepHours<=0)return {kind:'unknown' as const};
 const change=nextVisibilityChange(values,current);
 if(change.kind!=='change')return change;
 return {...change,earliestHours:Math.max(0,(change.index-1-current)*stepHours),latestHours:Math.max(0,(change.index-current)*stepHours)};
}

export type VisibilityCountdown = ReturnType<typeof visibilityCountdown>;
/** Presentation only: preserve the numerical bracket; never turn it into a precise event. */
export function formatVisibilityCountdown(event:VisibilityCountdown,audience:'public'|'teach'|'plan'):string {
 if(event.kind==='unknown')return 'Not enough terrain data';
 if(event.kind==='outside')return 'Beyond selected stay';
 const {earliestHours:a,latestHours:b}=event;
 if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<a)return 'Not enough terrain data';
 if(audience==='public'){
  const middle=(a+b)/2;
  if(middle>=24){const days=Math.round(middle/24);return `~${days} ${days===1?'day':'days'}`;}
  if(middle>=1){const hours=Math.round(middle);return `~${hours} ${hours===1?'hour':'hours'}`;}
  const minutes=Math.round(middle*60);return minutes<1?'<1 min':`~${minutes} min`;
 }
 if(Number.isInteger(a)&&Number.isInteger(b)){
  const ad=Math.floor(a/24),bd=Math.floor(b/24),ah=a%24,bh=b%24;
  if(ad===bd)return `${ad?`${ad}d`:''}${ah}–${bh}h`;
  const duration=(d:number,h:number)=>`${d?`${d}d`:''}${h}h`;
  return `${duration(ad,ah)}–${duration(bd,bh)}`;
 }
 // Relative cursor positions can be fractional: round the lower bound down and
 // the upper bound up to minutes, so formatting cannot narrow the source bracket.
 const duration=(minutes:number)=>{
  const d=Math.floor(minutes/1440),h=Math.floor(minutes%1440/60),m=minutes%60;
  return `${d?`${d}d`:''}${h?`${h}h`:''}${m||(!d&&!h)?`${m}m`:''}`;
 };
 return `${duration(Math.floor(a*60))}–${duration(Math.ceil(b*60))}`;
}
/** Short UTC date line plus clock-window line, retaining both dates across midnight. */
export function formatVisibilityUtcWindow(earliestMs:number,latestMs:number):{date:string;time:string}|null {
 if(!Number.isFinite(earliestMs)||!Number.isFinite(latestMs)||latestMs<earliestMs)return null;
 const a=new Date(earliestMs),b=new Date(latestMs);
 if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime()))return null;
 const month=(date:Date)=>new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(date);
 const full=(date:Date)=>`${date.getUTCDate()} ${month(date)} ${date.getUTCFullYear()}`;
 const sameYear=a.getUTCFullYear()===b.getUTCFullYear(),sameMonth=sameYear&&a.getUTCMonth()===b.getUTCMonth();
 const sameDay=sameMonth&&a.getUTCDate()===b.getUTCDate();
 const date=sameDay?full(a):sameMonth?`${a.getUTCDate()}–${b.getUTCDate()} ${month(a)} ${a.getUTCFullYear()}`:sameYear?`${a.getUTCDate()} ${month(a)}–${b.getUTCDate()} ${month(b)} ${a.getUTCFullYear()}`:`${full(a)}–${full(b)}`;
 const clock=(d:Date)=>`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
 return {date,time:`${clock(a)}–${clock(b)} UTC`};
}
