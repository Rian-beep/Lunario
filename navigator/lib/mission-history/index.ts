import { US_MISSION_HISTORY } from "./us";
import { INTERNATIONAL_MISSION_HISTORY } from "./international";
export const MISSION_HISTORY = [...US_MISSION_HISTORY, ...INTERNATIONAL_MISSION_HISTORY];
export function missionHistoryForSite(siteId: string) { return MISSION_HISTORY.find(record => record.siteIds.includes(siteId)) ?? null; }
