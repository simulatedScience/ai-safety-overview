// Renders a headline chart from a row's `chart` spec (see data/README.md).
// Requires the global `Chart` (Chart.js UMD) and, for sketch-style charts, `rough` (rough.js).

import { el, monthToYear, formatMonth, MONTH_NAMES } from "./data.js";
import { COMPANIES, companyOf, companyName, companyColour } from "./companies.js";

const SKETCH_FONT = '"Patrick Hand", "Comic Sans MS", cursive';
export const SKETCH_NOTE = "Hand-drawn style: indicative, hand-curated data, not a rigorous benchmark.";

// With company colours, series are told apart by marker shape (triangles mark lower bounds).
const SERIES_SHAPES = ["circle", "rect", "rectRot"];
const SHAPE_GLYPHS = { circle: "●", rect: "■", rectRot: "◆" };

// Per-chart view state (labels, trend, hidden companies) lives on the canvas so plugins can read it.
const stateOf = chart => chart.canvas._state;
const isHidden = (chart, p) => !!p.ghost || (!!p.company && stateOf(chart).hiddenOrgs.has(p.company));

// Model names next to points. Each label tries above, below, right and left of its point
// and is skipped (tooltip only) if all four would overlap another label or point.
const pointLabels = {
  id: "pointLabels",
  afterDatasetsDraw(chart, args, opts) {
    if (!stateOf(chart).labels) return;
    const { ctx, chartArea: area } = chart;
    const r = opts.markerRadius, gap = 3, h = opts.size;
    const metas = chart.data.datasets.map((ds, i) => chart.getDatasetMeta(i)).filter(m => !m.hidden);
    const visible = m => m.data.filter((e, j) => !isHidden(chart, m._dataset.data[j]));
    // Start from the markers and any annotation text (link labels) already drawn.
    const placed = [...(chart._textBoxes || []), ...metas.flatMap(m => visible(m).map(e => ({ x: e.x - r, y: e.y - r, w: 2 * r, h: 2 * r })))];
    const overlaps = a => placed.some(b => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
    const inside = a => a.x >= area.left - 8 && a.x + a.w <= area.right + 14 && a.y >= area.top - 14 && a.y + a.h <= area.bottom;

    ctx.save();
    ctx.font = `${h}px ${opts.font}`;
    ctx.fillStyle = opts.colour;
    ctx.textBaseline = "top";
    // A halo in the background colour keeps labels legible where they cross a line.
    ctx.strokeStyle = opts.halo;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    for (const meta of metas) {
      meta.data.forEach((e, j) => {
        const p = meta._dataset.data[j];
        if (!p.label || isHidden(chart, p)) return;
        const w = ctx.measureText(p.label).width;
        const spots = [
          { x: e.x - w / 2, y: e.y - r - gap - h },
          { x: e.x - w / 2, y: e.y + r + gap },
          { x: e.x + r + gap, y: e.y - h / 2 },
          { x: e.x - r - gap - w, y: e.y - h / 2 },
        ].map(s => ({ ...s, w, h }));
        const spot = spots.find(a => inside(a) && !overlaps(a));
        if (!spot) return;
        placed.push(spot);
        ctx.strokeText(p.label, spot.x, spot.y);
        ctx.fillText(p.label, spot.x, spot.y);
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
      ctx.font = `${opts.size}px ${opts.font}`;
      ctx.textAlign = "right";
      ctx.fillText(ref.label, area.right - 4, py - 4);
      ctx.restore();
    }
  },
};

// Least-squares trend lines over the visible points (offered on every line chart unless spec.trend is false).
// On a log axis the fit is exponential and labelled with its doubling time. Each group needs two or more points.
function fit(points, log) {
  const xs = points.map(p => p.x), ys = points.map(p => (log ? Math.log(p.y) : p.y));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const at = x => my + slope * (x - mx);
  return { slope, from: Math.min(...xs), to: Math.max(...xs), value: x => (log ? Math.exp(at(x)) : at(x)) };
}

const trendLines = {
  id: "trendLines",
  beforeDatasetsDraw(chart, args, opts) {
    const mode = stateOf(chart).trend;
    if (!mode || mode === "off") return;
    const { ctx, chartArea: area, scales: { x, y } } = chart;
    const groups = new Map(); // key -> {colour, points}
    chart.data.datasets.forEach((ds, i) => {
      if (chart.getDatasetMeta(i).hidden) return;
      for (const p of ds.data) {
        if (isHidden(chart, p) || p.lowerBound || (opts.log && p.y <= 0)) continue;
        const key = mode === "company" ? `org:${p.company}` : mode === "series" ? `series:${i}` : "all";
        const colour = mode === "company" ? companyColour(p.company) : mode === "series" ? ds.lineColour : opts.colour;
        if (!groups.has(key)) groups.set(key, { colour, points: [] });
        groups.get(key).points.push(p);
      }
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.width, area.height);
    ctx.clip();
    for (const [key, { colour, points: pts }] of groups) {
      if (pts.length < 2) continue;
      const f = fit(pts, opts.log);
      if (!(f.to - f.from >= 0.05) || !isFinite(f.slope)) continue;
      const x1 = x.getPixelForValue(f.from), y1 = y.getPixelForValue(f.value(f.from));
      const x2 = x.getPixelForValue(f.to), y2 = y.getPixelForValue(f.value(f.to));
      if (opts.sketch && window.rough) {
        rough.canvas(chart.canvas).line(x1, y1, x2, y2, { stroke: colour, strokeWidth: 2, strokeLineDash: [8, 5], roughness: 1, seed: 3 });
      } else {
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      if (key === "all") {
        const text = opts.log
          ? (f.slope > 0 ? `doubles every ${Math.round((12 * Math.LN2) / f.slope)} months` : "no growth")
          : `${f.slope >= 0 ? "+" : ""}${formatValue(f.slope, opts.yFormat)} per year`;
        ctx.font = `italic ${opts.size}px ${opts.font}`;
        ctx.fillStyle = opts.colour;
        ctx.textAlign = "right";
        ctx.fillText(`Fit to shown points: ${text}`, area.right - 4, area.top + opts.size);
      }
    }
    ctx.restore();
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
      ctx.lineWidth = 1.5;
      meta.data.forEach((e, j) => {
        const p = ds.data[j];
        if (p.lo == null || p.hi == null || isHidden(chart, p)) return;
        const top = y.getPixelForValue(p.hi), bottom = y.getPixelForValue(p.lo);
        ctx.strokeStyle = ds.markColour(p);
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
    chart._textBoxes = [];
    if (!opts.links || !opts.links.length) return;
    const { ctx } = chart;
    const find = label => {
      for (const [i, ds] of chart.data.datasets.entries()) {
        const j = ds.data.findIndex(p => p.label === label);
        if (j >= 0 && !chart.getDatasetMeta(i).hidden && !isHidden(chart, ds.data[j])) return chart.getDatasetMeta(i).data[j];
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
        ctx.font = `italic ${opts.size}px ${opts.font}`;
        ctx.textAlign = "center";
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 16, w = ctx.measureText(link.label).width;
        ctx.fillText(link.label, mx, my);
        chart._textBoxes.push({ x: mx - w / 2, y: my - opts.size, w, h: opts.size + 3 });
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
      let path = meta.data.map(e => [e.x, e.y]);
      if (ds.stepped) path = path.flatMap((pt, j) => (j ? [[pt[0], path[j - 1][1]], pt] : [pt]));
      // Steps stay close to straight so each level reads at its true height.
      const wobble = ds.stepped ? { roughness: 0.8, bowing: 0.3 } : { roughness: 1.4, bowing: 2 };
      if (ds.showLine && path.length > 1) rc.linearPath(path, { stroke: ds.lineColour, strokeWidth: 1.5, seed: 7, ...wobble });
      meta.data.forEach((e, j) => {
        const p = ds.data[j];
        if (isHidden(chart, p)) return;
        const stroke = ds.markColour(p);
        rc.circle(e.x, e.y, 13, { stroke, fill: stroke, fillStyle: "hachure", hachureGap: 2.5, roughness: 1.2, seed: 11 + j });
      });
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

function tooltip(spec, byCompany) {
  return {
    filter: item => !item.raw.ghost && !(item.raw.company && item.chart.canvas._state.hiddenOrgs.has(item.raw.company)),
    callbacks: {
      title: items => {
        const r = items[0].raw;
        return byCompany && r.company !== "other" ? `${r.label} (${companyName(r.company)})` : r.label || "";
      },
      label: item => {
        const r = item.raw;
        const v = r.value ?? r.y;
        const shown = spec.yCategories ? [spec.yCategories[v]].flat().join(" ") : formatValue(v, spec.yFormat);
        let s = `${formatMonth(r.date)}: ${shown}`;
        if (r.lo != null && r.hi != null) s += ` (95% CI ${formatValue(r.lo, spec.yFormat)}–${formatValue(r.hi, spec.yFormat)})`;
        if (r.lowerBound) s += " (lower bound)";
        if (r.verified === false) s += " (unverified)";
        return s;
      },
      afterLabel: item => item.raw.note || "",
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

// Charts whose points name real models are coloured by company; anonymised ones by series.
function usesCompanies(spec) {
  return spec.kind === "line" && spec.series.some(s => s.org || s.points.some(p => companyOf(p)));
}

// Splits a long axis title into two balanced lines when it would not fit along the axis.
function wrapTitle(text, room, fontSize) {
  if (!text || text.length * fontSize * 0.55 <= room) return text;
  const words = text.split(" ");
  let best = [text], bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    if (Math.max(a.length, b.length) < bestLen) { best = [a, b]; bestLen = Math.max(a.length, b.length); }
  }
  return best;
}

// Axis ends: whole months for short spans, whole years otherwise.
const xMinOf = (xs, short) => (short ? Math.floor(Math.min(...xs) * 12) / 12 : Math.floor(Math.min(...xs)));
const xMaxOf = (xs, short) => (short ? Math.ceil((Math.max(...xs) + 0.01) * 12) / 12 : Math.ceil(Math.max(...xs) + 0.01));

function lineConfig(spec, colours, large, state, halo, height, width) {
  const isSketch = spec.style === "sketch";
  const byCompany = usesCompanies(spec);
  const radius = large ? 5 : 4;
  // Tiered charts nudge each series slightly up or down so lines on the same tier stay visible.
  const nudge = i => (spec.yCategories && spec.series.length > 1 ? (i - (spec.series.length - 1) / 2) * 0.07 : 0);
  const datasets = spec.series.map((s, i) => {
    const colour = colours[i % colours.length];
    const markColour = p => (byCompany ? companyColour(p.company) : colour);
    // A series that belongs to one company (s.org) is drawn entirely in that company's colour.
    const lineColour = s.org ? companyColour(s.org) : byCompany ? token("--muted") : colour;
    const shape = byCompany && !s.org ? SERIES_SHAPES[i % SERIES_SHAPES.length] : "circle";
    const hidden = ctx => ctx.raw && (ctx.raw.ghost || (ctx.raw.company && state.hiddenOrgs.has(ctx.raw.company)));
    const data = s.points.map(p => {
      const org = p.org || s.org;
      return { ...p, org, value: p.y, y: p.y + nudge(i), date: p.x, x: monthToYear(p.x), company: byCompany ? companyOf({ ...p, org }) || "other" : null };
    });
    // spec.extendTo carries each series' last state on to that date (an unmarked "ghost" point).
    const last = data[data.length - 1];
    if (spec.extendTo && last && monthToYear(spec.extendTo) > last.x) {
      data.push({ ...last, label: undefined, note: undefined, ghost: true, date: spec.extendTo, x: monthToYear(spec.extendTo) });
    }
    return {
      label: s.label,
      org: s.org,
      data,
      hidden: state.hiddenSeries.has(i),
      markColour,
      lineColour,
      shape,
      borderColor: isSketch ? "transparent" : lineColour,
      backgroundColor: colour,
      // Hollow markers: unverified values. Sketch charts draw their own marks.
      pointBackgroundColor: ctx => (isSketch || !ctx.raw || ctx.raw.verified === false ? "transparent" : markColour(ctx.raw)),
      pointBorderColor: ctx => (isSketch || !ctx.raw ? "transparent" : markColour(ctx.raw)),
      pointBorderWidth: 2,
      pointStyle: ctx => (ctx.raw && ctx.raw.lowerBound ? "triangle" : shape),
      pointRadius: ctx => (hidden(ctx) ? 0 : radius),
      pointHitRadius: ctx => (hidden(ctx) ? 0 : 6),
      pointHoverRadius: ctx => (hidden(ctx) ? 0 : radius + 2),
      showLine: spec.connect !== false,
      stepped: spec.stepped ? "after" : false,
      borderWidth: 1.5,
      tension: 0,
    };
  });
  const xs = datasets.flatMap(d => d.data.map(p => p.x));
  const ys = datasets.flatMap(d => d.data.flatMap(p => [p.y, p.lo, p.hi].filter(v => v != null)));
  let { yMin, yMax } = spec;
  if (spec.yCategories) [yMin, yMax] = [-0.5, spec.yCategories.length - 0.5];
  if (spec.yScale === "log") {
    // Snap the range to the surrounding ticks so edge points are not clipped.
    const candidates = spec.yFormat === "duration" ? DURATION_TICKS : DECADE_TICKS;
    yMin ??= [...candidates].reverse().find(v => v <= Math.min(...ys) * 0.8);
    yMax ??= candidates.find(v => v >= Math.max(...ys) * 1.25);
  }
  const font = isSketch ? SKETCH_FONT : Chart.defaults.font.family;
  // Sketch fonts run small, so they get a size bump to read like the regular ones.
  const size = n => (isSketch ? n + 3 : n);
  const tickFont = { family: font, size: size(12) };
  const titleFont = { family: font, size: size(13), weight: "600" };
  // Spans under ~1.5 years get month ticks (every month up to ~8 months, else quarterly); longer spans get year ticks.
  const span = Math.max(...xs) - Math.min(...xs);
  const short = span < 1.5;
  const months = Math.round((xMaxOf(xs, short) - xMinOf(xs, short)) * 12);
  const maxTicks = Math.max(3, Math.floor((width - 80) / 62));
  const monthStep = ([1, 2, 3, 6].find(n => months / n <= maxTicks) || 12) / 12;
  const xMin = xMinOf(xs, short), xMax = xMaxOf(xs, short);
  // The first tick and the first tick of each new year carry the year.
  const monthTick = (v, i) => {
    const y = Math.floor(v + 1e-6), m = Math.round((v - y) * 12) % 12;
    return i === 0 || m < monthStep * 12 ? `${MONTH_NAMES[m]} ${y}` : MONTH_NAMES[m];
  };
  const text = token("--text"), muted = token("--muted");
  return {
    byCompany,
    config: {
      type: "line",
      data: { datasets },
      plugins: [trendLines, referenceLines, errorBars, links, sketch, pointLabels],
      options: {
        layout: { padding: { top: 14, right: 16 } },
        font: { family: font },
        scales: {
          x: {
            type: "linear",
            min: xMin,
            max: xMax,
            title: { display: true, text: spec.xLabel || "Model release date", font: titleFont, color: text },
            grid: { display: !isSketch },
            ticks: short
              ? { stepSize: monthStep, autoSkip: false, maxRotation: 0, font: tickFont, color: muted, callback: monthTick }
              : { stepSize: 1, maxRotation: 0, font: tickFont, color: muted, callback: v => (Number.isInteger(v) ? v : "") },
          },
          y: {
            type: spec.yScale === "log" ? "logarithmic" : "linear",
            min: yMin,
            max: yMax,
            title: { display: !!spec.yLabel, text: wrapTitle(spec.yLabel, height - 60, titleFont.size), font: titleFont, color: text },
            grid: { display: !isSketch },
            afterBuildTicks: spec.yScale === "log"
              ? logTicks(spec)
              : spec.yCategories ? axis => { axis.ticks = spec.yCategories.map((c, value) => ({ value })); } : undefined,
            ticks: spec.yCategories
              ? { stepSize: 1, font: tickFont, color: text, callback: v => (Number.isInteger(v) ? spec.yCategories[v] : "") }
              : { font: tickFont, color: muted, precision: spec.yFormat === "integer" ? 0 : undefined, callback: v => formatValue(v, spec.yFormat) },
          },
        },
        plugins: {
          tooltip: tooltip(spec, byCompany),
          sketch: { enabled: isSketch },
          trendLines: { colour: text, font, size: size(11), log: spec.yScale === "log", yFormat: spec.yFormat, sketch: isSketch },
          referenceLines: { lines: spec.references, colour: muted, font, size: size(11) },
          links: { links: spec.links, colour: muted, font, size: size(11) },
          pointLabels: { colour: text, halo, font, size: size(large ? 12 : 11), markerRadius: isSketch ? 8 : radius + 2 },
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
        [spec.horizontal ? "y" : "x"]: { ticks: { autoSkip: false, font: { size: 12 } } },
        [spec.horizontal ? "x" : "y"]: {
          min: spec.yMin ?? 0,
          max: spec.yMax,
          title: { display: !!spec.yLabel, text: spec.yLabel },
          ticks: { callback: v => formatValue(v, spec.yFormat) },
        },
      },
      plugins: { tooltip: tooltip(spec, false) },
    },
  };
}

// Legend chips (click to hide or show a company or series) plus label and trend toggles.
function controls(entry, chart, byCompany, colours) {
  const { spec, state } = entry;
  const update = () => chart.update("none");
  const chip = (swatch, name, pressed, onToggle) => {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(pressed) }, swatch, name);
    b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", String(onToggle()));
      update();
    });
    return b;
  };
  const parts = [];

  if (byCompany) {
    const present = new Set(chart.data.datasets.flatMap(ds => ds.data.map(p => p.company)));
    parts.push(el("div", { class: "chips", role: "group", "aria-label": "Companies" },
      COMPANIES.filter(c => present.has(c.id)).map(c =>
        chip(el("span", { class: "swatch", style: `background:${companyColour(c.id)}` }), c.name, !state.hiddenOrgs.has(c.id), () => {
          state.hiddenOrgs.has(c.id) ? state.hiddenOrgs.delete(c.id) : state.hiddenOrgs.add(c.id);
          const show = !state.hiddenOrgs.has(c.id);
          // Series that belong to this company (lines included) hide with it.
          chart.data.datasets.forEach((ds, i) => { if (ds.org === c.id) chart.setDatasetVisibility(i, show); });
          return show;
        }))));
  }
  // When every series is one company, the company chips already act as the series legend.
  if (spec.series.length > 1 && !spec.series.every(s => s.org)) {
    parts.push(el("div", { class: "chips", role: "group", "aria-label": "Series" },
      chart.data.datasets.map((ds, i) => {
        const swatch = byCompany
          ? el("span", { class: "shape", "aria-hidden": "true" }, SHAPE_GLYPHS[ds.shape])
          : el("span", { class: "swatch", style: `background:${colours[i % colours.length]}` });
        return chip(swatch, ds.label, !state.hiddenSeries.has(i), () => {
          const show = state.hiddenSeries.has(i);
          show ? state.hiddenSeries.delete(i) : state.hiddenSeries.add(i);
          chart.setDatasetVisibility(i, show);
          return show;
        });
      })));
  }
  if (spec.pointLabels !== false && spec.series.some(s => s.points.some(p => p.label))) {
    const box = el("input", { type: "checkbox", checked: state.labels });
    box.addEventListener("change", () => { state.labels = box.checked; update(); });
    parts.push(el("label", {}, box, "Labels"));
  }
  if (spec.kind === "line" && spec.trend !== false) {
    const options = [
      ["off", "None"],
      ["all", "All shown"],
      ...(byCompany ? [["company", "By company"]] : []),
      ...(spec.series.length > 1 ? [["series", "By series"]] : []),
    ];
    const select = el("select", {}, options.map(([v, t]) => el("option", { value: v, selected: state.trend === v }, t)));
    select.addEventListener("change", () => { state.trend = select.value; update(); });
    parts.push(el("label", { title: "Least-squares fit over the visible points (lower bounds excluded; needs 2 or more points per line)" }, "Trend line:", select));
  }
  return parts.length ? el("div", { class: "chart-controls" }, parts) : null;
}

// The first opaque background behind an element (charts sit on the page or on a table cell).
function backgroundOf(node) {
  for (let n = node; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return token("--bg");
}

function draw(entry) {
  const { container, spec, opts, state } = entry;
  if (container._chart) container._chart.destroy();
  container._controls?.remove();
  container._controls = null;
  if (!spec || spec.kind === "placeholder") return placeholder(container, spec || {});

  const colours = [token("--chart-1"), token("--chart-2"), token("--chart-3"), token("--chart-4")];
  Chart.defaults.color = token("--muted");
  Chart.defaults.borderColor = token("--chart-grid");
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;

  let cfg, byCompany = false;
  if (spec.kind === "bar") cfg = barConfig(spec, colours);
  else ({ config: cfg, byCompany } = lineConfig(spec, colours, opts.large, state, backgroundOf(container), container.clientHeight, container.clientWidth));
  cfg.options.responsive = true;
  cfg.options.maintainAspectRatio = false;
  cfg.options.animation = false;
  // The HTML controls below the chart act as its legend.
  cfg.options.plugins.legend = { display: false };

  if (spec.kind === "bar" && spec.horizontal) {
    // Give each bar enough room for its label.
    const n = spec.series[0].points.length;
    container.style.height = `${Math.max(230, n * (opts.large ? 26 : 17) + 50)}px`;
  }

  const canvas = el("canvas", { role: "img", "aria-label": spec.title || "Chart" });
  canvas._state = state;
  container.replaceChildren(canvas);
  container._chart = new Chart(canvas, cfg);
  container._controls = controls(entry, container._chart, byCompany, colours);
  if (container._controls) container.after(container._controls);
}

export function renderChart(container, spec, opts = {}) {
  const state = {
    // Small tiered charts have no room for event labels; the tooltip still shows them.
    labels: !!spec && spec.pointLabels !== false && !(spec.yCategories && !opts.large),
    trend: "off",
    hiddenOrgs: new Set(),
    hiddenSeries: new Set(),
  };
  draw({ container, spec, opts, state });
}

