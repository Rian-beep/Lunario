"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Catalog, Site } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { SITE_COLORS } from "@/lib/catalog";
import { loadImagery, type ImageryData, type ImagePatch } from "@/lib/imagery";
import { latLonToProjected, projectedToLatLon } from "@/lib/astro";
import { lightingPixels, prepareLighting, sunlitCells } from "@/lib/lighting";
import { onlineNacLevel, polarTileSamplingM, polarSamplingLabel, bundledPatchUseful, POLAR_NAC_TILE_BUDGET } from "@/lib/polar-imagery";

import {neutralLunarBitmap, LUNAR_ATLAS_POLICY} from "@/lib/lunar-appearance";

export type PolarCamera = { scale: number; x: number; y: number };
type Camera = PolarCamera;
type Rect = { x: number; y: number; width: number; height: number };
type Tile = { image: HTMLImageElement; state: "loading" | "ready" | "failed" };
const MAX_TILES = 96;
const MAX_PENDING_TILES = 6;
const MAX_REQUESTS_PER_VIEW = POLAR_NAC_TILE_BUDGET;

type Props = {
  catalog: Catalog;
  sites: Site[];
  selectedId: string | null;
  compareIds: string[];
  custom: { lat: number; lon: number } | null;
  timeIndex: number;
  expanded?: boolean;
  imagery?: boolean;
  lighting?: boolean;
  onSelect: (id: string) => void;
  onPlace: (lat: number, lon: number) => void;
};

