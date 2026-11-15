'use client';

import { Button } from '../ui/button';
import { missionReasonsForSite, missionTrajectoriesForSite, MISSION_TRAJECTORY_COVERAGE } from '../../lib/mission-trajectories-catalog';

export type MissionTrajectorySelection =
  | { mode: 'published'; siteId: string; trajectoryId: string }
  | { mode: 'educational-simulation'; siteId: string };
export interface MissionTrajectorySelectorProps {
  site: { id: string; name: string };
  /** Controlled by parent. On site change, discard a selection belonging to the previous site. */
  selection: MissionTrajectorySelection | null;
  /** Parent loads the dataset, resets/pauses its replay clock, and eases the existing site camera. Does not change the planning epoch. */
  onSelect: (selection: MissionTrajectorySelection) => void;
  onClose?: () => void;
}
const styles = `
.mission-trajectories{color:var(--mission-ink,#25241f);background:var(--card,#fce3d4);border:2px solid currentColor;box-shadow:4px 4px 0 currentColor;max-width:40rem;font:inherit;line-height:1.5;overflow-wrap:anywhere}
.mission-trajectories *{box-sizing:border-box}
.mission-trajectories header{background:var(--mission-title,#ff913e);padding:.8rem 1rem;border-bottom:2px solid currentColor;display:flex;gap:1rem;justify-content:space-between;align-items:start}
.mission-trajectories h2,.mission-trajectories h3,.mission-trajectories p{margin:0}
.mission-trajectories h2{font-size:1.15rem}.mission-trajectories h3{font-size:1rem}
.mission-trajectories .mt-body{padding:1rem;display:grid;gap:1rem}
.mission-trajectories .mt-option{background:var(--mission-cream,#fffbed);border:1px solid currentColor;padding:.8rem;display:grid;gap:.55rem}
.mission-trajectories .mt-kind{font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.mission-trajectories [data-slot=button]{height:auto;min-height:2.75rem;white-space:normal;text-align:left;padding:.5rem .75rem;cursor:pointer;border:1px solid currentColor;background:var(--mission-cream,#fffbed);color:inherit;font:inherit}
.mission-trajectories [aria-pressed=true]{background:var(--mission-selected,#afe1bb)}
.mission-trajectories :focus-visible{outline:3px solid var(--mission-link,#245675);outline-offset:3px}
.mission-trajectories summary{cursor:pointer;font-weight:700;padding:.25rem 0}
.mission-trajectories details[open]>summary{margin-bottom:.5rem}
.mission-trajectories ul{margin:.4rem 0;padding-left:1.25rem}
.mission-trajectories a{color:var(--mission-link,#245675);text-decoration:underline}
.mission-trajectories dl{margin:.5rem 0;display:grid;grid-template-columns:5rem minmax(0,1fr);gap:.25rem .5rem;font-size:.9rem}.mission-trajectories dd{margin:0}
`;
/** Isolated selection/inspection panel. No fetch, renderer, animation loop, historical edits, or shared application-state mutations. */
export function MissionTrajectorySelector({ site, selection, onSelect, onClose }: MissionTrajectorySelectorProps) {
  const datasets = missionTrajectoriesForSite(site.id);
  const coverage = MISSION_TRAJECTORY_COVERAGE.find(row => row.siteId === site.id);
  const reasons = missionReasonsForSite(site.id);
  const active = selection?.siteId === site.id ? selection : null;
  return <section className="mission-trajectories" aria-label={`Trajectory evidence for ${site.name}`}>
    <style>{styles}</style>
    <header><div><p>Mission paths</p><h2>{site.name}</h2></div>{onClose && <Button variant="outline" onClick={onClose} aria-label="Close mission paths">Close</Button>}</header>
    <div className="mt-body">
      <p>{coverage?.missing ?? 'No validated historic trajectory is bundled for this site.'}</p>
      {coverage?.status === 'not-reviewed' && <p>This site’s trajectory sources have not been individually reviewed in this catalogue.</p>}
      {datasets.map(data => <article className="mt-option" key={data.id}>
        <p className="mt-kind">{data.kind === 'reference' ? 'Published reference · flown accuracy unresolved' : 'Reconstructed orbit · orbital context only'}</p>
        <h3>{data.vehicle}</h3>
        <p>{data.uncertainty}</p>
        <Button variant="outline" aria-pressed={active?.mode === 'published' && active.trajectoryId === data.id} onClick={() => onSelect({ mode: 'published', siteId: site.id, trajectoryId: data.id })}>
          {data.phase === 'orbit' ? 'Select command-module orbit' : 'Select reference descent'}
        </Button>
        <details><summary>Coverage and sources</summary>
          <dl><dt>Starts</dt><dd>{data.epoch.calendar} {data.epoch.scale} ({data.epoch.utc} UTC)</dd><dt>Duration</dt><dd>{data.coverage.end} seconds</dd><dt>Samples</dt><dd>{data.coverage.cadenceSeconds} seconds apart; linear display interpolation</dd><dt>Frame</dt><dd>Moon-centered {data.frame.name}; km and km/s</dd></dl>
          <ul>{data.missing.map(item => <li key={item}>{item}</li>)}</ul>
          <ul>{data.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.version}</a></li>)}</ul>
        </details>
      </article>)}
      <article className="mt-option"><p className="mt-kind">Educational simulation · editable</p><p>Explore an idealized flight at this site with the existing flight controls. It is independent of the historic mission.</p>
        <Button variant="outline" aria-pressed={active?.mode === 'educational-simulation'} onClick={() => onSelect({ mode: 'educational-simulation', siteId: site.id })}>Select educational simulation</Button>
      </article>
      {reasons.length > 0 && <details><summary>Why these paths and maneuvers?</summary>
        {reasons.map(reason => <article className="mt-option" key={reason.id}><p className="mt-kind">{reason.basis === 'source-derived' ? 'Documented rationale' : reason.basis === 'model-design' ? 'Display design choice' : 'Unresolved evidence'}</p><h3>{reason.goal}</h3><p>{reason.explanation}</p><p>What matters: {reason.variables.join('; ')}.</p><ul>{reason.citations.map(citation => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.locator}</a></li>)}</ul></article>)}
      </details>}
      <p>At 1×, one wall-clock second advances one mission second. This is a replay of published samples. Position data supplies no spacecraft attitude.</p>
    </div>
  </section>;
}
