export function inspectorBounds(viewportWidth:number,analysis=false){
 const available=Math.max(240,viewportWidth-48),max=Math.min(1040,available),min=Math.min(analysis?680:360,max);return {min,max};
}
export function inspectorPanelWidth(preferred:number|null,mode:'public'|'teach'|'plan',analysis:boolean,viewportWidth:number){
 const {min,max}=inspectorBounds(viewportWidth,analysis),natural=preferred??(mode==='teach'?520:mode==='plan'?500:440);return Math.max(min,Math.min(max,natural));
}
