// Renders a headline chart from a row's `chart` spec (see data/README.md).
// Requires the global `Chart` (Chart.js UMD) and, for sketch-style charts, `rough` (rough.js).

import { el, monthToYear, formatMonth } from "./data.js";

const rendered = []; // [{container, spec, opts}] so charts can be redrawn on theme change
const SKETCH_FONT = '"Patrick Hand", "Comic Sans MS", cursive';
export const SKETCH_NOTE = "Hand-drawn style: indicative, hand-curated data, not a rigorous benchmark.";

// Model names next to points. Each label tries above, below, right and left of its point
// and is skipped (tooltip only) if all four would overlap another label or point.
const pointLabels = {
  id: "pointLabels",
  afterDatasetsDraw(chart, args, opts) {
    if (!opts.enabled) return;
    const { ctx, chartArea: area } = chart;
    const r = 6, gap = 3, h = opts.size;
    const metas = chart.data.datasets.map((ds, i) => chart.getDatasetMeta(i)).filter(m => !m.hidden);
    const placed = metas.flatMap(m => m.data.map(e => ({ x: e.x - r, y: e.y - r, w: 2 * r, h: 2 * r })));
    const overlaps = a => placed.some(b => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
    const inside = a => a.x >= area.left - 8 && a.x + a.w <= area.right + 14 && a.y >= area.top - 14 && a.y + a.h <= area.bottom;

    ctx.save();
    ctx.font = `${h}px ${opts.font}`;
    ctx.fillStyle = opts.colour;
    ctx.textBaseline = "top";
    for (const meta of metas) {
      meta.data.forEach((e, j) => {
        const text = meta._dataset.data[j].label;
        if (!text) return;
        const w = ctx.measureText(text).width;
        const spots = [
          { x: e.x - w / 2, y: e.y - r - gap - h },
          { x: e.x - w / 2, y: e.y + r + gap },
          { x: e.x + r + gap, y: e.y - h / 2 },
          { x: e.x - r - gap - w, y: e.y - h / 2 },
        ].map(p => ({ ...p, w, h }));
        const spot = spots.find(a => inside(a) && !overlaps(a));
        if (!spot) return;
        placed.push(spot);
        ctx.fillText(text, spot.x, spot.y);
      });
    }
    ctx.restore();
  },
};

// Dashed horizontal reference lines, e.g. a human baseline: spec.references = [{label, y}].
const referenceLines = {
  id: "referenceLines",
  afterDatasetsDraw(chart, args, opts) {
    const { ctx, chartArea: area, scales: { y } } = chart;
    for (const ref of opts.lines || []) {
      const py = y.getPixelForValue(ref.y);
      if (py < area.top || py > area.bottom) continue;
      ctx.save();
      ctx.strokeStyle = opts.colour;
      ctx.fillStyle = opts.colour;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(area.left, py);
      ctx.lineTo(area.right, py);
      ctx.stroke();
      ctx.font = `11px ${opts.font}`;
      ctx.textAlign = "right";
      ctx.fillText(ref.label, area.right - 4, py - 4);
      ctx.restore();
    }
  },
};

// Confidence intervals: points with `lo` and `hi` get vertical whiskers.
const errorBars = {
  id: "errorBars",
  beforeDatasetsDraw(chart) {
    const { ctx, scales: { y } } = chart;
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      ctx.save();
      ctx.strokeStyle = ds.sketchColour;
      ctx.lineWidth = 1.5;
      meta.data.forEach((e, j) => {
        const p = ds.data[j];
        if (p.lo == null || p.hi == null) return;
        const top = y.getPixelForValue(p.hi), bottom = y.getPixelForValue(p.lo);
        ctx.beginPath();
        ctx.moveTo(e.x, top); ctx.lineTo(e.x, bottom);
        ctx.moveTo(e.x - 4, top); ctx.lineTo(e.x + 4, top);
        ctx.moveTo(e.x - 4, bottom); ctx.lineTo(e.x + 4, bottom);
        ctx.stroke();
      });
      ctx.restore();
    });
  },
};

// Annotated connectors between two labelled points: spec.links = [{from, to, label}],
// e.g. two versions of the same model. Drawn as a dashed arrow with its label at the midpoint.
const links = {
  id: "links",
  afterDatasetsDraw(chart, args, opts) {
    if (!opts.links || !opts.links.length) return;
    const { ctx } = chart;
    const find = label => {
      for (const [i, ds] of chart.data.datasets.entries()) {
        const j = ds.data.findIndex(p => p.label === label);
        if (j >= 0) return chart.getDatasetMeta(i).data[j];
      }
    };
    for (const link of opts.links) {
      const a = find(link.from), b = find(link.to);
      if (!a || !b) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x), inset = 9;
      const x1 = a.x + inset * Math.cos(angle), y1 = a.y + inset * Math.sin(angle);
      const x2 = b.x - inset * Math.cos(angle), y2 = b.y - inset * Math.sin(angle);
      ctx.save();
      ctx.strokeStyle = opts.colour;
      ctx.fillStyle = opts.colour;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 7 * Math.cos(angle - 0.4), y2 - 7 * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - 7 * Math.cos(angle + 0.4), y2 - 7 * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fill();
      if (link.label) {
        ctx.font = `italic 11px ${opts.font}`;
        ctx.textAlign = "center";
        ctx.fillText(link.label, (x1 + x2) / 2, (y1 + y2) / 2 + 16);
      }
      ctx.restore();
    }
  },
};

