"""Read-only independent references; run from navigator with Python + NumPy.

Uses archived primary response bytes, not the integration comparison columns.
Only writes this review's reference.json. No network, source or asset writes.
"""
import ast
import base64
import hashlib
import json
import math
import struct
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

HERE = Path('docs/qa/final-science-review')
AUDIT = Path('docs/qa/scientific-audit')
load = lambda p: json.loads(Path(p).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
cat_bytes = Path('public/data/catalog.json').read_bytes()
cat = json.loads(cat_bytes)
R, MU, ER = 1737.4, 4902800118000., 6378.137
rad = math.pi / 180
epoch = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()

def decode(name, code, scale=1):
    b = base64.b64decode(cat[name], validate=True)
    return np.array([x[0] / scale for x in struct.iter_unpack('<' + code, b)])

elat, elon = decode('subearthLat', 'h', 100), decode('subearthLon', 'H', 100)
slat, slon = decode('subsolarLat', 'h', 100), decode('subsolarLon', 'H', 100)
dist = decode('earthRangeKm', 'f')
# The encoded full solar diameter is an integer arcsecond.
sdia = decode('sunDiamArcsec', 'H')

def rows(text):
    header, body = text.split('$$SOE')
    assert body.count('$$EOE') == 1
    col = next(l for l in reversed(header.splitlines()) if ',' in l).split(',')
    names = [s.strip() for s in col]
    data = [[s.strip() for s in l.split(',')] for l in body.split('$$EOE')[0].strip().splitlines()]
    assert all(len(r) == len(names) for r in data)
    return names, [dict(zip(names, r)) for r in data]

def cached(path):
    c = load(path)
    assert sha(c['body'].encode()) == c['sha256'] and c['httpStatus'] == 200
    p = json.loads(c['body'])
    assert p['signature'] == {'version': '1.2', 'source': 'NASA/JPL Horizons API'}
    assert not p.get('error')
    assert 'NO (AIRLESS)' in p['result']
    return c, p['result'], rows(p['result'])[1]

full, text, source = cached(AUDIT / 'integration/earth-range-reference.json')
assert "COMMAND=%27399%27" in full['url'] and "CENTER=%27500%40301%27" in full['url']
assert 'Earth (399)' in text and 'Center body name: Moon (301)' in text
assert len(source) == cat['meta']['n'] == len(dist) == 17521
errors = []
for i, s in enumerate(source):
    assert abs((float(s['Date_________JDUT']) - 2440587.5) * 86400 - (epoch(cat['meta']['t0']) + i*3600)) <= .001
    value = float(s['delta'])
    assert 300000 < value < 450000
    assert struct.pack('<f', value) == struct.pack('<f', dist[i])
    errors.append(abs(value-dist[i])*1000)
assert cat['meta']['rangeReference']['responseSha256'] == full['sha256']

def unit(lat, lon):
    return np.array([math.cos(lat*rad)*math.cos(lon*rad), math.cos(lat*rad)*math.sin(lon*rad), math.sin(lat*rad)])

def angles(v, lat, lon):
    east = unit(0, lon+90)
    north = np.array([-math.sin(lat*rad)*math.cos(lon*rad), -math.sin(lat*rad)*math.sin(lon*rad), math.cos(lat*rad)])
    up = unit(lat, lon)
    enu = [float(np.dot(v, a)) for a in [east, north, up]]
    return math.degrees(math.atan2(enu[0], enu[1])) % 360, math.degrees(math.atan2(enu[2], math.hypot(*enu[:2])))

samples, identities, input_errors = [], [], []
for path in sorted((AUDIT / 'ephemeris/raw').glob('*.json')):
    c, text, data = cached(path)
    req = c['request']
    times = req.get('times', ['2026-01-01T00:00:00Z','2026-11-14T00:00:00Z','2027-06-29T11:00:00Z','2027-07-20T10:00:00Z','2027-07-20T11:00:00Z','2027-12-31T23:00:00Z','2028-01-01T00:00:00Z'])
    assert len(data) == len(times)
    for row, utc in zip(data, times):
        assert abs((float(row['Date_________JDUT'])-2440587.5)*86400-epoch(utc)) < .001
    identities.append({'file': str(path), 'sha256': c['sha256'], 'rows': len(data)})
    if 'site' not in req or 'times' in req:
        continue
    lat, lon = req['site']['lat'], req['site']['lon']
    for row, utc in zip(data, times):
        i = round((epoch(utc)-epoch(cat['meta']['t0']))/3600)
        target = req['target']
        vec = dist[i]*unit(elat[i], elon[i])-R*unit(lat, lon) if target == '399' else unit(slat[i], slon[i])
        az, elev = angles(vec, lat, lon)
        ref_az, ref_el = float(row['Azimuth_(a-app)']), float(row['Elevation_(a-app)'])
        separation = math.degrees(math.atan2(np.linalg.norm(np.cross(unit(elev, az), unit(ref_el, ref_az))), np.dot(unit(elev, az), unit(ref_el, ref_az))))
        radius = math.degrees(math.asin(ER/np.linalg.norm(vec))) if target == '399' else sdia[i]/7200
        sample = {'site': req['id'].rsplit('-', 1)[0], 'body': target, 'utc': utc, 'index': i, 'azimuthDeg': az, 'elevationDeg': elev, 'separationDeg': separation, 'radiusDeg': radius, 'radiusErrorDeg': abs(radius-float(row['Ang-diam'])/7200)}
        assert separation < .020 and abs(elev-ref_el) < .020
        assert sample['radiusErrorDeg'] < (.0001 if target == '399' else .00008)
        if target == '399':
            sample['siteRangeKm'] = float(np.linalg.norm(vec))
            sample['rangeErrorKm'] = abs(sample['siteRangeKm']-float(row['delta']))
            assert sample['rangeErrorKm'] < 5
        samples.append(sample)
assert len(identities) == 23 and sum(x['rows'] for x in identities) == 233

terrain = load('public/data/terrain.json')
grids = [terrain['overview'], *terrain['patches']]
capture = load(AUDIT / 'sources/references/capture.json')
stencils = []
for s in capture['sources']:
    grid = terrain['overview'] if s['lod']=='overview' else next(g for g in grids if g.get('lod')==s['lod'] and g['id']==s['gridId'])
    raw = base64.b64decode(grid['encodedHeights'])
    for p in s['samples']:
        if p.get('outside'):
            continue
        col = (p['xM']-s['origin'][0])/s['resolutionM']-.5
        row = (s['origin'][1]-p['yM'])/s['resolutionM']-.5
        fx, fy = col-math.floor(col), row-math.floor(row)
        h = p['sourceHeightsM']
        expected = (h[0]*(1-fx)+h[1]*fx)*(1-fy)+(h[2]*(1-fx)+h[3]*fx)*fy
        dn = struct.unpack_from('<h',raw,2*p['index'])[0]
        assert dn != -32768
        actual = grid['heightOffsetM']+dn*grid['heightScaleM']
        error = actual-expected
        assert abs(error) <= p['toleranceM']
        stencils.append({'lod':s['lod'],'index':p['index'],'expectedM':expected,'actualM':actual,'errorM':error,'limitM':p['toleranceM']})

manifest = load('public/data/evidence-manifest.json')
hashes = {}
for e in manifest['entries']:
    if not e['id'].startswith('asset:') or not e.get('sha256'):
        continue
    p = Path('public/data') / e['id'].removeprefix('asset:')
    assert sha(p.read_bytes()) == e['sha256'], str(p)
    hashes[str(p)] = e['sha256']
assert len(hashes) == 24

# Exercise actual Python producer, with the same NaN nodata representation as
# all four captured TIFFs. This is synthetic policy evidence, not lunar truth.
nodes = [n for n in ast.parse(Path('pipeline/build_dataset.py').read_text()).body if isinstance(n,ast.FunctionDef) and n.name in {'sample_dem','sample_surface','horizon_masks'}]
for n in nodes:
    n.decorator_list=[]
ns={'np':np,'math':math,'prange':range}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'pipeline/build_dataset.py','exec'),ns)
kw=dict(ftie_x=-1280.,ftie_y=1280.,fscale=40.,foff=.5,ctie_x=-1280.,ctie_y=1280.,cscale=40.,coff=.5,lat_deg=-90.,lon_deg=0.,heights=np.array([0.,2.,10.]),az_step=90.,near_step=40.,mid_step=40.,far_step=40.,max_m=800.)
dem=np.zeros((64,64),dtype=np.float32)
known=ns['horizon_masks'](fine=dem,coarse=dem,**kw)[0]
missing=dem.copy();missing[29:31,31:33]=np.nan
hole=ns['horizon_masks'](fine=missing,coarse=missing,**kw)[0]
fallback=ns['horizon_masks'](fine=missing,coarse=dem,**kw)[0]
assert np.isfinite(known).all() and np.isnan(hole[:,0]).all()
assert np.array_equal(known,fallback)

