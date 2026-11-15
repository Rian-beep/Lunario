import manifest from '../public/data/visual-moon/manifest.json';

export const VISUAL_MOON = manifest;
export type VisualMoonDevice = {
  maxTextureSize: number;
  /** Budget for decoded RGBA + mipmaps + one in-flight decoded replacement. */
  textureBudgetMiB: number;
  maxAnisotropy: number;
};
export type VisualMoonTier = (typeof manifest.colour.assets)[number];

export function visualMoonTextureBytes(width: number, height: number): number {
  return Math.ceil(width * height * 4 * 4 / 3);
}

/** No device inference silently authorizes a 171 MiB 8K GPU allocation. */
export function visualMoonTiers(device: VisualMoonDevice): VisualMoonTier[] {
  if (![device.maxTextureSize, device.textureBudgetMiB, device.maxAnisotropy].every(Number.isFinite) ||
      device.maxTextureSize < 1 || device.textureBudgetMiB <= 0 || device.maxAnisotropy < 1) return [];
  const result: VisualMoonTier[] = [];
  let previousBytes = 0;
  for (const asset of manifest.colour.assets) {
    const resident = visualMoonTextureBytes(asset.width, asset.height);
    // Old/new mip chains and both browser images can coexist during a swap.
    const decodedAndResident = resident + asset.width * asset.height * 4;
    const peak = previousBytes + decodedAndResident;
    if (asset.width > device.maxTextureSize || asset.height > device.maxTextureSize ||
        peak > device.textureBudgetMiB * 1024 ** 2) break;
    result.push(asset);
    previousBytes = decodedAndResident;
  }
  return result;
}

/** Display only; these radial samples never enter the assessment/terrain loaders. */
export function decodeVisualMoonRadii(bytes: ArrayBuffer, vertexCount: number): Float32Array {
  if (vertexCount !== manifest.relief.vertexCount || bytes.byteLength !== 16 + vertexCount * 4)
    throw new Error('Visual Moon radial sample count mismatch');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x314d5652 || view.getUint32(4, true) !== vertexCount ||
      view.getFloat64(8, true) !== 1737.4) throw new Error('Invalid visual Moon radial calibration');
  const radii = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const radius = view.getFloat32(16 + i * 4, true);
    if (!Number.isFinite(radius) || radius < manifest.relief.minRadiusKm - .001 ||
        radius > manifest.relief.maxRadiusKm + .001) throw new Error('Visual Moon radius outside source bounds');
    radii[i] = radius;
  }
  return radii;
}
