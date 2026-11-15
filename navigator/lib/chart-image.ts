export type ChartImageLegend = {
  label: string;
  color: string;
  dash?: string;
  shape?: "sun" | "earth";
};

export type ChartImageDetails = {
  title: string;
  xAxis: string;
  yAxis: string;
  legend: ChartImageLegend[];
  notes?: string[];
};

export function escapeChartText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function chartImageDimensions(width: number, height: number) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("The chart has no drawable size. Open the chart and try again.");
  const pixelWidth = Math.ceil(width * 2), pixelHeight = Math.ceil(height * 2);
  if (pixelWidth > 8192 || pixelHeight > 8192 || pixelWidth * pixelHeight > 32_000_000)
    throw new Error("The chart is too large to export. Reduce its displayed size and try again.");
  return { width, height, pixelWidth, pixelHeight };
}

function wrapText(text: string, width: number, fontSize: number): string[] {
  const limit = Math.max(8, Math.floor(width / (fontSize * 0.65)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line);
      line = "";
    }
    // URLs and long identifiers must also stay inside the image.
    let remaining = word;
    while (remaining.length > limit) {
      if (line) { lines.push(line); line = ""; }
      lines.push(remaining.slice(0, limit));
      remaining = remaining.slice(limit);
    }
    line += (line && remaining ? " " : "") + remaining;
  }
  if (line) lines.push(line);
  return lines;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const ELEMENTS = new Set(["svg", "g", "path", "line", "rect", "text", "tspan", "circle", "ellipse", "polyline", "polygon", "defs", "clipPath", "title", "desc", "linearGradient", "radialGradient", "stop"]);
const ATTRIBUTES = new Set(["id", "viewBox", "x", "y", "x1", "x2", "y1", "y2", "width", "height", "d", "cx", "cy", "r", "rx", "ry", "points", "transform", "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linejoin", "stroke-linecap", "text-anchor", "dominant-baseline", "clip-path", "clipPathUnits", "fill-rule", "opacity", "fill-opacity", "stroke-opacity", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "preserveAspectRatio"]);
const PAINT = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "stroke-linejoin", "stroke-linecap", "text-anchor", "dominant-baseline", "opacity", "fill-opacity", "stroke-opacity", "font-size", "font-weight", "font-style", "paint-order"];

function localPaint(value: string): boolean {
  return !/url\s*\(/i.test(value) || /^url\(["']?#[^"'()<>\s]+["']?\)$/.test(value);
}

/** Freeze SVG paint without external styles, HTML, event handlers or network references. */
export function serializeChartPlot(source: SVGSVGElement): string {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  copies.forEach((element, index) => {
    if (!ELEMENTS.has(element.localName) || element.namespaceURI !== SVG_NS) {
      element.remove();
      return;
    }
    for (const attr of [...element.attributes]) {
      if (!ATTRIBUTES.has(attr.name) || !localPaint(attr.value)) element.removeAttribute(attr.name);
    }
    const computed = getComputedStyle(originals[index]);
    for (const property of PAINT) {
      const value = computed.getPropertyValue(property);
      if (value && localPaint(value)) (element as SVGElement).style.setProperty(property, value);
    }
    (element as SVGElement).style.fontFamily = "Arial, sans-serif";
  });
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(source.viewBox.baseVal.width));
  clone.setAttribute("height", String(source.viewBox.baseVal.height));
  return new XMLSerializer().serializeToString(clone);
}

