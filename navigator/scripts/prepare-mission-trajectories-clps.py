#!/usr/bin/env python3
"""Bounded PDS reconstructed descents; raw kernels stay in /tmp.
uv run --python 3.12 --with spiceypy==8.4.0 scripts/prepare-mission-trajectories-clps.py [--check]
No science receipts, old conversion manifest or application packages are written.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as XML
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/lunario-eval-trajectory-sources')
BASE = 'https://naif.jpl.nasa.gov/pub/naif/pds/pds4/clps/clps_spice/'
GENERIC = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
MODELS = [
    ('naif0012.tls', GENERIC+'lsk/naif0012.tls', '678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b'),
    ('pck00011.tpc', GENERIC+'pck/pck00011.tpc', '3dff7b1dbeceaa01f25467767d3fa25816051c85d162d1edf04acb310ee28bb1'),
]
SPECS = [
    dict(site='odysseus', vehicle='Odysseus NOVA-C lander (-370011)', target=-370011, labelSha='e4c0124ba1c7ead51e311e98298de0821b9b2d402df0309ad05a3c05ac72a5f3',
         file='clps_to2im_im1_edl_rec_240222_v01.bsp', sha='f8bac55717f7f9c3f782429b61abf742bd846f72ccd26b9cf11ade640ff8e557',
         uncertainty='Provider reports 100 m position uncertainty (3-sigma) for powered descent. This is a provider estimate, not an independently calibrated error or a display interpolation bound.',
         pedigree='IM postflight reconstruction: downlinked onboard navigation acceleration profile anchored to contact point and processed with prior ground tracking.',
         missing='No launch, complete transfer, lunar ascent or post-contact settling. Source endpoint is not a terrain contact qualification.'),
    dict(site='blue-ghost-1', vehicle='Blue Ghost 1 lander (-2711)', target=-2711, labelSha='158c74649bf2ff5f8a23dc22523277e3e4a330643c634c01a50ad4fc688bef54',
         file='clps_to19d_bgm1_edl_rec_250302_v01.bsp', sha='234b0b92328cc1c8aca169bdec990203bd3c37e6a276bcdaf826d8642233bf29',
         uncertainty='Physical trajectory accuracy and covariance are not supplied in the kernel comments. Reported 0.31 m median / 7.5 m 99th-percentile differences from the original smoothed SPK are conversion comparisons, not physical uncertainty.',
         pedigree='Firefly 20 Hz onboard navigation-filter telemetry (IMU, vision navigation, laser rangefinder), smoothed/downsampled; CLPS repackaged as degree-3 Type-13 Hermite SPK.',
         missing='No launch, full transfer, lunar ascent or post-landing operations. No claim that each displayed sample is a raw telemetry measurement.'),
    dict(site='athena', vehicle='Athena NOVA-C lander (-370021)', target=-370021, labelSha='7bc0e86c6d4bb25a985ae58dbe364fc2dcff6a027f5c770939ce87062818e009',
         file='clps_prime1_im2_edl_rec_250306_v01.bsp', sha='d8c8540bdbceb895b2ac04945791127e7a5846113f974e988701971a9c254ba9',
         uncertainty='The comments give transit/LLO error estimates, not a descent-specific covariance or calibrated EDL bound. Do not apply the LLO maximum 250 m position error to descent.',
         pedigree='IM/KinetX Best Estimated Trajectory orbit determination using radiometric tracking, IMU, DPOS, near-landing imagery and estimated first contact location; split at powered descent initiation.',
         missing='Source warns of no EDL states between first contact (2025-03-06 17:28:42 UTC) and final landed orientation (~17:28:50 UTC). No settling, attitude, launch or ascent is inferred.'),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(name, url, expected):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            data = response.read(20_000_001)
        if len(data) > 20_000_000 or digest(data) != expected:
            raise ValueError('Downloaded source size/hash mismatch: '+name)
        path.write_bytes(data)
    if digest(path.read_bytes()) != expected:
        raise ValueError('Cached source hash mismatch: '+name)
    return path, dict(url=url, version=name, sha256=expected)


def segments(path, target):
    handle = spice.dafopr(str(path))
    result = []
    try:
        spice.dafbfs(handle)
        while spice.daffna():
            times, ints = spice.dafus(spice.dafgs(), 2, 6)
            # Reject unexpected body, centre or frame instead of resolving another data chain.
            if list(ints[:3]) != [target, 301, 1]:
                raise ValueError('Expected direct Moon-centred J2000 segment')
            result.append(dict(startEt=float(times[0]), endEt=float(times[1]), spkType=int(ints[3])))
    finally:
        spice.dafcls(handle)
    return result


def bounded_times(start, end, cadence=5):
    # Schema 1 has whole-second calendar epochs. Trim inward, never round out of coverage.
    start, end = math.ceil(start), math.floor(end)
    if start >= end:
        raise ValueError('Insufficient coverage')
    times = list(range(start, end, cadence)) + [end]
    return start, times


def convert(spec, models):
    path, source = fetch(spec['file'], BASE+'spice_kernels/spk/'+spec['file'], spec['sha'])
    label_name = spec['file'].replace('.bsp','.xml')
    label_path, label_source = fetch(label_name, BASE+'spice_kernels/spk/'+label_name, spec['labelSha'])
    ns = {'p':'http://pds.nasa.gov/pds4/pds/v1'}
    label = XML.fromstring(label_path.read_bytes())
    label_file = label.find('.//p:file_name',ns).text
    label_md5 = label.find('.//p:md5_checksum',ns).text
    if label_file != path.name or hashlib.md5(path.read_bytes()).hexdigest() != label_md5:
        raise ValueError('Source does not match PDS product label')
    segs = segments(path, spec['target'])
    intervals = list(spice.spkcov(str(path), spec['target']))
    if len(intervals) != 2:
        raise ValueError('Only a single continuous coverage interval may be extracted')
    start, times = bounded_times(*intervals)
    spice.furnsh(str(path))
    def state(et, frame='IAU_MOON'):
        return list(map(float, spice.spkezr(str(spec['target']), et, frame, 'NONE', '301')[0]))
    samples = []
    transform_error = 0
    roundtrip_error = 0
    for et in times:
        raw = state(et, 'J2000')
        fixed = list(map(float, spice.mxvg(spice.sxform('J2000', 'IAU_MOON', et), raw)))
        direct = state(et)
        transform_error = max(transform_error, max(abs(x-y) for x,y in zip(fixed, direct)))
        inverse = spice.mxvg(spice.sxform('IAU_MOON', 'J2000', et), fixed)
        roundtrip_error = max(roundtrip_error, max(abs(x-y) for x,y in zip(raw, inverse)))
        samples.append(dict(t=et-start, position=[round(x,10) for x in fixed[:3]], velocity=[round(x,10) for x in fixed[3:]]))
    midpoint_errors = []
    velocity_errors = []
    for a,b in zip(samples,samples[1:]):
        mid = start+(a['t']+b['t'])/2
        direct = state(mid)
        midpoint_errors.append(math.dist(direct[:3], [(x+y)/2 for x,y in zip(a['position'],b['position'])]))
        velocity_errors.append(math.dist(direct[3:], [(x+y)/2 for x,y in zip(a['velocity'],b['velocity'])]))
    # Differentiate source position in the rotating frame to check velocity terms.
    derivative_error = max(math.dist(state(et)[3:], [(b-a)/.02 for a,b in zip(state(et-.01)[:3],state(et+.01)[:3])]) for et in times[1:-1])
    fixtures = [dict(t=et-start, inertialState=state(et,'J2000'), fixedState=state(et)) for et in [times[0], times[len(times)//2], times[-1]]]
    if transform_error > 1e-8 or roundtrip_error > 1e-8:
        raise ValueError('Frame conversion check failed')
    id = spec['site']+'-descent-reconstructed'
    data = dict(schemaVersion=1, id=id, missionId=spec['site'], siteId=spec['site'], vehicle=spec['vehicle'],
        kind='reconstructed', phase='descent',
        epoch=dict(calendar=spice.timout(start,'YYYY-MM-DDTHR:MN:SC ::TDB'), scale='TDB', utc=spice.et2utc(start,'ISOC',3)+'Z'),
        frame=dict(center='MOON', centerId=301, name='IAU_MOON', type='body-fixed', sourceFrame='J2000',
                   positionUnit='km', velocityUnit='km/s', transform='SPICE sxform J2000 -> IAU_MOON; pck00011.tpc; geometric NONE; native SPK centre 301'),
        coverage=dict(start=0, end=times[-1]-start, cadenceSeconds=5, interpolation='linear', maxGapSeconds=5, extrapolation='forbidden'),
        sources=[source,*models], uncertainty=spec['pedigree']+' '+spec['uncertainty'],
        missing=[spec['missing'], 'IAU_MOON versus planning-map ME registration is unqualified; no snapping, contact or historical lighting claim.',
                 'No attitude, thrust, individual burns or covariance inferred from positions.', 'Whole-second TDB extract trims less than one second at each source edge; linear interpolation is for display only.'],
        attitude='unavailable', samples=samples)
    receipt = dict(id=id, source=source, pdsLabel=dict(**label_source, kernelMd5=label_md5, matchesKernel=True), segments=segs, sourceCoverageEt=intervals,
        sourceCoverageUtc=[spice.et2utc(t,'ISOC',6)+'Z' for t in intervals], extractCoverageEt=[times[0],times[-1]],
        sampleCount=len(samples), midpointCount=len(midpoint_errors),
        maximumMidpointPositionDiscrepancyKm=max(midpoint_errors), maximumMidpointVelocityDiscrepancyKmS=max(velocity_errors),
        maximumDirectTransformComponentDiscrepancy=transform_error, maximumInverseTransformComponentDiscrepancy=roundtrip_error,
        maximumSourceVelocityFiniteDifferenceDiscrepancyKmS=derivative_error, fixtures=fixtures)
    spice.unload(str(path))
    return data, receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='recompute from hash-pinned sources and compare committed outputs')
    args = parser.parse_args()
    models = []
    spice.kclear()
    try:
        for name,url,sha in MODELS:
            path,source = fetch(name,url,sha)
            spice.furnsh(str(path)); models.append(source)
        receipts = []
        outputs = {}
        for spec in SPECS:
            data,receipt = convert(spec,models)
            rel = 'public/data/trajectories/'+data['id']+'.json'
            encoded = json.dumps(data,indent=2)+'\n'
            outputs[rel] = encoded
            receipt['artifactSha256'] = digest(encoded.encode())
            receipts.append(receipt)
        outputs['docs/qa/evaluation/trajectories/clps-conversion.json'] = json.dumps(dict(
            toolkit=spice.tkvrsn('TOOLKIT'), spiceypy=spice.__version__, models=models,
            scope='Independent evaluations against the same hash-pinned source, not independent tracking observations or physical accuracy. Midpoint checks are finite comparisons, not bounds at every time. Source SPKs already use Moon centre 301; no planetary SPK translation required. No attitude kernels loaded.',
            datasets=receipts),indent=2)+'\n'
        for rel,encoded in outputs.items():
            path = ROOT/rel
            if args.check:
                if not path.exists() or path.read_text() != encoded:
                    raise ValueError('Reproduction mismatch: '+rel)
            else:
                path.parent.mkdir(parents=True,exist_ok=True); path.write_text(encoded)
        print(('Verified' if args.check else 'Wrote')+' 3 reconstructed descents; '+str(sum(r['sampleCount'] for r in receipts))+' samples; '+str(sum(r['midpointCount'] for r in receipts))+' source midpoint comparisons')
        for receipt in receipts:
            print(receipt['id'],receipt['sampleCount'],'samples; maximum midpoint position discrepancy (km):',receipt['maximumMidpointPositionDiscrepancyKm'])
    finally:
        spice.kclear()

if __name__ == '__main__':
    main()
