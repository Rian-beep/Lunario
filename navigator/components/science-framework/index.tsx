'use client';
import React, { useId, useState } from 'react';
import { Button } from '../ui/button';
import { AUDIENCE_GUIDANCE, QUALIFICATION_GATES, RESOLUTION_POLICY, SCIENCE_NODES, SCIENCE_PIPELINES, SCIENCE_SOURCES, scienceSourceUrl, type ScienceFinding, type ScienceFrameworkContext, type ScienceFrameworkMode } from '../../lib/science-framework';
import { ScienceEquation, ScienceSymbols } from './equations';
import { scienceFrameworkStyles } from './styles';
export type ScienceFrameworkProps = {
  mode: ScienceFrameworkMode;
  context?: ScienceFrameworkContext;
  findings?: readonly ScienceFinding[];
};
const measured = (value:number, unit:string) => Number.isFinite(value) ? `${value} ${unit}` : 'Unavailable';
function SourceLink({url, children}:{url:string; children:React.ReactNode}) {
  const safe = scienceSourceUrl(url);
  return safe ? <a href={safe} target="_blank" rel="noreferrer">{children}</a> : <span>Source URL unavailable</span>;
}
export function ScienceFramework({mode,context,findings}:ScienceFrameworkProps) {
  const [dismissed,setDismissed] = useState(false);
  const uid = useId();
  const titleId = `${uid}-title`, explorerId = `${uid}-variables`;
  const guidance = AUDIENCE_GUIDANCE[mode];
  const nodeHref = (id:string) => `#${uid}-${id}`;
  const followVariable = (event:React.MouseEvent<HTMLAnchorElement>) => {
    const explorer = document.getElementById(explorerId);
    if (explorer instanceof HTMLDetailsElement) explorer.open = true;
    const target = document.getElementById(decodeURIComponent(event.currentTarget.hash.slice(1)));
    if (target instanceof HTMLDetailsElement) target.open = true;
  };
  if(dismissed) return <div className="science-framework"><style>{scienceFrameworkStyles}</style><div className="sf-body"><Button variant="outline" onClick={()=>setDismissed(false)}>Show science framework</Button></div></div>;
  return <section className="science-framework" aria-labelledby={titleId} data-audience={mode}>
    <style>{scienceFrameworkStyles}</style>
    <header><div><p className="sf-kicker">Sources → engines → outputs → checks</p><h2 id={titleId}>How Lunario reaches an answer</h2><p>Resource screening and learning. Mission-critical reliability requires further evidence and qualification.</p></div><Button variant="outline" onClick={()=>setDismissed(true)}>Hide framework</Button></header>
    <div className="sf-body">
      <h3>{guidance.title}</h3><p>{guidance.intro}</p><p className="sf-note">{guidance.action}</p>
      <details className="sf-card" open><summary>Current inputs and identities</summary><div className="sf-content">
        {context ? <dl>
          <dt>Latitude / east longitude</dt><dd>{measured(context.lat,'°')} / {measured(context.lon,'°')}</dd>
          <dt>Selected epoch</dt><dd>{context.epochUtc || 'Unavailable'} (UTC input)</dd>
          <dt>Display observer</dt><dd>{measured(context.observerHeightM,'m')}</dd>
          <dt>Solar array</dt><dd>{measured(context.arrayHeightM,'m')}</dd>
          <dt>Antenna</dt><dd>{measured(context.antennaHeightM,'m')}</dd>
          <dt>Terrain</dt><dd>{context.terrainLabel || 'Unavailable'} · {context.terrainMode || 'Unavailable'}</dd>
          <dt>Dataset</dt><dd><code>{context.datasetId || 'Unavailable'}</code></dd>
          <dt>Model</dt><dd><code>{context.modelVersion || 'Unavailable'}</code></dd>
        </dl> : <p>Current context unavailable. No location, epoch, height, dataset or model identity was supplied.</p>}
        <p className="sf-muted">These are the caller’s current inputs. This panel does not compute results or verify that an audit finding belongs to them. Match each finding’s scope before using it.</p>
      </div></details>
      <details className="sf-card" open><summary>Scientific audit findings · {findings?.length ? `${findings.length} supplied` : 'audit pending'}</summary><div className="sf-content">
        {!findings?.length ? <p className="sf-note">Audit pending. No findings supplied; no scientific check is marked passing.</p> : findings.map((finding,i)=><article className="sf-finding" key={`${finding.id}-${i}`}>
          <span className="sf-status">{finding.status === 'verified' ? 'Verified within stated scope' : finding.status === 'failing' ? 'Failing' : 'Uncertain'}</span>
          <h4>{finding.claim}</h4><dl><dt>Finding</dt><dd>{finding.id}</dd><dt>Scope</dt><dd>{finding.scope || 'Scope not supplied'}</dd><dt>Limits</dt><dd>{finding.limitations || 'Limitations not supplied; do not infer completeness.'}</dd></dl>
          <ul aria-label="Finding sources">{finding.sourceUrls.map((url,j)=><li key={`${url}-${j}`}><SourceLink url={url}>{url}</SourceLink></li>)}</ul>
        </article>)}
        <p>Findings are supplied by separate audits. A citation, successful render or test count is not operational qualification. No overall scientific pass is calculated here.</p>
      </div></details>
      <details className="sf-card" open><summary>Source-to-output dependency diagram</summary><div className="sf-content">
        <p>Each output links to its engine card. “Inputs from” shows direct dependencies; follow those links back to the source. Terrain and smooth-sphere results remain paired.</p>
        <div className="sf-grid">{SCIENCE_PIPELINES.map(pipeline=><article className="sf-pipeline" key={pipeline.title}>
          <h4>{pipeline.title}</h4><p><strong>Source:</strong> {pipeline.source}</p><p className="sf-muted"><strong>Build / load path:</strong> {pipeline.preparation}</p><ol>{pipeline.nodes.map(id=>{
            const node = SCIENCE_NODES.find(n=>n.id===id)!;
            return <li key={id}><a href={nodeHref(id)} onClick={followVariable}>{node.name}</a><span className="sf-dependency">{node.dependsOn.length ? <>← Inputs from {node.dependsOn.map((parent,i)=><React.Fragment key={parent}>{i>0 ? ', ' : ''}<a href={nodeHref(parent)} onClick={followVariable}>{SCIENCE_NODES.find(n=>n.id===parent)!.name}</a></React.Fragment>)}</> : '← Selected user input; no derived dependency'}</span></li>;
          })}</ol><p><strong>Output:</strong> {pipeline.result}</p>
        </article>)}</div>
      </div></details>
      <details className="sf-card" id={explorerId} open={mode !== 'public'}><summary>Variable → equation → engine → verification</summary><div className="sf-content">
        <p>Equations describe the existing engines; they are not a second calculator. Angles in equations use radians; interface/catalogue degrees and engine hours are converted explicitly where required.</p>
        {SCIENCE_NODES.map(node=><details className="sf-card sf-variable" key={node.id} id={`${uid}-${node.id}`} open={mode === 'teach'}>
          <summary>{node.name}</summary><div className="sf-content"><p>{node.intuition}</p><dl><dt>Symbols / names</dt><dd><ScienceSymbols id={node.id}/></dd><dt>SI and native units</dt><dd>{node.units}</dd></dl>
            <div className="sf-equation" tabIndex={0} role="region" aria-label={`${node.name} native equation`}><ScienceEquation id={node.id}/></div>
            <dl><dt>Depends on</dt><dd>{node.dependsOn.length ? node.dependsOn.map((id,i)=><React.Fragment key={id}>{i>0 ? ' · ' : ''}<a href={nodeHref(id)} onClick={followVariable}>{SCIENCE_NODES.find(n=>n.id===id)!.name}</a></React.Fragment>) : 'Selected input'}</dd><dt>Engine</dt><dd><code>{node.implementation}</code></dd><dt>Output</dt><dd>{node.output}</dd><dt>How to check</dt><dd>{node.verification}</dd><dt>Limits</dt><dd>{node.limits}</dd></dl>
            <p>{node.sources.map((id,i)=><React.Fragment key={id}>{i>0 ? ' · ' : ''}<SourceLink url={SCIENCE_SOURCES[id].url}>{SCIENCE_SOURCES[id].title}</SourceLink></React.Fragment>)}</p>
          </div>
        </details>)}
      </div></details>
      <details className="sf-card" open={mode === 'plan'}><summary>Coordinate frames, UTC / TDB and position checks</summary><div className="sf-content">
        <p><SourceLink url={SCIENCE_SOURCES.terrain.url}>NASA PGDA90</SourceLink> declares MOON_ME of DE421, with south-polar stereographic coordinates in metres. Catalog metadata names MOON_ME / Horizons MEAN_ME. Source-to-input orientation alignment and its propagated error remain uncertain; matching frame labels is insufficient.</p>
        <p>Moon-fixed coordinates define local east/north/up. Flight uses east/up/north metres; the renderer maps east/up/minus-north to scene coordinates with one unit per kilometre. NASA globe relief and streamed tile coordinates are display assets with their own transforms. Their orientation must be checked separately from numerical terrain.</p>
        <p>Mission epochs are UTC. Horizons observer and vector products have different time/correction conventions: dynamical ephemerides use TDB where requested. Preserve raw headers and perform explicit UTC↔TDB conversion with versioned leap-second/EOP/kernel evidence where required. <SourceLink url={SCIENCE_SOURCES.horizons.url}>AIRLESS observer AZ/EL remains apparent, with light-time/aberration conventions</SourceLink>; it is not an instantaneous geometric vector.</p>
        <p>For Moon/Earth positions, check target, observing centre, range direction, reference frame, epoch and correction mode before residuals. Compare the decoded client Sun/Earth AZ/EL with fresh lunar-site observer tables; separately check Earth-station Moon geometry against archived CSPICE samples. Azimuth differences must wrap at 360°. Check range independently: agreement in angle does not prove the range is correct. A repair is accepted only with its new dataset identity and dated audit evidence.</p>
        <p>These checks exercise implementation against a reference. They do not establish independent observational truth or validate horizon occlusion. Historical residual counts are not current audit status.</p>
      </div></details>
      <details className="sf-card" open={mode !== 'public'}><summary>What changes with zoom—and what the evidence supports</summary><div className="sf-content">
        <p className="sf-note">Zoom changes rendering LOD, not scientific evidence quality. A sharp image or dense mesh cannot recover unresolved terrain or qualify a landing.</p>
        {RESOLUTION_POLICY.map(item=><article key={item.name}><h4>{item.name}</h4><p>{item.detail}</p></article>)}
        <p>Use the selected asset’s actual source and output metadata. Effective resolution and physical accuracy require their own evidence. Historical LROC shadows belong to image acquisition conditions; inspection lighting and the epoch-driven analytical Sun are separate.</p>
      </div></details>
      <details className="sf-card" open={mode === 'plan'}><summary>What mission-critical reliability would require</summary><div className="sf-content"><p>Lunario is a screening and teaching tool. No operational qualification is asserted.</p><ol>{QUALIFICATION_GATES.map(gate=><li key={gate}>{gate}</li>)}</ol><p>Missing evidence remains pending or unassessed. A known failure remains a failure even when another part of the chain is verified. Regional ranking, generic flight previews and reported external passes cannot substitute for these gates.</p></div></details>
    </div>
  </section>;
}
