"""Record baseline/current identities without checking out or modifying other lanes."""
import hashlib
import json
from pathlib import Path
import subprocess

files=['lib/mission.ts','lib/dsn.ts','lib/station-weather-context.ts','lib/providers/comms.ts',
       'lib/engineering-evidence/communications.ts','lib/engineering-evidence/atmosphere.ts',
       'lib/engineering-evidence/uncertainty.ts','lib/engineering-screens.ts',
       'public/data/engineering-evidence/spice-reference.json']
prefix=subprocess.check_output(['git','rev-parse','--show-prefix'],text=True).strip()
rows=[]
for name in files:
    current=Path(name).read_bytes()
    baseline=subprocess.check_output(['git','show','96079ae:'+prefix+name])
    rows.append(dict(path=name,sha256=hashlib.sha256(current).hexdigest(),
                     baselineSha256=hashlib.sha256(baseline).hexdigest(),unchanged=current==baseline))
Path('docs/qa/scientific-audit/resources/input-identities.json').write_text(
    json.dumps(dict(baseline='96079ae',files=rows),indent=2)+'\n')
print(f"{sum(r['unchanged'] for r in rows)}/{len(rows)} numerical/source inputs unchanged")
