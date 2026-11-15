#!/usr/bin/env python3
"""Precompute the SolarReach lunar navigator dataset.

Sun and Earth directions come from the JPL Horizons API (DE441): sub-solar
point, sub-Earth point, Earth-Moon range, and the solar angular diameter.
Topocentric azimuth and elevation are then standard spherical astronomy plus
Earth parallax. They were checked against Horizons observer ephemerides.

Terrain horizons are ray-marched on LOLA digital elevation models from the
NASA Goddard PGDA (MOON_ME, radius 1737.4 km), the same frame Horizons uses
for lunar site coordinates.
"""

from __future__ import annotations

import base64
import json
import math
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import tifffile
from numba import njit, prange
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "data"
CACHE = Path("/tmp/lunar-src")
FINE_PATH = CACHE / "LDEM_80S_40MPP_ADJ.TIF"
COARSE_PATH = CACHE / "LDEM_60S_240MPP_ADJ.TIF"

HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
R_M = 1_737_400.0
R_KM = 1737.4
EARTH_RADIUS_KM = 6378.137
SUN_RADIUS_KM = 695_700.0
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
T1 = datetime(2028, 1, 1, tzinfo=timezone.utc)
STEP = timedelta(hours=1)

MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

# Published coordinates. East longitude is positive.
SITES = [
    {
        "id": "malapert-massif",
        "name": "Malapert Massif",
        "lat": -86.0,
        "lon": 0.0,
        "group": "artemis",
        "summary": "Heart of an Artemis III candidate region: the broad, Earth-facing shoulder of Malapert Massif.",
        "source": "LROC featured image 1294. The relatively flat ground at 86°S, 0°E is described as the heart of the Artemis III Malapert Massif region.",
        "sourceUrl": "https://lroc.im-ldi.com/images/1294",
    },
    {
        "id": "connecting-ridge",
        "name": "Connecting Ridge",
        "lat": -89.53432,
        "lon": 209.94767,
        "group": "artemis",
        "summary": "A published point on the ridge between Shackleton and de Gerlache, inside NASA's 2022 Connecting Ridge region.",
        "source": "LPSC 2024 abstract 1695. Candidate point at −89.53432°, 209.94767°E inside the Artemis Connecting Ridge region, beside a permanently shadowed crater.",
        "sourceUrl": "https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf",
    },
    {
        "id": "peak-near-shackleton",
        "name": "Peak Near Shackleton",
        "lat": -89.01701,
        "lon": 126.27302,
        "group": "artemis",
        "summary": "A published point in NASA's 2022 Peak Near Shackleton candidate region.",
        "source": "LPSC 2024 abstract 1695. Candidate point at −89.01701°, 126.27302°E in the Peak Near Shackleton region.",
        "sourceUrl": "https://www.hou.usra.edu/meetings/lpsc2024/pdf/1695.pdf",
    },
    {
        "id": "degerlache-shackleton",
        "name": "de Gerlache–Shackleton ridge",
        "lat": -89.495,
        "lon": 222.5,
        "group": "artemis",
        "summary": "A studied landing point on the de Gerlache–Shackleton ridge, assessed for a short crewed stay.",
        "source": "LPSC 2022 abstract 1079. Landing point at −89.495°, 222.5°E. That study reported 56.1% illumination with its own topography and year; this app recomputes the fraction rather than reusing that number.",
        "sourceUrl": "https://www.hou.usra.edu/meetings/lpsc2022/pdf/1079.pdf",
    },
    {
        "id": "odysseus",
        "name": "IM-1 Odysseus",
        "lat": -80.13,
        "lon": 1.44,
        "group": "clps",
        "summary": "Intuitive Machines IM-1, Malapert A. Landed 22 February 2024 and came to rest tilted.",
        "source": "NASA LRO report: 80.13°S, 1.44°E, elevation 2,579 m above the reference sphere.",
        "sourceUrl": "https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/",
    },
    {
        "id": "athena",
        "name": "IM-2 Athena",
        "lat": -84.7906,
        "lon": 29.1957,
        "group": "clps",
        "summary": "Intuitive Machines IM-2, on Mons Mouton. Landed 6 March 2025 inside a small crater, on its side.",
        "source": "LROC NAC observation: 84.7906°S, 29.1957°E.",
        "sourceUrl": "https://lroc.im-ldi.com/images/1408",
    },
    {
        "id": "lcross-cabeus",
        "name": "LCROSS at Cabeus",
        "lat": -84.6796,
        "lon": 360.0 - 48.7093,
        "group": "contrast",
        "summary": "The LCROSS Centaur impact in Cabeus, a permanently shadowed crater. A contrast, not a crew landing site.",
        "source": "Marshall et al. (2012), weighted-average Centaur location −84.6796°, −48.7093° (311.2907°E).",
        "sourceUrl": "https://doi.org/10.1007/s11214-011-9765-0",
    },
    {
        "id": "south-pole",
        "name": "Geographic south pole",
        "lat": -89.99,
        "lon": 0.0,
        "group": "reference",
        "summary": "A reference point 300 m from the geographic south pole, toward longitude 0°. Not a landing site. Shackleton's floor is nearby.",
        "source": "Defined for this tool as latitude −89.99°, longitude 0°. The exact pole has no unique longitude.",
        "sourceUrl": "https://pgda.gsfc.nasa.gov/products/90",
    },
]


