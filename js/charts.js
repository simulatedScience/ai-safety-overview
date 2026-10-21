// Renders a headline chart from a row's `chart` spec (see data/README.md).
// Requires the global `Chart` from Chart.js (UMD build).

import { el, monthToYear, formatMonth } from "./data.js";

const rendered = []; // [{container, spec, opts}] so charts can be redrawn on theme change

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function formatValue(v, format) {
  if (format === "duration") {
    if (v < 60) return `${Math.round(v)} min`;
    const h = Math.floor(v / 60);
    const m = Math.round(v - h * 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  if (format === "percent") return `${+v.toFixed(1)}%`;
  return String(+(+v).toFixed(2));
}

function placeholder(container, spec) {
  container.replaceChildren(
    el("div", { class: "placeholder" },
      el("strong", {}, "No consistent benchmark yet"),
      spec.reason || "A chart will be added once a single benchmark tracks this behaviour over time."));
}

function pointColour(ctx, colour) {
  return ctx.raw && ctx.raw.verified === false ? "transparent" : colour;
}

function tooltip(spec) {
  return {
    callbacks: {
      title: items => items[0].raw.label || "",
      label: item => {
        const r = item.raw;
        let s = `${formatMonth(r.date)}: ${formatValue(r.y, spec.yFormat)}`;
        if (r.lowerBound) s += " (lower bound)";
        if (r.verified === false) s += " (unverified)";
        return s;
      },
    },
  };
}

// Readable ticks on log axes: steps of ×4 for durations (1 min, 4 min, 15 min, 1 h, 4 h, 16 h …),
// 1-2-5 steps otherwise.
const DURATION_TICKS = [1, 4, 15, 60, 240, 960, 3840];
const DECADE_TICKS = [1, 2, 5].flatMap(m => [0.01, 0.1, 1, 10, 100, 1000, 10000].map(d => m * d)).sort((a, b) => a - b);

function logTicks(spec) {
  const candidates = spec.yFormat === "duration" ? DURATION_TICKS : DECADE_TICKS;
  return axis => {
    axis.ticks = candidates.filter(v => v >= axis.min && v <= axis.max).map(value => ({ value }));
  };
}

function lineConfig(spec, colours, large) {
  const datasets = spec.series.map((s, i) => {
    const colour = colours[i % colours.length];
    return {
      label: s.label,
      data: s.points.map(p => ({ ...p, date: p.x, x: monthToYear(p.x) })),
      borderColor: colour,
      backgroundColor: colour,
      pointBackgroundColor: ctx => pointColour(ctx, colour),
      pointBorderColor: colour,
      pointBorderWidth: 2,
      pointStyle: ctx => (ctx.raw && ctx.raw.lowerBound ? "triangle" : "circle"),
      pointRadius: large ? 5 : 3.5,
      pointHoverRadius: 7,
      showLine: spec.connect !== false,
      borderWidth: 1.5,
      tension: 0,
    };
  });
  const xs = datasets.flatMap(d => d.data.map(p => p.x));
  const ys = datasets.flatMap(d => d.data.map(p => p.y));
  let { yMin, yMax } = spec;
  if (spec.yScale === "log") {
    // Snap the range to the surrounding ticks so edge points are not clipped.
    const candidates = spec.yFormat === "duration" ? DURATION_TICKS : DECADE_TICKS;
    yMin ??= [...candidates].reverse().find(v => v <= Math.min(...ys) * 0.8);
    yMax ??= candidates.find(v => v >= Math.max(...ys) * 1.25);
  }
  return {
    type: "line",
    data: { datasets },
    options: {
      scales: {
        x: {
          type: "linear",
          min: Math.floor(Math.min(...xs)),
          max: Math.ceil(Math.max(...xs) + 0.01),
          ticks: { stepSize: 1, callback: v => (Number.isInteger(v) ? v : "") },
        },
        y: {
          type: spec.yScale === "log" ? "logarithmic" : "linear",
          min: yMin,
          max: yMax,
          title: { display: !!spec.yLabel, text: spec.yLabel },
          afterBuildTicks: spec.yScale === "log" ? logTicks(spec) : undefined,
          ticks: { callback: v => formatValue(v, spec.yFormat) },
        },
      },
      plugins: { tooltip: tooltip(spec) },
    },
  };
}

function barConfig(spec, colours) {
  // Bar charts show a single study across models: one series, category x axis.
  const s = spec.series[0];
  const colour = colours[0];
  const data = s.points.map(p => ({ ...p, date: p.x, x: p.label }));
  return {
    type: "bar",
    data: {
      labels: data.map(p => p.label),
      datasets: [{
        label: s.label,
        data,
        backgroundColor: data.map(p => (p.verified === false ? colour + "55" : colour)),
        borderColor: colour,
        borderWidth: 1,
        maxBarThickness: 44,
      }],
    },
    options: {
      indexAxis: spec.horizontal ? "y" : "x",
      parsing: { xAxisKey: spec.horizontal ? "y" : "x", yAxisKey: spec.horizontal ? "x" : "y" },
      scales: {
        [spec.horizontal ? "x" : "y"]: {
          min: spec.yMin ?? 0,
          max: spec.yMax,
          title: { display: !!spec.yLabel, text: spec.yLabel },
          ticks: { callback: v => formatValue(v, spec.yFormat) },
        },
      },
      plugins: { tooltip: tooltip(spec) },
    },
  };
}

function draw({ container, spec, opts }) {
  if (container._chart) container._chart.destroy();
  if (!spec || spec.kind === "placeholder") return placeholder(container, spec || {});

  const colours = [token("--chart-1"), token("--chart-2"), token("--chart-3"), token("--chart-4")];
  Chart.defaults.color = token("--muted");
  Chart.defaults.borderColor = token("--chart-grid");
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const cfg = spec.kind === "bar" ? barConfig(spec, colours) : lineConfig(spec, colours, opts.large);
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  cfg.options.animation = false;
  cfg.options.plugins.legend = { display: spec.series.length > 1 };

  const canvas = el("canvas", { role: "img", "aria-label": spec.title || "Chart" });
  container.replaceChildren(canvas);
  container._chart = new Chart(canvas, cfg);
}

export function renderChart(container, spec, opts = {}) {
  const entry = { container, spec, opts };
  rendered.push(entry);
  draw(entry);
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => rendered.forEach(draw));

