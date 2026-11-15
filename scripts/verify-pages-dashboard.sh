#!/usr/bin/env bash
# Check the hosted split application without downloading the large offline file.
set -euo pipefail
python3 - <<'PY'
import hashlib
import json
import os
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

base = os.environ.get('LUNARIO_PAGES_BASE', 'https://rian-beep.github.io/Lunario').rstrip('/') + '/'
parts = urlsplit(base)
assert parts.scheme in ('http', 'https') and parts.netloc and not (parts.username or parts.password or parts.query or parts.fragment), 'Use a plain HTTP(S) site base'
class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.frames = []; self.modules = []; self.styles = []
    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if tag == 'iframe': self.frames.append(a.get('src', ''))
        if tag == 'script' and a.get('type') == 'module': self.modules.append(a.get('src', '').removeprefix('./'))
        if tag == 'link' and a.get('rel') == 'stylesheet': self.styles.append(a.get('href', '').removeprefix('./'))
def fetch(relative, method='GET'):
    url = urljoin(base, relative)
    with urlopen(Request(url, method=method, headers={'Accept-Encoding': 'identity'}), timeout=30) as response:
        assert response.status == 200, f'HTTP {response.status}: {relative}'
        return response.read() if method == 'GET' else {key.lower(): value for key, value in response.headers.items()}
root = fetch('').decode('utf-8'); links = Links(); links.feed(root)
assert any(urljoin(base, frame) == urljoin(base, 'web/index.html') for frame in links.frames), 'Dashboard must embed web/index.html'
assert 'Placeholder layout' not in root, 'Placeholder dashboard remains'
fetch('about.html'); print('PASS dashboard iframe and About')
web = fetch('web/index.html').decode('utf-8'); links = Links(); links.feed(web)
receipt = json.loads(fetch('web/build-receipt.json'))
files = {row['path']: row for row in receipt['files']}
assert receipt['entry'] in links.modules and links.styles, 'Hosted entry or stylesheet is missing'
for name in [receipt['entry'], *links.styles]:
    assert name in files and not name.startswith('/') and '..' not in name.split('/'), 'Unregistered hosted asset'
    data = fetch('web/' + name); row = files[name]
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], f'Hosted artifact differs: {name}'
print('PASS hosted entry and stylesheet bytes match build receipt')
headers = fetch('navigator/public/solarreach-navigator.html', 'HEAD')
assert 'text/html' in headers.get('content-type', ''), 'Offline download is not HTML'
length = headers.get('content-length')
if length is not None: assert 0 < int(length) < 100 * 1024 * 1024, 'Offline file exceeds publication limit'
print('PASS offline download headers; disconnected browser execution is a separate acceptance check')
print('RESULT: PASS')
PY