def wrap180(deg: float) -> float:
    return (deg + 180.0) % 360.0 - 180.0


def b64_array(arr: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode("ascii")


def disk_fraction(elevation: float, horizon: float, radius: float) -> float:
    """Fraction of a uniform disk above a straight horizon. elevation, horizon, radius in the same unit."""
    if radius <= 0:
        return 1.0 if elevation > horizon else 0.0
    c = (elevation - horizon) / radius
    if c >= 1:
        return 1.0
    if c <= -1:
        return 0.0
    below = (math.acos(c) - c * math.sqrt(max(0.0, 1.0 - c * c))) / math.pi
    return 1.0 - below


def sun_az_el_one(lat: float, lon: float, sslat: float, sslon: float) -> tuple[float, float]:
    latr, lonr = math.radians(lat), math.radians(lon)
    slatr = math.radians(sslat)
    dlon = math.radians(sslon - lon)
    cosg = math.sin(latr) * math.sin(slatr) + math.cos(latr) * math.cos(slatr) * math.cos(dlon)
    cosg = min(1.0, max(-1.0, cosg))
    el = 90.0 - math.degrees(math.acos(cosg))
    y = math.sin(dlon) * math.cos(slatr)
    x = math.cos(latr) * math.sin(slatr) - math.sin(latr) * math.cos(slatr) * math.cos(dlon)
    az = math.degrees(math.atan2(y, x)) % 360.0
    return az, el


def earth_az_el_one(lat: float, lon: float, elat: float, elon: float, range_km: float) -> tuple[float, float]:
    latr, lonr = math.radians(lat), math.radians(lon)
    elatr, elonr = math.radians(elat), math.radians(elon)
    cl, sl = math.cos(latr), math.sin(latr)
    co, so = math.cos(lonr), math.sin(lonr)
    up = (cl * co, cl * so, sl)
    east = (-so, co, 0.0)
    north = (-sl * co, -sl * so, cl)
    ce, se = math.cos(elatr), math.sin(elatr)
    ue = (ce * math.cos(elonr), ce * math.sin(elonr), se)
    vx = range_km * ue[0] - R_KM * up[0]
    vy = range_km * ue[1] - R_KM * up[1]
    vz = range_km * ue[2] - R_KM * up[2]
    ve = vx * east[0] + vy * east[1] + vz * east[2]
    vn = vx * north[0] + vy * north[1] + vz * north[2]
    vu = vx * up[0] + vy * up[1] + vz * up[2]
    el = math.degrees(math.atan2(vu, math.hypot(ve, vn)))
    az = math.degrees(math.atan2(ve, vn)) % 360.0
    return az, el


def selftest_geometry() -> None:
    # 2026-11-14 00:00 UT, site 0°E, 86°S. Direct Horizons observer table.
    sun_az, sun_el = sun_az_el_one(-86.0, 0.0, -1.557279, 126.617658)
    earth_az, earth_el = earth_az_el_one(-86.0, 0.0, 4.403300, 358.776460, 405615.891)
    if abs(wrap180(sun_az - 126.637856)) > 0.02 or abs(sun_el - (-0.830469)) > 0.02:
        raise SystemExit(f"Sun geometry self-test failed: {sun_az:.5f} {sun_el:.5f}")
    if abs(wrap180(earth_az - 358.776239)) > 0.02 or abs(earth_el - (-0.649972)) > 0.02:
        raise SystemExit(f"Earth geometry self-test failed: {earth_az:.5f} {earth_el:.5f}")
    if abs(disk_fraction(0, 0, 1) - 0.5) > 1e-9:
        raise SystemExit("disk fraction at the limb is not 1/2")
    if disk_fraction(1, 0, 1) != 1 or disk_fraction(-1, 0, 1) != 0:
        raise SystemExit("disk fraction endpoints failed")
    # Northward step from 86°S, 0°E.
    latr = math.radians(-86.0)
    theta = 1000.0 / R_M
    lat2 = math.asin(math.sin(latr) * math.cos(theta) + math.cos(latr) * math.sin(theta))
    if math.degrees(lat2) <= -86.0:
        raise SystemExit("northward step did not increase latitude")
    print("geometry self-test ok", f"sun {sun_el:.4f}°", f"earth {earth_el:.4f}°")


def parse_time(token_date: str, token_time: str) -> datetime:
    year, mon, day = token_date.split("-")
    hour, minute = token_time.split(":")
    return datetime(int(year), MONTHS[mon], int(day), int(hour), int(minute), tzinfo=timezone.utc)


def horizons_request(params: dict) -> str:
    url = HORIZONS + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=180) as resp:
                payload = json.loads(resp.read().decode())
            if payload.get("error"):
                raise RuntimeError(payload["error"])
            result = payload.get("result") or ""
            if "$$SOE" not in result:
                raise RuntimeError(result[:400])
            return result
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Horizons failed: {last}")


