"""Bounded public primary-reference capture; no credentials or runtime app data."""
import datetime
import hashlib
import json
import sys
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'docs/qa/scientific-audit/dynamics/references'
SOURCES = {
    'nasa-specific-impulse.html': 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/',
    'nasa-rocket-equation.html': 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/',
    'nasa-newton.html': 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/',
    'nasa-free-fall.html': 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/free-falling-objects/',
    'jpl-parameters.html': 'https://ssd.jpl.nasa.gov/astro_par.html',
    'nasa-moon-facts.html': 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    'nist-codata-2022.txt': 'https://physics.nist.gov/cuu/Constants/Table/allascii.txt',
    'nasa-trajectories.html': 'https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/',
    'ntrs-landing-1964.json': 'https://ntrs.nasa.gov/api/citations/19640005067',
    'ntrs-apollo-gear-1972.json': 'https://ntrs.nasa.gov/api/citations/19720018253',
    'nasa-thermal.html': 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/',
    'nasa-plume.html': 'https://www.nasa.gov/plume-surface-interaction/',
}

def main():
    if '--check' in sys.argv:
        records = json.loads((ROOT / 'manifest.json').read_text())
        for item in records:
            if item.get('status') != 200 or 'sha256' not in item:
                raise ValueError(f"Uncaptured reference: {item['url']}")
            body = (ROOT / item['file']).read_bytes()
            if hashlib.sha256(body).hexdigest() != item['sha256'] or len(body) != item['bytes']:
                raise ValueError(f"Reference checksum mismatch: {item['file']}")
        print(f'{len(records)} archived primary responses: checksums verified offline')
        return
    ROOT.mkdir(parents=True, exist_ok=True)
    records = []
    for name, url in SOURCES.items():
        record = {'file': name, 'url': url, 'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=25) as response:
                body = response.read(2_000_001)
                if len(body) > 2_000_000:
                    raise ValueError('Reference exceeds 2 MB capture bound')
                record.update(status=response.status, finalUrl=response.url,
                              contentType=response.headers.get('Content-Type'),
                              lastModified=response.headers.get('Last-Modified'), etag=response.headers.get('ETag'),
                              bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
            (ROOT / name).write_bytes(body)
        except Exception as error:
            record['error'] = f'{type(error).__name__}: {error}'
        records.append(record)
        print(name, record.get('status', record.get('error')))
    (ROOT / 'manifest.json').write_text(json.dumps(records, indent=2) + '\n')

if __name__ == '__main__':
    main()
