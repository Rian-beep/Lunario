"""Materialize the source audit's evidence-contract results from captured measurements."""
import json
from collections import Counter
from pathlib import Path

out = Path('docs/qa/scientific-audit/sources')
capture = json.loads((out/'references/capture.json').read_text())
inventory = json.loads((out/'inventory.json').read_text())
responses = json.loads((out/'references/responses.json').read_text())
pgda='https://pgda.gsfc.nasa.gov/products/90'
mosaic='https://pgda.gsfc.nasa.gov/products/81'
usgs='https://psdi.astrogeology.usgs.gov/moon/standards/data_standards/'
pds='https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/'
zenodo='https://doi.org/10.5281/zenodo.4646092'
nasa='https://ntrs.nasa.gov/api/citations/20140005563/downloads/20140005563.pdf'
repro='npx tsx --test tests/audit-sources.test.ts'
rows=[]
def add(id, claim, status, scope, urls, method, tolerance, observed, limitations, version='Captured 2026-11-15; see references/responses.json for UTC, ETag, Last-Modified and SHA256', identity=None):
    rows.append(dict(id=id,claim=claim,status=status,scope=scope,sourceUrls=urls,referenceVersion=version,
                     inputIdentity=identity or {'baseline':'96079ae','assetInventory':'inventory.json','sourceResponses':'references/responses.json'},
                     method=method,tolerance=tolerance,observedError=observed,reproduce=repro,limitations=limitations))
add('S01','Polar metadata uses height in metres, a 1737400 m sphere and DE421 mean-Earth frame','verified',
    'Primary product/GeoTIFF metadata, not an accuracy determination',[pgda,mosaic,usgs],
    'Capture NASA PGDA 90/81 and USGS; decode four original COG IFDs including area registration, metric units and sphere axes.',
    'Exact metadata values; no positional tolerance asserted',{'radiusDifferenceM':0,'rasterType':1},
    'Pixel spacing is distinct from effective resolution/error. GeoTIFF projection labels alone do not establish a frame transform.')
supported=[s for source in capture['sources'] for s in source['samples'] if not s.get('outside') and not s.get('clampShiftXM') and not s.get('clampShiftYM')]
add('S02','Thirteen un-clamped polar samples reproduce primary COG heights within encoding tolerance','verified',
    'Bounded transfer/resampling check: one 5 m patch, one 10 m patch, one 40 m patch and one 1280 m overview',[pgda,mosaic,*[s['url'] for s in capture['sources']]],
    'Read original 2x2 COG windows at declared projected pixel centres; independent scalar bilinear interpolation versus decoded bundled heights. Exact HTTP range bodies replay offline.',
    'Fine grids: 0.0551 m = 0.005 m decimal rounding + 0.05 m packing + 0.0001 m arithmetic allowance. Overview: 0.2001 m = 0.05 + 0.15 + 0.0001 m.',
    {'samples':len(supported),'maxFineAbsM':max(abs(s['errorM']) for s in supported if s['toleranceM']<.1),'maxOverviewAbsM':max(abs(s['errorM']) for s in supported if s['toleranceM']>.1)},
    'Sampling is deliberately small, not all pixels or an independent measurement. Two requested points lie beyond original support and are excluded, never counted as passes.')
edge=next(s for s in capture['sources'] if s['lod']=='fine40')['samples'][-1]
add('S03','Uniform patch coordinates disagree with the upsampling edge-replicated source sample','failing',
    'Existing fine40 odysseus grid final index 263168; overview edge also extends beyond source-centre support',[pgda,capture['sources'][2]['url']],
    'Compare source interpolation at metadata coordinate with bundled last node, then evaluate builder cutout edge clamp to isolate cause.',
    '0.0551 m fixed encoding bound; no physical terrain tolerance invented',
    {'beforeM':edge['errorM'],'afterM':edge['errorM'],'fixed':False,'atDeclaredCoordinateM':edge['expectedHeightM'],'bundledHeightM':edge['bundledHeightM'],'clampedSourceErrorM':edge['clampedErrorM'],'coordinateM':[edge['xM'],edge['yM']],'clampShiftM':[edge['clampShiftXM'],edge['clampShiftYM']]},
    'Public data read-only. Parent must authorize reproducible regeneration with a source-pixel halo or a correctly registered resampler; changing global spacing would misregister the interior. No whole-map error claim.')
