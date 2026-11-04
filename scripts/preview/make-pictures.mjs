#!/usr/bin/env node
// Draws the pictures of the documentation: the overview illustration (scripts/preview/preview.svg, rendered to
// preview.png and docs/assets/preview.png) and one picture per feature (docs/assets/features/*.svg).
// Author-only tool, like render.sh: nothing in CI or in the mod needs it.
//
//   node scripts/preview/make-pictures.mjs             write the SVG files, then render the PNG with render.sh
//   node scripts/preview/make-pictures.mjs --svg-only  write only the SVG files
//
// Drawn from the real parts, not captured. Everything shown is made up (spaces api, web, docs, infra; invented
// session titles and times). What is exact and what is approximated:
//   exact   - what the dialog lists and in which order, the title, status words, wait times, the one-line
//             previews, the "earlier" fold, the search filter and the three sorts: they come from the mod's own
//             mods/attention-picker/logic.js (buildRows, headline, duration, WORD) and ask.js (askOf), run here on
//             made-up agents and screen text;
//           - the dialog's geometry: width 640 (mod.json), padding 18, gap 10, row heights from `const H` in
//             main.js (read from the file), list height LIST_H, row margins and paddings, font sizes, radii, the
//             search box (36px, radius 9, accent border) and the sort control, as main.js draws them;
//           - the space tile colors: logic.js MARK through resolveSpaceColor, the letter ink through inkOn;
//           - the icons: the mod's own search.svg and spinner.svg, and Herdr's shipped program icons
//             (scripts/preview/icons/, copied unchanged from Herdr's icons folder; licenses there and in NOTICE).
//   approximated
//           - the graphite theme colors (built into Herdr, they cannot be exported): T below starts from the
//             palette the portrait layout's preview uses and names every theme color main.js asks for;
//           - text widths (estimated per character, used to truncate and right-align) and the UI font (Geist,
//             then common system fonts; Herdr uses its own);
//           - the dialog's frame (Herdr draws the overlay: radius, border and shadow here are guesses) and its
//             place on the window;
//           - the window behind it (bar strip, space columns, tabs, panes, status line): drawn after the
//             portrait layout's look, dimmed behind the dialog, not from a layout file of this repository.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRows, headline, duration, WORD, ORDER, MARK, resolveSpaceColor, inkOn, isPick } from "../../mods/attention-picker/logic.js";
import { askOf } from "../../mods/attention-picker/ask.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const MOD = join(root, "mods", "attention-picker");

// ---- numbers from the mod's own files
const mainJs = readFileSync(join(MOD, "main.js"), "utf8");
const H = Function(`return (${/const H = (\{[^}]*\})/.exec(mainJs)[1]})`)();
const LIST_H = Number(/const LIST_H = (\d+)/.exec(mainJs)[1]);
const WIDTH = JSON.parse(readFileSync(join(MOD, "mod.json"), "utf8")).overlay.width;
const SORT_LABEL = Function(`return (${/const SORT_LABEL = (\{[^}]*\})/.exec(mainJs)[1]})`)();
const SORT_TIP = Function(`return (${/const SORT_TIP = (\{[^}]*\})/.exec(mainJs)[1]})`)();
const HINT = /const hint = this\.search \? "([^"]+)"/.exec(mainJs)[1];
const PLACEHOLDER = /placeholder: "([^"]+)"/.exec(mainJs)[1];

// ---- theme: the colors main.js asks theme() for, graphite approximated
const T = {
  popover: "#1b1e24", raised: "#262a32", hover: "#232730", border: "#2a2e36", background: "#0f1115",
  foreground: "#d9dde4", muted: "#8e95a1", dim: "#5d6470", accent: "#a7b4c6",
  working: "#e2b765", blocked: "#e8737d", done: "#78c28b", idle: "#6a7280",
  chrome: "#1a1d23", canvas: "#13151a",
};
const UI = "Geist, Inter, 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
const MONO = "'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

