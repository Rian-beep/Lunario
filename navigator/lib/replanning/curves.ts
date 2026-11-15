import { resourcePoints, type ChartPoint } from '../charts';
import type { CursorDomain, PreparedCase } from './model';

export type ReplanningLine = { name: string; color: string; dash?: string; points: ChartPoint[]; stepped?: boolean };
export type CurveGroup = { title: string; unit: string; note: string; lines: ReplanningLine[] };

export function comparisonCurves(cases: readonly PreparedCase[], domain: CursorDomain, stepHours: number): CurveGroup[] {
  const power: ReplanningLine[] = [], storage: ReplanningLine[] = [], contact: ReplanningLine[] = [];
  cases.forEach((item, i) => {
    const label = i === 0 ? 'Reference' : 'Candidate', color = i === 0 ? '#555d43' : '#276b87';
    const origin = domain.alignment === 'elapsed' ? 0 : (Date.parse(item.context.startUtc) - domain.originMs) / 3600000;
    const transform = (points: ChartPoint[]) => points.map(p => ({ ...p, x: origin + p.x / 3600000, ...(p.endX === undefined ? {} : { endX: origin + p.endX / 3600000 }) }));
    for (const sphere of [false, true]) {
      const result = sphere ? item.assessment.sphereMission : item.assessment.mission;
      const name = `${label} · ${sphere ? 'smooth sphere' : 'terrain'}`;
      const dash = i === 0 ? (sphere ? '2 4' : undefined) : (sphere ? '9 3 2 3' : '9 4');
      power.push({ name, color, dash, stepped: true, points: transform(resourcePoints(result.subsegments, 'powerW', 0, stepHours * 3600000)) });
      storage.push({ name, color, dash, points: transform(resourcePoints(result.subsegments, 'batteryWh', 0, stepHours * 3600000, true)) });
      contact.push({ name, color, dash, stepped: true, points: result.timeline.map(t => ({ x: origin + t.startOffsetHours, endX: origin + t.endOffsetHours, y: t.contact === null ? NaN : Number(t.contact) })) });
    }
    power.push({ name: `${label} · electrical load`, color, dash: '1 3', stepped: true, points: item.assessment.mission.subsegments.map(t => ({ x: origin + t.startOffsetHours, endX: origin + t.endOffsetHours, y: t.loadW })) });
    storage.push({ name: `${label} · reserve requirement`, color, dash: '3 6', points: [{ x: origin, y: item.state.mission.batteryWh * item.state.mission.reserveSoc }, { x: origin + item.assessment.mission.timeline.length * stepHours, y: item.state.mission.batteryWh * item.state.mission.reserveSoc }] });
  });
  return [
    { title: 'Array output and electrical load', unit: 'W', lines: power, note: 'Power is held over each source interval, split at configured operations. Connecting samples adds no sunlight resolution.' },
    { title: 'Stored energy and reserve', unit: 'Wh', lines: storage, note: 'Storage includes the initial state and operation-boundary endpoints. Gaps remain unknown after missing generation. Reserve lines show entered limits, even if the reserve requirement is disabled.' },
    { title: 'Geometric antenna contact', unit: '0 / 1', lines: contact, note: '1 = Earth centre clears terrain and the absolute antenna minimum elevation; 0 = no geometric contact. Gaps are unknown. This is not station allocation, acquisition or delivered data.' },
  ];
}

/** Never extend a curve outside its case, or fill a held-interval gap. */
export function curveSample(points: readonly ChartPoint[], target: number): ChartPoint | null {
  if (!points.length || !Number.isFinite(target) || target < points[0].x || target > (points[points.length - 1].endX ?? points[points.length - 1].x)) return null;
  let lo = 0, hi = points.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (points[mid].x <= target) lo = mid + 1; else hi = mid; }
  const previous = points[Math.max(0, lo - 1)], next = points[lo];
  if (previous.endX !== undefined) return target < previous.endX ? previous : null;
  return next && Math.abs(next.x - target) < Math.abs(previous.x - target) ? next : previous;
}
