"use client";
import { useContext, useMemo } from "react";
import { AudienceContext } from "./info";
import { formatChartValue, type ChartPoint } from "@/lib/charts";
import { gradientUnits, indexGradient, sampleGradient, type GradientAxis } from "@/lib/chart-gradient";

// Static, trusted MathML keeps this help independent of the shared notation renderer.
const finiteMath = '<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="m equals delta y divided by delta x"><mi>m</mi><mo>=</mo><mfrac><mrow><mi>Δ</mi><mi>y</mi></mrow><mrow><mi>Δ</mi><mi>x</mi></mrow></mfrac></math>';
const derivativeMath = '<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="d y over d x equals the limit of delta y over delta x as delta x approaches zero"><mfrac><mrow><mi>d</mi><mi>y</mi></mrow><mrow><mi>d</mi><mi>x</mi></mrow></mfrac><mo>=</mo><munder><mo>lim</mo><mrow><mi>Δ</mi><mi>x</mi><mo>→</mo><mn>0</mn></mrow></munder><mfrac><mrow><mi>Δ</mi><mi>y</mi></mrow><mrow><mi>Δ</mi><mi>x</mi></mrow></mfrac></math>';
const terrainMath = '<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="theta equals arctangent of the magnitude of the spatial gradient of terrain height z"><mi>θ</mi><mo>=</mo><mi>atan</mi><mo>(</mo><mo>‖</mo><mi>∇</mi><mi>z</mi><mo>‖</mo><mo>)</mo></math>';

type GradientLine = {
  name: string;
  points: ChartPoint[];
  stepped?: boolean;
  constant?: boolean;
  gradientSource?: string;
};

export function GradientHelp({ lines, target, xLabel, yLabel, yUnit, axis, source }: {
  lines: GradientLine[];
  target: number;
  xLabel: string;
  yLabel: string;
  yUnit: string;
  axis: GradientAxis;
  source: string;
}) {
  const audience = useContext(AudienceContext);
  const indexed = useMemo(() => lines.map((line) => ({ line, index: indexGradient(line.points) })), [lines]);
  const units = gradientUnits(axis, yUnit);
  const coordinate = (n: number) => axis === "time-ms"
    ? new Date(n).toISOString().replace("T", " ").replace(".000Z", " UTC")
    : formatChartValue(n, units.xUnit, 6);
  const value = (n: number, unit: string) => n !== 0 && Math.abs(n) < 0.000001
    ? `${n.toExponential(3)} ${unit}` : formatChartValue(n, unit, 6);
  return (
    <details className="chart-gradient-help" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, overflowWrap: "anywhere" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, paddingBlock: 6 }}>
        How fast does this graph change? · Gradient and symbols
      </summary>
      <p>A line rising to the right has a positive slope; a falling line has a negative slope; a flat line has zero slope. The size tells you how much the vertical value changes for each horizontal unit, using the axis units rather than the line’s angle on screen.</p>
      <p>
        <span dangerouslySetInnerHTML={{ __html: finiteMath }} />. Here m is the finite slope, Δ means “change”, y is {yLabel}, and x is {xLabel}. Subtract the first value from the second on each axis, then divide the vertical change by the horizontal change.
      </p>
      {axis === "time-ms" && <p>Time differences are converted from UTC milliseconds to hours. Rates here are {units.slopeUnit}, using the actual spacing of each pair.</p>}
      {axis === "seconds" && <p>Flight time is in seconds. Rates here are {units.slopeUnit}.{yUnit === "m/s" ? " A speed change per second is an acceleration; the total-speed rate alone is not the full acceleration vector." : " Radial altitude change in km/s is not terrain-clearance change."}</p>}
      {axis === "azimuth" && <p>This is elevation change per degree of compass direction ({units.slopeUnit}). It describes the horizon silhouette or a body’s direction track, not the ground’s physical slope. Tracks can revisit the same azimuth at different times; each pair follows its own source order. The 0°/360° seam is not joined for this readout.</p>}
      {audience !== "public" && <p>
        <span dangerouslySetInnerHTML={{ __html: derivativeMath }} /> describes an instantaneous derivative for a differentiable curve. Our two-sample difference is a discrete approximation, not a measured instantaneous derivative. Endpoints use a one-sided pair. Sample spacing limits what can be resolved; connecting samples adds no accuracy or uncertainty bound.
      </p>}
      {lines.some((line) => line.stepped) && <p>Power is held constant over each model interval. Its slope is zero inside a known held interval and undefined at a jump. The readout below is a finite intersample change between interval values, not a continuous power derivative.</p>}
      {yUnit === "Wh" && <p>Wh/h equals W: the stored-energy rate is mean storage power under this model, after its efficiencies, limits and loads. It is not array output; a flat battery can also reflect a capacity limit or unmet demand.</p>}
      <strong>Adjacent samples near the selected cursor</strong>
      <p>Use the graph’s arrow keys or Previous/Next sample controls to update these values. Unknown samples, duplicate x values and gaps are not bridged. No extrapolation beyond source bounds.</p>
      <ul style={{ paddingInlineStart: 20, marginBlock: 8 }}>
        {indexed.map(({ line, index }) => {
          const result = sampleGradient(index, target, axis, line.stepped);
          return <li key={line.name} style={{ marginBlock: 10 }}>
            <strong>{line.name}</strong>{line.constant ? " (constant reference)" : ""}: {result.available ? <>
              {result.stepped ? "Finite intersample change" : "Finite sample slope"} ≈ {value(result.slope, units.slopeUnit)} ({result.slope > 0 ? "rises" : result.slope < 0 ? "falls" : "flat"} as x increases).
              {" "}Vertical change: {value(result.deltaY, yUnit)}; horizontal change: {value(result.deltaX, units.xUnit)}; sample distance: {value(result.distance, units.xUnit)}.
              {" "}Source pair: {coordinate(result.from.x)} ({value(result.from.y, yUnit)}) to {coordinate(result.to.x)} ({value(result.to.y, yUnit)}).
              {result.from.sampleIndex != null && result.to.sampleIndex != null && ` Stay samples ${result.from.sampleIndex + 1}–${result.to.sampleIndex + 1}.`}
              {result.stepped && (result.atJump ? " Cursor is at a jump: derivative undefined." : " This interval-value comparison does not give the slope at a jump.")}
            </> : <>Unavailable: {result.reason}</>}
            {" "}Source: {line.gradientSource ?? source}.
          </li>;
        })}
      </ul>
      {axis === "azimuth" && audience !== "public" && <p>
        A separate terrain spatial gradient, ∇z, describes how ground height z changes with horizontal ground distance in two directions. Its magnitude is rise/run when height and distance share units; <span dangerouslySetInnerHTML={{ __html: terrainMath }} /> converts it to a local ground angle. This horizon chart does not supply that gradient or a footprint slope, and cannot establish landing safety.
      </p>}
    </details>
  );
}
