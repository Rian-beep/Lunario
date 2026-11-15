"use client";
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AudienceContext, Info } from "./info";
import { GradientHelp } from "./gradient-help";
import type { GradientAxis } from "@/lib/chart-gradient";
import {
  chartLabels,
  formatChartValue,
  linePath,
  moveSample,
  nearestSample,
  numericDomain,
  resourcePoints,
  type ChartPoint,
} from "@/lib/charts";
import {
  indexToMs,
  poseAt,
  type SampleSeries,
  type TerrainChoice,
} from "@/lib/astro";
import type { Catalog } from "@/lib/catalog";
import type { FlightResult } from "@/lib/flight";
import type { MissionResult } from "@/lib/mission";

type Line = {
  name: string;
  color: string;
  dash?: string;
  shape?: "sun" | "earth";
  points: ChartPoint[];
  constant?: boolean;
  stepped?: boolean;
  gradientSource?: string;
};
type Marker = {
  x: number;
  y: number;
  name: string;
  color: string;
  shape: "sun" | "earth";
};
const SUN = "#ae7317",
  EARTH = "#376c82",
  TERRAIN = "#595e54";
const utc = (n: number) =>
  Number.isFinite(n)
    ? new Date(n).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : "Unknown time";

function Plot({
  title,
  xLabel,
  yLabel,
  yUnit,
  lines,
  note,
  time = false,
  xDomain,
  cursor,
  markers = [],
  onCursor,
  digits = 2,
  gradientAxis = "seconds",
  gradientSource,
  flightModel,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  yUnit: string;
  lines: Line[];
  note: string;
  time?: boolean;
  xDomain?: [number, number];
  cursor?: number;
  markers?: Marker[];
  onCursor?: (x: number) => void;
  digits?: number;
  gradientAxis?: GradientAxis;
  gradientSource: string;
  flightModel?: FlightResult;
}) {
  const host = useRef<HTMLDivElement>(null),
    id = useId();
  const [width, setWidth] = useState(500),
    [hover, setHover] = useState<number | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const resize = () => setWidth(Math.max(180, el.clientWidth));
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    return () => ro.disconnect();
  }, []);
  const samples = useMemo(
    () =>
      [
        ...new Set(
          lines
            .filter((l) => !l.constant)
            .flatMap((l) => l.points.map((p) => p.x))
            .filter(Number.isFinite),
        ),
      ].sort((a, b) => a - b),
    [lines],
  );
  const height = 260,
    left = 66,
    right = 18,
    top = 18,
    bottom = time ? 62 : 44,
    w = width - left - right,
    h = height - top - bottom;
  const xd: [number, number] =
    xDomain ??
    (samples.length
      ? [
          samples[0],
          Math.max(
            samples[0] + 1,
            samples[samples.length - 1],
            lines.reduce(
              (max, l) =>
                l.points.reduce(
                  (end, p) => Math.max(end, p.endX ?? -Infinity),
                  max,
                ),
              -Infinity,
            ),
          ),
        ]
      : [0, 1]);
  const yd = numericDomain([
    0,
    ...lines.flatMap((l) => l.points.map((p) => p.y)),
  ]);
  const x = (n: number) => left + ((n - xd[0]) / (xd[1] - xd[0] || 1)) * w;
  const y = (n: number) => top + ((yd[1] - n) / (yd[1] - yd[0])) * h;
  // A selected boundary can lie beyond the environmental clock’s last pose.
  const requested = hover ?? (onCursor ? selected ?? cursor : selected) ?? samples[0];
  const active = Number.isFinite(requested)
    ? Math.max(xd[0], Math.min(xd[1], requested))
    : samples[0];
  const pointFor = (line: Line) => nearestSample(line.points, active);
  const coordinate = (n: number) =>
    time
      ? utc(n)
      : formatChartValue(n, xLabel.includes("Azimuth") ? "°" : "s", 2);
  const readout = (line: Line, target = active) => {
    const p = nearestSample(line.points, target);
    return `${line.name}: ${p ? formatChartValue(p.y, yUnit, digits) : "Unknown"}${line.constant ? " (constant reference)" : p ? ` · ${time ? "at" : xLabel.includes("Azimuth") ? "azimuth" : "elapsed time"} ${coordinate(p.x)}${p.endX != null ? ` to ${coordinate(p.endX)} (interval)` : ""}${p.sampleIndex != null ? ` · stay sample ${p.sampleIndex + 1} (hourly)` : ""}` : ""}`;
  };
  const choose = (value: number, announce = false) => {
    setHover(null);
    setSelected(value);
    onCursor?.(value);
    if (announce)
      setAnnouncement(lines.map((line) => readout(line, value)).join(". "));
  };
  const pointerValue = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const value = Math.max(
      xd[0],
      Math.min(
        xd[1],
        xd[0] +
          ((((clientX - r.left) / r.width) * width - left) / w) *
            (xd[1] - xd[0]),
      ),
    );
    return (
      nearestSample(lines.find((l) => !l.constant)?.points ?? [], value)?.x ??
      value
    );
  };
  const tick = (n: number) =>
    n.toLocaleString("en-GB", { maximumSignificantDigits: 4 });
  const tickCount = time
    ? width < 260
      ? 1
      : width < 480
        ? 2
        : 3
    : width < 340
      ? 3
      : 5;
  return (
    <figure
      className="science-figure"
      ref={host}
      aria-labelledby={`${id}-title`}
      onBlur={(event) => {
        if (onCursor && !event.currentTarget.contains(event.relatedTarget)) {
          setSelected(null);
          setHover(null);
        }
      }}
    >
      <figcaption id={`${id}-title`}>{title}</figcaption>
      <div className="chart-axis-heading">
        <span>
          Vertical axis: {yLabel}
          {flightModel ? <FlightParameterInfo label={yLabel} flight={flightModel} /> : <Info label={yLabel} />}
        </span>
      </div>
      <div className="plot-area">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description ${id}-help`}
          tabIndex={samples.length ? 0 : undefined}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return;
            e.preventDefault();
            e.stopPropagation();
            choose(
              moveSample(samples, active, e.key, e.shiftKey ? 10 : 1),
              true,
            );
          }}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) =>
            setHover(pointerValue(e.clientX, e.currentTarget))
          }
          onClick={(e) =>
            choose(pointerValue(e.clientX, e.currentTarget), true)
          }
        >
          <desc id={`${id}-description`}>
            {xLabel} on the horizontal axis. {yLabel} on the vertical axis.{" "}
            {note} Values are available as text below the graph.
          </desc>
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x={left} y={top} width={w} height={h} />
            </clipPath>
          </defs>
          {Array.from(
            { length: 5 },
            (_, i) => yd[0] + ((yd[1] - yd[0]) * i) / 4,
          ).map((v, i) => (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                className="chart-gridline"
              />
              <text
                x={left - 8}
                y={y(v) + 4}
                textAnchor="end"
                className="chart-tick"
              >
                {tick(v)}
              </text>
            </g>
          ))}
          <line
            x1={left}
            x2={left}
            y1={top}
            y2={height - bottom}
            className="chart-axis"
          />
          <line
            x1={left}
            x2={width - right}
            y1={height - bottom}
            y2={height - bottom}
            className="chart-axis"
          />
          {Array.from({ length: tickCount }, (_, i) =>
            tickCount === 1
              ? (xd[0] + xd[1]) / 2
              : xd[0] + ((xd[1] - xd[0]) * i) / (tickCount - 1),
          ).map((v, i) => (
            <g key={i}>
              <line
                x1={x(v)}
                x2={x(v)}
                y1={height - bottom}
                y2={height - bottom + 5}
                className="chart-axis"
              />
              <text
                x={x(v)}
                y={height - bottom + 21}
                textAnchor={
                  tickCount === 1
                    ? "middle"
                    : i === 0
                      ? "start"
                      : i === tickCount - 1
                        ? "end"
                        : "middle"
                }
                className="chart-tick"
              >
                {time ? new Date(v).toISOString().slice(0, 10) : tick(v)}
              </text>
              {time && (
                <text
                  x={x(v)}
                  y={height - bottom + 39}
                  textAnchor={
                    tickCount === 1
                      ? "middle"
                      : i === 0
                        ? "start"
                        : i === tickCount - 1
                          ? "end"
                          : "middle"
                  }
                  className="chart-tick secondary"
                >
                  {new Date(v).toISOString().slice(11, 16)} UTC
                </text>
              )}
            </g>
          ))}
          <g clipPath={`url(#${id}-clip)`}>
            {lines.map((l) => (
              <path
                key={l.name}
                d={linePath(l.points, x, y, l.stepped)}
                stroke={l.color}
                strokeWidth={l.constant ? 1.5 : 2.2}
                strokeDasharray={l.dash}
                fill="none"
              />
            ))}
            {lines
              .filter((l) => !l.constant && !l.stepped)
              .flatMap((l) =>
                l.points
                  .filter(
                    (p, i, points) =>
                      Number.isFinite(p.x) &&
                      Number.isFinite(p.y) &&
                      !(
                        Number.isFinite(points[i - 1]?.x) &&
                        Number.isFinite(points[i - 1]?.y)
                      ) &&
                      !(
                        Number.isFinite(points[i + 1]?.x) &&
                        Number.isFinite(points[i + 1]?.y)
                      ),
                  )
                  .map((p, i) => (
                    <circle
                      key={`${l.name}-isolated-${i}`}
                      cx={x(p.x)}
                      cy={y(p.y)}
                      r={3}
                      fill={l.shape === "earth" ? "#fffdf7" : l.color}
                      stroke={l.color}
                      strokeWidth={1.5}
                    />
                  )),
              )}
            {Number.isFinite(active) && (
              <line
                aria-label="Mission time cursor"
                x1={x(cursor!==undefined?cursor:active)}
                x2={x(cursor!==undefined?cursor:active)}
                y1={top}
                y2={height - bottom}
                stroke="#565f57"
                strokeDasharray="3 4"
              />
            )}
            {lines
              .filter((l) => !l.constant)
              .map((l) => {
                const p = pointFor(l);
                return p && Number.isFinite(p.y) ? (
                  <circle
                    key={l.name}
                    cx={x(p.x)}
                    cy={y(p.y)}
                    r={l.shape === "earth" ? 4 : 3}
                    fill={l.shape === "earth" ? "#fffdf7" : l.color}
                    stroke={l.color}
                    strokeWidth={2}
                  />
                ) : null;
              })}
            {markers
              .filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y))
              .map((m) => (
                <g key={m.name}>
                  <circle
                    cx={x(m.x)}
                    cy={y(m.y)}
                    r={5}
                    fill={m.shape === "earth" ? "#fffdf7" : m.color}
                    stroke={m.color}
                    strokeWidth={2}
                  />
                  <text
                    x={Math.max(
                      left + 5,
                      Math.min(width - right - 80, x(m.x) + 9),
                    )}
                    y={Math.max(top + 12, y(m.y) - 9)}
                    className="chart-marker-label"
                  >
                    {m.name}
                  </text>
                </g>
              ))}
          </g>
        </svg>
      </div>
      <div className="chart-x-label">
        Horizontal axis: {xLabel}
        {flightModel ? <FlightParameterInfo label={xLabel} flight={flightModel} /> : <Info label={xLabel} />}
      </div>
      {time && (
        <p className="chart-note">
          UTC extent: {utc(xd[0])} to {utc(xd[1])}.
        </p>
      )}
      <div className="chart-legend">
        {lines.map((l) => (
          <span key={l.name}>
            <i
              aria-hidden="true"
              style={{
                borderColor: l.color,
                borderTopStyle: l.dash ? "dashed" : "solid",
              }}
            />
            {l.shape && (
              <span aria-hidden="true" style={{ color: l.color }}>
                {l.shape === "sun" ? "●" : "○"}
              </span>
            )}
            {l.name}
            {flightModel ? <FlightParameterInfo label={l.name} flight={flightModel} /> : <Info label={l.name} />}
          </span>
        ))}
      </div>
      <p id={`${id}-help`} className="chart-note">
        Hover or tap to inspect samples. Focus the graph and use ←/→; Shift
        moves 10 samples; Home/End select the first/last. Values are rounded for
        reading, not uncertainty bounds.
        {onCursor && " The cursor follows simulation time; sample values describe the point you inspect."}
      </p>
      <div className="chart-sample-controls">
        <Button
          size="sm"
          variant="outline"
          disabled={!samples.length || active <= samples[0]}
          onClick={() => choose(moveSample(samples, active, "ArrowLeft"), true)}
        >
          Previous sample<span className="sr-only"> in {title}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!samples.length || active >= samples[samples.length - 1]}
          onClick={() =>
            choose(moveSample(samples, active, "ArrowRight"), true)
          }
        >
          Next sample<span className="sr-only"> in {title}</span>
        </Button>
      </div>
      <div
        className="chart-sample-readout"
        aria-label={`${title} sample values`}
      >
        <strong>
          {samples.length ? "Sample values" : "No samples available"}
        </strong>
        <ul>
          {lines.map((l) => (
            <li key={l.name}>{readout(l)}</li>
          ))}
        </ul>
        {markers.length > 0 && (
          <p>
            Current display directions:{" "}
            {markers
              .map(
                (m) =>
                  `${m.name} · azimuth ${formatChartValue(m.x, "°")} · elevation ${formatChartValue(m.y, "°")}`,
              )
              .join("; ")}
            . Playback may interpolate these markers.
          </p>
        )}
      </div>
      <GradientHelp
        lines={lines}
        target={active}
        xLabel={xLabel}
        yLabel={yLabel}
        yUnit={yUnit}
        axis={time ? "time-ms" : gradientAxis}
        source={gradientSource}
      />
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      <p className="chart-note">{note}</p>
    </figure>
  );
}

