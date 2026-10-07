#!/usr/bin/env python3
"""Back up the Site's public JSON to GitHub; never call its writer endpoints.
Uses Python's standard library only. Validate all three responses before writes.
"""
import argparse
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

DEFAULT_SITE = 'https://maple-taiwan-responsive.a6334096.chatgpt.site'
FILENAMES = ('places.json', 'seasons.json', 'foliage.json')


def fetch_json(url):
    for attempt in range(3):
        try:
            request = Request(url, headers={
                'User-Agent': 'Mozilla/5.0 MapleDataBackup/1.0',
                'Accept': 'application/json', 'Cache-Control': 'no-cache'})
            with urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise ValueError('Expected HTTP 200')
                if 'application/json' not in response.headers.get('Content-Type', ''):
                    raise ValueError('Expected JSON response, not a login/error page')
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise ValueError('Response exceeds expected data size')
                return json.loads(raw)
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 2:
                raise RuntimeError('Public data download failed: ' + url) from error
            time.sleep(2 ** attempt)


def validate(data):
    places, seasons, foliage = (data[name] for name in FILENAMES)
    if not isinstance(places, list) or not places:
        raise ValueError('Missing attraction directory')
    ids = []
    for p in places:
        if not isinstance(p, dict) or not isinstance(p.get('id'), str) or not p['id']:
            raise ValueError('Invalid attraction id')
        if not p.get('name') or not p.get('city'):
            raise ValueError('Missing attraction name/city')
        if not isinstance(p.get('lat'), (int, float)) or not 21 <= p['lat'] <= 27:
            raise ValueError('Invalid Taiwan latitude')
        if not isinstance(p.get('lon'), (int, float)) or not 118 <= p['lon'] <= 123:
            raise ValueError('Invalid Taiwan longitude')
        ids.append(p['id'])
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate attraction ids')
    if not isinstance(seasons, dict) or seasons.get('_storage_error'):
        raise ValueError('Seasonal storage is unavailable; preserve previous backup')
    season_ids = {k for k in seasons if not k.startswith('_')}
    if season_ids != set(ids):
        raise ValueError('Seasonal records must match the complete directory')
    for id in ids:
        s = seasons[id]
        if not isinstance(s, dict):
            raise ValueError('Invalid seasonal record')
        months = s.get('months')
        if months is not None and (not isinstance(months, list) or not months or
                any(type(m) is not int or not 1 <= m <= 12 for m in months)):
            raise ValueError('Invalid seasonal months')
        for key in ('period', 'source', 'source_url', 'checked_at'):
            if not isinstance(s.get(key), str) or not s[key]:
                raise ValueError('Incomplete seasonal record')
    if not isinstance(foliage, dict) or foliage.get('storage_error'):
        raise ValueError('Foliage storage is unavailable; preserve previous backup')
    observations = foliage.get('foliage')
    if not isinstance(observations, dict) or set(observations) != set(ids):
        raise ValueError('Foliage records must match the complete directory')
    for observation in observations.values():
        if observation is None:
            continue
        if not isinstance(observation, dict) or type(observation.get('status')) is not int or not 0 <= observation['status'] <= 3:
            raise ValueError('Invalid foliage status')
        for key in ('summary', 'scope', 'source', 'source_url', 'reported_at', 'checked_at'):
            if not isinstance(observation.get(key), str) or not observation[key]:
                raise ValueError('Incomplete dated foliage record')
    return len(ids)


def synchronize(base_url, output_dir, loader=fetch_json):
    parts = urlsplit(base_url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment or parts.path not in ('', '/'):
        raise ValueError('Use the public Site HTTPS origin without credentials')
    data = {name: loader(base_url.rstrip('/') + '/' + name) for name in FILENAMES}
    count = validate(data)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    changed = []
    for name in FILENAMES:
        target = output_dir / name
        content = json.dumps(data[name], ensure_ascii=False, indent=2, sort_keys=True) + '\n'
        if target.exists() and target.read_text(encoding='utf-8') == content:
            continue
        temp = target.with_suffix('.json.tmp')
        temp.write_text(content, encoding='utf-8')
        os.replace(temp, target)
        changed.append(name)
    print(f'Validated {count} attractions. Changed files: {", ".join(changed) or "none"}.')
    # Keep official sync timestamps unchanged; the backup does not observe leaves.
    return changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=os.environ.get('MAPLE_SITE_URL', DEFAULT_SITE))
    parser.add_argument('--output-dir', default='data/current')
    args = parser.parse_args()
    synchronize(args.base_url, args.output_dir)
