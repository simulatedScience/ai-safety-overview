// Overview page: one table row per behaviour, each with its headline chart.

import { loadJSON, el, sourceLine, showError } from "./data.js";
import { renderChart } from "./charts.js";

async function main() {
  const body = document.getElementById("rows");
  try {
    const { rows: ids } = await loadJSON("data/rows.json");
    const rows = await Promise.all(ids.map(id => loadJSON(`data/rows/${id}.json`)));
    body.replaceChildren();
    for (const row of rows) {
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
  } catch (err) {
    showError(body.closest("main"), err);
  }
}

main();
