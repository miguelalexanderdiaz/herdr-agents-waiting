// Structure and contract check for this repo (a Herdr MOD repo).
//   node scripts/validate.mjs [--root <dir>]
// Pure Node, no dependencies. Exit 0 = ok, 1 = findings. Runs the same on
// Linux, macOS and Windows (CI runs it on all three).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { codeLines, has, isBinary, read, reporter, repoFiles, rootFromArgs } from "./lib.mjs";
import { readFileSync } from "node:fs";

const root = rootFromArgs();
const r = reporter("validate");
const files = repoFiles(root);
const isCI = Boolean(process.env.CI);

// What the portrait layout (which bundles a copy of this mod) relies on.
// Keep this in step with RECIPE.md "Built from". Changing a name here is a
// breaking change for that layout: do it on purpose, and say so in CHANGELOG.
export const CONTRACT = {
  props: ["search"],
  sharedRead: ["agents.since", "space.colors"],
  sharedReadWrite: ["attention.sort"],
  commands: ["agent.focus"],
};
const FOLDER = "attention-picker";
const PLACES = ["right", "left", "top", "bottom", "none"];
const KINDS = ["dialog", "popup", "window"];
const RECIPE_HEADINGS = ["What you see", "How it behaves", "Built from", "Watch out", "Done when"];
const MAX_FILE = 1024 * 1024;
const MAX_PREVIEW = 600 * 1024;

// ---- 1. every JSON file parses
const json = {};
for (const f of files.filter((f) => f.endsWith(".json"))) {
  try { json[f] = JSON.parse(read(root, f)); } catch (e) { r.fail(`${f}: invalid JSON (${e.message})`); }
}

// ---- 2. required files
for (const f of ["LICENSE", "NOTICE", "RECIPE.md", "preview.png", "keys.json", ".gitignore", ".gitattributes"]) {
  if (!has(root, f)) r.fail(`missing ${f}`);
}
if (!has(root, "README.md")) (isCI ? r.fail : r.note)("README.md is missing" + (isCI ? "" : " (warning: the documentation role adds it)"));