export function HorizonGraph({
  series,
  terrain,
  cursor,
}: {
  series: SampleSeries;
  terrain: TerrainChoice;
  cursor: number;
}) {
  const audience = useContext(AudienceContext),
    label = chartLabels("horizon", audience),
    pose = poseAt(series, cursor);
  const lines = useMemo<Line[]>(() => {
    const track = (az: Float64Array, el: Float64Array) => {
      const out: ChartPoint[] = [];
      for (let i = 0; i < az.length; i++) {
        if (i && Math.abs(az[i] - az[i - 1]) > 180)
          out.push({ x: NaN, y: NaN });
        out.push({ x: az[i], y: el[i], sampleIndex: i });
      }
      return out;
    };
    return [
      {
        name: "LOLA terrain horizon",
        gradientSource: "native LOLA horizon-mask vertices; angular sampling, not a ground-distance profile",
        color: TERRAIN,
        points: [
          ...Array.from(terrain.mask, (y, i) => ({
            x: i * terrain.stepDeg,
            y,
          })),
          { x: 360, y: terrain.mask[0] },
        ],
      },
      {
        name: "Smooth-sphere horizon (0°)",
        gradientSource: "analytic constant 0° reference",
        color: "#81877b",
        dash: "4 5",
        constant: true,
        points: [
          { x: 0, y: 0 },
          { x: 360, y: 0 },
        ],
      },
      {
        name: "Sun centre track",
        color: SUN,
        shape: "sun",
        points: track(series.sunAz, series.sunEl),
      },
      {
        name: "Earth centre track",
        color: EARTH,
        shape: "earth",
        dash: "8 3",
        points: track(series.earthAz, series.earthEl),
      },
    ];
  }, [series, terrain]);
  return (
    <Plot
      title={
        audience === "public"
          ? "Where are the Sun and Earth?"
          : "Local horizon and body directions"
      }
      xLabel={label.x}
      yLabel={label.y}
      yUnit="°"
      gradientAxis="azimuth"
      gradientSource="JPL Horizons-derived hourly centre directions in source time order; not simultaneous directions"
      xDomain={[0, 360]}
      lines={lines}
      note={`${label.note} Native horizon spacing: ${terrain.stepDeg}°; observer height: ${terrain.heightM} m. ${!terrain.mask.some(Number.isFinite) ? "No numerical terrain horizon is available at this site; terrain results remain unknown." : terrain.exact ? "Site horizon mask." : "Horizon borrowed from the nearest precomputed cell; not measured at this coordinate."} Each track readout identifies its own hourly stay sample; nearest directions need not be from the same time.`}
      markers={[
        {
          x: pose.sunAz,
          y: pose.sunEl,
          name: "Sun now",
          color: SUN,
          shape: "sun",
        },
        {
          x: pose.earthAz,
          y: pose.earthEl,
          name: "Earth now",
          color: EARTH,
          shape: "earth",
        },
      ]}
    />
  );
}