def parse_rows(result: str) -> list[tuple[datetime, list[float]]]:
    soe = result.find("$$SOE")
    eoe = result.find("$$EOE")
    rows = []
    num_re = re.compile(r"[+-]?(?:\d+\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?)")
    date_re = re.compile(r"(\d{4}-[A-Za-z]{3}-\d{1,2})\s+(\d{2}:\d{2})")
    for line in result[soe + 5 : eoe].splitlines():
        match = date_re.search(line)
        if not match:
            continue
        nums = [float(x) for x in num_re.findall(line[match.end() :])]
        rows.append((parse_time(match.group(1), match.group(2)), nums))
    if not rows:
        raise RuntimeError(result[:500])
    return rows


def expected_times() -> list[datetime]:
    out = []
    t = T0
    while t <= T1:
        out.append(t)
        t += STEP
    return out


def fetch_series(command: str, quantities: str, center: str = "'500@399'") -> dict[datetime, list[float]]:
    merged: dict[datetime, list[float]] = {}
    cursor = T0
    while cursor < T1:
        stop = min(cursor + timedelta(days=120), T1)
        print(f"  Horizons {command} {quantities} {cursor.date()} → {stop.date()}", flush=True)
        result = horizons_request(
            {
                "format": "json",
                "COMMAND": command,
                "MAKE_EPHEM": "'YES'",
                "EPHEM_TYPE": "'OBSERVER'",
                "OBJ_DATA": "'NO'",
                "CENTER": center,
                "START_TIME": f"'{cursor.strftime('%Y-%b-%d %H:%M')}'",
                "STOP_TIME": f"'{stop.strftime('%Y-%b-%d %H:%M')}'",
                "STEP_SIZE": "'1 h'",
                "QUANTITIES": quantities,
            }
        )
        for stamp, nums in parse_rows(result):
            merged[stamp] = nums
        cursor = stop
    return merged


def load_ephemeris(times: list[datetime]) -> dict[str, np.ndarray]:
    cache = CACHE / "ephem.npz"
    if cache.exists():
        print("using cached ephemeris", cache, flush=True)
        data = np.load(cache)
        if data["subsolar_lat"].shape[0] == len(times):
            return {k: data[k] for k in data.files}
        print("cache length mismatch, refetching")

    print("fetching Horizons sub-solar / sub-Earth series", flush=True)
    moon = fetch_series("'301'", "'14,15,20'")
    print("fetching solar angular diameter", flush=True)
    sun = fetch_series("'10'", "'13'", center="'500@301'")
    n = len(times)
    sslat = np.empty(n)
    sslon = np.empty(n)
    selat = np.empty(n)
    selon = np.empty(n)
    erange = np.empty(n)
    sdiam = np.empty(n)
    au_km = 149_597_870.700
    for i, stamp in enumerate(times):
        if stamp not in moon:
            raise SystemExit(f"missing Moon ephemeris at {stamp.isoformat()}")
        if stamp not in sun:
            raise SystemExit(f"missing Sun diameter at {stamp.isoformat()}")
        nums = moon[stamp]
        if len(nums) < 5:
            raise SystemExit(f"unexpected Moon columns at {stamp}: {nums}")
        selon[i], selat[i], sslon[i], sslat[i], delta_au = nums[:5]
        erange[i] = delta_au * au_km
        snums = sun[stamp]
        sdiam[i] = snums[0]
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez(
        cache,
        subsolar_lat=sslat,
        subsolar_lon=sslon,
        subearth_lat=selat,
        subearth_lon=selon,
        earth_range_km=erange,
        sun_diam_arcsec=sdiam,
    )
    return {
        "subsolar_lat": sslat,
        "subsolar_lon": sslon,
        "subearth_lat": selat,
        "subearth_lon": selon,
        "earth_range_km": erange,
        "sun_diam_arcsec": sdiam,
    }


def validate_against_observer(times: list[datetime], ephem: dict[str, np.ndarray], sites: list[dict]) -> dict:
    print("validating against Horizons topocentric observer tables", flush=True)
    index = {stamp: i for i, stamp in enumerate(times)}
    stats = {"samples": 0, "sunEl": 0.0, "sunAz": 0.0, "earthEl": 0.0, "earthAz": 0.0}
    for site in sites:
        for command, kind in (("'10'", "sun"), ("'399'", "earth")):
            result = horizons_request(
                {
                    "format": "json",
                    "COMMAND": command,
                    "MAKE_EPHEM": "'YES'",
                    "EPHEM_TYPE": "'OBSERVER'",
                    "OBJ_DATA": "'NO'",
                    "CENTER": "'coord@301'",
                    "COORD_TYPE": "'GEODETIC'",
                    "SITE_COORD": f"'{site['lon']},{site['lat']},0'",
                    "START_TIME": "'2026-Jan-01'",
                    "STOP_TIME": "'2028-Jan-01'",
                    "STEP_SIZE": "'120 d'",
                    "QUANTITIES": "'4'",
                }
            )
            for stamp, nums in parse_rows(result):
                if stamp not in index or len(nums) < 2:
                    continue
                i = index[stamp]
                haz, hel = nums[0], nums[1]
                if kind == "sun":
                    maz, mel = sun_az_el_one(site["lat"], site["lon"], ephem["subsolar_lat"][i], ephem["subsolar_lon"][i])
                    stats["sunEl"] = max(stats["sunEl"], abs(mel - hel))
                    stats["sunAz"] = max(stats["sunAz"], abs(wrap180(maz - haz)))
                else:
                    maz, mel = earth_az_el_one(
                        site["lat"], site["lon"], ephem["subearth_lat"][i], ephem["subearth_lon"][i], ephem["earth_range_km"][i]
                    )
                    stats["earthEl"] = max(stats["earthEl"], abs(mel - hel))
                    stats["earthAz"] = max(stats["earthAz"], abs(wrap180(maz - haz)))
                stats["samples"] += 1
        print(
            f"  {site['id']}: max |dEl| sun {stats['sunEl']:.4f}° earth {stats['earthEl']:.4f}°",
            flush=True,
        )
    if stats["samples"] < 10:
        raise SystemExit("too few Horizons validation samples")
    if max(stats["sunEl"], stats["earthEl"]) > 0.05:
        raise SystemExit(f"Horizons validation error is too large: {stats}")
    print("validation", stats, flush=True)
    return stats


