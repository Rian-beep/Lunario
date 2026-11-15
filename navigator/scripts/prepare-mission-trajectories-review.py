#!/usr/bin/env python3
"""Archive primary-source response identities; full downloads stay under /tmp."""
import datetime
import hashlib
import json
import pathlib
import urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path('/tmp/lunario-trajectory-source-review')
CACHE.mkdir(exist_ok=True)
SOURCES = [
('svs14959', 'https://svs.gsfc.nasa.gov/14959/', 'Moon model geometry; no flight positions.'),
('svs5632', 'https://svs.gsfc.nasa.gov/5632/', 'Flight-derived Artemis II flyby visualization; not a lunar landing. Numeric ephemeris link is a follow-up, not imported here.'),
('svs5610', 'https://svs.gsfc.nasa.gov/5610/', 'Nominal reference Artemis II flyby; not flown landing telemetry.'),
('svs5535', 'https://svs.gsfc.nasa.gov/5535/', 'CSM osculating elements interpreted from mission-report tables; not LM descent. Coordinate switches and errors explicitly discussed.'),
('apollo-naif', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/', 'Index has Apollo 15 CSM and Apollo 16 subsatellite; no lander kernel identified.'),
('apollo15-comments', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/apollo15-1.cmt', 'Confirms CSM identity, J2000, two coverage intervals and reconstruction limitations.'),
('apollo16-comments', 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/a16_subsat_ssd_lp150q.cmt', 'Non-propulsive subsatellite, with segment discontinuities. Not the LM.'),
('apollo-pds', 'https://pds-geosciences.wustl.edu/missions/apollo/', 'PDS lists 15/16/17 camera-support ephemerides from orbit. Not lander paths.'),
('apollo-image-ephemeris', 'https://apollo.im-ldi.com/EPHEMERIS/', 'Returned temporarily unavailable page; no dataset obtained.'),
('apollo11-bet1', 'https://ntrs.nasa.gov/api/citations/19700014995/downloads/19700014995.pdf', 'Foreword says NAT listing is in Volume II, not generally distributed, available by request at publication. Volume I alone is not a sampled final-descent path.'),
('apollo11-report', 'https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf', 'Sections 5.1/5.3/5.6/5.7 document descent rationale, avoidance, ascent and rendezvous.'),
('apollo-experience', 'https://ntrs.nasa.gov/api/citations/19720018205/downloads/19720018205.pdf', 'NASA TN D-6846, June 1972; mission planning and Apollo 12 navigation correction rationale.'),
('apollo11-2022', 'https://ntrs.nasa.gov/api/citations/20220007267/downloads/NASA-TM-20220007267.pdf', 'NASA/TM-20220007267 reconstructs planar descent from digitized graphics; not direct time-tagged global 3D telemetry. No numeric attachment identified.'),
('ch3-isro', 'https://www.isro.gov.in/Chandrayaan3_Details.html', 'Primary country agency: vehicle capabilities and touchdown limits; no sampled global path here. Header Horizons slope 120 degrees conflicts with this 12 degree specification and is not used.'),
('ch3-sequence', 'https://www.isro.gov.in/NSPD2025/assets/pdf/CH3_Landing_Brochure.pdf', 'ISRO phase diagram documents rough/fine braking and terminal descent; not sampled telemetry.'),
('ch3-india-presentation', 'https://www.unoosa.org/documents/pdf/copuos/stsc/2024/ListTechnicalPresentations/2024_STSC_technical_presentations_slides/9_26_--_4_INDIA_Chandrayaan3.pdf', 'Government of India STSC 2024 presentation, slide 10 landing sequence; primary country presentation hosted by UNOOSA, directly downloaded and visually verified.'),
('ch3-archive', 'https://pradan.issdc.gov.in/ch3/', 'ISRO archive describes landed payload products; no final-descent tracking-fit product identified on landing page. Authentication not bypassed.'),
('slim-jaxa', 'https://darts.isas.jaxa.jp/en/missions/slim', 'JAXA archive dataset list says in preparation. No numeric descent product obtained.'),
('horizons-news', 'https://ssd.jpl.nasa.gov/dat/horizons_news.txt', '2023 announcements identify initial pre-launch solution and distinguish -158 lander from -169 propulsion module; not proof of final descent fit.'),
('horizons-manual', 'https://ssd.jpl.nasa.gov/horizons/manual.html', 'Spacecraft trajectories may mix tracking fits and predictions; not live telemetry.'),
]
rows = []
for key, url, finding in SOURCES:
    row = dict(id=key, url=url, finding=finding, retrievedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat())
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            data = response.read()
            row.update(httpStatus=response.status, finalUrl=response.url, contentType=response.headers.get('Content-Type'), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            (CACHE/key).write_bytes(data)
    except Exception as error:
        row.update(error=str(error))
    rows.append(row)
    print(key, row.get('httpStatus', row.get('error')))
rows.append(dict(id='apollo11-old-journal-link', url='https://www.nasa.gov/wp-content/uploads/static/history/afj/ap11fj/pdf/19700014995_as11-trajectory-reconstruction-vol1.pdf', httpStatus=404, finding='Observed 404 during investigation; resolved to verified NTRS document, not guessed adjacent URLs.'))
(ROOT/'docs/qa/trajectories/source-attempts.json').write_text(json.dumps(rows, indent=2)+'\n')
