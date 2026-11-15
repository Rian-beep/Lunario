/** Rec.709 luminance applies to LINEAR light, not encoded sRGB channel values.
 * Atlas preserves source acquisition shadows; it is not an albedo measurement.
 */
export const LUNAR_LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
export const LUNAR_LINEAR_LUMINANCE_GLSL = 'vec3(0.2126,0.7152,0.0722)';
export const LUNAR_ATLAS_POLICY = {
  id: 'neutral-linear-rec709-v1', colorSpace: 'srgb', toneMapped: false, lighting: 'source-atlas',
} as const;
export function srgbToLinear(channel: number): number {
  if (!Number.isFinite(channel) || channel < 0 || channel > 1) throw new RangeError('sRGB channel must be in [0,1]');
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(channel: number): number {
  if (!Number.isFinite(channel) || channel < 0 || channel > 1) throw new RangeError('Linear channel must be in [0,1]');
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
}
const decode = Float64Array.from({length:256}, (_,i) => srgbToLinear(i / 255));
// A 16-bit linear lookup avoids a power operation per pixel on the 8K atlas.
// Quantisation contributes at most one 8-bit output code; source sampling is unchanged.
const encode = Uint8ClampedArray.from({length:65536}, (_,i) => Math.round(linearToSrgb(i / 65535) * 255));
export function neutralizeLunarRgba(pixels: Uint8ClampedArray): void {
  if (pixels.length % 4 !== 0) throw new RangeError('Expected complete RGBA pixels');
  for (let i = 0; i < pixels.length; i += 4) {
    const luminance = decode[pixels[i]] * LUNAR_LUMINANCE_WEIGHTS[0] + decode[pixels[i+1]] * LUNAR_LUMINANCE_WEIGHTS[1] + decode[pixels[i+2]] * LUNAR_LUMINANCE_WEIGHTS[2];
    const gray = encode[Math.round(luminance * 65535)];
    pixels[i] = pixels[i+1] = pixels[i+2] = gray;
  }
}
const bitmaps = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
/** Image-only conversion. Geographic extent, native pixels and alpha are preserved;
 * markers, labels, graticules and optional epoch overlays are drawn afterwards.
 */
export function neutralLunarBitmap(image: HTMLImageElement): HTMLCanvasElement {
  const cached = bitmaps.get(image); if (cached) return cached;
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) throw new Error('Lunar image is not ready');
  const bitmap = document.createElement('canvas'); bitmap.width = image.naturalWidth; bitmap.height = image.naturalHeight;
  const ctx = bitmap.getContext('2d', {willReadFrequently:true}); if (!ctx) throw new Error('Lunar atlas conversion unavailable');
  ctx.drawImage(image, 0, 0); const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  neutralizeLunarRgba(data.data); ctx.putImageData(data, 0, 0); bitmap.dataset.lunarAppearance = LUNAR_ATLAS_POLICY.id;
  bitmaps.set(image, bitmap); return bitmap;
}
