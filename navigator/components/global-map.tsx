"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Site } from "@/lib/catalog";
import type {} from "@/lib/nasa-model";
import type {} from "@/lib/imagery";
import {
  MAX_MAP_ZOOM, OVERVIEW_CAMERA, clusterMapPins, constrainMapCamera, focusMapCamera,
  latLonToMap, mapToScreen, mapWorldWidth, panMapCamera, placeMapLabel,
  screenToLatLon, wrapLongitude, zoomMapCamera,
  type MapCamera, type MapCluster, type MapLabelBox, type MapPoint, type MapSize,
} from "@/lib/global-map";
import styles from "./global-map.module.css";
import {neutralLunarBitmap, LUNAR_ATLAS_POLICY} from "@/lib/lunar-appearance";

export type Props = {
  sites: Site[];
  selectedId: string | null;
  compareIds: string[];
  custom: { lat: number; lon: number } | null;
  onSelect: (id: string) => void;
  onPlace: (lat: number, lon: number) => void;
};

type Texture = { image: HTMLImageElement; nasa: boolean };
type Label = MapLabelBox & { text: string; selected: boolean; ids: string[] };
type Gesture = { start: MapPoint; last: MapPoint; distance: number; moved: boolean };

function coordinates(lat: number, lon: number) {
  const east = wrapLongitude(lon);
  return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? "S" : "N"} · ${Math.abs(east).toFixed(2)}°${east < 0 ? "W" : "E"}`;
}

export function GlobalMap({ sites, selectedId, compareIds, custom, onSelect, onPlace }: Props) {
  const [showCaption,setShowCaption]=useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDetailsElement>(null);
  const cameraRef = useRef<MapCamera>(OVERVIEW_CAMERA);
  const pointers = useRef(new Map<number, MapPoint>());
  const gesture = useRef<Gesture | null>(null);
  const lastSelection = useRef<string | null>(null);
  const [camera, setCamera] = useState<MapCamera>(OVERVIEW_CAMERA);
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0 });
  const [texture, setTexture] = useState<Texture | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const descriptionId = useId();
  const selectionId = useId();
  const selected = sites.find((site) => site.id === selectedId);
  const location = custom ?? selected;
  const selectedName = custom ? "Custom location" : selected?.name;
  const validSites = useMemo(() => sites.filter((site) => Number.isFinite(site.lat) &&
    Math.abs(site.lat) <= 90 && Number.isFinite(site.lon)), [sites]);
  const byId = useMemo(() => new Map(validSites.map((site) => [site.id, site])), [validSites]);
  const compare = useMemo(() => new Set(compareIds), [compareIds]);

  const commit = useCallback((next: MapCamera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      const next = { width: bounds.width, height: bounds.height };
      setSize(next);
      commit(constrainMapCamera(cameraRef.current, next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [commit]);

  useEffect(() => {
    let disposed = false;
    let current: HTMLImageElement | null = null;
    const candidates = [
      { url: window.__SOLARREACH_NASA_MODEL__?.textureDataUrl ?? "/data/imagery/nasa-moon-8k.jpg", nasa: true },
      { url: window.__SOLARREACH_IMAGERY__?.global.url ?? "/data/imagery/global.jpg", nasa: false },
    ];
    function load(index: number) {
      if (disposed) return;
      const candidate = candidates[index];
      if (!candidate) { setImageFailed(true); return; }
      const image = new Image();
      current = image;
      image.onload = () => {
        if (disposed) return;
        if (!image.naturalWidth || !image.naturalHeight) { load(index + 1); return; }
        neutralLunarBitmap(image);
        setTexture({ image, nasa: candidate.nasa });
      };
      image.onerror = () => load(index + 1);
      image.src = candidate.url;
    }
    load(0);
    return () => {
      disposed = true;
      if (current) { current.onload = null; current.onerror = null; }
    };
  }, []);

  const locationLat = location?.lat;
  const locationLon = location?.lon;
  const selectionKey = location ? `${custom ? "custom" : selectedId}:${locationLat}:${locationLon}` : null;
  useEffect(() => {
    if (!size.width || !size.height || selectionKey === lastSelection.current) return;
    lastSelection.current = selectionKey;
    if (locationLat === undefined || locationLon === undefined) return;
    commit(focusMapCamera(cameraRef.current, size, locationLat, locationLon));
  }, [selectionKey, locationLat, locationLon, size, commit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      // Trackpads report small continuous deltas; mouse wheels often report lines.
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      const factor = Math.exp(-Math.max(-160, Math.min(160, delta)) * 0.003);
      commit(zoomMapCamera(cameraRef.current, size, factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    }
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [size, commit]);

  const visiblePins = useMemo(() => validSites.map((site) => ({
    ...mapToScreen(latLonToMap(site.lat, site.lon), camera, size),
    id: site.id,
    priority: site.id === selectedId || compare.has(site.id),
  })).filter((pin) => pin.x >= 0 && pin.y >= 0 && pin.x <= size.width && pin.y <= size.height),
  [validSites, camera, size, selectedId, compare]);
  const clusters = useMemo(() => clusterMapPins(visiblePins).sort((a, b) =>
    Number(a.ids.includes(selectedId ?? "")) - Number(b.ids.includes(selectedId ?? ""))), [visiblePins, selectedId]);
  const labelsRef = useRef<Label[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const frame = requestAnimationFrame(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.dataset.mapTransform = JSON.stringify({ ...camera, width: size.width, height: size.height, world: mapWorldWidth(size, camera.zoom) });
      canvas.dataset.lunarAppearance = LUNAR_ATLAS_POLICY.id;
      canvas.dataset.lunarAtlasReady = String(!!texture);
      canvas.width = Math.round(size.width * dpr);
      canvas.height = Math.round(size.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(canvas.width / size.width, 0, 0, canvas.height / size.height, 0, 0);
      drawSurface(ctx, size, camera, texture);
      const customPin = custom && mapToScreen(latLonToMap(custom.lat, custom.lon), camera, size);
      const occupied: MapLabelBox[] = clusters.map((c) => ({ x: c.x - 10, y: c.y - 10, width: 20, height: 20 }));
      // Reserve the corners occupied by controls, provenance and the visible-site list.
      occupied.push({ x: size.width - 62, y: 0, width: 62, height: 170 },
        { x: 0, y: size.height - 54, width: size.width, height: 54 });
      if (customPin) occupied.push({ x: customPin.x - 12, y: customPin.y - 12, width: 24, height: 24 });
      ctx.font = '500 12px "Avenir Next", "Segoe UI", sans-serif';
      const labels: Label[] = [];
      const order = [...clusters].sort((a, b) =>
        Number(b.ids.includes(selectedId ?? "")) - Number(a.ids.includes(selectedId ?? "")) ||
        Number(b.ids.includes(hover ?? "")) - Number(a.ids.includes(hover ?? "")) ||
        Number(b.priority) - Number(a.priority));
      for (const cluster of order) {
        const first = byId.get(cluster.ids[0]);
        if (!first) continue;
        const active = cluster.ids.includes(selectedId ?? "");
        const text = cluster.ids.length > 1 ? `${cluster.ids.length} sites · zoom to explore` : first.name;
        // Other site names remain available via the nearby DOM list at every zoom.
        if (cluster.ids.length > 1 && camera.zoom < 2 && !cluster.ids.includes(hover ?? "")) continue;
        const width = Math.min(size.width - 32, ctx.measureText(text).width + 18);
        const box = placeMapLabel(cluster, width, size, occupied);
        if (!box) continue;
        labels.push({ ...box, text, selected: active, ids: cluster.ids });
        occupied.push(box);
      }
      for (const cluster of clusters) drawPin(ctx, cluster, cluster.ids.includes(selectedId ?? ""), cluster.ids.some((id) => compare.has(id)));
      if (customPin) {
        ctx.strokeStyle = "#f6c979";
        ctx.lineWidth = 2;
        ctx.fillStyle = "#49331b";
        ctx.beginPath();
        ctx.moveTo(customPin.x, customPin.y - 9);
        ctx.lineTo(customPin.x + 9, customPin.y);
        ctx.lineTo(customPin.x, customPin.y + 9);
        ctx.lineTo(customPin.x - 9, customPin.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      for (const label of labels.reverse()) {
        ctx.fillStyle = label.selected ? "#f5d296" : "rgba(252,247,235,.94)";
        ctx.beginPath(); ctx.roundRect(label.x, label.y, label.width, label.height, 5); ctx.fill();
        ctx.fillStyle = "#302b24";
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.save();
        ctx.beginPath(); ctx.rect(label.x + 7, label.y, label.width - 14, label.height); ctx.clip();
        ctx.fillText(label.text, label.x + 9, label.y + label.height / 2);
        ctx.restore();
      }
      labelsRef.current = labels;
    });
    return () => cancelAnimationFrame(frame);
  }, [size, camera, texture, clusters, byId, custom, selectedId, compare, hover]);

  function pointerPosition(event: PointerEvent<HTMLCanvasElement>): MapPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function hitAt(point: MapPoint): MapCluster | undefined {
    // The selected pin is painted last and takes precedence in dense regions.
    const pin = [...clusters].reverse().find((c) => Math.hypot(c.x - point.x, c.y - point.y) <= (c.ids.length > 1 ? 21 : 15));
    if (pin) return pin;
    const label = labelsRef.current.find((l) => point.x >= l.x && point.x <= l.x + l.width && point.y >= l.y && point.y <= l.y + l.height);
    return label && clusters.find((c) => c.ids === label.ids);
  }

  function activate(point: MapPoint) {
    const hit = hitAt(point);
    if (hit) {
      if (hit.ids.length === 1) onSelect(hit.ids[0]);
      else if (cameraRef.current.zoom >= MAX_MAP_ZOOM) {
        if (listRef.current) {
          listRef.current.open = true;
          listRef.current.querySelector<HTMLButtonElement>("button")?.focus();
        }
      } else {
        const world = mapWorldWidth(size, cameraRef.current.zoom);
        commit(constrainMapCamera({
          x: cameraRef.current.x + (hit.x - size.width / 2) / world,
          y: cameraRef.current.y + (hit.y - size.height / 2) / world,
          zoom: Math.min(MAX_MAP_ZOOM, cameraRef.current.zoom * 2),
        }, size));
      }
    } else {
      const coordinate = screenToLatLon(point, cameraRef.current, size);
      if (coordinate) onPlace(coordinate.lat, coordinate.lon);
    }
  }

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    pointers.current.set(event.pointerId, point);
    const points = [...pointers.current.values()];
    const midpoint = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : point;
    gesture.current = { start: point, last: midpoint, distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0, moved: points.length > 1 };
  }

  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = pointerPosition(event);
    if (!pointers.current.has(event.pointerId) || !gesture.current) {
      setHover(hitAt(point)?.ids[0] ?? null);
      return;
    }
    pointers.current.set(event.pointerId, point);
    const points = [...pointers.current.values()];
    const mid = points.length > 1 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : point;
    const current = gesture.current;
    current.moved ||= Math.hypot(point.x - current.start.x, point.y - current.start.y) > 5;
    if (!current.moved) return;
    let next = panMapCamera(cameraRef.current, size, mid.x - current.last.x, mid.y - current.last.y);
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    if (distance && current.distance) next = zoomMapCamera(next, size, distance / current.distance, mid);
    current.last = mid; current.distance = distance;
    commit(next);
  }

  function pointerEnd(event: PointerEvent<HTMLCanvasElement>, cancelled = false) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = pointerPosition(event);
    const moved = gesture.current?.moved || (gesture.current && Math.hypot(point.x - gesture.current.start.x, point.y - gesture.current.start.y) > 5);
    const tap = !cancelled && !moved && pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const remaining = [...pointers.current.values()][0];
    gesture.current = remaining ? { start: remaining, last: remaining, distance: 0, moved: true } : null;
    if (tap) activate(point);
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    const step = event.shiftKey ? 120 : 48;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[event.key]) {
      event.preventDefault(); event.stopPropagation();
      commit(panMapCamera(cameraRef.current, size, ...moves[event.key]));
    } else if (["+", "=", "-", "Home", "0", "Enter", "[", "]"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === "Home" || event.key === "0") commit(OVERVIEW_CAMERA);
      else if (event.key === "Enter") {
        const point = screenToLatLon({ x: size.width / 2, y: size.height / 2 }, cameraRef.current, size);
        if (point) onPlace(point.lat, point.lon);
      } else if (event.key === "[" || event.key === "]") {
        const index = validSites.findIndex((site) => site.id === selectedId);
        const nextIndex = index < 0 ? (event.key === "]" ? 0 : validSites.length - 1) :
          (index + (event.key === "]" ? 1 : -1) + validSites.length) % validSites.length;
        const next = validSites[nextIndex];
        if (next) onSelect(next.id);
      } else zoom(event.key === "-" ? 1 / 1.4 : 1.4);
    }
  }

  function zoom(factor: number) {
    commit(zoomMapCamera(cameraRef.current, size, factor, { x: size.width / 2, y: size.height / 2 }));
  }

  return (
    <section className={styles.root} data-map-root aria-label="Whole-Moon map">
      <div ref={viewportRef} className={styles.viewport}>
        <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} role="img"
          aria-label={`Whole Moon, equirectangular map. ${validSites.length} catalog sites. ${selectedName ? `Selected: ${selectedName}.` : "No catalog site selected."}`}
          aria-describedby={`${descriptionId} ${selectionId}`}
          onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove}
          onPointerUp={(e) => pointerEnd(e)} onPointerCancel={(e) => pointerEnd(e, true)}
          onLostPointerCapture={(e) => pointerEnd(e, true)} onPointerLeave={() => setHover(null)} />
        <div className={styles.controls}>
          <Button variant="ghost" size="icon" aria-label="Map information" aria-expanded={showCaption} onClick={()=>setShowCaption(v=>!v)}><Info size={17}/></Button>
        </div>
        <details ref={listRef} data-global-sites hidden={!showCaption} className={styles.siteList}>
          <summary>Sites in view <span>{visiblePins.length}</span></summary>
          <ul aria-label="Sites visible on the map">
            {visiblePins.map((pin) => {
              const site = byId.get(pin.id)!;
              return <li key={pin.id}><Button variant="ghost" className={styles.siteButton}
                aria-pressed={!custom && site.id === selectedId} onClick={() => onSelect(site.id)}>
                <span>{site.name}{compare.has(site.id) ? " · comparing" : ""}</span>
                <small>{coordinates(site.lat, site.lon)}</small>
              </Button></li>;
            })}
            {!visiblePins.length && <li className={styles.emptyList}>No catalog sites in this view. Zoom out or reset to the whole Moon.</li>}
          </ul>
        </details>
        <div className={styles.credit}>{texture?.nasa ? "NASA Moon · original texture" : texture ? "LROC global mosaic" : imageFailed ? "Imagery unavailable · coordinates remain usable" : "Loading lunar imagery…"}</div>
      </div>
      <div data-map-caption hidden={!showCaption} className={styles.caption}><Button className={styles.captionClose} variant="ghost" size="icon" aria-label="Dismiss map information" onClick={()=>setShowCaption(false)}><X size={15}/></Button>
        <p id={selectionId} className={styles.selection}><strong>{selectedName ?? "Explore the whole Moon"}</strong>
          <span>{location ? coordinates(location.lat, location.lon) : "180°W → 180°E · 90°N → 90°S"}</span></p>
        <p className={styles.limit}>Neutral grayscale atlas preserves source shadows and resolution; it is visual context, not terrain heights or date-simulated illumination. Computed terrain illumination is unavailable outside the bundled south-polar coverage.</p>
        <details className={styles.help}><summary>Map controls</summary><p id={descriptionId}>Drag to pan. Scroll or pinch to zoom. Tap a pin to select; numbered pins zoom into a cluster. Tap bare surface to place a custom location. With the map focused: arrow keys pan, Shift moves farther, +/− zoom, Home resets, [ and ] select catalog sites, and Enter places a location at the map centre. Individual visible sites are also listed in “Sites in view”.</p></details>
      </div>
    </section>
  );
}

function drawSurface(ctx: CanvasRenderingContext2D, size: MapSize, camera: MapCamera, texture: Texture | null) {
  ctx.fillStyle = "#e5e0d3";
  ctx.fillRect(0, 0, size.width, size.height);
  const world = mapWorldWidth(size, camera.zoom);
  const x0 = size.width / 2 - camera.x * world;
  const y0 = size.height / 2 - camera.y * world;
  const first = world <= size.width ? 0 : Math.floor(-x0 / world);
  const last = world <= size.width ? 0 : Math.floor((size.width - x0) / world);
  const step = camera.zoom < 3 ? 30 : camera.zoom < 8 ? 10 : 5;
  for (let copy = first; copy <= last; copy++) {
    const left = x0 + copy * world;
    ctx.fillStyle = "#4e4b43";
    ctx.fillRect(left, y0, world, world / 2);
    if (texture) ctx.drawImage(neutralLunarBitmap(texture.image), left, y0, world, world / 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(left, y0, world, world / 2); ctx.clip();
    ctx.lineWidth = 0.7;
    ctx.font = '10px "Avenir Next", "Segoe UI", sans-serif';
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    for (let lon = -180; lon <= 180; lon += step) {
      const x = left + ((lon + 180) / 360) * world;
      if (x < 10 || x > size.width - 10) continue;
      ctx.strokeStyle = lon === 0 ? "rgba(255,245,218,.46)" : "rgba(255,245,218,.18)";
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + world / 2); ctx.stroke();
      const text = `${Math.abs(lon)}°${lon === 0 ? "" : lon < 0 ? "W" : "E"}`;
      const y = Math.max(12, y0 + 10);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(25,23,20,.8)"; ctx.strokeText(text, x, y);
      ctx.fillStyle = "#f6efdf"; ctx.fillText(text, x, y); ctx.lineWidth = 0.7;
    }
    for (let lat = -90 + step; lat < 90; lat += step) {
      const y = y0 + ((90 - lat) / 360) * world;
      if (y < 28 || y > size.height - 14) continue;
      ctx.strokeStyle = lat === 0 ? "rgba(255,245,218,.46)" : "rgba(255,245,218,.18)";
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + world, y); ctx.stroke();
      ctx.textAlign = "left";
      const text = `${Math.abs(lat)}°${lat === 0 ? "" : lat < 0 ? "S" : "N"}`;
      const x = Math.max(12, left + 10);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(25,23,20,.8)"; ctx.strokeText(text, x, y + 4);
      ctx.fillStyle = "#f6efdf"; ctx.fillText(text, x, y + 4); ctx.lineWidth = 0.7;
    }
    ctx.restore();
  }
}

function drawPin(ctx: CanvasRenderingContext2D, pin: MapCluster, selected: boolean, comparing: boolean) {
  const radius = pin.ids.length > 1 ? 15 : selected ? 8 : 5;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 5;
  if (selected || comparing) {
    ctx.beginPath(); ctx.arc(pin.x, pin.y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = selected ? "#f9cf82" : "#b6d4e4";
    ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(pin.x, pin.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = selected ? "#eeb356" : comparing ? "#345b71" : "#faf4e6";
  ctx.fill(); ctx.strokeStyle = "#302b24"; ctx.lineWidth = 1.5; ctx.stroke();
  if (pin.ids.length > 1) {
    ctx.shadowBlur = 0; ctx.fillStyle = "#302b24";
    ctx.font = '600 11px "Avenir Next", "Segoe UI", sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(pin.ids.length), pin.x, pin.y);
  }
  ctx.restore();
}
