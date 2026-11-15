"""Exercise the unchanged horizon pipeline without optional TIFF/Numba dependencies.
AST-selected pure functions execute with numpy; decorators are removed, not rewritten.
Synthetic evidence only: this demonstrates unknown-data policy, never lunar accuracy.
"""
import ast
import json
import math
from pathlib import Path
import numpy as np

source = Path('pipeline/build_dataset.py').read_text()
names = {'sample_dem', 'sample_surface', 'horizon_masks'}
nodes = [node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name in names]
for node in nodes:
    node.decorator_list = []
namespace = {'np': np, 'math': math, 'prange': range}
exec(compile(ast.Module(body=nodes, type_ignores=[]), 'pipeline/build_dataset.py', 'exec'), namespace)
# South pole, 40 m pixels, ray at 0 degrees walks upward along the raster.
dem = np.zeros((64, 64), dtype=np.float32)
kwargs = dict(ftie_x=-1280., ftie_y=1280., fscale=40., foff=.5,
              ctie_x=-1280., ctie_y=1280., cscale=40., coff=.5,
              lat_deg=-90., lon_deg=0., heights=np.array([2.]),
              az_step=360., near_step=40., mid_step=40., far_step=40., max_m=800.)
known = namespace['horizon_masks'](fine=dem, coarse=dem, **kwargs)[0][0, 0]
missing = dem.copy()
# One unobserved location on the ray; both source DEMs lack that sample.
missing[29:31, 31:33] = np.nan
partial = namespace['horizon_masks'](fine=missing, coarse=missing, **kwargs)[0][0, 0]
assert math.isfinite(known) and not math.isfinite(partial)
# At least eight other finite samples make an incomplete ray look complete.
result = {'method': 'AST-selected corrected Python functions; synthetic 64x64 terrain',
          'knownHorizonDeg': float(known), 'missingRayHorizonDeg': None if not math.isfinite(partial) else float(partial),
          'unknownRayBecameFinite': bool(math.isfinite(partial)),
          'expectedUnknown': True, 'fixed': not math.isfinite(partial),
          'limitation': 'No original polar DEM nodata prevalence inferred; pipeline is owned by ephemeris lane.'}
print(json.dumps(result, indent=2))
