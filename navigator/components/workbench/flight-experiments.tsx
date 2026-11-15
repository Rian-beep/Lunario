'use client';

import { useContext, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FlightInputs, FlightResult } from '@/lib/flight';
import { createFlightExperiment, FLIGHT_EXPERIMENTS, flightDiagnostics, flightFuelReason, type FlightExperimentId } from '@/lib/flight-experiments';
import { AudienceContext, Info } from './info';
import { Section, number } from './controls';
import { NativeMath } from './native-math';
import { explainPublicFlight, flightEdits } from '@/lib/flight-lessons';

export type FlightExperimentsProps = {
  value: FlightInputs;
  result: FlightResult;
  onChange: (next: FlightInputs) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReplay?: () => void;
  onFollow?: () => void;
  playing?: boolean;
  preparing?: boolean;
};

export function FlightExperiments({ value, result, onChange, onPlay, onPause, onReplay, onFollow, playing = false, preparing = false }: FlightExperimentsProps) {
  const audience = useContext(AudienceContext);
  const selectId = useId();
  const [selected, setSelected] = useState<FlightExperimentId>('assisted');
  const experiment = FLIGHT_EXPERIMENTS.find(e => e.id === selected)!;
  const diagnostics = flightDiagnostics(value, result);
  const explanation = explainPublicFlight(value, result);
  const contact = result.contact, outcome = result.landingOutcome;
  const last = result.points.at(-1);
  const nextAction = !last ? 'Check the flight inputs and obtain a valid integrated result before interpreting this attempt.'
    : contact && !contact.terrainKnown ? 'Obtain numerical terrain at contact before judging a landing. A different camera view cannot resolve missing ground.'
    : result.fuelExhausted ? 'Compare a shorter powered-time request or a different propellant mass, one at a time; then check whether contact speed still meets the entered limits.'
    : outcome && value.landing && Math.abs(outcome.verticalMps ?? 0) > value.landing.maxVerticalMps ? 'Compare thrust or initial downward speed, one at a time. More thrust is only useful while powered time and fuel permit braking.'
    : outcome && value.landing && (outcome.horizontalMps ?? 0) > value.landing.maxHorizontalMps ? 'Reduce initial sideways speed alone and replay; compare sideways contact speed and target error.'
    : outcome && value.landing && (outcome.targetErrorM ?? 0) > value.landing.targetRadiusM ? 'Compare the start offset alone; widening target radius changes the requirement, not where the vehicle lands.'
    : outcome?.state === 'within-assumed-limits' ? 'Keep these inputs as your comparison, change one variable and replay. Inspect settling separately from the incoming-contact limits.'
    : value.mode === 'ascent' ? 'Compare final burn pitch alone; watch the trade between altitude and sideways motion.'
    : 'Inspect contact reasons and powered-time limits below, then change one input and replay.';
  const weight = diagnostics.gravityMps2 === null ? null : value.wetMassKg * diagnostics.gravityMps2;
  return <Section title="Flight experiments" detail="Choose a reference, predict, play, then change one variable. Local flight only.">
    <div className="grid min-w-0 gap-2">
      <p className="flight-goal">{value.mode === 'ascent' ? 'Launch challenge: gain height, then trade height for sideways speed.' : 'Landing challenge: slow down and touch down gently inside the target.'} The flight runs automatically. You are the engineer: choose a setup, watch, change one setting and try again.</p>
      <div className="flight-reference-row">
      <label className="control-label" htmlFor={selectId}>Reference to load
        <select id={selectId} aria-label="Reference to load" value={selected} onChange={e => setSelected(e.target.value as FlightExperimentId)}>
          {FLIGHT_EXPERIMENTS.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </label>
      <Button variant="outline" onClick={() => onChange(createFlightExperiment(selected))}>Load reference</Button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Experiment playback">
        <Button onClick={playing || preparing ? onPause : onPlay} disabled={playing || preparing ? !onPause : !onPlay}>{preparing ? 'Cancel play request' : playing ? 'Pause experiment' : 'Play experiment'}</Button>
        <Button variant="outline" onClick={onReplay} disabled={!onReplay}>Replay experiment</Button>
        <Button variant="outline" onClick={onFollow} disabled={!onFollow}>Follow vehicle</Button>
      </div>
      {preparing && <p role="status">Preparing Follow view. Playback starts when the vehicle is visible and framed.</p>}
      {(!onPlay || !onPause || !onReplay || !onFollow) && <small className="muted">Unavailable playback or camera controls are disabled until connected to the scene.</small>}
      <FlightEditFeedback value={value} result={result} />
      {audience === 'public' && <div className="constraint" data-public-flight-verdict>
        <strong>Prediction · {explanation.title}</strong>
        <ul>{explanation.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
        <p>Press Play to watch this prediction. Path green = entered limits met; red = failed check; amber = missing evidence. Touchdown motion can still show sliding or tipping.</p>
      </div>}
      <details className="flight-reference-help"><summary>What to try next · selected reference</summary>
      <small className="muted">Loading replaces flight inputs and hardware with this example. Browsing references, moving the camera and changing sites do not reset edits here.</small>
      <p><strong>Predict:</strong> {experiment.predict}</p>
      <p><strong>Change one variable:</strong> {experiment.change}</p>
      </details>
      <details open={audience !== 'public'}><summary>Calculated contact numbers & next test</summary>
      <div className="constraint" data-flight-experiment-observation>
        <strong>Observe · current inputs</strong>
        {contact ? <>
          <p>{contact.terrainKnown ? 'Numerical terrain contact' : 'Reference-sphere contact; numerical ground unavailable'} at {number(contact.timeS, 2)} s.</p>
          <p>Incoming vertical {number(outcome?.verticalMps, 2)} m/s · sideways {number(outcome?.horizontalMps, 2)} m/s · target error {number(contact.targetErrorM, 2)} m.</p>
          <p>{outcome?.state === 'within-assumed-limits' ? 'Within entered incoming-contact limits; inspect settling separately.' : outcome?.state === 'outside-assumed-limits' ? 'Outside entered incoming-contact limits; inspect the reasons below.' : 'Contact requirements unresolved; missing terrain is not a pass.'}</p>
        </> : last ? <p>No modeled contact during this preview. End radial speed {number(last.verticalMps, 2)} m/s; maximum altitude {number(result.maxAltitudeM / 1000, 2)} km. A climbing path is not proof of orbit.</p> : <p>Flight result unavailable; no contact or fuel conclusion can be drawn.</p>}
        <p>{flightFuelReason(value, result)}</p>
        <p><strong>Next test:</strong> {nextAction}</p>
        {audience === 'teach' && <p>Compare your prediction with these integrated values, then repeat with every other input held fixed. A change in terrain is another variable.</p>}
        {audience === 'plan' && <p>Incoming limits are entered assumptions. Review signed radial speed, sideways speed, target error, fuel cutoff and numerical terrain coverage before interpreting contact continuation.</p>}
      </div>
      </details>
      <details><summary>Reference evidence & next comparison</summary>
        <p>{experiment.reference} This is a tested synthetic, zero-height surface, not the selected lunar site’s result. Current-site values above come only from the supplied flight integration.</p>
        <p>Play follows the current clock; use Replay experiment to start again. Contact continuation may show settling, sliding, bounce or breakup where supported. Its behavior is separate from the incoming-contact verdict.</p>
        <p>No live piloting or throttle override is applied. Edit inputs and replay. None of these examples certifies a vehicle, site or mission.</p>
      </details>
      <details><summary>Engineering intuition · thrust, braking & propellant</summary>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2">
          <dt>Initial thrust / lunar weight <Info label="Initial thrust / weight" /></dt><dd>{number(diagnostics.thrustToWeight, 2)} ×</dd>
          <dt>Maximum upright net acceleration</dt><dd>{number(diagnostics.uprightNetMps2, 2)} m/s²</dd>
          <dt>Ideal vertical stopping distance</dt><dd>{diagnostics.stoppingDistanceM === null ? 'Unavailable' : `${number(diagnostics.stoppingDistanceM, 1)} m`}</dd>
          <dt>Propellant at airborne end</dt><dd>{number(diagnostics.remainingPropellantKg, 1)} kg</dd>
          <dt>Ideal remaining velocity-change budget <Info label="Ideal engine Δv" /></dt><dd>{number(diagnostics.idealRemainingDeltaVMps, 0)} m/s</dd>
        </dl>
        {diagnostics.stoppingUnavailable && <p>{diagnostics.stoppingUnavailable}</p>}
        <p>Maximum upright net acceleration is thrust divided by initial mass, minus central lunar gravity ({number(diagnostics.gravityMps2, 3)} m/s²). It is potential upward braking, assuming full thrust points straight up; it is not the actual guidance command. Negative values accelerate a descent downward even at full upright thrust.</p>
        <p>Stopping distance uses incoming downward radial speed squared divided by twice that positive acceleration. It freezes initial mass and gravity, assumes immediate upright thrust and ignores sideways motion, steering, terrain clearance and finite burn/propellant limits. It does not prove closed-loop feasibility.</p>
        <p>The remaining ideal budget uses the actual last airborne mass down to entered dry mass. It omits gravity and steering losses and may be unusable after burn cutoff or contact. It is not an operational reserve margin.</p>
        {audience !== 'public' && <>
          <NativeMath expression="a⃗ = (T / m) û_thrust − μ r⃗ / |r⃗|³" display />
          <p>Thrust in newtons divided by mass in kilograms gives acceleration in m/s². The gravity parameter and body-centred position supply central gravity. The upright estimate omits rotation terms; it does not replace the selected integrated frame.</p>
          <NativeMath expression="Δv_ideal = Isp g₀ ln(m₀ / mf)" display />
          <p>For the remaining budget, initial mass in this relation is the last airborne mass; final mass is dry mass. Specific impulse is in seconds and standard gravity is 9.80665 m/s², not lunar gravity.</p>
        </>}
        <p><strong>Thrust:</strong> this vehicle’s initial lunar weight is {number(weight, 0)} N. Try thrust below, near and above this vehicle-relative reference, changing nothing else. It is not a universal safe operating range. <Info label="Thrust" /></p>
        <p><strong>Mass:</strong> wet mass includes propellant; dry mass is the depletion floor. Raising wet mass alone adds fuel and weight; raising dry mass alone removes usable fuel. Keep dry mass at or below wet mass. <Info label="Wet mass" /> <Info label="Dry mass" /></p>
        <p><strong>Burn & efficiency:</strong> longer burn permits thrust for longer, only while fuel remains. Specific impulse changes fuel use per unit thrust, not initial thrust. Try burn duration or specific impulse separately. <Info label="Burn duration" /> <Info label="Specific impulse" /></p>
        <p><strong>Start & direction:</strong> a faster descent needs more braking distance; more height buys time but is not known terrain clearance. Sideways speed requires its own braking. Manual pitch trades upward support against sideways thrust; assisted guidance ignores manual pitch. <Info label="Vertical speed" /> <Info label="Horizontal speed" /> <Info label="Start altitude" /> <Info label="Initial pitch" /></p>
        <p><strong>After contact:</strong> restitution from 0 to 1 varies ideal rebound; friction changes sliding. Breakup energy is an editable demonstration threshold, not measured vehicle strength. Changing a contact limit changes the verdict, not the incoming trajectory.</p>
      </details>
    </div>
  </Section>;
}


function FlightEditFeedback({value,result}: {value:FlightInputs;result:FlightResult}) {
  const [record,setRecord] = useState<{value:FlightInputs;result:FlightResult;previous?:{value:FlightInputs;result:FlightResult}}>(()=>({value,result}));
  if (record.value !== value || record.result !== result) {
    const changed = flightEdits(record.value,value).length > 0;
    setRecord({value,result,previous:changed?{value:record.value,result:record.result}:record.previous});
  }
  if (!record.previous) return null;
  const edits = flightEdits(record.previous.value,value);
  if (!edits.length) return null;
  const old = record.previous.result.landingOutcome, next = result.landingOutcome;
  return <div className="constraint" data-flight-edit-feedback>
    <strong>{edits.length===1?`Changed ${edits[0].label}`:`Changed ${edits.length} settings`}</strong>
    {edits.length===1?<p>{edits[0].before} → {edits[0].after}. {edits[0].explanation}</p>:<p>A setup or several settings changed together. Change just one next time to see its individual effect.</p>}
    {old?.verticalMps!=null&&next?.verticalMps!=null&&<p>Predicted up/down contact speed: {number(Math.abs(old.verticalMps),2)} → {number(Math.abs(next.verticalMps),2)} m/s. Target distance: {number(old.targetErrorM,2)} → {number(next.targetErrorM,2)} m.</p>}
    <p>Playback reset and paused. Press Play to watch the changed setup. These are calculated comparisons, not proof that one input alone caused a real-world outcome.</p>
  </div>;
}