// ---- 2b. the CI definition (scripts/ci.workflow.yml) and, once the owner installs it, its copy
// No YAML parser (zero dependencies): the file is small and written in one fixed style, so this is line matching.
export const CI_FILE = "scripts/ci.workflow.yml";
export const CI_INSTALLED = ".github/workflows/ci.yml";
export function lintWorkflow(text, exists, fail, name = CI_FILE) {
  const lines = text.split(/\r?\n/);
  const code = lines.filter((l) => !/^\s*#/.test(l));
  const body = code.join("\n");
  for (const os of ["ubuntu-latest", "windows-latest", "macos-latest"]) {
    if (!new RegExp(`\\b${os}\\b`).test(body)) fail(`${name}: the matrix has no ${os}; the repository promises Linux, Windows and macOS`);
  }
  const node = /^\s*node:\s*\[([^\]]*)\]/m.exec(body);
  if (!node || !/\b22\b/.test(node[1]) || !/\b24\b/.test(node[1])) fail(`${name}: the node matrix must list 22 and 24`);
  const perm = /^permissions:\s*\n((?:[ \t]+\S.*\n?)+)/m.exec(body + "\n");
  if (!perm) fail(`${name}: no top-level 'permissions:' block (least privilege: contents: read)`);
  else {
    if (!/^\s+contents:\s*read\s*$/m.test(perm[1])) fail(`${name}: permissions must include 'contents: read'`);
    if (/:\s*write\b/.test(perm[1])) fail(`${name}: permissions grant write access; this workflow only reads`);
  }
  if (/permissions:\s*write-all|permissions:\s*read-all/.test(body)) fail(`${name}: permissions must list scopes, not write-all/read-all`);
  if (/\bpull_request_target\b/.test(body)) fail(`${name}: pull_request_target runs fork code with secrets; do not use it`);
  const uses = [...body.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
  if (!uses.length) fail(`${name}: no 'uses:' step (checkout is expected)`);
  for (const u of uses) {
    if (/^\.\//.test(u)) continue;
    if (!/^[\w.-]+\/[\w./-]+@(v\d+(\.\d+){0,2}|[0-9a-f]{40})$/.test(u)) fail(`${name}: '${u}' must be pinned to a version tag (vN) or a full commit SHA`);
  }
  if (uses.some((u) => u.startsWith("actions/checkout@")) && !/persist-credentials:\s*false/.test(body)) fail(`${name}: actions/checkout needs 'persist-credentials: false'`);
  if (!/^\s*workflow_dispatch:/m.test(body)) fail(`${name}: no workflow_dispatch trigger (the owner needs a way to start a run by hand)`);
  // Every script a step runs must exist in the repository.
  for (const m of body.matchAll(/\bnode\s+(\S+\.(?:mjs|js|cjs))/g)) {
    if (!exists(m[1])) fail(`${name}: runs '${m[0]}' but ${m[1]} does not exist`);
  }
  for (const m of body.matchAll(/^\s*run:\s*(.*)$/gm)) {
    const cmd = m[1].trim();
    if (!cmd || cmd === "|" || cmd === ">" || cmd.startsWith("echo ")) continue;
    if (/^npm test$/.test(cmd)) { if (!exists("package.json")) fail(`${name}: runs npm test but package.json does not exist`); continue; }
    if (!/^node\s/.test(cmd)) fail(`${name}: unexpected run command '${cmd.slice(0, 40)}' (only node scripts/*.mjs and npm test are allowed; extend lintWorkflow on purpose)`);
  }
  for (const need of ["scripts/validate.mjs", "scripts/privacy-scan.mjs", "scripts/check-docs.mjs"]) {
    if (!body.includes(`node ${need}`)) fail(`${name}: does not run ${need}`);
  }
  if (!/\bnpm test\b/.test(body)) fail(`${name}: does not run npm test`);
}
if (!has(root, CI_FILE)) r.fail(`missing ${CI_FILE} (the CI definition; step 0 of .github/PUBLISH-CHECKLIST.md installs it)`);
else {
  const ci = read(root, CI_FILE);
  lintWorkflow(ci, (f) => has(root, f), (m) => r.fail(m));
  if (has(root, CI_INSTALLED)) {
    if (read(root, CI_INSTALLED) !== ci) r.fail(`${CI_INSTALLED} differs from ${CI_FILE}; they must be byte-equal (edit ${CI_FILE}, then copy it)`);
    else r.note(`CI: ${CI_INSTALLED} is installed and equal to ${CI_FILE}`);
  } else {
    r.note(`CI: defined in ${CI_FILE}, not installed (the owner copies it to ${CI_INSTALLED}; see .github/PUBLISH-CHECKLIST.md step 0)`);
  }
}

// ---- 3. this is a mod repo: mods/<name>/ only, no layouts/
if (files.some((f) => f.startsWith("layouts/"))) r.fail("layouts/ exists: this is a mod repo (topic herdr-mod); a layout needs its own checks");
const mods = [...new Set(files.filter((f) => f.startsWith("mods/")).map((f) => f.split("/")[1]))];
if (!mods.length) r.fail("no mods/<name>/ folder");
for (const m of mods) {
  if (!has(root, `mods/${m}/main.js`)) r.fail(`mods/${m}/main.js is missing`);
  const mj = json[`mods/${m}/mod.json`];
  if (!mj) { r.fail(`mods/${m}/mod.json is missing or invalid`); continue; }
  if (typeof mj !== "object" || Array.isArray(mj)) { r.fail(`mods/${m}/mod.json must be an object`); continue; }
  if (mj.place !== undefined && !PLACES.includes(mj.place)) r.fail(`mods/${m}/mod.json: place "${mj.place}" is not one of ${PLACES.join("|")}`);
  if (mj.size !== undefined && typeof mj.size !== "number") r.fail(`mods/${m}/mod.json: size must be a number`);
  if (mj.focusable !== undefined && typeof mj.focusable !== "boolean") r.fail(`mods/${m}/mod.json: focusable must be a boolean`);
  if (mj.title !== undefined && typeof mj.title !== "string") r.fail(`mods/${m}/mod.json: title must be a string`);
  const o = mj.overlay;
  if (o !== undefined) {
    if (typeof o !== "object" || o === null) r.fail(`mods/${m}/mod.json: overlay must be an object`);
    else {
      if (o.kind !== undefined && !KINDS.includes(o.kind)) r.fail(`mods/${m}/mod.json: overlay.kind "${o.kind}" is not one of ${KINDS.join("|")}`);
      for (const k of ["width", "height"]) if (o[k] !== undefined && typeof o[k] !== "number") r.fail(`mods/${m}/mod.json: overlay.${k} must be a number`);
    }
  }
}
// Herdr writes these into every mod folder; they must never be committed.
for (const f of files) {
  if (/(^|\/)(gpui-kit\.d\.ts|herdr\.d\.ts|jsconfig\.json)$/.test(f)) r.fail(`${f}: written by Herdr, must not be committed (see .gitignore)`);
  if (/(^|\/)node_modules\//.test(f) || /(^|\/)\.DS_Store$/.test(f)) r.fail(`${f}: must not be committed`);
}

// ---- 4. keys.json
const keys = json["keys.json"];
if (keys) {
  const sectionOk = (s) => s === "global" || s === "terminal" || /^layout:.+/.test(s) || /^mod:.+/.test(s);
  for (const [section, map] of Object.entries(keys)) {
    if (!sectionOk(section)) r.fail(`keys.json: section "${section}" is not global|terminal|layout:<name>|mod:<name>`);
    if (typeof map !== "object" || map === null) { r.fail(`keys.json: section "${section}" must be an object`); continue; }
    for (const [key, action] of Object.entries(map)) {
      if (typeof action !== "string") r.fail(`keys.json: ${section} ${key}: action must be a string`);
      // cmd does not exist on Linux and Windows; ctrl+alt is AltGr on Windows; option types characters on a Mac.
      if (/(^|-)(cmd|super|meta|win|opt|option)-/i.test(key) || /(^|-)ctrl-alt-/i.test(key) || /(^|-)alt-ctrl-/i.test(key)) {
        r.fail(`keys.json: ${section} "${key}" is not portable (cmd/super/option or ctrl+alt); use ctrl-shift-<key>`);
      }
      const m = /^mod\.open:(.+)$/.exec(String(action));
      if (m && !has(root, `mods/${m[1]}/main.js`)) r.fail(`keys.json: ${section} ${key} opens mod "${m[1]}" but mods/${m[1]}/main.js does not exist`);
      const c = /^([a-z0-9-]+)\.[a-z0-9-]+$/i.exec(String(action));
      if (c && !["mod", "tab", "pane", "space", "layout", "window", "agent", "terminal", "settings"].includes(c[1]) && !mods.includes(c[1])) {
        r.fail(`keys.json: ${section} ${key}: "${action}" goes to mod "${c[1]}", which this repo does not ship`);
      }
    }
  }
}

// ---- 5. licence and notice
if (has(root, "LICENSE")) {
  const lic = read(root, "LICENSE");
  if (!/^\s*Apache License/.test(lic) || !lic.includes("Version 2.0, January 2004")) r.fail("LICENSE is not the Apache License, Version 2.0 text");
  if (/Copyright\s*\[yyyy\]/i.test(lic) || /\[name of copyright owner\]/i.test(lic)) r.fail("LICENSE still has the [yyyy] [name of copyright owner] placeholder");
  if (!/^\s*Copyright\s+(\(c\)\s+)?\d{4}\s+\S+/m.test(lic)) r.fail("LICENSE has no filled-in 'Copyright <year> <holder>' line");
}
if (has(root, "NOTICE") && !/Copyright\s+\d{4}/.test(read(root, "NOTICE"))) r.fail("NOTICE has no 'Copyright <year>' line");

// ---- 6. size limits and line endings
for (const f of files) {
  const size = statSync(join(root, f)).size;
  if (f === "preview.png" || f === "docs/assets/preview.png") { if (size > MAX_PREVIEW) r.fail(`${f}: ${size} bytes, over ${MAX_PREVIEW}`); }
  else if (size > MAX_FILE) r.fail(`${f}: ${size} bytes, over ${MAX_FILE}`);
  if (!isBinary(f) && readFileSync(join(root, f)).includes(13)) r.fail(`${f}: has CR (CRLF) line endings; .gitattributes should keep LF on every OS`);
}

// ---- 7. preview.png is a real PNG, 1100x705 (the size herdr.dev examples use)
if (has(root, "preview.png")) {
  const b = readFileSync(join(root, "preview.png"));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (b.length < 33 || !b.subarray(0, 8).equals(sig) || b.toString("latin1", 12, 16) !== "IHDR") r.fail("preview.png is not a PNG");
  else {
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (w !== 1100 || h !== 705) r.fail(`preview.png is ${w}x${h}, expected 1100x705`);
  }
}

// ---- 8. RECIPE.md: the six parts, in order
if (has(root, "RECIPE.md")) {
  const rec = read(root, "RECIPE.md");
  const lines = rec.split("\n");
  const first = lines.findIndex((l) => /^# \S/.test(l));
  if (first < 0) r.fail("RECIPE.md: no '# Name' title");
  if (!/^!\[[^\]]+\]\(preview\.png\)\s*$/m.test(rec)) r.fail("RECIPE.md: missing the ![Name](preview.png) line");
  let at = first;
  for (const h of RECIPE_HEADINGS) {
    const i = lines.findIndex((l, k) => k > at && new RegExp(`^## ${h}\\s*$`, "i").test(l));
    if (i < 0) { r.fail(`RECIPE.md: heading "## ${h}" is missing or out of order`); break; }
    at = i;
  }
  const img = lines.findIndex((l) => /\]\(preview\.png\)/.test(l));
  const firstH2 = lines.findIndex((l) => /^## /.test(l));
  if (img >= 0 && firstH2 >= 0 && img > firstH2) r.fail("RECIPE.md: the preview image must come before '## What you see'");
}

// ---- 9a. what a mod's code may import and call (allow-lists, so an alias cannot get past them)
// To allow something new: update RECIPE.md "What it reaches" and README "Privacy and permissions" FIRST,
// then add it here, on purpose. Names, not behaviour, are what a script can check; this is a policy
// check on the source, not a sandbox (Herdr does not sandbox mods).
export const HERDR_NAMES = ["agents", "spaces", "run", "hc", "theme", "settings", "shared", "setShared", "props", "closeOverlay"];
export const RUN_COMMANDS = ["agent.focus", "overlay.close"];
export const HC_FIRST_ARG = "read";
export const IMPORT_SPECIFIERS = ["./logic.js", "./ask.js", "gpui-kit", "gpui-base", "herdr"];
export const SPDX_LINE = "// SPDX-License-Identifier: Apache-2.0";

// Returns { imports: [{ spec, names: [{ imported, local }] }], problems: [string] } for one file's code
// (comments already removed). Line numbers are not kept: the file name is enough to find a one-line finding.
export function analyzeModCode(code, file = "file") {
  const problems = [];
  const imports = [];
  const bad = (m) => problems.push(`${file}: ${m}`);
  const importRe = /\bimport\b\s*(?:([\w$*{}\s,]*?)\s*\bfrom\s*)?(["'])([^"']+)\2/g;
  for (const m of code.matchAll(importRe)) {
    const clause = (m[1] ?? "").trim();
    const entry = { spec: m[3], names: [] };
    if (clause) {
      const braces = /\{([^}]*)\}/.exec(clause);
      if (/\*\s*as\b/.test(clause)) entry.namespace = true;
      const dflt = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
      if (dflt && !entry.namespace) entry.default = dflt;
      if (braces) {
        for (const part of braces[1].split(",").map((x) => x.trim()).filter(Boolean)) {
          const [imported, , local] = part.split(/\s+/);
          entry.names.push({ imported, local: local ?? imported });
        }
      }
    }
    imports.push(entry);
  }
  for (const m of code.matchAll(/\bexport\b[^;\n]*?\bfrom\s*(["'])([^"']+)\1/g)) imports.push({ spec: m[2], names: [], reexport: true });
  for (const e of imports) {
    if (!IMPORT_SPECIFIERS.includes(e.spec)) bad(`imports "${e.spec}", which is not on the allow-list (${IMPORT_SPECIFIERS.join(", ")}). Update RECIPE.md "What it reaches" first, then IMPORT_SPECIFIERS in scripts/validate.mjs`);
  }
  if (/\bimport\s*\(/.test(code)) bad("dynamic import() is not allowed (it could load anything)");
  if (/\brequire\s*\(/.test(code)) bad("require() is not allowed");
  if (/\beval\s*\(|\bnew\s+Function\b|(^|[^.\w$])Function\s*\(/.test(code)) bad("eval / Function constructors are not allowed");
  if (/\bglobalThis\s*\[|Reflect\s*\.\s*get\s*\(\s*globalThis|\bglobalThis\s*\.\s*(fetch|exec|process)\b|\bprocess\s*\./.test(code)) bad("reaching globals by name or by computed property is not allowed");
  const local = {}; // imported name -> local names, for names from "herdr"
  for (const e of imports.filter((x) => x.spec === "herdr")) {
    if (e.namespace || e.default) bad('imports "herdr" as a namespace or default; list the names so they can be checked');
    for (const n of e.names) {
      if (!HERDR_NAMES.includes(n.imported)) bad(`imports "${n.imported}" from "herdr", which is not on the allow-list (${HERDR_NAMES.join(", ")}). Update RECIPE.md "What it reaches" first, then HERDR_NAMES in scripts/validate.mjs`);
      (local[n.imported] ??= []).push(n.local);
    }
  }
  const body = code.replace(importRe, " ");
  const calls = (names, test, what) => {
    for (const name of names) {
      const esc = name.replace(/[$]/g, "\\$");
      const at = new RegExp(`(?<![.\\w$])${esc}(?![\\w$])`, "g");
      for (const m of body.matchAll(at)) {
        const after = body.slice(m.index + m[0].length);
        const call = /^\s*\(\s*([\s\S]{0,80})/.exec(after);
        if (!call) { bad(`${what} is used as a value, not called directly; aliasing it would defeat the check`); continue; }
        if (!test(call[1])) bad(`${what} is called with an argument that is not on the allow-list`);
      }
    }
  };
  calls(local.run ?? [], (a) => new RegExp(`^(["'])(${RUN_COMMANDS.map((c) => c.replace(".", "\\.")).join("|")})\\1\\s*[,)]`).test(a), `run() (only ${RUN_COMMANDS.join(" and ")} with a string literal)`);
  calls(local.hc ?? [], (a) => new RegExp(`^\\[\\s*(["'])${HC_FIRST_ARG}\\1\\s*[,\\]]`).test(a), `hc() (only an array literal starting "${HC_FIRST_ARG}")`);
  return { imports, problems, herdr: Object.keys(local).sort() };
}

// ---- 9. mod code: compatibility contract, foreign mods, capability report
const report = { network: [], exec: [], hc: [], storage: [], fileWrite: [], outside: [], imports: new Set(), herdrNames: new Set() };
for (const m of mods) {
  const jsFiles = files.filter((f) => f.startsWith(`mods/${m}/`) && f.endsWith(".js"));
  const all = jsFiles.map((f) => read(root, f)).join("\n");
  if (m === FOLDER) {
    const main = has(root, `mods/${m}/main.js`) ? read(root, `mods/${m}/main.js`) : "";
    const need = [
      ...CONTRACT.props.map((p) => [`props`, p]),
      ...[...CONTRACT.sharedRead, ...CONTRACT.sharedReadWrite].map((k) => ["shared key", k]),
      ...CONTRACT.commands.map((c) => ["command", c]),
    ];
    for (const [what, name] of need) {
      if (!main.includes(name) && !all.includes(name)) r.fail(`mods/${m}: ${what} "${name}" is no longer used. Keep the portrait layout compatible (see CONTRACT in scripts/validate.mjs)`);
    }
    if (!/\bprops\s*\(/.test(all)) r.fail(`mods/${m}: no props() call; props.search must stay readable`);
    if (!all.includes("setShared") || !/setShared\(\s*["']attention\.sort["']/.test(all)) r.fail(`mods/${m}: attention.sort must still be written with setShared (shared with the portrait layout)`);
    if (/setShared\(\s*["']agents\.since["']/.test(all)) r.fail(`mods/${m}: agents.since belongs to the portrait layout; this mod must never write it`);
  }
  for (const f of jsFiles) {
    const src = read(root, f);
    const cl = codeLines(src);
    const a = analyzeModCode(cl.map((l) => l.text).join("\n"), f);
    for (const p of a.problems) r.fail(p);
    for (const e of a.imports) report.imports.add(e.spec);
    for (const n of a.herdr) report.herdrNames.add(n);
    if (!src.split(/\r?\n/, 3).some((l) => l.trim() === SPDX_LINE)) r.fail(`${f}: the first 3 lines must include "${SPDX_LINE}" (a copied mod folder has to carry its licence)`);
    for (const { n, text } of cl) {
      const at = `${f}:${n}`;
      if (/\bfetch\s*\(|new\s+(XMLHttpRequest|WebSocket|EventSource)\b|sendBeacon\s*\(/.test(text)) report.network.push(at);
      if (/https?:\/\//.test(text) && !/^\s*import\b/.test(text)) report.network.push(at + " (url)");
      if (/^\s*import\b.*["']https?:/.test(text)) report.network.push(at + " (remote import)");
      // cx.spawn is Herdr's async task helper, not a program launch; only exec, execFile and child_process count.
      if (/\bexec\s*\(|\bexecFile\s*\(|child_process/.test(text)) report.exec.push(at);
      if (/\bhc\s*\(/.test(text)) report.hc.push(at);
      if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(text)) report.storage.push(at);
      if (/\b(writeTextFile|writeFile|readTextFile|readFile|readDir)\s*\(/.test(text)) report.fileWrite.push(at);
      if (/["'`](\.\.\/|~\/|\/etc\/|[A-Za-z]:\\)/.test(text)) report.outside.push(at);
      // Another mod's name in code (not in a comment) is a dependency on something a stranger lacks.
      if (/workspace-chrome|bar-strip|portrait/.test(text)) r.fail(`${at}: names another mod/layout in code (allowed on comment lines only)`);
      if (/mods\/(?!\$\{)[A-Za-z0-9_-]+\//.test(text) && !new RegExp(`mods/${m}/`).test(text)) r.fail(`${at}: reaches into another mod's folder`);
    }
  }
  // The folder name appears in code once (const HOME) so a rename on a name clash is mechanical.
  const mentions = jsFiles.flatMap((f) => codeLines(read(root, f)).filter((l) => l.text.includes(`mods/${m}`)).map((l) => `${f}:${l.n}`));
  if (mentions.length > 1) r.fail(`mods/${m}: the folder name is hard-coded on ${mentions.length} code lines (${mentions.join(", ")}); keep it in one HOME constant`);
}

// Network, exec and file writes are not allowed in this mod at all. hc (reads other terminals) and
// storage (localStorage) are allowed only because RECIPE.md and README.md say so.
if (report.network.length) r.fail(`network use found (${report.network.join(", ")}); this mod promises none`);
if (report.exec.length) r.fail(`program execution found (${report.exec.join(", ")}); this mod promises none`);
if (report.fileWrite.length) r.fail(`file access found (${report.fileWrite.join(", ")}); this mod promises none`);
if (report.outside.length) r.fail(`reads outside the mod folder? (${report.outside.join(", ")})`);
const doc = (f) => (has(root, f) ? read(root, f) : null);
const recipe = doc("RECIPE.md"), readme = doc("README.md");
const mention = (txt, re) => txt === null ? null : re.test(txt);
if (report.storage.length) {
  if (mention(recipe, /localStorage/i) === false) r.fail("mod uses localStorage but RECIPE.md does not say so (Watch out)");
  if (readme === null) (isCI ? r.fail : r.note)("localStorage use cannot be checked against README.md (missing)");
  else if (!/localStorage/i.test(readme)) r.fail("mod uses localStorage but README.md does not say so (Privacy and permissions)");
}
if (report.hc.length) {
  if (mention(recipe, /\bhc\b/) === false) r.fail("mod runs hc but RECIPE.md does not say so (Watch out)");
  if (readme !== null && !/\bhc\b/.test(readme)) r.fail("mod runs hc but README.md does not say so (Privacy and permissions)");
}
// Capability report, always printed, so a reviewer sees what the mod reaches.
const n = (a) => `${a.length} place${a.length === 1 ? "" : "s"}`;
r.note(`imports: ${[...report.imports].sort().join(", ")}; from herdr: ${[...report.herdrNames].sort().join(", ")}`);
r.note(`capabilities: network ${n(report.network)}, exec ${n(report.exec)}, hc ${n(report.hc)}, localStorage ${n(report.storage)}, file access ${n(report.fileWrite)}`);

// ---- 9b. numbers RECIPE.md quotes from the code stay equal to the code
if (has(root, `mods/${FOLDER}/main.js`) && has(root, "RECIPE.md")) {
  const main = read(root, `mods/${FOLDER}/main.js`), rec = read(root, "RECIPE.md");
  for (const name of ["POLL_MS", "READ_LINES", "READ_CONCURRENCY", "LIST_H"]) {
    const m = new RegExp(`\\bconst ${name}\\s*=\\s*(\\d+)`).exec(main);
    if (!m) { if (rec.includes(name)) r.fail(`RECIPE.md names ${name}, but main.js has no 'const ${name} = <number>'`); continue; }
    if (rec.includes(name) && !new RegExp(`${name}\\\`?\\s*=\\s*${m[1]}\\b`).test(rec)) r.fail(`RECIPE.md quotes ${name} with a different value than main.js (${m[1]})`);
  }
  const home = /\bconst HOME\s*=\s*"([^"]+)"/.exec(main);
  if (!home) r.fail("main.js has no 'const HOME = \"mods/<folder>\"' (the one place the folder name is written)");
  else if (home[1] !== `mods/${FOLDER}`) r.fail(`main.js HOME is "${home[1]}", expected "mods/${FOLDER}"`);
}

// ---- 10. SVG assets: plain shapes, no scripts or external references, tinted by currentColor
for (const f of files.filter((f) => f.startsWith("mods/") && f.endsWith(".svg"))) {
  const s = read(root, f);
  if (/<script|<foreignObject|<image|<use\b|xlink:href|\bhref=|@import|url\(\s*["']?https?:/i.test(s)) r.fail(`${f}: contains script, image or external reference`);
  if (!/currentColor/.test(s)) r.fail(`${f}: has no currentColor, so Herdr cannot tint it with the theme`);
}

// ---- 11. tests exist
if (!files.some((f) => /^tests\/.+\.test\.mjs$/.test(f))) (isCI ? r.fail : r.note)("no tests/*.test.mjs yet (warning: the code-review role adds them)");

r.finish();
