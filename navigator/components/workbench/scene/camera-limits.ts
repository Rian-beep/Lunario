/** Physical collision radius, independent of the orbit/pan target distance (km). */
export function globeMinimumRadiusKm(maxMeshRadiusKm: number, clearanceKm = .05) {
  if (!Number.isFinite(maxMeshRadiusKm) || maxMeshRadiusKm <= 0 || !Number.isFinite(clearanceKm) || clearanceKm <= 0) throw new RangeError('Positive finite mesh radius and clearance required');
  return maxMeshRadiusKm + clearanceKm;
}

export function outsideSphere(position: readonly number[], centre: readonly number[], radiusKm: number): [number, number, number] {
  if (position.length !== 3 || centre.length !== 3 || ![...position, ...centre, radiusKm].every(Number.isFinite) || radiusKm <= 0) throw new RangeError('Finite 3D position/centre and positive radius required');
  const offset = position.map((v, i) => v - centre[i]);
  const radius = Math.hypot(...offset);
  if (radius >= radiusKm) return [position[0], position[1], position[2]];
  if (radius === 0) return [centre[0], centre[1] + radiusKm, centre[2]];
  return [centre[0] + offset[0] * radiusKm / radius, centre[1] + offset[1] * radiusKm / radius, centre[2] + offset[2] * radiusKm / radius];
}

/** Terrain collision is a body-radius constraint, never a half-sphere orbit limit. */
export function allowFullPolarOrbit(controls: {minPolarAngle: number; maxPolarAngle: number}) {
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
}
