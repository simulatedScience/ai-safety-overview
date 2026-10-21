# Data format

`rows.json` lists the row ids in display order. Each row lives in `rows/<id>.json` and
renders both its line on the overview table (`index.html`) and its subpage
(`behaviours/<id>.html`).

## Row file

```jsonc
{
  "id": "sandbagging",                 // must match the filename and behaviours/<id>.html
  "title": "Sandbagging",
  "summary": "1–2 sentences shown in the overview table only.",
  "definition": "One clear sentence defining the behaviour; the subpage lede.",
  "development": "2–4 sentences on how it developed over time ('How it developed').",
  "methods": "1–3 sentences on how it is measured or tracked, and the drawbacks ('Methods and limitations').",
  "chart": { ... },                    // see below
  "entries": [ ... ]                   // see below
}
```

## Chart

One benchmark (or one aggregate benchmark) per chart. Never mix incompatible metrics
(e.g. METR Time Horizon 1.0 and 1.1) in one chart.

```jsonc
{
  "kind": "line",                      // "line" (x = release date; set connect:false for one-off studies), "bar" or "placeholder"
  "title": "METR 50% time horizon (TH1.1)",
  "yLabel": "Task length (human time)",
  "yScale": "log",                     // "log" or "linear" (default)
  "yFormat": "duration",               // "duration" (value in minutes), "percent" (0–100), "number" or "integer"
  "xLabel": "Model release date",      // optional; default "Model release date"
  "style": "sketch",                   // optional: hand-drawn look for indicative, hand-curated data
  "pointLabels": false,                // optional: hide point labels (e.g. anonymised models)
  "references": [{ "label": "PhD expert baseline", "y": 1 }],  // optional dashed reference lines
  "links": [{ "from": "GPT-4o (Aug 2024)", "to": "GPT-4o (Mar 2025)", "label": "same model, new post-training" }],  // optional arrows between points
  "yMin": 0, "yMax": 100,              // optional
  "connect": true,                     // line only: draw lines between points (default true)
  "horizontal": false,                 // bar only
  "series": [
    {
      "label": "Frontier models",
      "points": [
        // x = model release (or measurement) month; label = model name
        { "x": "2023-03", "y": 4, "label": "GPT-4", "verified": true },   // optional "lo"/"hi": 95% CI
        { "x": "2026-04", "y": 960, "label": "Claude Mythos Preview", "verified": true, "lowerBound": true }
      ]
    }
  ],
  "source": { "title": "Measuring AI ability to complete long tasks", "org": "METR", "date": "2026-01", "url": "https://..." },
  "caveat": "Optional one-line caveat shown under the chart.",
  "reason": "Placeholder only: why there is no chart yet."
}
```

Unverified points render as hollow markers (line) or faded bars (bar); lower bounds render as triangles.

## Entries

All entries appear in the subpage's timeline table (date | link, authors, quote | note).
Entries with `"featured": true` (aim for 5–8 per row) are highlighted as key items and
remain visible under the "Key items only" filter.

```jsonc
{
  "date": "2024-06",                   // YYYY-MM of original publication
  "title": "AI Sandbagging: Language Models can Strategically Underperform on Evaluations",
  "org": "van der Weij et al.",        // lab, agency or "First author et al."
  "kind": "paper",                     // paper | system-card | report | event | policy
  "url": "https://arxiv.org/abs/2406.07358",   // primary source
  "pdf": "https://arxiv.org/pdf/2406.07358",   // optional direct PDF, used for the offline copy
  "archive": "2024-06_van-der-weij_ai-sandbagging.pdf", // optional filename of the offline copy in /sources
  "featured": true,
  "quote": "One sentence, ≤ ~15 words, copied verbatim from the source. Omit if not read.",
  "note": "One line on why it matters.",
  "verified": true                     // false until checked against the primary source
}
```

## Offline copies

`/sources` (gitignored) holds offline copies of cited publications. Run
`python tools/fetch_sources.py` to download any entry with an `archive` filename that is
missing locally (from `pdf` if set, else `url`).
