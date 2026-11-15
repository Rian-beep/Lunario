"""Read-only identity inventory; a matching SHA256 does not establish accuracy."""
import base64
import hashlib
import json
import struct
from pathlib import Path

root = Path('public/data')
manifest = json.loads((root / 'evidence-manifest.json').read_text())
entries = {e['id'].removeprefix('asset:'): e for e in manifest['entries'] if e['id'].startswith('asset:')}
assets = []
for path in sorted(root.rglob('*')):
    if not path.is_file():
        continue
    key = str(path)
    digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    entry = entries.get(key) or entries.get(str(path.relative_to(root)))
    embedded = {}
    if path.suffix == '.json':
        value = json.loads(path.read_text())
        if isinstance(value, dict):
            embedded = {k: value[k] for k in ('schemaVersion','version','id','datasetId','retrievedUtc','generatedUtc','frame') if k in value}
            for section in ('source', 'meta'):
                if isinstance(value.get(section), dict):
                    embedded[section] = {k: value[section][k] for k in ('productId','version','url','labelUrl','sha256','labelSha256','frame','generatedUtc','demFine','demCoarse','t0','t1') if k in value[section]}
    assets.append({'path': key, 'bytes': path.stat().st_size, 'sha256': digest,
                   'embeddedProvenance':embedded,
                   'manifestVersion':entry.get('version') if entry else None,
                   'manifestSourceUrl':entry.get('sourceUrl') if entry else None,
                   'manifestFrame':entry.get('frame') if entry else None,
                   'manifestSha256': entry.get('sha256') if entry else None,
                   'manifestMatches': digest == entry['sha256'] if entry and entry.get('sha256') else None})
terrain = json.loads((root / 'terrain.json').read_text())
grids = []
for g in [terrain['overview'], *terrain['patches']]:
    raw = base64.b64decode(g['encodedHeights'], validate=True)
    values = [v[0] for v in struct.iter_unpack('<h', raw)]
    valid = [g['heightOffsetM'] + v*g['heightScaleM'] for v in values if v != -32768]
    assert len(values) == g['width']*g['height']
    grids.append({'id': g['id'], 'lod': g.get('lod'), 'samples': len(values),
                  'unknown': values.count(-32768), 'minM': min(valid), 'maxM': max(valid),
                  'sourceUrl': g.get('sourceUrl', terrain['source']), 'sourcePixelM': g['inputPixelM'],
                  'stepXM': g['stepM'], 'stepYM': g.get('stepYM',g['stepM']),
                  'encodingScaleM':g['heightScaleM']})
output = {'baseline':'96079ae','assets':assets,'terrainGrids':grids,
          'missingSourceIdentity':['Original polar COG complete hashes and immutable version IDs',
                                   'Original 40/240 m horizon DEM bytes',
                                   'Pixelwise EFFRES and ERR products',
                                   'Original catalog Horizons response headers/requests'],
          'scope':'Asset integrity and encoding inventory only; no physical accuracy implication.'}
Path('docs/qa/scientific-audit/sources/inventory.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps({'assets':len(assets),'bytes':sum(a['bytes'] for a in assets),
                  'manifestMatches':sum(a['manifestMatches'] is True for a in assets),
                  'manifestMismatches':sum(a['manifestMatches'] is False for a in assets),
                  'polarGrids':len(grids),'polarSamples':sum(g['samples'] for g in grids),
                  'polarUnknown':sum(g['unknown'] for g in grids)}))
