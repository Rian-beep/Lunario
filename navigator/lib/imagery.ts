export type ImagePatch={id:string;url:string;width:number;height:number;x0:number;y0:number;stepM:number;sourcePixelM:number};
export type ImageryData={retrievedUtc:string;source:string;sourceUrl:string;polarEndpoint:string;globalEndpoint:string;frame:string;note:string;overview:ImagePatch;patches:ImagePatch[];global:{url:string;width:number;height:number}};
declare global{interface Window{__SOLARREACH_IMAGERY__?:ImageryData}}
export async function loadImagery():Promise<ImageryData>{if(window.__SOLARREACH_IMAGERY__)return window.__SOLARREACH_IMAGERY__;const r=await fetch('/data/imagery.json');if(!r.ok)throw new Error('Bundled LROC imagery unavailable; original relief remains usable.');return r.json();}
