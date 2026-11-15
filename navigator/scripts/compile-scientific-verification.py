"""Compile scoped scientific claims; passing software does not certify a mission."""
from pathlib import Path
import json,hashlib,datetime,re
root=Path('docs/qa/scientific-audit');rows=[]
def require(condition,message):
 if not condition:raise ValueError(message)
bindings=json.loads((root/'integration/receipt-bindings.json').read_text())
require(bindings.get('schemaVersion')==1 and len(bindings.get('sha256',{}))>=20,'Missing reviewed receipt bindings')
for name,expected in bindings['sha256'].items():
 require(Path(name).is_file() and hashlib.sha256(Path(name).read_bytes()).hexdigest()==expected,'Stale scientific evidence: '+name)

for lane in ['sources','ephemeris','resources','dynamics']:
 d=json.loads((root/lane/'results.json').read_text());items=d if isinstance(d,list) else d.get('results',d.get('checks',[]))
 for item in items:
  row=dict(item);row['lane']=lane;row['baselineStatus']=row['status'];row['historicalBaseline']={key:row[key] for key in ['inputIdentity','observedError','reproduce','limitations'] if key in row};row['reportPath']=str(root/lane/'REPORT.md')
  require(row['status'] in ['verified','uncertain','failing'] and row.get('sourceUrls') and row.get('scope') and row.get('limitations'),'Invalid scoped audit finding')
  if isinstance(row['limitations'],list):row['limitations']=' '.join(row['limitations'])
  rows.append(row)
require(len({r['id'] for r in rows})==len(rows),'Duplicate audit finding')
byid={r['id']:r for r in rows}
range_receipt=json.loads((root/'integration/earth-range-repair.json').read_text());ephem=json.loads((root/'integration/ephemeris-after-input-repair.json').read_text());terrain=json.loads((root/'integration/terrain-registration-after.json').read_text());impact=json.loads((root/'integration/dynamics-after.json').read_text())['radial'];inventory=json.loads((root/'sources/inventory.json').read_text())
require(0<=terrain['errorM']<=terrain['toleranceM'],'Terrain comparison failed')
pipeline=json.loads((root/'integration/pipeline-after.json').read_text())
require(pipeline['fixed'] is True and pipeline['unknownRayBecameFinite'] is False and pipeline['missingRayHorizonDeg'] is None,'Missing-ray comparison failed')
current_catalog=hashlib.sha256(Path('public/data/catalog.json').read_bytes()).hexdigest()
require(ephem['catalogSha256']==range_receipt['correctedCatalogSha256']==current_catalog,'Observer evidence belongs to another catalog')
for asset in inventory['assets']:
 if asset['manifestMatches'] is not None:
  require(Path(asset['path']).is_file() and hashlib.sha256(Path(asset['path']).read_bytes()).hexdigest()==asset['sha256'],'Stale registered inventory: '+asset['path'])
def corrected(id,claim,scope,method,observed,receipt):
 r=byid[id];r.update(status='verified',claim=claim,scope=scope,method=method,observedError=observed,correctionReceipt=receipt)
 r['limitations']+=' Archived baseline finding remains in its original report; this correction is scoped to the current checked implementation/input and does not confer operational qualification.'
