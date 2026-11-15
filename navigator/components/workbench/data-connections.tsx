'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {providerFreshness,providerMissionOverlap,validateMissionPeriod,type ProviderEnvelope} from '@/lib/providers/contract';
import {fetchNoaaXray,type XrayObservation} from '@/lib/providers/noaa-xray';
import {DATA_SOURCE_REGISTRY} from '@/lib/providers/registry';
import {commsInferenceSummary} from '@/lib/providers/comms';
import styles from './data-connections.module.css';
export type DataConnectionsProps={missionStartUtc:string;missionEndUtcExclusive:string;offline?:boolean;mode?:'public'|'teach'|'plan'};
export function DataConnections({missionStartUtc,missionEndUtcExclusive,offline=false,mode='public'}:DataConnectionsProps){
 const [reading,setReading]=useState<ProviderEnvelope<XrayObservation>|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('No live observation requested.'),[now,setNow]=useState(Date.now);
 const request=useRef<AbortController|null>(null),generation=useRef(0);
 const invalidate=useCallback(()=>{generation.current++;request.current?.abort();},[]);
 useEffect(()=>{invalidate();setReading(null);setBusy(false);setMessage('No live observation requested for this mission interval.');return invalidate;},[missionStartUtc,missionEndUtcExclusive,offline,invalidate]);
 useEffect(()=>{if(!reading)return;const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[reading]);
 const period={startUtc:missionStartUtc,endUtcExclusive:missionEndUtcExclusive};let valid=true;
 try{validateMissionPeriod(period);}catch{valid=false;}
 async function read(){const token=++generation.current,controller=new AbortController();request.current?.abort();request.current=controller;setBusy(true);setReading(null);setMessage('Reading NOAA GOES observations…');try{const result=await fetchNoaaXray(period,{signal:controller.signal});if(token!==generation.current)return;setNow(Date.now());setReading(result);setMessage(result.value?'Observation retrieved. See its actual timestamp and mission overlap below.':'No valid X-ray observation was returned.');}catch(error){if(token===generation.current)setMessage(error instanceof Error?error.message:'Provider unavailable.');}finally{if(token===generation.current)setBusy(false);}}
 return <details className={styles.panel}><summary>Data connections & live context</summary>
  <p>{mode==='public'?'Read current solar context without changing your mission calculations.':mode==='teach'?'Compare the observation date with the mission date: a current reading is not a future prediction.':'External observations remain separate from the canonical resource assessment and qualified support evidence.'}</p>
  <p>Selected mission: {missionStartUtc} → {missionEndUtcExclusive} (exclusive end).</p>
  <button type="button" disabled={offline||!valid||busy} onClick={read}>Read current NOAA X-rays</button>{busy&&<button type="button" onClick={()=>{generation.current++;request.current?.abort();setBusy(false);setMessage('Read cancelled.');}}>Cancel live read</button>}
  <p role="status">{offline?'Offline: live reads are disabled; existing prepared calculations remain available.':!valid?'A valid ordered UTC mission interval is required.':message}</p>
  {reading&&<div className={styles.observation}><strong>NOAA GOES · {providerFreshness(reading,now)}</strong>{reading.value?<><p>Observed {reading.value.latest.observedUtc}: class {reading.value.latest.flareClass}; 0.1–0.8 nm flux {reading.value.latest.fluxWm2.toExponential(3)} W/m².</p><p>Retrieved {reading.retrievedUtc}. {reading.value.sampleCount} valid samples; last sample {reading.value.latest.observedUtc}.</p><p>Selected mission overlap: {providerMissionOverlap(reading,period)}. {providerMissionOverlap(reading,period)==='none'?'This reading provides no observed coverage for that mission interval.':'Discrete samples are partial context, not continuous mission support coverage.'}</p></>:<p>Observation unavailable; no zero or quiet-Sun value has been substituted.</p>}
   {reading.warnings.map(w=><p key={w}>{w}</p>)}<details><summary>Freshness and evidence identity</summary><p>“Stale” means the newest sample is at least 10 minutes old, an explicit display policy rather than source accuracy. This panel never polls automatically. Future mission dates do not reuse current observations as forecasts.</p><p>Parser {reading.parserVersion}; source SHA-256 {reading.sourceSha256??'unavailable'}.</p></details>
  </div>}
  <div className={styles.cards}>{commsInferenceSummary().map(card=><section key={card.id}><h4>{card.title}</h4><p>{card.explanation}</p><small>{card.state.replaceAll('-',' ')}</small></section>)}</div>
  <details><summary>Source registry and roles</summary><ul>{DATA_SOURCE_REGISTRY.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> — {source.role}.</li>)}</ul></details>
 </details>;
}
