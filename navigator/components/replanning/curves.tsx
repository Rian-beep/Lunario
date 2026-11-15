'use client';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatChartValue, linePath, numericDomain } from '@/lib/charts';
import { curveSample, type CurveGroup } from '@/lib/replanning/curves';
import { clampCursor, type CursorDomain } from '@/lib/replanning/model';
import styles from './workspace.module.css';

export const ComparisonPlot = memo(function ComparisonPlot({ group, domain, cursor, onCursor }: { group: CurveGroup; domain: CursorDomain; cursor: number; onCursor(value: number): void }) {
  const id = useId(), tip = `${id}-readout`;
  const host = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(280, element.clientWidth - 28));
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => observer.disconnect();
  }, []);
  const geometry = useMemo(() => {
    const yd = group.unit === '0 / 1' ? [-0.1, 1.1] : numericDomain([0, ...group.lines.flatMap(l => l.points.map(p => p.y))]);
    const xmax = domain.max + domain.step;
    const x = (n: number) => 66 + (n / (xmax || 1)) * (width - 88);
    const y = (n: number) => 180 - (n - yd[0]) / (yd[1] - yd[0]) * 152;
    return { x, y, xmax, yd, paths: group.lines.map(l => linePath(l.points, x, y, l.stepped)) };
  }, [group, domain, width]);
  const readouts = group.lines.map(line => ({ line, point: curveSample(line.points, cursor) }));
  const text = readouts.map(({ line, point }) => `${line.name}: ${formatChartValue(point?.y ?? NaN, group.unit)}`).join('; ');
  const xLabel = domain.alignment === 'elapsed' ? 'Elapsed mission time (h)' : 'Shared time (UTC)';
  const tickLabel = (v: number) => domain.alignment === 'elapsed' ? v.toFixed(1) : new Date(domain.originMs + v * 3600000).toISOString().slice(5, 16).replace('T', ' ');
  return <figure className={styles.plot} ref={host}>
    <figcaption><strong>{group.title}</strong><span>{group.unit === '0 / 1' ? 'Contact (0 = no, 1 = yes)' : `Value (${group.unit})`}</span></figcaption>
    <svg viewBox={`0 0 ${width} 240`} role="slider" tabIndex={0} aria-label={`${group.title}; ${xLabel}`} aria-valuemin={domain.min} aria-valuemax={domain.max} aria-valuenow={cursor} aria-valuetext={`${tickLabel(cursor)}; ${text}`} aria-describedby={tip}
      onKeyDown={event => {
        const stride = domain.step * (event.shiftKey ? 24 : 1);
        const next = event.key === 'Home' ? domain.min : event.key === 'End' ? domain.max : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? cursor + stride : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? cursor - stride : null;
        if (next !== null) { event.preventDefault(); event.stopPropagation(); onCursor(clampCursor(next, domain)); }
      }} onPointerDown={event => {
        const box = event.currentTarget.getBoundingClientRect();
        event.currentTarget.focus();
        onCursor(clampCursor(((event.clientX - box.left) / box.width * width - 66) / (width - 88) * geometry.xmax, domain));
      }}>
      <defs><clipPath id={id}><rect x="66" y="20" width={width - 88} height="168" /></clipPath></defs>
      {(group.unit === '0 / 1' ? [0, 1] : [0, 1, 2, 3].map(i => geometry.yd[0] + i / 3 * (geometry.yd[1] - geometry.yd[0]))).map((v, i) => {
        return <g key={i}><line x1="66" x2={width - 22} y1={geometry.y(v)} y2={geometry.y(v)} stroke="#d8d1c2" /><text x="60" y={geometry.y(v) + 4} textAnchor="end">{group.unit === '0 / 1' ? v.toFixed(0) : v.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 })}</text></g>;
      })}
      <g clipPath={`url(#${id})`}>{group.lines.map((line, i) => <path key={line.name} d={geometry.paths[i]} fill="none" stroke={line.color} strokeWidth="2" strokeDasharray={line.dash} />)}<line x1={geometry.x(cursor)} x2={geometry.x(cursor)} y1="20" y2="188" stroke="#8c5e1e" strokeWidth="1.5" />{readouts.map(({ line, point }) => point && Number.isFinite(point.y) ? <circle key={line.name} cx={geometry.x(point.endX === undefined ? point.x : cursor)} cy={geometry.y(point.y)} r="3" fill="#fffdf8" stroke={line.color} /> : null)}</g>
      {(width < 500 ? [0, 1] : [0, 0.5, 1]).map(f => <text key={f} x={geometry.x(geometry.xmax * f)} y="208" textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{tickLabel(geometry.xmax * f)}</text>)}
      <text x={width / 2} y="234" textAnchor="middle">{xLabel}</text>
    </svg>
    <div className={styles.legend}>{group.lines.map(l => <span key={l.name}><svg viewBox="0 0 30 8" aria-hidden="true"><path d="M0 4H30" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash} /></svg>{l.name}</span>)}</div>
    <details><summary>Cursor values and source meaning</summary><div id={tip} role="tooltip" className={styles.readout}>{readouts.map(({ line, point }) => <p key={line.name}><b>{line.name}</b>: {formatChartValue(point?.y ?? NaN, group.unit)}{point && ` · ${tickLabel(point.x)}${point.endX === undefined ? ' boundary' : `–${tickLabel(point.endX)} interval`}`}</p>)}</div><p>{group.note} Use arrows to move one source sample, Shift + arrows for 24; Home/End reach the bounds.</p></details>
  </figure>;
});
