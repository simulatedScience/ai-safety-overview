// Site-wide company colours for charts that label individual models.
// Hues are slots 1–7 of the validated dataviz reference palette, in its order; values live in css/style.css.

export const COMPANIES = [
  { id: "google", name: "Google DeepMind", match: /gemini|deepmind|aletheia|alphaproof|alphaevolve/i },
  { id: "anthropic", name: "Anthropic", match: /claude/i },
  { id: "openai", name: "OpenAI", match: /\b(gpt|o\d|openai|codex)/i },
  { id: "meta", name: "Meta", match: /llama/i },
  { id: "deepseek", name: "DeepSeek", match: /deepseek/i },
  { id: "alibaba", name: "Alibaba (Qwen)", match: /qwen/i },
  { id: "xai", name: "xAI", match: /grok/i },
  { id: "other", name: "Several / other" },
];

// A point's company: its explicit `org`, else the one company its label names.
// Labels naming several companies (joint results) count as "other"; unnamed models give null.
export function companyOf(point) {
  if (point.org) return point.org;
  const hits = COMPANIES.filter(c => c.match && c.match.test(point.label || ""));
  return hits.length === 1 ? hits[0].id : hits.length > 1 ? "other" : null;
}

export function companyName(id) {
  return COMPANIES.find(c => c.id === id)?.name || id;
}

export function companyColour(id) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--org-${id}`).trim();
}