export function ElevationGraph({
  catalog,
  series,
  cursor,
  onCursor,
}: {
  catalog: Catalog;
  series: SampleSeries;
  cursor: number;
  onCursor: (n: number) => void;
}) {
  const audience = useContext(AudienceContext),
    label = chartLabels("elevation", audience);
  const lines = useMemo<Line[]>(() => {
    const points = (a: Float64Array) =>
      Array.from(a, (y, i) => ({
        x: indexToMs(catalog, series.index0 + i),
        y,
      }));
    return [
      {
        name: "Sun centre",
        color: SUN,
        shape: "sun",
        points: points(series.sunEl),
      },
      {
        name: "Earth centre",
        color: EARTH,
        shape: "earth",
        dash: "8 3",
        points: points(series.earthEl),
      },
      {
        name: "LOLA horizon toward Sun",
        color: TERRAIN,
        dash: "2 4",
        points: points(series.sunHorizon),
      },
      {
        name: "LOLA horizon toward Earth",
        color: "#647d85",
        dash: "10 4 2 4",
        points: points(series.earthHorizon),
      },
      {
        name: "Smooth-sphere horizon (0°)",
        color: "#81877b",
        dash: "4 5",
        constant: true,
        points: [
          { x: indexToMs(catalog, series.index0), y: 0 },
          {
            x: indexToMs(
              catalog,
              series.index0 + Math.max(1, series.sunEl.length - 1),
            ),
            y: 0,
          },
        ],
      },
    ];
  }, [catalog, series]);
  return (
    <Plot
      title="Elevation over the surface stay"
      xLabel={label.x}
      yLabel={label.y}
      yUnit="°"
      gradientSource="plotted JPL Horizons-derived time samples and LOLA direction-sampled horizons; the sphere line is an analytic constant reference"
      note={label.note}
      time
      lines={lines}
      xDomain={[
        indexToMs(catalog, series.index0),
        indexToMs(
          catalog,
          series.index0 + Math.max(1, series.sunEl.length - 1),
        ),
      ]}
      cursor={indexToMs(catalog, series.index0 + cursor)}
      onCursor={(ms) =>
        onCursor(
          (ms - indexToMs(catalog, series.index0)) /
            (catalog.meta.stepHours * 3600000),
        )
      }
    />
  );
}

