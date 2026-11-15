#!/usr/bin/env bash
set -euo pipefail
# Reproduce the regression using unmodified baseline lib/ files and current fixtures.
repo_root=$(git rev-parse --show-toplevel)
nav_prefix=$(git rev-parse --show-prefix)
scratch=$(mktemp -d /tmp/audit-ephemeris-baseline.XXXXXX)
trap 'rm -rf "$scratch"' EXIT
scratch_nav="$scratch/$nav_prefix"
# git archive paths are evaluated relative to its working directory.
git -C "$repo_root" archive 96079ae "${nav_prefix}lib" "${nav_prefix}tsconfig.json" | tar -x -C "$scratch"
mkdir -p "$scratch_nav/scripts" "$scratch_nav/tests" "$scratch_nav/public/data" "$scratch_nav/docs/qa/scientific-audit/ephemeris"
ln -s "$PWD/node_modules" "$scratch_nav/node_modules"
cp scripts/audit-ephemeris.ts "$scratch_nav/scripts/"
cp scripts/audit-ephemeris-support.ts "$scratch_nav/scripts/"
cp tests/audit-ephemeris.test.ts "$scratch_nav/tests/"
cp public/data/catalog.json "$scratch_nav/public/data/"
cp docs/qa/scientific-audit/ephemeris/events.json "$scratch_nav/docs/qa/scientific-audit/ephemeris/"
cp -r docs/qa/scientific-audit/ephemeris/raw "$scratch_nav/docs/qa/scientific-audit/ephemeris/"
set +e
(cd "$scratch_nav" && ./node_modules/.bin/tsx --test tests/audit-ephemeris.test.ts) > "$scratch/baseline-tests.txt" 2>&1
status=$?
set -e
cat "$scratch/baseline-tests.txt"
if [[ "$status" != 1 ]] || ! rg -q '# pass 14' "$scratch/baseline-tests.txt" || ! rg -q '# fail 1' "$scratch/baseline-tests.txt" || ! rg -q 'not ok.*Earth semidiameter uses site distance' "$scratch/baseline-tests.txt"; then
  echo 'Baseline did not reproduce the single registered semidiameter failure' >&2
  exit 1
fi

# The current audit diagnostic needs a distance helper absent at baseline.
# Define that helper in the harness only; never alter the archived baseline lib.
python3 - "$scratch_nav/scripts/audit-ephemeris.ts" <<'PYDIAG'
import sys
p=sys.argv[1]
s=open(p).read().replace(',earthRangeAtSiteKm','')
s=s.replace('export async function runAudit', """function earthRangeAtSiteKm(lat:number,lon:number,elat:number,elon:number,rangeKm:number){
 const r=Math.PI/180,cos=Math.sin(lat*r)*Math.sin(elat*r)+Math.cos(lat*r)*Math.cos(elat*r)*Math.cos((elon-lon)*r);
 return Math.sqrt(rangeKm**2+1737.4**2-2*rangeKm*1737.4*cos);
}
export async function runAudit""")
open(p,'w').write(s)
PYDIAG
set +e
(cd "$scratch_nav" && ./node_modules/.bin/tsx scripts/audit-ephemeris.ts) > "$scratch/baseline-comparison.txt" 2>&1
status=$?
set -e
cat "$scratch/baseline-comparison.txt"
if [[ "$status" != 1 ]] || ! rg -q '"radiusFailures": 52' "$scratch/baseline-comparison.txt"; then
  echo 'Baseline did not reproduce the 52 failing Earth semidiameter samples' >&2
  exit 1
fi
