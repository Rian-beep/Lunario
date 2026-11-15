export type ImagePatch={id:string;url:string;width:number;height:number;x0:number;y0:number;stepM:number;sourcePixelM:number};
export type ImageryData={retrievedUtc:string;source:string;sourceUrl:string;polarEndpoint:string;globalEndpoint:string;frame:string;note:string;overview:ImagePatch;patches:ImagePatch[];global:{url:string;width:number;height:number}};
declare global{interface Window{__SOLARREACH_IMAGERY__?:ImageryData}}
let imageryRequest:Promise<ImageryData>|null=null;
export function loadImagery():Promise<ImageryData>{
 if(typeof window!=='undefined'&&window.__SOLARREACH_IMAGERY__)return Promise.resolve(window.__SOLARREACH_IMAGERY__);
 if(!imageryRequest)imageryRequest=fetch('/data/imagery.json').then(r=>{if(!r.ok)throw Error('Bundled LROC imagery unavailable; original relief remains usable.');return r.json() as Promise<ImageryData>;}).catch(error=>{imageryRequest=null;throw error;});
 return imageryRequest;
}
