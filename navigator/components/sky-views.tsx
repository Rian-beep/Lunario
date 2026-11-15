"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { horizonAt, poseAt, type SampleSeries } from "@/lib/astro";
import { ChartImageActions } from "@/components/chart-image-actions";
import type { ChartImageLegend } from "@/lib/chart-image";

const PAPER = "#ffffff";
const INK = "#1c1915";
const SUN = "#e69f00";
const EARTH = "#0072b2";
const MUTED = "#514b43";
const SKY_LEGEND: ChartImageLegend[] = [
  { label: "Sun centre", color: SUN, shape: "sun" },
  { label: "Earth centre", color: EARTH, shape: "earth" },
  { label: "LOLA terrain horizon", color: INK },
  { label: "Smooth-sphere horizon (0°)", color: "#5c7f96", dash: "4 4" },
];
const ELEVATION_LEGEND: ChartImageLegend[] = [
  ...SKY_LEGEND.slice(0, 2),
  { label: "Terrain horizon toward Sun", color: INK, dash: "2 3" },
  { label: "Terrain horizon toward Earth", color: "#7aa0b8", dash: "5 4" },
  SKY_LEGEND[3],
];
const SKY_SCOPE = "Selected sample series: Sun/Earth centre directions and LOLA terrain horizon. The smooth-sphere horizon is 0°. Centre elevation is not a disk visibility fraction. Unknown values leave gaps.";

function SkyLegend({ items }: { items: ChartImageLegend[] }) {
  return <div className="chart-image-legend">{items.map((item) => <span key={item.label}>
    <span aria-hidden="true" style={{ color: item.color, borderTop: `2px ${item.dash ? "dashed" : "solid"} ${item.color}`, minWidth: 22, textAlign: "center" }}>{item.shape === "sun" ? "●" : item.shape === "earth" ? "○" : ""}</span>
    {item.label}
  </span>)}</div>;
}