add('S04','Global height calibration and five downsampled cells match original PDS DN values','verified',
    'LDEM_16 V3.1, original 5760x2880 pixel-registered cylindrical grid, output 2560x1280',[pds+'ldem_16.lbl',pds+'ldem_16.img'],
    'Fresh label matches bundled label SHA256. Bounded IMG row ranges decoded little-endian signed int16; independent integer quarter-pixel overlap weights reproduce five selected output DNs. Packed/decoded whole bundled hashes verified.',
    '0 DN difference for selected rounded output; 0.5 m DN scale; height = DN*0.5 m; radius = height+1737400 m',
    {'cells':5,'maxDnError':0,'maxHeightErrorM':0},
    'Full upstream IMG hash recorded in bundle metadata was not recomputed from a complete fresh download. Native coordinate-area average is not a spherical area integral.',
    version='PDS LRO-L-LOLA-4-GDR-V1.0; LDEM_16 V3.1 created 2019-03-15; input observations 2009-07-13T17:33:17 to 2016-11-29T05:48:19 (source label times).')
add('S05','A Malapert regional slope stencil agrees with primary heights at the stated scale','verified',
    'lat -85.99985841143967 deg, lon 359.99670036862335 deg east; DE421 ME; source 10 m, output 23.976608187134502 m projected',[pgda,capture['sources'][1]['url']],
    'Four original COG stencil heights, independent central differences and stereographic metric correction, versus regionalSlope on bundled heights.',
    '0.1864364403885588 deg upper arithmetic bound from atan Lipschitz bound and 0.0551 m per-height encoding error; not source slope accuracy',
    {'expectedDeg':11.253694481043707,'actualDeg':11.204527366666207,'beforeDeg':-0.0491671143775001,'afterDeg':-0.0491671143775001,'fixed':False,'groundStencilSpacingM':23.94740321429714},
    'One regional stencil does not validate vehicle footprint slopes, rocks, regolith or PGDA slope-error maps. Source interpolation errors are not covered by this tolerance.')
add('S06','Coarse horizon reproduces analytic spherical dip under its discrete ray policy','verified',
    'Synthetic sphere R=1737400 m, observer 2 m, north-clockwise ENU azimuth; no epoch',[pds+'ldem_16.lbl',usgs],
    'Compare all 180 rays with closed-form tangent dip -acos(R/(R+h)). Also check angular interpolation across north and NaN sectors.',
    '0.001 deg algorithm-only test bound, declared before execution',
    {'analyticDeg':-0.08693657193373108,'maxAbsDeg':0.00004481753885275663},
    'Synthetic-only formula verification; never physical skyline validation. 200 log distances from 1 to 1000000 m and 2 deg azimuth can miss ridges.')
add('S07','Missing coarse DEM support remains unknown','verified',
    'Runtime global DEM height/slope/horizon support semantics',[pds+'ldem_16.lbl'],
    'Replace decoded fixture samples with nodata and verify height/slope null and horizon unavailable; polar inventory keeps int16 -32768 as null.',
    'Exact unknown states, not a numerical physical tolerance',{'inventedFiniteValues':0},
    'Does not apply to Python prepared-mask pipeline (S10); no claim that source interpolation holes become measured returns.')
add('S08','Observed darkness is censored at stay boundaries and unknown coverage is not darkness','verified',
    'Interval bookkeeping at 1 h sampling; any-limb visibility; implementation-only',[pgda],
    'Boundary, interior, entire-window and missing-sample fixtures exercise observedAbsence.',
    'Exact discrete duration and censor flags',{'durationErrorHours':0,'unknownsConvertedToDarkness':0},
    'Real event times remain bracketed by forcing cadence. Censored duration is a lower bound, not a full lunar darkness interval.')
