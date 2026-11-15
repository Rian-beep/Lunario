export type GeometricSearchInputs = {
  lat: number; lon: number; heightM: number; terrainMaskId: string;
  startIndex: number; endIndex: number; days: number; minEarth: number;
};

export function normalizedSearchLongitude(lon: number): number {
  return ((lon % 360) + 540) % 360 - 180;
}

export function geometricSearchKey(input: GeometricSearchInputs): string {
  return JSON.stringify([input.lat, normalizedSearchLongitude(input.lon), input.heightM,
    input.terrainMaskId, input.startIndex, input.endIndex, input.days, input.minEarth]);
}

/** A changed key also invalidates a request if the user returns to its old inputs. */
export function geometricSearchGuard() {
  let currentKey = "", generation = 0;
  return {
    update(key: string) { if (key !== currentKey) { currentKey = key; generation++; } },
    begin() { return { key: currentKey, generation: ++generation }; },
    accepts(token: { key: string; generation: number }) {
      return token.key === currentKey && token.generation === generation;
    },
    cancel() { generation++; },
  };
}
