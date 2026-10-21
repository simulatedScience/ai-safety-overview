// Behaviour subpage: definition, development and methods, headline chart, and one
// chronological table of all entries. The row id comes from <body data-row="...">.

import { loadJSON, el, formatMonth, sourceLine, showError, siteUrl } from "./data.js";
import { renderChart, SKETCH_NOTE } from "./charts.js";

const KIND_LABELS = { paper: "Paper", event: "Event", policy: "Policy", report: "Report", "system-card": "System card" };

function unverifiedBadge(item) {
  return item.verified === false ? el("span", { class: "badge unverified", title: "Not yet checked against the primary source" }, "unverified") : null;
}

function link(item) {
  return item.url ? el("a", { href: item.url, target: "_blank", rel: "noopener" }, item.title) : item.title;
}

function entryRow(e) {
  return el("tr", { class: e.featured ? "key" : null },
    el("td", { class: "when" }, formatMonth(e.date)),
    el("td", { class: "what" },
      el("div", { class: "title" }, link(e)),
      el("div", { class: "meta" },
        e.org, " ",
        e.kind ? el("span", { class: "badge kind" }, KIND_LABELS[e.kind] || e.kind) : null, " ",
        e.featured ? el("span", { class: "badge key", title: "Key paper or event" }, "key") : null, " ",
        unverifiedBadge(e)),
      e.quote ? el("blockquote", {}, `“${e.quote}”`) : null),
    el("td", { class: "why" }, e.note || ""));
}

function timeline(entries) {
  const table = el("table", { class: "timeline" },
    el("thead", {}, el("tr", {},
      el("th", { scope: "col" }, "Date"),
      el("th", { scope: "col" }, "Publication or event"),
      el("th", { scope: "col" }, "Why it matters"))),
    el("tbody", {}, entries.map(entryRow)));

  const toggle = el("input", { type: "checkbox", id: "key-only" });
  toggle.addEventListener("change", () => table.classList.toggle("key-only", toggle.checked));
  const hasMinor = entries.some(e => !e.featured);

  return [
    hasMinor ? el("label", { class: "filter", for: "key-only" }, toggle, ` Key items only (${entries.filter(e => e.featured).length} of ${entries.length})`) : null,
    table,
  ];
}

function context(row) {
  const blocks = [];
  if (row.development) blocks.push(el("section", { class: "development" }, el("h2", {}, "How it developed"), el("p", {}, row.development)));
  if (row.methods) blocks.push(el("section", { class: "methods" }, el("h2", {}, "Methods and limitations"), el("p", {}, row.methods)));
  return blocks.length ? el("div", { class: "context" }, blocks) : null;
}

// Explains marker styles only when the chart uses them.
function markerNote(chart) {
  const points = (chart.series || []).flatMap(s => s.points);
  const notes = [
    points.some(p => p.verified === false) && "Hollow markers: value not yet verified against the source.",
    points.some(p => p.lowerBound) && "Triangles: lower bound.",
  ].filter(Boolean);
  return notes.length ? el("div", {}, notes.join(" ")) : null;
}

async function main() {
  const id = document.body.dataset.row;
  const content = document.getElementById("content");
  try {
    const row = await loadJSON(`data/rows/${id}.json`);

    document.title = `${row.title} · Dangerous AI Behaviour Tracker`;
    document.getElementById("title").textContent = row.title;
    document.getElementById("lede").textContent = row.definition || row.summary;
    document.getElementById("back-top").href = siteUrl(`index.html#${id}`);

    const entries = [...(row.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
    const chartBox = el("div", { class: "chart-box large" });
    const hasChart = row.chart && row.chart.kind !== "placeholder";

    content.replaceChildren(
      context(row) || "",
      el("h2", {}, hasChart ? row.chart.title : `Measuring ${row.title.toLowerCase()}`),
      chartBox,
      hasChart
        ? el("div", { class: "chart-meta" },
            sourceLine(row.chart.source),
            row.chart.style === "sketch" ? el("div", {}, SKETCH_NOTE) : null,
            row.chart.caveat ? el("div", {}, row.chart.caveat) : null,
            markerNote(row.chart))
        : null,
      el("h2", {}, "Timeline"),
      entries.length ? el("div", {}, timeline(entries)) : el("p", { class: "legend-note" }, "No entries yet."),
      el("p", { class: "back" }, el("a", { href: siteUrl(`index.html#${id}`) }, "← Back to overview")));

    renderChart(chartBox, row.chart, { large: true });
  } catch (err) {
    showError(content, err);
  }
}

main();
