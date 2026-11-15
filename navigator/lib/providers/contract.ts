export type ProviderKind='observation'|'forecast'|'climatology'|'display-composite'|'geometry'|'allocation';
export type ProviderCoverage='complete'|'partial'|'unavailable';
export type ProviderEnvelope<T>={
 providerId:string;parserVersion:string;kind:ProviderKind;requestKey:string;
 requestedStartUtc:string;requestedEndUtcExclusive:string;
 observedStartUtc:string|null;observedEndUtcExclusive:string|null;issuedUtc:string|null;
 retrievedUtc:string;expiresUtc:string|null;coverage:ProviderCoverage;
 units:Record<string,string>;sourceUrls:string[];sourceSha256:string|null;warnings:string[];value:T|null;
};
export type MissionPeriod={startUtc:string;endUtcExclusive:string};
export function validUtc(value:string):boolean{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
 return new Date(value).toISOString().slice(0,19)===value.slice(0,19);
}
export function validateMissionPeriod(period:MissionPeriod):void{
 if(!validUtc(period.startUtc)||!validUtc(period.endUtcExclusive)||Date.parse(period.endUtcExclusive)<=Date.parse(period.startUtc))throw new RangeError('Mission period must have ordered valid UTC instants and an exclusive end');
}
/** Identity includes the actual selected interval and parser/product, not fetch time. */
export function providerRequestKey(providerId:string,parserVersion:string,period:MissionPeriod):string{
 validateMissionPeriod(period);return JSON.stringify([providerId,parserVersion,period.startUtc,period.endUtcExclusive]);
}
export function providerFreshness<T>(data:ProviderEnvelope<T>,nowMs:number):'fresh'|'stale'|'unavailable'{
 if(!Number.isFinite(nowMs))throw new RangeError('Freshness time must be finite');
 if(data.value===null||data.coverage==='unavailable')return 'unavailable';
 const expires=data.expiresUtc===null?NaN:Date.parse(data.expiresUtc);
 return !Number.isFinite(expires)||nowMs>=expires?'stale':'fresh';
}
/** Observation overlap is separate from freshness and is never future prediction. */
export function providerMissionOverlap<T>(data:ProviderEnvelope<T>,period:MissionPeriod):'full'|'partial'|'none'{
 validateMissionPeriod(period);
 if(data.value===null||!data.observedStartUtc||!data.observedEndUtcExclusive)return 'none';
 const a=Date.parse(period.startUtc),b=Date.parse(period.endUtcExclusive),x=Date.parse(data.observedStartUtc),y=Date.parse(data.observedEndUtcExclusive);
 if(!Number.isFinite(x)||!Number.isFinite(y)||a>=y||b<=x)return 'none';
 return x<=a&&y>=b&&data.coverage==='complete'?'full':'partial';
}
