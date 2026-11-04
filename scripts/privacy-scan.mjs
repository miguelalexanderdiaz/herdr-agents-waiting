// Privacy scan: no personal information in any file or in git history.
//   node scripts/privacy-scan.mjs [--root <dir>]
// Env PRIVACY_EXTRA: comma-separated extra words to refuse (a username, an employer,
// a hostname). Keep that list OUT of the repo: set it in your shell or as a CI secret.
// Pure Node, no dependencies. Exit 0 = clean, 1 = findings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { git, isBinary, isGitRepo, reporter, repoFiles, rootFromArgs } from "./lib.mjs";

const root = rootFromArgs();
const r = reporter("privacy-scan");
const files = repoFiles(root);

// Exact strings that are deliberate and public: the clone URL / herdr.dev path, and the Pages address.
const ALLOWED_STRINGS = ["miguelalexanderdiaz/herdr-agents-waiting", "miguelalexanderdiaz.github.io/herdr-agents-waiting"];
const OWNER = ALLOWED_STRINGS[0].split("/")[0];
// E-mail domains that are fine: GitHub's no-reply addresses and the Claude co-author line.
const ALLOWED_MAIL = [/@users\.noreply\.github\.com$/i, /^noreply@anthropic\.com$/i, /^git@github\.com$/i];
// Home folder names that are not a person: CI runners and the placeholders tests and docs use.
const GENERIC_HOMES = new Set(["runner", "vsts", "ubuntu", "user", "username", "name", "you", "me", "dev", "example", "someone", "alice", "bob"]);
const generic = (m) => GENERIC_HOMES.has(m[1].toLowerCase());

// Patterns are written so this file does not match itself.
const RULES = [
  { id: "home-path-mac", re: /\/Users\/(?![<{$%])([^\/\s"'`<>)\]}]+)/, ok: generic },
  { id: "home-path-linux", re: /\/home\/(?![<{$%])([^\/\s"'`<>)\]}]+)/, ok: generic },
  { id: "home-path-windows", re: /[A-Za-z]:[\\/]+Users[\\/]+(?![<{$%])([^\\\/\s"'`<>)\]}]+)/, ok: generic },
  { id: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/, ok: (m) => ALLOWED_MAIL.some((a) => a.test(m[0])) },
  { id: "hostname", re: /(?<![.\w])[A-Za-z0-9][A-Za-z0-9-]+\.(?:local|lan|home\.arpa)(?![\w(])/ },
  { id: "token", re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const extra = (process.env.PRIVACY_EXTRA ?? "").split(",").map((s) => s.trim()).filter((s) => s.length >= 3);
if (extra.length) r.note(`PRIVACY_EXTRA: ${extra.length} extra word(s) checked`);
else r.note("PRIVACY_EXTRA not set: only the built-in rules ran (set it locally or as a CI secret to add your own words)");

// The copyright holder named on LICENSE's line may appear nowhere else.
let holder = null;
try {
  const m = /^\s*Copyright\s+(?:\(c\)\s+)?\d{4}\s+(.+?)\s*$/m.exec(readFileSync(join(root, "LICENSE"), "utf8"));
  if (m && !/^the\b/i.test(m[1])) holder = m[1];
} catch { /* no LICENSE: validate reports it */ }

function mask(text) {
  let t = text;
  for (const a of ALLOWED_STRINGS) t = t.split(a).join(" ".repeat(a.length));
  return t;
}

// Round plans and logs under plans/ may talk about the owner's handle (it is public, it is in the
// clone URL); every other rule still applies to them.
const isPlan = (f) => f.startsWith("plans/");

function scanText(text, where, { license = false, plan = false } = {}) {
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = mask(raw);
    for (const rule of RULES) {
      const g = new RegExp(rule.re.source, "g");
      for (const m of line.matchAll(g)) {
        if (rule.ok?.(m)) continue;
        r.fail(`${where}:${i + 1}: ${rule.id}: ${m[0].slice(0, 48)}`);
      }
    }
    const low = line.toLowerCase();
    if (!plan && low.includes(OWNER.toLowerCase())) r.fail(`${where}:${i + 1}: username outside the allowed owner/repo string`);
    if (holder && !(license && /^\s*Copyright\s/.test(raw)) && low.includes(holder.toLowerCase())) r.fail(`${where}:${i + 1}: the copyright holder's name appears outside LICENSE's copyright line`);
    for (const w of extra) if (low.includes(w.toLowerCase())) r.fail(`${where}:${i + 1}: PRIVACY_EXTRA word found`);
  });
}

// 1. The tree.
for (const f of files) {
  if (isBinary(f)) continue;
  let text;
  try { text = readFileSync(join(root, f), "utf8"); } catch { continue; }
  if (text.includes("\0")) continue;
  scanText(text, f, { license: f === "LICENSE", plan: isPlan(f) });
}

// 2. History: commit metadata, messages, and every line ever added.
if (isGitRepo(root)) {
  const meta = git(root, ["log", "--all", "--format=%x1e%H%x1f%ae%x1f%ce%x1f%an%x1f%cn%x1f%B"]);
  if (meta === null) r.note("git log failed: history not scanned");
  else {
    for (const rec of meta.split("\x1e").filter(Boolean)) {
      const [hash, ae, ce, an, cn, body = ""] = rec.split("\x1f");
      const short = hash.trim().slice(0, 7);
      for (const [what, mail] of [["author", ae], ["committer", ce]]) {
        if (mail && !ALLOWED_MAIL.some((a) => a.test(mail.trim()))) r.fail(`commit ${short}: ${what} e-mail is not a no-reply address`);
      }
      for (const w of extra) {
        if ([an, cn].some((v) => v.toLowerCase().includes(w.toLowerCase()))) r.fail(`commit ${short}: PRIVACY_EXTRA word in author/committer name`);
      }
      scanText(body, `commit ${short} message`);
      for (const m of body.matchAll(/^Co-Authored-By:\s*(.*)$/gim)) {
        if (!/<noreply@anthropic\.com>\s*$/i.test(m[1]) && !/@users\.noreply\.github\.com>\s*$/i.test(m[1])) r.fail(`commit ${short}: Co-Authored-By names someone other than Claude: ${m[1].slice(0, 40)}`);
      }
    }
    const patch = git(root, ["log", "--all", "-p", "-U0", "--no-color", "--format=%x1ecommit %H"]);
    if (patch !== null) {
      for (const chunk of patch.split("\x1e").filter(Boolean)) {
        const short = chunk.slice(7, 14);
        let file = "?";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("+++ ")) { file = line.slice(6); continue; }
          if (!line.startsWith("+") || isBinary(file)) continue;
          scanText(line.slice(1), `history ${short} ${file}`, { license: file === "LICENSE", plan: isPlan(file) });
        }
      }
    }
  }
} else {
  r.note("not a git checkout: history not scanned");
}

// Same line found in the tree and in history is reported twice; keep the output short.
r.finish();
