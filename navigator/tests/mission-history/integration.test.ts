import test from "node:test";
import assert from "node:assert/strict";
import {MISSION_HISTORY,missionHistoryForSite} from "../../lib/mission-history";
test("joined history has unique mission and site identities, and no invented custom history",()=>{assert.equal(new Set(MISSION_HISTORY.map(r=>r.id)).size,MISSION_HISTORY.length);const ids=MISSION_HISTORY.flatMap(r=>r.siteIds);assert.equal(new Set(ids).size,ids.length);for(const r of MISSION_HISTORY)for(const id of r.siteIds)assert.equal(missionHistoryForSite(id),r);assert.equal(missionHistoryForSite("custom"),null);});
