"""Refresh bounded non-secret primary responses. Numerical tests use archived bytes offline.
Run with --refresh to explicitly replace source snapshots; inspect diff and rerun checks.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refresh', action='store_true')
args = parser.parse_args()
root = Path('docs/qa/scientific-audit/resources/sources')
manifest_path = root/'manifest.json'
rows = json.loads(manifest_path.read_text())
if args.refresh:
    for row in rows:
        try:
            with urllib.request.urlopen(row['url'], timeout=25) as response:
                data = response.read(8000001)
                if len(data)>8000000:
                    raise ValueError('Source exceeds 8 MB limit')
                metadata = dict(httpStatus=response.status, contentType=response.headers.get('Content-Type'),
                                etag=response.headers.get('ETag'), lastModified=response.headers.get('Last-Modified'))
            (root/row['file']).write_bytes(data)
            row.update(retrievedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),**metadata)
            row.pop('error',None)
        except Exception as error:
            row['error']=f'{type(error).__name__}: {error}'
    manifest_path.write_text(json.dumps(rows,indent=2)+'\n')
for row in rows:
    if 'error' in row:
        raise RuntimeError(row['error'])
    data=(root/row['file']).read_bytes()
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['file']
print(f"{len(rows)} archived source responses verified")
