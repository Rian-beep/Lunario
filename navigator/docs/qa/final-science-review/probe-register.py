"""Negative integrity check in a disposable directory; never edits repo inputs.

Demonstrates whether the register compiler refuses stale comparison evidence.
Exit 0 means the probe ran, not that the compiler has a sound freshness gate.
"""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile

root = Path.cwd()
audit = Path('docs/qa/scientific-audit')
paths = [audit / lane / 'results.json' for lane in ['sources','ephemeris','resources','dynamics']]
paths += [audit/'integration'/name for name in ['earth-range-repair.json','ephemeris-after-input-repair.json','terrain-registration-after.json','dynamics-after.json','pipeline-after.json']]
paths += [audit/'sources/inventory.json',Path('public/data/catalog.json'),Path('public/data/terrain.json'),Path('public/data/evidence-manifest.json'),Path('lib/assessment.ts'),Path('scripts/compile-scientific-verification.py')]
with tempfile.TemporaryDirectory(prefix='lunario-register-review-') as tmp:
    scratch=Path(tmp)
    for p in paths:
        target=scratch/p
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(root/p,target)
    (scratch/'lib/generated').mkdir()
    p=scratch/'public/data/catalog.json'
    c=json.loads(p.read_text())
    b=bytearray(base64.b64decode(c['earthRangeKm']))
    old=struct.unpack_from('<f',b)[0]
    struct.pack_into('<f',b,0,old+100.)
    c['earthRangeKm']=base64.b64encode(b).decode()
    p.write_text(json.dumps(c)+'\n')
    run=subprocess.run([sys.executable,'scripts/compile-scientific-verification.py'],cwd=scratch,capture_output=True,text=True)
    assert run.returncode==0,run.stderr
    register=json.loads((scratch/audit/'VERIFICATION.json').read_text())
    assert register['counts']=={'verified':41,'uncertain':21,'failing':0}
    assert register['assetHashes']['public/data/catalog.json']==hashlib.sha256(p.read_bytes()).hexdigest()
    assert hashlib.sha256((root/'public/data/catalog.json').read_bytes()).hexdigest()!=register['assetHashes']['public/data/catalog.json']
    out={'probeCompleted':True,'status':'failing','finding':'Compiler emits newly stamped 41/21/0 for an intentionally changed input without refusing stale observer comparisons','scope':'Disposable copied catalog first Earth range +100 km; comparison receipts and manifest unchanged; production source/data untouched','compilerExitCode':run.returncode,'compilerCounts':register['counts'],'originalFirstRangeKm':old,'alteredFirstRangeKm':struct.unpack_from('<f',b)[0],'staleEphemerisReceiptSha256':json.loads((scratch/audit/'integration/ephemeris-after-input-repair.json').read_text())['catalogSha256'],'newlyClaimedCatalogSha256':register['assetHashes']['public/data/catalog.json']}
    # Isolate two numerical-status probes from the changed-input probe.
    shutil.copyfile(root/'public/data/catalog.json',p)
    terrain_path=scratch/audit/'integration/terrain-registration-after.json'
    t=json.loads(terrain_path.read_text());t['errorM']=1.;terrain_path.write_text(json.dumps(t))
    pipeline_path=scratch/audit/'integration/pipeline-after.json'
    t=json.loads(pipeline_path.read_text());t.update(fixed=False,unknownRayBecameFinite=True,missingRayHorizonDeg=-.16);pipeline_path.write_text(json.dumps(t))
    run=subprocess.run([sys.executable,'scripts/compile-scientific-verification.py'],cwd=scratch,capture_output=True,text=True)
    assert run.returncode==0,run.stderr
    bad=json.loads((scratch/audit/'VERIFICATION.json').read_text())
    out['failedReceiptProbe']={'compilerExitCode':run.returncode,'counts':bad['counts'],'claims':[{'id':r['id'],'status':r['status'],'observedError':r['observedError']} for r in bad['findings'] if r['id'] in ['S03','S10']]}
    Path('docs/qa/final-science-review/register-freshness.json').write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out,indent=2))