// Hand-drawn rendering for indicative, non-rigorous data (spec.style = "sketch").
// Chart.js still lays out axes and points; rough.js redraws the marks.
const sketch = {
  id: "sketch",
  afterDatasetsDraw(chart, args, opts) {
    if (!opts.enabled || !window.rough) return;
    const rc = rough.canvas(chart.canvas);
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      const pts = meta.data.map(e => [e.x, e.y]);
      const stroke = ds.sketchColour;
      if (ds.showLine && pts.length > 1) rc.linearPath(pts, { stroke, strokeWidth: 1.5, roughness: 1.4, bowing: 2, seed: 7 });
      pts.forEach(([x, y], j) => rc.circle(x, y, 13, { stroke, fill: stroke, fillStyle: "hachure", hachureGap: 2.5, roughness: 1.2, seed: 11 + j }));
    });
  },
};

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
        if (r.lo != null && r.hi != null) s += ` (95% CI ${formatValue(r.lo, spec.yFormat)}–${formatValue(r.hi, spec.yFormat)})`;
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
  const isSketch = spec.style === "sketch";
  const datasets = spec.series.map((s, i) => {
    const colour = colours[i % colours.length];
    const mark = isSketch ? "transparent" : colour; // sketch plugin draws the marks instead
    return {
      label: s.label,
      data: s.points.map(p => ({ ...p, date: p.x, x: monthToYear(p.x) })),
      sketchColour: colour,
      borderColor: mark,
      backgroundColor: colour,
      pointBackgroundColor: ctx => (isSketch ? "transparent" : pointColour(ctx, colour)),
      pointBorderColor: mark,
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
  const ys = datasets.flatMap(d => d.data.flatMap(p => [p.y, p.lo, p.hi].filter(v => v != null)));
  let { yMin, yMax } = spec;
  if (spec.yScale === "log") {
    // Snap the range to the surrounding ticks so edge points are not clipped.
    const candidates = spec.yFormat === "duration" ? DURATION_TICKS : DECADE_TICKS;
    yMin ??= [...candidates].reverse().find(v => v <= Math.min(...ys) * 0.8);
    yMax ??= candidates.find(v => v >= Math.max(...ys) * 1.25);
  }
  const font = isSketch ? SKETCH_FONT : Chart.defaults.font.family;
  return {
    type: "line",
    data: { datasets },
    plugins: [referenceLines, errorBars, links, sketch, pointLabels],
    options: {
      layout: { padding: { top: 14, right: 16 } },
      font: { family: font },
      scales: {
        x: {
          type: "linear",
          min: Math.floor(Math.min(...xs)),
          max: Math.ceil(Math.max(...xs) + 0.01),
          title: { display: true, text: spec.xLabel || "Model release date", font: { family: font } },
          grid: { display: !isSketch },
          ticks: { stepSize: 1, font: { family: font }, callback: v => (Number.isInteger(v) ? v : "") },
        },
        y: {
          type: spec.yScale === "log" ? "logarithmic" : "linear",
          min: yMin,
          max: yMax,
          title: { display: !!spec.yLabel, text: spec.yLabel, font: { family: font } },
          grid: { display: !isSketch },
          afterBuildTicks: spec.yScale === "log" ? logTicks(spec) : undefined,
          ticks: { font: { family: font }, precision: spec.yFormat === "integer" ? 0 : undefined, callback: v => formatValue(v, spec.yFormat) },
        },
      },
      plugins: {
        tooltip: tooltip(spec),
        sketch: { enabled: isSketch },
        referenceLines: { lines: spec.references, colour: token("--muted"), font },
        links: { links: spec.links, colour: token("--muted"), font },
        pointLabels: {
          enabled: spec.pointLabels !== false,
          colour: token("--muted"),
          font,
          size: isSketch ? (large ? 15 : 13) : (large ? 11 : 9),
        },
      },
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
        [spec.horizontal ? "y" : "x"]: { ticks: { autoSkip: false, font: { size: 11 } } },
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

  if (spec.kind === "bar" && spec.horizontal) {
    // Give each bar enough room for its label.
    const n = spec.series[0].points.length;
    container.style.height = `${Math.max(230, n * (opts.large ? 26 : 17) + 50)}px`;
  }

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