def read_geotiff(path: Path) -> dict:
    with tifffile.TiffFile(path) as tf:
        page = tf.pages[0]
        scale = float(page.tags[33550].value[0])
        tie = page.tags[33922].value
        keys = list(page.tags[34735].value) if 34735 in page.tags else []
        raster_type = 1
        if keys:
            count = keys[3]
            for i in range(count):
                key, loc, _count, val = keys[4 + 4 * i : 8 + 4 * i]
                if key == 1025 and loc == 0:
                    raster_type = int(val)
        dem = page.asarray()
    dem = np.ascontiguousarray(dem, dtype=np.float32)
    # PixelIsArea (1): tiepoint is the outer corner. PixelIsPoint (2): tiepoint is the center.
    center_offset = 0.5 if raster_type == 1 else 0.0
    print(f"loaded {path.name} {dem.shape} scale {scale} tie {tie[3]:.1f},{tie[4]:.1f} rasterType {raster_type}", flush=True)
    return {
        "dem": dem,
        "scale": scale,
        "tie_x": float(tie[3]),
        "tie_y": float(tie[4]),
        "center_offset": center_offset,
        "name": path.name,
    }


@njit
def sample_dem(dem, tie_x, tie_y, scale, center_offset, x, y):
    col = (x - tie_x) / scale - center_offset
    row = (tie_y - y) / scale - center_offset
    c = int(round(col))
    r = int(round(row))
    h, w = dem.shape
    if r < 0 or c < 0 or r >= h or c >= w:
        return np.nan
    return dem[r, c]


@njit
def sample_surface(fine, ftie_x, ftie_y, fscale, foff, coarse, ctie_x, ctie_y, cscale, coff, x, y):
    v = sample_dem(fine, ftie_x, ftie_y, fscale, foff, x, y)
    if v == v:
        return v
    return sample_dem(coarse, ctie_x, ctie_y, cscale, coff, x, y)


@njit(parallel=True)
def horizon_masks(
    fine, ftie_x, ftie_y, fscale, foff,
    coarse, ctie_x, ctie_y, cscale, coff,
    lat_deg, lon_deg, heights, az_step, near_step, mid_step, far_step, max_m,
):
    n_az = int(round(360.0 / az_step))
    n_h = heights.shape[0]
    masks = np.empty((n_h, n_az), np.float64)
    R = 1737400.0
    latr = math.radians(lat_deg)
    lonr = math.radians(lon_deg)
    rho0 = 2.0 * R * math.tan(math.pi * 0.25 + latr * 0.5)
    x0 = rho0 * math.sin(lonr)
    y0 = rho0 * math.cos(lonr)
    h0 = sample_surface(fine, ftie_x, ftie_y, fscale, foff, coarse, ctie_x, ctie_y, cscale, coff, x0, y0)
    if h0 != h0:
        for k in range(n_h):
            for i in range(n_az):
                masks[k, i] = np.nan
        return masks, h0
    r0 = np.empty(n_h, np.float64)
    for k in range(n_h):
        r0[k] = R + h0 + heights[k]
    r0_min = r0[0]
    for k in range(n_h):
        if r0[k] < r0_min:
            r0_min = r0[k]
    for i in prange(n_az):
        azr = math.radians(i * az_step)
        max_el = np.empty(n_h, np.float64)
        for k in range(n_h):
            max_el[k] = -1.5707963267948966
        valid = 0
        dist = near_step
        while dist <= max_m:
            theta = dist / R
            lat2 = math.asin(
                min(1.0, max(-1.0, math.sin(latr) * math.cos(theta) + math.cos(latr) * math.sin(theta) * math.cos(azr)))
            )
            lon2 = lonr + math.atan2(
                math.sin(azr) * math.sin(theta) * math.cos(latr),
                math.cos(theta) - math.sin(latr) * math.sin(lat2),
            )
            rho = 2.0 * R * math.tan(math.pi * 0.25 + lat2 * 0.5)
            x = rho * math.sin(lon2)
            y = rho * math.cos(lon2)
            h1 = sample_surface(fine, ftie_x, ftie_y, fscale, foff, coarse, ctie_x, ctie_y, cscale, coff, x, y)
            if h1 == h1:
                cth = math.cos(theta)
                sth = math.sin(theta)
                rr = R + h1
                for k in range(n_h):
                    el = math.atan2(rr * cth - r0[k], rr * sth)
                    if el > max_el[k]:
                        max_el[k] = el
                valid += 1
            if dist < 8000.0:
                dist += near_step
            elif dist < 40000.0:
                dist += mid_step
            else:
                dist += far_step
            if dist > 6000.0:
                theta2 = dist / R
                elmax = math.atan2((R + 15000.0) * math.cos(theta2) - r0_min, (R + 15000.0) * math.sin(theta2))
                worst = max_el[0]
                for k in range(n_h):
                    if max_el[k] < worst:
                        worst = max_el[k]
                if elmax < worst:
                    break
        for k in range(n_h):
            masks[k, i] = math.degrees(max_el[k]) if valid >= 8 else np.nan
    return masks, h0