// ---- drawing helpers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Spaces that matter (runs, leading ones) as no-break spaces: not every renderer honours xml:space in an <img>.
const keep = (s) => (/^ | {2}/.test(s) ? String(s).replace(/ /g, "\u00a0") : s);
const n = (v) => +Number(v).toFixed(2);
const text = (x, y, s, { size = 13, fill = T.foreground, weight = 400, anchor = "start", font, extra = "" } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${size}"${weight !== 400 ? ` font-weight="${weight}"` : ""} fill="${fill}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${font ? ` font-family="${font}"` : ""}${extra}>${esc(keep(s))}</text>`;
const rect = (x, y, w, h, fill, { r = 0, stroke, sw = 1, extra = "" } = {}) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${r}"` : ""} fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}${extra}/>`;

// Estimated advance widths for a Geist-like sans (em fractions). Good enough to truncate and right-align.
function width(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    if (" iljI.,:;|!'·".includes(ch)) w += 0.28;
    else if ("ft()[]/-r".includes(ch)) w += 0.36;
    else if ("mwMW".includes(ch)) w += 0.82;
    else if (/[A-Z]/.test(ch)) w += 0.64;
    else if (/[0-9]/.test(ch)) w += 0.56;
    else if ("↑↓–…▾▴".includes(ch)) w += 0.6;
    else w += 0.53;
  }
  return w * size;
}
function truncate(s, size, max) {
  if (width(s, size) <= max) return s;
  let out = String(s);
  while (out.length && width(out + "…", size) > max) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

// Icons: the mod's own and Herdr's program icons, inlined (no <image>, no href).
const iconFile = (f) => readFileSync(f, "utf8");
const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "").trim();
// The root's presentation attributes (fill, stroke, stroke-width, ...) move to the group that replaces it.
const rootAttrs = (svg) => [.../<svg([^>]*)>/.exec(svg)[1].matchAll(/\b(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="([^"]*)"/g)]
  .map((m) => ` ${m[1]}="${m[2]}"`).join("");
const modSvg = (f) => { const s = iconFile(join(MOD, f)); return { attrs: rootAttrs(s), body: inner(s) }; };
const MOD_ICON = { search: modSvg("search.svg"), spinner: modSvg("spinner.svg") };
const PROGRAM = {};
let gradientSeq = 0;
for (const p of ["claude", "codex", "gemini", "nvim", "git", "shell"]) PROGRAM[p] = inner(iconFile(join(here, "icons", `${p}.svg`)));
// Lucide strokes (shell) take currentColor; Simple Icons paths (gemini, nvim, git) have no fill and are tinted
// like Herdr tints them; Claude and Codex keep their own colors.
function programIcon(p, x, y, size, color) {
  let body = PROGRAM[p];
  if (p === "codex") { const id = `cx${++gradientSeq}`; body = body.replaceAll("lobe-icons-codex-_R_0_", id); }
  const k = size / 24;
  const tint = p === "shell" ? ` stroke="${color}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` : ["claude", "codex"].includes(p) ? "" : ` fill="${color}"`;
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k)})"${tint}>${body}</g>`;
}
function modIcon(name, x, y, size, color) {
  const k = size / 24;
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k)})" color="${color}"${MOD_ICON[name].attrs}>${MOD_ICON[name].body}</g>`;
}

