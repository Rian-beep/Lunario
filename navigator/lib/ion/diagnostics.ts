export type IonFailure={stage:'endpoint'|'manifest'|'tile-fetch'|'mesh-decode'|'renderer';status?:number};
/** Return only a bounded HTTP status; provider messages/URLs may contain credentials. */
export function ionHttpStatus(error:unknown):number|undefined{
 if(!(error instanceof Error))return undefined;
 const match=error.message.match(/\b(?:status|code)\s*[:=]?\s*(\d{3})\b/i),status=match?Number(match[1]):NaN;
 return Number.isInteger(status)&&status>=400&&status<=599?status:undefined;
}
export function ionFailureLabel(failure?:IonFailure):string{
 if(!failure)return '';
 const status=Number.isInteger(failure.status)&&failure.status!>=400&&failure.status!<=599?`; HTTP ${failure.status}`:'';
 return ` Stage: ${failure.stage}${status}.`;
}
