import importlib.util
from pathlib import Path
import struct
import unittest

SPEC = importlib.util.spec_from_file_location("ice_build", Path(__file__).resolve().parents[2] / "pipeline/ice/build_catalog.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


def dbf():
    fields = [("Name", "C", 24), ("Latitude", "N", 19), ("Longitude", "N", 19), ("Count_M3", "N", 16)]
    header_size, row_size = 33 + 32 * len(fields), 1 + sum(f[2] for f in fields)
    data = bytearray(header_size)
    data[0] = 3
    struct.pack_into("<IHH", data, 4, 1, header_size, row_size)
    for i, (name, kind, size) in enumerate(fields):
        pos = 32 + i * 32
        data[pos:pos + len(name)] = name.encode()
        data[pos + 11], data[pos + 16] = ord(kind), size
    data[-1] = 13
    data += b" " + b"Test PSR".ljust(24) + b"-85.125".rjust(19) + b"179.9".rjust(19) + b"2".rjust(16)
    return data


class SourceParsing(unittest.TestCase):
    def test_dbf_to_geographic_feature(self):
        rows = BUILD.parse_dbf(dbf())
        feature = BUILD.psr_feature(rows[0], 1)
        self.assertEqual(feature["geometry"]["coordinates"], [179.9, -85.125])
        self.assertEqual(feature["value"], 2)
        self.assertEqual(feature["evidence"], "ice-bearing-psr")

    def test_truncation_and_invalid_layout(self):
        for data in (b"", dbf()[:32], dbf()[:-1]):
            with self.assertRaises(ValueError):
                BUILD.parse_dbf(data)
        data = dbf()
        data[160] = 0
        with self.assertRaises(ValueError):
            BUILD.parse_dbf(data)

    def test_deleted_or_changed_schema(self):
        data = dbf()
        data[161] = ord("*")
        with self.assertRaises(ValueError):
            BUILD.parse_dbf(data)
        data = dbf()
        data[43] = ord("N")
        with self.assertRaises(ValueError):
            BUILD.parse_dbf(data)

    def test_duplicate_field(self):
        data = dbf()
        data[64:75] = data[32:43]
        with self.assertRaises(ValueError):
            BUILD.parse_dbf(data)

    def test_no_data_and_invalid_coordinates(self):
        row = BUILD.parse_dbf(dbf())[0]
        for name, value in [("Latitude", ""), ("Latitude", "nan"), ("Longitude", "9999"),
                            ("Latitude", "-74"), ("Latitude", "-91"), ("Longitude", "inf"),
                            ("Count_M3", ""), ("Count_M3", "0"), ("Count_M3", "-9999"),
                            ("Count_M3", "1.5"), ("Count_M3", "135")]:
            with self.subTest(name=name, value=value), self.assertRaises(ValueError):
                BUILD.psr_feature({**row, name: value}, 1)

    def test_unnamed_record_keeps_archive_identity(self):
        row = BUILD.parse_dbf(dbf())[0]
        feature = BUILD.psr_feature({**row, "Name": ""}, 7)
        self.assertEqual(feature["id"], "lemelin-2021-record-7")
        self.assertEqual(feature["name"], "PSR record 7")

    def test_source_hash_mismatch_is_fatal(self):
        with self.assertRaisesRegex(ValueError, "SHA256 mismatch"):
            BUILD.build(b"wrong archive", {"sources": [{"originals": [{"bytes": 13, "sha256": "0" * 64}]}]})


if __name__ == "__main__":
    unittest.main()
