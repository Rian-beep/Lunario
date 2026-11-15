"use client";
import {useEffect, useRef} from 'react';
import {X, Globe2, BookOpen, SlidersHorizontal} from 'lucide-react';
import {AUDIENCE_GUIDES, type AudienceMode} from '@/lib/onboarding';
import styles from './audience-guide.module.css';

export function AudienceGuide({mode, open, onClose}: {mode:AudienceMode;open:boolean;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const guide=AUDIENCE_GUIDES[mode];
  const Icon=mode==='public'?Globe2:mode==='teach'?BookOpen:SlidersHorizontal;
  useEffect(()=>{ const dialog=ref.current; if(!dialog)return; if(open&&!dialog.open)dialog.showModal(); else if(!open&&dialog.open)dialog.close(); },[open]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="audience-guide-title" aria-describedby="audience-guide-intro" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <button className={styles.close} aria-label="Dismiss introduction" onClick={onClose}><X size={20}/></button>
    <div className={styles.mode}><Icon size={19}/>{guide.name} workspace</div>
    <h1 id="audience-guide-title">{guide.title}</h1>
    <p id="audience-guide-intro" className={styles.intro}>{guide.intro}</p>
    <ol className={styles.steps}>{guide.steps.map(([title,text],i)=><li key={title}><span className={styles.number}>{i+1}</span><div><h2>{title}</h2><p>{text}</p></div></li>)}</ol>
    <p className={styles.limits}>{guide.limits}</p>
    <button className={styles.start} onClick={onClose} autoFocus>{guide.action}</button>
    <p className={styles.reopen}>Reopen this introduction with “Mode guide” in the header.</p>
  </dialog>;
}