function useCanvasWidth(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = 2;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function HorizonPanorama({
  series,
  cursor,
  mask,
  stepDeg,
  showTrail = false,
}: {
  series: SampleSeries;
  cursor: number;
  mask: Float64Array;
  stepDeg: number;
  showTrail?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useCanvasWidth(wrapRef);
  const trail = useRef<{ sun: { az: number; el: number }[]; earth: { az: number; el: number }[] }>({ sun: [], earth: [] });

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    if (width <= 0) return;
    const height = width < 640 ? 240 : 300;
    const ctx = fitCanvas(canvas, width, height);
    if (!ctx) return;

    const padL = 42;
    const padR = 12;
    const padT = 16;
    const padB = 28;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let yMin = -6;
    let yMax = 8;
    const consider = (value: number) => {
      if (!Number.isFinite(value)) return;
      yMin = Math.min(yMin, value);
      yMax = Math.max(yMax, value);
    };
    for (let i = 0; i < mask.length; i++) consider(mask[i]);
    for (let k = 0; k < series.sunEl.length; k += Math.ceil(series.sunEl.length / 1500)) {
      consider(series.sunEl[k]);
      consider(series.earthEl[k]);
      consider(series.sunHorizon[k]);
      consider(series.earthHorizon[k]);
    }
    yMin = Math.floor(yMin) - 1;
    yMax = Math.ceil(yMax) + 1;

    const xOf = (az: number) => padL + ((az === 360 ? 360 : ((az % 360) + 360) % 360) / 360) * plotW;
    const yOf = (el: number) => padT + ((yMax - el) / (yMax - yMin)) * plotH;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    let terrainStarted = false, lastTerrainX = padL;
    const closeTerrain = () => {
      if (!terrainStarted) return;
      ctx.lineTo(lastTerrainX, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = "#2a241c";
      ctx.fill();
      terrainStarted = false;
    };
    for (let az = 0; az <= 360; az += Math.max(0.5, stepDeg)) {
      const edge = horizonAt(mask, stepDeg, az >= 360 ? 0 : az);
      if (!Number.isFinite(edge)) { closeTerrain(); continue; }
      const x = xOf(Math.min(az, 360));
      if (!terrainStarted) {
        ctx.beginPath();
        ctx.moveTo(x, padT + plotH);
        terrainStarted = true;
      }
      ctx.lineTo(x, yOf(edge));
      lastTerrainX = x;
    }
    closeTerrain();

    ctx.strokeStyle = "rgba(28,25,21,0.18)";
    ctx.lineWidth = 1;
    ctx.font = "12px Outfit, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    for (let el = Math.ceil(yMin); el <= yMax; el += yMax - yMin > 20 ? 5 : 2) {
      const y = yOf(el);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${el}°`, padL - 6, y + 4);
    }

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#5c7f96";
    ctx.beginPath();
    ctx.moveTo(padL, yOf(0));
    ctx.lineTo(padL + plotW, yOf(0));
    ctx.stroke();
    ctx.setLineDash([]);

    const stride = Math.max(1, Math.floor(series.sunEl.length / 900));
    const drawTrack = (az: Float64Array, el: Float64Array, color: string, filled: boolean) => {
      for (let k = 0; k < az.length; k += stride) {
        if (!Number.isFinite(az[k]) || !Number.isFinite(el[k])) continue;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.arc(xOf(az[k]), yOf(el[k]), filled ? 2.2 : 3.2, 0, Math.PI * 2);
        if (filled) ctx.fill();
        else {
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
    drawTrack(series.sunAz, series.sunEl, SUN, true);
    drawTrack(series.earthAz, series.earthEl, EARTH, false);

    const pose = poseAt(series, cursor);
    if (showTrail) {
      const push = (list: { az: number; el: number }[], az: number, el: number) => {
        const last = list[list.length - 1];
        if (!last || Math.abs(last.az - az) > 0.15 || Math.abs(last.el - el) > 0.02) list.push({ az, el });
        if (list.length > 36) list.shift();
      };
      push(trail.current.sun, pose.sunAz, pose.sunEl);
      push(trail.current.earth, pose.earthAz, pose.earthEl);
    } else {
      trail.current = { sun: [], earth: [] };
    }
    const fade = (points: { az: number; el: number }[], color: string, filled: boolean) => {
      points.forEach((point, index) => {
        if (!Number.isFinite(point.az) || !Number.isFinite(point.el)) return;
        const alpha = ((index + 1) / points.length) * 0.55;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.arc(xOf(point.az), yOf(point.el), filled ? 3.5 : 4.2, 0, Math.PI * 2);
        if (filled) ctx.fill();
        else ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };
    if (showTrail) {
      fade(trail.current.sun, SUN, true);
      fade(trail.current.earth, EARTH, false);
    }
    const mark = (az: number, el: number, color: string, label: string, filled: boolean) => {
      if (!Number.isFinite(az) || !Number.isFinite(el)) return;
      const x = xOf(az);
      const y = yOf(el);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = filled ? INK : color;
      ctx.fillStyle = color;
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      if (filled) ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "left";
      const labelX = Math.min(width - 42, x + 10), labelY = Math.max(padT + 14, y - 8);
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 3;
      ctx.strokeText(label, labelX, labelY);
      ctx.fillText(label, labelX, labelY);
    };
    mark(pose.sunAz, pose.sunEl, SUN, "Sun", true);
    mark(pose.earthAz, pose.earthEl, EARTH, "Earth", false);

    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.font = "12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ["N", "E", "S", "W", "N"].forEach((label, index) => {
      const x = padL + (index / 4) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padT + plotH);
      ctx.lineTo(x, padT + plotH + 5);
      ctx.stroke();
      ctx.fillText(label, x, height - 8);
    });
    ctx.textAlign = "left";
    ctx.fillStyle = "#5c7f96";
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 3;
    ctx.strokeText("smooth horizon", padL + 8, yOf(0) - 6);
    ctx.fillText("smooth horizon", padL + 8, yOf(0) - 6);
  }, [series, cursor, mask, stepDeg, showTrail, viewportWidth]);

  return (
    <div ref={wrapRef} className="w-full chart-image-surface">
      <p style={{ color: INK }}>Horizon panorama · azimuth (° clockwise from north) / elevation (°)</p>
      <canvas ref={ref} role="img" aria-label="Horizon panorama. Azimuth runs from north through east, south, and west. The dashed line is the smooth-sphere horizon." />
      <SkyLegend items={SKY_LEGEND} />
      <ChartImageActions getPlot={() => ref.current} title="Horizon panorama" xAxis="Azimuth (° clockwise from north: N 0°, E 90°, S 180°, W 270°)" yAxis="Elevation above local horizontal (°)" legend={SKY_LEGEND} notes={[SKY_SCOPE, `Displayed position: sample ${cursor.toFixed(2)} within selected span (0-based).`]} />
    </div>
  );
}

export function ElevationChart({
  series,
  cursor,
  onCursor,
}: {
  series: SampleSeries;
  cursor: number;
  onCursor: (index: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useCanvasWidth(wrapRef);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    if (width <= 0) return;
    const height = width < 640 ? 220 : 260;
    const ctx = fitCanvas(canvas, width, height);
    if (!ctx) return;
    const padL = 42;
    const padR = 12;
    const padT = 12;
    const padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const n = series.sunEl.length;
    let yMin = -4;
    let yMax = 6;
    const stride = Math.max(1, Math.floor(n / 2000));
    for (let k = 0; k < n; k += stride) {
      for (const value of [series.sunEl[k], series.earthEl[k], series.sunHorizon[k], series.earthHorizon[k]]) {
        if (!Number.isFinite(value)) continue;
        yMin = Math.min(yMin, value);
        yMax = Math.max(yMax, value);
      }
    }
    yMin = Math.floor(yMin) - 1;
    yMax = Math.ceil(yMax) + 1;
    const xOf = (k: number) => padL + (n <= 1 ? 0 : (k / (n - 1)) * plotW);
    const yOf = (el: number) => padT + ((yMax - el) / (yMax - yMin)) * plotH;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(28,25,21,0.12)";
    ctx.fillStyle = MUTED;
    ctx.font = "12px Outfit, sans-serif";
    ctx.textAlign = "right";
    for (let el = Math.ceil(yMin); el <= yMax; el += yMax - yMin > 16 ? 4 : 2) {
      const y = yOf(el);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${el}°`, padL - 6, y + 4);
    }

    const line = (values: Float64Array, color: string, dash: number[]) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = dash.length ? 1.4 : 2;
      ctx.setLineDash(dash);
      let started = false;
      for (let k = 0; k < n; k++) {
        if (!Number.isFinite(values[k])) {
          started = false;
          continue;
        }
        const x = xOf(k);
        const y = yOf(values[k]);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    line(series.sunHorizon, INK, [2, 3]);
    line(series.earthHorizon, "#7aa0b8", [5, 4]);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#5c7f96";
    ctx.beginPath();
    ctx.moveTo(padL, yOf(0));
    ctx.lineTo(padL + plotW, yOf(0));
    ctx.stroke();
    ctx.setLineDash([]);
    line(series.sunEl, SUN, []);
    line(series.earthEl, EARTH, []);

    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    for (let tick = 0; tick < 3; tick++) {
      const sample = Math.round((Math.max(0, n - 1) * tick) / 2);
      ctx.fillText(String(sample), xOf(sample), height - 7);
    }

    const k = Math.max(0, Math.min(n - 1, cursor));
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(xOf(k), padT);
    ctx.lineTo(xOf(k), padT + plotH);
    ctx.stroke();
  }, [series, cursor, viewportWidth]);

  return (
    <div ref={wrapRef} className="w-full chart-image-surface">
      <p style={{ color: INK }}>Elevation over selected samples · elevation (°) / sample index</p>
      <canvas
        ref={ref}
        className="w-full cursor-pointer"
        role="img"
        aria-label="Elevation over time. Amber is the Sun, blue is Earth. The dark dashed line is the terrain horizon in the Sun's direction."
        onClick={(event) => {
          const canvas = ref.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const padL = 42;
          const padR = 12;
          const plotW = rect.width - padL - padR;
          const t = (event.clientX - rect.left - padL) / plotW;
          const n = series.sunEl.length;
          const k = Math.round(Math.max(0, Math.min(1, t)) * (n - 1));
          onCursor(k);
        }}
      />
      <SkyLegend items={ELEVATION_LEGEND} />
      <ChartImageActions getPlot={() => ref.current} title="Elevation over selected samples" xAxis="Sample index within selected span (0-based)" yAxis="Elevation above local horizontal (°)" legend={ELEVATION_LEGEND} notes={[SKY_SCOPE, `Selected sample: ${cursor.toFixed(2)}. Span: ${series.sunEl.length} samples; indices ${series.index0}–${series.index0 + series.sunEl.length - 1} in source series.`]} />
    </div>
  );
}

