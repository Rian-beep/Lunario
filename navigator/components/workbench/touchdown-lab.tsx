'use client';

import {Component, useEffect, useId, useRef, useState, type ReactNode} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ArrowDown, ChevronRight, Info, Pause, Play, RotateCcw, Settings2, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {LANDER_ASSET, disposeEquipment, loadLanderAsset} from '@/lib/equipment';
import {DEFAULT_TOUCHDOWN, createTouchdownSimulation, touchdownReleaseHeight, type TouchdownInputs, type TouchdownFrame} from '@/lib/touchdown-physics';
import {prepareTouchdownFragments} from '@/lib/touchdown-fragments';
import styles from './touchdown-lab.module.css';

type Props = {onClose: () => void};
type Simulation = Awaited<ReturnType<typeof createTouchdownSimulation>>;
type Draft = Record<keyof TouchdownInputs, string>;
type Run = {inputs: TouchdownInputs; serial: number; play: boolean};
type Phase = 'loading' | 'ready' | 'running' | 'paused' | 'contact' | 'broken' | 'ended' | 'error';
const FIXED_STEP = 1 / 120;
const MAX_STEPS = 12;
const MAX_TIME_S = 60;
const FIELDS: {key: keyof TouchdownInputs; label: string; unit: string; min: number; max: number; step: number; hint: string}[] = [
  {key: 'massKg', label: 'Vehicle mass', unit: 'kg', min: 1, max: 100000, step: 100, hint: 'Assumed rigid-body mass. This is not a sourced Apollo vehicle configuration.'},
  {key: 'heightM', label: 'Release height', unit: 'm', min: 0, max: 100, step: .5, hint: 'Initial clearance above the synthetic plane; no site terrain is sampled.'},
  {key: 'verticalSpeedMps', label: 'Descent speed', unit: 'm/s', min: 0, max: 50, step: .1, hint: 'Positive downward at release. The drop has no thrust or guidance.'},
  {key: 'horizontalSpeedMps', label: 'Sideways speed', unit: 'm/s', min: 0, max: 50, step: .1, hint: 'Initial velocity along the scene’s horizontal X axis.'},
  {key: 'tiltDeg', label: 'Vehicle tilt', unit: '°', min: -60, max: 60, step: 1, hint: 'Initial rotation from upright. This is an assumed initial attitude.'},
  {key: 'slopeDeg', label: 'Plane slope', unit: '°', min: -30, max: 30, step: 1, hint: 'A synthetic inclined plane, not a measured lunar landing surface.'},
  {key: 'friction', label: 'Friction coefficient', unit: '1', min: 0, max: 2, step: .05, hint: 'Dimensionless contact assumption (μ); not a measured regolith or footpad material.'},
  {key: 'restitution', label: 'Restitution', unit: '1', min: 0, max: 1, step: .05, hint: 'Dimensionless bounce assumption (e): zero is inelastic; one is ideal elastic contact.'},
  {key: 'failureEnergyJ', label: 'Breakup threshold', unit: 'J', min: 0, max: 1000000000, step: 1000, hint: 'Incoming translational kinetic energy at contact, including sideways motion. Zero breaks on contact. Not absorbed energy, NASA fracture strength or a vehicle limit.'},
];
const CASES = [
  {name: 'Gentle', detail: 'Low descent speed', values: {heightM: 2, verticalSpeedMps: .5, horizontalSpeedMps: 0, tiltDeg: 0, slopeDeg: 0}},
  {name: 'Hard', detail: 'Higher impact energy', values: {heightM: 8, verticalSpeedMps: 8, horizontalSpeedMps: 2, tiltDeg: 0, slopeDeg: 0}},
  {name: 'Tilted', detail: 'Oblique contact', values: {heightM: 3, verticalSpeedMps: 2, horizontalSpeedMps: 1, tiltDeg: 20, slopeDeg: 10}},
] as const;
const toDraft = (inputs: TouchdownInputs): Draft => Object.fromEntries(FIELDS.map(({key}) => [key, String(inputs[key])])) as Draft;
function parseDraft(draft: Draft): {inputs: TouchdownInputs; error?: never} | {error: string; inputs?: never} {
  const inputs = {...DEFAULT_TOUCHDOWN};
  for (const field of FIELDS) {
    const value = draft[field.key].trim() === '' ? NaN : Number(draft[field.key]);
    if (!Number.isFinite(value) || value < field.min || value > field.max) return {error: `${field.label}: enter ${field.min}–${field.max} ${field.unit}.`};
    inputs[field.key] = value;
  }
  return {inputs};
}
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'The touchdown workspace could not start.';

