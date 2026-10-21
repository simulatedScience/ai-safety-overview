"""Check data/rows/*.json against the rules in data/README.md.

Usage: python tools/validate.py [row-id ...]
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2]))?$")
KINDS = {"paper", "system-card", "report", "event", "policy"}
CHART_KINDS = {"line", "bar", "placeholder"}
MAX_QUOTE_WORDS = 20  # rule of thumb is ~15; flag anything clearly longer


def check_row(row_id):
    problems, warnings = [], []
    path = ROOT / "data" / "rows" / f"{row_id}.json"
    if not path.exists():
        return [f"missing {path.relative_to(ROOT)}"], []
    try:
        row = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        return [f"invalid JSON: {err}"], []

    if row.get("id") != row_id:
        problems.append(f"id {row.get('id')!r} does not match filename")
    if not (ROOT / "behaviours" / f"{row_id}.html").exists():
        problems.append("no behaviours/<id>.html page")
    for key in ("title", "summary", "definition", "development", "methods"):
        if not row.get(key):
            problems.append(f"missing {key}")

    chart = row.get("chart") or {}
    if chart.get("kind") not in CHART_KINDS:
        problems.append(f"chart.kind must be one of {sorted(CHART_KINDS)}")
    elif chart["kind"] != "placeholder":
        if not chart.get("source", {}).get("url"):
            problems.append("chart has no source url")
        for s in chart.get("series", []):
            for p in s.get("points", []):
                if not DATE.match(str(p.get("x", ""))):
                    problems.append(f"chart point {p.get('label')!r}: bad x {p.get('x')!r}")
                if not isinstance(p.get("y"), (int, float)):
                    problems.append(f"chart point {p.get('label')!r}: y is not a number")
                if p.get("verified") is not True:
                    warnings.append(f"chart point {p.get('label')!r} unverified")

    entries = row.get("entries", [])
    featured = sum(1 for e in entries if e.get("featured"))
    if not 5 <= featured <= 8:
        warnings.append(f"{featured} featured entries (target 5–8)")
    for e in entries:
        label = e.get("title", "?")[:50]
        for key in ("date", "title", "org", "url", "kind"):
            if not e.get(key):
                problems.append(f"entry {label!r}: missing {key}")
        if e.get("date") and not DATE.match(e["date"]):
            problems.append(f"entry {label!r}: bad date {e['date']!r}")
        if e.get("kind") and e["kind"] not in KINDS:
            problems.append(f"entry {label!r}: unknown kind {e['kind']!r}")
        if e.get("quote") and len(e["quote"].split()) > MAX_QUOTE_WORDS:
            problems.append(f"entry {label!r}: quote has {len(e['quote'].split())} words")
        if e.get("featured") and not e.get("note"):
            warnings.append(f"entry {label!r}: featured but no note")
        if e.get("verified") is not True:
            warnings.append(f"entry {label!r} unverified")
        if e.get("archive") and not (ROOT / "sources" / e["archive"]).exists():
            warnings.append(f"entry {label!r}: archive {e['archive']} not in sources/")
    return problems, warnings


def main(argv):
    ids = argv or json.loads((ROOT / "data" / "rows.json").read_text(encoding="utf-8"))["rows"]
    failed = False
    for row_id in ids:
        problems, warnings = check_row(row_id)
        status = "FAIL" if problems else "ok"
        print(f"[{status}] {row_id}")
        for p in problems:
            print(f"    error: {p}")
        for w in warnings:
            print(f"    warn:  {w}")
        failed |= bool(problems)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
