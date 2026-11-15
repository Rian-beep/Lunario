import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';

export const auditDirectory = 'docs/qa/scientific-audit/ephemeris';
export const epochs = ['2026-01-01T00:00:00Z','2026-11-14T00:00:00Z','2027-06-29T11:00:00Z','2027-07-20T10:00:00Z','2027-07-20T11:00:00Z','2027-12-31T23:00:00Z','2028-01-01T00:00:00Z'];
export const sites = [
  {id:'connecting-ridge',lat:-89.53432,lon:209.94767},
  {id:'malapert-massif',lat:-86,lon:0},
  {id:'apollo-11',lat:0.67416,lon:23.47314},
  {id:'equator',lat:0,lon:0},
  {id:'north',lat:89.99,lon:0},
  {id:'far-side',lat:0,lon:180},
  {id:'dateline-east',lat:35,lon:179.99},
  {id:'dateline-west',lat:-35,lon:-179.99},
];
export type RequestSpec = {id:string; target:'10'|'301'|'399'; center:string; quantities:string; site?:{lat:number;lon:number}; times?:string[]};
export const sha256 = (value:string) => createHash('sha256').update(value).digest('hex');
export const wrapped = (value:number) => ((value+540)%360+360)%360-180;
export function requestUrl(spec:RequestSpec):string {
  const p = new URLSearchParams({format:'json'});
  const args:Record<string,string> = {COMMAND:spec.target,OBJ_DATA:'YES',MAKE_EPHEM:'YES',EPHEM_TYPE:'OBSERVER',CENTER:spec.center,TLIST:(spec.times??epochs).map(t=>String(Date.parse(t)/86400000+2440587.5)).join(' '),TLIST_TYPE:'JD',QUANTITIES:spec.quantities,CSV_FORMAT:'YES',APPARENT:'AIRLESS',TIME_TYPE:'UT',TIME_DIGITS:'FRACSEC',CAL_FORMAT:'JD',CAL_TYPE:'GREGORIAN',ANG_FORMAT:'DEG',RANGE_UNITS:'KM',EXTRA_PREC:'YES'};
  if(spec.site) {args.COORD_TYPE='GEODETIC';args.SITE_COORD=`${spec.site.lon},${spec.site.lat},0`;}
  for(const [key,value] of Object.entries(args)) p.set(key,`'${value}'`);
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${p}`;
}
export function parseResponse(payload:unknown,spec:RequestSpec):{rows:number[][];header:string;signature:unknown} {
  assert(payload && typeof payload==='object','No Horizons JSON');
  const p=payload as {error?:unknown;result?:unknown;signature?:{source?:string;version?:string}};
  assert(!p.error,`Horizons provider error: ${String(p.error)}`);
  assert.equal(p.signature?.source,'NASA/JPL Horizons API');
  assert.equal(p.signature?.version,'1.2','Unreviewed API response version');
  assert.equal(typeof p.result,'string');
  const raw=p.result as string;
  assert(raw.length<100000,'Oversized audit response');
  const sections=raw.split('$$SOE');
  assert.equal(sections.length,2,'Exactly one table required');
  const end=sections[1].split('$$EOE');
  assert.equal(end.length,2,'Complete table required');
  const header=sections[0];
  const targetName={10:'Sun',301:'Moon',399:'Earth'}[spec.target];
  assert.match(header,new RegExp(`^Target body name: ${targetName} \\(${spec.target}\\).*source: DE441`, 'm'));
  assert.match(header,new RegExp(`^Center body name: ${spec.center.endsWith('@399')?'Earth \\(399\\)':'Moon \\(301\\)'}`, 'm'));
  const lunarPrefix=spec.target==='301'?'Target':'Center';
  assert.match(header,new RegExp(`^${lunarPrefix} pole/equ\\s*:\\s*(?:MEAN_ME|MOON_ME) .*East-longitude positive`, 'm'));
  assert.match(header,new RegExp(`^${lunarPrefix} radii\\s*:\\s*1737.4, 1737.4, 1737.4 km`, 'm'));
  assert.match(header,/^Atmos refraction:\s*NO \(AIRLESS\)/m);
  assert.match(header,/^Time format\s*:\s*JD\s*$/m);
  assert.match(header,/^Start time\s*:.* UT\s*$/m);
  assert.match(header,/^Stop\s+time\s*:.* UT\s*$/m);
  assert.match(raw,/Units: KM and KM\/S/);
  if(spec.site) {
    const coord=header.match(/^Center geodetic\s*:\s*([\d.Ee+-]+),\s*([\d.Ee+-]+),\s*([\d.Ee+-]+)/m);
    assert(coord,'Missing site coordinates');
    assert(Math.abs(wrapped(Number(coord[1])-spec.site.lon))<1e-6 && Math.abs(Number(coord[2])-spec.site.lat)<1e-6 && Math.abs(Number(coord[3]))<1e-8,'Wrong lunar site');
  } else assert.match(header,/^Center-site name: (?:GEOCENTRIC|BODYCENTRIC)/m);
  const columns=header.trim().split(/\r?\n/).filter(l=>!/^\*+$/.test(l.trim())).at(-1)!.split(',').map(x=>x.trim());
  const dataColumns=spec.quantities==='14,15,20'?['ObsSub-LON','ObsSub-LAT','SunSub-LON','SunSub-LAT','delta','deldot']:spec.quantities==='13,20'?['Ang-diam','delta','deldot']:['Azimuth_(a-app)','Elevation_(a-app)','Ang-diam','delta','deldot'];
  assert.deepEqual(columns,['Date_________JDUT','','',...dataColumns,'']);
  const times=spec.times??epochs;
  const rows=end[0].trim().split(/\r?\n/).map((line,i)=>{
    const f=line.split(',').map(x=>x.trim());
    assert.equal(f.length,columns.length);
    assert.equal(f.at(-1),'');
    const nums=[f[0],...f.slice(3,-1)].map(Number);
    assert([f[0],...f.slice(3,-1)].every(x=>x!==''));
    assert(nums.every(Number.isFinite),'Nonfinite/unavailable observer data');
    assert(nums.at(-2)!>0,'Nonpositive range');
    if(spec.site) assert(nums[1]>=0 && nums[1]<=360 && nums[2]>=-90 && nums[2]<=90 && nums[3]>0,'Invalid angle/disk fields');
    assert(i<times.length && Math.abs((nums[0]-2440587.5)*86400000-Date.parse(times[i]))<=1,'Wrong UTC sample epoch');
    return nums;
  });
  assert.equal(rows.length,times.length,'Wrong sample count');
  return {rows,header,signature:p.signature};
}
export async function loadResponse(spec:RequestSpec,live=false) {
  const path=`${auditDirectory}/raw/${spec.id}.json`,url=requestUrl(spec);
  if(live) {
    const fetchedUtc=new Date().toISOString();
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
      const body=await response.text();
      const cache={request:spec,requestUrl:url,fetchedUtc,httpStatus:response.status,sha256:sha256(body),body};
      await fs.writeFile(path,JSON.stringify(cache,null,2)+'\n');
      assert(response.ok,`HTTP ${response.status}`);
    } catch(error) {
      await fs.writeFile(`${path}.error.json`,JSON.stringify({request:spec,requestUrl:url,fetchedUtc,error:String(error)},null,2)+'\n');
      throw error;
    }
  }
  const cache=JSON.parse(await fs.readFile(path,'utf8'));
  assert.equal(cache.requestUrl,url,'Cached request identity differs');
  assert.equal(cache.sha256,sha256(cache.body),'Cached response hash differs');
  assert.equal(cache.httpStatus,200,'Cached provider error');
  const parsed=parseResponse(JSON.parse(cache.body),spec);
  return {...parsed,identity:{id:spec.id,requestUrl:url,fetchedUtc:cache.fetchedUtc,sha256:cache.sha256,signature:parsed.signature,eopFile:parsed.header.match(/^EOP file\s*:\s*(.+)$/m)?.[1].trim()??null,eopCoverage:parsed.header.match(/^EOP coverage\s*:\s*(.+)$/m)?.[1].trim()??null}};
}
export function separation(a:number[],b:number[]) {
  const r=Math.PI/180;
  return 2*Math.asin(Math.min(1,Math.sqrt(Math.sin((a[1]-b[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((a[0]-b[0])*r/2)**2)))/r;
}
