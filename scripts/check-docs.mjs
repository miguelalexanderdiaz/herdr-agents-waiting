// Documentation check: links resolve, the Pages site loads nothing from elsewhere,
// the site's preview is the repo's preview.
//   node scripts/check-docs.mjs [--root <dir>]
// Checks README.md, CONTRIBUTING.md, AGENTS.md, CHANGELOG.md, RECIPE.md and docs/*.html.
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
