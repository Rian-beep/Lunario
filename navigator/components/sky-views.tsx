"use client";

import { useEffect, useRef } from "react";
import { horizonAt, poseAt, type SampleSeries } from "@/lib/astro";

const PAPER = "#fffdf8";
const INK = "#1c1915";
const SUN = "#e69f00";
const EARTH = "#0072b2";
const MUTED = "#8a8175";

function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
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
  const trail = useRef<{ sun: { az: number; el: number }[]; earth: { az: number; el: number }[] }>({ sun: [], earth: [] });

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
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

    const xOf = (az: number) => padL + ((az % 360) / 360) * plotW;
    const yOf = (el: number) => padT + ((yMax - el) / (yMax - yMin)) * plotH;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    sky.addColorStop(0, "#f7f1e4");
    sky.addColorStop(1, "#d9e3ea");
    ctx.fillStyle = sky;
    ctx.fillRect(padL, padT, plotW, plotH);

    ctx.beginPath();
    for (let az = 0; az <= 360; az += Math.max(0.5, stepDeg)) {
      const edge = horizonAt(mask, stepDeg, az >= 360 ? 0 : az);
      const x = xOf(Math.min(az, 360));
      const y = Number.isFinite(edge) ? yOf(edge) : yOf(0);
      if (az === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.lineTo(padL, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = "#2a241c";
    ctx.fill();

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
      const x = xOf(az);
      const y = yOf(el);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.fillStyle = color;
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      if (filled) ctx.fill();
      ctx.stroke();
      if (!filled) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = INK;
      ctx.font = "600 13px Outfit, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 10, y - 8);
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
    ctx.fillText("smooth horizon", padL + 8, yOf(0) - 6);
  }, [series, cursor, mask, stepDeg, showTrail]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={ref} role="img" aria-label="Horizon panorama. Azimuth runs from north through east, south, and west. The dashed line is the smooth-sphere horizon." />
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

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
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
      for (let k = 0; k < n; k += stride) {
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

    const k = Math.max(0, Math.min(n - 1, cursor));
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(xOf(k), padT);
    ctx.lineTo(xOf(k), padT + plotH);
    ctx.stroke();
  }, [series, cursor]);

  return (
    <div ref={wrapRef} className="w-full">
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
  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    const height = width < 640 ? 220 : 280;
    const ctx = fitCanvas(canvas, width, height);
    if (!ctx) return;
    ctx.fillStyle = "#d5e0e8";
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
    for (let az = 0; az <= 360; az += Math.max(1, stepDeg)) {
      const edge = horizonAt(mask, stepDeg, az % 360);
      const p = project(az, Number.isFinite(edge) ? edge : 0);
      if (az === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
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
      const p = project(az, el);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.strokeStyle = "#1c1915";
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
  }, [series, cursor, mask, stepDeg, showTrail]);
  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={ref} role="img" aria-label="Oblique sketch of the horizon. The Sun and Earth are drawn on a simple sky dome. This is not a three-dimensional terrain model." />
    </div>
  );
}
