import { Matrix4 } from "three";
import { nasaSiteFrame } from "../nasa-model";

export function validateIonFrame(lat: number, lon: number, radiusKm: number): string | null {
  return ![lat, lon, radiusKm].every(Number.isFinite) || Math.abs(lat) > 90 || radiusKm <= 0
    ? "Moon tiles require a finite latitude (−90 to 90°), longitude and positive reference radius in kilometres."
    : null;
}

/** Moon body metres (+X prime meridian, +Y east, +Z north) → scene east/up/−north km. */
export function ionBodyToLocalMatrix(lat: number, lon: number, radiusKm: number): Matrix4 {
  const error = validateIonFrame(lat, lon, radiusKm);
  if (error) throw new Error(error);
  const { east, up, north } = nasaSiteFrame(lat, lon);
  // body→NASA is [x,z,−y]. Rows are the inverse site basis, not its transpose again.
  return new Matrix4().set(
    east[0] / 1000, -east[2] / 1000, east[1] / 1000, 0,
    up[0] / 1000, -up[2] / 1000, up[1] / 1000, -radiusKm,
    -north[0] / 1000, north[2] / 1000, -north[1] / 1000, 0,
    0, 0, 0, 1,
  );
}