export function serializeChartImage(source: SVGSVGElement | HTMLCanvasElement, details: ChartImageDetails) {
  const isSvg = source.namespaceURI === SVG_NS;
  const svg = source as SVGSVGElement;
  const canvas = source as HTMLCanvasElement;
  const plotWidth = isSvg ? svg.viewBox.baseVal.width : parseFloat(canvas.style.width) || canvas.clientWidth;
  const plotHeight = isSvg ? svg.viewBox.baseVal.height : parseFloat(canvas.style.height) || canvas.clientHeight;
  chartImageDimensions(plotWidth, plotHeight);
  const width = Math.max(480, plotWidth + 32), contentWidth = width - 32;
  let y = 16;
  const parts: string[] = [];
  const text = (value: string, size = 13, bold = false, x = 16, availableWidth = contentWidth) => {
    for (const line of wrapText(value, availableWidth, size)) {
      y += size + 6;
      parts.push(`<text x="${x}" y="${y}" font-size="${size}"${bold ? ' font-weight="700"' : ""}>${escapeChartText(line)}</text>`);
    }
  };
  text(details.title, 18, true);
  text(`Vertical axis: ${details.yAxis}`);
  y += 12;
  const plotX = (width - plotWidth) / 2;
  if (isSvg) {
    parts.push(`<g transform="translate(${plotX} ${y})">${serializeChartPlot(svg)}</g>`);
  } else {
    // Only our own canvas snapshot is allowed as an image; arbitrary SVG images are stripped.
    const png = canvas.toDataURL("image/png");
    if (!png.startsWith("data:image/png;base64,")) throw new Error("The chart could not be captured as PNG.");
    parts.push(`<image x="${plotX}" y="${y}" width="${plotWidth}" height="${plotHeight}" href="${png}"/>`);
  }
  y += plotHeight;
  text(`Horizontal axis: ${details.xAxis}`);
  y += 8;
  for (const item of details.legend) {
    const start = y;
    text(item.label, 13, false, 58, contentWidth - 42);
    const color = /^#[\da-f]{3,8}$/i.test(item.color) ? item.color : "#1c1915";
    const dash = item.dash && /^[\d.,\s]+$/.test(item.dash) ? ` stroke-dasharray="${item.dash}"` : "";
    parts.push(`<line x1="16" x2="46" y1="${start + 14}" y2="${start + 14}" stroke="${color}" stroke-width="2"${dash}/>`);
    if (item.shape) parts.push(`<circle cx="31" cy="${start + 14}" r="4" fill="${item.shape === "earth" ? "#ffffff" : color}" stroke="${color}" stroke-width="2"/>`);
  }
  y += 8;
  for (const note of details.notes ?? []) text(note, 12);
  const dimensions = chartImageDimensions(width, y + 20);
  return {
    ...dimensions,
    svg: `<svg xmlns="${SVG_NS}" width="${width}" height="${dimensions.height}" viewBox="0 0 ${width} ${dimensions.height}"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#1c1915" font-family="Arial, sans-serif">${parts.join("")}</g></svg>`,
  };
}

export async function renderChartPng(source: SVGSVGElement | HTMLCanvasElement, details: ChartImageDetails): Promise<Blob> {
  const exported = serializeChartImage(source, details);
  const url = URL.createObjectURL(new Blob([exported.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = exported.pixelWidth;
    canvas.height = exported.pixelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG export is unavailable in this browser.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode this chart as PNG.")), "image/png",
    ));
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ImageClipboard = {
  isSecureContext: boolean;
  navigator: { clipboard?: Pick<Clipboard, "write"> };
  ClipboardItem?: typeof ClipboardItem;
};

export function chartClipboardProblem(environment: ImageClipboard): string | null {
  if (!environment.isSecureContext) return "Image copy needs a secure browser context. Use Download PNG instead.";
  if (!environment.navigator.clipboard?.write || !environment.ClipboardItem)
    return "This browser cannot copy PNG images. Use Download PNG instead.";
  if (environment.ClipboardItem.supports && !environment.ClipboardItem.supports("image/png"))
    return "This browser cannot copy PNG images. Use Download PNG instead.";
  return null;
}

export async function copyChartPng(makePng: () => Promise<Blob>, environment: ImageClipboard = window): Promise<void> {
  const problem = chartClipboardProblem(environment);
  if (problem) throw new Error(problem);
  // Start the clipboard write during the click gesture, before asynchronous rasterization.
  const png = makePng();
  try {
    await environment.navigator.clipboard!.write([new environment.ClipboardItem!({ "image/png": png })]);
  } catch (error) {
    // A denied write can leave the encoding promise unconsumed by the browser.
    void png.catch(() => undefined);
    if (error instanceof Error && error.name === "NotAllowedError")
      throw new Error("Image copy was denied. Allow clipboard access or use Download PNG instead.");
    throw error;
  }
}

export function downloadChartPng(blob: Blob, title: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 100) || "chart"}.png`;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    // Keep the URL alive until the browser has begun consuming the download.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
