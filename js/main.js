// Overview page: one table row per behaviour, each with its headline chart.

import { loadJSON, el, sourceLine, showError } from "./data.js";
import { renderChart } from "./charts.js";

async function main() {
  const body = document.getElementById("rows");
  try {
    const { rows: ids } = await loadJSON("data/rows.json");
    const results = await Promise.allSettled(ids.map(id => loadJSON(`data/rows/${id}.json`)));
    body.replaceChildren();
    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        body.append(el("tr", {}, el("td", { colspan: 2 }, el("p", { class: "error" }, `${ids[i]}: ${result.reason.message}`))));
        continue;
      }
      const row = result.value;
      const chartBox = el("div", { class: "chart-box" });
      const meta = row.chart && row.chart.kind !== "placeholder"
        ? el("div", { class: "chart-meta" },
            el("strong", {}, row.chart.title), ". ", sourceLine(row.chart.source))
        : null;
      body.append(el("tr", { id: row.id },
        el("td", { class: "behaviour" },
          el("h3", {}, row.title),
          el("p", {}, row.summary),
          el("a", { href: `behaviours/${row.id}.html` }, "Read more →")),
        el("td", { class: "chart" }, chartBox, meta)));
      renderChart(chartBox, row.chart);
    }
    // Rows render after load, so the browser's own jump to #<row-id> finds nothing.
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(body.closest("main"), err);
  }
}

main();