// ---- the made-up world
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const MIN = 60_000;
const SPACES = [
  { id: "s-api", name: "api", color: "ansi6" },
  { id: "s-web", name: "web", color: "ansi3" },
  { id: "s-docs", name: "docs", color: "ansi4" },
  { id: "s-infra", name: "infra", color: "ansi5" },
];
const sp = Object.fromEntries(SPACES.map((s) => [s.name, s]));
// What each waiting agent's screen ends with; the preview is what ask.js finds in it.
const SCREENS = {
  "api:review:1": "● I added a token bucket in src/limits.ts and the tests pass.\n\n● Should I also document the new 429 response in the OpenAPI schema? (y/n)\n\n❯ ",
  "docs:notes:1": "● Reading CHANGELOG.md\n● Drafted the entries for 0.4.0 under Unreleased: two fixes and the new export flag.\n\n❯ ",
};
// In space-tree order (agents() order), which the "Space order" sort keeps.
const AGENTS = [
  { address: "api:main:2", status: "idle", program: "codex", title: "migration check", space: "api", tab: "main", ago: 20 * MIN, seq: 11 },
  { address: "api:main:1", status: "working", program: "claude", title: "pagination for /items", space: "api", tab: "main", ago: 2 * MIN, seq: 14, focused: true },
  { address: "api:review:1", status: "blocked", program: "codex", title: "rate limit review", space: "api", tab: "review", ago: 6 * MIN, seq: 12 },
  { address: "web:ui:1", status: "idle", program: "gemini", title: "storybook upgrade", space: "web", tab: "ui", ago: 3 * 60 * MIN, seq: 7 },
  { address: "docs:notes:1", status: "done", program: "gemini", title: "changelog draft", space: "docs", tab: "notes", ago: 25 * MIN, seq: 13 },
  { address: "docs:notes:2", status: "idle", program: "codex", title: "reference pages", space: "docs", tab: "notes", ago: 2 * 24 * 60 * MIN, seq: 3 },
  { address: "infra:ops:1", status: "idle", program: "claude", title: "dns records", space: "infra", tab: "ops", ago: 26 * 60 * MIN, seq: 4 },
];
const agents = AGENTS.map((a) => ({
  address: a.address, status: a.status, seq: a.seq, focused: !!a.focused, title: a.title, program: { name: a.program },
  space: sp[a.space].id, space_name: a.space, tab: `${a.space}:${a.tab}`, tab_name: a.tab,
}));
const spaces = SPACES.map((s) => ({ id: s.id, name: s.name, tabs: [] }));
const since = Object.fromEntries(AGENTS.map((a) => [a.address, NOW - a.ago]));
const colors = Object.fromEntries(SPACES.map((s) => [s.id, s.color]));
const previews = new Map(agents.filter((a) => SCREENS[a.address]).map((a) => [a.address, askOf(SCREENS[a.address], a.status)]));
const rowsFor = ({ query = "", sort = "recent", showEarlier = false } = {}) =>
  buildRows({ agents, spaces, sharedSince: since, seen: {}, query, sort, showEarlier, now: NOW });

// ---- the dialog, as main.js render() lays it out
// Returns { svg, height, tops } with the dialog's top-left at (x, y). `rows` from buildRows.
function dialog(x, y, { rows, query = "", sort = "recent", search = true, tooltip = false, frame = true }) {
  const P = 18, GAP = 10, W = WIDTH;
  const title = headline({ agents });
  const picks = rows.filter(isPick);
  const sel = picks[0]; // nothing selected yet: the first pick is
  const tops = [];
  let total = 0;
  for (const r of rows) { tops.push(total); total += H[r.kind]; }
  const listH = Math.min(LIST_H, total);
  const height = P + 22 + GAP + (search ? 36 + GAP : 0) + listH + 6 + P;
  let o = "";
  if (frame) o += rect(x, y, W, height, T.popover, { r: 12, stroke: T.border, extra: ` filter="url(#sh)"` });
  // header: title, sort control, key hint
  const hy = y + P, mid = hy + 11, right = x + W - P;
  o += text(x + P, mid + 5, title, { size: 15, weight: 600 });
  o += text(right, mid + 4, HINT, { size: 11, fill: T.dim, anchor: "end" });
  const hintW = width(HINT, 11);
  const label = SORT_LABEL[sort];
  const pillW = 8 + width("Sort", 11.5) + 4 + width(label, 11.5) + 8;
  const px = right - hintW - 10 - pillW;
  o += rect(px, hy, pillW, 22, tooltip ? T.hover : T.raised, { r: 6 });
  o += text(px + 8, mid + 4, "Sort", { size: 11.5, fill: T.dim });
  o += text(px + 8 + width("Sort", 11.5) + 4, mid + 4, label, { size: 11.5, fill: tooltip ? T.foreground : T.muted });
  let cy = hy + 22 + GAP;
  if (search) {
    o += rect(x + P + 0.5, cy + 0.5, W - 2 * P - 1, 35, T.background, { r: 9, stroke: T.accent });
    o += modIcon("search", x + P + 10, cy + 10.5, 15, T.dim);
    const tx = x + P + 10 + 15 + 8;
    if (query) {
      o += text(tx, cy + 22.5, query, { size: 12.8 });
      o += rect(tx + width(query, 12.8) + 1, cy + 10, 1.2, 16, T.foreground);
    } else {
      o += rect(tx, cy + 10, 1.2, 16, T.foreground);
      o += text(tx + 3, cy + 22.5, PLACEHOLDER, { size: 12.8, fill: T.dim });
    }
    cy += 36 + GAP;
  }
  // the list, clipped at LIST_H like the mod's fixed strip
  const lx = x + P, lw = W - 2 * P;
  const clip = `cl${++gradientSeq}`;
  o += `<clipPath id="${clip}"><rect x="${lx}" y="${cy}" width="${lw}" height="${listH}"/></clipPath><g clip-path="url(#${clip})">`;
  rows.forEach((r, i) => { o += row(r, lx, cy + tops[i], lw, r === sel, search); });
  o += "</g>";
  if (tooltip) {
    const tip = `${SORT_TIP[sort]} · click or Tab for ${SORT_LABEL[nextOf(sort)]}`;
    const tw = width(tip, 12) + 20;
    const tx = Math.min(px, x + W - tw - 8);
    o += rect(tx, hy + 28, tw, 26, T.raised, { r: 6, stroke: T.border, extra: ` filter="url(#sh)"` });
    o += text(tx + 10, hy + 45, tip, { size: 12, fill: T.foreground });
  }
  return { svg: o, height, listTop: cy - y, tops, listH };
}
const nextOf = (s) => ({ recent: "oldest", oldest: "space", space: "recent" })[s];

