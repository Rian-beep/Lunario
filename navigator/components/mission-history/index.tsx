'use client';

import React, { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../ui/button';
import type { MissionHistoryRecord, MissionSource, Sourced } from '../../lib/mission-history/types';

export type MissionHistoryCardProps = { record: MissionHistoryRecord | null; mode: 'public' | 'teach' | 'plan' };

const card: CSSProperties = {
  color: 'var(--card-foreground)', background: 'var(--card)', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-md)', boxShadow: 'var(--mission-panel-shadow)',
  fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.5, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere',
};
const strip: CSSProperties = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
  background: 'var(--mission-title)', color: 'var(--mission-ink)', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--border)',
};
const block: CSSProperties = { margin: '0.5rem 0' };
const link: CSSProperties = { color: 'var(--mission-link)', textDecoration: 'underline', textUnderlineOffset: '0.15em' };
const sourceLanguage: Record<string, string> = { Russian: 'ru', Chinese: 'zh', Japanese: 'ja', Hebrew: 'he', English: 'en' };
const detail: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.75rem' };

function Citations({ ids, sources }: { ids: string[]; sources: MissionSource[] }) {
  return <span aria-label="Sources">{' '}{ids.map(id => {
    const s = sources.find(item => item.id === id);
    // Broken references must be visible even for a record supplied by another lane.
    return s ? <React.Fragment key={id}><a style={link} href={s.url} target="_blank" rel="noreferrer" aria-label={`Source: ${s.title} (${s.language})`}>[{s.publisher} · {s.language}]</a>{' '}</React.Fragment>
      : <span key={id}>[Unknown source: {id}] </span>;
  })}</span>;
}
function Value<T>({ fact, sources, children }: { fact: Sourced<T>; sources: MissionSource[]; children: (value: T) => ReactNode }) {
  return <>{fact.value === null ? <span>Unknown.</span> : children(fact.value)}
    {fact.note && <span style={{ display: 'block', color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>{fact.note}</span>}
    <Citations ids={fact.sourceIds} sources={sources}/>
  </>;
}
function TextFact({ label, fact, sources }: { label: string; fact: Sourced<string>; sources: MissionSource[] }) {
  return <div style={block}><dt style={{ fontWeight: 700 }}>{label}</dt><dd style={{ margin: 0 }}><Value fact={fact} sources={sources}>{value => value}</Value></dd></div>;
}
function ListFact({ label, fact, sources }: { label: string; fact: Sourced<string[]>; sources: MissionSource[] }) {
  return <div style={block}><dt style={{ fontWeight: 700 }}>{label}</dt><dd style={{ margin: 0 }}><Value fact={fact} sources={sources}>{items => items.length ? <ul style={{ margin: 0, paddingInlineStart: '1.25rem' }}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : 'None reported in this record.'}</Value></dd></div>;
}
function NumberFact({ label, unit, fact, sources }: { label: string; unit: string; fact: Sourced<number>; sources: MissionSource[] }) {
  const finite = fact.value !== null && !Number.isFinite(fact.value)
    ? { ...fact, value: null, note: 'The supplied value is not finite; no measurement can be displayed.' } : fact;
  return <div style={block}><dt style={{ fontWeight: 700 }}>{label}</dt><dd style={{ margin: 0 }}><Value fact={finite} sources={sources}>{value => `${value} ${unit}`}</Value></dd></div>;
}

function HistoryBody({ record, mode }: { record: MissionHistoryRecord; mode: MissionHistoryCardProps['mode'] }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const { sources } = record;
  if (dismissed) return <div style={{ ...card, padding: '0.5rem' }}>
    <Button variant="ghost" size="sm" onClick={() => setDismissed(false)} aria-label={`Reopen mission history: ${record.name}`}>Reopen mission history · {record.name}</Button>
  </div>;
  return <section style={card} aria-labelledby={`${id}-title`}>
    <header style={strip}>
      <h3 id={`${id}-title`} style={{ margin: 0, flex: '1 1 10rem', fontSize: '0.95rem', fontWeight: 800 }}>{record.name} · History</h3>
      <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={`${id}-facts`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse facts' : 'Expand facts'}</Button>
      <Button variant="ghost" size="sm" aria-label={`Dismiss mission history: ${record.name}`} onClick={() => setDismissed(true)}>Dismiss</Button>
    </header>
    <div style={{ padding: '0.5rem 0.75rem' }}>
      <p style={block}><Value fact={record.publicSummary} sources={sources}>{value => value}</Value></p>
      <dl style={block}>
        {record.outcome.value === null
          ? <TextFact label="Landing and science outcome" fact={{ ...record.outcome, value: null }} sources={sources}/>
          : <>
            <TextFact label="Touchdown outcome" fact={{ ...record.outcome, value: record.outcome.value.landing }} sources={sources}/>
            <TextFact label="Science accomplished" fact={{ ...record.outcome, value: record.outcome.value.science }} sources={sources}/>
          </>}
      </dl>
      {mode !== 'public' && <div style={{ ...block, borderInlineStart: '3px solid var(--mission-selected)', paddingInlineStart: '0.5rem' }}>
        <strong>{mode === 'teach' ? 'Investigate the evidence' : 'Historical evidence limits'}</strong>
        <p style={block}><Value fact={mode === 'teach' ? record.educatorNotes : record.plannerNotes} sources={sources}>{value => value}</Value></p>
      </div>}
      <div id={`${id}-facts`} hidden={!expanded} style={{ maxHeight: 'min(55vh, 28rem)', overflowY: 'auto', scrollbarGutter: 'stable' }}>
        <dl style={block}>
          <TextFact label="Operator" fact={record.operator} sources={sources}/>
          <ListFact label="Sponsors and documented support" fact={record.sponsors} sources={sources}/>
          <ListFact label="Representing" fact={record.representing} sources={sources}/>
          <TextFact label="Hardware designation" fact={record.model} sources={sources}/>
          <TextFact label="Mission dates" fact={record.missionDates} sources={sources}/>
          <ListFact label="Objectives" fact={record.objectives} sources={sources}/>
          <ListFact label="Discoveries and reported measurements" fact={record.discoveries} sources={sources}/>
          <ListFact label="Technical achievements" fact={record.innovations} sources={sources}/>
        </dl>
        <details style={detail}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Exploration and coverage evidence</summary>
          <dl style={block}>
            <TextFact label="Exploration summary" fact={record.exploration.summary} sources={sources}/>
            <NumberFact label="Surface traverse distance" unit="km" fact={record.exploration.distanceKm} sources={sources}/>
            <NumberFact label="Measured coverage area" unit="km²" fact={record.exploration.areaKm2} sources={sources}/>
          </dl>
          <p style={block}>{record.exploration.route ? 'A source route is recorded; consult the cited route reference for its frame and limitations.' : 'Coordinate route unknown; no route or coverage shape is inferred.'}</p>
          <p style={block}>Exploration source / context: <Citations ids={record.exploration.summary.sourceIds} sources={sources}/></p>
          {record.exploration.route && <p style={block}>Route reference: {record.exploration.routeSourceIds?.length
            ? <Citations ids={record.exploration.routeSourceIds} sources={sources}/> : 'Unknown source; route cannot be treated as verified.'}</p>}
        </details>
        <details style={detail}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Original sources and translation notes ({sources.length})</summary>
          <p style={block}>Facts are stored with this app. Links open the original references and require a connection; selecting a mission downloads nothing.</p>
          {sources.length === 0 && <p>Unknown: no sources supplied for this record.</p>}
          <ul style={{ paddingInlineStart: '1.25rem', margin: 0 }}>{sources.map(s => <li key={s.id} style={block}>
            <a href={s.url} style={link} target="_blank" rel="noreferrer" dir="auto" lang={sourceLanguage[s.language]}>{s.title}</a>
            <div>{s.publisher} · {s.country} · {s.language}</div>
            <div style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem' }}>{s.translationNote ?? 'Translation provenance unknown; consult the original source.'}</div>
          </li>)}</ul>
        </details>
      </div>
    </div>
  </section>;
}

/** Selection identity resets both dismissal and expansion; no effect, fetch or persistent state. */
export function MissionHistoryCard({ record, mode }: MissionHistoryCardProps) {
  if (!record) return <p style={{ ...card, padding: '0.5rem 0.75rem' }}>No historical landing record is catalogued for this selection.</p>;
  return <HistoryBody key={record.id} record={record} mode={mode}/>;
}
