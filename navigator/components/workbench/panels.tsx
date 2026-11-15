"use client";
import { createLandingFlight } from "@/lib/landing-presets";
import { FLIGHT_CONTROL_LESSONS } from "@/lib/flight-lessons";
import { FlightExperiments } from "./flight-experiments";
import { DEFAULT_LANDING_CONFIGURATION } from "@/lib/landing-contract";
import { LANDING_RANGES, MAX_LANDING_OFFSET_M } from "@/lib/landing-inputs";
import {AssessmentExplanation} from "./assessment-explanation";
import {EngineeringComparison} from "./engineering-comparison";
import {FlightSolverDetails} from "./science-charts";
import { useContext, useEffect, useId, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geometricSearchKey, geometricSearchGuard, normalizedSearchLongitude } from "@/lib/search-key";
import decodedValidation from "@/docs/qa/horizons-decoded-validation.json";
import { NumberField, Section, number } from "./controls";
import {
  DEFAULT_FLIGHT,
  type FlightInputs,
  type FlightResult,
} from "@/lib/flight";
import {
  linkBudget,
  type LinkInputs,
  type MissionAssumptions,
  type MissionResult,
} from "@/lib/mission";
import {
  formatPercent,
  formatUtc,
  indexToMs,
  rankWindows,
  type SampleSeries,
  type TerrainChoice,
  type Summary,
} from "@/lib/astro";
import { type Catalog } from "@/lib/catalog";
import { RESOURCES, LESSONS } from "@/lib/resources";
import type { ScenarioState } from "@/lib/scenario";
import { csvCell } from "@/lib/export";
import { evaluateScenario } from "@/lib/assessment";
import { diffScenarios, classifyScenarioDiff } from "@/lib/scenario-diff";
import { parseEvidenceManifest } from "@/lib/provenance";
import type { EvidenceManifest } from "@/lib/planning-types";
import bundledComparisonEvidence from "@/public/data/evidence-manifest.json";
import { HorizonGraph, ElevationGraph } from "./science-charts";
import { AudienceContext, Info } from "./info";
import { ResourceEvidenceComparison } from "@/components/education-materials/resource-evidence";