function glyph(status, x, cy) {
  if (status === "working") return modIcon("spinner", x, cy - 6, 12, T.working);
  if (status in ORDER) return `<circle cx="${n(x + 6)}" cy="${n(cy)}" r="3.8" fill="${T[status] ?? T.dim}"/>`;
  return `<circle cx="${n(x + 6)}" cy="${n(cy)}" r="3.4" fill="none" stroke="${T[status] ?? T.dim}" stroke-width="1.2"/>`;
}

function row(r, x, y, w, on, search) {
  if (r.kind === "sep") return rect(x + 10, y + 8, w - 20, 1, T.border);
  if (r.kind === "head") {
    const tile = resolveSpaceColor({ raw: colors[r.s.id], theme: T, dim: T.dim, isHome: r.s.name === "~" });
    return rect(x + 10, y + 8, 18, 18, tile, { r: 5 })
      + text(x + 19, y + 21, [...r.s.name][0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(tile), anchor: "middle" })
      + text(x + 36, y + 21, r.s.name, { size: 11, weight: 600, fill: T.dim });
  }
  if (r.kind === "earlier") {
    let o = on ? rect(x + 4, y + 6, w - 8, H.earlier - 6, T.hover, { r: 7 }) : "";
    o += rect(x + 4 + 7, y + 6, w - 8 - 14, 1, T.border);
    o += text(x + 14, y + 6 + (H.earlier - 6) / 2 + 4, `earlier: ${r.count} agent${r.count > 1 ? "s" : ""} idle for over a day ${r.open ? "▴" : "▾"}`, { size: 12, fill: on ? T.foreground : T.dim });
    return o;
  }
  let o = on ? rect(x + 4, y, w - 8, H[r.kind], T.hover, { r: 7 }) : "";
  const left = x + 14, right = x + w - 14;
  const waiting = r.kind === "waiting";
  const lineMid = waiting ? y + (H.waiting - 35) / 2 + 10 : y + H.agent / 2;
  o += glyph(r.a.status, left, lineMid);
  // right side, right to left: sub (max 200), then the word and the time
  const sub = truncate(r.sub, 11, 200);
  const subW = width(sub, 11);
  o += text(right, lineMid + 4, sub, { size: 11, fill: T.dim, anchor: "end" });
  const word = WORD[r.a.status] ?? (r.a.status === "idle" ? "idle" : null);
  const ago = r.since ? duration(NOW - r.since) : null;
  let gx = right - subW - 10;
  const groupStart = gx - (ago ? width(ago, 11) : 0) - (word && ago ? 5 : 0) - (word ? width(word, 11) : 0);
  if (ago) { o += text(gx, lineMid + 4, ago, { size: 11, fill: T.dim, anchor: "end" }); gx -= width(ago, 11) + 5; }
  if (word) o += text(gx, lineMid + 4, word, { size: 11, fill: r.a.status in WORD ? T[r.a.status] : T.dim, anchor: "end" });
  const nameX = left + 12 + 10;
  o += text(nameX, lineMid + 4.5, truncate(r.name, 13, groupStart - 10 - nameX), { size: 13 });
  if (waiting) {
    const said = previews.get(r.a.address) ?? "…";
    const px = left + (search ? 22 : 42);
    o += text(px, lineMid + 10 + 7.5 + 4, truncate(said, 11.5, right - px), { size: 11.5, fill: T.muted });
  }
  return o;
}

