// Shared helpers: data loading, date formatting and a tiny DOM builder.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Paths are resolved relative to the site root (one level above /js).
export async function loadJSON(path) {
  const url = new URL("../" + path, import.meta.url);
  const res = await fetch(url, { cache: "no-cache" }); // revalidate so data edits show up immediately
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

export function siteUrl(path) {
  return new URL("../" + path, import.meta.url).href;
}

// "2024-06" -> "Jun 2024"; "2024" -> "2024".
export function formatMonth(ym) {
  const [y, m] = String(ym).split("-");
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

// "2024-06" -> 2024.4167, for placing points on a linear time axis.
export function monthToYear(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return y + ((m || 1) - 1) / 12;
}

// el("a", {href: "#", class: "x"}, "text", childNode)
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function sourceLine(source) {
  if (!source) return null;
  const parts = [source.org, source.date && formatMonth(source.date)].filter(Boolean).join(", ");
  return el("span", {},
    "Source: ",
    el("a", { href: source.url, target: "_blank", rel: "noopener" }, source.title),
    parts ? ` (${parts})` : "");
}

export function showError(container, err) {
  const hint = location.protocol === "file:"
    ? " Browsers block loading JSON from file:// pages. Serve the folder instead, e.g. `python -m http.server`."
    : "";
  container.replaceChildren(el("p", { class: "error" }, String(err.message || err) + hint));
}
