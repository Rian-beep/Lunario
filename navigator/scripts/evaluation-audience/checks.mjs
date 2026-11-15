// Conservative evidence checks: reject common automation false positives.
export function nativeZoomEstablished(normal, enlarged) {
  if (!normal || !enlarged) return false;
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < .04 * Math.max(1, Math.abs(b));
  return near(enlarged.dpr / normal.dpr, 2) && near(normal.innerWidth / enlarged.innerWidth, 2)
    && near(normal.outerWidth, enlarged.outerWidth) && near(normal.screenshotWidth, enlarged.screenshotWidth)
    && near(normal.visualScale, 1) && near(enlarged.visualScale, 1);
}
export function contrastRatio(a, b) {
  const lum = rgb => {
    if (rgb.length !== 3 || rgb.some(v => !Number.isFinite(v) || v < 0 || v > 255)) throw Error('Expected opaque RGB in 0..255');
    const linear = rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function changedPaths(before, after, prefix = '') {
  if (Object.is(before, after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(k => changedPaths(before[k], after[k], prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}
export function summarizeChecks(checks) {
  return {total:checks.length, passed:checks.filter(c=>c.status==='pass').length, failed:checks.filter(c=>c.status==='fail').length};
}
