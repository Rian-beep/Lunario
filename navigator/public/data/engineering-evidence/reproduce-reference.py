"""Independent CSPICE reference, not the application's geometry formula.
Run in isolated venv with spiceypy and numpy installed. Downloads ~39 MB to /tmp.
python reproduce-reference.py --check (compares committed independent fixture)
No project dependencies or catalog values are changed.
"""
import pathlib, urllib.request, json, hashlib, datetime, math, sys
import spiceypy as spice
import numpy as np
root=pathlib.Path('/tmp/solarreach-engineering-kernels'); root.mkdir(exist_ok=True)
base='https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
files=['lsk/naif0012.tls','pck/pck00011.tpc','pck/earth_000101_270208_261113.bpc','spk/planets/de440s.bsp']
kernels=[]
for name in files:
 p=root/name.split('/')[-1]
 if not p.exists(): urllib.request.urlretrieve(base+name,p)
 spice.furnsh(str(p)); kernels.append(dict(url=base+name,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
stations=[('goldstone',243+6/60+37.66244/3600,35+25/60+33.24312/3600,1.001390),('madrid',355+45/60+7.16924/3600,40+25/60+52.35510/3600,.864816),('canberra',148+58/60+52.56231/3600,-(35+24/60+8.72724/3600),.688867)]
rows=[]
for id,lon,lat,height in stations:
 lon,lat=map(math.radians,[lon,lat])
 pos=spice.georec(lon,lat,height,6378.137,1/298.2572236)
 east=np.array([-math.sin(lon),math.cos(lon),0]);north=np.array([-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat)]);up=np.array([math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)])
 for hour in range(25):
  utc=(datetime.datetime(2026,11,14,tzinfo=datetime.timezone.utc)+datetime.timedelta(hours=hour)).strftime('%Y-%m-%dT%H:%M:%SZ')
  # Observer-locus frame, one-way light time + stellar aberration. No refraction.
  state,lt=spice.spkcpo('MOON',spice.str2et(utc),'ITRF93','OBSERVER','LT+S',pos,'EARTH','ITRF93')
  v=state[:3];dist=np.linalg.norm(v)
  el=math.degrees(math.asin(np.dot(v,up)/dist));az=math.degrees(math.atan2(np.dot(v,east),np.dot(v,north)))%360
  rows.append(dict(stationId=id,utc=utc,azimuthDeg=az,elevationDeg=el,rangeKm=float(dist)))
result=dict(producer='CSPICE via spiceypy '+spice.__version__,method="spkcpo MOON / ITRF93 / OBSERVER / LT+S, WGS84 georec and independent ENU dot products",generatedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),kernels=kernels,samples=rows,limits='DE440s vs Horizons DE441, separate Earth EOP realizations and omitted relativistic bending. Residual tolerance is a regression check, not measurement uncertainty.')
path=pathlib.Path(__file__).parent/'spice-reference.json'
if '--check' in sys.argv:
 old=json.loads(path.read_text());errors=[]
 for a,b in zip(old['samples'],rows,strict=True):
  errors.extend([abs((a['azimuthDeg']-b['azimuthDeg']+180)%360-180),abs(a['elevationDeg']-b['elevationDeg'])])
 assert max(errors)<.002, max(errors)
 print(json.dumps(dict(samples=len(rows),maxRegeneratedAngleResidualDeg=max(errors),kernels=kernels),indent=2))
else:
 path.write_text(json.dumps(result,indent=2)+'\n');print(path)
