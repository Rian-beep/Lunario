"""Independent offline references: run from repository root (Python standard library only)."""
import json
import math
from pathlib import Path

out = Path('docs/qa/scientific-audit/resources/reference.json')
# Published Cartesian coordinates, not recomputed geodetic values: JPL 301P Table 2.
stations = {
    'goldstone': [-2353621.420, -4641341.472, 3677052.318],
    'madrid': [4849092.518, -360180.3480, 4115109.251],
    'canberra': [-4460894.917, 2682361.507, -3674748.152],
}
rf = []
for f, r, p, gt, gr, loss, temp, rate, req in [
    (2.3, 384400, 20, 5, 60, 3, 100, 10000, 5),
    (8.4, 400000, 100, 30, 74, 5, 100, 1000, 5),
    (32, 360000, 5, 35, 78, 10, 150, 1e6, 3),
]:
    # Energy per bit from flux density times effective receive aperture (linear SI).
    wavelength = 299792458 / (f * 1e9)
    density = p * 10 ** (gt / 10) / (4 * math.pi * (r * 1000) ** 2)
    aperture = 10 ** (gr / 10) * wavelength ** 2 / (4 * math.pi)
    received = density * aperture / 10 ** (loss / 10)
    bit_energy = received / rate
    ebn0 = 10 * math.log10(bit_energy / (1.380649e-23 * temp))
    rf.append(dict(input=dict(frequencyGHz=f, rangeKm=r, txPowerW=p, txGainDbi=gt,
                             rxGainDbi=gr, lossDb=loss, noiseTempK=temp,
                             dataRateBps=rate, requiredEbN0Db=req),
                   expected=dict(pathLossDb=-10 * math.log10(wavelength ** 2 / (16 * math.pi ** 2 * (r * 1000) ** 2)),
                                 receivedDbw=10 * math.log10(received), ebN0Db=ebn0, marginDb=ebn0-req)))
solar = []
for elevation, azimuth, tilt, facing, cut in [
    (30, 0, 0, 0, -2), (30, 90, 90, 90, -2), (30, 90, 90, 270, -2),
    (15, 250, 65, 10, -2), (40, 31, 57, 64, -.5),
    (40, 31, 57, 64, 0), (40, 31, 57, 64, .5), (40, 31, 57, 64, 2),
]:
    # ENU vectors with azimuth clockwise from north; tilt is from upward normal.
    el, az, ti, fa = map(math.radians, [elevation, azimuth, tilt, facing])
    sun = (math.cos(el)*math.sin(az), math.cos(el)*math.cos(az), math.sin(el))
    normal = (math.sin(ti)*math.sin(fa), math.sin(ti)*math.cos(fa), math.cos(ti))
    incidence = max(0, sum(a*b for a, b in zip(sun, normal)))
    # Integrate horizontal chord lengths over a unit disk, independent of circular-segment acos formula.
    lower = max(-1, min(1, cut))
    steps = 100000
    dy = (1-lower)/steps
    fraction = sum(2*math.sqrt(max(0, 1-(lower+(i+.5)*dy)**2))*dy for i in range(steps))/math.pi
    solar.append(dict(elevation=elevation, azimuth=azimuth, tilt=tilt, facing=facing,
                      horizon=elevation+cut*.27, radius=.27, incidence=incidence,
                      visibleFraction=fraction, expectedPowerW=1000*2*.3*.85*incidence*fraction))
value = dict(schema='audit-resources-reference-1', epoch='ITRF93 station positions: 2003.0; analytic power/RF cases epoch-independent',
             stationsM=stations, rf=rf, solar=solar,
             atmospheric=dict(zenithDb=.384, elevationDeg=20, meanRadiatingK=277.5,
                              printedSlantDb=1.123, printedNoiseK=63.214),
             energy=[
                 dict(id='dark-depletion', hours=3.5, sun=-30, assumptions=dict(loadW=80,batteryWh=300,initialSoc=.8,reserveSoc=.25,dischargeEfficiency=.8),
                      expected=dict(generatedWh=0,finalBatteryWh=0,minBatteryWh=0,unmetWh=88,reserveHours=1.85), eventHours={'reserve-crossing':1.65,'unserved-load':2.4}),
                 dict(id='charge-bus-cap',hours=.75,sun=30,assumptions=dict(solarFlux=400,loadW=40,batteryWh=100,initialSoc=.1,chargeEfficiency=.8),operations=dict(maxChargeW=100),
                      expected=dict(generatedWh=300,finalBatteryWh=70,minBatteryWh=10,curtailedWh=195,unmetWh=0)),
                 dict(id='discharge-bus-cap',hours=1.5,sun=-30,assumptions=dict(loadW=90,batteryWh=300,initialSoc=1,dischargeEfficiency=.5),operations=dict(maxDischargeW=20),
                      expected=dict(generatedWh=0,finalBatteryWh=240,minBatteryWh=240,unmetWh=105),eventHours={'unserved-load':0}),
                 dict(id='capacity-saturation',hours=2,sun=30,assumptions=dict(solarFlux=300,loadW=50,batteryWh=100,initialSoc=.25,chargeEfficiency=.75),
                      expected=dict(generatedWh=600,finalBatteryWh=100,minBatteryWh=25,curtailedWh=400,unmetWh=0)),
                 dict(id='reserve-recovery',hours=2,sun=30,assumptions=dict(solarFlux=100,loadW=0,batteryWh=500,initialSoc=0,reserveSoc=.2,chargeEfficiency=.5),
                      expected=dict(generatedWh=200,finalBatteryWh=100,minBatteryWh=0,reserveHours=2,unmetWh=0)),
             ])
out.write_text(json.dumps(value, indent=2)+'\n')
print(out)