// Trusted authored MathML only; no result text is interpolated into HTML.
const INERTIAL_FLIGHT_TERMS = '<mfrac><mi>T</mi><mi>m</mi></mfrac><msub><mover><mi>u</mi><mo>^</mo></mover><mi>T</mi></msub><mo>−</mo><mfrac><mrow><mi>μ</mi><mover><mi>r</mi><mo>→</mo></mover></mrow><msup><mrow><mo>|</mo><mover><mi>r</mi><mo>→</mo></mover><mo>|</mo></mrow><mn>3</mn></msup></mfrac>';
const ROTATING_FLIGHT_TERMS = '<mo>−</mo><mn>2</mn><mover><mi>Ω</mi><mo>→</mo></mover><mo>×</mo><mover><mi>v</mi><mo>→</mo></mover><mo>−</mo><mover><mi>Ω</mi><mo>→</mo></mover><mo>×</mo><mo>(</mo><mover><mi>Ω</mi><mo>→</mo></mover><mo>×</mo><mover><mi>r</mi><mo>→</mo></mover><mo>)</mo>';
const INERTIAL_FLIGHT_MATH = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Nonrotating acceleration equals thrust acceleration minus central gravity"><mover><mi>a</mi><mo>→</mo></mover><mo>=</mo>'+INERTIAL_FLIGHT_TERMS+'</math>';
const ROTATING_FLIGHT_MATH = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Moon-fixed acceleration equals thrust acceleration minus central gravity minus Coriolis minus centrifugal acceleration"><mover><mi>a</mi><mo>→</mo></mover><mo>=</mo>'+INERTIAL_FLIGHT_TERMS+ROTATING_FLIGHT_TERMS+'</math>';
const MASS_FLOW_MATH = '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Mass rate equals negative commanded thrust divided by specific impulse times standard gravity"><mover><mi>m</mi><mo>˙</mo></mover><mo>=</mo><mo>−</mo><mfrac><mi>T</mi><mrow><msub><mi>I</mi><mtext>sp</mtext></msub><msub><mi>g</mi><mn>0</mn></msub></mrow></mfrac></math>';

