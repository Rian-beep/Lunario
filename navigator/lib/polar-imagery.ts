/** NAC adds detail only when the view requests finer sampling than native WAC. */
export const POLAR_NAC_TILE_BUDGET = 24;
export function onlineNacLevel(metersPerScreenPixel: number, wacSourcePixelM = 100, viewport?: { width: number; height: number }): number | null {
  if (!Number.isFinite(metersPerScreenPixel) || metersPerScreenPixel <= 0 || !Number.isFinite(wacSourcePixelM) || wacSourcePixelM <= 0 || metersPerScreenPixel > wacSourcePixelM) return null;
  let level = Math.max(2, Math.min(10, Math.ceil(Math.log2(8561.953125 / metersPerScreenPixel))));
  if (!viewport) return level;
  if (![viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0)) return null;
  // Prefer display-matched detail, but cover the whole view instead of pasting
  // a budget-truncated tile rectangle. Never fall back past native WAC spacing.
  for (; level >= 2; level--) {
    const sampling = polarTileSamplingM(level);
    if (sampling > wacSourcePixelM) return null;
    const tilePixels = 256 * sampling / metersPerScreenPixel;
    const tiles = (Math.ceil(viewport.width / tilePixels) + 1) * (Math.ceil(viewport.height / tilePixels) + 1);
    if (tiles <= POLAR_NAC_TILE_BUDGET) return level;
  }
  return null;
}
export const polarTileSamplingM = (level: number) => 8561.953125 / 2 ** level;
export function polarSamplingLabel(sourceM: number, outputM: number): string {
  return `Finest visible ${sourceM < 100 ? 'NAC source' : 'WAC source'} ≈${sourceM} m/px · output sampling ${Math.round(outputM)} m/px${sourceM < 100 ? '; WAC/coarser imagery elsewhere' : ''}`;
}

export function bundledPatchUseful(patch: { stepM: number; sourcePixelM: number }, metersPerScreenPixel: number, wacSourcePixelM = 100): boolean {
  if (!Number.isFinite(metersPerScreenPixel) || metersPerScreenPixel <= 0) return false;
  return patch.sourcePixelM < wacSourcePixelM ? metersPerScreenPixel <= wacSourcePixelM : patch.stepM / metersPerScreenPixel > 0.25;
}
