// Documentation check: links resolve, the Pages site loads nothing from elsewhere,
// the site's preview is the repo's preview.
//   node scripts/check-docs.mjs [--root <dir>]
// Checks README.md, CONTRIBUTING.md, AGENTS.md, CHANGELOG.md, RECIPE.md and docs/*.html: links and anchors;
// the numbers and constants the documents quote against main.js; the same navigation on every page;
// keyboard-reachable tables; header cells with a scope.
// Pure Node, no dependencies.
import { readFileSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { has, reporter, repoFiles, rootFromArgs } from "./lib.mjs";

const root = rootFromArgs();
const r = reporter("check-docs");
const files = repoFiles(root);
const text = (f) => readFileSync(join(root, f), "utf8");

const MD = ["README.md", "RECIPE.md", "AGENTS.md", "CONTRIBUTING.md", "CHANGELOG.md"].filter((f) => has(root, f));
const HTML = files.filter((f) => /^docs\/.+\.html$/.test(f));
const isExternal = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//");

// ---- links
function targetExists(fromFile, ref) {
  const clean = decodeURIComponent(ref.split("#")[0].split("?")[0]);
  if (!clean) return true; // "#anchor" only
  const base = posix.dirname(fromFile);
  const full = posix.normalize(clean.startsWith("/") ? clean.slice(1) : posix.join(base, clean));
  if (full.startsWith("..")) return false;
  if (files.includes(full)) return true;
  if (files.some((f) => f.startsWith(full.replace(/\/$/, "") + "/"))) return true; // a folder
  return false;
}

function anchorsOf(file) {
  const t = text(file);
  const set = new Set();
  for (const m of t.matchAll(/\bid="([^"]+)"/g)) set.add(m[1]);
  for (const m of t.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    set.add(m[1].toLowerCase().replace(/[`*_~]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-"));
  }
  return set;
}

function checkLinks(file, refs) {
  for (const ref of refs) {
    if (!ref || isExternal(ref) || ref.startsWith("mailto:")) continue;
    if (!targetExists(file, ref)) { r.fail(`${file}: broken link "${ref}"`); continue; }
    const hash = ref.split("#")[1];
    if (hash) {
      const path = ref.split("#")[0] ? posix.normalize(posix.join(posix.dirname(file), ref.split("#")[0])) : file;
      if (files.includes(path) && /\.(md|html)$/.test(path) && !anchorsOf(path).has(decodeURIComponent(hash).toLowerCase()) && !anchorsOf(path).has(decodeURIComponent(hash))) {
        r.fail(`${file}: link "${ref}" points to a heading/id that does not exist in ${path}`);
      }
    }
  }
}

for (const f of MD) {
  const t = text(f).replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const refs = [...t.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);
  checkLinks(f, refs);
}

for (const f of HTML) {
  const t = text(f);
  const refs = [];
  for (const m of t.matchAll(/\b(?:href|src|poster|data)\s*=\s*["']([^"']*)["']/gi)) refs.push(m[1]);
  checkLinks(f, refs);
  // A page may link out with <a href="https://...">, but must not LOAD anything from another origin.
  for (const m of t.matchAll(/<(link|script|img|iframe|source|video|audio|object|embed|use|image)\b[^>]*>/gi)) {
    const tag = m[0];
    const url = /\b(?:src|href|data|poster|srcset)\s*=\s*["']\s*((?:https?:)?\/\/[^"'\s,]+)/i.exec(tag);
    if (url) r.fail(`${f}: <${m[1].toLowerCase()}> loads an external origin: ${url[1]}`);
  }
  for (const m of t.matchAll(/(?:@import|url\()\s*["']?\s*((?:https?:)?\/\/[^"')\s]+)/gi)) r.fail(`${f}: CSS loads an external origin: ${m[1]}`);
  if (!/<html[^>]*\blang\s*=\s*["'][a-z-]+["']/i.test(t)) r.fail(`${f}: <html> has no lang`);
  if (!/<title>\s*\S[\s\S]*?<\/title>/i.test(t)) r.fail(`${f}: no <title>`);
  if (!/<meta[^>]+name\s*=\s*["']viewport["']/i.test(t)) r.fail(`${f}: no viewport meta`);
  if (!/<meta[^>]+charset/i.test(t)) r.fail(`${f}: no charset meta`);
  if (/<script\b/i.test(t)) r.fail(`${f}: contains a <script>; the site is plain HTML and CSS`);
  const imgs = [...t.matchAll(/<img\b[^>]*>/gi)];
  for (const i of imgs) if (!/\balt\s*=/.test(i[0])) r.fail(`${f}: <img> without alt`);
}
for (const f of files.filter((f) => /^docs\/.+\.css$/.test(f))) {
  for (const m of text(f).matchAll(/(?:@import|url\()\s*["']?\s*((?:https?:)?\/\/[^"')\s]+)/gi)) r.fail(`${f}: CSS loads an external origin: ${m[1]}`);
}

// ---- the constants and the numbers the documents quote are the ones in the code
// main.js owns the values; a document that disagrees is wrong, whatever it says.
const MAIN = "mods/attention-picker/main.js";
const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ");
const consts = {};
if (has(root, MAIN)) {
  for (const m of text(MAIN).matchAll(/^const ([A-Z][A-Z0-9_]*)\s*=\s*("[^"\n]*"|'[^'\n]*'|-?\d+(?:\.\d+)?)\s*;/gm)) {
    consts[m[1]] = /^["']/.test(m[2]) ? m[2].slice(1, -1) : Number(m[2]);
  }
  // Other _MS constants in the mod (a slower tick, say) are legal values for "every N seconds".
  for (const f of files.filter((f) => /^mods\/attention-picker\/.+\.js$/.test(f))) {
    for (const m of text(f).matchAll(/\b(?:const|export const) ([A-Z][A-Z0-9_]*_MS)\s*=\s*(\d+)/g)) consts[m[1]] = Number(m[2]);
  }
}
const CONFIG_CONSTANTS = ["HOME", "POLL_MS", "READ_LINES", "READ_CONCURRENCY", "SEEN_KEY", "HOME_SPACE_NAME", "LIST_H"];
if (has(root, "docs/configuration.html") && Object.keys(consts).length) {
  const rows = [...text("docs/configuration.html").matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => plain(m[0]));
  for (const name of CONFIG_CONSTANTS) {
    if (!(name in consts)) { r.fail(`${MAIN} has no 'const ${name} = <literal>;' (docs/configuration.html lists it)`); continue; }
    const row = rows.find((t) => new RegExp(`(^|[^A-Z_])${name}([^A-Z_]|$)`).test(t));
    if (!row) { r.fail(`docs/configuration.html: no table row for ${name}`); continue; }
    const value = String(consts[name]);
    if (!row.includes(value)) r.fail(`docs/configuration.html: the ${name} row does not show the value in ${MAIN} (${value})`);
  }
}
if ("READ_LINES" in consts && "POLL_MS" in consts && "READ_CONCURRENCY" in consts) {
  const msAllowed = new Set(Object.entries(consts).filter(([k, v]) => k.endsWith("_MS") && typeof v === "number").map(([, v]) => v));
  const quoted = ["README.md", "AGENTS.md", "llms.txt", ...HTML].filter((f) => has(root, f));
  for (const f of quoted) {
    const t = f.endsWith(".html") ? plain(text(f)) : text(f);
    const bad = (what, found, want) => r.fail(`${f}: says "${what}" but the code has ${want} (${found === undefined ? "" : "document: " + found})`.replace(/ \(\)$/, ""));
    for (const m of t.matchAll(/--lines\s+(\d+)/g)) if (Number(m[1]) !== consts.READ_LINES) bad(m[0], m[1], `READ_LINES = ${consts.READ_LINES}`);
    for (const m of t.matchAll(/\b(\d+) lines of history/g)) if (Number(m[1]) !== consts.READ_LINES) bad(m[0], m[1], `READ_LINES = ${consts.READ_LINES}`);
    for (const m of t.matchAll(/\bup to (\d+) lines of history/g)) if (Number(m[1]) !== consts.READ_LINES) bad(m[0], m[1], `READ_LINES = ${consts.READ_LINES}`);
    for (const m of t.matchAll(/\bevery (\d+(?:\.\d+)?)\s*(seconds?|s|milliseconds?|ms)\b/gi)) {
      const ms = Number(m[1]) * (/^m/i.test(m[2]) ? 1 : 1000);
      if (!msAllowed.has(ms)) bad(m[0], m[1], `a poll or tick of ${[...msAllowed].join(" / ")} ms`);
    }
    for (const m of t.matchAll(/\bat most (\d+)\s+(?:at a time|at once|reads?|hc|terminals?|screens?)/gi)) if (Number(m[1]) !== consts.READ_CONCURRENCY) bad(m[0], m[1], `READ_CONCURRENCY = ${consts.READ_CONCURRENCY}`);
    if ("LIST_H" in consts) for (const m of t.matchAll(/\b(?:at most|up to)\s+(\d+)\s*px\b/gi)) if (Number(m[1]) !== consts.LIST_H) bad(m[0], m[1], `LIST_H = ${consts.LIST_H}`);
  }
}

// ---- the six pages share one navigation, each marks itself; tables can be scrolled by keyboard
const pages = HTML.filter((f) => f !== "docs/404.html"); // 404 is not part of the nav set (it has no place in it)
const navOf = (f) => {
  const nav = /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(text(f));
  if (!nav) return null;
  return [...nav[1].matchAll(/<li>\s*<a\b([^>]*)>/gi)].map((m) => ({ href: /\bhref="([^"]*)"/.exec(m[1])?.[1], current: /\baria-current=/.test(m[1]) }));
};
let refNav = null;
for (const f of pages) {
  const items = navOf(f);
  if (!items) { r.fail(`${f}: no <nav> with a list of pages`); continue; }
  const set = items.map((i) => i.href).sort().join(",");
  refNav ??= { f, set };
  if (set !== refNav.set) r.fail(`${f}: navigation lists [${set}], ${refNav.f} lists [${refNav.set}]; every page must show the same pages`);
  const current = items.filter((i) => i.current);
  const self = f.slice("docs/".length);
  if (current.length !== 1) r.fail(`${f}: ${current.length} navigation items have aria-current, expected exactly one`);
  else if (current[0].href !== self) r.fail(`${f}: aria-current is on "${current[0].href}", expected "${self}"`);
}
for (const f of HTML) {
  const t = text(f);
  for (const m of t.matchAll(/<div\b[^>]*\bclass="[^"]*\btable-wrap\b[^"]*"[^>]*>/g)) {
    if (!/\btabindex=/.test(m[0])) r.fail(`${f}: a .table-wrap has no tabindex (a wide table could not be scrolled by keyboard)`);
  }
  for (const m of t.matchAll(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g)) {
    const lines = m[2].split("\n");
    if ((lines.length > 10 || lines.some((l) => l.length > 70)) && !/\btabindex=/.test(m[1])) r.fail(`${f}: a long <pre> has no tabindex`);
  }
  for (const m of t.matchAll(/<th\b([^>]*)>/g)) if (!/\bscope=/.test(m[1])) r.fail(`${f}: a <th> has no scope`);
}

// ---- Pages basics (only once the docs/ site exists)
if (HTML.length) {
  if (!has(root, "docs/.nojekyll")) r.fail("docs/.nojekyll is missing (Pages would run Jekyll over the site)");
  if (!has(root, "docs/index.html")) r.fail("docs/index.html is missing");
  if (!has(root, "docs/assets/preview.png")) r.fail("docs/assets/preview.png is missing (Pages from main /docs cannot see the repo root)");
  else if (has(root, "preview.png") && !readFileSync(join(root, "preview.png")).equals(readFileSync(join(root, "docs/assets/preview.png")))) {
    r.fail("docs/assets/preview.png differs from preview.png: copy the current one");
  }
} else {
  r.note("no docs/*.html yet: Pages checks skipped");
}

// ---- the key the docs name is the key keys.json binds
if (has(root, "keys.json")) {
  try {
    const keys = Object.values(JSON.parse(text("keys.json"))).flatMap((m) => Object.keys(m));
    const bound = [...new Set(keys)];
    for (const f of ["README.md", "RECIPE.md"].filter((f) => has(root, f))) {
      const t = text(f);
      for (const k of bound) {
        // "ctrl-shift-a", "Ctrl+Shift+A" and "Ctrl-Shift-A" all name the same key.
        const re = new RegExp(k.split("-").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[-+ ]"), "i");
        if (!re.test(t)) r.fail(`${f}: does not name the key from keys.json ("${k}")`);
      }
    }
  } catch { /* validate reports invalid JSON */ }
}

r.finish();
