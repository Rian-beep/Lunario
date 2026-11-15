"""Extract published PSR evidence locations using only the Python standard library."""

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import urllib.request
import zipfile


HERE = Path(__file__).resolve().parent
OUTPUT = HERE.parents[1] / "public/data/ice"
DBF_NAME = "Lemelin_et_al_2021_PSJ_south_pole_volatiles_ROIs_supp.dbf"
SELECTED = {"Name": "C", "Latitude": "N", "Longitude": "N", "Count_M3": "N"}


def parse_dbf(data):
    """Read the pinned dBASE numeric/text subset; reject missing/deleted evidence."""
    if len(data) < 33 or data[0] != 3:
        raise ValueError("Expected dBASE III header")
    count, header_size, row_size = struct.unpack_from("<IHH", data, 4)
    if (header_size < 33 or (header_size - 33) % 32
            or header_size > len(data) or data[header_size - 1] != 13
            or len(data) < header_size + count * row_size):
        raise ValueError("Truncated or invalid DBF layout")
    fields = []
    offset = 1
    for pos in range(32, header_size - 1, 32):
        name = data[pos:pos + 11].split(b"\0")[0].decode("ascii")
        kind, size = chr(data[pos + 11]), data[pos + 16]
        if not size or name in [f[0] for f in fields]:
            raise ValueError("Invalid/duplicate DBF field")
        fields.append((name, kind, offset, size))
        offset += size
    if offset != row_size or any(
        not any(name == required and kind == expected for name, kind, _, _ in fields)
        for required, expected in SELECTED.items()
    ):
        raise ValueError("DBF schema does not match the evidence fields")
    rows = []
    for record in range(count):
        start = header_size + record * row_size
        if data[start:start + 1] != b" ":
            raise ValueError(f"Deleted/invalid DBF record {record + 1}")
        row = {}
        for name, _, offset, size in fields:
            if name in SELECTED:
                row[name] = data[start + offset:start + offset + size].decode("utf-8").strip()
        rows.append(row)
    return rows


def number(row, name):
    try:
        value = float(row[name])
    except (ValueError, KeyError) as error:
        raise ValueError(f"Missing/invalid {name}") from error
    if not math.isfinite(value):
        raise ValueError(f"Nonfinite {name}")
    return value


def psr_feature(row, record):
    lat, lon, count = (number(row, name) for name in ("Latitude", "Longitude", "Count_M3"))
    if not -90 <= lat <= -75 or not -180 <= lon <= 180:
        raise ValueError(f"Out-of-coverage coordinate in record {record}")
    if not count.is_integer() or not 1 <= count <= 134:
        raise ValueError(f"Expected published positive M3 count in record {record}")
    return {
        "id": f"lemelin-2021-record-{record}",
        "name": row["Name"] or f"PSR record {record}",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "evidence": "ice-bearing-psr",
        "sourceId": "lemelin-2021-m3-psrs",
        "description": "Published PSR representative location associated with positive M3 surface-ice detections; not an ice-pixel location or footprint. Ice coverage within and outside this region is unknown.",
        "resolutionM": 280,
        "observationUtc": None,
        "value": int(count),
        "unit": "M3 detections",
    }


def build(archive, manifest):
    expected = manifest["sources"][0]["originals"][0]
    if len(archive) != expected["bytes"] or hashlib.sha256(archive).hexdigest() != expected["sha256"]:
        raise ValueError("Original ZIP size/SHA256 mismatch; do not silently update the source pin")
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        if set(source.namelist()) != set(manifest["archiveMembers"]):
            raise ValueError("Unexpected ZIP members")
        for name, pin in manifest["archiveMembers"].items():
            data = source.read(name)
            if len(data) != pin["bytes"] or hashlib.sha256(data).hexdigest() != pin["sha256"]:
                raise ValueError(f"Archive member mismatch: {name}")
        if source.read(DBF_NAME.replace(".dbf", ".prj")).decode() != manifest["originalPrj"]:
            raise ValueError("Original projection changed")
        rows = parse_dbf(source.read(DBF_NAME))
    features = [psr_feature(row, record) for record, row in enumerate(rows, 1)]
    # Independent publication totals, not expectations inferred from the extraction.
    if len(features) != 169 or sum(f["value"] for f in features) != 820:
        raise ValueError("Extraction disagrees with Lemelin et al. section 4.1 totals")
    features.append(json.loads((HERE / "lcross.json").read_text()))
    return {"schemaVersion": 1, "features": features}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-zip", type=Path, help="Pinned original ZIP, no network when supplied")
    parser.add_argument("--check", action="store_true", help="Compare outputs byte-for-byte; do not write")
    args = parser.parse_args()
    manifest = json.loads((HERE / "source-manifest.json").read_text())
    if args.source_zip:
        archive = args.source_zip.read_bytes()
    else:
        url = manifest["sources"][0]["originals"][0]["url"]
        with urllib.request.urlopen(url, timeout=60) as response:
            archive = response.read(1_000_001)
        if len(archive) > 1_000_000:
            raise ValueError("Source ZIP exceeds this extraction's 1 MB download bound")
    outputs = {"catalog.json": build(archive, manifest), "sources.json": manifest["sources"]}
    for name, value in outputs.items():
        data, target = encoded(value), OUTPUT / name
        if args.check:
            if not target.is_file() or target.read_bytes() != data:
                raise ValueError(f"Generated output drift: {target}")
        else:
            target.write_bytes(data)
        print(f"{'MATCH' if args.check else 'WROTE'} {name}: {len(data)} bytes, SHA256 {hashlib.sha256(data).hexdigest()}")


if __name__ == "__main__":
    main()