export function PlannerInputs({
  value,
  onChange,
  result,
  radio,
  onRadioChange,
}: {
  value: MissionAssumptions;
  onChange: (a: MissionAssumptions) => void;
  result: MissionResult;
  radio: Partial<LinkInputs>;
  onRadioChange: (a: Partial<LinkInputs>) => void;
}) {
  const update = (k: keyof MissionAssumptions, n: number) =>
    onChange({ ...value, [k]: n });
  const link = linkBudget(radio);
  return (
    <>
      <Section
        title="Solar array"
        detail="Sizing assumptions, not vehicle specifications. Fixed flux is editable; no thermal or degradation model."
      >
        <label className="select-field">
          Array orientation
          <Info label="Array orientation" />
          <select
            value={value.arrayMode}
            onChange={(e) =>
              onChange({
                ...value,
                arrayMode: e.target.value as MissionAssumptions["arrayMode"],
              })
            }
          >
            <option value="tracking">Tracks the Sun</option>
            <option value="fixed">Fixed orientation</option>
          </select>
        </label>
        <div className="field-grid">
          <NumberField
            label="Array area"
            unit="m²"
            value={value.areaM2}
            min={0}
            max={100000}
            onChange={(n) => update("areaM2", n)}
          />
          <NumberField
            label="Cell efficiency"
            unit="%"
            value={value.efficiency * 100}
            min={0}
            max={100}
            onChange={(n) => update("efficiency", n / 100)}
          />
          <NumberField
            label="System losses"
            unit="%"
            value={value.lossFraction * 100}
            min={0}
            max={100}
            onChange={(n) => update("lossFraction", n / 100)}
          />
          <NumberField
            label="Incident flux"
            unit="W/m²"
            value={value.solarFlux}
            min={0}
            max={2000}
            onChange={(n) => update("solarFlux", n)}
          />
        </div>
        {value.arrayMode === "fixed" && (
          <div className="field-grid">
            <NumberField
              label="Tilt from horizontal"
              unit="°"
              value={value.tiltDeg}
              min={0}
              max={180}
              onChange={(n) => update("tiltDeg", n)}
            />
            <NumberField
              label="Panel azimuth"
              unit="°"
              value={value.azimuthDeg}
              min={0}
              max={360}
              onChange={(n) => update("azimuthDeg", n)}
            />
          </div>
        )}
      </Section>
      <Section title="Load & storage">
        <div className="field-grid">
          <NumberField
            label="Continuous load"
            unit="W"
            value={value.loadW}
            min={0}
            max={1000000}
            onChange={(n) => update("loadW", n)}
          />
          <NumberField
            label="Usable capacity"
            unit="Wh"
            value={value.batteryWh}
            min={0}
            max={1e9}
            onChange={(n) => update("batteryWh", n)}
          />
          <NumberField
            label="Initial charge"
            unit="%"
            value={value.initialSoc * 100}
            min={0}
            max={100}
            onChange={(n) => update("initialSoc", n / 100)}
          />
          <NumberField
            label="Reserve threshold"
            unit="%"
            value={value.reserveSoc * 100}
            min={0}
            max={100}
            onChange={(n) => update("reserveSoc", n / 100)}
          />
          <NumberField
            label="Charge efficiency"
            unit="%"
            value={value.chargeEfficiency * 100}
            min={1}
            max={100}
            onChange={(n) => update("chargeEfficiency", n / 100)}
          />
          <NumberField
            label="Discharge efficiency"
            unit="%"
            value={value.dischargeEfficiency * 100}
            min={1}
            max={100}
            onChange={(n) => update("dischargeEfficiency", n / 100)}
          />
        </div>
        <div
          className={
            result.unmetWh && result.unmetWh > 0
              ? "constraint warning"
              : "constraint"
          }
        >
          {result.unmetWh == null
            ? "Energy result unknown: terrain coverage is incomplete."
            : result.unmetWh > 0
              ? `${number(result.unmetWh / 1000, 2)} kWh of demand cannot be supplied.`
              : "No unmet demand under these assumptions."}
        </div>
        <p className="muted">
          Below reserve for {number(result.reserveHours, 0)} h. Fixed continuous
          load; no thermal, heater cycling or eclipse-transient model.
        </p>
      </Section>
      <Section title="Earth link">
        <NumberField
          label="Minimum antenna elevation"
          unit="°"
          value={value.antennaMaskDeg}
          min={0}
          max={90}
          onChange={(n) => update("antennaMaskDeg", n)}
        />
        <p className="muted">
          Earth-centre visibility is a geometric screening result. It does not
          reserve a ground station or guarantee a radio link.
        </p>
        <details>
          <summary>Calculate a free-space link budget</summary>
          <p className="muted">
            Supply all inputs. User-entered station assumptions; actual station
            visibility and atmospheric losses are not solved.
          </p>
          <div className="field-grid">
            {(
              [
                ["frequencyGHz", "Frequency", "GHz"],
                ["rangeKm", "Range", "km"],
                ["txPowerW", "Transmit power", "W"],
                ["txGainDbi", "Tx gain", "dBi"],
                ["rxGainDbi", "Rx gain", "dBi"],
                ["lossDb", "Total other losses", "dB"],
                ["noiseTempK", "System noise", "K"],
                ["dataRateBps", "Data rate", "bit/s"],
                ["requiredEbN0Db", "Required Eb/N₀", "dB"],
              ] as const
            ).map(([key, label, unit]) => (
              <label className="number-field" key={key}>
                <span>
                  {label} ({unit})<Info label={label} />
                </span>
                <Input
                  type="number"
                  aria-label={`${label} (${unit})`}
                  step="any"
                  value={radio[key] ?? ""}
                  onChange={(e) =>
                    onRadioChange({
                      ...radio,
                      [key]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="constraint">
            {link ? <><span>Free-space loss <Info label="Free-space loss" /> {number(link.pathLossDb)} dB</span><br/><span>Link margin <Info label="Link margin" /> {number(link.marginDb)} dB</span></> : "Enter every valid link parameter to calculate a margin."}
          </div>
        </details>
      </Section>
    </>
  );
}

// These flight-only fields carry their own help; the shared glossary is separately owned.
function LandingNumberField({ label, unit, value, min, max, onChange, help }: {
  label: string; unit: string; value: number; min: number; max: number;
  onChange: (n: number) => void; help: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const valid = draft.trim() !== "" && Number.isFinite(Number(draft)) && Number(draft) >= min && Number(draft) <= max;
  return <div>
    <label className="number-field" htmlFor={id}>
      <span>{label}<Info label={label} extra={FLIGHT_CONTROL_LESSONS[label] ?? help} /></span>
      <div><Input id={id} type="number" step="any" value={draft} min={min} max={max}
        aria-label={`${label} (${unit})`} aria-invalid={!valid} aria-describedby={`${id}-help${valid ? "" : ` ${id}-error`}`}
        onChange={e => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number(raw);
          if (raw.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }} /><span>{unit}</span></div>
      {!valid && <small id={`${id}-error`}>Enter a value from {min} to {max} {unit}. Results retain the last valid input.</small>}
    </label>
    <details><summary>ⓘ {label} ({unit})</summary><p id={`${id}-help`}>{help}</p></details>
  </div>;
}

export function FlightPanel({
  value,
  onChange,
  result,
  onPlay,
  onPause,
  onReplay,
  onFollow,
  playing,
  preparing,
}: {
  value: FlightInputs;
  onChange: (a: FlightInputs) => void;
  result: FlightResult;
  onPlay?: () => void;
  onPause?: () => void;
  onReplay?: () => void;
  onFollow?: () => void;
  playing?: boolean;
  preparing?: boolean;
}) {
  const update = (k: keyof FlightInputs, n: number) =>
    onChange({ ...value, [k]: n });
  const landing = value.landing;
  const assisted = value.mode === "descent" && landing?.guidance === "target-landing";
  const contactFields = [
    ["targetRadiusM", "Target radius", "m", "The largest allowed surface distance from the selected target. Distance is a great-circle arc on the reference sphere, not a flat map distance."],
    ["maxVerticalMps", "Maximum vertical contact speed", "m/s", "The allowed magnitude of incoming radial speed. Negative vertical speed means descending; the signed value remains visible at contact."],
    ["maxHorizontalMps", "Maximum horizontal contact speed", "m/s", "The largest allowed incoming speed tangent to the reference sphere. Sideways speed is not removed at impact."],
    ["maxTiltDeg", "Maximum contact tilt", "°", "The largest allowed ideal vehicle tilt from radial vertical. Instantaneous attitude tracking is assumed; terrain slope and vehicle stability need separate assessment."],
    ["breakupEnergyJ", "Breakup energy threshold", "J", "The contact experiment breaks the vehicle at or above this incoming translational kinetic energy, including sideways motion. This is an editable demonstration threshold, not structural strength or absorbed energy."],
    ["friction", "Contact friction", "1", "A dimensionless Coulomb friction coefficient used by the contact continuation. It affects sliding after contact, not airborne steering."],
    ["restitution", "Contact restitution", "1", "A dimensionless bounce coefficient from zero to one used by the contact continuation. Zero is inelastic; one is ideal elastic rebound."],
    ["contactPreviewSeconds", "Contact continuation", "s", "How long the clock continues after numerical contact so the rigid-body experiment can show settling, sliding or breakup."],
  ] as const;
  const signed = (n: number | null | undefined, digits = 2) => n == null ? "Unknown" : `${n > 0 ? "+" : ""}${number(n, digits)}`;
  return (
    <>
      <FlightExperiments value={value} result={result} onChange={onChange} onPlay={onPlay} onPause={onPause} onReplay={onReplay} onFollow={onFollow} playing={playing} preparing={preparing} />
      <Section
        title="Lunar flight preview"
        detail="A generic vehicle with editable assumptions. This is a local ascent or terminal descent, not an operational flight solution."
      >
        <details className="flight-model-explanation"><summary>Selected flight solver, frame and equations</summary><FlightSolverDetails flight={result}/></details>
        <div className="segmented">
          {(["ascent", "descent"] as const).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              aria-pressed={value.mode === mode}
              onClick={() =>
                onChange(
                  mode === "ascent"
                    ? { ...DEFAULT_FLIGHT }
                    : createLandingFlight(value),
                )
              }
            >
              {mode === "ascent" ? "Ascent" : "Descent"}
            </Button>
          ))}
        </div>
        {value.mode === "descent" && <>
          <div className="segmented" aria-label="Descent guidance">
            {(["target-landing", "manual"] as const).map(guidance => <Button key={guidance} variant="ghost"
              aria-pressed={(landing?.guidance ?? "manual") === guidance}
              onClick={() => onChange({ ...value, landing: { ...(landing ?? DEFAULT_LANDING_CONFIGURATION), guidance } })}>
              {guidance === "target-landing" ? "Assisted target approach" : "Manual pitch & burn"}
            </Button>)}
          </div>
          <Button variant="outline" onClick={() => onChange(createLandingFlight(value, true))}>Reset 300 m approach</Button>
          <details><summary>ⓘ About guidance and start position</summary>
            <p>Assisted guidance steers toward the selected location and descends at up to 8 m/s, slowing near the numerical ground to a 0.5 m/s target sink rate. It assumes immediate attitude changes and continuously variable throttle. Your thrust, burn time, mass and propellant still limit the result.</p>
            <p>Manual guidance uses your heading and pitch schedule at full configured thrust. Start altitude (m) is height above the selected reference tangent plane; a crater floor can be below zero. East and north offsets (m) place the start relative to the selected target; negative means west or south. Heading (°) is clockwise from north, and vertical speed (m/s) is positive upward. This is an ideal generic preview, not Apollo guidance or a qualified flight solution.</p>
          </details>
          <div className="field-grid">
            <LandingNumberField label="Start east offset" unit="m" min={-MAX_LANDING_OFFSET_M} max={MAX_LANDING_OFFSET_M} value={value.eastOffsetM ?? 0} onChange={n => update("eastOffsetM", n)} help="Start position east of the selected target, in metres along the local tangent axis. Negative values start west of the target. This is a local offset, not a longitude or a surface arc." />
            <LandingNumberField label="Start north offset" unit="m" min={-MAX_LANDING_OFFSET_M} max={MAX_LANDING_OFFSET_M} value={value.northOffsetM ?? 0} onChange={n => update("northOffsetM", n)} help="Start position north of the selected target, in metres along the local tangent axis. Negative values start south of the target. Terrain callbacks and contact positions use these same east/north offsets." />
          </div>
        </>}
        <div className="field-grid">
          <NumberField
            label="Start altitude"
            help={FLIGHT_CONTROL_LESSONS["Start altitude"]}
            unit="m"
            value={value.altitudeM}
            min={0}
            max={1e6}
            onChange={(n) => update("altitudeM", n)}
          />
          <NumberField
            label="Horizontal speed"
            help={FLIGHT_CONTROL_LESSONS["Horizontal speed"]}
            unit="m/s"
            value={value.horizontalMps}
            min={0}
            max={5000}
            onChange={(n) => update("horizontalMps", n)}
          />
          <NumberField
            label="Vertical speed"
            help={FLIGHT_CONTROL_LESSONS["Vertical speed"]}
            unit="m/s"
            value={value.verticalMps}
            min={-5000}
            max={5000}
            onChange={(n) => update("verticalMps", n)}
          />
          <NumberField
            label="Heading, from north"
            help={FLIGHT_CONTROL_LESSONS["Heading, from north"]}
            unit="°"
            value={value.headingDeg}
            min={0}
            max={360}
            onChange={(n) => update("headingDeg", n)}
          />
          {!assisted && <><NumberField
            label="Initial pitch"
            help={FLIGHT_CONTROL_LESSONS["Initial pitch"]}
            unit="°"
            value={value.pitchDeg}
            min={-90}
            max={90}
            onChange={(n) => update("pitchDeg", n)}
          />
          <NumberField
            label="Final burn pitch"
            help={FLIGHT_CONTROL_LESSONS["Final burn pitch"]}
            unit="°"
            value={value.finalPitchDeg}
            min={-90}
            max={90}
            onChange={(n) => update("finalPitchDeg", n)}
          /></>}
        </div>
        {assisted && <p className="muted">Assisted guidance commands pitch and throttle within the entered thrust limit. Manual pitch settings are retained; select Manual pitch &amp; burn to use them.</p>}
      </Section>
      {landing && <Section title="Landing contact assumptions" detail="Entered preview limits, not NASA acceptance criteria. All must be met with known numerical terrain for the incoming contact to be within limits.">
        <details><summary>Edit contact limits & continuation</summary>
          <div className="field-grid">{contactFields.map(([key, label, unit, help]) =>
            <LandingNumberField key={key} label={label} unit={unit} value={landing[key]} min={LANDING_RANGES[key][0]} max={LANDING_RANGES[key][1]} help={help}
              onChange={n => onChange({ ...value, landing: { ...landing, [key]: n } })} />
          )}</div>
        </details>
        {result.landingOutcome && <div data-landing-contact-result className={`constraint landing-outcome ${result.landingOutcome.state}`}>
          <strong>{result.landingOutcome.state === "within-assumed-limits" ? "✓ Within entered contact limits" : result.landingOutcome.state === "outside-assumed-limits" ? "× Outside entered contact limits" : "? Contact unresolved"}</strong>
          <p>Incoming vertical {signed(result.landingOutcome.verticalMps)} m/s (limit ±{number(landing.maxVerticalMps)} m/s) · horizontal {number(result.landingOutcome.horizontalMps, 2)} m/s (limit {number(landing.maxHorizontalMps)} m/s).</p>
          <p>Ideal tilt {number(result.landingOutcome.tiltDeg, 2)}° (limit {number(landing.maxTiltDeg)}°) · surface target error {number(result.landingOutcome.targetErrorM, 2)} m (radius {number(landing.targetRadiusM)} m).</p>
          {result.contact && <p>Contact at {number(result.contact.timeS, 2)} s · incoming mass {number(result.contact.massKg, 2)} kg · numerical ground {signed(result.contact.terrainHeightM)} m relative to reference. Incoming kinetic energy {number(0.5 * result.contact.massKg * Math.hypot(...result.contact.velocityMps) ** 2, 0)} J; breakup threshold {number(landing.breakupEnergyJ, 0)} J.</p>}
          <ul>{result.landingOutcome.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        </div>}
      </Section>}
      <Section title="Vehicle & burn">
        <div className="field-grid">
          <NumberField
            label="Wet mass"
            help={FLIGHT_CONTROL_LESSONS["Wet mass"]}
            unit="kg"
            value={value.wetMassKg}
            min={value.dryMassKg}
            max={1e7}
            onChange={(n) => update("wetMassKg", n)}
          />
          <NumberField
            label="Dry mass"
            help={FLIGHT_CONTROL_LESSONS["Dry mass"]}
            unit="kg"
            value={value.dryMassKg}
            min={1}
            max={value.wetMassKg}
            onChange={(n) => update("dryMassKg", n)}
          />
          <NumberField
            label="Thrust"
            help={FLIGHT_CONTROL_LESSONS["Thrust"]}
            unit="N"
            value={value.thrustN}
            min={0}
            max={1e8}
            onChange={(n) => update("thrustN", n)}
          />
          <NumberField
            label="Specific impulse"
            help={FLIGHT_CONTROL_LESSONS["Specific impulse"]}
            unit="s"
            value={value.ispSeconds}
            min={1}
            max={5000}
            onChange={(n) => update("ispSeconds", n)}
          />
          <NumberField
            label="Burn duration"
            help={FLIGHT_CONTROL_LESSONS["Burn duration"]}
            unit="s"
            value={value.burnSeconds}
            min={0}
            max={7200}
            onChange={(n) => update("burnSeconds", n)}
          />
          <NumberField
            label="Preview duration"
            help={FLIGHT_CONTROL_LESSONS["Preview duration"]}
            unit="s"
            value={value.durationSeconds}
            min={1}
            max={7200}
            onChange={(n) => update("durationSeconds", n)}
          />
        </div>
        <p className="muted">
          {landing?.guidance === "target-landing"
            ? "Assisted guidance controls thrust direction and throttle; the two manual pitch values are retained for manual mode. Burn duration is the maximum powered time, not a compulsory full-thrust burn."
            : "Pitch is above the local horizontal. Positive is upwards. The full-thrust burn pitches linearly between your two values."}
        </p>
        <div className="flight-feasibility">
          <strong>Initial thrust / weight</strong>
          <span>{number(result.initialThrustToWeight, 2)}</span>
          <Info label="Initial thrust / weight" />
          <small>
            Above 1 is necessary for vertical liftoff from rest. Landing limits
            depend on the vehicle and guidance.
          </small>
        </div>
        <div className="constraint">
          {result.status}
          {result.fuelExhausted ? " · Propellant exhausted" : ""}
          <br />
          Ideal engine Δv <Info label="Ideal engine Δv" /> {number(result.deltaVMps, 0)} m/s · Maximum altitude <Info label="Maximum altitude" />{" "}
          {number(result.maxAltitudeM / 1000, 2)} km
        </div>
        <p className="muted">
          Surface contact is not a successful landing; inspect
          the contact speed. Terrain clearance is unknown outside prepared
          coverage.
        </p>
      </Section>
    </>
  );
}

export function TeachPanel({
  heightM,
  onHeight,
  custom,
  onDateShift,
  onSite,
}: {
  heightM: number;
  onHeight: (n: number) => void;
  custom: boolean;
  onDateShift: (hours: number) => void;
  onSite: (id: string) => void;
}) {
  const [lesson, setLesson] = useState(0),
    [prediction, setPrediction] = useState(""),
    [revealed, setRevealed] = useState(false),
    l = LESSONS[lesson];
  return (
    <Section
      title="Lunar field notes"
      detail="Predict, change one variable, then compare what happens."
    >
      <div className="lesson-list">
        {LESSONS.map((item, i) => (
          <Button
            variant="ghost"
            key={item.id}
            aria-pressed={lesson === i}
            onClick={() => {
              setLesson(i);
              setPrediction("");
              setRevealed(false);
            }}
          >
            {item.title}
          </Button>
        ))}
      </div>
      <h4>{l.question}</h4>
      <label className="number-field">
        <span>Your prediction</span>
        <textarea
          value={prediction}
          onChange={(e) => setPrediction(e.target.value)}
          placeholder="What do you expect to change?"
        />
      </label>
      {lesson === 0 && (
        <Button variant="outline" onClick={() => onSite("connecting-ridge")}>
          Explore Connecting Ridge
        </Button>
      )}
      {lesson === 1 && (
        <>
          <div className="segmented">
            {[0, 2, 10].map((n) => (
              <Button
                key={n}
                variant="ghost"
                disabled={custom}
                aria-pressed={heightM === n}
                onClick={() => onHeight(n)}
              >
                {n} m
              </Button>
            ))}
          </div>
          {custom && (
            <p className="muted">
              Choose a catalog site to compare observer heights.
            </p>
          )}
        </>
      )}
      {lesson === 2 && (
        <div className="button-row">
          <Button variant="outline" onClick={() => onDateShift(-168)}>
            One week earlier
          </Button>
          <Button variant="outline" onClick={() => onDateShift(168)}>
            One week later
          </Button>
        </div>
      )}
      <Button variant="secondary" onClick={() => setRevealed(true)}>
        Reveal the explanation
      </Button>
      {revealed && <p className="lesson-explanation">{l.explanation}</p>}
      <p className="muted">
        Discuss: does more sunlight also mean more contact with Earth?
      </p>
      <a
        href="https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/"
        target="_blank"
        rel="noreferrer"
        className="resource-link"
      >
        Explore Canada’s role in lunar missions <ExternalLink size={13} />
      </a>
      <p className="muted">
        CSA learning context: Artemis, Gateway and lunar robotics connect
        surface missions to a wider exploration programme.
      </p>
    </Section>
  );
}

export function ResourcesPanel({ catalog }: { catalog: Catalog }) {
  return (
    <>
      <Section
        title="Data, with a paper trail"
        detail="Every resource family linked in the challenge brief, with its actual role in this application."
      >
        {RESOURCES.map((r) => (
          <a
            key={r.id}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="resource-entry"
          >
            <div>
              <strong>{r.name}</strong>
              <ExternalLink size={14} />
            </div>
            <span>
              {r.role} · {r.kind}
            </span>
            <p>{r.detail}</p>
          </a>
        ))}
      </Section>
      <Section title="Resolution & coverage">
        <dl className="data-list">
          <dt>Time coverage</dt>
          <dd>2026–2027, hourly samples</dd>
          <dt>Frame</dt>
          <dd>{catalog.meta.frame}</dd>
          <dt>Catalog horizon</dt>
          <dd>Original south-pole catalog: 1° azimuth. Historic sites without prepared masks remain unknown.</dd>
          <dt>Custom horizon</dt>
          <dd>Nearest coarse grid cell, 2 m observer</dd>
          <dt>Bundled imagery</dt>
          <dd>LROC WAC regional imagery; NAC detail where available. Historical acquisition shadows, not selected-date illumination.</dd>
          <dt>Relief fallback</dt>
          <dd>600 m/pixel hillshade</dd>
          <dt>3D height sources</dt>
          <dd>5 m, 10 m, 40 m and 80 m LOLA products, with nested display sampling and limited coverage. Original horizon masks are unchanged.</dd>
          <dt>Terrain masks</dt>
          <dd>40 m / 240 m source DEMs</dd>
        </dl>
        <p className="muted">
          A horizon mask is not a terrain mesh. New 3D heights use separately
          prepared NASA numerical terrain. Coarse data cannot identify
          individual boulders or certify a landing ellipse.
        </p>
      </Section>
      <Section title="Verification">
        <dl className="data-list">
          <dt>Decoded ephemeris check</dt><dd>{decodedValidation.rows.reduce((sum,r)=>sum+r.count,0)} samples against freshly queried JPL Horizons, {decodedValidation.checkedUtc.slice(0,10)}.</dd>
          <dt>Maximum azimuth difference</dt><dd>{Math.max(...decodedValidation.rows.map(r=>r.maxAzDeg)).toFixed(5)}°</dd>
          <dt>Maximum elevation difference</dt><dd>{Math.max(...decodedValidation.rows.map(r=>r.maxElDeg)).toFixed(5)}°</dd>
        </dl>
        <p className="muted">This checks decoded Sun/Earth geometry, including catalog quantization. It does not validate terrain shadows against photographs, landing hazards, flight guidance or ground-station availability.</p>
        <p className="muted">
          The archive reports {catalog.meta.validation.samples} Horizons checks
          before catalogue quantization. That historical result is distinct from
          a fresh verification of decoded browser samples. Source generation:{" "}
          {catalog.meta.generatedUtc}.
        </p>
        <a
          href="https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/"
          className="resource-link"
          target="_blank"
          rel="noreferrer"
        >
          Read the challenge brief <ExternalLink size={13} />
        </a>
      </Section>
    </>
  );
}

export function AnalysisPanel({
  catalog,
  series,
  terrain,
  summary,
  antennaMaskDeg=0,
  observerHeightM=2,
  cursor,
  onCursor,
}: {
  catalog: Catalog;
  series: SampleSeries;
  terrain: TerrainChoice;
  summary: Summary;
  antennaMaskDeg?: number;
  observerHeightM?: number;
  cursor: number;
  onCursor: (n: number) => void;
}) {
  const [table, setTable] = useState(false);
  const slot = Math.max(
    0,
    Math.min(series.sunEl.length - 1, Math.floor(cursor)),
  );
  return (
    <>
      <Section title="">
        <div className="science-canvas">
          <HorizonGraph series={series} cursor={cursor} terrain={terrain} />
        </div>
        <p className="muted">
          The terrain horizon comes from the original LOLA ray march. Its
          resolution and coverage are independent of the 3D surface mesh.
        </p>
        <dl className="data-list">
          <dt>Sun azimuth / elevation</dt>
          <dd>
            {number(series.sunAz[slot])}° / {number(series.sunEl[slot], 2)}°
          </dd>
          <dt>Sun terrain horizon</dt>
          <dd>{number(series.sunHorizon[slot], 2)}°</dd>
          <dt>Earth azimuth / elevation</dt>
          <dd>
            {number(series.earthAz[slot])}° / {number(series.earthEl[slot], 2)}°
          </dd>
          <dt>Earth terrain horizon</dt>
          <dd>{number(series.earthHorizon[slot], 2)}°</dd>
        </dl>
      </Section>
      <Section title="Elevation through the stay">
        <div className="science-canvas">
          <ElevationGraph
            catalog={catalog}
            series={series}
            cursor={cursor}
            onCursor={onCursor}
          />
        </div>
        <Button
          variant="ghost"
          aria-expanded={table}
          onClick={() => setTable(!table)}
        >
          {table ? "Hide" : "Show"} numerical samples
        </Button>
        {table && (
          <div className="table-scroll">
            <table>
              <caption>
                Up to 48 samples around the current time. Export CSV for the
                full interval.
              </caption>
              <thead>
                <tr>
                  <th>UTC</th>
                  <th>Sun °</th>
                  <th>Earth °</th>
                  <th>Sun horizon °</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.min(48, series.sunEl.length) },
                  (_, k) =>
                    Math.max(0, Math.min(series.sunEl.length - 48, slot - 24)) +
                    k,
                ).map((k) => (
                  <tr key={k}>
                    <td>{formatUtc(indexToMs(catalog, series.index0 + k))}</td>
                    <td>{number(series.sunEl[k], 2)}</td>
                    <td>{number(series.earthEl[k], 2)}</td>
                    <td>{number(series.sunHorizon[k], 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section
        title="Earth contact windows"
        detail={`Earth-centre clearance above both terrain and the ${antennaMaskDeg}° minimum antenna elevation, at the ${observerHeightM} m display height. The plots retain the raw terrain horizon; negative horizons do not disable a 0° antenna cutoff. Different mission antenna heights are assessed separately. Hourly boundaries are uncertain by one sample; this is not a booked radio link.`}
      >
        {summary.earthWindows.length === 0 ? (
          <p>No visible-Earth interval in this stay.</p>
        ) : (
          summary.earthWindows.slice(0, 12).map((w, i) => (
            <div className="window-row" key={i}>
              <span>{formatUtc(indexToMs(catalog, w.startIndex))}</span>
              <strong>{number(w.hours, 0)} h</strong>
            </div>
          ))
        )}
        {summary.earthWindows.length > 12 && (
          <p className="muted">More windows are available in the full CSV.</p>
        )}
      </Section>
    </>
  );
}

export type SavedScenario = { id: string; name: string; state: ScenarioState };
type Column =
  | "sun"
  | "earth"
  | "dark"
  | "blackout"
  | "energy"
  | "battery"
  | "unmet"
  | "slope"
  | "height"
  | "overlap"
  | "lat"
  | "lon"
  | "margin"
  | "outcome"
  | "firstFailure"
  | "requiredUnknown"
  | "dataset"
  | "model"
  | "reserveMargin"
  | "coverage";
type CustomColumn = {
  id: string;
  name: string;
  unit: string;
  values: Record<string, string>;
};
const PREFS = "solarreach-comparison-view-v1";
function readPrefs(): {
  columns?: Column[];
  custom?: CustomColumn[];
  reference?: string;
  error?: string;
} {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return {
      columns: Array.isArray(p.columns)
        ? p.columns.filter(
            (c: unknown) => typeof c === "string" && Object.hasOwn(COLUMNS, c),
          )
        : undefined,
      custom: Array.isArray(p.custom)
        ? p.custom.filter(
            (c: CustomColumn) =>
              c &&
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              typeof c.unit === "string" &&
              c.values &&
              typeof c.values === "object",
          )
        : undefined,
      reference: typeof p.reference === "string" ? p.reference : undefined,
    };
  } catch {
    return {error:"Saved comparison preferences could not be read. Default columns are shown."};
  }
}
const COLUMNS: Record<Column, string> = {
  sun: "Sunlight %",
  earth: "Antenna contact %",
  dark: "Longest dark h",
  blackout: "Blackout h",
  energy: "Energy kWh",
  battery: "Min charge Wh",
  unmet: "Unmet load Wh",
  slope: "Slope °",
  height: "Height m",
  overlap: "Sun + Earth h",
  lat: "Latitude °",
  lon: "Longitude °E",
  margin: "Link margin dB",
  outcome: "Assessment outcome",
  firstFailure: "First known failure UTC",
  requiredUnknown: "Required unknowns",
  dataset: "Dataset version",
  model: "Model version",
  reserveMargin: "Reserve margin Wh",
  coverage: "Known solar coverage %",
};
const defaultComparisonManifest = parseEvidenceManifest(bundledComparisonEvidence);
export function Comparison({
  catalog,
  items,
  onAdd,
  onRemove,
  onOpen,
  manifest = defaultComparisonManifest,
  initialReferenceId,
}: {
  catalog: Catalog;
  manifest?: EvidenceManifest | null;
  initialReferenceId?:string;
  items: SavedScenario[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onOpen: (s: ScenarioState) => void;
}) {
  const audience=useContext(AudienceContext);
  const [prefs] = useState(readPrefs);
  const [reference, setReference] = useState(initialReferenceId??prefs.reference ?? ""),
    [prefError, setPrefError] = useState(prefs.error ?? "");
  const referenceId = items.some((v) => v.id === reference)
    ? reference
    : items[0]?.id;
  const [columns, setColumns] = useState<Column[]>(
      prefs.columns ?? ["outcome", "requiredUnknown", "sun", "earth", "energy", "battery"],
    ),
    [sort, setSort] = useState<Column | null>(null),
    [ascending, setAscending] = useState(false),
    [configure, setConfigure] = useState(false),
    [threshold, setThreshold] = useState(70),
    [customLabel, setCustomLabel] = useState(""),
    [customUnit, setCustomUnit] = useState(""),
    [customColumns, setCustomColumns] = useState<CustomColumn[]>(
      prefs.custom ?? [],
    );
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS,
        JSON.stringify({ columns, custom: customColumns, reference }),
      );
    } catch {
      setPrefError(
        "View preferences could not be saved on this device. Export the comparison to preserve custom values.",
      );
    }
  }, [columns, customColumns, reference]);
  const rows = useMemo(() => items.map(item => {
    const s = item.state, site = catalog.sites.find(v => v.id === s.siteId), p = s.custom ?? site;
    let assessment: ReturnType<typeof evaluateScenario> | null = null, error: string | null = null;
    try {
      if (!manifest) throw new Error("Prepared evidence is unavailable; this scenario has not been assessed.");
      assessment = evaluateScenario(catalog, s, manifest);
    } catch (cause) { error = cause instanceof Error ? cause.message : "Scenario assessment unavailable."; }
    const m = assessment?.mission, sphere = assessment?.sphereMission;
    const sunlight = (mission: typeof m) => mission?.timeline.length && mission.timeline.every(t => t.sun !== null)
      ? mission.timeline.filter(t => t.sun === true).length / mission.timeline.length * 100 : null;
    let dark = 0, longestDark = 0;
    for (const point of m?.timeline ?? []) { dark = point.sun === false ? dark + catalog.meta.stepHours : 0; longestDark = Math.max(longestDark, dark); }
    const values: Record<Column, number | string | null> = {
      sun: sunlight(m), earth: m?.contactFraction == null ? null : m.contactFraction * 100,
      dark: m?.timeline.length && m.timeline.every(t => t.sun !== null) ? longestDark : null,
      blackout: m?.longestBlackoutHours ?? null, energy: m?.generatedWh == null ? null : m.generatedWh / 1000,
      battery: m?.minBatteryWh ?? null, unmet: m?.unmetWh ?? null,
      slope: s.custom ? null : site?.slopeDeg ?? null, height: s.custom ? null : site?.demHeightM ?? null,
      overlap: m?.overlapHours ?? null, lat: p?.lat ?? null, lon: p?.lon ?? null,
      margin: linkBudget(s.radio ?? {})?.marginDb ?? null,
      reserveMargin: assessment?.constraints.find(c => c.id === "reserve")?.margin ?? null,
      coverage: m ? m.knownFraction * 100 : null,
      outcome: assessment?.outcome ?? null,
      firstFailure: assessment?.firstFailure?.earliestUtc ?? null,
      requiredUnknown: assessment ? assessment.constraints.filter(c => c.required && c.state === "not-assessed").length : null,
      dataset: assessment?.datasetId ?? null, model: assessment?.modelVersion ?? null,
    };
    for (const key of Object.keys(values) as Column[]) if (typeof values[key] === "number" && !Number.isFinite(values[key])) values[key] = null;
    return { item, assessment, error, values, sphere, sphereSun: sunlight(sphere) };
  }), [items, catalog, manifest]);
  const referenceRow = rows.find(v => v.item.id === referenceId);
  const ordered = [...rows].sort((a, b) => {
    if (!sort) {
      const rank: Record<string, number> = { "passes-assessed": 0, conditional: 1, incomplete: 2, "fails-assessed": 3, "not-configured": 4 };
      return (rank[a.assessment?.outcome ?? ""] ?? 5) - (rank[b.assessment?.outcome ?? ""] ?? 5);
    }
    const av = a.values[sort], bv = b.values[sort];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * (ascending ? 1 : -1);
  });
  const outcomeLabel = (outcome: string) => ({
    "passes-assessed": "Passes the assessed requirements under these assumptions.",
    "fails-assessed": "Fails assessed requirements", incomplete: "Incomplete required evidence",
    conditional: "Conditional", "not-configured": "Requirements not configured",
  }[outcome] ?? outcome);
  const differencesFor = (state: ScenarioState) => referenceRow ? diffScenarios(referenceRow.item.state, state) : [];
  const comparisonLabel = (state: ScenarioState) => {
    const kind = classifyScenarioDiff(differencesFor(state));
    return ({ identical: "Identical inputs", "site-only": "Site-only comparison", "date-only": "Date-only comparison", assumptions: "Free-input comparison", mixed: "Mixed-input comparison" } as const)[kind];
  };
  function exportRows() {
    const header = [
      "Scenario",
      "UTC start",
      "UTC end",
      ...columns.map((c) => COLUMNS[c]),
      ...customColumns.map((c) => `${c.name} (${c.unit}, user entered)`),
      "Assumptions JSON",
      "Terrain source",
      "Comparison type",
      "Changed assumptions JSON",
      "Assessment JSON",
    ];
    const quote = csvCell;
    const body = ordered.map((r) =>
      [
        r.item.name,
        formatUtc(indexToMs(catalog, r.item.state.startIndex)),
        formatUtc(indexToMs(catalog, r.item.state.endIndex + 1)),
        ...columns.map((c) => r.values[c]),
        ...customColumns.map((c) => c.values[r.item.id] ?? ""),
        JSON.stringify(r.item.state),
        catalog.meta.demCitation,
        comparisonLabel(r.item.state),
        JSON.stringify(differencesFor(r.item.state)),
        JSON.stringify(r.assessment ?? { error: r.error }),
      ]
        .map(quote)
        .join(","),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + [header.map(quote).join(","), ...body].join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    a.download = "solarreach-comparison.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="comparison-content">
      <div className="comparison-actions">
        <div>
          <h2>Compare mission scenarios</h2>
          <p>Each row assesses its own site, dates, subsystem heights, hardware and operating schedule. User-entered numeric annotations never change the assessment or certify a site.</p>
        </div>
        <div className="button-row">
          <Button variant="outline" onClick={onAdd}>
            <Plus />
            Save current scenario
          </Button>
          <Button
            variant="outline"
            aria-expanded={configure}
            onClick={() => setConfigure(!configure)}
          >
            Choose columns
          </Button>
          <Button onClick={exportRows} disabled={!rows.length}>
            Export comparison
          </Button>
        </div>
      </div>
      {rows.length > 0 && <ResourceEvidenceComparison catalog={catalog} cases={ordered.map(({ item, assessment }) => ({
        id: item.id, name: item.name, state: item.state, assessment,
      }))} />}
      {configure && (
        <div className="column-config">
          <div className="column-choices">
            {(Object.keys(COLUMNS) as Column[]).map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={columns.includes(c)}
                  onChange={() =>
                    setColumns(
                      columns.includes(c)
                        ? columns.filter((v) => v !== c)
                        : [...columns, c],
                    )
                  }
                />
                {COLUMNS[c]}
              </label>
            ))}
          </div>
          <div className="column-order">
            {columns.map((c, i) => (
              <div key={c}>
                {COLUMNS[c]}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${COLUMNS[c]} left`}
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...columns];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    setColumns(a);
                  }}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${COLUMNS[c]} right`}
                  disabled={i === columns.length - 1}
                  onClick={() => {
                    const a = [...columns];
                    [a[i + 1], a[i]] = [a[i], a[i + 1]];
                    setColumns(a);
                  }}
                >
                  <ArrowDown />
                </Button>
              </div>
            ))}
          </div>
          <div className="button-row">
            <Input
              aria-label="Custom metric name"
              placeholder="Numeric metric name"
              maxLength={80}
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
            />
            <Input
              aria-label="Custom metric unit"
              placeholder="Unit"
              maxLength={30}
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!customLabel.trim()}
              onClick={() => {
                setCustomColumns([
                  ...customColumns,
                  {
                    id: crypto.randomUUID(),
                    name: customLabel.trim(),
                    unit: customUnit.trim(),
                    values: {},
                  },
                ]);
                setCustomLabel("");
                setCustomUnit("");
              }}
            >
              Add user metric
            </Button>
          </div>
        </div>
      )}
      {audience==='public'&&<div className="comparison-guidance"><h3>Choose a plan, then understand what changes</h3><p>A scenario is one place, one arrival date and one set of equipment. Choose a reference plan, then compare another date or site with the same equipment. A high sunlight percentage alone does not tell you whether the battery lasts through the longest dark gap.</p><p>Open <strong>Why this result?</strong> beside a plan to see what prevents it from meeting your checks and what to try next. “Missing information” means we cannot answer yet; it does not mean a safe landing.</p></div>}
      <EngineeringComparison rows={rows.map(r=>({id:r.item.id,name:r.item.name,state:r.item.state,assessment:r.assessment}))} referenceId={referenceId}/>
      <div className="compare-threshold">
        <NumberField
          label="Highlight sunlight below"
          unit="%"
          value={threshold}
          min={0}
          max={100}
          onChange={setThreshold}
        />
        <span>
          Choose a reference to see metric differences (Δ). Parentheses show the
          smooth-sphere result for sunlight, Earth view and energy. Default order groups assessment outcomes; clicking a metric sorts that column, with unknown values last.
        </span>
      </div>
      <label className="reference-select">
        Reference scenario{" "}
        <select
          aria-label="Reference scenario"
          value={referenceId ?? ""}
          onChange={(e) => setReference(e.target.value)}
        >
          {items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      {prefError && <p className="muted">{prefError}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Scenario / location / dates</th>
              {columns.map((c) => (
                <th key={c}>
                  <button
                    onClick={() => {
                      setAscending(sort === c ? !ascending : false);
                      setSort(c);
                    }}
                  >
                    {COLUMNS[c]} {sort === c ? (ascending ? "↑" : "↓") : ""}
                  </button>
                  <Info label={COLUMNS[c]} />
                </th>
              ))}
              {customColumns.map((c) => (
                <th key={c.id}>
                  {c.name} ({c.unit || "no unit"})<small>User entered</small>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${c.name}`}
                    onClick={() =>
                      setCustomColumns(
                        customColumns.filter((v) => v.id !== c.id),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => (
              <tr key={r.item.id}>
                <td>
                  <button
                    className="scenario-open"
                    onClick={() => onOpen(r.item.state)}
                  >
                    {r.item.name}
                  </button>
                  {r.item.id === referenceId && (
                    <span className="reference-tag">Reference</span>
                  )}
                  <small>
                    {formatUtc(indexToMs(catalog, r.item.state.startIndex))} ·{" "}
                    {(r.item.state.endIndex - r.item.state.startIndex + 1) * catalog.meta.stepHours} h
                  </small>
                  <small>{comparisonLabel(r.item.state)}</small>
                  <details>
                    <summary>Why this result? What can I change?</summary>
                    {r.error ? <p role="alert">{r.error}</p> : r.assessment && <AssessmentExplanation assessment={r.assessment}/>}
                    <details><summary>What changed from the reference?</summary>
                    {differencesFor(r.item.state).length ? <ul>{differencesFor(r.item.state).map(change => <li key={change.path}>{change.path==='startIndex'?'Arrival date':change.path==='endIndex'?'Last stay sample':change.path}: {change.path==='startIndex'||change.path==='endIndex'?`${formatUtc(indexToMs(catalog,change.before as number))} → ${formatUtc(indexToMs(catalog,change.after as number))}`:`${JSON.stringify(change.before) ?? "unset"} → ${JSON.stringify(change.after) ?? "unset"}`}</li>)}</ul> : <p>No changed assumptions relative to the reference.</p>}
                    </details>
                  </details>
                </td>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={
                      c === "sun" &&
                      typeof r.values.sun === "number" &&
                      r.values.sun < threshold
                        ? "threshold-fail"
                        : ""
                    }
                  >
                    {typeof r.values[c] === "number" ? number(r.values[c] as number, c === "lat" || c === "lon" ? 3 : 1) : c === "firstFailure" && r.values[c] ? formatUtc(Date.parse(r.values[c] as string)) : c === "outcome" && typeof r.values[c] === "string" ? outcomeLabel(r.values[c]) : r.values[c] ?? "—"}
                    {referenceRow && r.item.id !== referenceId && typeof r.values[c] === "number" && typeof referenceRow.values[c] === "number" && (
                      <small>Δ {(r.values[c] as number) - (referenceRow.values[c] as number) >= 0 ? "+" : ""}{number((r.values[c] as number) - (referenceRow.values[c] as number), 1)}</small>
                    )}
                    {c === "sun" && <small>({number(r.sphereSun)}%)</small>}
                    {c === "earth" && (
                      <small>
                        (
                        {number(
                          r.sphere?.contactFraction == null
                            ? null
                            : r.sphere?.contactFraction * 100,
                        )}
                        %)
                      </small>
                    )}
                    {c === "energy" && (
                      <small>
                        (
                        {number(
                          r.sphere?.generatedWh == null
                            ? null
                            : r.sphere?.generatedWh / 1000,
                        )}{" "}
                        kWh)
                      </small>
                    )}
                  </td>
                ))}
                {customColumns.map((c) => (
                  <td key={c.id}>
                    <Input
                      type="number"
                      step="any"
                      aria-label={`${c.name} for ${r.item.name}`}
                      value={c.values[r.item.id] ?? ""}
                      onChange={(e) =>
                        setCustomColumns(
                          customColumns.map((v) =>
                            v.id === c.id
                              ? {
                                  ...v,
                                  values: {
                                    ...v.values,
                                    [r.item.id]: e.target.value,
                                  },
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${r.item.name}`}
                    onClick={() => onRemove(r.item.id)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <p>Save a site and date to start comparing.</p>
          <Button onClick={onAdd}>Save current scenario</Button>
        </div>
      )}
    </div>
  );
}

export function DateSearch({
  catalog,
  lat,
  lon,
  terrain,
  onOpen,
}: {
  catalog: Catalog;
  lat: number;
  lon: number;
  terrain: TerrainChoice;
  onOpen: (a: number, b: number) => void;
}) {
  const [days, setDays] = useState(14),
    [minEarth, setMinEarth] = useState(40);
  const guard = useMemo(() => geometricSearchGuard(), []);
  const startIndex = 0, endIndex = catalog.meta.n - 1;
  const terrainMaskId = JSON.stringify([catalog.meta, terrain.cellLat,
    terrain.cellLon === null ? null : normalizedSearchLongitude(terrain.cellLon),
    terrain.heightM, terrain.stepDeg, terrain.exact, terrain.distanceKm,
    Array.from(terrain.mask, value => Number.isFinite(value) ? value : String(value))]);
  const key = geometricSearchKey({ lat, lon, heightM: terrain.heightM, terrainMaskId,
    startIndex, endIndex, days, minEarth });
  guard.update(key);
  const [completed, setCompleted] = useState<{
    key: string; results: ReturnType<typeof rankWindows>;
    lat: number; lon: number; heightM: number; days: number; minEarth: number;
    dataVersion: string; firstUtc: string; lastUtc: string;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const results = completed?.key === key ? completed.results : null;
  const busy = pendingKey === key;
  useEffect(() => {
    setCompleted(null);
    setPendingKey(null);
    return () => guard.cancel();
  }, [key, guard]);
  return (
    <Section
      title="Geometric sunlight windows"
      detail="Hourly terrain and smooth-sphere geometry only. Does not assess battery, electrical load or masked contact."
    >
      <div className="field-grid">
        <NumberField
          label="Stay length"
          unit="days"
          value={days}
          min={1}
          max={365}
          onChange={setDays}
        />
        <NumberField
          label="Minimum Earth visibility"
          unit="%"
          value={minEarth}
          min={0}
          max={100}
          onChange={setMinEarth}
        />
      </div>
      <Button
        disabled={busy}
        onClick={() => {
          const token = guard.begin();
          const metadata = { key, lat, lon: normalizedSearchLongitude(lon),
            heightM: terrain.heightM, days, minEarth,
            dataVersion: catalog.meta.generatedUtc,
            firstUtc: formatUtc(indexToMs(catalog, startIndex)),
            lastUtc: formatUtc(indexToMs(catalog, endIndex)) };
          setPendingKey(key);
          setTimeout(() => {
            if (!guard.accepts(token)) return;
            const found = rankWindows(catalog, lat, lon, terrain, startIndex,
              endIndex, Math.round(days * 24), minEarth / 100);
            if (!guard.accepts(token)) return;
            setCompleted({ ...metadata, results: found });
            setPendingKey(null);
          }, 0);
        }}
      >
        {busy ? "Searching…" : "Search geometric windows"}
      </Button>
      {results && completed && (
        <>
          <p className="muted">Captured location {completed.lat}°, {completed.lon}° · observer {completed.heightM} m · {completed.days} days · minimum Earth view {completed.minEarth}%. Search samples {completed.firstUtc}–{completed.lastUtc}. Dataset {completed.dataVersion}.</p>
          {results.unknownWindows>0&&<p className="constraint warning">{results.unknownWindows} candidate windows were excluded because their terrain horizon coverage is incomplete.</p>}
          <p className="muted">
            Ranked by terrain sunlight; Earth visibility is the unmasked
            Earth-centre test.
          </p>
          {results.withEarth.length === 0 ? (
            <p>No fully known window meets this Earth-view threshold.</p>
          ) : (
            results.withEarth.map((r, i) => (
              <button
                key={i}
                className="date-result"
                onClick={() => onOpen(r.startIndex, r.endIndex)}
              >
                <span>{formatUtc(indexToMs(catalog, r.startIndex))}</span>
                <strong>
                  {formatPercent(r.sunlitTerrain)} sunlit <Check size={13} />
                </strong>
                <small>
                  Smooth sphere {formatPercent(r.sunlitSphere)} · Earth{" "}
                  {formatPercent(r.earthTerrain)}
                </small>
              </button>
            ))
          )}
        </>
      )}
    </Section>
  );
}