def local_slope(dems, lat, lon) -> float:
    """Approximate slope in degrees over one fine pixel, along local north and east."""
    step = 40.0
    h0 = surface_height(dems, lat, lon)
    if not math.isfinite(h0):
        return float("nan")
    lat_n, _ = destination(lat, lon, 0.0, step)
    _, lon_e = destination(lat, lon, 90.0, step)
    lat_s, _ = destination(lat, lon, 180.0, step)
    _, lon_w = destination(lat, lon, 270.0, step)
    hn = surface_height(dems, lat_n, lon)
    hs = surface_height(dems, lat_s, lon)
    he = surface_height(dems, lat, lon_e)
    hw = surface_height(dems, lat, lon_w)
    if not all(math.isfinite(v) for v in (hn, hs, he, hw)):
        return float("nan")
    dzdn = (hn - hs) / (2 * step)
    dzde = (he - hw) / (2 * step)
    return math.degrees(math.atan(math.hypot(dzdn, dzde)))


def destination(lat, lon, az_deg, dist_m):
    latr = math.radians(lat)
    lonr = math.radians(lon)
    azr = math.radians(az_deg)
    theta = dist_m / R_M
    lat2 = math.asin(
        min(1.0, max(-1.0, math.sin(latr) * math.cos(theta) + math.cos(latr) * math.sin(theta) * math.cos(azr)))
    )
    lon2 = lonr + math.atan2(
        math.sin(azr) * math.sin(theta) * math.cos(latr),
        math.cos(theta) - math.sin(latr) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2) % 360.0


def surface_height(dems, lat, lon) -> float:
    latr = math.radians(lat)
    lonr = math.radians(lon)
    rho = 2.0 * R_M * math.tan(math.pi / 4 + latr / 2)
    x = rho * math.sin(lonr)
    y = rho * math.cos(lonr)
    fine = dems["fine"]
    v = sample_dem(fine["dem"], fine["tie_x"], fine["tie_y"], fine["scale"], fine["center_offset"], x, y)
    if v == v:
        return float(v)
    coarse = dems["coarse"]
    v = sample_dem(coarse["dem"], coarse["tie_x"], coarse["tie_y"], coarse["scale"], coarse["center_offset"], x, y)
    return float(v)


def calibrate_offset(dems) -> None:
    """Pick the pixel-center convention that matches NASA's IM-1 elevation."""
    target = 2579.0
    best = None
    for key in ("fine", "coarse"):
        dem = dems[key]
        for offset in (0.0, 0.5):
            dem["center_offset"] = offset
            h = surface_height(dems, -80.13, 1.44)
            err = abs(h - target) if math.isfinite(h) else 1e9
            print(f"  calibration {key} offset {offset}: Odysseus LOLA height {h:.1f} m (NASA 2579 m)", flush=True)
            if best is None or err < best[0]:
                best = (err, key, offset, h)
    # Apply one convention to both mosaics. They share GMT pixel registration.
    chosen = best[2]
    for key in ("fine", "coarse"):
        dems[key]["center_offset"] = chosen
    h = surface_height(dems, -80.13, 1.44)
    print(f"using center offset {chosen}; Odysseus height {h:.1f} m", flush=True)
    dems["odysseus_height_m"] = h
    if not math.isfinite(h) or abs(h - target) > 800:
        raise SystemExit("LOLA sample at IM-1 does not match the published elevation. Georeferencing is wrong.")


def masks_for(dems, lat, lon, heights, az_step, near, mid, far, max_m):
    fine, coarse = dems["fine"], dems["coarse"]
    masks, h0 = horizon_masks(
        fine["dem"], fine["tie_x"], fine["tie_y"], fine["scale"], fine["center_offset"],
        coarse["dem"], coarse["tie_x"], coarse["tie_y"], coarse["scale"], coarse["center_offset"],
        lat, lon, np.asarray(heights, dtype=np.float64),
        az_step, near, mid, far, max_m,
    )
    return masks, float(h0)


def sunlit_fraction(lat, lon, ephem, mask_deg, az_step) -> tuple[float, float]:
    """Return (terrain any-disk fraction, smooth-sphere any-disk fraction) over the full series."""
    az, el = vector_sun(lat, lon, ephem["subsolar_lat"], ephem["subsolar_lon"])
    radius = ephem["sun_diam_arcsec"] / 3600.0 / 2.0
    if mask_deg is None:
        terrain = float("nan")
    else:
        idx = np.rint(az / az_step).astype(np.int32) % mask_deg.shape[0]
        horizon = mask_deg[idx]
        good = np.isfinite(horizon)
        terrain = float(np.mean((el[good] + radius[good]) > horizon[good])) if np.any(good) else float("nan")
    sphere = float(np.mean((el + radius) > 0))
    return terrain, sphere


