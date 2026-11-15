#!/usr/bin/env python3
"""Re-query bounded primary-source archive entry points; preserve responses only in /tmp."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path('/tmp/lunario-eval-trajectory-review')
CLPS = 'https://naif.jpl.nasa.gov/pub/naif/pds/pds4/clps/clps_spice/'
SOURCES = [
    ('apollo-index', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/', ['apollo-11','apollo-12','apollo-14','apollo-15','apollo-16','apollo-17'], 'Only Apollo 15 CSM and Apollo 16 subsatellite SPKs listed. No LM descent or ascent kernel.'),
    ('apollo15-comment', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/apollo15-1.cmt', ['apollo-15'], 'CSM reconstruction, not LM. Existing extract retained unchanged.'),
    ('apollo16-comment', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/a16_subsat_ssd_lp150q.cmt', ['apollo-16'], 'Subsatellite orbit, not lunar module. Not imported as a landing.'),
    ('apollo-pds', 'https://pds-geosciences.wustl.edu/missions/apollo/', ['apollo-15','apollo-16','apollo-17'], 'Photographic camera-support ephemerides are orbital context, not LM ascent/descent.'),
    ('apollo11-ntrs', 'https://ntrs.nasa.gov/citations/19700014995', ['apollo-11'], 'Trajectory reconstruction Volume I; prior reviewed foreword places numeric NAT/BET listing in Volume II. No new Volume II numeric attachment obtained.'),
    ('apollo11-final', 'https://ntrs.nasa.gov/citations/20220007267', ['apollo-11'], 'Final-descent reconstruction from sparse graphics; no global time-tagged 3D state table obtained. No digitized plot points imported.'),
    ('clps-index', CLPS+'spice_kernels/spk/', ['odysseus','blue-ghost-1','athena'], 'Separate reconstructed EDL kernels for IM-1, BGM-1, IM-2. Cruise, predicted, landing-site and offset kernels are distinct products.'),
    ('clps-wrong-data-path', CLPS+'data/spk/', ['odysseus','blue-ghost-1','athena'], 'Initial guessed data/spk path returned 404; resolved from bundle index to spice_kernels/spk. This failed URL is not evidence of absent EDL products.'),
    ('clps-document', CLPS+'document/spiceds_v004.html', ['odysseus','blue-ghost-1','athena'], 'Archive version 4 documents reconstructed and predicted SPKs separately. Dates describe kernel coverage, not complete flight.'),
    ('im1-label', CLPS+'spice_kernels/spk/clps_to2im_im1_edl_rec_240222_v01.xml', ['odysseus'], 'PDS EDL product identity; binary comments establish postflight reconstruction and provider 100 m (3-sigma) position estimate.'),
    ('bg1-label', CLPS+'spice_kernels/spk/clps_to19d_bgm1_edl_rec_250302_v01.xml', ['blue-ghost-1'], 'PDS reconstructed EDL product; source-versus-repackaging differences are not measurement errors.'),
    ('im2-label', CLPS+'spice_kernels/spk/clps_prime1_im2_edl_rec_250306_v01.xml', ['athena'], 'PDS reconstructed EDL product; no states from first contact to final landed orientation. No descent uncertainty borrowed from LLO.'),
    ('lro-geosciences', 'https://pds-geosciences.wustl.edu/missions/lro/', [], 'LRO orbital ephemerides available from FDT and LOLA precision orbit solutions. They describe LRO, not landers seen in LROC images; no duplicate orbital extract added.'),
    ('lro-wrong-pds4-path', 'https://naif.jpl.nasa.gov/pub/naif/pds/pds4/lro/', [], 'Attempted PDS4 location; HTTP failure recorded. Correct mission entry point is the PDS Geosciences page.'),
    ('lro-wrong-operational-path', 'https://naif.jpl.nasa.gov/pub/naif/LRO/kernels/spk/', [], 'Attempted operational location; HTTP failure recorded, not interpreted as absence of LRO ephemerides.'),
    ('slim-mission', 'https://darts.isas.jaxa.jp/en/missions/slim', ['slim'], 'Mission page says dataset list in preparation. No downloadable descent samples obtained.'),
    ('slim-catalog', 'https://darts.isas.jaxa.jp/app/catalog/?q=slim', ['slim'], 'Client-rendered catalogue shell is not evidence of no datasets. No numeric state product obtained from this response.'),
    ('slim-old-path', 'https://darts.isas.jaxa.jp/planet/project/slim/', ['slim'], 'Attempted legacy path; retrieval outcome recorded without inferring data absence.'),
    ('ch3-release', 'https://www.isro.gov.in/Release_of_Chandrayaan-3_science_data_to_the_Scientific_Community.html', ['chandrayaan-3'], 'Science data release announces lander/rover payload archive, not a documented final descent tracking-fit table.'),
    ('ch3-archive', 'https://pradan.issdc.gov.in/ch3/', ['chandrayaan-3'], 'Public archive entry point checked. No authenticated data requested or bypassed; no new descent reconstruction qualified.'),
    ('bg1-rationale', 'https://www.nasa.gov/blogs/missions/2025/03/02/blue-ghost-begins-9-minute-braking-burn/', ['blue-ghost-1'], 'NASA describes braking, final descent and visual hazard selection. Does not identify commands for every state sample.'),
    ('im2-mission', 'https://www.intuitivemachines.com/im-2', ['athena'], 'Mission-country operator narrative for orbit lowering and descent targeting; phase rationale, not independent numeric tracking.'),
    ('naif-rules', 'https://naif.jpl.nasa.gov/naif/rules.html', [], 'SPICE distribution and software-use rules reviewed; numeric facts extracted, no Toolkit mirrored or redistributed.'),
    ('naif-credit', 'https://naif.jpl.nasa.gov/naif/credit.html', [], 'Credit source producers as well as NAIF/PDS, following kernel comments.'),
    ('nasa-data-license', 'https://science.data.nasa.gov/about/license', [], 'NASA-led mission science/engineering/auxiliary data default CC0 absent restrictive notice; commercial provider copyrights are not assumed waived for prose, logos or imagery.'),
]


def retrieve(item):
    key,url,sites,finding = item
    row = dict(id=key,url=url,siteIds=sites,finding=finding,retrievedUtc=datetime.now(timezone.utc).isoformat())
    try:
        with urllib.request.urlopen(url,timeout=30) as response:
            data=response.read(2_000_001)
            if len(data)>2_000_000:
                raise ValueError('Source review response exceeds 2 MB limit')
            row.update(httpStatus=response.status,finalUrl=response.url,contentType=response.headers.get('Content-Type'),bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
        (CACHE/key).write_bytes(data)
    except Exception as error:
        row.update(httpStatus=getattr(error,'code',None),error=str(error))
    return row


if __name__=='__main__':
    CACHE.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows=list(pool.map(retrieve,SOURCES))
    out=ROOT/'docs/qa/evaluation/trajectories/source-attempts.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(rows,indent=2)+'\n')
    for row in rows:
        print(row['id'],row.get('httpStatus'),row.get('error',''))