add('S09','LCROSS marker agrees with original NASA-hosted impact-location paper','verified',
    'Centaur 2009-10-09T11:31:19.506 UTC; Mean Earth selenocentric degrees east longitude/latitude',[nasa],
    'Fresh NASA PDF bytes match pinned original SHA256 and byte length; pdftotext confirms published coordinates and impact UTC. Runtime keeps abundance/extent null.',
    'Exact factual transcription; reported location uncertainty 115 m latitude, 44 m longitude (1 sigma), not pixel resolution',
    {'latitudeDeg':-84.6796,'longitudeEastDeg':-48.7093,'transcriptionDifferenceDeg':0},
    'Location paper is not independent remeasurement of water abundance or deposit shape. Ejecta-water detection cannot characterize nearby excavatable resources.',
    version='Marshall et al. 2012, DOI 10.1007/s11214-011-9765-0; NASA NTRS 20140005563; SHA256 8d1fdffb2db74f67b1801ec4671d557191f35b1025da49da790aab04a79bb660')
probe=json.loads((out/'pipeline-probe.json').read_text())
add('S10','Prepared-mask pipeline can return a finite horizon after skipping unknown terrain','failing',
    'Unchanged pipeline/build_dataset.py horizon_masks; synthetic unknown-on-ray case',[pgda],
    'AST-execute original pure functions without decorators; both DEMs missing a near ray location, >=8 remaining samples. Ray remains finite.',
    'Unknown crossing should remain unknown unless a justified conservative occlusion bound is supplied',
    {'beforeDeg':probe['missingRayHorizonDeg'],'afterDeg':probe['missingRayHorizonDeg'],'expected':'NaN','fixed':False},
    'Pipeline belongs to ephemeris lane. This demonstrates policy failure, not that a specific bundled ray was affected; original DEM nodata prevalence unavailable.')
mismatch=[a for a in inventory['assets'] if a['manifestMatches'] is False]
add('S11','Bundled imagery registry does not match its evidence-manifest SHA256','failing',
    'public/data/imagery.json integrity identity; reproduced from git baseline 96079ae',[pgda],
    'Read-only SHA256 inventory of 58 public/data assets; compare registered asset identities; git show baseline confirms same mismatch.',
    'Exact SHA256 match required',{'before':mismatch,'after':mismatch,'fixed':False},
    'Hash mismatch does not by itself prove numerical corruption. Shared manifest/metadata belong to integrator; no silent rehash.')
add('S12','Polar DEM effective resolution and physical error are unresolved','uncertain',
    '5/10/40 m native pixel spacing, 80 m base with 160/1280 m overviews; output spacing differs',[pgda,mosaic],
    'Review PGDA height, EFFRES, ERR, slope-error/count metadata and inspect bundled provenance.',
    'No physical tolerance available',{'physicalHeightErrorM':None,'physicalSlopeErrorDeg':None},
    'No per-pixel EFFRES/ERR/count maps ingested or compared. PGDA81 mosaic alignment residuals are not a universal height-error guarantee.')
add('S13','Cross-dataset lunar orientation registration remains unquantified','uncertain',
    'Polar/global DEM DE421 ME versus catalog DE441/MEAN_ME and M3 GCS_Moon D_Moon_2000',[pgda,mosaic,usgs,zenodo],
    'Compare primary metadata with catalog/ice manifests; do not equate a named sphere with a realized orientation frame.',
    'No justified angular or metre registration tolerance',{'rotationErrorDeg':None,'positionErrorM':None},
    'No authenticated raw original Horizons headers/epoch-dependent orientation mapping in this lane. M3 archive specifies no DE realization. LCROSS Mean Earth label is not an exact all-dataset transform.')
add('S14','Upstream raw data identity is incomplete despite a complete current-byte inventory','uncertain',
    '58 asset SHA256 identities; 24 comparable manifest entries, 23 matching, 1 failing; 24 polar grids / 4541976 samples / 91619 unknown',[pgda,mosaic,pds+'ldem_16.lbl'],
    'Inventory all existing public/data bytes and decode all packed polar grids; compare identities without modifying data.',
    'Exact current-byte hash/count integrity only',{'missingPolarOriginalWholeHashes':True,'upstreamGlobalWholeHashFreshlyRecomputed':False},
    'Original polar/horizon source bytes, immutable versions, full response headers and all asset manifest entries are not complete. Hashes prove identity only; physical accuracy is separate.')