// ---- the Herdr window behind the dialog (after the portrait layout's look)
const BAR_STRIP = 26, COLS = 150, TABS = 32, STATUS = 24;
function stateGlyph(x, cy, status) {
  if (status === "working") return modIcon("spinner", x, cy - 6, 12, T.working);
  if (status === "blocked") return rect(x - 1, cy - 7, 14, 14, T.blocked + "40", { r: 4 }) + text(x + 6, cy + 3.5, "!", { size: 10.5, fill: T.blocked, weight: 700, anchor: "middle" });
  if (status === "done") return `<circle cx="${x + 6}" cy="${cy}" r="3.5" fill="${T.done}"/>`;
  return `<circle cx="${x + 6}" cy="${cy}" r="3" fill="none" stroke="${T.idle}" stroke-width="1.4"/>`;
}
const TREE = [
  { space: "api", tabs: [
    { tab: "main", panes: [{ p: "claude", label: "pagination for /items", status: "working", age: "2m", focused: true }, { p: "codex", label: "migration check", status: "idle", age: "20m" }] },
    { tab: "review", panes: [{ p: "codex", label: "rate limit review", status: "blocked", age: "6m" }] },
  ] },
  { space: "web", tabs: [
    { tab: "ui", panes: [{ p: "gemini", label: "storybook upgrade", status: "idle", age: "3h" }, { p: "nvim", label: "Neovim  ~/code/web" }] },
    { tab: "shell", panes: [{ p: "shell", label: "zsh  ~/code/web" }] },
  ] },
  { space: "docs", tabs: [
    { tab: "notes", panes: [{ p: "gemini", label: "changelog draft", status: "done", age: "25m" }, { p: "codex", label: "reference pages", status: "idle", age: "2d" }] },
    { tab: "git", panes: [{ p: "git", label: "Git Changes  ~/code/docs" }] },
  ] },
];
const WORD_TREE = { blocked: "needs you", done: "done", working: "working", idle: "idle" };
function column(x, y, w, h, col, active) {
  const s = sp[col.space];
  const color = MARK[s.color];
  let o = active ? rect(x, y, w, h, "#ffffff08") : "";
  o += rect(x + w - 1, y, 1, h, T.border);
  o += rect(x + 10, y + 9, 18, 18, color, { r: 5 }) + text(x + 19, y + 22, s.name[0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(color), anchor: "middle" });
  o += text(x + 36, y + 23, s.name, { size: 14, weight: 600, fill: active ? T.foreground : T.muted });
  o += `<path d="M${x + w - 22} ${y + 18}h8M${x + w - 18} ${y + 14}v8" stroke="${T.dim}" stroke-width="1.5" stroke-linecap="round"/>`;
  let ry = y + 38;
  col.tabs.forEach((t, ti) => {
    const lastTab = ti === col.tabs.length - 1;
    if (ry + 20 > y + h) return;
    o += text(x + 12, ry + 13, lastTab ? "└─" : "├─", { size: 11, fill: T.dim, font: MONO });
    o += text(x + 34, ry + 13, t.tab, { size: 11.5, weight: 500, fill: T.muted });
    ry += 20;
    t.panes.forEach((p, pi) => {
      if (ry + 20 > y + h) return;
      if (p.focused) o += rect(x + 4, ry, w - 9, 21, T.hover, { r: 5 });
      o += text(x + 12, ry + 14, (lastTab ? "   " : "│  ") + (pi === t.panes.length - 1 ? "└─" : "├─"), { size: 11, fill: T.dim, font: MONO });
      o += programIcon(p.p, x + 54, ry + 3.5, 14, T.muted);
      o += text(x + 74, ry + 14.5, truncate(p.label, 12, w - 74 - (p.status ? 110 : 12)), { size: 12, fill: p.status && p.status !== "idle" ? T.foreground : T.muted });
      if (p.status) {
        o += stateGlyph(x + w - 24, ry + 10.5, p.status);
        o += text(x + w - 32, ry + 14.5, p.age, { size: 10.5, fill: T.dim, anchor: "end" });
        o += text(x + w - 32 - width(p.age, 10.5) - 6, ry + 14.5, WORD_TREE[p.status], { size: 10.5, fill: p.status === "idle" ? T.dim : T[p.status], anchor: "end" });
      }
      ry += 21;
    });
  });
  return o;
}
function spine(x, y, w, h, name) {
  const color = MARK[sp[name].color];
  return rect(x + w - 1, y, 1, h, T.border) + rect(x + 8, y + 9, 18, 18, color, { r: 5 })
    + text(x + 17, y + 22, name[0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(color), anchor: "middle" })
    + `<g transform="translate(${x + 13} ${y + 36}) rotate(90)">${text(0, 0, name, { size: 12, weight: 500, fill: T.muted })}</g>`;
}
function pane(x, y, w, h, { title, icon, status, focus, lines }) {
  let o = rect(x + 0.5, y + 0.5, w - 1, h - 1, T.background, { r: 10, stroke: focus ? T.accent : T.border });
  o += rect(x + 1, y + 29, w - 2, 1, T.border);
  o += programIcon(icon, x + 12, y + 8, 14, T.muted) + text(x + 34, y + 19.5, title, { size: 12, weight: 500 });
  if (status) o += stateGlyph(x + w - 26, y + 15, status);
  lines.forEach((l, i) => { if (36 + (i + 1) * 18 < h) o += text(x + 14, y + 50 + i * 18, l.t, { size: 12, font: MONO, fill: l.c ?? T.foreground }); });
  return o;
}
function windowBehind(W, Hh) {
  let o = rect(0, 0, W, Hh, T.canvas);
  // bar strip
  o += rect(0, 0, W, BAR_STRIP + COLS, T.chrome) + rect(0, BAR_STRIP - 1, W, 1, T.border) + rect(0, BAR_STRIP + COLS - 1, W, 1, T.border);
  const btn = (bx, label) => { const bw = width(label, 11.5) + 16; return { s: rect(bx, 3, bw, 20, "none", { r: 5, stroke: T.border }) + text(bx + 8, 17, label, { size: 11.5, fill: T.muted }), w: bw }; };
  let bx = 8;
  for (const l of ["Search", "Add machine", "Settings"]) { const b = btn(bx, l); o += b.s; bx += b.w + 6; }
  let rx = W - 8;
  for (const l of ["Changes", "Files"]) { const bw = width(l, 11.5) + 16; rx -= bw; o += btn(rx, l).s; rx -= 6; }
  const chip = "1 needs you", cw = width(chip, 11.5) + 22;
  rx -= cw;
  o += rect(rx, 3, cw, 20, T.blocked + "26", { r: 5 }) + text(rx + 11, 17, chip, { size: 11.5, fill: T.blocked, weight: 600 });
  // space columns, one folded space, the add button
  const cwid = Math.floor((W - 34 - 34) / 3);
  TREE.forEach((c, i) => { o += column(i * cwid, BAR_STRIP, cwid, COLS - 1, c, i === 0); });
  o += spine(3 * cwid, BAR_STRIP, 34, COLS - 1, "infra");
  o += `<path d="M${W - 21.5} ${BAR_STRIP + 18}h9M${W - 17} ${BAR_STRIP + 13.5}v9" stroke="${T.dim}" stroke-width="1.5" stroke-linecap="round"/>`;
  // tabs
  const ty = BAR_STRIP + COLS;
  o += rect(0, ty + TABS - 1, W, 1, T.border);
  o += rect(8, ty + 5, 76, 22, T.hover, { r: 6 }) + text(20, ty + 20, "main", { size: 12, weight: 500 }) + `<path d="M66 ${ty + 12.5}l6 6m0-6l-6 6" stroke="${T.dim}" stroke-width="1.2" stroke-linecap="round"/>`;
  o += text(100, ty + 20, "review", { size: 12, fill: T.muted }) + text(156, ty + 21, "+", { size: 16, fill: T.muted });
  // panes, side by side
  const py = ty + TABS + 8, ph = Hh - py - STATUS - 8, pw = Math.floor((W - 24) * 0.58);
  o += pane(8, py, pw, ph, { title: "pagination for /items", icon: "claude", status: "working", focus: true, lines: [
    { t: "> add pagination to the /items endpoint", c: T.muted }, { t: "" },
    { t: "● Reading src/items/list.ts" }, { t: "● Editing src/items/list.ts", c: T.working },
    { t: "    + const page = Math.max(1, Number(q.page ?? 1));", c: T.done },
    { t: "    - return db.items.all();", c: T.blocked },
    { t: "    + return db.items.page({ page, size });", c: T.done }, { t: "" },
    { t: "● Running the tests…" },
  ] });
  o += pane(16 + pw, py, W - 24 - pw, ph, { title: "zsh  ~/code/api", icon: "shell", lines: [
    { t: "$ npm test", c: T.muted }, { t: "" }, { t: " PASS  src/items/list.test.ts" },
    { t: " PASS  src/limits.test.ts" }, { t: "" }, { t: "Tests: 23 passed", c: T.muted }, { t: "$ " },
  ] });
  // status line
  const sy = Hh - STATUS;
  o += rect(0, sy, W, STATUS, T.chrome) + rect(0, sy, W, 1, T.border);
  o += text(12, sy + 16, "api · main", { size: 11, fill: T.muted }) + text(W - 12, sy + 16, "7 agents · 1 needs you", { size: 11, fill: T.muted, anchor: "end" });
  return o;
}

