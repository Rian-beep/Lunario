'use client';
import {useState} from 'react';
import {MissionTrajectorySelector,type MissionTrajectorySelection} from './selector';
import {PublishedTrajectoryReplay} from './replay';
import {MISSION_TRAJECTORIES} from '../../lib/mission-trajectories-catalog';
import {Button} from '../ui/button';
export function MissionPathsWorkspace({site,onSimulation,onClose}:{site:{id:string;name:string};onSimulation:()=>void;onClose:()=>void}){
 const [selection,setSelection]=useState<MissionTrajectorySelection|null>(null);
 const active=selection?.siteId===site.id?selection:null;
 const data=active?.mode==='published'?MISSION_TRAJECTORIES.find(row=>row.id===active.trajectoryId):null;
 return <div style={{padding:'1rem',display:'grid',gap:'1rem'}}><Button variant="outline" onClick={onClose}>Close mission paths</Button>
 <MissionTrajectorySelector site={site} selection={selection} onSelect={next=>{setSelection(next);if(next.mode==='educational-simulation')onSimulation();}}/>
 {data&&<PublishedTrajectoryReplay key={data.id} data={data}/>}
 </div>;
}
