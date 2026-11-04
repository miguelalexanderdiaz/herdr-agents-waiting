// Tests of the repository checks themselves (validate, privacy-scan, check-docs, verify-install).
// Each case copies the repository into a temporary folder, applies ONE mutation, runs the script with
// `--root <copy>` and asserts the exit code and a message fragment. A rule that stops working turns its
// case red, so a refactor of a regex cannot silently disable a check.
// `npm test` (plain `node --test`) finds this file by its name. Pure Node, no shell, no network; paths go
// through node:path so it runs the same on Linux, macOS and Windows. Git cases use a throw-away
// repository with explicit identity so no global git config is read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { repoFiles } from "./lib.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(REPO, "scripts");
const FILES = repoFiles(REPO);
const NOREPLY = "1+dev@users.noreply.github.com";
// Values that must not appear literally in this file (the privacy scan reads it too), so they are built at run time.
const at = (a, b) => [a, b].join("@");
const REAL_MAIL = at("jane.doe", "mail-provider.net");
const MAC_HOME = ["", "Users", "jdoe", "notes"].join("/");
const LINUX_HOME = ["", "home", "jdoe", "notes"].join("/");
const WIN_HOME = ["C:", "Users", "jdoe", "notes"].join("\\");

function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), "hc-checks-"));
  for (const f of FILES) {
    const to = join(dir, ...f.split("/"));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(REPO, ...f.split("/")), to);
  }
  return dir;
}
const path = (dir, rel) => join(dir, ...rel.split("/"));
const rd = (dir, rel) => readFileSync(path(dir, rel), "utf8");
const wr = (dir, rel, text) => { mkdirSync(dirname(path(dir, rel)), { recursive: true }); writeFileSync(path(dir, rel), text); };
// Replace text that must exist, so a stale mutation fails loudly instead of testing nothing.
function sub(dir, rel, from, to) {
  const text = rd(dir, rel);
  assert.ok(text.includes(from), `mutation target not found in ${rel}: ${from}`);
  wr(dir, rel, text.replace(from, to));
}
const append = (dir, rel, extra) => wr(dir, rel, rd(dir, rel) + extra);