// ---- files
const DEFS = `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000" flood-opacity="0.5"/></filter></defs>`;
const svgDoc = (w, h, title, body, desc) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${UI}" xml:space="preserve" style="white-space:pre">\n<title>${esc(title)}</title>\n<desc>${esc(desc)}</desc>\n${DEFS}\n${body}\n</svg>\n`;
const MADE_UP = "Drawn by scripts/preview/make-pictures.mjs from the mod's own code, with made-up agents. Not a screenshot.";
const out = {};

// Overview: the window, dimmed, and the dialog over it (1100x705, the size herdr.dev examples use).
{
  const W = 1100, Hh = 705;
  const rows = rowsFor();
  const d = dialog((W - WIDTH) / 2, 70, { rows });
  out["scripts/preview/preview.svg"] = svgDoc(W, Hh, "Illustration of the Agents waiting dialog with sample data",
    windowBehind(W, Hh) + rect(0, 0, W, Hh, "#000", { extra: ` opacity="0.5"` }) + d.svg, MADE_UP);
}

// A crop of the dialog: the part from `from` to `to` (dialog coordinates), with a margin of canvas around it.
function crop(name, title, { rows, query, sort, tooltip, from = 0, to, pad = 16 }) {
  const d = dialog(pad, pad - from, { rows, query, sort, tooltip });
  const end = to ?? d.height;
  const h = end - from + 2 * pad, w = WIDTH + 2 * pad;
  const fadeTop = from > 0, fadeBottom = end < d.height;
  let fades = "";
  if (fadeTop || fadeBottom) {
    fades = `<linearGradient id="fd" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0" stop-color="${T.canvas}" stop-opacity="${fadeTop ? 1 : 0}"/><stop offset="${fadeTop ? n(28 / h) : 0}" stop-color="${T.canvas}" stop-opacity="0"/>`
      + `<stop offset="${fadeBottom ? n(1 - 28 / h) : 1}" stop-color="${T.canvas}" stop-opacity="0"/><stop offset="1" stop-color="${T.canvas}" stop-opacity="${fadeBottom ? 1 : 0}"/></linearGradient>`;
    fades = `<defs>${fades}</defs>` + rect(0, 0, w, h, "url(#fd)");
  }
  out[`docs/assets/features/${name}.svg`] = svgDoc(w, h, title, rect(0, 0, w, h, T.canvas) + d.svg + fades, MADE_UP);
  return d;
}

