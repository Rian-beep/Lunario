"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyChartPng, downloadChartPng, renderChartPng, type ChartImageDetails } from "@/lib/chart-image";

const surfaceStyles = `
html:root .chart-image-surface,
html:root .chart-image-surface :is(figcaption,.plot-area,.chart-axis-heading,.chart-x-label,.chart-legend,.chart-image-legend) {
  background: #ffffff !important; color: #1c1915 !important;
}
html:root .chart-image-surface svg { background: #ffffff !important; }
html:root .chart-image-surface svg text { fill: #1c1915 !important; }
html:root .chart-image-surface :is(.chart-note,.chart-sample-readout,.chart-gradient-help),
html:root .chart-image-surface :is(.chart-sample-readout,.chart-gradient-help) * {
  background: #ffffff !important; color: #1c1915 !important;
}
html:root .chart-image-surface .chart-marker-label { stroke: #ffffff !important; }
html:root .chart-image-surface .chart-gridline { stroke: #dedede !important; }
html:root .chart-image-surface .chart-axis { stroke: #585858 !important; }
.chart-image-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-block:12px; }
.chart-image-actions [role=status] { flex-basis:100%; color:#1c1915; font-size:13px; overflow-wrap:anywhere; }
.chart-image-legend { display:flex; flex-wrap:wrap; gap:8px 16px; padding:8px 0; font-size:13px; }
.chart-image-legend > span { display:inline-flex; align-items:center; gap:6px; }
`;

export function ChartImageActions({ getPlot, ...details }: ChartImageDetails & {
  getPlot: () => SVGSVGElement | HTMLCanvasElement | null;
}) {
  const [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const id = useId();
  const run = async (copy: boolean) => {
    if (busy) return;
    setBusy(true);
    setStatus(copy ? "Preparing chart image…" : "Preparing PNG download…");
    const makePng = () => {
      const source = getPlot();
      if (!source) return Promise.reject(new Error("The chart is not ready. Open it and try again."));
      return renderChartPng(source, details);
    };
    try {
      if (copy) {
        await copyChartPng(makePng);
        setStatus("Chart image copied. Paste it into another app.");
      } else {
        downloadChartPng(await makePng(), details.title);
        setStatus("PNG download started.");
      }
    } catch (error) {
      setStatus(`${copy ? "Copy failed" : "Download failed"}: ${error instanceof Error ? error.message : "The browser could not export this chart. Try Download PNG."}`);
    } finally { setBusy(false); }
  };
  return <div className="chart-image-actions" aria-busy={busy}>
    <style>{surfaceStyles}</style>
    <Button type="button" size="sm" variant="outline" disabled={busy} aria-describedby={id} onClick={() => void run(true)}>
      Copy chart image<span className="sr-only">: {details.title}</span>
    </Button>
    <Button type="button" size="sm" variant="outline" disabled={busy} aria-describedby={id} onClick={() => void run(false)}>
      Download PNG<span className="sr-only">: {details.title}</span>
    </Button>
    <span id={id} role="status" aria-live="polite" aria-atomic="true">{status}</span>
  </div>;
}