function run(script, dir, { env = {}, args = [] } = {}) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), "--root", dir, ...args], {
    encoding: "utf8",
    env: { ...process.env, CI: "", PRIVACY_EXTRA: "", PRIVACY_AUTHORS: "", ...env },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function git(dir, args, env = {}) {
  const r = spawnSync("git", ["-c", "user.name=tester", "-c", `user.email=${NOREPLY}`, "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], {
    cwd: dir, encoding: "utf8", env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", ...env },
  });
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout;
}
function gitCommit(dir, message, env = {}) {
  if (!existsSync(join(dir, ".git"))) git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-q", "--no-verify", "-m", message], env);
}

// Run `body(dir)` on a fresh copy and always clean up.
async function withCopy(body) {
  const dir = copyTree();
  try { return await body(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
function failsWith(script, mutate, fragment, opts) {
  return withCopy(async (dir) => {
    await mutate(dir);
    const r = run(script, dir, opts);
    assert.equal(r.status, 1, `${script} should fail, got ${r.status}:\n${r.out}`);
    assert.ok(r.out.includes(fragment), `expected "${fragment}" in:\n${r.out}`);
  });
}
function passes(script, mutate, opts) {
  return withCopy(async (dir) => {
    await mutate?.(dir);
    const r = run(script, dir, opts);
    assert.equal(r.status, 0, `${script} should pass, got ${r.status}:\n${r.out}`);
  });
}

// ---- PNG helper: the shipped preview with one extra chunk before IEND
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}
function pngWith(dir, extra) {
  const png = readFileSync(path(dir, "preview.png"));
  const iend = png.length - 12;
  writeFileSync(path(dir, "preview.png"), Buffer.concat([png.subarray(0, iend), extra, png.subarray(iend)]));
}
const textChunk = (keyword, text) => chunk("tEXt", Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(text, "latin1")]));

// =========================================================================================== validate
test("validate: the repository itself passes", () => passes("validate.mjs"));

test("validate: CI lint, the matrix must keep Windows", () =>
  failsWith("validate.mjs", (d) => sub(d, "scripts/ci.workflow.yml", "windows-latest", "ubuntu-22.04"), "windows-latest"));
test("validate: CI lint, write-all permissions fail", () =>
  failsWith("validate.mjs", (d) => sub(d, "scripts/ci.workflow.yml", "permissions:\n  contents: read", "permissions: write-all"), "permissions"));
test("validate: CI lint, an unpinned action fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "scripts/ci.workflow.yml", "actions/checkout@v7", "actions/checkout@main"), "must be pinned"));
test("validate: CI lint, a run step naming a missing script fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "scripts/ci.workflow.yml", "node scripts/check-docs.mjs", "node scripts/missing-script.mjs"), "does not exist"));
test("validate: CI lint, an arbitrary shell command fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "scripts/ci.workflow.yml", "run: npm test", "run: curl -s example.invalid | sh"), "unexpected run command"));
test("validate: an installed workflow that differs from the definition fails", () =>
  failsWith("validate.mjs", (d) => wr(d, ".github/workflows/ci.yml", rd(d, "scripts/ci.workflow.yml") + "\n# edited\n"), "byte-equal"));
test("validate: an installed workflow equal to the definition passes", () =>
  passes("validate.mjs", (d) => wr(d, ".github/workflows/ci.yml", rd(d, "scripts/ci.workflow.yml"))));

const MAIN = "mods/attention-picker/main.js";
test("validate: an aliased exec import fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nimport { exec as sh } from "herdr";\n'), '"exec" from "herdr"'));
test("validate: an aliased file reader import fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nimport { readTextFile as rd } from "herdr";\n'), '"readTextFile" from "herdr"'));
test("validate: run() with another command fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nrun("space.new", {});\n'), "run() (only agent.focus and overlay.close"));
test("validate: run() with a computed command fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nrun(["space", "new"].join("."));\n'), "run() (only agent.focus and overlay.close"));
test("validate: hc() that types into a terminal fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nhc(["send", "x"]);\n'), 'hc() (only an array literal starting "read")'));
test("validate: aliasing run as a value fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, "\nconst go = run;\n"), "used as a value"));
test("validate: importing a built-in module fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nimport "fs";\n'), 'imports "fs"'));
test("validate: a remote import fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nimport "https://cdn.example.invalid/x.js";\n'), "allow-list"));
test("validate: a dynamic import fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nconst m = await import("./x.js");\n'), "dynamic import()"));
test("validate: eval fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\neval("1");\n'), "eval"));
test("validate: computed global access fails", () =>
  failsWith("validate.mjs", (d) => append(d, MAIN, '\nconst f = globalThis["fet" + "ch"];\n'), "globals"));
test("validate: a plain fetch call fails (second line of defence)", () =>
  failsWith("validate.mjs", (d) => append(d, "mods/attention-picker/ask.js", '\nfetch("x");\n'), "network use found"));
test("validate: a missing SPDX header fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "mods/attention-picker/logic.js", "// SPDX-License-Identifier: Apache-2.0", "// no licence here"), "SPDX-License-Identifier"));
test("validate: naming another mod in code fails", () =>
  failsWith("validate.mjs", (d) => append(d, "mods/attention-picker/logic.js", '\nconst other = { mod: "other-mod" };\n'), "names another mod"));
test("validate: a changed constant makes RECIPE.md stale", () =>
  failsWith("validate.mjs", (d) => sub(d, MAIN, "const POLL_MS = 3000", "const POLL_MS = 2000"), "different value"));
test("validate: a removed RECIPE section fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "RECIPE.md", "## Watch out", "## Be careful"), "Watch out"));
test("validate: a key with cmd fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "keys.json", '"global": { "ctrl-shift-a"', '"global": { "cmd-shift-a"'), "not portable"));
test("validate: an unknown keys.json section fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "keys.json", '"terminal"', '"sidebar"'), "section"));
test("validate: a key opening a mod that is not shipped fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "keys.json", '"global": { "ctrl-shift-a": "mod.open:attention-picker" }', '"global": { "ctrl-shift-a": "mod.open:other-mod" }'), "other-mod"));
test("validate: an invalid mod.json value fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "mods/attention-picker/mod.json", '"dialog"', '"dialg"'), "overlay.kind"));
test("validate: invalid JSON fails", () =>
  failsWith("validate.mjs", (d) => append(d, "keys.json", "{ not json"), "invalid JSON"));
test("validate: CRLF line endings fail", () =>
  failsWith("validate.mjs", (d) => wr(d, "NOTICE", rd(d, "NOTICE").replace(/\n/g, "\r\n")), "CRLF"));
test("validate: a committed file Herdr writes fails", () =>
  failsWith("validate.mjs", (d) => wr(d, "mods/attention-picker/gpui-kit.d.ts", "// generated\n"), "written by Herdr"));
test("validate: a preview of the wrong size fails", () =>
  failsWith("validate.mjs", (d) => { const b = readFileSync(path(d, "preview.png")); b.writeUInt32BE(900, 16); writeFileSync(path(d, "preview.png"), b); }, "expected 1100x705"));
test("validate: a licence with the template placeholder fails", () =>
  failsWith("validate.mjs", (d) => append(d, "LICENSE", "\nCopyright [yyyy] [name of copyright owner]\n"), "placeholder"));
test("validate: an SVG with a script fails", () =>
  failsWith("validate.mjs", (d) => sub(d, "mods/attention-picker/search.svg", "<svg", "<svg><script>1</script"), "script"));
test("validate: package.json must name the licence", () =>
  failsWith("validate.mjs", (d) => sub(d, "package.json", '"Apache-2.0"', '"MIT"'), "package.json"));

// RECIPE claims written from the code
const LOGIC = "mods/attention-picker/logic.js";
test("validate: RECIPE row heights follow main.js", () =>
  failsWith("validate.mjs", (d) => sub(d, MAIN, "waiting: 46", "waiting: 50"), 'RECIPE.md "row heights"'));
test("validate: RECIPE key hint follows main.js", () =>
  failsWith("validate.mjs", (d) => sub(d, MAIN, "↑↓ choose · Enter go · Tab sort · Esc", "↑↓ pick · Enter go · Tab sort · Esc"), 'RECIPE.md "key hint"'));
test("validate: RECIPE search placeholder follows main.js", () =>
  failsWith("validate.mjs", (d) => sub(d, MAIN, 'placeholder: "Search agents, spaces, programs…"', 'placeholder: "Find"'), 'RECIPE.md "search placeholder"'));
test("validate: RECIPE sort labels follow main.js", () =>
  failsWith("validate.mjs", (d) => sub(d, MAIN, 'space: "Space order"', 'space: "By space"'), 'RECIPE.md "sort labels"'));
test("validate: RECIPE empty-state strings follow logic.js", () =>
  failsWith("validate.mjs", (d) => sub(d, LOGIC, 'body: "Start one and it will show here"', 'body: "Start one"'), 'RECIPE.md "empty-state strings"'));
test("validate: RECIPE stored-entry cap follows logic.js", () =>
  failsWith("validate.mjs", (d) => sub(d, LOGIC, "const MAX_SEEN = 500", "const MAX_SEEN = 100"), 'RECIPE.md "stored entries"'));
test("validate: RECIPE preview length follows ask.js", () =>
  failsWith("validate.mjs", (d) => sub(d, "mods/attention-picker/ask.js", "MAX_LEN = 200", "MAX_LEN = 120"), 'RECIPE.md "longest preview"'));
test("validate: a reworded RECIPE claim is reported, not skipped", () =>
  failsWith("validate.mjs", (d) => sub(d, "RECIPE.md", "turning every 900ms", "turning slowly"), 'the sentence for "spinner period"'));

// ====================================================================================== privacy-scan
test("privacy-scan: the repository itself passes", () => passes("privacy-scan.mjs"));
test("privacy-scan: a macOS home path in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\nsee ${MAC_HOME}\n`), "home-path-mac"));
test("privacy-scan: a Linux home path in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\nsee ${LINUX_HOME}\n`), "home-path-linux"));
test("privacy-scan: a Windows home path in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\nsee ${WIN_HOME}\n`), "home-path-windows"));
test("privacy-scan: an e-mail address in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\nwrite to ${REAL_MAIL}\n`), "email"));
test("privacy-scan: a GitHub token in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\n${"ghp"}_${"a1B2".repeat(8)}\n`), "token"));
test("privacy-scan: a local hostname in a file fails", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", `\nssh ${["studio-mac", "local"].join(".")}\n`), "hostname"));
test("privacy-scan: PRIVACY_EXTRA words fail", () =>
  failsWith("privacy-scan.mjs", (d) => append(d, "NOTICE", "\nmade at Initech\n"), "PRIVACY_EXTRA", { env: { PRIVACY_EXTRA: "initech" } }));
test("privacy-scan: the copyright holder's name outside LICENSE fails", () =>
  failsWith("privacy-scan.mjs", (d) => {
    const holder = /^\s*Copyright\s+(?:\(c\)\s+)?\d{4}\s+(.+?)\s*$/m.exec(rd(d, "LICENSE"))[1];
    append(d, "NOTICE", `\nby ${holder}\n`);
  }, "copyright holder"));
test("privacy-scan: an invalid PRIVACY_AUTHORS value is refused", () =>
  withCopy((d) => { const r = run("privacy-scan.mjs", d, { env: { PRIVACY_AUTHORS: "maybe" } }); assert.equal(r.status, 2); assert.match(r.out, /PRIVACY_AUTHORS/); }));

test("privacy-scan: a PNG text chunk with a home path fails", () =>
  failsWith("privacy-scan.mjs", (d) => pngWith(d, textChunk("Title", MAC_HOME)), 'PNG text chunk "Title"'));
test("privacy-scan: a PNG Software chunk is allowed", () =>
  passes("privacy-scan.mjs", (d) => pngWith(d, textChunk("Software", "rsvg-convert 2.58"))));
test("privacy-scan: a PNG Software chunk holding a home path still fails", () =>
  failsWith("privacy-scan.mjs", (d) => pngWith(d, textChunk("Software", MAC_HOME)), "home-path-mac"));
test("privacy-scan: a compressed PNG text chunk is read", () =>
  failsWith("privacy-scan.mjs", (d) => pngWith(d, chunk("zTXt", Buffer.concat([Buffer.from("Comment\0\0", "latin1"), deflateSync(Buffer.from(LINUX_HOME))]))), 'PNG text chunk "Comment"'));
test("privacy-scan: PNG EXIF data fails", () =>
  failsWith("privacy-scan.mjs", (d) => pngWith(d, chunk("eXIf", Buffer.from("II*\0"))), "eXIf"));

// Git cases: the history is scanned too.
test("privacy-scan: a clean git history passes", () => passes("privacy-scan.mjs", (d) => gitCommit(d, "Initial import")));
test("privacy-scan: GitHub's web-merge committer is allowed", () =>
  passes("privacy-scan.mjs", (d) => gitCommit(d, "Merge pull request #1", { GIT_COMMITTER_EMAIL: at("noreply", "github.com"), GIT_COMMITTER_NAME: "GitHub" })));
test("privacy-scan: a Dependabot sign-off is allowed", () =>
  passes("privacy-scan.mjs", (d) => gitCommit(d, `Bump actions/checkout from 6 to 7\n\nSigned-off-by: dependabot[bot] <${at("support", "github.com")}>`)));
test("privacy-scan: a real e-mail in a commit message fails", () =>
  failsWith("privacy-scan.mjs", (d) => gitCommit(d, `Fix\n\nreported by ${REAL_MAIL}`), "email"));
test("privacy-scan: a human Co-Authored-By fails", () =>
  failsWith("privacy-scan.mjs", (d) => gitCommit(d, "Fix\n\nCo-Authored-By: Someone Else <no-address>"), "Co-Authored-By"));
test("privacy-scan: a real author e-mail fails by default", () =>
  failsWith("privacy-scan.mjs", (d) => gitCommit(d, "Initial import", { GIT_AUTHOR_EMAIL: REAL_MAIL, GIT_COMMITTER_EMAIL: REAL_MAIL }), "author e-mail"));
test("privacy-scan: a real author e-mail passes with PRIVACY_AUTHORS=skip", () =>
  passes("privacy-scan.mjs", (d) => gitCommit(d, "Initial import", { GIT_AUTHOR_EMAIL: REAL_MAIL, GIT_COMMITTER_EMAIL: REAL_MAIL }), { env: { PRIVACY_AUTHORS: "skip" } }));
test("privacy-scan: skip does not excuse the same address in a file", () =>
  failsWith("privacy-scan.mjs", (d) => { append(d, "NOTICE", `\nwrite to ${REAL_MAIL}\n`); gitCommit(d, "Initial import"); }, "email", { env: { PRIVACY_AUTHORS: "skip" } }));
test("privacy-scan: skip does not excuse a home path in a commit message", () =>
  failsWith("privacy-scan.mjs", (d) => gitCommit(d, `Notes from ${MAC_HOME}`), "home-path-mac", { env: { PRIVACY_AUTHORS: "skip" } }));
test("privacy-scan: a leak that was added and removed is still found in history", () =>
  failsWith("privacy-scan.mjs", (d) => {
    append(d, "NOTICE", `\nsee ${MAC_HOME}\n`);
    gitCommit(d, "Add a note");
    sub(d, "NOTICE", `\nsee ${MAC_HOME}\n`, "");
    gitCommit(d, "Remove the note");
  }, "history"));
test("privacy-scan: a PNG text chunk that was committed and replaced is found in history", () =>
  failsWith("privacy-scan.mjs", (d) => {
    const clean = readFileSync(path(d, "preview.png"));
    pngWith(d, textChunk("Title", "leak"));
    gitCommit(d, "Add a screenshot");
    writeFileSync(path(d, "preview.png"), clean);
    gitCommit(d, "Replace the screenshot");
  }, "history"));

// ================================================================================== verify-install
// An installed copy: <home>/mods/attention-picker plus <home>/keys.json (the repository's own).
function withInstall(body, folder = "attention-picker") {
  return withCopy(async (repo) => {
    const home = mkdtempSync(join(tmpdir(), "hc-home-"));
    try {
      const modDir = join(home, "mods", folder);
      mkdirSync(modDir, { recursive: true });
      for (const f of FILES.filter((f) => f.startsWith("mods/attention-picker/"))) copyFileSync(join(REPO, ...f.split("/")), join(modDir, f.split("/").pop()));
      copyFileSync(join(REPO, "keys.json"), join(home, "keys.json"));
      return await body({ home, modDir });
    } finally { rmSync(home, { recursive: true, force: true }); }
  });
}
function verify(args, env = {}) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, "verify-install.mjs"), ...args], { encoding: "utf8", env: { ...process.env, HERDR_APP_HOME: "", ...env } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
test("verify-install: a clean install with the key bound passes", () =>
  withInstall(({ home, modDir }) => {
    const r = verify([modDir, "--home", home]);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /opens attention-picker/);
    assert.match(r.out, /reaches: network no; programs hc read only/);
  }));
test("verify-install: HERDR_APP_HOME works instead of --home", () =>
  withInstall(({ home, modDir }) => { const r = verify([modDir], { HERDR_APP_HOME: home }); assert.equal(r.status, 0, r.out); }));
test("verify-install: the repository's mod folder passes without a home", () => {
  const r = verify([join(REPO, "mods", "attention-picker")]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /keys.json not checked/);
});
test("verify-install: no folder given is a usage error", () => { assert.equal(verify([]).status, 2); });
test("verify-install: a renamed folder fails (HOME no longer matches)", () =>
  withInstall(({ home, modDir }) => {
    const r = verify([modDir, "--home", home]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /called "renamed" but main\.js expects "mods\/attention-picker"/);
  }, "renamed"));
test("verify-install: a missing icon fails", () =>
  withInstall(({ home, modDir }) => {
    rmSync(join(modDir, "spinner.svg"));
    const r = verify([modDir, "--home", home]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /spinner\.svg does not exist/);
  }));
test("verify-install: a key that opens another mod fails", () =>
  withInstall(({ home, modDir }) => {
    writeFileSync(join(home, "keys.json"), JSON.stringify({ global: { "ctrl-shift-a": "mod.open:something-else" } }));
    const r = verify([modDir, "--home", home]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /no key whose action is "mod\.open:attention-picker"/);
  }));
test("verify-install: a missing keys.json fails when a home is given", () =>
  withInstall(({ home, modDir }) => {
    rmSync(join(home, "keys.json"));
    const r = verify([modDir, "--home", home]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /does not exist: no key opens the mod/);
  }));
test("verify-install: a folder that is not <home>/mods/<name> fails", () =>
  withInstall(({ home, modDir }) => {
    const r = verify([modDir, "--home", join(home, "mods")]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /Herdr loads mods from <home>\/mods\/<name>/);
  }));
test("verify-install: a broken mod.json that herdr-app check would pass fails", () =>
  withInstall(({ modDir }) => {
    writeFileSync(join(modDir, "mod.json"), '{ "place": "none", "overlay": { "kind": "dialg", "width": "640" } }');
    const r = verify([modDir]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /overlay\.kind/);
    assert.match(r.out, /overlay\.width must be a number/);
  }));
test("verify-install: a forbidden import in the installed code fails", () =>
  withInstall(({ modDir }) => {
    writeFileSync(join(modDir, "main.js"), readFileSync(join(modDir, "main.js"), "utf8") + '\nimport { exec as sh } from "herdr";\n');
    const r = verify([modDir]);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /"exec" from "herdr"/);
  }));
test("verify-install: Herdr's own generated files are ignored", () =>
  withInstall(({ modDir }) => {
    writeFileSync(join(modDir, "gpui-kit.d.ts"), "export declare const x: number;\n");
    writeFileSync(join(modDir, "jsconfig.json"), "{}\n");
    assert.equal(verify([modDir]).status, 0);
  }));

// ====================================================================================== check-docs
// A small synthetic site, so these cases test the rules and do not depend on what the documentation says today.
const PAGES = ["index", "install", "usage", "configuration", "how-it-works", "troubleshooting"];
const CONSTS = { HOME: '"mods/attention-picker"', POLL_MS: "3000", READ_LINES: "60", READ_CONCURRENCY: "4", SEEN_KEY: '"attention.seen"', HOME_SPACE_NAME: '"~"', LIST_H: "320" };
function page(name, body, { nav = PAGES, current = name } = {}) {
  const li = nav.map((p) => `<li><a href="${p}.html"${p === current ? ' aria-current="page"' : ""}>${p}</a></li>`).join("");
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${name}</title></head>\n<body><nav class="site"><ul>${li}</ul></nav><main><h1 id="top">${name}</h1>\n${body}\n</main></body></html>\n`;
}
function docsFixture() {
  const dir = mkdtempSync(join(tmpdir(), "hc-docs-"));
  const w = (rel, text) => wr(dir, rel, text);
  w("mods/attention-picker/main.js", Object.entries(CONSTS).map(([k, v]) => `const ${k} = ${v};`).join("\n") + "\n");
  const rows = Object.entries(CONSTS).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${v.replace(/"/g, "")}</td></tr>`).join("");
  const bodies = {
    configuration: `<div class="table-wrap" tabindex="0" role="region" aria-label="Constants"><table><thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    "how-it-works": '<p>It runs <code>hc read &lt;address&gt; --lines 60</code> every 3 seconds, at most 4 at a time.</p>',
  };
  for (const p of PAGES) w(`docs/${p}.html`, page(p, bodies[p] ?? "<p>Text.</p>"));
  w("docs/404.html", page("404", "<p>Not found. <a href=\"index.html\">Home</a></p>", { nav: ["index"], current: "" }));
  w("docs/.nojekyll", "");
  w("README.md", "# Fixture\n\nRuns `hc read --lines 60` every 3 seconds, at most 4 at a time. See [usage](docs/usage.html#top).\n");
  const png = readFileSync(join(REPO, "preview.png"));
  mkdirSync(join(dir, "docs", "assets"), { recursive: true });
  writeFileSync(join(dir, "preview.png"), png);
  writeFileSync(join(dir, "docs", "assets", "preview.png"), png);
  return dir;
}
async function withDocs(mutate, expectFragment) {
  const dir = docsFixture();
  try {
    await mutate?.(dir);
    const r = run("check-docs.mjs", dir);
    if (expectFragment === undefined) assert.equal(r.status, 0, `check-docs should pass:\n${r.out}`);
    else { assert.equal(r.status, 1, `check-docs should fail:\n${r.out}`); assert.ok(r.out.includes(expectFragment), `expected "${expectFragment}" in:\n${r.out}`); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const pageEdit = (p, from, to) => (d) => sub(d, `docs/${p}.html`, from, to);

test("check-docs: the fixture site passes", () => withDocs());
test("check-docs: a stale --lines number in the README fails", () => withDocs((d) => sub(d, "README.md", "--lines 60", "--lines 50"), "README.md: says \"--lines 50\""));
test("check-docs: a stale poll interval in a page fails", () => withDocs(pageEdit("how-it-works", "every 3 seconds", "every 2 seconds"), "docs/how-it-works.html: says \"every 2 seconds\""));
test("check-docs: a stale concurrency number fails", () => withDocs(pageEdit("how-it-works", "at most 4 at a time", "at most 5 at a time"), "at most 5 at a time"));
test("check-docs: a stale 'lines of history' number fails", () => withDocs((d) => append(d, "README.md", "\nThe screen plus 40 lines of history.\n"), "40 lines of history"));
test("check-docs: a stale list height fails", () => withDocs((d) => append(d, "README.md", "\nThe list is at most 300 px tall.\n"), "300 px"));
test("check-docs: another tick is allowed only if the code has it", async () => {
  await withDocs((d) => append(d, "README.md", "\nIt sorts again every 30 seconds.\n"), "every 30 seconds");
  await withDocs((d) => { append(d, "README.md", "\nIt sorts again every 30 seconds.\n"); append(d, "mods/attention-picker/main.js", "const TICK_MS = 30_000;\n"); });
});
test("check-docs: a changed constant makes the configuration page stale", () => withDocs((d) => sub(d, "mods/attention-picker/main.js", "const POLL_MS = 3000;", "const POLL_MS = 2000;"), "the POLL_MS row does not show the value"));
test("check-docs: a constant without a table row fails", () => withDocs(pageEdit("configuration", "<tr><td><code>LIST_H</code></td><td>320</td></tr>", ""), "no table row for LIST_H"));
test("check-docs: a string constant must show its value", () => withDocs(pageEdit("configuration", "attention.seen", "attention.saw"), "the SEEN_KEY row"));

test("check-docs: a page with a different navigation fails", () => withDocs(pageEdit("usage", '<li><a href="install.html">install</a></li>', ""), "every page must show the same pages"));
test("check-docs: aria-current on the wrong page fails", () => withDocs(pageEdit("usage", ' aria-current="page"', ""), "0 navigation items have aria-current").then(() =>
  withDocs(pageEdit("usage", '<li><a href="install.html">', '<li><a href="install.html" aria-current="page">'), "2 navigation items have aria-current")));
test("check-docs: 404.html is exempt from the navigation set", () => withDocs());
test("check-docs: a .table-wrap without tabindex fails", () => withDocs(pageEdit("configuration", ' tabindex="0" role="region"', ' role="region"'), "no tabindex"));
test("check-docs: a <th> without scope fails", () => withDocs(pageEdit("configuration", '<th scope="col">Name</th>', "<th>Name</th>"), "a <th> has no scope"));
test("check-docs: a long <pre> without tabindex fails", () => withDocs((d) => sub(d, "docs/usage.html", "<p>Text.</p>", `<pre>${"x".repeat(90)}</pre>`), "long <pre>"));
test("check-docs: a broken link fails", () => withDocs(pageEdit("usage", "<p>Text.</p>", '<p><a href="nowhere.html">x</a></p>'), 'broken link "nowhere.html"'));
test("check-docs: a link to a missing anchor fails", () => withDocs((d) => sub(d, "README.md", "usage.html#top", "usage.html#missing"), "heading/id that does not exist"));
test("check-docs: a page that loads another origin fails", () => withDocs(pageEdit("usage", "</head>", '<link rel="stylesheet" href="https://cdn.example.invalid/x.css"></head>'), "external origin"));
test("check-docs: a page without lang fails", () => withDocs(pageEdit("usage", '<html lang="en">', "<html>"), "has no lang"));
const COPY_JS = 'for (const b of document.querySelectorAll("button[data-copy]")) b.hidden = false;\n';
test("check-docs: a page may load the site's own script", () => withDocs((d) => { wr(d, "docs/assets/copy.js", COPY_JS); sub(d, "docs/usage.html", "</main>", '</main><script src="assets/copy.js"></script>'); }));
test("check-docs: the repository's own docs/assets/copy.js passes the script rule", () => withDocs((d) => wr(d, "docs/assets/copy.js", readFileSync(join(REPO, "docs", "assets", "copy.js"), "utf8"))));
test("check-docs: a page with an inline script fails", () => withDocs(pageEdit("usage", "</head>", "<script>alert(1)</script></head>"), "inline <script>"));
test("check-docs: a page loading a script from another host fails", () => withDocs(pageEdit("usage", "</head>", '<script src="https://cdn.example.invalid/x.js"></script></head>'), "must be an existing file in docs/assets/"));
test("check-docs: a page loading a missing site script fails", () => withDocs(pageEdit("usage", "</head>", '<script src="assets/missing.js"></script></head>'), "must be an existing file in docs/assets/"));
test("check-docs: a site script that reaches the network fails", () => withDocs((d) => wr(d, "docs/assets/copy.js", COPY_JS + "fetch('x.json');\n"), "may not reach the network"));
test("check-docs: a site script that stores something fails", () => withDocs((d) => wr(d, "docs/assets/copy.js", COPY_JS + "localStorage.setItem('a', '1');\n"), "may not reach the network"));
test("check-docs: a stale docs/assets/preview.png fails", () => withDocs((d) => writeFileSync(path(d, "docs/assets/preview.png"), Buffer.from("not the same")), "differs from preview.png"));
