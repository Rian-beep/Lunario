'use client';
import {useContext} from 'react';
import {visibilityCountdown,visibilityBreakdown,formatVisibilityCountdown,formatVisibilityUtcWindow} from '@/lib/windows';
import {indexToMs} from '@/lib/astro';
import type {Catalog} from '@/lib/catalog';
import type {MissionResult} from '@/lib/mission';
import {AudienceContext,Info} from './info';
import styles from './visibility-windows.module.css';
export function VisibilityWindows({catalog,mission,startIndex,cursor,planner=false,arrayHeightM,antennaHeightM,minimumElevationDeg}:{catalog:Catalog;mission:MissionResult;startIndex:number;cursor:number;planner?:boolean;arrayHeightM?:number;antennaHeightM?:number;minimumElevationDeg?:number}){
 const audience=useContext(AudienceContext),presentation=planner?'plan':audience;
 const data=mission.timeline,counts=visibilityBreakdown(data);
 const events=(['sun','contact'] as const).map(field=>{
  const event=visibilityCountdown(data.map(p=>p[field]),cursor-startIndex,catalog.meta.stepHours);
  const title=field==='sun'?'Array sunlight':'Antenna visibility';
  const name=event.kind==='change'?(field==='sun'?(event.visible?'Sunrise':'Sunset'):(event.visible?'Contact opens':'Contact closes')):'Next change';
  const window=event.kind==='change'?formatVisibilityUtcWindow(indexToMs(catalog,startIndex+event.index-1),indexToMs(catalog,startIndex+event.index)):null;
  const exact=event.kind==='change'?`Elapsed model bracket: ${event.earliestHours.toFixed(2)}–${event.latestHours.toFixed(2)} hours from the current playhead. `:'';
  const explanation=`${field==='sun'?'Sunrise means some of the Sun becomes visible above the modeled terrain horizon; sunset means its modeled disk is no longer visible.':'Contact opens and closes when Earth’s centre clears both the antenna terrain horizon and its minimum elevation above local horizontal. A 0° cutoff is active even when terrain lies below horizontal. This does not book a ground station or prove a usable radio link.'} ${exact}${catalog.meta.stepHours} h sampled forcing. Adjacent sample epochs bracket the change; the countdown is not an exact physical event time.${event.kind==='unknown'?' Missing terrain or geometry interrupts this forecast.':event.kind==='outside'?' No further known change occurs in the selected stay.':''}`;
  return {field,event,title,name,window,explanation,countdown:formatVisibilityCountdown(event,presentation)};
 });
 const states=[['both','Sun + contact','#9a863d'],['sun','Sun only','#cba958'],['earth','Contact only','#3d7d90'],['neither','Neither','#61675d'],['unknown','Unknown','#b4b6ad']] as const;
 return <section className={styles.windows} aria-label="Upcoming visibility changes">
  <div className={styles.events}>{events.map(card=><article key={card.field} className={`${styles.card} ${card.event.kind!=='change'?styles.unavailable:''}`} aria-label={`${card.title}: ${card.name}`}>
   <header className={styles.cardHeader}><i aria-hidden="true" className={card.field==='sun'?styles.sun:styles.earth}/><span>{card.title}</span><Info label={card.field==='sun'?'Time in sunlight':'Earth visibility'} extra={card.explanation}/></header>
   <div className={styles.eventName}>{card.name}</div>
   <strong className={styles.countdown}>{card.countdown}</strong>
   <div className={styles.utc}>{card.window?<><span>{card.window.date}</span><span>{card.window.time}</span></>:card.event.kind==='outside'?<span>No change in selected stay</span>:<span>Forecast unavailable</span>}</div>
  </article>)}</div>
  <p className={styles.caption}>Array sunlight and antenna visibility across the stay <Info label="Earth visibility" extra="The five states distinguish sunlight, masked Earth visibility, their overlap, neither, and missing evidence. Unknown intervals are retained separately; Earth visibility is geometry, not a ground-station booking."/></p>
  {(arrayHeightM!==undefined||antennaHeightM!==undefined)&&<p className={styles.caption}>Array {arrayHeightM??"unknown"} m · antenna {antennaHeightM??"unknown"} m · minimum antenna elevation {minimumElevationDeg??"unknown"}° above horizontal. These are geometric windows, not confirmed communication service.</p>}
  <div className={styles.bar} aria-hidden="true">{states.map(([key,,color])=>counts[key]>0&&<span key={key} style={{flex:counts[key],background:color}}/>)}</div>
  <ul>{states.map(([key,label,color])=>(key!=='unknown'||counts.unknown>0)&&<li key={key}><i style={{background:color}} aria-hidden="true"/><span>{label}</span><strong>{counts.total?`${(counts[key]/counts.total*100).toFixed(1)}%`:'—'}</strong></li>)}</ul>
  {counts.total===0&&<p className={styles.empty}>No visibility samples in the selected stay.</p>}
 </section>;
}