# Reference for exact radial fall, using JPL DE440 GM and reference radius.
radius=R*1000; r0=radius+100; x=radius/r0
radial=dict(timeS=math.sqrt(r0**3/(2*MU))*(math.acos(math.sqrt(x))+math.sqrt(x*(1-x))),speedMps=math.sqrt(2*MU*(1/radius-1/r0)))
out={'scope':'Same primary inputs, independent scalar/vector reconstruction; no independent observations or qualification','catalogSha256':sha(cat_bytes),'earthRange':{'rows':len(source),'responseSha256':full['sha256'],'maxEncodingErrorM':max(errors)},'observerIdentities':identities,'samples':samples,'summary':{'siteRows':len(samples),'maxDirectionDeg':max(s['separationDeg'] for s in samples),'maxEarthRangeErrorM':max(s.get('rangeErrorKm',0) for s in samples)*1000,'maxEarthRadiusErrorDeg':max(s['radiusErrorDeg'] for s in samples if s['body']=='399')},'terrainStencils':stencils,'registeredAssetHashes':hashes,'producer':{'knownFinite':bool(np.isfinite(known).all()),'missingNorthRayUnknownAtAllThreeHeights':bool(np.isnan(hole[:,0]).all()),'finiteCoarseFallbackPreserved':bool(np.array_equal(known,fallback))},'radial':radial}
(HERE/'reference.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['earthRange','summary','producer','radial']},indent=2))
