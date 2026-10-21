"""Download offline copies of cited publications into /sources (gitignored).

For every entry in data/rows/*.json that has an `archive` filename not yet present in
/sources, download it from `pdf` if set, else from `url`. Existing files are kept.

Usage: python tools/fetch_sources.py
"""

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "sources"
SKIP_HOSTS = ("x.com", "twitter.com")
HEADERS = {"User-Agent": "Mozilla/5.0 (offline-archive script for ai-safety-overview)"}


def entries():
    ids = json.loads((ROOT / "data" / "rows.json").read_text(encoding="utf-8"))["rows"]
    for row_id in ids:
        path = ROOT / "data" / "rows" / f"{row_id}.json"
        if not path.exists():
            continue
        for entry in json.loads(path.read_text(encoding="utf-8")).get("entries", []):
            yield row_id, entry


def main():
    SOURCES.mkdir(exist_ok=True)
    fetched, present, failed = 0, 0, []
    for row_id, entry in entries():
        name = entry.get("archive")
        if not name:
            continue
        target = SOURCES / name
        if target.exists():
            present += 1
            continue
        url = entry.get("pdf") or entry.get("url")
        if not url or any(h in url for h in SKIP_HOSTS):
            continue
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as res:
                target.write_bytes(res.read())
            fetched += 1
            print(f"fetched  {name}")
        except Exception as err:  # keep going; report at the end
            failed.append((row_id, name, url, err))
    print(f"\n{fetched} fetched, {present} already present, {len(failed)} failed")
    for row_id, name, url, err in failed:
        print(f"  [{row_id}] {name} <- {url}: {err}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