/** The result's solver-authored model string is the frame authority until structured metadata is shared. */
export function FlightSolverDetails({flight}: {flight:FlightResult}) {
  const rotating = flight.model.includes("Moon-fixed east/up/north frame;");
  const configured = flight.landingOutcome !== undefined;
  return <div className="flight-solver-details" style={{fontSize:14,lineHeight:1.55}}>
    <p>{flight.model}</p>
    <span style={{display:'block',maxWidth:'100%',overflowX:'auto',fontFamily:'Cambria Math, STIX Two Math, math'}} dangerouslySetInnerHTML={{__html: rotating ? ROTATING_FLIGHT_MATH : INERTIAL_FLIGHT_MATH}} />
    <span style={{display:'block',maxWidth:'100%',overflowX:'auto',fontFamily:'Cambria Math, STIX Two Math, math'}} dangerouslySetInnerHTML={{__html: MASS_FLOW_MATH}} />
    <p>Position r is Moon-centred (m); v is velocity (m/s) and a is acceleration (m/s²) in the selected frame. μ is lunar GM (m³/s²); T is commanded thrust (N), m is current mass (kg), u with subscript T is its unit direction, I with subscript sp is specific impulse (s), and g₀ is standard gravity 9.80665 m/s². {rotating ? 'Ω is the constant lunar spin vector (rad/s); the two cross-product terms are Coriolis and centrifugal acceleration. Cross products here are physical vector products; in the left-handed east/up/north coordinates the solver negates the ordinary coordinate cross product. This is a rotating-frame derivative, not inertial acceleration.' : 'Lunar rotation is omitted from this frame.'}</p>
    <p>{configured ? 'Configured flight updates force commands at most 0.1 s apart, probes contact at most 0.025 s apart and retains states about 0.5 s apart plus terminal states. Dry-mass and burn-time boundaries can shorten steps.' : 'Legacy manual flight uses RK4 steps at most 0.25 s apart and retains states about 1 s apart plus terminal states.'} Sample spacing is not an error tolerance. T becomes zero after burn cutoff or propellant exhaustion. {flight.model.includes('target feedback') ? 'Assisted guidance selects direction and continuously variable throttle; the saved manual pitch schedule is inactive.' : 'Manual guidance uses the configured heading and linear pitch schedule at full thrust while powered.'}</p>
  </div>;
}

