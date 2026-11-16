/** Cesium Moon (ion asset 2684829): 1 m NAC imagery on ~5 m LOLA mesh near the poles. */
export const CESIUM_MOON_ASSET_ID = 2684829;
export const CESIUM_CLOSEUP_ENTER_KM = 12;
export const CESIUM_CLOSEUP_RELEASE_KM = 20;

export type CesiumCloseupState = { open: boolean; dismissed: boolean };

/** Zoomed lunar orbit/surface view, where the polar tileset is worth streaming. */
export function cesiumCloseupDesired(rangeKm: number, mode: string, focus: string): boolean {
  if (focus !== "moon") return false;
  if (mode !== "orbit" && mode !== "surface") return false;
  return Number.isFinite(rangeKm) && rangeKm >= 0 && rangeKm < CESIUM_CLOSEUP_ENTER_KM;
}

/**
 * Stay on the Lunario view after dismiss until the camera leaves the close band,
 * then allow the next zoom-in to open Cesium again.
 */
export function reduceCesiumCloseup(state: CesiumCloseupState, desired: boolean, rangeKm: number, dismiss = false): CesiumCloseupState {
  let dismissed = state.dismissed || dismiss;
  if (Number.isFinite(rangeKm) && rangeKm >= CESIUM_CLOSEUP_RELEASE_KM) dismissed = false;
  if (!desired && !dismiss) dismissed = false;
  return { open: desired && !dismissed, dismissed };
}
