'use client';
import {useRef,useState} from 'react';
import type {Catalog} from '@/lib/catalog';
import type {ScenarioState} from '@/lib/scenario';
import type {EvidenceManifest} from '@/lib/planning-types';
import {createDecisionPackage,stringifyDecisionPackage,importDecisionPackage,decisionPackageCsv,printableDecisionHtml,MAX_DECISION_PACKAGE_BYTES} from '@/lib/decision-export';
import {Button} from '@/components/ui/button';
export function DecisionPackageControls({catalog,state,manifest,onImport}:{catalog:Catalog;state:ScenarioState;manifest:EvidenceManifest;onImport:(s:ScenarioState)=>void}){
 const input=useRef<HTMLInputElement>(null),[message,setMessage]=useState('');
 function download(format:'json'|'csv'|'print'){
  try{const pkg=createDecisionPackage(catalog,state,manifest),content=format==='json'?stringifyDecisionPackage(pkg):format==='csv'?decisionPackageCsv(pkg):printableDecisionHtml(pkg);const url=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json;charset=utf-8':format==='csv'?'text/csv;charset=utf-8':'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`solarreach-decision.${format==='print'?'html':format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(format==='print'?'Printable record downloaded. Open it and use your browser’s Print command.':'Decision package exported with exact inputs, evidence and model version.');}catch(e){setMessage(e instanceof Error?e.message:'Export failed.');}
 }
 return <details className="planning-details"><summary>Export, import & print evidence</summary><p>Import recomputes the assessment using the currently installed data. An exported verdict is never trusted as current evidence.</p><div className="planning-slip-actions"><Button variant="outline" onClick={()=>download('json')}>Export decision JSON</Button><Button variant="outline" onClick={()=>download('csv')}>Export decision CSV</Button><Button variant="ghost" onClick={()=>download('print')}>Printable decision record</Button><Button variant="ghost" onClick={()=>input.current?.click()}>Import decision package</Button></div><input ref={input} type="file" accept="application/json,.json" hidden onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>MAX_DECISION_PACKAGE_BYTES)throw new Error('Decision package exceeds the 1 MB import limit.');const imported=importDecisionPackage(await file.text(),catalog,manifest);onImport(imported.state);setMessage(imported.message);}catch(error){setMessage(error instanceof Error?error.message:'Import failed; current scenario was retained.');}}}/><p role="status">{message}</p></details>;
}