/** Reusable selected-model help for Root's parameter and telemetry surfaces. */
export function FlightParameterInfo({label,flight}: {label:string;flight:FlightResult}) {
  return <Info label={label} extra={`Selected flight solver: ${flight.model}`} />;
}

export function FlightGraphs({
  flight,
  cursor,
  onCursor,
}: {
  flight: FlightResult;
  cursor: number;
  onCursor: (n: number) => void;
}) {
  const audience = useContext(AudienceContext),
    label = chartLabels("flight", audience === "plan" ? "teach" : audience);
  const note = `${label.note} ${flight.model} Retained sample times are shown in the sample table; connecting lines add no temporal resolution. Display rounding is not an error bound.`;
  const domain: [number, number] = [
    0,
    Math.max(1, flight.points.at(-1)?.t ?? 0),
  ];
  const altitudeLines = useMemo<Line[]>(() => [
      {
        name: "Radial altitude (not terrain clearance)",
        color: TERRAIN,
        points: flight.points.map((p) => ({
          x: p.t,
          y: p.altitudeM / 1000,
        })),
      },
  ], [flight]);
  const speedLines = useMemo<Line[]>(() => [
      {
        name: "Total speed",
        color: EARTH,
        points: flight.points.map((p) => ({ x: p.t, y: p.speedMps })),
      },
      {
        name: "Radial speed (+up / −down)",
        color: TERRAIN,
        dash: "6 4",
        points: flight.points.map((p) => ({ x: p.t, y: p.verticalMps })),
      },
  ], [flight]);
  return (
    <>
      <details className="flight-model-explanation"><summary>Selected flight solver, frame and equations</summary><FlightSolverDetails flight={flight}/></details>
      <Plot
        title="Flight radial altitude"
        xLabel={label.x}
        yLabel={label.y}
        yUnit="km"
        gradientSource={`${flight.model} Radial distance above the reference sphere at the actual retained output times.`}
        flightModel={flight}
        digits={3}
        note={note}
        lines={altitudeLines}
        xDomain={domain}
        cursor={cursor}
        onCursor={onCursor}
      />
      <Plot
        title="Flight speed"
        xLabel={label.x}
        yLabel="Speed (m/s)"
        yUnit="m/s"
        gradientSource={`${flight.model} Total velocity magnitude and signed radial velocity at the actual retained output times.`}
        flightModel={flight}
        note={`${note} Total speed is the velocity magnitude; signed radial speed is positive outward and negative downward. Touchdown speed limits are vehicle-specific.`}
        lines={speedLines}
        xDomain={domain}
        cursor={cursor}
        onCursor={onCursor}
      />
    </>
  );
}

