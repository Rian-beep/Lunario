export type MapSize = { width: number; height: number };
export type MapPoint = { x: number; y: number };
export type MapCamera = { x: number; y: number; zoom: number };
export const OVERVIEW_CAMERA: MapCamera = { x: 0.5, y: 0.25, zoom: 1 };
export const MAX_MAP_ZOOM = 24;

export function clampFinite(value: number, min: number, max: number, fallback = min): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
}

export function wrapLongitude(lon: number): number {
  if (!Number.isFinite(lon)) return 0;
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

const wrapUnit = (x: number) => ((x % 1) + 1) % 1;

/** A world is one unit wide and half a unit high: no viewport stretching. */
export function latLonToMap(lat: number, lon: number): MapPoint {
  const wrapped = wrapLongitude(lon);
  return {
    x: wrapped === -180 && lon > 0 ? 1 : (wrapped + 180) / 360,
    y: (90 - clampFinite(lat, -90, 90, 0)) / 360,
  };
}

export function mapToLatLon(x: number, y: number): { lat: number; lon: number } {
  return {
    lat: 90 - clampFinite(y, 0, 0.5, 0.25) * 360,
    lon: wrapLongitude((Number.isFinite(x) ? x : 0.5) * 360 - 180),
  };
}

export function mapWorldWidth(size: MapSize, zoom = 1): number {
  const width = clampFinite(size.width, 1, 1e6);
  const height = clampFinite(size.height, 1, 1e6);
  return Math.max(1, Math.min(Math.max(1, width - 32), Math.max(1, height - 32) * 2)) *
    clampFinite(zoom, 1, MAX_MAP_ZOOM, 1);
}

export function constrainMapCamera(camera: MapCamera, size: MapSize): MapCamera {
  const zoom = clampFinite(camera.zoom, 1, MAX_MAP_ZOOM, 1);
  const world = mapWorldWidth(size, zoom);
  const width = clampFinite(size.width, 1, 1e6);
  // Keep polar pins clear of the canvas edge even at the vertical pan limits.
  const halfHeight = Math.max(1, clampFinite(size.height, 1, 1e6) - 32) / (2 * world);
  return {
    x: world <= width ? 0.5 : wrapUnit(Number.isFinite(camera.x) ? camera.x : 0.5),
    y: halfHeight >= 0.25 ? 0.25 : clampFinite(camera.y, halfHeight, 0.5 - halfHeight, 0.25),
    zoom,
  };
}

export function mapToScreen(point: MapPoint, camera: MapCamera, size: MapSize): MapPoint {
  const world = mapWorldWidth(size, camera.zoom);
  let dx = point.x - camera.x;
  if (world > size.width) dx -= Math.round(dx);
  return { x: size.width / 2 + dx * world, y: size.height / 2 + (point.y - camera.y) * world };
}

/** Letterbox margins are not lunar surface and must never create a custom site. */
export function screenToLatLon(point: MapPoint, camera: MapCamera, size: MapSize) {
  if (![point.x, point.y, size.width, size.height].every(Number.isFinite)) return null;
  if (point.x < 0 || point.y < 0 || point.x > size.width || point.y > size.height) return null;
  const world = mapWorldWidth(size, camera.zoom);
  const x = camera.x + (point.x - size.width / 2) / world;
  const y = camera.y + (point.y - size.height / 2) / world;
  const epsilon = 1e-12;
  if (y < -epsilon || y > 0.5 + epsilon || (world <= size.width && (x < -epsilon || x > 1 + epsilon))) return null;
  return mapToLatLon(x, y);
}

export function panMapCamera(camera: MapCamera, size: MapSize, dx: number, dy: number): MapCamera {
  const world = mapWorldWidth(size, camera.zoom);
  return constrainMapCamera({ ...camera, x: camera.x - dx / world, y: camera.y - dy / world }, size);
}

export function zoomMapCamera(camera: MapCamera, size: MapSize, factor: number, anchor: MapPoint): MapCamera {
  const oldWorld = mapWorldWidth(size, camera.zoom);
  const zoom = clampFinite(camera.zoom * factor, 1, MAX_MAP_ZOOM, camera.zoom);
  const newWorld = mapWorldWidth(size, zoom);
  return constrainMapCamera({
    x: camera.x + (anchor.x - size.width / 2) * (1 / oldWorld - 1 / newWorld),
    y: camera.y + (anchor.y - size.height / 2) * (1 / oldWorld - 1 / newWorld),
    zoom,
  }, size);
}

/** Nearby selections retain manual framing; a new region gets a useful closer view. */
export function focusMapCamera(camera: MapCamera, size: MapSize, lat: number, lon: number): MapCamera {
  const point = latLonToMap(lat, lon);
  const screen = mapToScreen(point, camera, size);
  if (camera.zoom >= 3 && screen.x > size.width * 0.18 && screen.x < size.width * 0.82 &&
      screen.y > size.height * 0.18 && screen.y < size.height * 0.82) return camera;
  return constrainMapCamera({ ...point, zoom: Math.max(3, camera.zoom) }, size);
}

export type MapPin = MapPoint & { id: string; priority?: boolean };
export type MapCluster = MapPoint & { ids: string[]; priority: boolean };

/** Screen-space clustering accepts every catalog group; priority pins remain individual. */
export function clusterMapPins(pins: MapPin[], radius = 28): MapCluster[] {
  const clusters: MapCluster[] = [];
  for (const pin of pins) {
    if (![pin.x, pin.y].every(Number.isFinite)) continue;
    const nearby = !pin.priority && clusters.find((c) => !c.priority && Math.hypot(c.x - pin.x, c.y - pin.y) < radius);
    if (nearby) {
      const n = nearby.ids.length;
      nearby.x = (nearby.x * n + pin.x) / (n + 1);
      nearby.y = (nearby.y * n + pin.y) / (n + 1);
      nearby.ids.push(pin.id);
    } else clusters.push({ x: pin.x, y: pin.y, ids: [pin.id], priority: !!pin.priority });
  }
  return clusters.sort((a, b) => Number(a.priority) - Number(b.priority));
}

export type MapLabelBox = MapPoint & { width: number; height: number };
export function labelOverlaps(a: MapLabelBox, b: MapLabelBox, gap = 4): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

/** Preferred right, left, above, below; selected labels should be processed first. */
export function placeMapLabel(pin: MapPoint, width: number, size: MapSize, occupied: MapLabelBox[]): MapLabelBox | null {
  const height = 24;
  const candidates = [
    { x: pin.x + 15, y: pin.y - height / 2 },
    { x: pin.x - width - 15, y: pin.y - height / 2 },
    { x: pin.x - width / 2, y: pin.y - height - 17 },
    { x: pin.x - width / 2, y: pin.y + 17 },
  ];
  for (const point of candidates) {
    const box = { ...point, width, height };
    if (box.x < 8 || box.y < 8 || box.x + width > size.width - 8 || box.y + height > size.height - 8) continue;
    if (!occupied.some((other) => labelOverlaps(box, other))) return box;
  }
  return null;
}