export function ObliqueSketch({
  series,
  cursor,
  mask,
  stepDeg,
  showTrail = false,
}: {
  series: SampleSeries;
  cursor: number;
  mask: Float64Array;
  stepDeg: number;
  showTrail?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useCanvasWidth(wrapRef);
  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    if (width <= 0) return;
    const height = width < 640 ? 220 : 280;
    const ctx = fitCanvas(canvas, width, height);
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    const ground = ctx.createLinearGradient(0, height * 0.45, 0, height);
    ground.addColorStop(0, "#3a342c");
    ground.addColorStop(1, "#1c1915");
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.lineTo(width, height);
    ctx.fill();
    const project = (az: number, el: number) => {
      const ar = (az * Math.PI) / 180;
      const er = (el * Math.PI) / 180;
      const x = Math.sin(ar) * Math.cos(er);
      const y = Math.sin(er);
      const z = Math.cos(ar) * Math.cos(er);
      const depth = 2.4 + z;
      return { x: width / 2 + (x / depth) * width * 0.46, y: height * 0.58 - (y / depth) * height * 0.72 };
    };
    ctx.beginPath();
    let terrainStarted = false;
    for (let az = 0; az <= 360; az += Math.max(1, stepDeg)) {
      const edge = horizonAt(mask, stepDeg, az % 360);
      if (!Number.isFinite(edge)) { terrainStarted = false; continue; }
      const p = project(az, edge);
      if (!terrainStarted) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
      terrainStarted = true;
    }
    ctx.strokeStyle = "#1c1915";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let az = 0; az <= 360; az += 6) {
      const p = project(az, 0);
      if (az === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "#5c7f96";
    ctx.stroke();
    ctx.setLineDash([]);
    const pose = poseAt(series, cursor);
    const drawBody = (az: number, el: number, color: string, filled: boolean) => {
      if (!Number.isFinite(az) || !Number.isFinite(el)) return;
      const p = project(az, el);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.strokeStyle = filled ? INK : color;
      ctx.lineWidth = 2;
      ctx.arc(p.x, p.y, filled ? 8 : 9, 0, Math.PI * 2);
      if (filled) ctx.fill();
      ctx.stroke();
    };
    if (showTrail) {
      const start = Math.max(0, Math.floor(cursor) - 18);
      for (let k = start; k < cursor; k += 1) {
        ctx.globalAlpha = 0.18;
        drawBody(series.sunAz[Math.floor(k)] ?? series.sunAz[0], series.sunEl[Math.floor(k)] ?? series.sunEl[0], SUN, true);
      }
      ctx.globalAlpha = 1;
    }
    drawBody(pose.earthAz, pose.earthEl, EARTH, false);
    drawBody(pose.sunAz, pose.sunEl, SUN, true);
    ctx.fillStyle = "#1c1915";
    ctx.font = "13px Outfit, sans-serif";
    ctx.fillText("Oblique sketch, not a terrain model", 12, 22);
  }, [series, cursor, mask, stepDeg, showTrail, viewportWidth]);
  return (
    <div ref={wrapRef} className="w-full chart-image-surface">
      <canvas ref={ref} role="img" aria-label="Oblique sketch of the horizon. The Sun and Earth are drawn on a simple sky dome. This is not a three-dimensional terrain model." />
      <SkyLegend items={SKY_LEGEND} />
      <ChartImageActions getPlot={() => ref.current} title="Oblique horizon sketch" xAxis="Projected sky direction (schematic; no distance scale)" yAxis="Projected elevation (schematic; no distance scale)" legend={SKY_LEGEND} notes={["Oblique sketch, not a three-dimensional terrain model. Simple sky-dome projection of centre directions; ground is schematic.", `Displayed position: sample ${cursor.toFixed(2)} within selected span (0-based).`]} />
    </div>
  );
}