def vector_sun(lat, lon, sslat, sslon):
    latr = math.radians(lat)
    slatr = np.radians(sslat)
    dlon = np.radians(sslon - lon)
    cosg = np.sin(latr) * np.sin(slatr) + np.cos(latr) * np.cos(slatr) * np.cos(dlon)
    np.clip(cosg, -1, 1, out=cosg)
    el = 90.0 - np.degrees(np.arccos(cosg))
    y = np.sin(dlon) * np.cos(slatr)
    x = math.cos(latr) * np.sin(slatr) - math.sin(latr) * np.cos(slatr) * np.cos(dlon)
    az = np.degrees(np.arctan2(y, x)) % 360.0
    return az, el


def make_map(dems) -> dict:
    fine = dems["fine"]["dem"]
    # Integer decimation toward ~1000 px.
    factor = max(1, int(round(fine.shape[0] / 1000)))
    h2, w2 = fine.shape[0] // factor, fine.shape[1] // factor
    block = fine[: h2 * factor, : w2 * factor].reshape(h2, factor, w2, factor)
    valid = np.isfinite(block)
    summed = np.where(valid, block, 0).sum(axis=(1, 3))
    count = valid.sum(axis=(1, 3))
    z = summed / np.maximum(count, 1)
    z[count == 0] = np.nan
    dx = dems["fine"]["scale"] * factor
    filled = np.where(np.isfinite(z), z, np.nanmedian(z))
    gy, gx = np.gradient(filled, dx)
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    azimuth = math.radians(315)
    altitude = math.radians(42)
    shade = np.sin(altitude) * np.cos(slope) + np.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
    shade = np.clip(shade, 0, 1)
    # Gentle hypsometric warmth so ridges read as higher ground. Lightness still carries the hillshade.
    zmin, zmax = np.nanpercentile(z, 2), np.nanpercentile(z, 98)
    elev = np.clip((z - zmin) / max(zmax - zmin, 1), 0, 1)
    elev = np.where(np.isfinite(z), elev, 0)
    light = 28 + shade * 176
    red = np.clip(light + elev * 28, 0, 255)
    green = np.clip(light + elev * 10, 0, 255)
    blue = np.clip(light - 12 + elev * 4, 0, 255)
    alpha = np.where(np.isfinite(z), 255, 0)
    rgba = np.dstack([red, green, blue, alpha]).astype(np.uint8)
    image = Image.fromarray(rgba, mode="RGBA")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / "map.png"
    image.save(path, optimize=True)
    print(f"wrote {path} {image.size}", flush=True)
    src = dems["fine"]
    return {
        "width": int(w2),
        "height": int(h2),
        "tieX": src["tie_x"],
        "tieY": src["tie_y"],
        "scaleM": src["scale"] * factor,
        "centerOffset": src["center_offset"],
        "url": "/data/map.png",
    }


def encode_mask(mask_deg: np.ndarray) -> str:
    scaled = np.where(np.isfinite(mask_deg), np.round(mask_deg * 100.0), -32768)
    return b64_array(scaled.astype("<i2"))


