import type { ChartPoint } from "./charts";

export type GradientAxis = "time-ms" | "seconds" | "azimuth";
export type GradientIndex = {
  points: readonly ChartPoint[];
  byX: readonly number[];
};

/** Index a copy of source positions; adjacency always means original series order. */
export function indexGradient(points: readonly ChartPoint[]): GradientIndex {
  const byX = points.flatMap((p, i) => (Number.isFinite(p.x) ? [i] : []));
  if (byX.some((i, j) => j > 0 && points[i].x < points[byX[j - 1]].x))
    byX.sort((a, b) => points[a].x - points[b].x || a - b);
  return { points, byX };
}

export function gradientUnits(axis: GradientAxis, yUnit: string) {
  const xUnit = axis === "time-ms" ? "h" : axis === "seconds" ? "s" : "°";
  return {
    xUnit,
    xScale: axis === "time-ms" ? 3600000 : 1,
    slopeUnit:
      yUnit === "m/s" && xUnit === "s" ? "m/s²" : `${yUnit}/${xUnit}`,
  };
}

function lowerBound(index: GradientIndex, target: number) {
  let lo = 0,
    hi = index.byX.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (index.points[index.byX[mid]].x < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type SampleGradient =
  | { available: false; reason: string }
  | {
      available: true;
      from: ChartPoint;
      to: ChartPoint;
      deltaY: number;
      deltaX: number;
      distance: number;
      slope: number;
      stepped: boolean;
      atJump: boolean;
    };

/** Two adjacent known samples only; never infer a continuous derivative. */
export function sampleGradient(
  index: GradientIndex,
  target: number,
  axis: GradientAxis,
  stepped = false,
): SampleGradient {
  const unavailable = (reason: string): SampleGradient => ({
    available: false,
    reason,
  });
  const { points, byX } = index;
  if (!Number.isFinite(target) || byX.length < 2)
    return unavailable("Two adjacent known samples are needed.");
  const first = points[byX[0]],
    last = points[byX[byX.length - 1]];
  if (target < first.x || target > (stepped ? last.endX ?? last.x : last.x))
    return unavailable("Outside the sampled source bounds; no extrapolation.");
  const insertion = lowerBound(index, target);
  const right = byX[Math.min(insertion, byX.length - 1)];
  const left = byX[Math.max(0, insertion - 1)];
  let anchor =
    Math.abs(points[left].x - target) <= Math.abs(points[right].x - target)
      ? left
      : right;
  const intervalEnd = points[left].endX;
  if (
    stepped && intervalEnd != null &&
    target >= points[left].x && target < intervalEnd
  )
    anchor = left;
  const p = points[anchor];
  if (!Number.isFinite(p.y))
    return unavailable("The selected source sample is unknown.");
  if (points[anchor - 1]?.x === p.x || points[anchor + 1]?.x === p.x)
    return unavailable(
      "Duplicate horizontal coordinates: change per horizontal unit is undefined.",
    );
  // Prefer the source neighbour in the cursor's direction; exact samples use the next pair.
  const next = points[anchor + 1],
    previous = points[anchor - 1];
  let neighbour = next ? anchor + 1 : anchor - 1;
  if (
    target !== p.x && previous &&
    target >= Math.min(previous.x, p.x) &&
    target <= Math.max(previous.x, p.x)
  )
    neighbour = anchor - 1;
  const a = points[Math.min(anchor, neighbour)],
    b = points[Math.max(anchor, neighbour)];
  if (!a || !b || ![a.x, a.y, b.x, b.y].every(Number.isFinite))
    return unavailable("An adjacent sample is unknown; gaps are not bridged.");
  const dx = b.x - a.x;
  if (
    dx === 0 ||
    points[Math.min(anchor, neighbour) - 1]?.x === a.x ||
    points[Math.max(anchor, neighbour) + 1]?.x === b.x
  )
    return unavailable("Duplicate horizontal coordinates: slope is undefined.");
  if (!Number.isFinite(dx))
    return unavailable("This sample distance is not finite.");
  if (axis === "azimuth" && Math.abs(dx) > 180)
    return unavailable("The azimuth seam is not bridged.");
  if (stepped && a.endX != null && a.endX !== b.x)
    return unavailable("A gap or overlap separates the held intervals.");
  const deltaX = dx / gradientUnits(axis, "").xScale;
  const deltaY = b.y - a.y,
    distance = Math.abs(deltaX);
  const slope = deltaY / deltaX;
  if (!Number.isFinite(slope)) return unavailable("This sample difference is not finite.");
  const atJump = stepped &&
    [anchor - 1, anchor].some((i) => {
      const before = points[i], after = points[i + 1];
      return before && after && after.x === target && before.endX === after.x &&
        Number.isFinite(before.y) && Number.isFinite(after.y) && before.y !== after.y;
    });
  return {
    available: true,
    from: a,
    to: b,
    deltaY,
    deltaX,
    distance,
    slope,
    stepped,
    atJump,
  };
}
