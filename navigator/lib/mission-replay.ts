import type { MissionTrajectory, Vector3 } from './mission-trajectories';

/** Display support only; inertial states need a qualified time-dependent transform. */
export function missionReplayFrameError(data: MissionTrajectory): string | null {
  if (data.frame.name === 'IAU_MOON' && data.frame.type === 'body-fixed') return null;
  return `Replay unavailable for ${data.frame.name} (${data.frame.type}). This display supports Moon-fixed IAU_MOON positions only; no inertial-to-Moon-fixed conversion is implemented. Choose another published path or the educational simulation.`;
}

/** Source coordinates in km. Single observations survive as points, never invented line segments. */
export function missionReplayPath(data: MissionTrajectory): { lines: Vector3[][]; points: Vector3[]; gapCount: number } {
  const lines: Vector3[][] = [], points: Vector3[] = [];
  let segment: Vector3[] = [], gapCount = 0;
  const flush = () => {
    if (segment.length > 1) lines.push(segment);
    else if (segment.length === 1) points.push(segment[0]);
    segment = [];
  };
  data.samples.forEach((sample, index) => {
    if (index && sample.t - data.samples[index - 1].t > data.coverage.maxGapSeconds) {
      gapCount++;
      flush();
    }
    const point: Vector3 = [...sample.position];
    if (data.coverage.interpolation === 'none') points.push(point);
    else segment.push(point);
  });
  flush();
  return { lines, points, gapCount };
}

/** Apply the final pose once even if a frame lands at/past the duration, then release user controls. */
export function missionReplayCameraEase(elapsedMs: number, reducedMotion: boolean): number {
  const p = reducedMotion ? 1 : Math.max(0, Math.min(1, elapsedMs / 3000));
  return p * p * p * (p * (p * 6 - 15) + 10);
}

/** UTC is the supplied start label only. Elapsed source seconds are not a UTC conversion. */
export function missionReplayTimeLabels(data: MissionTrajectory): { start: string; elapsed: string } {
  return {
    start: `Starts ${data.epoch.utc} UTC · source epoch ${data.epoch.calendar} ${data.epoch.scale} · independent historical clock · 1× real time`,
    elapsed: `Elapsed source time (${data.epoch.scale} seconds)`,
  };
}
