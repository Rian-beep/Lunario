import type { MissionEvent } from "./planning-types";

/** Offsets are hours from mission start; bounds retain the forcing interval uncertainty. */
export type MissionModelEvent = {
  kind: MissionEvent["kind"];
  intervalIndex: number;
  earliestOffsetHours: number;
  latestOffsetHours: number;
  modelOffsetHours: number | null;
};

/** Convert model offsets without presenting interpolated timing as a fresh observation. */
export function toMissionEvent(
  event: MissionModelEvent,
  missionStartUtc: string,
  evidenceIds: readonly string[] = [],
): MissionEvent {
  const startMs = Date.parse(missionStartUtc);
  if (!Number.isFinite(startMs)) throw new Error("Mission start must be a valid date/time");
  const {earliestOffsetHours: earliest, latestOffsetHours: latest, modelOffsetHours: model} = event;
  if (!Number.isInteger(event.intervalIndex) || event.intervalIndex < 0 ||
    !Number.isFinite(earliest) || !Number.isFinite(latest) || earliest < 0 || latest < earliest ||
    (model !== null && (!Number.isFinite(model) || model < earliest || model > latest)))
    throw new Error("Event offsets must be finite, ordered and contain the model offset");
  const utc = (hours: number) => {
    const date = new Date(startMs + hours * 3_600_000);
    if (!Number.isFinite(date.getTime())) throw new Error("Event time exceeds the supported date range");
    return date.toISOString();
  };
  return {
    kind: event.kind,
    intervalIndex: event.intervalIndex,
    earliestUtc: utc(earliest),
    latestUtc: utc(latest),
    modelOffsetHours: model,
    evidenceIds: [...evidenceIds],
  };
}
