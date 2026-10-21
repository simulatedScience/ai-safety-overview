# Dangerous AI Behaviour Tracker

A static site giving an overview of dangerous AI behaviours as models improved, each paired
with one headline benchmark and a sourced timeline.

- `index.html` – overview table, one row per behaviour.
- `behaviours/<id>.html` – one page per behaviour (timeline + key papers and events).
- `data/` – all content as JSON; see [data/README.md](data/README.md) for the format.
- `js/`, `css/` – rendering (plain ES modules + [Chart.js](https://www.chartjs.org/) 4.4.1 from cdnjs).
- `tools/fetch_sources.py` – downloads offline copies of cited publications into `sources/` (gitignored).

## Run locally

Pages load their data with `fetch`, which browsers block on `file://`. Serve the folder instead:

```bash
python tools/serve.py
```

Then open http://localhost:8000.

## Deploy (GitHub Pages)

No build step. In the repository settings, under **Pages**, choose
"Deploy from a branch", branch `main`, folder `/ (root)`. The `.nojekyll` file makes Pages
serve the files as they are.

## Editing rules

- Every entry links to its original publication with month and year.
- Quotes: one short sentence, copied verbatim from text actually read. A source may be quoted in several entries.
- Prefer primary sources (papers, system cards, lab blogs, official statements) over news.
- Keep `"verified": false` until an item is checked against its primary source; the site shows these with an "unverified" badge.
- One benchmark per headline chart. Never mix incompatible metrics; use a placeholder instead.