export function ResourceGraphs({
  catalog,
  series,
  result,
  reserveWh,
  sphereResult,
  cursor,
  onCursor,
}: {
  catalog: Catalog;
  series: SampleSeries;
  result: MissionResult;
  cursor?:number;
  onCursor?:(index:number)=>void;
  reserveWh: number;
  sphereResult?: MissionResult;
}) {
  const audience = useContext(AudienceContext),
    energy = chartLabels("power", audience),
    battery = chartLabels("battery", audience);
  const start = indexToMs(catalog, series.index0),
    end = indexToMs(catalog, series.index0 + result.timeline.length);
  const currentTime=cursor===undefined?undefined:indexToMs(catalog,series.index0+cursor);
  const scrub=onCursor?((ms:number)=>onCursor((ms-start)/(catalog.meta.stepHours*3600000))):undefined;
  const comparison = sphereResult
    ? ""
    : " Smooth-sphere resource curves were not supplied to this chart; see the paired summary metrics.";
  const powerLines = useMemo<Line[]>(() => {
    const points = (r: MissionResult, key: "powerW" | "batteryWh") =>
      resourcePoints(r.subsegments, key, start, catalog.meta.stepHours * 3600000, true);
    return [
      {
        name: "LOLA terrain · array output",
        color: SUN,
        stepped: true,
        points: points(result, "powerW"),
      },
      ...(sphereResult
        ? [
            {
              name: "Smooth sphere · array output",
              color: SUN,
              dash: "6 4",
              stepped: true,
              points: points(sphereResult, "powerW"),
            },
          ]
        : []),
    ];
  }, [result, sphereResult, start, catalog.meta.stepHours]);
  const batteryLines = useMemo<Line[]>(() => {
    const points = (r: MissionResult, key: "powerW" | "batteryWh") =>
      resourcePoints(r.subsegments, key, start, catalog.meta.stepHours * 3600000, true);
    return [
      {
        name: "LOLA terrain · stored energy",
        color: EARTH,
        points: points(result, "batteryWh"),
      },
      ...(sphereResult
        ? [
            {
              name: "Smooth sphere · stored energy",
              color: EARTH,
              dash: "6 4",
              points: points(sphereResult, "batteryWh"),
            },
          ]
        : []),
      {
        name: "Mission reserve",
        color: "#99663b",
        dash: "2 4",
        constant: true,
        points: [
          { x: start, y: reserveWh },
          { x: end, y: reserveWh },
        ],
      },
    ];
  }, [result, sphereResult, start, end, reserveWh, catalog.meta.stepHours]);
  return (
    <>
      <Plot
        title="Solar generation through the stay"
        xLabel={energy.x}
        yLabel={energy.y}
        yUnit="W"
        gradientSource="mission-model held generation intervals, split at configured operations; no sub-hour sunlight measurement"
        time
        note={energy.note + comparison}
        cursor={currentTime}
        onCursor={scrub}
        xDomain={[start, Math.max(start + 1, end)]}
        lines={powerLines}
      />
      <Plot
        title="Battery energy and reserve"
        xLabel={battery.x}
        yLabel={battery.y}
        yUnit="Wh"
        gradientSource="mission-model stored-energy states at interval boundaries; configured operations can split intervals; reserve is a constant requirement"
        time
        note={battery.note + comparison + " The final energy point is the end-of-stay boundary. Inspecting it keeps the Sun/Earth clock on its last supported sample."}
        cursor={currentTime}
        onCursor={scrub}
        xDomain={[start, Math.max(start + 1, end)]}
        lines={batteryLines}
      />
    </>
  );
}