export function PolarMap({
  catalog,
  sites,
  selectedId,
  compareIds,
  custom,
  timeIndex,
  expanded = false,
  imagery = false,
  lighting,
  onSelect,
  onPlace,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cameraRef = useRef<Camera>({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    x: number;
    y: number;
    camX: number;
    camY: number;
    moved: boolean;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const [, setCamera] = useState<Camera>({ scale: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [lightingOn, setLightingOn] = useState(false);
  const fitted = useRef(false);
  const previousSize = useRef({ width: 0, height: 0 });
  const lastSelection = useRef<string | null>(null);
  const tiles = useRef(new Map<string, Tile>());
  const bundledImages = useRef(new Map<string, HTMLImageElement>());
  const imageryRef = useRef<ImageryData | null>(null);
  const pendingTiles = useRef(0);
  const onlineRef = useRef(false);
  const mounted = useRef(false);
  const repaint = useRef<() => void>(() => undefined);
  const [tileError, setTileError] = useState(false);
  const [onlineNac, setOnlineNac] = useState(false);
  const [imageryStatus, setImageryStatus] = useState("Loading bundled LROC imagery");
  const [imageSampling, setImageSampling] = useState("");
  const graticuleLabels = useRef<Rect[]>([]);
  const labelTargets = useRef<Array<{ id: string; rect: Rect }>>([]);
  const clusters = useRef<Array<{ x: number; y: number; count: number; id: string }>>([]);
  const light = lighting ?? lightingOn;

  const lightingIndex = useMemo(() => prepareLighting(catalog), [catalog]);
  const flags = useMemo(
    () =>
      light ? sunlitCells(catalog, timeIndex, lightingIndex.nCells) : null,
    [catalog, timeIndex, lightingIndex.nCells, light],
  );
  const overlay = useMemo(() => {
    if (!flags || typeof ImageData === "undefined") return null;
    return lightingPixels(lightingIndex, flags);
  }, [flags, lightingIndex]);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      neutralLunarBitmap(image);
      imageRef.current = image;
      repaint.current();
    };
    image.src = catalog.map.url;
    return () => {
      image.onload = null;
    };
  }, [catalog.map.url]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    loadImagery().then((data) => {
      if (!active) return;
      imageryRef.current = data;
      const overview = new Image();
      overview.onload = () => {
        if (!active) return;
        neutralLunarBitmap(overview);
        bundledImages.current.set(data.overview.id, overview);
        setImageryStatus("LROC WAC imagery · NASA / ASU");
        repaint.current();
      };
      overview.onerror = () => {
        if (active) setImageryStatus("Bundled LROC overview unavailable; LOLA relief shown");
      };
      overview.src = data.overview.url;
    }).catch(() => {
      if (active) setImageryStatus("Bundled LROC imagery unavailable; LOLA relief shown");
    });
    return () => { active = false; mounted.current = false; };
  }, []);

  useEffect(() => {
    onlineRef.current = imagery && onlineNac;
  }, [imagery, onlineNac]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => {
      const bounds = wrap.getBoundingClientRect();
      const width = bounds.width;
      const height = expanded
        ? bounds.height
        : Math.max(300, Math.min(520, Math.round(width * 1.05)));
      if (!width || !height) return;
      const before = previousSize.current;
      if (before.width && before.height) {
        cameraRef.current = resizePolarCamera(cameraRef.current, before, { width, height });
      }
      previousSize.current = { width, height };
      setSize({ width, height });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    if (!fitted.current && size.width > 0) {
      const fit = fitPolarCamera(
        size.width,
        size.height,
        catalog.map.width,
        catalog.map.height,
        expanded,
      );
      cameraRef.current = fit;
      setCamera(fit);
      fitted.current = true;
    }
  }, [size, catalog.map.width, catalog.map.height, expanded]);

  useEffect(() => {
    repaint.current = paint;
    paint();
  });

  useEffect(() => {
    if (!expanded || !size.width) return;
    const key = custom ? `custom:${custom.lat}:${custom.lon}` : selectedId;
    if (!key || lastSelection.current === key) return;
    const site = custom ?? sites.find((s) => s.id === selectedId);
    if (!site) return;
    lastSelection.current = key;
    const p = imagePoint(site.lat, site.lon);
    const rect = usableMapRect();
    const fit = fitPolarCamera(rect.width, rect.height, catalog.map.width, catalog.map.height);
    // A regional view gives the selected site context without enlarging the
    // original 600 m hillshade into a false close-up.
    const scale = fit.scale * 5;
    commit({
      scale,
      x: rect.x + rect.width * 0.5 - p.x * scale,
      y: rect.y + rect.height * 0.52 - p.y * scale,
    });
    // Selection recenters once; resizing/panning does not reset the user's camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, custom?.lat, custom?.lon, expanded, size.width, size.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      const factor = Math.exp(-Math.max(-160, Math.min(160, delta)) * 0.003);
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
    // Wheel listener uses the current render dimensions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  function commit(next: Camera) {
    cameraRef.current = next;
    setCamera(next);
  }

  function zoomAt(sx: number, sy: number, factor: number) {
    const cam = cameraRef.current;
    const min =
      fitPolarCamera(size.width, size.height, catalog.map.width, catalog.map.height)
        .scale * 0.85;
    const max = min * 28;
    const nextScale = Math.max(min, Math.min(max, cam.scale * factor));
    const k = nextScale / cam.scale;
    commit({
      scale: nextScale,
      x: sx - (sx - cam.x) * k,
      y: sy - (sy - cam.y) * k,
    });
  }

  function resetView() {
    const fit = fitPolarCamera(
      size.width,
      size.height,
      catalog.map.width,
      catalog.map.height,
    );
    const rect = usableMapRect();
    const visibleFit = fitPolarCamera(rect.width, rect.height, catalog.map.width, catalog.map.height, true);
    commit(expanded ? { ...visibleFit, x: visibleFit.x + rect.x, y: visibleFit.y + rect.y } : fit);
  }

  function imagePoint(lat: number, lon: number) {
    const map = catalog.map;
    const projected = latLonToProjected(lat, lon);
    return {
      x: (projected.x - map.tieX) / map.scaleM - map.centerOffset,
      y: (map.tieY - projected.y) / map.scaleM - map.centerOffset,
    };
  }

  function screenFromImage(ix: number, iy: number, cam = cameraRef.current) {
    return polarImageToScreen({ x: ix, y: iy }, cam);
  }

  function imageFromScreen(sx: number, sy: number, cam = cameraRef.current) {
    return polarScreenToImage({ x: sx, y: sy }, cam);
  }

  function latLonFromScreen(sx: number, sy: number) {
    const image = imageFromScreen(sx, sy);
    const map = catalog.map;
    const x = map.tieX + (image.x + map.centerOffset) * map.scaleM;
    const y = map.tieY - (image.y + map.centerOffset) * map.scaleM;
    return projectedToLatLon(x, y);
  }

  function paint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.dataset.lunarAppearance = LUNAR_ATLAS_POLICY.id;
    canvas.dataset.lunarAtlasReady = String(!!imageRef.current);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx || !width || !height) return;
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.fillStyle = expanded ? "#e8e5da" : "#e7dfd0";
    ctx.fillRect(0, 0, width, height);
    const cam = cameraRef.current;
    const map = catalog.map;
    canvas.dataset.mapTransform = JSON.stringify({ ...cam, width, height, mapWidth: map.width, mapHeight: map.height });
    const image = imageRef.current;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    if (image && image.complete && image.naturalWidth) {
      ctx.drawImage(
        neutralLunarBitmap(image),
        cam.x,
        cam.y,
        map.width * cam.scale,
        map.height * cam.scale,
      );
      ctx.filter = "none";
    }
    if (imagery) {
      drawBundledImagery(ctx, cam, width, height);
    }
    if (overlay && light) {
      const off = document.createElement("canvas");
      off.width = overlay.width;
      off.height = overlay.height;
      off.getContext("2d")?.putImageData(overlay, 0, 0);
      ctx.drawImage(off, cam.x, cam.y, map.width * cam.scale, map.height * cam.scale);
    }
    drawGraticule(ctx, cam);
    drawSites(ctx, cam, width, height);
    if (custom) {
      const p = imagePoint(custom.lat, custom.lon);
      const s = screenFromImage(p.x, p.y, cam);
      ctx.strokeStyle = "#1c1915";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - 9, s.y);
      ctx.lineTo(s.x + 9, s.y);
      ctx.moveTo(s.x, s.y - 9);
      ctx.lineTo(s.x, s.y + 9);
      ctx.stroke();
    }
    ctx.restore();
    drawScale(ctx, width, height);
  }

  function mapObstacles(): Rect[] {
    const wrap = wrapRef.current;
    const workspace = wrap?.closest(".workspace");
    if (!wrap || !workspace) return [];
    const base = wrap.getBoundingClientRect();
    return [...workspace.querySelectorAll(
      ".site-drawer, .inspector, .workspace-heading, .view-switch, .drawer-toggles, .map-bottom-tools, .flight-telemetry, .terrain-notice, .scene-camera, .map-zoom, .map-credit, .map-imagery-tools",
    )].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height };
    }).filter((r) => r.width > 0 && r.height > 0 && r.x < size.width && r.y < size.height && r.x + r.width > 0 && r.y + r.height > 0);
  }

  function usableMapRect(): Rect {
    if (!expanded) return { x: 0, y: 0, ...size };
    const obstacles = mapObstacles();
    let left = 20, right = size.width - 20;
    for (const r of obstacles) {
      if (r.height < size.height * 0.35 || r.y > size.height * 0.5) continue;
      if (r.x < size.width * 0.25) left = Math.max(left, r.x + r.width + 20);
      if (r.x + r.width > size.width * 0.75) right = Math.min(right, r.x - 20);
    }
    // Split panes can be narrower than both floating instruments together.
    if (right - left < 180) { left = 20; right = size.width - 20; }
    return { x: left, y: Math.min(150, size.height * 0.25), width: Math.max(1, right - left), height: Math.max(1, size.height - Math.min(150, size.height * 0.25) - 100) };
  }

  function drawBundledImagery(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number) {
    const data = imageryRef.current;
    if (!data) return;
    const map = catalog.map;
    const draw = (patch: ImagePatch, im: HTMLImageElement) => {
      const p = screenFromImage(
        (patch.x0 - map.tieX) / map.scaleM - map.centerOffset,
        (map.tieY - patch.y0) / map.scaleM - map.centerOffset, cam,
      );
      const w = patch.width * patch.stepM / map.scaleM * cam.scale;
      const h = patch.height * patch.stepM / map.scaleM * cam.scale;
      ctx.drawImage(neutralLunarBitmap(im), p.x, p.y, w, h);
    };
    const overview = bundledImages.current.get(data.overview.id);
    if (overview) draw(data.overview, overview);
    // Load only visible higher-resolution patches, and retain them for panning.
    const visible = data.patches.filter((patch) => {
      const p = screenFromImage(
        (patch.x0 - map.tieX) / map.scaleM - map.centerOffset,
        (map.tieY - patch.y0) / map.scaleM - map.centerOffset, cam,
      );
      const w = patch.width * patch.stepM / map.scaleM * cam.scale;
      const h = patch.height * patch.stepM / map.scaleM * cam.scale;
      return bundledPatchUseful(patch, map.scaleM / cam.scale, data.overview.sourcePixelM) && p.x < width && p.y < height && p.x + w > 0 && p.y + h > 0;
    }).sort((a, b) => b.stepM - a.stepM);
    let sourceM = data.overview.sourcePixelM;
    let sampleM = data.overview.stepM;
    let onlineDrawn = false;
    const drawOnline = () => {
      if (onlineDrawn) return;
      onlineDrawn = true;
      const sample = onlineNac && expanded ? drawImagery(ctx, cam, width, height) : null;
      if (sample !== null) { sampleM = sourceM < data.overview.sourcePixelM ? Math.min(sampleM, sample) : sample; sourceM = 1; }
    };
    for (const patch of visible) {
      // Keep the finer bundled NAC pixels above the optional online pyramid.
      if (patch.sourcePixelM < data.overview.sourcePixelM) drawOnline();
      const im = bundledImages.current.get(patch.id);
      if (im?.complete && im.naturalWidth) {
        draw(patch, im);
        // Report the finest visible bundled source without claiming its sampling
        // is an independent measured resolution.
        sourceM = Math.min(sourceM, patch.sourcePixelM);
        sampleM = Math.min(sampleM, patch.stepM);
      } else if (!im) {
        const next = new Image();
        bundledImages.current.set(patch.id, next);
        next.onload = () => { if (mounted.current) { neutralLunarBitmap(next); repaint.current(); } };
        next.onerror = () => { if (mounted.current) setImageryStatus("Some LROC patches unavailable; bundled overview / LOLA relief underneath"); };
        next.src = patch.url;
      }
    }
    drawOnline();
    const text = overview || sourceM < data.overview.sourcePixelM ? polarSamplingLabel(sourceM, sampleM) : "LOLA relief · 600 m/px";
    setImageSampling((old) => old === text ? old : text);
  }

  function drawSites(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number) {
    const pinPoints = sites.map((site, index) => ({ site, index, ...screenFromImage(imagePoint(site.lat, site.lon).x, imagePoint(site.lat, site.lon).y, cam) }));
    const obstacles = mapObstacles();
    const placed: Rect[] = [...obstacles, ...graticuleLabels.current];
    // Keep labels off every marker, including those drawn later.
    placed.push(...pinPoints.map((p) => ({ x: p.x - 13, y: p.y - 13, width: 26, height: 26 })));
    const scaleRect = scaleBox(width, height);
    placed.push(scaleRect);
    labelTargets.current = [];
    ctx.save();
    ctx.font = `500 14px ${mapFont()}`;
    const sorted = [...pinPoints].sort((a, b) => Number(b.site.id === selectedId) - Number(a.site.id === selectedId) || Number(compareIds.includes(b.site.id)) - Number(compareIds.includes(a.site.id)));
    const grouped: Array<(typeof pinPoints)[number] & { count: number }> = [];
    for (const p of sorted) {
      const nearby = grouped.find((q) => Math.hypot(p.x - q.x, p.y - q.y) < 32);
      if (nearby) nearby.count++;
      else grouped.push({ ...p, count: 1 });
    }
    clusters.current = grouped.map((p) => ({ x: p.x, y: p.y, count: p.count, id: p.site.id }));
    for (const p of grouped) {
      if (p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) continue;
      const selected = p.site.id === selectedId;
      const compared = compareIds.includes(p.site.id);
      const radius = p.count > 1 ? 11 : selected ? 8 : compared ? 6 : 4.5;
      ctx.beginPath();
      ctx.fillStyle = expanded ? selected ? "#9f701f" : "#fffdf4" : SITE_COLORS[p.index % SITE_COLORS.length];
      ctx.strokeStyle = selected ? "#fffef5" : "#46513a";
      ctx.lineWidth = selected ? 3 : 1.5;
      if (p.site.group === "derived") {
        ctx.moveTo(p.x, p.y - radius - 1);
        ctx.lineTo(p.x + radius + 1, p.y);
        ctx.lineTo(p.x, p.y + radius + 1);
        ctx.lineTo(p.x - radius - 1, p.y);
        ctx.closePath();
      } else ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (p.count > 1) {
        ctx.save();
        ctx.fillStyle = selected ? "#fffef5" : "#35442a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 12px ${mapFont()}`;
        ctx.fillText(String(p.count), p.x, p.y + 0.5);
        ctx.restore();
      }
      if (selected || compared) {
        ctx.beginPath();
        ctx.strokeStyle = "#655324";
        ctx.lineWidth = 1.5;
        ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (!selected && !compared && (!expanded || cam.scale < 0.7)) continue;
      const label = p.site.name + (p.site.group === "derived" ? " · derived" : "") + (p.count > 1 ? ` · ${p.count} sites` : "");
      const labelW = ctx.measureText(label).width + 20;
      const labelH = 30;
      // Prefer nearby labels; a leader can reach a clear slot in a dense cluster.
      const candidates: Rect[] = [];
      for (const dy of [-36, 8, -72, 44, -108, 80]) {
        candidates.push({ x: p.x + 20, y: p.y + dy, width: labelW, height: labelH });
        candidates.push({ x: p.x - 20 - labelW, y: p.y + dy, width: labelW, height: labelH });
      }
      for (const dy of [-50, 24, -88, 62]) candidates.push({ x: p.x - labelW / 2, y: p.y + dy, width: labelW, height: labelH });
      const r = candidates.find((r) => r.x >= 12 && r.y >= 12 && r.x + r.width <= width - 12 && r.y + r.height <= height - 12 && !placed.some((o) => intersects(r, o, 5)));
      if (!r) continue;
      placed.push(r);
      labelTargets.current.push({ id: p.site.id, rect: r });
      const anchorX = Math.max(r.x, Math.min(p.x, r.x + r.width));
      const anchorY = Math.max(r.y, Math.min(p.y, r.y + r.height));
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(anchorX, anchorY);
      ctx.strokeStyle = selected ? "#655324" : "#5d6851";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.width, r.height, 7);
      ctx.fillStyle = selected ? "#fff9e8f5" : "#fffdf4eb";
      ctx.strokeStyle = selected ? "#9f7a32" : "#707b5959";
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#35442a";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, r.x + 10, r.y + labelH / 2);
    }
    ctx.restore();
  }

  function drawImagery(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    width: number,
    height: number,
  ) {
    const metersPerPixel = catalog.map.scaleM / cam.scale;
    const z = onlineNacLevel(metersPerPixel, imageryRef.current?.overview.sourcePixelM ?? 100, { width, height });
    // Regional averaged NAC has a visible polar-cap footprint and can be coarser
    // than the coherent WAC overview. Do not request or paint it at these scales.
    if (z === null) return null;
    const span = 2191860 / 2 ** z;
    const top = 1095930;
    const a = imageFromScreen(0, 0, cam),
      b = imageFromScreen(width, height, cam);
    const x0 =
      catalog.map.tieX + (a.x + catalog.map.centerOffset) * catalog.map.scaleM;
    const x1 =
      catalog.map.tieX + (b.x + catalog.map.centerOffset) * catalog.map.scaleM;
    const y0 =
      catalog.map.tieY - (a.y + catalog.map.centerOffset) * catalog.map.scaleM;
    const y1 =
      catalog.map.tieY - (b.y + catalog.map.centerOffset) * catalog.map.scaleM;
    const c0 = Math.max(0, Math.floor((x0 + top) / span)),
      c1 = Math.min(2 ** z - 1, Math.floor((x1 + top) / span));
    const r0 = Math.max(0, Math.floor((top - y0) / span)),
      r1 = Math.min(2 ** z - 1, Math.floor((top - y1) / span));
    const coverage = latLonToProjected(-85.5, 0);
    const coverageRadius = Math.hypot(coverage.x, coverage.y);
    const visible: Array<{ key: string; row: number; col: number }> = [];
    for (let row = r0; row <= r1; row++)
      for (let col = c0; col <= c1; col++) {
        const left = -top + col * span, upper = top - row * span;
        const nearestX = Math.max(left, Math.min(0, left + span));
        const nearestY = Math.max(upper - span, Math.min(0, upper));
        if (Math.hypot(nearestX, nearestY) <= coverageRadius)
          visible.push({ key: `${z}/${row}/${col}`, row, col });
      }
    const centerCol = (c0 + c1) / 2, centerRow = (r0 + r1) / 2;
    visible.sort((a, b) => Math.hypot(a.col - centerCol, a.row - centerRow) - Math.hypot(b.col - centerCol, b.row - centerRow));
    const allowed = visible.slice(0, MAX_REQUESTS_PER_VIEW);
    const keep = new Set(allowed.map((t) => t.key));
    let drawn = 0;
    for (const { key, row, col } of allowed) {
      let tile = tiles.current.get(key);
      if (!tile && pendingTiles.current < MAX_PENDING_TILES) {
        if (tiles.current.size >= MAX_TILES) {
          const stale = [...tiles.current].find(([id, t]) => !keep.has(id) && t.state !== "loading");
          if (stale) tiles.current.delete(stale[0]);
        }
        if (tiles.current.size >= MAX_TILES) continue;
        const im = new Image();
        tile = { image: im, state: "loading" };
        tiles.current.set(key, tile);
        pendingTiles.current++;
        const finish = (state: "ready" | "failed") => {
          const t = tiles.current.get(key);
          if (t) t.state = state;
          pendingTiles.current--;
          if (!mounted.current) return;
          if (state === "failed") setTileError(true);
          if (onlineRef.current) repaint.current();
        };
        im.crossOrigin = "anonymous";
        im.onload = () => { neutralLunarBitmap(im); finish("ready"); };
        im.onerror = () => finish("failed");
        im.src = `https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_AvgMosaic_SPole855_1mp/1.0.0/default/default028mm/${key}.png`;
      }
      if (tile?.state !== "ready") continue;
      const ix = (-top + col * span - catalog.map.tieX) / catalog.map.scaleM - catalog.map.centerOffset;
      const iy = (catalog.map.tieY - (top - row * span)) / catalog.map.scaleM - catalog.map.centerOffset;
      const p = screenFromImage(ix, iy, cam), px = span / catalog.map.scaleM * cam.scale;
      ctx.drawImage(neutralLunarBitmap(tile.image), p.x, p.y, px, px);
      drawn++;
    }
    return drawn ? polarTileSamplingM(z) : null;
  }

  function drawGraticule(ctx: CanvasRenderingContext2D, cam: Camera) {
    ctx.save();
    ctx.strokeStyle = expanded ? "rgba(54,64,43,0.16)" : "rgba(28,25,21,0.45)";
    ctx.fillStyle = expanded ? "rgba(56,70,44,0.7)" : "rgba(28,25,21,0.8)";
    ctx.lineWidth = 1;
    ctx.font = `12px ${mapFont()}`;
    ctx.textAlign = "left";
    graticuleLabels.current = [];
    const obstacles = mapObstacles();
    const text = (label: string, x: number, y: number) => {
      const rect = { x: x - 4, y: y - 14, width: ctx.measureText(label).width + 8, height: 20 };
      if (rect.x < 8 || rect.y < 8 || rect.x + rect.width > size.width - 8 || rect.y + rect.height > size.height - 8 || obstacles.some((o) => intersects(rect, o, 4))) return;
      graticuleLabels.current.push(rect);
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#fffdf3e6";
      ctx.strokeText(label, x, y);
      ctx.fillStyle = "#4c5b3e";
      ctx.fillText(label, x, y);
      ctx.restore();
    };
    for (const lat of [-80, -85, -88]) {
      ctx.beginPath();
      let started = false;
      for (let lon = 0; lon <= 360; lon += 3) {
        const p = imagePoint(lat, lon);
        const s = screenFromImage(p.x, p.y, cam);
        if (!started) {
          ctx.moveTo(s.x, s.y);
          started = true;
        } else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      const label = screenFromImage(
        imagePoint(lat, 20).x,
        imagePoint(lat, 20).y,
        cam,
      );
      text(`${Math.abs(lat)}°S`, label.x + 4, label.y - 4);
    }
    for (const lon of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
      ctx.beginPath();
      const a = imagePoint(-80.05, lon);
      const b = imagePoint(-89.6, lon);
      const sa = screenFromImage(a.x, a.y, cam);
      const sb = screenFromImage(b.x, b.y, cam);
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      if (lon % 90 === 0) {
        const label =
          lon === 0
            ? "0° toward Earth"
            : lon > 180
              ? `${360 - lon}°W`
              : `${lon}°E`;
        text(label, sa.x + 4, sa.y + 14);
      }
    }
    ctx.restore();
  }

  function mapFont() {
    return wrapRef.current ? getComputedStyle(wrapRef.current).fontFamily : '"Segoe UI", sans-serif';
  }

  function scaleBox(width: number, height: number): Rect {
    const region = usableMapRect();
    return { x: expanded ? region.x + region.width / 2 - 90 : 16, y: height - (expanded ? 140 : 58), width: Math.min(180, width - 32), height: 44 };
  }

  function drawScale(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const box = scaleBox(width, height);
    const center = box.x + box.width / 2;
    const baseline = box.y + 31;
    const a = latLonFromScreen(center - 40, baseline), b = latLonFromScreen(center + 40, baseline);
    const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
    if (!Number.isFinite(km) || km <= 0) return;
    const pxPerKm = 80 / km;
    const choices = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    const nice = choices.reduce((best, n) => Math.abs(n * pxPerKm - 100) < Math.abs(best * pxPerKm - 100) ? n : best, choices[0]);
    // The projection scale varies with latitude. Solve the actual bar length
    // using its endpoints rather than sampling the centre of the map.
    let low = 0, high = box.width - 24;
    for (let i = 0; i < 20; i++) {
      const px = (low + high) / 2;
      const p = latLonFromScreen(center - px / 2, baseline), q = latLonFromScreen(center + px / 2, baseline);
      if (haversineKm(p.lat, p.lon, q.lat, q.lon) < nice) low = px;
      else high = px;
    }
    const bar = (low + high) / 2;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.width, box.height, 8);
    ctx.fillStyle = "#fffdf4ed"; ctx.fill();
    ctx.strokeStyle = "#6e76554d"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(center - bar / 2, baseline - 4); ctx.lineTo(center - bar / 2, baseline);
    ctx.lineTo(center + bar / 2, baseline); ctx.lineTo(center + bar / 2, baseline - 4);
    ctx.strokeStyle = "#3e4d30"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#3e4d30"; ctx.font = `500 12px ${mapFont()}`;
    ctx.textAlign = "center";
    ctx.fillText(nice < 1 ? `${nice * 1000} m` : `${nice} km`, center, box.y + 17);
    ctx.restore();
  }

  function hitSite(sx: number, sy: number) {
    const label = labelTargets.current.find(({ rect }) => sx >= rect.x && sx <= rect.x + rect.width && sy >= rect.y && sy <= rect.y + rect.height);
    if (label) return sites.find((s) => s.id === label.id) ?? null;
    let found: Site | null = null;
    let best = 18 * 18;
    for (const site of sites) {
      const p = imagePoint(site.lat, site.lon);
      const s = screenFromImage(p.x, p.y);
      const dx = s.x - sx;
      const dy = s.y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        found = site;
      }
    }
    return found;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      pinchRef.current = {
        dist: Math.hypot(p.x - q.x, p.y - q.y),
        scale: cameraRef.current.scale,
      };
      dragRef.current = null;
      return;
    }
    dragRef.current = {
      x: point.x,
      y: point.y,
      camX: cameraRef.current.x,
      camY: cameraRef.current.y,
      moved: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size >= 2 && pinchRef.current) {
      const [p, q] = [...pointers.current.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      if (pinchRef.current.dist > 0) {
        const midX = (p.x + q.x) / 2;
        const midY = (p.y + q.y) / 2;
        const factor = dist / pinchRef.current.dist;
        pinchRef.current = { dist, scale: cameraRef.current.scale };
        zoomAt(midX, midY, factor);
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    if (dx * dx + dy * dy > 16) drag.moved = true;
    commit({ ...cameraRef.current, x: drag.camX + dx, y: drag.camY + dy });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    dragRef.current = null;
    if (event.type === "pointercancel" || !drag || drag.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const site = hitSite(sx, sy);
    const cluster = clusters.current.find((c) => c.count > 1 && (Math.hypot(c.x - sx, c.y - sy) <= 18 || c.id === site?.id));
    if (cluster) {
      zoomAt(cluster.x, cluster.y, 2);
      return;
    }
    if (site) {
      onSelect(site.id);
      return;
    }
    const { lat, lon } = latLonFromScreen(sx, sy);
    if (lat <= -80 && lat >= -90) onPlace(lat, lon);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 24;
    if (event.key === "ArrowLeft") {
      commit({ ...cameraRef.current, x: cameraRef.current.x + step });
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === "ArrowRight") {
      commit({ ...cameraRef.current, x: cameraRef.current.x - step });
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === "ArrowUp") {
      commit({ ...cameraRef.current, y: cameraRef.current.y + step });
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === "ArrowDown") {
      commit({ ...cameraRef.current, y: cameraRef.current.y - step });
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === "+" || event.key === "=") {
      zoomAt(size.width / 2, size.height / 2, 1.2);
      event.preventDefault();
    } else if (event.key === "-" || event.key === "_") {
      zoomAt(size.width / 2, size.height / 2, 1 / 1.2);
      event.preventDefault();
    } else if (event.key === "0" || event.key === "Home") {
      resetView();
      event.preventDefault();
    }
  }

  return (
    <div className={expanded ? "map-expanded" : "space-y-2"}>
      <div
        ref={wrapRef}
        data-map-root
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={
          expanded
            ? "map-wrap"
            : "relative rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#0b5f8a]"
        }
        aria-label="South polar map. Drag to pan, scroll or pinch to zoom, arrow keys pan, plus and minus zoom. Click a marker to select it. Numbered markers group nearby sites; click to zoom, or choose an exact site in the Sites drawer. Click empty ground south of 80 degrees to place a custom point."
      >
        <canvas
          ref={canvasRef}
          className="w-full cursor-grab rounded-xl active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {expanded && imagery && (
          <div className="map-imagery-tools glass">
            <Button variant="ghost" type="button" aria-pressed={onlineNac} onClick={() => setOnlineNac(!onlineNac)}>
              {onlineNac ? (onlineNacLevel(catalog.map.scaleM / cameraRef.current.scale, imageryRef.current?.overview.sourcePixelM ?? 100, size) === null ? "NAC enabled · zoom in for detail" : "Online NAC on") : "Load online NAC"}
            </Button>
          </div>
        )}

      </div>
      {!expanded && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lightingOn}
                onChange={(event) => setLightingOn(event.target.checked)}
              />
              Lighting overlay
            </label>
            <span className="inline-flex items-center gap-1">
              <i className="inline-block h-3 w-4 rounded-sm bg-[#e6961e]" />{" "}
              Sunlit
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="inline-block h-3 w-4 rounded-sm bg-[#142448]" />{" "}
              Shadow
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Amber ground is in sunlight at this hour and blue ground is in
            shadow. The wash uses the nearest horizon cell, about 1° of latitude
            by 2° of longitude, not a shadow for every 40 m pixel.
          </p>
        </>
      )}
      {expanded && (
        <div className="map-credit">
          {imagery ? imageryStatus : "LOLA hillshade · NASA GSFC · 600 m/px"}
          {imagery && imageSampling ? ` · ${imageSampling}` : ""}
          {imagery ? " · Historical image illumination" : ""}
          {imagery && onlineNac ? (onlineNacLevel(catalog.map.scaleM / cameraRef.current.scale, imageryRef.current?.overview.sourcePixelM ?? 100, size) === null ? " · Online NAC waits for detail scale (100 m/px or finer)" : " · Moon Trek NAC online enabled (coverage varies)") : ""}
          {light ? " · Coarse hourly lighting wash" : ""}
          {imagery && onlineNac && tileError && " · Some online tiles unavailable; bundled imagery underneath"}
        </div>
      )}
    </div>
  );
}

export function fitPolarCamera(
  width: number,
  height: number,
  mapW: number,
  mapH: number,
  cover = false,
): Camera {
  // One scale preserves the stereographic projection. Cover crops finite edges;
  // the smaller embedded map keeps its complete overview.
  const scale = cover ? Math.max(width / mapW, height / mapH) : Math.min(width / mapW, height / mapH) * 0.96;
  return {
    scale,
    x: (width - mapW * scale) / 2,
    y: (height - mapH * scale) / 2,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 1737.4;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function intersects(a: Rect, b: Rect, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width > b.x - gap && a.y < b.y + b.height + gap && a.y + a.height > b.y - gap;
}

export function resizePolarCamera(camera: PolarCamera, before: { width: number; height: number }, after: { width: number; height: number }): PolarCamera {
  return { ...camera, x: camera.x + (after.width - before.width) / 2, y: camera.y + (after.height - before.height) / 2 };
}

export function polarImageToScreen(point: { x: number; y: number }, camera: PolarCamera) {
  return { x: camera.x + point.x * camera.scale, y: camera.y + point.y * camera.scale };
}

export function polarScreenToImage(point: { x: number; y: number }, camera: PolarCamera) {
  return { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
}