def full_stats_window(lat, lon, ephem, mask_deg, az_step, hours, start_index_search=0):
    """Pick a window of `hours` samples that shows a large terrain-versus-sphere gap and real sunlight."""
    az, el = vector_sun(lat, lon, ephem["subsolar_lat"], ephem["subsolar_lon"])
    radius = ephem["sun_diam_arcsec"] / 3600.0 / 2.0
    idx = np.rint(az / az_step).astype(np.int32) % mask_deg.shape[0]
    horizon = mask_deg[idx]
    terrain_on = ((el + radius) > horizon).astype(np.float64)
    sphere_on = ((el + radius) > 0).astype(np.float64)
    kernel = np.ones(hours)
    if len(terrain_on) < hours:
        return 0
    tsum = np.convolve(terrain_on, kernel, mode="valid") / hours
    ssum = np.convolve(sphere_on, kernel, mode="valid")
    gap = tsum - ssum
    # Prefer windows that are actually useful for power, not a fully dark season.
    score = gap + 0.15 * tsum
    score[:start_index_search] = -1e9
    best = int(np.argmax(score))
    return best


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    selftest_geometry()
    times = expected_times()
    print(f"{len(times)} hourly samples {times[0].isoformat()} → {times[-1].isoformat()}", flush=True)
    ephem = load_ephemeris(times)
    validation = validate_against_observer(times, ephem, SITES)

    print("loading DEMs", flush=True)
    dems = {"fine": read_geotiff(FINE_PATH), "coarse": read_geotiff(COARSE_PATH)}
    calibrate_offset(dems)

    heights = np.array([0.0, 2.0, 10.0])
    catalog_sites = []
    print("ray-marching catalog sites", flush=True)
    for site in SITES:
        t0 = time.time()
        masks, h0 = masks_for(dems, site["lat"], site["lon"], heights, 1.0, 40.0, 160.0, 400.0, 250_000.0)
        slope = local_slope(dems, site["lat"], site["lon"])
        # Height index 1 is the 2 m observer.
        terrain, sphere = sunlit_fraction(site["lat"], site["lon"], ephem, masks[1], 1.0)
        print(
            f"  {site['id']}: h={h0:.0f} m slope={slope:.1f}° "
            f"sunlit terrain {terrain*100:.1f}% sphere {sphere*100:.1f}%  ({time.time()-t0:.1f}s)",
            flush=True,
        )
        catalog_sites.append({
            **site,
            "demHeightM": None if not math.isfinite(h0) else round(h0, 1),
            "slopeDeg": None if not math.isfinite(slope) else round(slope, 1),
            "horizons": [
                {"heightM": int(h), "stepDeg": 1, "mask": encode_mask(masks[k])}
                for k, h in enumerate(heights)
            ],
            "_mask2m": masks[1],
        })

    print("searching the Shackleton–de Gerlache rim for a sunnier crest", flush=True)
    screened = []
    # The published points are safe flats, not the narrow illuminated crests.
    # This pass ranks a 2° horizon on the rim belt by any-disk sunlight, then refines the leaders.
    search_pts = []
    lat = -89.85
    while lat <= -88.7 + 1e-6:
        lon = 0.0
        while lon < 360:
            search_pts.append((round(lat, 5), lon))
            lon += 3.0
        lat = round(lat + 0.08, 5)
    t0 = time.time()
    for n, (lat, lon) in enumerate(search_pts, start=1):
        masks, h0 = masks_for(dems, lat, lon, np.array([2.0]), 2.0, 80.0, 200.0, 500.0, 200_000.0)
        if not math.isfinite(h0):
            continue
        terrain_f, sphere_f = sunlit_fraction(lat, lon, ephem, masks[0], 2.0)
        screened.append((terrain_f, sphere_f, lat, lon, h0))
        if n % 200 == 0:
            best_so_far = max(screened, key=lambda item: item[0])
            print(
                f"  screen {n}/{len(search_pts)} best {best_so_far[0]*100:.1f}% "
                f"at {best_so_far[2]:.2f}, {best_so_far[3]:.1f}°  ({time.time()-t0:.0f}s)",
                flush=True,
            )
    screened.sort(key=lambda item: item[0], reverse=True)
    print(f"crest screen {len(screened)} points in {time.time()-t0:.0f}s", flush=True)
    crest = None
    for terrain_f, sphere_f, base_lat, base_lon, _h0 in screened[:8]:
        print(f"  leader {terrain_f*100:.1f}% / sphere {sphere_f*100:.1f}% at {base_lat:.2f}, {base_lon:.1f}", flush=True)
        for dlat in (0.0, -0.03, 0.03):
            for dlon in (0.0, -1.0, 1.0):
                lat = base_lat + dlat
                lon = (base_lon + dlon) % 360.0
                masks, h0 = masks_for(dems, lat, lon, heights, 1.0, 40.0, 160.0, 400.0, 250_000.0)
                terrain_r, sphere_r = sunlit_fraction(lat, lon, ephem, masks[1], 1.0)
                print(f"    refine {lat:.3f}, {lon:.2f}: {terrain_r*100:.1f}% vs sphere {sphere_r*100:.1f}%", flush=True)
                if crest is None or terrain_r > crest[0]:
                    crest = (terrain_r, sphere_r, lat, lon, h0, masks)
    if crest is not None:
        terrain, sphere, lat, lon, h0, masks = crest
        slope = local_slope(dems, lat, lon)
        catalog_sites.append({
            "id": "shackleton-crest",
            "name": "Shackleton rim crest",
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "group": "derived",
            "summary": (
                f"Sunniest rim-belt sample in this 40 m search: {terrain*100:.0f}% of hours with any sunlight, "
                f"against {sphere*100:.0f}% on a smooth sphere. Not a NASA pin. Studies at 5 m find small ridges above 80%; this mosaic smooths those knife edges."
            ),
            "source": (
                "Selected by this pipeline from LDEM_80S_40MPP. Search every 0.08° of latitude from 89.85°S to 88.7°S "
                "and every 3° of longitude, ranked by any-disk sunlight at 2 m on a 2° horizon, then refined at 1° azimuth. "
                f"Full-series any-disk sunlight at 2 m is {terrain*100:.1f}% (smooth sphere {sphere*100:.1f}%)."
            ),
            "sourceUrl": "https://pgda.gsfc.nasa.gov/products/90",
            "demHeightM": None if not math.isfinite(h0) else round(h0, 1),
            "slopeDeg": None if not math.isfinite(slope) else round(slope, 1),
            "horizons": [
                {"heightM": int(h), "stepDeg": 1, "mask": encode_mask(masks[k])}
                for k, h in enumerate(heights)
            ],
            "_mask2m": masks[1],
        })

    print("building custom-site horizon grid", flush=True)
    cells = []
    for lat_i in range(-89, -79):
        for lon_i in range(0, 360, 2):
            cells.append((float(lat_i), float(lon_i)))
    for lat in (-89.5, -89.8):
        for lon_i in range(0, 360, 4):
            cells.append((lat, float(lon_i)))
    grid_masks = []
    grid_lats = []
    grid_lons = []
    t0 = time.time()
    for n, (lat, lon) in enumerate(cells, start=1):
        masks, h0 = masks_for(dems, lat, lon, np.array([2.0]), 3.0, 160.0, 400.0, 800.0, 200_000.0)
        if not math.isfinite(h0) or not np.isfinite(masks[0]).any():
            continue
        grid_lats.append(lat)
        grid_lons.append(lon)
        grid_masks.append(masks[0])
        if n % 100 == 0:
            rate = n / (time.time() - t0)
            print(f"  grid {n}/{len(cells)} kept {len(grid_lats)}  {rate:.1f} cells/s", flush=True)
    grid_arr = np.vstack(grid_masks)
    print(f"grid {grid_arr.shape} in {time.time()-t0:.0f}s", flush=True)

    # Demo window: 14 days where the crest, or else Connecting Ridge, shows the terrain effect.
    demo_site = next(s for s in catalog_sites if s["id"] == "connecting-ridge")
    demo_index = full_stats_window(
        demo_site["lat"], demo_site["lon"], ephem, demo_site["_mask2m"], 1.0, hours=24 * 14, start_index_search=0
    )
    demo_start = times[demo_index]

    map_meta = make_map(dems)

    def lon_u16(values):
        wrapped = np.mod(np.round(np.asarray(values, dtype=np.float64) * 100.0), 36000.0)
        return wrapped.astype("<u2")

    def lat_i16(values):
        return np.round(np.asarray(values, dtype=np.float64) * 100.0).astype("<i2")

    out_sites = []
    for site in catalog_sites:
        item = {k: v for k, v in site.items() if not k.startswith("_")}
        out_sites.append(item)

    catalog = {
        "meta": {
            "title": "SolarReach Lunar Landing Site Navigator",
            "generatedUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "t0": times[0].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "t1": times[-1].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "stepHours": 1,
            "n": len(times),
            "moonRadiusM": R_M,
            "earthRadiusKm": EARTH_RADIUS_KM,
            "sunRadiusKm": SUN_RADIUS_KM,
            "observerHeightsM": [0, 2, 10],
            "defaultHeightM": 2,
            "frame": "MOON_ME / Horizons MEAN_ME, sphere radius 1737.4 km",
            "ephemeris": "JPL Horizons DE441. Sub-solar point, sub-Earth point, Earth-Moon range, and solar angular diameter. Topocentric azimuth and elevation derived and checked against Horizons observer tables.",
            "demFine": dems["fine"]["name"],
            "demCoarse": dems["coarse"]["name"],
            "demCitation": "Barker et al. LOLA DEMs, NASA GSFC PGDA. https://pgda.gsfc.nasa.gov/products/90",
            "centerOffset": dems["fine"]["center_offset"],
            "validation": {
                "samples": validation["samples"],
                "maxAbsSunElevationDeg": round(validation["sunEl"], 5),
                "maxAbsSunAzimuthDeg": round(validation["sunAz"], 5),
                "maxAbsEarthElevationDeg": round(validation["earthEl"], 5),
                "maxAbsEarthAzimuthDeg": round(validation["earthAz"], 5),
                "odysseusLolaHeightM": None if not math.isfinite(dems["odysseus_height_m"]) else round(dems["odysseus_height_m"], 1),
                "odysseusNasaHeightM": 2579,
            },
            "demo": {
                "start": demo_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "hours": 24 * 14,
                "siteId": demo_site["id"],
                "reason": "A 14-day span chosen because terrain changes the sunlight fraction at this site more than at a random week.",
            },
            "gridNote": "Custom points use the nearest precomputed horizon, sampled every 3° of azimuth. Catalog sites use a ray march at the published coordinate, every 1° of azimuth.",
            "samplingNote": "Horizon rays step 40 m near a catalog site, then 160 m, then 400 m, out to 250 km. Grid rays are coarser. A narrow distant ridge can be missed, which slightly overestimates sunlight.",
        },
        "subsolarLat": b64_array(lat_i16(ephem["subsolar_lat"])),
        "subsolarLon": b64_array(lon_u16(ephem["subsolar_lon"])),
        "subearthLat": b64_array(lat_i16(ephem["subearth_lat"])),
        "subearthLon": b64_array(lon_u16(ephem["subearth_lon"])),
        "earthRangeKm": b64_array(ephem["earth_range_km"].astype("<f4")),
        "sunDiamArcsec": b64_array(np.round(ephem["sun_diam_arcsec"]).astype("<u2")),
        "map": map_meta,
        "sites": out_sites,
        "grid": {
            "heightM": 2,
            "stepDeg": 3,
            "lat": b64_array(lat_i16(grid_lats)),
            "lon": b64_array(lon_u16(grid_lons)),
            "mask": encode_mask(grid_arr.reshape(-1)),
            "nAz": int(grid_arr.shape[1]),
        },
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "catalog.json"
    dest.write_text(json.dumps(catalog, separators=(",", ":")))
    print(f"wrote {dest} ({dest.stat().st_size/1e6:.1f} MB)", flush=True)


if __name__ == "__main__":
    main()
