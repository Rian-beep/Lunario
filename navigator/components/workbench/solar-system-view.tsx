'use client';

import {useEffect, useRef, useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Button} from '@/components/ui/button';
import {GROUP_LABEL, type Catalog} from '@/lib/catalog';
import {formatUtc} from '@/lib/astro';
import {CELESTIAL_ASSETS, loadCelestialAsset} from '@/lib/celestial-assets';
import {DSN_STATIONS, DSN_SOURCES, DSN_GEOMETRY_STATUS, WGS84, stationEcefKm, dsnEarthUv, dsnEarthTextureUrl} from '@/lib/dsn';
import {BRIGHT_STARS, moonFixedStarDirection, type Star} from '@/lib/stars';
import {framingDistanceKm, lunarSiteDirection, moonFixedToNasa, sampleFocusFlight, solarClipPlanes, solarSystemState, type FocusFlight, type SolarBody, type SolarFocus} from '@/lib/solar-system';
import {createNasaGlobe} from './scene/nasa-globe';
import styles from './solar-system-view.module.css';

export type SolarSystemViewProps = {catalog: Catalog; timeIndex: number; onClose: () => void};
type Direction = 'N' | 'S' | 'E' | 'W';
type Request = {focus: SolarFocus; direction: Direction; station: number; site: string | null; serial: number};
const BODY_NAMES: Record<SolarBody, string> = {sun: 'Sun', earth: 'Earth', moon: 'Moon'};
const BODY_ORDER: SolarBody[] = ['sun', 'earth', 'moon'];
const CARDINAL: Record<Direction, readonly [number, number, number]> = {N: [0, 1, 0], S: [0, -1, 0], E: [0, 0, -1], W: [0, 0, 1]};
const longitude = (lon: number) => ((lon + 540) % 360) - 180;
const coordinates = (lat: number, lon: number) => `${Math.abs(lat).toFixed(5)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(longitude(lon)).toFixed(5)}°${longitude(lon) < 0 ? 'W' : 'E'}`;
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Unknown loading error';

/** Earth-fixed ECEF → display axes only. Never used as a celestial rotation. */
function stationPoint(station: Parameters<typeof stationEcefKm>[0]) {
  const [x, y, z] = stationEcefKm(station);
  return new T.Vector3(x, z, -y);
}

