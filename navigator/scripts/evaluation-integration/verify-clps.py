"""Independently re-evaluate committed CLPS samples with CSPICE's fixed-frame API.

Usage: python verify-clps.py SOURCE_KERNEL_DIRECTORY [OUTPUT_JSON]
The source directory must contain the hash-pinned NASA/PDS kernels. No downloads,
extrapolation, frame registration or physical error claims are performed here.
"""
import datetime
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import spiceypy as spice

source_dir = Path(sys.argv[1])
results = []
for path in sorted(Path('public/data/trajectories').glob('*descent-reconstructed.json')):
    data = json.loads(path.read_text())
    spice.kclear()
    identities = []
    for source in data['sources']:
        if not source['version'].endswith(('.bsp', '.tls', '.tpc')):
            continue
        source_path = source_dir / source['version']
        digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
        assert digest == source['sha256'], f'Source identity differs: {source_path}'
        spice.furnsh(str(source_path))
        identities.append({'file': source_path.name, 'sha256': digest})
    assert data['frame']['name'] == 'IAU_MOON'
    assert data['frame']['centerId'] == 301
    assert data['frame']['positionUnit'] == 'km'
    assert data['frame']['velocityUnit'] == 'km/s'
    assert data['epoch']['scale'] == 'TDB'
    epoch = spice.str2et(data['epoch']['calendar'].replace('T', ' ') + ' TDB')
    target = re.search(r'\((-?\d+)\)', data['vehicle']).group(1)
    max_position = max_velocity = max_midpoint = 0.0
    for sample in data['samples']:
        state, _ = spice.spkezr(target, epoch + sample['t'], 'IAU_MOON', 'NONE', 'MOON')
        max_position = max(max_position, float(np.max(np.abs(state[:3] - sample['position']))))
        max_velocity = max(max_velocity, float(np.max(np.abs(state[3:] - sample['velocity']))))
    for left, right in zip(data['samples'], data['samples'][1:]):
        assert 0 < right['t'] - left['t'] <= data['coverage']['maxGapSeconds']
        mid = (left['t'] + right['t']) / 2
        state, _ = spice.spkezr(target, epoch + mid, 'IAU_MOON', 'NONE', 'MOON')
        linear = (np.array(left['position']) + right['position']) / 2
        max_midpoint = max(max_midpoint, float(np.linalg.norm(state[:3] - linear)))
    assert max_position < 1e-8, f'Committed positions differ: {path}'
    assert max_velocity < 1e-8, f'Committed velocities differ: {path}'
    assert data['samples'][0]['t'] == data['coverage']['start']
    assert data['samples'][-1]['t'] == data['coverage']['end']
    utc_residual = abs(spice.str2et(data['epoch']['utc'].replace('T', ' ').replace('Z', ' UTC')) - epoch)
    assert utc_residual < .001, f'UTC annotation differs: {path}'
    results.append({'id': data['id'], 'samples': len(data['samples']),
                    'artifactSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'sources': identities, 'maximumPositionComponentResidualKm': max_position,
                    'maximumVelocityComponentResidualKmS': max_velocity,
                    'maximumMidpointDisplayDiscrepancyKm': max_midpoint,
                    'utcAnnotationResidualSeconds': utc_residual})
spice.kclear()
assert len(results) == 3
report = {'checkedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'status': 'passed', 'method': 'CSPICE spkezr IAU_MOON NONE from hash-pinned PDS sources; independent API from producer sxform path',
          'qualification': 'Source transfer and bounded interpolation checks only; shared CSPICE/source models, no independent tracking observations, surface registration or contact qualification.',
          'positionComponentToleranceKm': 1e-8, 'velocityComponentToleranceKmS': 1e-8,
          'datasets': results}
text = json.dumps(report, indent=2) + '\n'
if len(sys.argv) > 2:
    Path(sys.argv[2]).write_text(text)
print(text)