corrected('S03','Corrected polar cutout edge samples the declared source coordinate within the original encoding tolerance','Same bounded original NASA COG stencils; source transfer/resampling only, not physical terrain accuracy','Registered native-pixel bilinear sampling with a one-pixel halo; compare against cached original source values without changing tolerance',{'beforeM':0.6019691672627232,'afterM':terrain['errorM'],'limitM':terrain['toleranceM']},'integration/terrain-registration-after.json')
corrected('S10','A missing terrain sample makes the affected produced horizon unknown','Synthetic missing-on-ray regression of the corrected producer; existing prepared masks are not wholly regenerated or field-validated','AST-execute actual producer, preserve finite all-known ray and reject incomplete ray',json.loads((root/'integration/pipeline-after.json').read_text()),'integration/pipeline-after.json')
corrected('S11','Registered bundled asset hashes match the current evidence manifest','Cryptographic file identity only; not scientific accuracy','Recompute current registered SHA256 identities after explicit source regeneration and provenance repair',{'registeredChecked':sum(a['manifestMatches'] is not None for a in inventory['assets']),'mismatches':[a['path'] for a in inventory['assets'] if a['manifestMatches'] is False]},'sources/inventory.json')
require(not byid['S11']['observedError']['mismatches'],'Asset inventory comparison failed')
earth=[s for s in ephem['samples'] if s['body']=='Earth']
require(len(earth)==56 and len(ephem['samples'])==112 and ephem['validTables']==ephem['expectedTables'] and range_receipt['samples']==17521,'Incomplete registered ephemeris coverage')
require(all(0<=s['rangeErrorKm']<=5 and s['radiusPass'] and 0<=s['radiusErrorDeg']<=.0001 for s in earth) and all(s['directionPass'] and 0<=s['separationDeg']<=.02 for s in ephem['samples']) and not ephem['errors'],'Ephemeris comparison failed')
corrected('E06','Corrected Moon-observed Earth range passes registered observer-range checks','17521 hourly centre-range input rows validated/encoded; 56 independent site-range checkpoint comparisons at eight sites/seven UTC epochs','Use explicit Earth target399, Moon centre500@301 apparent quantity20; validate exact epochs and source response identity; apply site parallax',{'hourlyInputRows':range_receipt['samples'],'maxFloat32EncodingErrorM':range_receipt['maxEncodingErrorM'],'maxOldDirectionDifferenceKm':range_receipt['maxChangeKm'],'maxSiteRangeErrorM':max(s['rangeErrorKm'] for s in earth)*1000,'registeredSiteLimitM':5000},'integration/ephemeris-after-input-repair.json')
corrected('E07','Earth site semidiameter passes the unchanged direct observer-table limit','56 Earth checkpoints; approximate apparent-vector model, not all possible sites/times','Apply site distance to the corrected lunar-observed centre range and compare to independently requested JPL full angular diameter',{'samples':len(earth),'maxSemidiameterErrorDeg':max(s['radiusErrorDeg'] for s in earth),'registeredLimitDeg':.0001},'integration/ephemeris-after-input-repair.json')
after=impact['afterLegacy'];require(abs(after['timeErrorS'])<1e-6 and abs(after['speedErrorMps'])<1e-7 and abs(after['energyErrorJ'])<.01,'Impact comparison failed')
corrected('D10','Legacy surface-event solve passes the exact central-force radial fall benchmark','Synthetic100m radial drop, 4700kg, spherical or flat reference contact; not real touchdown dynamics','Bracket surface contact and reintegrate RK4 to the event; compare with closed-form fall time, energy-derived impact speed and energy',{'before':impact['beforeLegacy'],'after':after,'limits':{'timeS':1e-6,'speedMps':1e-7,'energyJ':.01}},'integration/dynamics-after.json')
# Current claims carry current identities; archived source rows remain explicitly historical.
for key in ['E01','E02','E06','E07']:
 r=byid[key];r['inputIdentity']={**r.get('inputIdentity',{}),'catalogSha256':current_catalog,'receiptBindings':'integration/receipt-bindings.json','comparisonReceipt':'integration/ephemeris-after-input-repair.json'}
 r['inputIdentity'].pop('baseline',None)
 r['reproduce']=['npx tsx --test tests/audit-ephemeris.test.ts','npx tsx scripts/audit-ephemeris.ts (current corrected inputs: expected exit 0)']
byid['E01']['observedError']={'maxSolarCoordinateDeg':max(x['subsolarDeg'] for x in ephem['inputErrors']),'maxEarthCoordinateDeg':max(x['subearthDeg'] for x in ephem['inputErrors']),'maxEncodedRangeErrorM':max(x['rangeKm'] for x in ephem['inputErrors'])*1000,'maxSolarDiameterErrorArcsec':max(x['sunDiameterArcsec'] for x in ephem['inputErrors'])}
byid['E02']['observedError']={'maxSeparationDeg':max(x['separationDeg'] for x in ephem['samples']),'failures':sum(not x['directionPass'] for x in ephem['samples'])}
byid['E06']['limitations']='Apparent observer ranges depend on direction and observation time. The current input is Moon-observed Earth; source responses, explicit repair and bounded checkpoint residuals are retained. This is not independent observational validation or an operational range guarantee.'
byid['E07']['limitations']='Site parallax is applied to corrected Moon-observed Earth range. The approximate equatorial Earth disk is not a qualified full limb/station model; results are bounded implementation comparisons.'
for r in rows:
 if r['lane']=='ephemeris' and r['id'] not in ['E01','E02','E06','E07']:
  r['historicalEvidenceOnly']=True
  r['scope']='Archived baseline scope (not newly restamped as a current-input comparison): '+r['scope']
