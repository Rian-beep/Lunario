import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEvidenceManifest} from '../lib/provenance';
const entry={id:'ephemeris',kind:'computed',label:'Fixture',sourceUrl:null,productId:null,version:null,sha256:null,frame:null,sourceSpacingM:null,effectiveResolutionM:null,outputSpacingM:null,temporalStepHours:1,angularStepDeg:null,coverage:'complete',notes:[]};
const manifest={schemaVersion:1,datasetId:'fixture',validFromUtc:'2026-01-01T00:00:00Z',validUntilUtcExclusive:'2028-01-01T00:00:00Z',entries:[entry]};
test('manifest preserves unknown precision and validates dates and unique IDs',()=>{
 assert.equal(parseEvidenceManifest(manifest).entries[0].effectiveResolutionM,null);
 for(const invalid of [{...manifest,schemaVersion:2},{...manifest,validUntilUtcExclusive:manifest.validFromUtc},{...manifest,entries:[entry,entry]},{...manifest,entries:[{...entry,sourceSpacingM:-1}]}])assert.throws(()=>parseEvidenceManifest(invalid));
});
