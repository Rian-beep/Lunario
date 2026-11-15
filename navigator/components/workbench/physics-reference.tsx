'use client';

import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { PHYSICS_TOPICS, type PhysicsReferenceMode } from '../../lib/physics-reference';
import { NativeMath } from './native-math';
import { EquationLesson } from './equation-lesson';

export function PhysicsReference({ mode }: { mode: PhysicsReferenceMode }) {
  const [topicId, setTopicId] = useState(PHYSICS_TOPICS[0].id);
  const id = useId();
  const topic = PHYSICS_TOPICS.find(item => item.id === topicId)!;
  const heading = useRef<HTMLHeadingElement>(null);
  return <div className="learn-layout">
    <nav className="learn-topics" aria-label="Learning topics">
      {PHYSICS_TOPICS.map(item => <Button key={item.id} variant={item.id === topicId ? 'secondary' : 'ghost'}
        aria-current={item.id === topicId ? 'true' : undefined} aria-controls={id}
        onClick={() => { setTopicId(item.id); heading.current?.focus(); }}>{item.title}</Button>)}
    </nav>
    <article id={id} className="learn-lesson" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>{topic.title}</h3><p>{topic.explanation}</p>
      <p className="learn-correction">{topic.correction}</p>
      <dl><dt>Current model boundary</dt><dd>{topic.calculated}</dd><dt>User-supplied inputs</dt><dd>{topic.inputs}</dd><dt>Requires external evidence</dt><dd>{topic.evidence}</dd></dl>
      <details key={topic.id} open={mode !== 'public'}><summary>Relations, symbols and limits</summary>
        <div className="learn-equations">{topic.equations.map(equation => <div key={equation}>
          <NativeMath expression={equation} display /><EquationLesson expression={equation} topic={topic} mode={mode} />
        </div>)}</div>
        <p>Units in these relations: {[...new Set([...topic.symbols.matchAll(/\(([^)]+)\)/g)].map(match=>match[1]))].map(unit=><span key={unit}>({unit}) </span>)}. Open a relation for its complete symbol and unit key.</p>
        <p><strong>Frame:</strong> {topic.frame}</p><p><strong>Assumptions:</strong> {topic.assumptions}</p>
      </details>
      <p>Educational reference. These relations do not add a solver, supply missing evidence or certify a site. Unknown is not zero.</p>
      <ul>{topic.sources.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></li>)}</ul>
    </article>
  </div>;
}

export function LearningDialog({ mode, onClose }: { mode: PhysicsReferenceMode; onClose: () => void }) {
  const titleId = useId();
  return <dialog className="learning-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    ref={node => { if (node && !node.open) node.showModal(); }}>
    <div className="learn-heading"><div><h2 id={titleId}>Learn the models</h2><p>Ideas, native equations and the evidence each model needs.</p></div>
      <Button variant="ghost" size="icon" aria-label="Close learning dialog" onClick={onClose} autoFocus><X size={20} /></Button></div>
    <PhysicsReference mode={mode} />
  </dialog>;
}

/** A docked equation reference; changing topics never edits mission inputs. */
export function VariableReference({topicId}:{topicId:string}) {
 const [selected,setSelected]=useState(topicId);
 const topic=PHYSICS_TOPICS.find(item=>item.id===selected)??PHYSICS_TOPICS[0];
 return <section className="variable-reference" aria-label="Planner variable reference">
  <h2>Variables & formulae</h2>
  <label>Discipline<select aria-label="Variable discipline" value={selected} onChange={event=>setSelected(event.target.value)}>{PHYSICS_TOPICS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
  <p>{topic.explanation}</p>
  {topic.equations.map(expression=><div className="variable-relation" key={expression}><NativeMath expression={expression} display/><EquationLesson expression={expression} topic={topic} mode="plan"/></div>)}
  <details><summary>Assumptions, limits & sources</summary><p>{topic.correction}</p><p><strong>Frame:</strong> {topic.frame}</p><p>{topic.assumptions}</p><p><strong>Model boundary:</strong> {topic.calculated}</p><p><strong>Required evidence:</strong> {topic.evidence}</p><ul>{topic.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
 </section>;
}
