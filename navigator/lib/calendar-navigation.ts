/** Focus movement only: native Enter/Space remain responsible for activation. */
export function calendarFocusIndex(index:number,count:number,key:string):number|null {
 if(!Number.isInteger(count)||count<1||!Number.isInteger(index)||index<0||index>=count)return null;
 const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
 if(key==='Home')return 0;
 if(key==='End')return count-1;
 return Object.hasOwn(delta,key)?Math.max(0,Math.min(count-1,index+delta[key])):null;
}
/** Grid and table share the same records and stable chronological ordering. */
export function chronologicalCalendarRows<T extends {state:{startIndex:number;siteId:string}}>(rows:readonly T[]):T[]{
 return [...rows].sort((a,b)=>a.state.startIndex-b.state.startIndex||a.state.siteId.localeCompare(b.state.siteId));
}
