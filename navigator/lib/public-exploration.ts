import type {Site} from './catalog';
import type {DsnStation,DsnWeather} from './dsn';
export function siteHistoryLabel(site: Site | null): string {
  if (!site) return 'Custom coordinate · no landing asserted at this point';
  if (!site.mission) return site.group==='artemis' ? 'Candidate region · no past landing claimed here' : 'Reference location · no landing record attached';
  const m=site.mission;
  return `${m.program} · ${m.date} · ${m.coordinateKind==='planned-target'?'Planned target; touchdown not confirmed':m.outcome==='landed'?'Landed':m.outcome==='partial'?'Touchdown with problems':'Landing attempt'}`;
}
/** Nearby published observed pins, not a claim that two spacecraft share a landing point. */
export function nearbyMissionPins(sites:readonly Site[],lat:number,lon:number,selectedId:string|null,radiusM:number) {
  if (![lat,lon,radiusM].every(Number.isFinite)||Math.abs(lat)>90||radiusM<=0)return [];
  const rad=Math.PI/180;
  return sites.filter(s=>s.id!==selectedId&&s.mission&&s.mission.outcome!=='attempt'&&!s.mission.approximate&&s.mission.coordinateKind==='observed')
    .map(site=>{const a=Math.sin((site.lat-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(site.lat*rad)*Math.sin((site.lon-lon)*rad/2)**2;return{site,distanceKm:2*radiusM*Math.asin(Math.sqrt(Math.max(0,Math.min(1,a))))/1000};})
    .filter(s=>Number.isFinite(s.distanceKm)&&s.distanceKm<=5).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,3);
}
export function publicStationRole(station:DsnStation) {
  return `${station.name} is an Earth ground complex in ${station.country}. ${station.antenna} is its representative 70 m radio dish. It sends spacecraft commands and receives data. The three complexes are spread around Earth so another can take over as Earth turns, when geometry and operating schedules permit.`;
}
export function publicLunarContact(contact:boolean|null) {
  return contact===true?'The selected lunar interval clears the terrain and antenna mask in the current direct-to-Earth model. A station pass and usable radio link still need to be established.'
    :contact===false?'The current direct-to-Earth model is blocked in this lunar interval. Choosing clear weather at another Earth complex does not remove that lunar obstruction in this model.'
    :'Lunar Earth-view evidence is unavailable for this interval. A visible Earth model or a clear forecast does not establish a contact.';
}
export function publicRadioWeather(hour:DsnWeather['hours'][number]):string {
  const rain=hour.precipitationMm;
  return (rain===null?'Rain information is unavailable for this forecast hour. ':rain>0?'Rain is forecast near this complex. It can absorb or scatter radio energy, especially at higher frequencies such as Ka-band. ':'No rain is forecast for this hour; that alone does not establish a usable link. ')+
   'Cloud percentage is not a signal-strength meter. Atmospheric water can reduce spare link margin, and wind can affect dish pointing or operations; actual limits depend on the antenna. These forecast values do not calculate attenuation, link margin or an outage.';
}
