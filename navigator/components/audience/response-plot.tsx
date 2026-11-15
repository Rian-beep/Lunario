import {useId} from 'react';
import type {ResponsePoint} from '@/lib/audience/experiments';
import styles from './audience.module.css';
const number=(v:number|null)=>v===null?'Unavailable':new Intl.NumberFormat('en-GB',{maximumFractionDigits:3}).format(v);
export function ResponsePlot({title,points,xLabel,yLabel,discrete=false,comparison=false}:{title:string;points:ResponsePoint[];xLabel:string;yLabel:string;discrete?:boolean;comparison?:boolean}){
 const id=useId(),known=points.flatMap(p=>[p.terrain,p.sphere].filter((x):x is number=>x!==null&&Number.isFinite(x)));
 const lo=Math.min(0,...known),hi=Math.max(1,...known),x0=Math.min(0,...points.map(p=>p.x)),x1=Math.max(1,...points.map(p=>p.x));
 const left=150,right=715,plotWidth=right-left;
 const xy=(p:ResponsePoint,v:number)=>`${left+(p.x-x0)/(x1-x0)*plotWidth},${225-(v-lo)/(hi-lo)*175}`;
 const paths=(key:'terrain'|'sphere')=>{let pen=false;return points.map(p=>{const v=p[key];if(v===null||!Number.isFinite(v)){pen=false;return '';}const d=`${pen?'L':'M'}${xy(p,v)}`;pen=true;return d;}).join(' ');};
 return <figure className={styles.figure}><figcaption id={id}><b>{title}</b></figcaption><svg viewBox="0 0 760 295" role="img" aria-labelledby={id} aria-describedby={`${id}-description`}>
 <desc id={`${id}-description`}>{comparison?'Baseline in olive, candidate in dashed blue.':'Terrain in olive, smooth sphere in dashed blue.'} Exact values and unknowns are available in the adjacent data table. {discrete?'Points are discrete tested choices, not interpolation.':'Segments join tested points; they do not add source resolution.'}</desc>
 {[0,.5,1].map(t=><g key={t}><path d={`M${left} ${225-175*t} H${right}`} stroke="#d7d2bf"/><text x={left-10} y={229-175*t} textAnchor="end">{number(lo+(hi-lo)*t)}</text></g>)}
 <path d={`M${left} 45 V225 H${right}`} fill="none" stroke="#787965"/>
 {!discrete&&<><path d={paths('terrain')} fill="none" stroke="#515c35" strokeWidth="2.5"/><path d={paths('sphere')} fill="none" stroke="#386b87" strokeWidth="2" strokeDasharray="6 4"/></>}
 {points.map((p,i)=><g key={i}>{p.terrain!==null&&Number.isFinite(p.terrain)&&<circle cx={xy(p,p.terrain).split(',')[0]} cy={xy(p,p.terrain).split(',')[1]} r="4" fill="#515c35"/>}{p.sphere!==null&&Number.isFinite(p.sphere)&&<circle cx={xy(p,p.sphere).split(',')[0]} cy={xy(p,p.sphere).split(',')[1]} r="6" fill="none" stroke="#386b87" strokeWidth="1.5"/>}{(points.length<=8||i===0||i===points.length-1)&&<text x={left+(p.x-x0)/(x1-x0)*plotWidth} y="245" textAnchor="middle">{p.label}</text>}</g>)}
 <text x={(left+right)/2} y="278" textAnchor="middle">{xLabel}</text><text transform="translate(15 140) rotate(-90)" textAnchor="middle">{yLabel}</text></svg><p className={styles.legend}>{comparison?'● Baseline · ◯ Candidate (dashed).':'● Terrain horizon · ◯ Smooth sphere (dashed).'} Unknowns leave gaps.</p>
 <details><summary>Exact plotted values</summary><div className={styles.tableScroll}><table><caption>{title}</caption><thead><tr><th>{xLabel}</th><th>{comparison?'Baseline':'Terrain'} · {yLabel}</th><th>{comparison?'Candidate':'Smooth sphere'} · {yLabel}</th></tr></thead><tbody>{points.map((p,i)=><tr key={i}><th>{p.label}</th><td>{number(p.terrain)}</td><td>{number(p.sphere)}</td></tr>)}</tbody></table></div></details></figure>;
}