add('S15','Prepared/coarse horizons are not independently validated physical skylines','uncertain',
    'Named 1 deg horizons 0/2/10 m; nearest custom grid 3 deg at 2 m; global 2 deg rays',[pgda,mosaic],
    'Read pipeline/runtimes; distinguish nearest terrain sampling, angular interpolation, spatial borrowing, finite radial extent, and discrete terrain from actual disk integration.',
    'No global terrain occlusion error tolerance supported',{'physicalHorizonErrorDeg':None,'illuminationErrorFraction':None},
    'No complete original 40/240 m datasets or independent skyline/illumination observations. Numerical display cutouts use bilinear 5/10/40 m products, not the prepared horizon pipeline nearest samples. Narrow obstructions and remote missing terrain can bias exposure.')
add('S16','M3 association extraction cannot be freshly reproduced from the author archive in this run','uncertain',
    '169 published PSR representative points, 820 positive M3 detections at ~280 m sampling; no per-point observation epoch',[zenodo,'https://doi.org/10.3847/PSJ/abf3c5','https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/'],
    'Inspect extraction/parser and output counts; fetch pinned API URL and alternate official file URL; both return HTTP 403. Existing parser tests verify semantics only.',
    'Original ZIP/member hashes and byte-for-byte output required for a new provenance pass',{'freshArchiveError':capture['failures'],'newIndependentArchiveMatch':False},
    'Existing source-manifest claims remain unrefreshed. PSR representative locations are not individual M3 ice pixels or measured ice outlines; association is not abundance.')
add('S17','Exposure/slope ranking and ice markers do not establish safety or recoverable reserves','uncertain',
    'Regional weighted index 0–100 and resource applicability',[pgda,zenodo,'https://www.jpl.nasa.gov/news/ice-confirmed-at-the-moons-poles/'],
    'Review suitability score inputs, slope ranking preference, explicit limitations and ice evidence types; no mission readiness solver substituted.',
    'No safety, probability, excavation or concentration tolerance established',{'qualifiedLandingFootprintEvidence':False,'excavatableIceEvidence':False},
    'Mean uniform visible-solar-disk fraction is not electrical power. Contact is geometric Earth-centre clearance plus antenna cutoff, not allocated RF service. Neither PSR nor M3 spectral associations establish deposit depth, grade or excavation feasibility.')
add('S18','Runtime ice loader preserves evidence methods and counts rather than inferring resource quantity','verified',
    'Source/schema interpretation and error handling only; no independent physical detections',[zenodo,nasa],
    'Existing focused parser tests plus audit inspect 169 Point associations and one impact marker, count units, null dates/quantities and source-method constraints.',
    'Exact schema/count/null semantics; no physical tolerance',{'iceBearingPsrPoints':169,'associatedDetections':820,'impactWaterMarkers':1,'surfaceIcePixelFeatures':0},
    'Correct parser behavior does not refresh the inaccessible original archive or verify all science interpretations. M3 observationUtc null and LCROSS abundance null remain meaningful.')
result={'schemaVersion':1,'lane':'sources','baseline':'96079ae','auditedUtc':'2026-11-15','counts':dict(Counter(r['status'] for r in rows)),
        'coordinateAndTimeConventions':{'referenceRadiusM':1737400,'latitude':'selenocentric degrees','longitude':'east-positive degrees; terrain [0,360), ice [-180,180]','height':'metres above reference sphere, not geoid or Earth sea level','polarProjection':'south polar stereographic, central meridian 0, unit scale at pole, x=easting, y north toward 0 E','orientation':'DE421 MOON_ME for DEM products; other dataset equivalence unresolved','epochs':'Static topography; PDS source interval/version in S04. LCROSS event UTC in S09. Catalog time support [2026-01-01T00:00:00Z,2028-01-01T00:00:00Z), 1 h forcing. No new ephemeris queries.'},
        'referenceCapture':{'responses':len(responses),'bytes':sum(r['bytes'] for r in responses),'failures':capture['failures'],'path':'references/responses.json'},
        'implementationChanges':[],'sourceDataChanged':False,'results':rows,
        'acceptance':'Not accepted as an all-green scientific audit: failing and uncertain findings remain. Passing tests reproduce discrepancies as well as formula behavior; no operational certification.'}
(out/'results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['counts']))