byid['S14']['scope']=f"Audited scientific snapshot: {len(inventory['assets'])} asset identities; {sum(a['manifestMatches'] is not None for a in inventory['assets'])} registered entries, all matching; additional visual assets use their own manifest. Upstream whole-source identity remains incomplete."
byid['S14']['inputIdentity']={'assetInventory':'sources/inventory.json','receiptBindings':'integration/receipt-bindings.json','sourceResponses':'sources/references/responses.json'}
manifest=json.loads(Path('public/data/evidence-manifest.json').read_text());model=re.search("PLANNING_MODEL_VERSION='([^']+)'",Path('lib/assessment.ts').read_text()).group(1)
counts={s:sum(r['status']==s for r in rows) for s in ['verified','uncertain','failing']}
output={'schemaVersion':1,'compiledUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'comparisonEvidenceUtc':{'ephemeris':ephem['checkedUtc'],'dynamics':json.loads((root/'integration/dynamics-after.json').read_text())['measuredUtc']},'datasetId':manifest['datasetId'],'modelVersion':model,'counts':counts,'operationalQualification':False,'scopeNotice':'Verified means the stated bounded implementation/input check passed. It does not mean an arbitrary selected scenario, landing site, vehicle or operational mission is qualified. Baseline reports remain archived; this register supersedes only the listed corrected findings.','assetHashes':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in ['public/data/catalog.json','public/data/terrain.json','public/data/evidence-manifest.json']},'findings':rows}
Path('lib/generated/scientific-verification.json').write_text(json.dumps(output,indent=2)+'\n');(root/'VERIFICATION.json').write_text(json.dumps(output,indent=2)+'\n')
lines=['# Scientific verification register','',f'Model `{model}`; dataset `{manifest["datasetId"]}`.','',output['scopeNotice'],'',f'**{counts["verified"]} verified bounded claims; {counts["uncertain"]} uncertain; {counts["failing"]} currently failing recorded comparisons. No operational qualification.**','','| ID | Status | Claim | Scope |','|---|---|---|---|']
for r in rows:lines.append('| '+ ' | '.join(str(r[k]).replace('|','/').replace('\n',' ') for k in ['id','status','claim','scope'])+' |')
lines+=['','## Important remaining limits','','Terrain frame registration, effective resolution/error propagation and physical skylines are not qualified; existing prepared horizons were not recomputed from complete original polar DEMs in this audit. Actual vehicle performance, structural/soil/plume behavior, ground-station bookings, operational RF margins, real thermal survival and recoverable ice remain outside the verified evidence. Predictions and sampled reference comparisons are not flight approval.','','## Corrections','','- Replaced the reverse apparent range with 17521 Moon-observed Earth range rows. Same-input checkpoint maximum range residual: '+str(max(s['rangeErrorKm'] for s in earth)*1000)+' m against the preregistered5km implementation screen.','- Corrected Earth angular size for site parallax; all56 checkpoints pass the original0.0001degree limit.','- Corrected terrain resampling registration; the demonstrated edge discrepancy fell from0.602m to'+str(terrain['errorM'])+'m within the original encoding tolerance. This is not physical2mm surface accuracy.','- A missing source stencil stays unknown in the horizon producer.','- Repaired registered asset hashes and advanced the planning model/dataset identities.','- Replaced legacy linear impact interpolation with a bracketed dynamic event solve; exact radial benchmark passes without loosening its tolerance.','','Reproduce source-specific commands in each lane REPORT.md and integration receipts. `scripts/compile-scientific-verification.py` validates the recorded comparisons; fresh execution of those checks is required before updating this register.']
(root/'VERIFICATION.md').write_text('\n'.join(lines)+'\n');print(json.dumps(counts))
