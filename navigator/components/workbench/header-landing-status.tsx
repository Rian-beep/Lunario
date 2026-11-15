"use client";

import { Button } from "../ui/button";
import type { LandingContact, LandingDynamicsReadout, LandingOutcome } from "../../lib/landing-contract";

export type LandingReadout = { key: object; value: LandingDynamicsReadout };

/** Reject callbacks for a prior scenario or scrub position; never reuse impact speed as live telemetry. */
export function currentLandingDynamics(readout: LandingReadout | null, key: object,
  contact: LandingContact | undefined, flightTime: number, playbackSpeed = 0): LandingDynamicsReadout | null {
  if (!contact || flightTime < contact.timeS || readout?.key !== key) return null;
  const value = readout.value;
  if (![flightTime, contact.timeS, value.elapsedContactS, value.speedMps, value.yM].every(Number.isFinite) ||
    value.elapsedContactS < 0 || value.speedMps < 0 ||
    // The renderer publishes at 10 Hz of wall time. At accelerated playback the
    // sample age grows in simulation seconds; paused/scrubbed views stay strict.
    Math.abs(value.elapsedContactS - (flightTime - contact.timeS)) >= 0.3 + Math.max(0, playbackSpeed) * .12) return null;
  return value;
}

export function HeaderLandingStatus({ outcome, assisted, contactActive, dynamics, onReset }: {
  outcome?: LandingOutcome; assisted: boolean; contactActive: boolean;
  dynamics: LandingDynamicsReadout | null; onReset: () => void;
}) {
  return <div className="landing-preview-context">
    <Button variant="outline" onClick={onReset}>Reset landing preset</Button>
    <p>{assisted ? "Ideal assisted terminal example. Edit the vehicle and contact assumptions below; this is not reconstructed Apollo guidance."
      : "Manual flight inputs are active. Reset landing preset to try the assisted terminal example at this location."}</p>
    {outcome && <p className={`landing-outcome ${outcome.state}`}>
      <strong>{outcome.state === 'within-assumed-limits' ? '✓ Within entered contact limits'
        : outcome.state === 'outside-assumed-limits' ? '× Outside entered contact limits' : '? Contact evidence unresolved'}</strong><br/>
      {outcome.reasons.join(' ')}
    </p>}
    <details><summary>Landing preview path colours</summary><p>Green: known numerical terrain and entered contact limits met. Red: entered limits exceeded or no landing in this preview. Amber: missing or unsupported evidence. These states do not qualify a landing site or mission.</p></details>
    {contactActive && <p role="status">{dynamics ? `${dynamics.phase}: ${dynamics.note}`
      : 'Contact dynamics readout pending; incoming impact speed is not current vehicle speed.'}</p>}
  </div>;
}
