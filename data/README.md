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

Direction: higher always means more of the behaviour or capability (the overview states this
once), so y labels carry no "lower is better" hints. Tiered charts put the riskiest tier on top.

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
  "references": [{ "label": "PhD expert baseline", "y": 1 }],  // optional dashed reference lines; add "align": "left" to move the label off crowded points
  "links": [{ "from": "GPT-4o (Aug 2024)", "to": "GPT-4o (Mar 2025)", "label": "same model, new post-training" }],  // optional arrows between points
  "yMin": 0, "yMax": 100,              // optional
  "connect": true,                     // line only: draw lines between points (default true)
  "stepped": true,                     // line only: draw steps instead of slopes (cumulative counts)
  "trend": false,                      // line only: hide the trend-line selector (shown by default)
  "yCategories": ["Lowest tier", ["Two-line", "tier"], "Top tier"],  // optional: tiered y axis; point y = tier index (0 = bottom)
  "extendTo": "2026-10",               // optional: carry each series' last value on to this date (no marker)
  "horizontal": false,                 // bar only
  "series": [
    {
      "label": "Frontier models",
      "points": [
        // x = model release (or result) month "YYYY-MM", or day "YYYY-MM-DD"; label = model name
        { "x": "2023-03", "y": 4, "label": "GPT-4", "verified": true },   // optional "lo"/"hi": 95% CI
        { "x": "2026-04", "y": 960, "label": "Claude Mythos Preview", "verified": true, "lowerBound": true },
        { "x": "2026-04-09", "y": 10, "label": "OpenAI internal model ×5", "org": "openai", "note": "shown in the tooltip", "verified": true }
      ]
    }
  ],
  "source": { "title": "Measuring AI ability to complete long tasks", "org": "METR", "date": "2026-01", "url": "https://..." },
  "caveat": "Optional one-line caveat shown under the chart.",
  "reason": "Placeholder only: why there is no chart yet."
}
```

Unverified points render as hollow markers (line) or faded bars (bar); lower bounds render as triangles.

Company colours: when any point's label names a known model family, every point is coloured by
its company (site-wide colours in `css/style.css`, matching rules in `js/companies.js`). Set
`"org"` on a point to override the match, e.g. `"other"` for joint results from several companies.
Anonymised charts keep per-series colours. With company colours, series differ by marker shape.
A series may set `"org"` (e.g. one series per lab): its line and points then use that company's colour,
and the company chip in the legend hides the whole series.

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
