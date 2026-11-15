'use client';
import {useState} from 'react';
import {formatGeographicView} from './scene/geographic-navigation';
import styles from './globe-navigation.module.css';
export type GlobeNavigationSite={id:string;name:string;lat:number;lon:number};
export type GlobeNavigationProps={
 viewLatDeg:number;viewLonDeg:number;
 /** Clockwise screen angle from vertical up to projected geographic north. */
 screenNorthAngleDeg?:number;
 onNorthPole:()=>void;onSouthPole:()=>void;onEast:()=>void;onWest:()=>void;
 onSelect?:(id:string)=>void;selectedSite?:GlobeNavigationSite;hoveredSite?:GlobeNavigationSite|null;
};
/** Camera navigation only; a sourced POI is selected only through its explicit action. */
export function GlobeNavigation({viewLatDeg,viewLonDeg,screenNorthAngleDeg,onNorthPole,onSouthPole,onEast,onWest,onSelect,selectedSite,hoveredSite}:GlobeNavigationProps){
 const [minimized,setMinimized]=useState(false),[dismissed,setDismissed]=useState(false);
 if(dismissed)return <button type="button" className={styles.restore} onClick={()=>setDismissed(false)}>Restore globe navigation</button>;
 const valid=Number.isFinite(viewLatDeg)&&Math.abs(viewLatDeg)<=90&&Number.isFinite(viewLonDeg);
 const poi=hoveredSite??selectedSite;
 return <section className={styles.navigation} aria-label="Globe geographic navigation">
  <div className={styles.heading}><strong>Globe orientation</strong><button type="button" onClick={()=>setMinimized(v=>!v)} aria-expanded={!minimized}>{minimized?'Expand':'Minimize'} globe navigation</button><button type="button" onClick={()=>setDismissed(true)}>Dismiss globe navigation</button></div>
  {!minimized&&<><p className={styles.position}>Camera above {valid?formatGeographicView(viewLatDeg,viewLonDeg):'unknown coordinates'}</p>
   <div className={styles.controls} role="group" aria-label="Geographic camera directions">
    <button type="button" onClick={onNorthPole} title="View the geographic north pole. This moves the camera, not the selected mission site."><strong>N</strong><span>North pole</span></button>
    <button type="button" onClick={onWest} title="Move the camera view 30 degrees west in longitude, keeping its latitude."><strong>W</strong><span>30° west</span></button>
    <button type="button" onClick={onEast} title="Move the camera view 30 degrees east in longitude, keeping its latitude."><strong>E</strong><span>30° east</span></button>
    <button type="button" onClick={onSouthPole} title="View the geographic south pole. This moves the camera, not the selected mission site."><strong>S</strong><span>South pole</span></button>
   </div>
   {Number.isFinite(screenNorthAngleDeg)&&<p className={styles.north}><span aria-hidden="true" style={{display:'inline-block',transform:`rotate(${screenNorthAngleDeg}deg)`}}>↑</span> Geographic north: {screenNorthAngleDeg!.toFixed(1)}° clockwise from screen up.</p>}
   <details><summary>What these directions mean</summary><p>Latitude and longitude describe the camera’s radial position above the Moon. East and west change longitude, not a local compass bearing. At a pole, longitude chooses an orientation meridian; it does not identify a different physical pole. These controls do not change mission dates or scientific inputs.</p></details>
   {poi&&<div className={styles.poi}><strong>{hoveredSite?'Point under pointer':'Selected point'}: {poi.name}</strong><span>{formatGeographicView(poi.lat,poi.lon)}</span>{onSelect&&<button type="button" onClick={()=>onSelect(poi.id)}>Open {poi.name}</button>}</div>}
  </>}
 </section>;
}
