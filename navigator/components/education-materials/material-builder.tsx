'use client';
import {useId,useState} from 'react';
import {formatUtc} from '@/lib/astro';
import {Button} from '@/components/ui/button';
import {NativeMath} from '@/components/workbench/native-math';
import type {Catalog} from '@/lib/catalog';
import type {EvidenceManifest} from '@/lib/planning-types';
import type {ScenarioState} from '@/lib/scenario';
import {createLessonMaterial,lessonMaterialHtml,MATERIAL_TOPICS,type LessonMaterial,type MaterialTopic} from '@/lib/education-materials';
import {downloadAudienceFile} from '@/components/audience/study-capture';
import {RESOURCE_LESSONS} from '@/lib/education-materials/resource-evidence';
import {ResearchLinks} from './resource-evidence';
import styles from './materials.module.css';
const topicNames:Record<MaterialTopic,string>={
 solar:'Solar power and gradient',reserve:'Battery reserve',terrain:'Terrain versus smooth sphere',
 contact:'Earth contact and link evidence',evidence:'Decision and missing evidence',
 'ice-evidence':RESOURCE_LESSONS['ice-evidence'].title,
 'resource-access':RESOURCE_LESSONS['resource-access'].title,
 'extraction-power':RESOURCE_LESSONS['extraction-power'].title,
};
export function MaterialBuilder({catalog,manifest,state}:{catalog:Catalog;manifest:EvidenceManifest;state:ScenarioState}){
 const id=useId();
 const [topics,setTopics]=useState<MaterialTopic[]>([...MATERIAL_TOPICS]),[title,setTitle]=useState('Lunario: a landing-site investigation'),[sheet,setSheet]=useState<LessonMaterial|null>(null),[message,setMessage]=useState('');
 function capture(){try{setSheet(createLessonMaterial(catalog,manifest,state,topics,title));setMessage('Teaching material captured. Navigator changes will not alter this worksheet.');}catch(e){setMessage(e instanceof Error?e.message:'Material could not be captured.');}}
 return <section className={styles.card}><details><summary>Create a problem set and teaching materials</summary><p>Capture a real scenario, choose learning goals, then edit the questions and hints. Student worksheets and teacher answer keys are separate files. Computed answers retain unknown data and source limits.</p>
 <label>Worksheet title<input maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><fieldset><legend>Learning goals</legend>{MATERIAL_TOPICS.map(topic=><label className={styles.choice} key={topic}><input type="checkbox" checked={topics.includes(topic)} onChange={e=>setTopics(v=>e.target.checked?[...v,topic]:v.filter(t=>t!==topic))}/>{topicNames[topic]}</label>)}</fieldset>
 <Button onClick={capture} disabled={!topics.length}>{sheet?'Replace capture with current scenario':'Capture current scenario for worksheet'}</Button><p role="status">{message}</p>
 {sheet&&<><p>Captured {sheet.site}, {formatUtc(Date.parse(sheet.arrivalUtc))} through {formatUtc(Date.parse(sheet.endExclusiveUtc))} (end exclusive). Model {sheet.modelVersion}. {sheet.questions.length} questions. Editing the title or topic choices above takes effect on the next explicit capture.</p>{sheet.questions.map((question,i)=><details key={question.topic}><summary id={`${id}-${question.topic}`}>{i+1}. {question.title}</summary><label>Question<textarea aria-label="Question" aria-describedby={`${id}-${question.topic}`} maxLength={3000} value={question.prompt} onChange={e=>setSheet(v=>v&&({...v,questions:v.questions.map((q,n)=>n===i?{...q,prompt:e.target.value}:q)}))}/></label><label>Hint<textarea aria-label="Hint" aria-describedby={`${id}-${question.topic}`} maxLength={1500} value={question.hint} onChange={e=>setSheet(v=>v&&({...v,questions:v.questions.map((q,n)=>n===i?{...q,hint:e.target.value}:q)}))}/></label><details><summary>Captured givens for this question</summary>{question.equation&&<NativeMath expression={question.equation} display/>}{question.notation&&<dl>{question.notation.map(n=><div key={n.symbol}><dt><NativeMath expression={n.symbol}/></dt><dd>{n.meaning} ({n.unit})</dd></div>)}</dl>}<dl>{question.values.map(v=><div key={v.label}><dt>{v.label}{v.symbol&&<> <NativeMath expression={v.symbol}/></>}</dt><dd>{v.value===null?'Unavailable':v.value.toLocaleString('en-GB',{maximumSignificantDigits:6})} {v.unit}</dd></div>)}</dl>{question.context?.map((text,index)=><p key={index}>{text}</p>)}{question.sources&&<ResearchLinks sources={question.sources}/>}</details><details><summary>Teacher answer and marking guidance</summary><p>{question.answer}</p></details></details>)}
 <div className={styles.actions}><Button onClick={()=>downloadAudienceFile('lunar-window-student-worksheet.html',lessonMaterialHtml(sheet),'text/html')}>Export student worksheet</Button><Button variant="outline" onClick={()=>downloadAudienceFile('lunar-window-teacher-answer-key.html',lessonMaterialHtml(sheet,true),'text/html')}>Export teacher answer key</Button><Button variant="outline" onClick={()=>downloadAudienceFile('lunar-window-teaching-material.json',JSON.stringify(sheet,null,2))}>Export teacher JSON</Button></div><p>The HTML files print to paper or PDF from your browser. Teacher JSON includes answers and the exact captured scenario; do not distribute it as a student sheet.</p></>}
 </details></section>;
}
