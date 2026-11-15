"use client";

import { useEffect } from "react";
import { updateLunarioStartup } from "./lunario-loader-runtime";

export type LunarioStartupProps = { ready: boolean; onComplete?: () => void };

/** Render alongside every Navigator branch; errors are terminal readiness too. */
export function LunarioStartup({ ready, onComplete }: LunarioStartupProps) {
  useEffect(() => {
    const completion = updateLunarioStartup(document, ready);
    let active = true;
    if (ready && onComplete) void Promise.resolve(completion).then(() => { if (active) onComplete(); });
    // The original body overlay belongs to the document, not this React mount.
    // Its hide() API completes animation, unlocks scrolling and removes its DOM.
    return () => { active = false; };
  }, [ready, onComplete]);
  return null;
}
