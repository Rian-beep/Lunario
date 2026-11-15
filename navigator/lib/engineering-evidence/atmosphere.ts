/** JPL 810-005 module 105E, section 2.1.2: plane-parallel approximation.
 * This maps supplied zenith loss to elevation, not weather to a forecast.
 */
export function slantAttenuationDb(zenithDb: number, elevationDeg: number): number {
    if (!Number.isFinite(zenithDb) || zenithDb < 0 || zenithDb > 100 || !Number.isFinite(elevationDeg) || elevationDeg < 10 || elevationDeg > 90)
        throw Error('Slant approximation requires supplied nonnegative zenith attenuation and elevation 10–90°');
    return zenithDb / Math.sin(elevationDeg * Math.PI / 180);
}
export function atmosphericNoiseK(attenuationDb: number, meanRadiatingK: number): number {
    if (!Number.isFinite(attenuationDb) || attenuationDb < 0 || attenuationDb > 200 || !Number.isFinite(meanRadiatingK) || meanRadiatingK <= 0 || meanRadiatingK > 1000)
        throw Error('Invalid atmosphere attenuation or radiating temperature');
    return meanRadiatingK * (1 - Math.pow(10, -attenuationDb / 10));
}