function registeredEarthGeometry() {
  const geometry = new T.SphereGeometry(1, 128, 64), positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const p = new T.Vector3().fromBufferAttribute(positions, i);
    const lat = Math.asin(T.MathUtils.clamp(p.y, -1, 1)) * 180 / Math.PI, lon = Math.atan2(-p.z, p.x) * 180 / Math.PI;
    const point = stationPoint({latitudeDeg: lat, longitudeEastDeg: lon, heightM: 0}), mapped = dsnEarthUv(lat, lon);
    positions.setXYZ(i, point.x, point.y, point.z);
    uv.setXY(i, uv.getX(i) > .999 && mapped.u < .001 ? 1 : mapped.u, mapped.v);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function SolarSystemView({catalog, timeIndex, onClose}: SolarSystemViewProps) {
  const host = useRef<HTMLDivElement>(null), markerLayer = useRef<HTMLDivElement>(null);
  const [request, setRequest] = useState<Request>({focus: 'system', direction: 'S', station: 0, site: null, serial: 0});
  const [details, setDetails] = useState(true), [status, setStatus] = useState('Loading original NASA models…');
  const [errors, setErrors] = useState<Record<string, string>>({}), [retry, setRetry] = useState(0);
  const live = useRef({timeIndex, request}); live.current = {timeIndex, request};
  const state = solarSystemState(catalog, timeIndex), selectedSite = catalog.sites.find(s => s.id === request.site);
  const station = DSN_STATIONS[request.station];
  function focus(focus: SolarFocus, extra: Partial<Request> = {}) {
    setRequest(old => ({...old, focus, site: null, ...extra, serial: old.serial + 1}));
  }

  useEffect(() => {
    const element = host.current, layer = markerLayer.current;
    if (!element || !layer) return;
    const abort = new AbortController(), disposers: Array<() => void> = [];
    let disposed = false, raf = 0, observer: ResizeObserver | undefined;
    let renderer: T.WebGLRenderer | undefined, controls: OrbitControls | undefined;
    let flight: FocusFlight | null = null, lastSerial = -1, lastEpoch = NaN, wasValid = false, lastFocus: SolarFocus | null = null;
    let origin = new T.Vector3(), moonAnnotationRadius = catalog.meta.moonRadiusM / 1000;
    const scene = new T.Scene(), roots = {sun: new T.Group(), earth: new T.Group(), moon: new T.Group()};
    const stationRoot = new T.Group(), sky = new T.Group();
    scene.add(...Object.values(roots), stationRoot, sky);
    const fail = (key: string, cause: unknown) => { if (!disposed) setErrors(old => ({...old, [key]: message(cause)})); };
    const clean = () => {
      if (disposed) return;
      disposed = true; abort.abort(); cancelAnimationFrame(raf); observer?.disconnect(); controls?.dispose();
      disposers.forEach(dispose => dispose()); renderer?.dispose(); renderer?.domElement.remove(); layer.replaceChildren();
    };
    try {
      setErrors({}); setStatus('Loading original NASA models…');
      renderer = new T.WebGLRenderer({antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance'});
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x050a10);
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
      element.append(renderer.domElement);
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'Sun, Earth and Moon at physical kilometre scale. Drag to orbit, scroll to zoom. Focus, cardinal direction and site controls provide keyboard navigation. Body and site markers are annotations.');
      const camera = new T.PerspectiveCamera(40, 1, 1, 1e9);
      camera.position.set(0, 0, 1e9);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false; controls.screenSpacePanning = true; controls.maxDistance = 3e9;
      const cancelFlight = () => { flight = null; };
      controls.addEventListener('start', cancelFlight);
      const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelFlight(); };
      const keySurface = element.parentElement ?? element;
      keySurface.addEventListener('keydown', keyDown);
      disposers.push(() => keySurface.removeEventListener('keydown', keyDown));
      scene.add(new T.AmbientLight(0xffffff, 2));
      const inspectionLight = new T.DirectionalLight(0xfff4de, 3); inspectionLight.position.set(1, 2, 3); scene.add(inspectionLight);
      const ready = new Set<string>();
      const loaded = (key: string) => {
        ready.add(key); element.dataset[`${key}Model`] = 'ready';
        setStatus(ready.size === 3 ? 'NASA Sun, Earth and Moon loaded. Physical scale retained.' : `NASA models loaded: ${[...ready].join(', ')}.`);
      };
      for (const kind of ['sun', 'earth'] as const) {
        loadCelestialAsset(kind, abort.signal).then(asset => {
          if (disposed) { asset.dispose(); return; }
          asset.group.scale.multiplyScalar(kind === 'sun' ? catalog.meta.sunRadiusKm : catalog.meta.earthRadiusKm);
          roots[kind].add(asset.group); disposers.push(asset.dispose); loaded(kind);
        }).catch(cause => fail(kind, cause));
      }
      createNasaGlobe(0, 0, catalog.meta.moonRadiusM / 1000, abort.signal).then(asset => {
        if (disposed) { asset.dispose(); return; }
        // Invert createNasaGlobe's 0°/0° east/up/−north transform and translation.
        asset.mesh.applyMatrix4(new T.Matrix4().set(0, 1, 0, catalog.meta.moonRadiusM / 1000, 0, 0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 1));
        asset.mesh.visible = true; roots.moon.add(asset.mesh); moonAnnotationRadius = asset.maxRadiusKm;
        disposers.push(asset.dispose); loaded('moon');
      }).catch(cause => fail('moon', cause));

      const earthGeometry = registeredEarthGeometry(), earthMaterial = new T.MeshBasicMaterial({color: 0xffffff});
      const coordinateEarth = new T.Mesh(earthGeometry, earthMaterial); coordinateEarth.visible = false; stationRoot.add(coordinateEarth);
      disposers.push(() => { earthGeometry.dispose(); earthMaterial.map?.dispose(); earthMaterial.dispose(); });
      try {
        new T.TextureLoader().load(dsnEarthTextureUrl(), texture => {
          if (disposed) { texture.dispose(); return; }
          texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping; texture.anisotropy = 4;
          earthMaterial.map = texture; earthMaterial.needsUpdate = true; coordinateEarth.visible = true; element.dataset.stationTexture = 'ready';
        }, undefined, () => fail('Earth-fixed map', new Error('NASA Blue Marble image unavailable. Use the published station coordinates below.')));
      } catch (cause) { fail('Earth-fixed map', cause); }

      const starGeometry = new T.BufferGeometry(), starPositions = new Float32Array(BRIGHT_STARS.length * 3);
      starGeometry.setAttribute('position', new T.BufferAttribute(starPositions, 3));
      const starMaterial = new T.PointsMaterial({color: 0xdbe3eb, size: 1.6, sizeAttenuation: false, depthTest: false, depthWrite: false, toneMapped: false});
      const stars = new T.Points(starGeometry, starMaterial); stars.frustumCulled = false; stars.renderOrder = -10; sky.add(stars);
      disposers.push(() => { starGeometry.dispose(); starMaterial.dispose(); });

      type Marker = {button: HTMLButtonElement; kind: SolarBody | 'site' | 'station'; index?: number};
      const markers: Marker[] = [];
      function marker(label: string, kind: Marker['kind'], action: () => void, index?: number) {
        const button = document.createElement('button'); button.type = 'button'; button.className = styles.marker;
        button.dataset.kind = kind; button.textContent = label; button.setAttribute('aria-label', label); button.hidden = true;
        button.addEventListener('click', action); layer!.append(button); markers.push({button, kind, index});
        disposers.push(() => button.removeEventListener('click', action));
      }
      BODY_ORDER.forEach(kind => marker(`${BODY_NAMES[kind]} ↗`, kind, () => setRequest(old => ({...old, focus: kind, site: null, serial: old.serial + 1}))));
      catalog.sites.forEach((site, index) => marker(site.name, 'site', () => setRequest(old => ({...old, focus: 'moon', site: site.id, serial: old.serial + 1})), index));
      DSN_STATIONS.forEach((s, index) => marker(`${s.name} · ${s.antenna}`, 'station', () => setRequest(old => ({...old, focus: 'stations', station: index, site: null, serial: old.serial + 1})), index));

      let width = 1, height = 1;
      const resize = () => {
        width = Math.max(1, element.clientWidth); height = Math.max(1, element.clientHeight);
        renderer!.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); lastSerial = -1;
      };
      observer = new ResizeObserver(resize); observer.observe(element); resize();
      const projected = new T.Vector3(), cameraDirection = new T.Vector3(), viewVector = new T.Vector3();
      const render = (now: number) => {
        if (disposed) return;
        const current = live.current, data = solarSystemState(catalog, current.timeIndex), r = current.request;
        const stations = r.focus === 'stations', valid = !!data;
        if (valid !== wasValid) { lastSerial = -1; wasValid = valid; }
        Object.values(roots).forEach(root => { root.visible = valid && !stations; });
        stationRoot.visible = stations; sky.visible = valid && !stations;
        element.dataset.focus = r.focus; element.dataset.frame = stations ? 'Earth-fixed inspection' : 'Moon-fixed display axes';
        if (!valid && !stations) {
          markers.forEach(m => { m.button.hidden = true; });
          renderer!.render(scene, camera); raf = requestAnimationFrame(render); return;
        }
        const body = r.focus === 'system' || r.focus === 'stations' ? null : data!.bodies[r.focus];
        const nextOrigin = new T.Vector3(...(stations ? [0, 0, 0] as const : body?.centreKm ?? data!.centreKm));
        const radius = stations ? WGS84.aKm : body?.radiusKm ?? data!.radiusKm;
        if (r.serial !== lastSerial) {
          // Preserve the physical camera on focus change, then animate in the new
          // floating frame. Time changes keep this focus origin attached to its body.
          camera.position.add(origin).sub(nextOrigin); controls!.target.add(origin).sub(nextOrigin);
          const site = r.site ? catalog.sites.find(s => s.id === r.site) : null;
          let direction = new T.Vector3(.15, .3, 1).normalize();
          if (stations) direction = stationPoint(DSN_STATIONS[r.station]).normalize();
          else if (r.focus === 'moon') direction = new T.Vector3(...(site ? lunarSiteDirection(site.lat, site.lon) : CARDINAL[r.direction])).normalize();
          const distance = framingDistanceKm(radius, camera.aspect);
          const toOffset = direction.multiplyScalar(distance).toArray() as [number, number, number];
          const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
          const travelKm = data && lastFocus !== r.focus ? framingDistanceKm(data.radiusKm, camera.aspect) * 1.3 : distance * 1.3;
          flight = {startMs: now, fromCamera: camera.position.toArray() as [number, number, number], fromTarget: controls!.target.toArray() as [number, number, number], toOffset, travelKm, reducedMotion};
          // Earth-fixed inspection has no qualified celestial attitude. Switching
          // coordinate systems is a cut, never an implied physical flight.
          const frameChanged = (lastFocus === 'stations') !== stations;
          if (lastSerial === -1 || frameChanged) { camera.position.fromArray(toOffset); controls!.target.set(0, 0, 0); flight = null; }
          lastSerial = r.serial; lastFocus = r.focus;
        }
        origin = nextOrigin;
        if (flight) {
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) flight.reducedMotion = true;
          const pose = sampleFocusFlight(flight, now); camera.position.fromArray(pose.camera); controls!.target.fromArray(pose.target);
          if (pose.complete) flight = null;
        }
        if (data) {
          BODY_ORDER.forEach(kind => roots[kind].position.set(...data.bodies[kind].centreKm).sub(origin));
          if (lastEpoch !== data.epochMs) {
            BRIGHT_STARS.forEach((star: Star, i: number) => starPositions.set(moonFixedToNasa(moonFixedStarDirection(star, data.epochMs)), i * 3));
            starGeometry.getAttribute('position').needsUpdate = true; lastEpoch = data.epochMs;
          }
          element.dataset.sunRangeKm = String(Math.hypot(...data.bodies.sun.centreKm));
          element.dataset.earthRangeKm = String(Math.hypot(...data.bodies.earth.centreKm));
        }
        // Do not let the destination's orbit limits clamp an in-flight pose.
        controls!.minDistance = !flight && controls!.target.length() < radius * .001 ? radius * 1.08 : .001;
        controls!.update();
        const bodies = stations ? [{centreKm: [0, 0, 0] as const, radiusKm: WGS84.aKm}] : Object.values(data!.bodies).map(b => ({...b, centreKm: new T.Vector3(...b.centreKm).sub(origin).toArray() as [number, number, number]}));
        const clip = solarClipPlanes(camera.position.toArray() as [number, number, number], bodies);
        camera.near = clip.near; camera.far = clip.far; camera.updateProjectionMatrix();
        sky.position.copy(camera.position); sky.scale.setScalar(camera.far * .8);
        camera.getWorldDirection(cameraDirection);
        for (const m of markers) {
          let point: T.Vector3 | null = null, surfaceCentre: T.Vector3 | null = null, labelOffset = 0;
          if (m.kind === 'station' && stations) { point = stationPoint(DSN_STATIONS[m.index!]); surfaceCentre = new T.Vector3(); }
          else if (m.kind === 'site' && !stations && r.focus === 'moon') {
            const site = catalog.sites[m.index!]; point = new T.Vector3(...lunarSiteDirection(site.lat, site.lon)).multiplyScalar(moonAnnotationRadius).sub(origin); surfaceCentre = roots.moon.position;
          } else if (m.kind !== 'site' && m.kind !== 'station' && !stations && data) {
            point = roots[m.kind].position.clone(); labelOffset = m.kind === 'earth' ? -18 : m.kind === 'moon' ? 18 : 0;
          }
          if (!point) { m.button.hidden = true; continue; }
          viewVector.copy(point).sub(camera.position);
          if (viewVector.dot(cameraDirection) <= 0) { m.button.hidden = true; continue; }
          if (surfaceCentre && point.clone().sub(surfaceCentre).dot(camera.position.clone().sub(point)) <= 0) { m.button.hidden = true; continue; }
          projected.copy(point).project(camera);
          const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
          const outside = x < 12 || x > width - 12 || y < 12 || y > height - 12;
          m.button.hidden = projected.z < -1 || projected.z > 1 || (outside && !!surfaceCentre);
          if (m.button.hidden) continue;
          m.button.style.left = `${Math.max(14, Math.min(width - 110, x))}px`;
          m.button.style.top = `${Math.max(12, Math.min(height - 44, y + labelOffset))}px`;
          m.button.dataset.offscreen = String(outside);
          m.button.setAttribute('aria-pressed', String(m.kind === 'site' ? catalog.sites[m.index!].id === r.site : m.kind === 'station' ? m.index === r.station : m.kind === r.focus));
          m.button.title = m.kind === 'site' ? `${catalog.sites[m.index!].name} · ${coordinates(catalog.sites[m.index!].lat, catalog.sites[m.index!].lon)} · ${GROUP_LABEL[catalog.sites[m.index!].group]}` : outside ? 'Outside the current view — select to focus' : 'Select to focus';
        }
        renderer!.render(scene, camera);
        element.dataset.animating = String(!!flight); element.dataset.nearKm = String(camera.near); element.dataset.farKm = String(camera.far);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);
    } catch (cause) { fail('Renderer', cause); clean(); }
    return clean;
  }, [catalog, retry]);

  return <section className={styles.view} aria-label="Sun, Earth and Moon explorer">
    <div ref={host} className={styles.canvas}/>
    <div ref={markerLayer} className={styles.markers}/>
    <header className={styles.toolbar}>
      <div><small>Lunario · celestial context</small><h2>One scale. Three worlds.</h2></div>
      <Button variant="outline" onClick={onClose}>Close view</Button>
    </header>
    <nav className={styles.focus} aria-label="Focus a celestial body">
      {(['system', 'sun', 'earth', 'moon'] as const).map(kind => <Button key={kind} variant="outline" aria-pressed={request.focus === kind} disabled={!state} onClick={() => focus(kind)}>{kind === 'system' ? 'Whole system' : BODY_NAMES[kind]}</Button>)}
      <Button variant="outline" aria-pressed={request.focus === 'stations'} onClick={() => focus('stations')}>Earth-fixed DSN</Button>
    </nav>
    {request.focus === 'moon' && <nav className={styles.cardinals} aria-label="Look at the Moon from a cardinal direction">
      {(['N', 'S', 'E', 'W'] as const).map(direction => <Button key={direction} variant="outline" aria-label={`View Moon from ${ {N: 'north', S: 'south', E: 'east', W: 'west'}[direction]}`} aria-pressed={!request.site && request.direction === direction} onClick={() => focus('moon', {direction})}>{direction}</Button>)}
    </nav>}
    {!details && <Button variant="outline" className={styles.restore} onClick={() => setDetails(true)}>Show context & sources</Button>}
    <aside className={styles.panel} hidden={!details}>
      <div className={styles.panelTitle}><h3>{request.focus === 'stations' ? 'Earth-fixed station inspection' : selectedSite?.name ?? (request.focus === 'system' ? 'Astronomical distance' : `${BODY_NAMES[request.focus]} focus`)}</h3><Button variant="ghost" size="sm" onClick={() => setDetails(false)} aria-label="Hide context and sources">Hide</Button></div>
      <p className={styles.epoch}>{state ? formatUtc(state.epochMs) : 'Selected epoch has no complete prepared celestial context.'}</p>
      {request.focus === 'stations' ? <>
        <p>This separate Earth-fixed view uses georeferenced NASA Blue Marble imagery and WGS84 coordinates. It has no orientation relative to the Moon or Sun.</p>
        <div className={styles.stationButtons}>{DSN_STATIONS.map((s, i) => <Button key={s.id} variant="outline" aria-pressed={request.station === i} onClick={() => focus('stations', {station: i})}>{s.name}</Button>)}</div>
        <p><strong>{station.name} · {station.antenna}</strong><br/>{station.country}<br/>{coordinates(station.latitudeDeg, station.longitudeEastDeg)}<br/>WGS84 height {station.heightM.toFixed(3)} m</p>
        <p>{DSN_GEOMETRY_STATUS.reason}</p>
        <a href={DSN_SOURCES.coordinates} target="_blank" rel="noreferrer">JPL 810-005 / 301 Rev O · Table 5</a>
      </> : <>
        <p>Bodies and centre distances share one kilometre scale. At system scale, Earth and Moon can be smaller than a pixel; their labelled markers remain selectable.</p>
        {state && <dl>{BODY_ORDER.map(kind => <div key={kind}><dt>{BODY_NAMES[kind]} radius</dt><dd>{state.bodies[kind].radiusKm.toLocaleString('en-GB', {maximumFractionDigits: 3})} km</dd></div>)}<div><dt>Moon–Earth centres</dt><dd>{Math.round(Math.hypot(...state.bodies.earth.centreKm)).toLocaleString('en-GB')} km</dd></div><div><dt>Moon–Sun centres</dt><dd>{Math.round(Math.hypot(...state.bodies.sun.centreKm)).toLocaleString('en-GB')} km</dd></div></dl>}
        {request.focus === 'moon' && <>
          <label className={styles.siteLabel} htmlFor="solar-system-site">Catalogue locations</label>
          <select id="solar-system-site" value={request.site ?? ''} onChange={e => focus('moon', {site: e.target.value || null})}><option value="">Choose a location…</option>{catalog.sites.map(site => <option key={site.id} value={site.id}>{site.name} · {GROUP_LABEL[site.group]}</option>)}</select>
          {selectedSite && <p><strong>{selectedSite.name}</strong><br/>{coordinates(selectedSite.lat, selectedSite.lon)}<br/>{GROUP_LABEL[selectedSite.group]}{selectedSite.mission?.approximate ? ' · approximate coordinates' : ''}<br/>{selectedSite.source}<br/><a href={selectedSite.sourceUrl} target="_blank" rel="noreferrer">Location source</a></p>}
          <p>Site pins are enlarged screen annotations at catalogue latitude/longitude. Reference, study, attempted and derived locations retain their source designations.</p>
        </>}
      </>}
      <details><summary>Frames, imagery & limits</summary>
        <p>Positions reuse the catalogue’s JPL-derived lunar-body directions and ranges. Solar range is inferred from the prepared angular solar radius. This is an instantaneous context view, not an orbital trajectory.</p>
        <p>Catalogue frame: {catalog.meta.frame}. Ephemeris: {catalog.meta.ephemeris}.</p>
        <p>NASA Moon axes: +X prime meridian, +Y north, −Z east. The star catalogue’s IAU Moon-fixed axes map as (x, y, z) → (x, z, −y). ME / PA / IAU frame equivalence remains unresolved. Stars are an approximate directional backdrop, without parallax or a claim of telescope pointing accuracy.</p>
        <p>Stars: HYG Database v4.1 by David Nash / Astronexus, derived subset by SolarReach contributors. Fixed-size point annotations; brightness is not simulated. Proper motion, aberration and light deflection are omitted.</p>
        <a href="https://github.com/astronexus/HYG-Database/blob/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/README.md" target="_blank" rel="noreferrer">HYG source & epoch</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Star subset licence: CC BY-SA 4.0</a><a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc" target="_blank" rel="noreferrer">NASA/JPL NAIF lunar orientation model</a>
        <p>Sun and Earth retain their authored NASA attitudes; no qualified Earth-rotation model is supplied. Inspection lighting and historical textures do not show selected-date weather or computed surface illumination. DSN pins appear only in the separate Earth-fixed view.</p>
        <a href={CELESTIAL_ASSETS.sun.page} target="_blank" rel="noreferrer">NASA Sun model</a><a href={CELESTIAL_ASSETS.earth.page} target="_blank" rel="noreferrer">NASA/JPL-Caltech Earth model</a><a href="https://svs.gsfc.nasa.gov/14959/" target="_blank" rel="noreferrer">NASA Moon geometry & imagery</a>
      </details>
      <p className={styles.status} role="status">{status}</p>
      {Object.keys(errors).length > 0 && <div role="alert">{Object.entries(errors).map(([key, error]) => <p key={key}>{key}: {error}</p>)}<Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry loading view</Button></div>}
    </aside>
    <p className={styles.hint}>Drag to orbit · scroll to zoom · drag or Escape cancels a focus flight. Labels are annotations.</p>
  </section>;
}