class TouchdownBoundary extends Component<Props & {children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (this.state.failed) return <section className={styles.fallback} role="alert"><h2>Touchdown lab unavailable</h2><p>Close the lab and reopen it to retry. Your planning inputs are separate from this experiment.</p><Button autoFocus onClick={this.props.onClose}>Close lab</Button></section>;
    return this.props.children;
  }
}

/** A separate synthetic experiment; this never changes a site's planning assessment. */
export function TouchdownLab({onClose}: Props) {
  return <TouchdownBoundary onClose={onClose}><TouchdownWorkspace onClose={onClose}/></TouchdownBoundary>;
}

function TouchdownWorkspace({onClose}: Props) {
  const id = useId();
  const host = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(() => toDraft(DEFAULT_TOUCHDOWN));
  const [run, setRun] = useState<Run>(() => ({inputs: {...DEFAULT_TOUCHDOWN}, serial: 0, play: false}));
  const [phase, setPhase] = useState<Phase>('loading'), [error, setError] = useState('');
  const [controlsOpen, setControlsOpen] = useState(true), [frame, setFrame] = useState<TouchdownFrame | null>(null);
  const [pieces, setPieces] = useState({bodies: 0, meshes: 0});
  const playing = useRef(false), cameraHome = useRef<(() => void) | null>(null);
  const parsed = parseDraft(draft);
  const dirty = FIELDS.some(({key}) => draft[key] !== String(run.inputs[key]));
  const phaseLabel: Record<Phase, string> = {loading: 'Preparing experiment', ready: 'Ready to release', running: 'Descending', paused: 'Paused', contact: 'Surface contact', broken: 'Illustrative breakup', ended: '60 s experiment complete', error: 'Experiment unavailable'};

  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const abort = new AbortController(), scene = new T.Scene(), landerRoot = new T.Group(), fragmentsRoot = new T.Group();
    scene.background = new T.Color(0x030506);
    scene.add(landerRoot, fragmentsRoot);
    let renderer: T.WebGLRenderer | undefined, controls: OrbitControls | undefined, observer: ResizeObserver | undefined;
    let simulation: Simulation | undefined, asset: T.Object3D | undefined, raf = 0, disposed = false;
    let previousTime = 0, accumulator = 0, lastReadout = 0, contact = false, broken = false;
    const looseGeometry: T.BufferGeometry[] = [], looseMaterials: T.Material[] = [];
    const fragmentObjects: T.Group[] = [];
    playing.current = false;
    setPhase('loading'); setError(''); setFrame(null); setPieces({bodies: 0, meshes: 0});

    const clean = () => {
      if (disposed) return;
      disposed = true; abort.abort(); cancelAnimationFrame(raf); playing.current = false;
      observer?.disconnect(); cameraHome.current = null;
      controls?.dispose(); simulation?.dispose();
      if (asset) disposeEquipment(asset);
      looseGeometry.forEach(geometry => geometry.dispose()); looseMaterials.forEach(material => material.dispose());
      if (renderer) {
        renderer.domElement.removeEventListener('keydown', onCameraKey);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      }
    };
    const fail = (cause: unknown) => { if (!disposed) { setError(message(cause)); setPhase('error'); clean(); } };
    const onContextLost = (event: Event) => { event.preventDefault(); fail(new Error('The 3D context was lost. Reset the experiment to retry.')); };
    const onCameraKey = (event: KeyboardEvent) => {
      if (!controls) return;
      if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); cameraHome.current?.(); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const camera = controls.object;
        if (['+', '=', '-', '_'].includes(event.key)) {
          const offset = camera.position.clone().sub(controls.target);
          const distance = T.MathUtils.clamp(offset.length() * (event.key === '+' || event.key === '=' ? .9 : 1.1), controls.minDistance, controls.maxDistance);
          camera.position.copy(controls.target).add(offset.setLength(distance));
        } else {
          const offset = new T.Vector3(event.key === 'ArrowLeft' ? -.7 : event.key === 'ArrowRight' ? .7 : 0, event.key === 'ArrowUp' ? .7 : event.key === 'ArrowDown' ? -.7 : 0, 0).applyQuaternion(camera.quaternion);
          controls.target.add(offset); camera.position.add(offset);
        }
        controls.update();
      }
    };

    try {
      renderer = new T.WebGLRenderer({antialias: true, alpha: false});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'NASA Lunar Module at nominal 7 metre height above a synthetic plane. Drag to orbit, scroll or plus and minus to zoom, right drag or arrow keys to pan, Home to reframe. Numerical motion is also shown as text.');
      renderer.domElement.addEventListener('keydown', onCameraKey);
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      element.append(renderer.domElement);
      const camera = new T.PerspectiveCamera(42, 1, .1, 20000);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false; controls.screenSpacePanning = true;
      controls.minDistance = 3; controls.maxDistance = 600;
      controls.maxPolarAngle = Math.PI * .49;
      landerRoot.position.set(0, run.inputs.heightM + LANDER_ASSET.displayHeightM / 2, 0);
      landerRoot.rotation.z = T.MathUtils.degToRad(run.inputs.tiltDeg);
      cameraHome.current = () => {
        if (!controls) return;
        const groundY = landerRoot.position.x * Math.tan(T.MathUtils.degToRad(run.inputs.slopeDeg));
        const height = Math.max(LANDER_ASSET.displayHeightM, landerRoot.position.y - groundY + LANDER_ASSET.displayHeightM / 2);
        const halfFov = Math.min(T.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
        const distance = Math.max(19, height * .65 / Math.sin(halfFov));
        controls.target.set(landerRoot.position.x, groundY + height * .45, landerRoot.position.z);
        camera.position.copy(controls.target).add(new T.Vector3(.9, .45, 1.3).normalize().multiplyScalar(distance));
        camera.lookAt(controls.target); controls.update();
      };
      scene.add(new T.HemisphereLight(0xc8e0ee, 0x5a4a32, 1.6));
      const key = new T.DirectionalLight(0xffefd6, 4.2);
      key.position.set(-18, 35, 22); key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = key.shadow.camera.bottom = -35;
      key.shadow.camera.right = key.shadow.camera.top = 35; key.shadow.camera.far = 180; key.shadow.normalBias = .035;
      scene.add(key);
      const rim = new T.DirectionalLight(0x9dcbe0, 2.4); rim.position.set(15, 12, -20); scene.add(rim);
      const groundGeometry = new T.PlaneGeometry(20000, 20000), groundMaterial = new T.MeshStandardMaterial({color: 0x24292a, roughness: .96, metalness: 0});
      looseGeometry.push(groundGeometry); looseMaterials.push(groundMaterial);
      const plane = new T.Group(), ground = new T.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      plane.add(ground); plane.rotation.z = T.MathUtils.degToRad(run.inputs.slopeDeg); scene.add(plane);
      const grid = new T.GridHelper(100, 50, 0x667478, 0x3b4549); grid.position.y = .012;
      looseGeometry.push(grid.geometry); looseMaterials.push(...(Array.isArray(grid.material) ? grid.material : [grid.material])); plane.add(grid);
      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
        renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize); observer.observe(element); resize(); cameraHome.current();
      const applyFrame = (next: TouchdownFrame) => {
        landerRoot.position.fromArray(next.position); landerRoot.quaternion.fromArray(next.rotation);
        landerRoot.visible = !next.broken;
        next.fragments.forEach((fragment, index) => {
          const group = fragmentObjects[index];
          if (group) { group.visible = true; group.position.fromArray(fragment.position); group.quaternion.fromArray(fragment.rotation); group.userData.massKg = fragment.massKg; }
        });
        if (next.broken && !broken) setPhase('broken');
        else if (!next.broken && next.contact !== contact) setPhase(next.contact ? 'contact' : 'running');
        contact = next.contact; broken = next.broken;
      };
      let assetReady = false;
      const prepare = async () => {
        const model = await loadLanderAsset(abort.signal);
        if (disposed) { disposeEquipment(model); return; }
        // Centre the fixed 7 m asset without rescaling it or its camera model.
        asset = model; model.position.y = -LANDER_ASSET.displayHeightM / 2;
        const prepared = await prepareTouchdownFragments(model, abort.signal);
        if (disposed) return;
        fragmentObjects.push(...prepared.objects); fragmentsRoot.add(...prepared.objects);
        landerRoot.position.y = touchdownReleaseHeight(run.inputs, prepared.descriptors);
        landerRoot.add(model); assetReady = true; cameraHome.current?.();
        setPieces({bodies: prepared.descriptors.length, meshes: prepared.sourceMeshCount});
        const result = await createTouchdownSimulation(run.inputs, prepared.descriptors);
        if (disposed) { result.dispose(); return; }
        simulation = result;
      };
      void prepare().then(() => {
        if (disposed) return;
        playing.current = run.play; setPhase(run.play ? 'running' : 'ready');
      }).catch(fail);
      const render = (now: number) => {
        if (disposed) return;
        try {
          const elapsed = previousTime ? Math.min((now - previousTime) / 1000, MAX_STEPS * FIXED_STEP) : 0;
          previousTime = now;
          if (playing.current && simulation && assetReady) {
            accumulator = Math.min(accumulator + elapsed, MAX_STEPS * FIXED_STEP);
            let next: TouchdownFrame | undefined, steps = 0;
            while (accumulator >= FIXED_STEP && steps < MAX_STEPS) {
              next = simulation.step(); accumulator -= FIXED_STEP; steps++;
              applyFrame(next);
              if (next.timeS >= MAX_TIME_S) { playing.current = false; setPhase('ended'); break; }
            }
            if (next && (now - lastReadout >= 100 || !playing.current)) { setFrame(next); lastReadout = now; }
          } else accumulator = 0;
          controls?.update(); renderer?.render(scene, camera);
          raf = requestAnimationFrame(render);
        } catch (cause) { fail(cause); }
      };
      raf = requestAnimationFrame(render);
    } catch (cause) { fail(cause); }
    return clean;
  }, [run]);

  function apply(play: boolean) {
    const result = parseDraft(draft);
    if (!result.inputs) { setError(result.error); return; }
    playing.current = false;
    setRun(current => ({inputs: result.inputs, serial: current.serial + 1, play}));
  }
  function togglePause() {
    playing.current = !playing.current;
    setPhase(playing.current ? (frame?.broken ? 'broken' : frame?.contact ? 'contact' : 'running') : 'paused');
  }
  const canPause = !['loading', 'ready', 'error', 'ended'].includes(phase);
  const speed = frame ? Math.hypot(...frame.velocity) : Math.hypot(run.inputs.verticalSpeedMps, run.inputs.horizontalSpeedMps);
  return <section className={styles.workspace} aria-labelledby={`${id}-title`} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header className={styles.header}>
      <div className={styles.identity}><span className={styles.mark}><ArrowDown size={18}/></span><div><p className={styles.eyebrow}>Lunario / synthetic experiment</p><h2 id={`${id}-title`}>Touchdown lab</h2></div></div>
      <div className={styles.headerActions}><Button variant="ghost" aria-expanded={controlsOpen} aria-controls={`${id}-controls`} onClick={() => setControlsOpen(value => !value)}><Settings2/>{controlsOpen ? 'Hide controls' : 'Show controls'}</Button><Button ref={close} variant="outline" onClick={onClose} aria-label="Close touchdown lab"><X/>Close</Button></div>
    </header>
    <div className={styles.body} data-controls={controlsOpen}>
      <div className={styles.stage}>
        <div ref={host} className={styles.canvas}/>
        <div className={styles.sceneCaption}><span className={styles.kicker}>NASA Apollo Lunar Module</span><p>Rigid-body touchdown</p><small>Nominal 7 m mesh · approximate box contacts</small></div>
        <div className={styles.sceneTools}><Button variant="outline" size="sm" onClick={() => cameraHome.current?.()}><RotateCcw/>Reframe</Button></div>
        {phase === 'loading' && <div className={styles.loading} role="status"><span/>Loading NASA geometry & physics…</div>}
        {phase === 'error' && <div className={styles.sceneError} role="alert"><h3>Experiment unavailable</h3><p>{error}</p><Button onClick={() => apply(false)} disabled={!!parsed.error}>Reset and retry</Button></div>}
        <div className={styles.sceneFooter}><span>Synthetic plane <b>2 m grid</b></span><span>Orbit: drag · Zoom: scroll / + − · Pan: right-drag / arrows · Home: reframe</span></div>
      </div>
      <aside id={`${id}-controls`} className={styles.controls} hidden={!controlsOpen} aria-label="Touchdown experiment controls">
        <div className={styles.controlHeading}><div><p className={styles.eyebrow}>Release conditions</p><h3>Try a landing.</h3></div><Button variant="ghost" size="icon" aria-label="Hide experiment controls" onClick={() => setControlsOpen(false)}><X/></Button></div>
        <p className={styles.intro}>Change the assumptions, then release the lander onto an ideal plane.</p>
        <div className={styles.cases} aria-label="Example release conditions">{CASES.map(preset => <Button key={preset.name} variant="outline" title={`${preset.detail}. Illustrative inputs, not mission cases.`} onClick={() => setDraft(toDraft({...DEFAULT_TOUCHDOWN, ...preset.values}))}>{preset.name}<ChevronRight size={12}/></Button>)}</div>
        <p className={styles.caseNote}>Examples are illustrative, not Apollo mission data.</p>
        <div className={styles.fields}>{FIELDS.map(field => <div key={field.key} className={styles.field}>
          <div className={styles.fieldLabel}><label htmlFor={`${id}-${field.key}`}>{field.label}</label><span className={styles.help}><Button variant="ghost" size="icon-xs" aria-label={`About ${field.label.toLowerCase()}`} aria-describedby={`${id}-hint-${field.key}`}><Info size={12}/></Button><span role="tooltip" id={`${id}-hint-${field.key}`}>{field.hint}</span></span></div>
          <div className={styles.inputWrap}><Input id={`${id}-${field.key}`} type="number" aria-label={`${field.label} (${field.unit})`} aria-describedby={`${id}-hint-${field.key}`} value={draft[field.key]} min={field.min} max={field.max} step={field.step} aria-invalid={draft[field.key].trim() === '' || !Number.isFinite(Number(draft[field.key])) || Number(draft[field.key]) < field.min || Number(draft[field.key]) > field.max} onChange={event => setDraft(current => ({...current, [field.key]: event.target.value}))}/><span>{field.unit}</span></div>
        </div>)}</div>
        <p className={styles.pending}>{parsed.error ?? (dirty ? 'Changes pending. Run or Reset applies these inputs.' : 'Inputs applied. Run starts a fresh experiment.')}</p>
        <div className={styles.runActions}><Button className={styles.runButton} onClick={() => apply(true)} disabled={!!parsed.error || phase === 'loading'}><Play size={15}/>Run</Button><Button variant="outline" onClick={() => apply(false)} disabled={!!parsed.error}><RotateCcw size={14}/>Reset</Button><Button variant="outline" onClick={togglePause} disabled={!canPause}>{phase === 'paused' ? <Play size={14}/> : <Pause size={14}/>} {phase === 'paused' ? 'Resume' : 'Pause'}</Button></div>
        <div className={styles.readout}><p className={styles.phase} role="status" aria-live="polite"><span data-phase={phase}/>{phaseLabel[phase]}</p><dl><div><dt>Elapsed</dt><dd>{(frame?.timeS ?? 0).toFixed(2)} <small>s</small></dd></div><div><dt>Speed</dt><dd>{speed.toFixed(2)} <small>m/s</small></dd></div><div><dt>Contact</dt><dd>{frame?.contact ? 'Yes' : 'No'}</dd></div><div><dt>Fragments</dt><dd>{frame?.fragments.length ?? 0}</dd></div></dl></div>
        <details className={styles.notes}><summary>Model & physics notes</summary><p>Generic experimental rigid-body physics, not a vehicle-qualified simulation. SI units; +Y is up and sideways speed is +X. Positive slope rises toward +X; tilt rotates about +Z. No LOLA terrain, site qualification, thrust, guidance or validated landing-gear response. Input ranges are workspace operating bounds, not vehicle limits. Each run is limited to {MAX_TIME_S} model seconds.</p><p className={styles.equation}>K = ½m‖v‖² <span>·</span> J = ∫F dt <span>·</span> μ, e</p><p>The user-set threshold compares incoming translational kinetic energy K (joules) at new contact, including sideways speed; it is not absorbed energy or NASA fracture strength. Here m is total assumed mass in kg and v is centre-of-mass velocity in m/s. Zero breaks on contact. Rotational energy and fatigue are excluded. J denotes impulse in N·s, F is force in N and t is time in s; Rapier solves contact impulses. Friction μ and restitution e are dimensionless (unit 1).</p><p>Breakup detaches {pieces.bodies || 'up to 256'} rigid bodies carrying the original {pieces.meshes || 'decoded'} NASA mesh primitives and materials. Each box proxy follows decoded geometry bounds in the fixed 7 m frame; thin pieces have a minimum 3 cm proxy thickness. If the body cap is exceeded, nearby primitives share a body. Mass shares are proportional to padded bounding-box volumes, not CAD volumes or measured spacecraft properties; all assumed mass is retained. The pieces inherit solved point velocities and angular velocity without an explosion impulse. Detailed pieces contact the plane only; mutual piece collisions are omitted because decorative box proxies overlap. Reset restores the intact model.</p><p>Constant assumed lunar gravity: 1.62 m/s². Physics advances at 120 Hz. Geometry and disabled fragment bodies are prepared cooperatively before playback. Catch-up is capped at {MAX_STEPS} steps per display frame; long stalls slow model time rather than jump through contact. A 60 fps display is a target, not a measured guarantee. Inspection lighting is independent of solar illumination.</p><p>{LANDER_ASSET.scope} Source units and engineering dimensions are not independently validated. Collision boxes and geometry-based mass shares are approximate physical assumptions, not NASA fracture/material data.</p><a href={LANDER_ASSET.page} target="_blank" rel="noreferrer">NASA geometry · {LANDER_ASSET.credit}</a></details>
      </aside>
    </div>
    <footer className={styles.disclaimer}><Info size={13}/><span>A synthetic mechanics experiment. Results do not establish landing readiness or modify the site assessment.</span></footer>
  </section>;
}
