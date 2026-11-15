import type { DsnStation } from '../dsn';
export type Provenance = {
    title: string;
    sourceUrl: string;
    author: string;
    issuedUtc: string;
    kind: 'reference' | 'user-assumption' | 'observation' | 'forecast';
    notes: string;
};
export type Supplied<T> = {
    provenance: Provenance;
    value: T;
};
export type Span = {
    startUtc: string;
    endUtc: string;
};
export type GeometrySample = {
    utc: string;
    azimuthDeg: number;
    elevationDeg: number;
    rangeKm: number;
};
export type StationGeometry = {
    stationId: DsnStation['id'];
    target: 'Moon center';
    frame: 'ITRF93 / airless apparent AZ-EL';
    requestUrl: string;
    fetchedUtc: string;
    rawResponse: string;
    samples: GeometrySample[];
};
export type LinkHardware = {
    band: 'S' | 'X' | 'Ka' | 'other';
    frequencyGHz: number;
    txPowerW: number;
    txGainDbi: number;
    rxVacuumGainDbi: number;
    systemNoiseK: number;
    pointingLossDb: number;
    otherLossDb: number;
    requiredEbN0Db: number;
    implementationLossDb: number;
    rateBps: number;
};
export type WeatherLoss = Span & {
    attenuationDb: number;
    band: LinkHardware['band'];
    frequencyGHz: number;
};
export type LunarMask = Span & {
    visible: boolean | null;
    antennaHeightM: number;
    minimumElevationDeg: number;
    target: 'station' | 'Earth-center proxy';
};
export type Allocation = Span & {
    rateLimitBps: number;
};
export type CriticalContact = Span & {
    id: string;
    minimumBits: number;
    minimumContactSeconds: number;
};
export type CommunicationsEnvelope = {
    schema: 'solarreach-station-evidence-1';
    scenarioKey: string;
    stationId: DsnStation['id'];
    exportedUtc: string;
    geometry: StationGeometry | null;
    stationHorizon: Supplied<{
        minimumElevationDeg: number;
        profile: Array<{
            azimuthDeg: number;
            elevationDeg: number;
        }>;
    }> | null;
    lunarMask: Supplied<LunarMask[]> | null;
    hardware: Supplied<LinkHardware> | null;
    weather: Supplied<WeatherLoss[]> | null;
    allocations: Supplied<Allocation[]> | null;
    requirements: {
        minimumBits: number | null;
        critical: CriticalContact[];
    };
};
export const EVIDENCE_LIMITS = { bytes: 2000000, samples: 745, intervals: 1000, maxDays: 31 } as const;
export const ENGINEERING_SOURCES = { horizons: 'https://ssd.jpl.nasa.gov/horizons/manual.html', api: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html', coordinates: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301O.pdf', weather: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf', antenna: 'https://deepspace.jpl.nasa.gov/dsndocs/810-005/101/101H.pdf', frames: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf' } as const;
