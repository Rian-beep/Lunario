"""Refresh bounded primary UI-standard extracts; no third-party Python packages."""
import datetime
import hashlib
import json
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, value):
        if not self.skip and value.strip():
            self.text.append(value.strip())


sources = [
    ("clipboard", "https://www.w3.org/TR/2026/WD-clipboard-apis-20260624/", ["image/png", "NotAllowedError", "SecureContext"]),
    ("canvas", "https://html.spec.whatwg.org/multipage/canvas.html", ["Serializing bitmaps to a file", "image/png", "origin-clean"]),
    ("contrast", "https://www.w3.org/TR/2024/REC-WCAG22-20241212/", ["Contrast (Minimum)", "4.5:1", "relative luminance"]),
]
directory = Path(__file__).resolve().parents[1] / "docs/qa/scientific-audit/ui/references"
directory.mkdir(parents=True, exist_ok=True)
manifest = []
for name, url, needles in sources:
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read(3_000_001)
        if len(raw) > 3_000_000:
            raise ValueError(f"Reference exceeds 3 MB bound: {url}")
        headers = {key: value for key, value in response.headers.items() if key.lower() in ("content-type", "last-modified", "etag", "date")}
        final = response.url
    parser = VisibleText()
    parser.feed(raw.decode())
    text = "\n".join(parser.text)
    excerpts = []
    for needle in needles:
        start = 0
        for _ in range(3):
            offset = text.lower().find(needle.lower(), start)
            if offset < 0:
                break
            excerpts.append({"needle": needle, "textOffset": offset, "text": text[max(0, offset - 180):offset + 650]})
            start = offset + len(needle)
    record = {"url": url, "responseUrl": final, "retrievedUtc": datetime.datetime.now(datetime.timezone.utc).isoformat(), "responseSha256": hashlib.sha256(raw).hexdigest(), "responseBytes": len(raw), "headers": headers, "extractMethod": "stdlib HTMLParser visible text; up to 3 bounded contexts per term", "excerpts": excerpts}
    path = directory / f"{name}.json"
    path.write_text(json.dumps(record, indent=2) + "\n")
    manifest.append({"path": str(path.relative_to(directory.parents[4])), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "url": url})
(directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
