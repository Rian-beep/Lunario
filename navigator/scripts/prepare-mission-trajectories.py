#!/usr/bin/env python3
"""Run: uv run --python 3.12 --with spiceypy scripts/prepare-mission-trajectories.py.
Raw kernels remain in /tmp. No SPICE package is added to the application.
"""
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
import spiceypy as spice

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/trajectories'
CACHE = pathlib.Path('/tmp/lunario-trajectory-sources')
CACHE.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)

def get(name, url):
    path = CACHE / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    return data, {'url': url, 'version': name, 'sha256': hashlib.sha256(data).hexdigest()}

kernels = []
for name, url in [
    ('naif0012.tls', 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls'),
    ('pck00011.tpc', 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc'),
    ('apollo15-1.bsp', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/apollo15-1.bsp'),
]:
    _, source = get(name, url)
    kernels.append(source)
    spice.furnsh(str(CACHE / name))

params = dict(COMMAND='-158', MAKE_EPHEM='YES', EPHEM_TYPE='VECTORS', CENTER='500@301',
    START_TIME='2023-08-23 12:16:00', STOP_TIME='2023-08-23 12:34:00', STEP_SIZE='108',
    REF_PLANE='FRAME', REF_SYSTEM='ICRF', OUT_UNITS='KM-S', VEC_TABLE='2',
    VEC_CORR='NONE', CSV_FORMAT='YES', TIME_TYPE='TDB')
url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(
    {'format': 'text', **{key: "'" + value + "'" for key, value in params.items()}})
raw, chsource = get('ch3-descent-horizons.txt', url)
text = raw.decode()
for expected in ['Chandrayaan-3 (LANDER spacecraft) (-158)', 'Center body name: Moon (301)',
                 'Output units    : KM-S', 'Reference frame : ICRF',
                 'Output type     : GEOMETRIC cartesian states', 'Calendar Date (TDB)']:
    if expected not in text:
        raise ValueError('Unexpected source identity/format: ' + expected)
rows = text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()
if len(rows) != 109:
    raise ValueError('Expected 109 bounded Horizons samples')
# Raw responses remain in /tmp; only bounded, structured numeric outputs are archived.

def transform(state, et):
    # ICRF is treated as J2000 by SPICE. IAU_MOON is NOT the lunar ME/DE421 frame.
    return [round(float(x), 10) for x in spice.mxvg(spice.sxform('J2000', 'IAU_MOON', et), state)]

def dataset(id, mission, site, vehicle, kind, phase, epoch, cadence, states, sources, uncertainty, missing):
    et = spice.str2et(epoch.replace('T', ' ') + ' TDB')
    samples = []
    for t, state in states:
        fixed = transform(state, et + t)
        samples.append({'t': t, 'position': fixed[:3], 'velocity': fixed[3:]})
    return dict(schemaVersion=1, id=id, missionId=mission, siteId=site, vehicle=vehicle,
        kind=kind, phase=phase, epoch=dict(calendar=epoch, scale='TDB',
            utc=spice.et2utc(et, 'ISOC', 3) + 'Z'),
        frame=dict(center='MOON', centerId=301, name='IAU_MOON', type='body-fixed',
            sourceFrame='ICRF/J2000', positionUnit='km', velocityUnit='km/s',
            transform='SPICE sxform J2000 -> IAU_MOON; pck00011.tpc; geometric NONE'),
        coverage=dict(start=0, end=states[-1][0], cadenceSeconds=cadence,
            interpolation='linear', maxGapSeconds=cadence, extrapolation='forbidden'),
        sources=sources, uncertainty=uncertainty, missing=missing, attitude='unavailable', samples=samples)

states = []
for i, row in enumerate(rows):
    fields = row.split(',')
    if len(fields) != 9:
        raise ValueError('Unexpected Horizons CSV record')
    # Check the published Julian dates, rather than silently trusting array order.
    if abs((float(fields[0]) - float(rows[0].split(',')[0])) * 86400 - i * 10) > .0001:
        raise ValueError('Unexpected source time spacing')
    states.append((i * 10, [float(x) for x in fields[2:8]]))
source_vectors = dict(source=chsource, center='MOON', frame='ICRF', positionUnit='km', velocityUnit='km/s', timeScale='TDB', rows=[dict(julianDateTdb=float(row.split(',')[0]), positionKm=state[:3], velocityKmS=state[3:]) for row, (_, state) in zip(rows, states)])
(OUT / 'ch3-source-vectors.json').write_text(json.dumps(source_vectors, indent=2)+'\n')
ch = dataset('chandrayaan-3-descent-reference', 'chandrayaan-3', 'chandrayaan-3', 'Vikram lander (-158)',
    'reference', 'descent', '2023-08-23T12:16:00', 10, states, [chsource, *kernels[:2]],
    'Published ISRO/JPLNAV post-launch ephemeris, source chandrayaan-3_lander_mer. Fit versus prediction for final descent is unresolved; no covariance or certified as-flown accuracy supplied.',
    ['Earth launch, lunar ascent and hop are outside this extract.', 'No attitude, throttle, individual burns or hazard-avoidance commands.',
     'IAU_MOON versus map ME frame offset is unresolved; do not snap the endpoint to a site pin.',
     'Linear interpolation error is not a measurement uncertainty.'])
start = spice.str2et('1971 JUL 30 18:00:00 TDB')
states = []
for t in range(0, 1801, 10):
    state, _ = spice.spkezr('-915', start + t, 'J2000', 'NONE', '301')
    states.append((t, state))
a15 = dataset('apollo-15-csm-orbit-reconstructed', 'apollo-15', 'apollo-15', 'Command and service module (-915)',
    'reconstructed', 'orbit', '1971-07-30T18:00:00', 10, states, [kernels[2], *kernels[:2]],
    'JPL Konopliv reconstruction for camera support, not improved over original estimates according to kernel comments; covariance unavailable.',
    ['Not the lunar module. No descent, touchdown, surface launch or ascent.',
     'Only 30 minutes of one continuous source interval, not the full mission.',
     'No spacecraft attitude. IAU_MOON versus map ME registration remains unresolved.'])
for data in [ch, a15]:
    (OUT / (data['id'] + '.json')).write_text(json.dumps(data, indent=2) + '\n')
manifest = dict(toolkit=spice.tkvrsn('TOOLKIT'), spiceypy=spice.__version__,
    kernels=kernels, horizons=chsource, choices='NONE geometric; Moon center 301; TDB elapsed seconds; full state sxform includes lunar rotation velocity terms; IAU_MOON, not ME.',
    sourceIntervals=[list(spice.spkcov(str(CACHE/'apollo15-1.bsp'), -915))],
    artifacts=[dict(path=str(path.relative_to(ROOT)), sha256=hashlib.sha256(path.read_bytes()).hexdigest()) for path in sorted(OUT.glob('*.json'))])
(ROOT / 'docs/qa/trajectories/conversion.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Wrote', len(ch['samples']), 'reference descent and', len(a15['samples']), 'reconstructed CSM orbit samples')
# Compare display interpolation with the source evaluated halfway between stored samples.
# This is interpolation discrepancy, NOT a physical uncertainty/certification.
import math
params['STEP_SIZE'] = '216'
mid_url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(
    {'format': 'text', **{key: "'" + value + "'" for key, value in params.items()}})
mid_raw, mid_source = get('ch3-descent-midpoints-horizons.txt', mid_url)
mid_rows = mid_raw.decode().split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()
if len(mid_rows) != 217:
    raise ValueError('Unexpected midpoint source count')
def discrepancy(data, source_positions):
    maximum = 0
    for i, position in enumerate(source_positions):
        a, b = data['samples'][i:i+2]
        error = math.dist(position, [(x+y)/2 for x,y in zip(a['position'], b['position'])])
        maximum = max(maximum, error)
    return maximum
ch_et = spice.str2et('2023 AUG 23 12:16:00 TDB')
ch_positions = [transform([float(x) for x in row.split(',')[2:8]], ch_et+(2*i+1)*5)[:3]
                for i, row in enumerate(mid_rows[1::2])]
a15_positions = []
for t in range(5, 1800, 10):
    state, _ = spice.spkezr('-915', start+t, 'IAU_MOON', 'NONE', '301')
    a15_positions.append(list(state[:3]))
validation = dict(referenceSource=mid_source,
    description='All segment midpoints compared to source evaluation; not a bound between checked times and not physical trajectory accuracy.',
    ch3=dict(midpoints=len(ch_positions), maximumPositionDiscrepancyKm=discrepancy(ch,ch_positions)),
    apollo15=dict(midpoints=len(a15_positions), maximumPositionDiscrepancyKm=discrepancy(a15,a15_positions)))
(ROOT / 'docs/qa/trajectories/interpolation.json').write_text(json.dumps(validation, indent=2)+'\n')
print(json.dumps(validation, indent=2))
