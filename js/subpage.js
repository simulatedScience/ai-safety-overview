// Behaviour subpage: headline chart, timeline of all entries, and the key entries in detail.
// The row id comes from <body data-row="...">.

import { loadJSON, el, formatMonth, sourceLine, showError, siteUrl } from "./data.js";
import { renderChart } from "./charts.js";

const KIND_LABELS = { paper: "Paper", event: "Event", policy: "Policy", report: "Report", "system-card": "System card" };

function unverifiedBadge(item) {
  return item.verified === false ? el("span", { class: "badge unverified", title: "Not yet checked against the primary source" }, "unverified") : null;
}

function link(item) {
  return item.url ? el("a", { href: item.url, target: "_blank", rel: "noopener" }, item.title) : item.title;
}

function timeline(entries) {
  return el("ol", { class: "timeline" }, entries.map(e =>
    el("li", {},
      el("span", { class: "when" }, formatMonth(e.date)), " ",
      link(e), e.org ? ` (${e.org})` : "", " ", unverifiedBadge(e))));
}

function entryCard(e) {
  return el("article", { class: "entry" },
    el("h3", {}, link(e)),
    el("div", { class: "meta" },
      [e.org, formatMonth(e.date)].filter(Boolean).join(" · "), " ",
      e.kind ? el("span", { class: "badge kind" }, KIND_LABELS[e.kind] || e.kind) : null, " ",
      unverifiedBadge(e)),
    e.quote ? el("blockquote", {}, `“${e.quote}”`) : null,
    e.note ? el("p", {}, el("strong", {}, "Why it matters: "), e.note) : null);
}

async function main() {
  const id = document.body.dataset.row;
  const content = document.getElementById("content");
  try {
    const row = await loadJSON(`data/rows/${id}.json`);

    document.title = `${row.title} · Dangerous AI Behaviour Tracker`;
    document.getElementById("title").textContent = row.title;
    document.getElementById("lede").textContent = row.summary;

    const entries = [...(row.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
    const featured = entries.filter(e => e.featured);
    const chartBox = el("div", { class: "chart-box large" });

    content.replaceChildren(
      row.intro ? el("section", { class: "intro" }, el("p", {}, row.intro)) : "",
      el("h2", {}, "Headline chart"),
      chartBox,
      row.chart && row.chart.kind !== "placeholder"
        ? el("div", { class: "chart-meta" },
            el("strong", {}, row.chart.title), ". ", sourceLine(row.chart.source),
            row.chart.caveat ? el("div", {}, row.chart.caveat) : null,
            el("div", {}, "Hollow markers: value not yet verified against the source. Triangles: lower bound."))
        : null,
      el("h2", {}, "Timeline"),
      entries.length ? timeline(entries) : el("p", { class: "legend-note" }, "No entries yet."),
      el("h2", {}, "Key papers and events"),
      featured.length ? el("div", { class: "entries" }, featured.map(entryCard)) : el("p", { class: "legend-note" }, "No entries yet."),
      el("p", {}, el("a", { href: siteUrl(`index.html#${id}`) }, "← Back to overview")));

    renderChart(chartBox, row.chart, { large: true });
  } catch (err) {
    showError(content, err);
  }
}

main();
