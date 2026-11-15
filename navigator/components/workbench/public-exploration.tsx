'use client';
import {useMemo} from 'react';
import type {Site} from '@/lib/catalog';
import type {DsnStation} from '@/lib/dsn';
import {DSN_SOURCES} from '@/lib/dsn';
import {nearbyMissionPins,publicLunarContact,publicStationRole,siteHistoryLabel} from '@/lib/public-exploration';
import {Info} from './info';
export function PublicSiteStory({site,sites,lat,lon,radiusM}:{site:Site|null;sites:readonly Site[];lat:number;lon:number;radiusM:number}){
 const nearby=useMemo(()=>nearbyMissionPins(sites,lat,lon,site?.id??null,radiusM),[sites,lat,lon,site?.id,radiusM]);
 return <section className="public-site-context" aria-label="Selected location mission history">
  <strong>{siteHistoryLabel(site)}</strong>
  <details key={site?.id??`${lat},${lon}`}><summary>Mission story & nearby missions</summary><div className="public-story-body">
   <p>{site?.summary??'This is your chosen lunar coordinate. No historical landing is asserted at the exact point.'}</p>
   {site?.mission&&<p>{site.mission.approximate||site.mission.coordinateKind==='planned-target'?'The pin is an approximate region or intended target; check the source for its uncertainty.':'This pin represents the published spacecraft position, rather than the full area explored by its mission.'} Historical mission dates are context; the timeline still evaluates your selected simulation date.</p>}
   {nearby.length>0?<><h4>Other published mission pins within about 5 km</h4><ul>{nearby.map(({site:s,distanceKm})=><li key={s.id}><a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.name}</a> · about {distanceKm.toFixed(1)} km · {s.mission!.date}</li>)}</ul><p>Distances compare reported pins on a sphere. Source frames and coordinate uncertainty apply; nearby does not mean the same landing point.</p></>:<p>No other observed, non-approximate touchdown pin is listed within 5 km. This catalogue is not a complete inventory of lunar hardware.</p>}
   {site&&<a href={site.sourceUrl} target="_blank" rel="noreferrer">Mission/location source</a>}
  </div></details>
 </section>;
}
export function PublicStationStory({station,contact}:{station:DsnStation;contact:boolean|null}){
 return <section className="public-station-context" aria-label={`How ${station.name} could communicate with the lander`}>
  <p>{publicStationRole(station)}</p>
  <h4>Can this dish reach the lander?</h4><p>{publicLunarContact(contact)}</p>
  <p>Both ends need a clear path: the lander toward Earth, and the Earth dish toward the Moon. This globe locates the complexes; it does not establish their current Moon visibility or a booked pass.</p>
  <details><summary>Why one visible station helps · and what makes a strong signal</summary>
   <p>One available, compatible complex can carry a direct radio link. Another can provide a handover or alternative; seeing more complexes does not automatically add their signal strengths.</p>
   <p>Signal strength and useful data rate also depend on transmitted power, dish/lander antenna gain and pointing, frequency, distance, noise and weather. Link margin <Info label="Link margin"/> is the spare signal above the required threshold. A weak link may need a lower data rate or a different supported pass.</p>
   <p>The Moon has no rain weather like Earth’s. The regional forecast below concerns the radio path through Earth’s atmosphere, not lunar weather.</p>
  </details>
  <a href={DSN_SOURCES.overview} target="_blank" rel="noreferrer">NASA: the Deep Space Network</a>
 </section>;
}