const all = rowsFor();
const geo = dialog(0, 0, { rows: all });
const sepAt = all.findIndex((r) => r.kind === "sep");
// 1. Needs you first: the header, the search box and the agents above the rule.
crop("needs-you", "The top of the dialog: one agent that needs you and one that finished, each with its preview and wait time",
  { rows: all, to: geo.listTop + geo.tops[sepAt] + 12 });
// 2. Everyone else: from the rule down, grouped by space, and the earlier fold.
crop("everyone-else", "The lower list: every other agent grouped by space, and the earlier fold",
  { rows: all, from: geo.listTop + geo.tops[sepAt] - 8 });
// 3. Search: a typed query filters the list; the title still counts every agent.
crop("search", "The search box with a query: only the matching agents remain", { rows: rowsFor({ query: "api" }), query: "api" });
// 4. Three sorts: the lower list in each order, under the sort control that names it.
{
  const pad = 16, w = WIDTH + 2 * pad;
  let body = "", y = pad, defs = "";
  for (const sort of ["recent", "oldest", "space"]) {
    const rows = rowsFor({ sort });
    const g = dialog(0, 0, { rows, sort });
    const s = rows.findIndex((r) => r.kind === "sep");
    const e = rows.findIndex((r) => r.kind === "earlier");
    const headH = 18 + 22 + 8;
    const listFrom = g.listTop + g.tops[s] + H.sep, listTo = g.listTop + g.tops[e];
    const ph = headH + (listTo - listFrom) + 10;
    const id = `sv${sort}`;
    const d1 = dialog(pad, 0, { rows, sort, frame: false }), d2 = dialog(pad, 0, { rows, sort, frame: false });
    defs += `<clipPath id="${id}a"><rect x="${pad}" y="0" width="${WIDTH}" height="${headH}"/></clipPath><clipPath id="${id}b"><rect x="${pad}" y="${listFrom}" width="${WIDTH}" height="${listTo - listFrom}"/></clipPath>`;
    body += rect(pad, y, WIDTH, ph, T.popover, { r: 12, stroke: T.border });
    body += `<g transform="translate(0 ${y})" clip-path="url(#${id}a)">${d1.svg}</g>`;
    body += `<g transform="translate(0 ${y + headH - listFrom})" clip-path="url(#${id}b)">${d2.svg}</g>`;
    body += `<path d="M${pad + 28} ${y + headH - 3}h${WIDTH - 56}" stroke="${T.dim}" stroke-dasharray="2 5" stroke-linecap="round"/>`; // the rows left out
    y += ph + 12;
  }
  const h = y - 12 + pad;
  out["docs/assets/features/sorts.svg"] = svgDoc(w, h, "The three sorts of the lower list: Recent, Oldest and Space order",
    `<defs>${defs}</defs>` + rect(0, 0, w, h, T.canvas) + body, MADE_UP + " Each panel is the dialog's header and lower list; the rows between them are left out.");
}
// 5. Standalone: one folder and one key, as a terminal shows them.
{
  // The two lines are grep's real output on this repository's keys.json (what an install merges in).
  const keyLines = readFileSync(join(root, "keys.json"), "utf8").split("\n").filter((l) => l.includes("attention-picker"));
  const files = readdirSync(MOD).filter((f) => !["gpui-kit.d.ts", "jsconfig.json"].includes(f)).sort().join("  ");
  const lines = [
    { t: "$ ls ~/.config/herdr-app/mods/attention-picker", c: T.muted },
    { t: files },
    { t: "" },
    { t: "$ grep attention-picker ~/.config/herdr-app/keys.json", c: T.muted },
    ...keyLines.map((t) => ({ t, c: T.done })),
    { t: "" },
    { t: "$ ", c: T.foreground },
  ];
  const pad = 16, w = WIDTH + 2 * pad, ph = 50 + lines.length * 18 + 4, h = ph + 2 * pad;
  out["docs/assets/features/standalone.svg"] = svgDoc(w, h, "A terminal showing the mod's one folder and its one key in keys.json",
    rect(0, 0, w, h, T.canvas) + pane(pad, pad, WIDTH, ph, { title: "zsh  ~", icon: "shell", focus: true, lines }), MADE_UP);
}

for (const [f, s] of Object.entries(out)) {
  mkdirSync(dirname(join(root, f)), { recursive: true });
  writeFileSync(join(root, f), s);
  console.log(`wrote ${f} (${s.length} bytes)`);
}
if (!process.argv.includes("--svg-only")) {
  execFileSync("sh", [join(here, "render.sh")], { stdio: "inherit" });
  copyFileSync(join(root, "preview.png"), join(root, "docs", "assets", "preview.png"));
  console.log("copied preview.png to docs/assets/preview.png");
}
