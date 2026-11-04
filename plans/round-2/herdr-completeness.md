# Round 2 audit: herdr-completeness

Base: `feat/round-1-standalone-picker` (head b7fcb3f). Role: sharing format, cross-platform, privacy, licensing, CI.
Scope of this file: findings and proposals only; no repo file other than this one was changed.

## Summary

Round 1 delivered everything Herdr's sharing format asks for: `mods/attention-picker/` plus `keys.json`, a
six-section `RECIPE.md`, `preview.png` (1100x705, labelled an illustration), Apache-2.0 `LICENSE` (the text is byte-equal
to GitHub's canonical text apart from the copyright line), a truthful `NOTICE`, and four zero-dependency check scripts.
Compared with the herdrdev examples and the community mod repos (same top level: `mods/`, `RECIPE.md`,
`preview.png`, optional `keys.json`), the layout is right. The topic to add at publish time stays `herdr-mod` (the
author adds it; checklist step 2).

What I re-ran on the base branch: `herdr-app check` passes; `validate`, `privacy-scan` and `check-docs` pass; `node --test`
gives 61 passing tests on Node 26.5 **and on Node 22.14** (the CI version, tried for the first time; round 1 never ran
22). `node --test tests/` fails on 22.14 as well, so the `npm test` decision stands.

Adversarial review of what round 1 shipped found that the safety net is weaker than its documentation says:

1. The privacy scan will turn **red on the first GitHub web merge, the first Dependabot PR and the first outside
   contributor PR** (reproduced in a scratch repo). That is the publish moment.
2. **No CI exists in the repo**, yet README, docs, AGENTS, CONTRIBUTING, CHANGELOG and RECIPE all say CI runs on three
   operating systems. Nothing backs that sentence.
3. The "this mod promises no network, exec or file access" check is **bypassable by an alias** and does not look at what
   `run()` and `hc()` are asked to do (reproduced: validate says `ok`).
4. **None of the scripts has a committed test**; round 1's negative tests lived in scratch copies.
5. `herdr-app check` proves less than the docs imply (reproduced: it passes a broken `mod.json` and a renamed folder
   whose `HOME` is wrong).
6. RECIPE.md does not carry enough to rebuild the mod from an empty folder (name rule, data fields, fold condition),
   and only 4 of its numbers are tied to the code.

Hard constraint kept in all proposals: the GitHub token has no `workflow` scope, so nothing under `.github/workflows/`
is created. CI is delivered as `scripts/ci.workflow.yml` (HC-2-2).

Verification notes and the scratch method are at the end. Ownership: HC = herdr-completeness (RECIPE.md,
preview.png, mod.json, keys.json, LICENSE, NOTICE, .gitignore, .github/, scripts/), CR = code-review (.js, assets,
tests, package.json), DOC = documentation (README, docs/, AGENTS.md, llms.txt, CHANGELOG, CONTRIBUTING).

---

## Findings (most impact first)

### HC-2-1 (high): the privacy scan fails on GitHub-made commits, Dependabot and outside contributors

- **Evidence.** `scripts/privacy-scan.mjs:18` allows only `@users.noreply.github.com`, the Claude address and the
  `git@` host. `:90-92` fails any author or committer e-mail outside that list; `:97-99` and the `email` rule (`:29`)
  fail any e-mail in a message body.
  - A merge, squash or "Update branch" done with GitHub's web button has the committer e-mail
    `noreply` at `github.com` (not the `users.noreply` form): fails at `:91`.
  - Dependabot commit bodies end with `Signed-off-by: dependabot[bot] <support at github.com>`: fails at the `email` rule.
    `.github/dependabot.yml` (which round 1 added) will open such PRs weekly.
  - The synthetic merge commit Actions checks out for a `pull_request` event, and any outside contributor's own
    commits (their real e-mail), fail too.
  - Reproduced: scratch repo with one commit using the web-flow committer and a Dependabot-style trailer gives
    `privacy-scan: FAILED (2)`: "committer e-mail is not a no-reply address" and "email: <the support address>".
- **Change (HC).**
  1. Add to `ALLOWED_MAIL` the two GitHub addresses (web-flow committer, support) and `...[bot]@users.noreply.github.com`
     is already covered. Write them in the script as regexes, never as literal e-mails in a doc.
  2. Add `--history <all|none|own>` (default `all`) or env `PRIVACY_AUTHORS=skip`. The workflow passes
     `skip` on `pull_request` events: outside people's author e-mails are theirs and public in git, so the PR gate keeps
     scanning every added line and every message, and only the owner-controlled `push` to `main` runs the full
     author/committer check. Message bodies and added lines are still scanned in every mode.
  3. Keep failing on a human `Co-Authored-By` unless the address is a GitHub no-reply or the Claude one.
- **Verify.** New cases in the script tests (HC-2-4): web-flow committer passes, Dependabot trailer passes, a real
  address in a message still fails, a real author address fails under `all` and passes under `skip` while the same
  address in a file still fails.

### HC-2-2 (high): the CI that every document cites is not in the repo

- **Evidence.** No `.github/workflows/` on the branch; the finished file lives only on the local branch
  `feat/round-1-standalone-picker--herdr-completeness-ci` (never pushed). Claims that depend on it: `README.md:107`,
  `docs/install.html:34`, `AGENTS.md:74`, `AGENTS.md:156`, `CONTRIBUTING.md:28`, `CHANGELOG.md:28`, `CHANGELOG.md:57`,
  `RECIPE.md:86`. `.github/PUBLISH-CHECKLIST.md` step 0 sends the owner to that local branch, which a fresh clone
  does not have. `validate.mjs:41` only warns about the missing file.
- **Change (HC).**
  1. Add `scripts/ci.workflow.yml` (pushable: it is not under `.github/workflows/`), the round 1 file with these
     changes: matrix `os` x `node: [22, 24]` (22 verified locally; 24 is the next LTS line), `persist-credentials: false`
     on checkout, `workflow_dispatch`, the `PRIVACY_AUTHORS=skip` env on `pull_request` (HC-2-1), plus a step
     `node scripts/validate.mjs` first so a broken contract fails fast. `actions/checkout@v7` and
     `actions/setup-node@v7` were checked against the actions' tag lists: both exist.
  2. Rewrite checklist step 0: "copy `scripts/ci.workflow.yml` to `.github/workflows/ci.yml` and push with a login that
     has the `workflow` scope (`gh auth refresh -s workflow`), or paste it in via the GitHub web UI (Add file, no token
     scope needed). Then `gh run list`." Remove the reference to the local-only branch.
  3. `validate.mjs`: lint `scripts/ci.workflow.yml` (and `.github/workflows/ci.yml` when present; the two must be
     byte-equal): the three runner labels, `permissions` with `contents: read` and no write scope, every `uses:` pinned to
     a tag or SHA, every `run:` line names a script or command that exists in the repo. No YAML parser: line matching is
     enough for this file and is stated as such.
  4. New validate rule: if README, docs, AGENTS, CONTRIBUTING or RECIPE contain "CI" and neither workflow file exists,
     fail (today: unbacked claim).
- **Docs follow-up (DOC, after the first three-OS run is green; until then say "the CI definition is
  `scripts/ci.workflow.yml`; it runs once the owner enables it").** Files and lines above. I will post the exact
  sentence on the board.
- **Verify.** `node scripts/validate.mjs` fails on a mutated copy (remove `windows-latest`, add
  `permissions: write-all`, add an unpinned `uses:`, point a `run:` at a missing script). After the owner lands it:
  `gh run list --branch main` shows three green jobs per Node version.

### HC-2-3 (high): the "no network, no exec, no file access" check can be bypassed, and `run()` and `hc()` are unchecked

- **Evidence.** `validate.mjs:142-170` finds capabilities with name regexes on code lines. Reproduced on a scratch copy of
  the tree: adding `import { exec as sh, readTextFile as rd, ... } from "herdr"`, then `sh("curl", ["x"])` and
  `rd(["/etc","passwd"].join("/"))`, still reports `exec 0 places, file access 0 places` and `validate: ok`. Adding
  `run("space.new", { argv: [...] })` (starts any program) and `hc(["send", ...])` (types into a terminal) also stays `ok`:
  the report only counts `hc(` calls and compares with prose. A `globalThis["fet"+"ch"]` alias is invisible too.
  RECIPE.md "What it reaches" and the validate failure messages ("this mod promises none") say more than the check can prove.
- **Change (HC; CR must keep new imports inside the list).** Replace name matching by an allow-list, which cannot be aliased:
  1. Imports from `"herdr"` must be a subset of `agents, spaces, run, hc, theme, settings, shared, setShared, props,
     closeOverlay` (the ten the RECIPE lists). Anything else (`exec`, `readTextFile`, `writeTextFile`, `watchFolder`,
     `pickFolder`, `knownAgents`, `home`, `appHome`, `sendFeedback`, ...) fails with "update RECIPE.md 'What it
     reaches' first, then the list in validate.mjs".
  2. `run(` must have a string literal first argument from `agent.focus`, `overlay.close`.
  3. `hc(` must be called with an array literal whose first element is the literal `"read"`.
  4. Fail on dynamic `import(`, `eval(`, `new Function`, `globalThis[`, `Reflect.get(globalThis`.
  5. Keep the old regexes as a second line; print the capability report from the import list.
  6. RECIPE.md and README say "checked by a script that reads the code (a heuristic, not a sandbox)".
- **Verify.** The scratch mutation above flips to FAILED; the real tree still passes; new script tests (HC-2-4) cover each
  rule. `herdr-app check` is unaffected.

### HC-2-4 (high): no test protects the checks themselves

- **Evidence.** `plans/round-1/herdr-completeness-log.md` "Checks run" lists about twenty negative tests (home paths of
  three OS, e-mail, hostname, token, CRLF, bad link, stale preview ...). They ran in scratch copies and were thrown away.
  `tests/` covers only `logic.js` and `ask.js`. A refactor of a regex in `validate.mjs` or `privacy-scan.mjs` would pass CI
  while the rule is dead (the same failure mode as HC-2-3).
- **Change (HC).** Add `scripts/checks.test.mjs` (the name makes `node --test` and `npm test` pick it up on all three
  OS, so CI needs no new step). Each case copies the tracked files into `os.tmpdir()`, applies one mutation, runs the
  script with `--root <copy>` through `process.execPath`, and asserts exit code 1 plus a message fragment; one case per
  rule: three home-path styles, e-mail in a file / in a message, web-flow committer allowed, Dependabot trailer allowed,
  hostname, token, extra word, holder name outside LICENSE, history leak added then removed, CRLF, `cmd-` key, unknown
  keys section, missing `mod.open` target, RECIPE number drift, each HC-2-3 rule, broken link, bad anchor, external
  `<link>`, stale `docs/assets/preview.png`, PNG text chunk (HC-2-8). Git cases use `git init` with `-c user.name=... -c
  user.email=<id>+dev@users.noreply.github.com` so no global config is read. Paths through `node:path`; no shell.
  Budget: 25 cases, a few seconds.
- **Owner note.** `scripts/**` is mine, so no change in `tests/` is needed. CR: do not add a `test` script path that
  excludes `scripts/`.
- **Verify.** `node --test` shows the new cases; temporarily disabling any rule in a script makes its case fail (I run
  that once by hand for three rules and log it).

### HC-2-5 (medium): RECIPE numbers are tied to the code for 4 constants only

- **Evidence.** `validate.mjs:204-212` compares `POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, `LIST_H`. Everything else
  RECIPE.md quotes is unchecked, e.g. row heights 29/32/46/17/35 (`main.js:38`, RECIPE.md "What you see"), width 640
  (`mod.json`), 900 ms spinner (`main.js:151`), `attention.seen` (`main.js:34`), `MAX_LEN` 200 and the markers
  (`ask.js:9-11`), the key hint string and placeholder (`main.js:79,165`), the sort labels (`main.js:39`), the
  empty-state strings (`logic.js:219-221`), 500 stored entries (`logic.js:108`), the 24 h fold (`logic.js:6`).
  Round 1's own summary says docs claims must "come from the code"; only a fifth do mechanically.
- **Change (HC).** Add a `CLAIMS` table to `validate.mjs`: `[ "what RECIPE says" (regex with a capture), file, regex with a capture ]`,
  compared as strings or numbers, about 20 rows covering the list above. A missing capture on either side fails with the
  claim's name. Same table feeds the AGENTS.md "claim to source map" later (DOC may reuse the names).
- **Verify.** Changing `H.waiting` or the hint text in a scratch copy fails validate; real tree passes.

### HC-2-6 (medium): RECIPE.md cannot rebuild the same mod from an empty folder

- **Evidence (RECIPE.md "Built from" and "How it behaves" versus the code).** Missing or vague:
  - **The agent's name.** RECIPE says "the agent's name"; `logic.js:40-47` derives it: its title unless the title looks like
    a path (`/..`, `~..`, `C:\..`, `\\..`), contains `@`, or equals the program name; else a named, non-numeric tab; else the
    program name, else the app, else "agent".
  - **Data read.** Not listed: `agents()` fields `address, status, space, space_name, tab, tab_name, title, program.name,
    app, focused, seq`; `spaces()` with each space's `tabs[]` (`id`, `changed_at`, `working_since`); the rule that a
    tab time below 1e11 is seconds and is scaled (`logic.js:90`); that times are capped at now.
  - **Order of the waiting rows**: by status (blocked, done), then `seq` ascending (lower = changed longer ago), then list
    order (`logic.js:177`), not by the displayed time.
  - **Fold**: needs a known status time (`logic.js:189`, `r.since &&`); RECIPE says only "idle for over 24 hours".
  - **Search text**: name, program, space, tab, title, status word and status name (`logic.js:173`).
  - **Preview**: only the last 40 non-empty lines of what `hc read` returns are used, box-drawing characters and ANSI
    escapes are stripped, question detection ignores a leading selection mark and number (`ask.js:25-34`).
  - **Local record**: capped at 500 entries (`logic.js:108`).
  - "Done when" last bullet needs a layout that passes `props.search`; a fresh builder cannot do that standalone.
- **Change (HC).** Add these to RECIPE.md "Built from" (a short "Data it reads" list and the name rule) and "How it
  behaves"; reword the last "Done when" bullet as "verified by the unit tests of `pickSearch`" or drop it. Restructure
  "Watch out: What it reaches" into a six-row table (network: none; programs: `hc read` only; terminal input: none;
  files: none outside its own folder; storage: `localStorage` `attention.seen`; shared keys: read two, read and write one)
  so an installer's warning is one glance. Keep the wording the README uses. Add the `1e11` and `seq` facts to the
  CLAIMS table of HC-2-5 where cheap.
- **Verify.** `check-docs` and `validate` still pass; an agent with only RECIPE.md (I run one dry read-through against
  the code and log each remaining gap).

### HC-2-7 (medium): `herdr-app check` proves less than three documents say

- **Evidence.** Reproduced on scratch copies of the mod with `herdr-app check`: a `mod.json` with `"kind": "dialg"`,
  `"width": "640"`, and with unknown fields (`version`, `bogus`) all print "check passed"; the same mod copied under another
  folder name (so `HOME` and the `mod.open:` key are wrong and both icons would silently not load) passes too. RECIPE.md
  "Done when" bullet 1, README step 4 and AGENTS.md step 5 present the command as the install verification.
- **Change (HC).** Add `scripts/verify-install.mjs <installed mod folder> [--home <app home>]` (pure Node, read-only,
  no network): checks that the folder name equals the basename of `HOME` in `main.js`, every `svg("${HOME}/..."))` target
  exists, `mod.json` is valid by the same rules as validate, no foreign `mods/<other>/` reference, and, when a home is
  given or `HERDR_APP_HOME` is set, that its `keys.json` has a key whose action is `mod.open:<folder>`. It prints the
  disclosure lines (what it reaches). The default home is the documented `~/.config/herdr-app`; the script takes
  `--home` because Windows and Linux paths are unverified. Reference it in RECIPE "Done when" and checklist step 3.
  mod.json decision for SUMMARY item 6: **no `version` field** (Herdr documents none; the check ignores it; a
  listed repo's version is its git tag). Recorded here so it is not reopened.
- **DOC follow-up.** README / docs install step: "then `node scripts/verify-install.mjs <folder>`; `herdr-app check`
  only proves the code loads". Also say that Herdr's home can be changed with `HERDR_APP_HOME` (`herdr-app --help`).
- **Verify.** Script tests: renamed folder fails, missing icon fails, key to another mod fails, a clean install passes.

### HC-2-8 (medium): binary files are never scanned; the real screenshot is the riskiest file

- **Evidence.** `privacy-scan.mjs:75` skips every binary file; `validate.mjs:112-120` only reads the PNG size.
  Reproduced: a scratch `preview.png` with a text chunk that holds a home path gives `privacy-scan: ok` and `validate: ok`.
  The checklist asks the author to replace the illustration with a real screenshot of their own window; screenshot tools
  can write a title, a source path or a profile name into the file.
- **Change (HC).**
  1. `privacy-scan.mjs`: walk PNG chunks (`tEXt`, `zTXt`, `iTXt`, `eXIf`, `tIME` allowed); any text chunk is scanned with
     the same rules, and any text chunk other than `Software` fails with its keyword.
  2. `.gitignore`: add `herdr-shot*.png` (the default file name of `herdr-app shot`) and `.claude/`.
  3. `NOTICE` and `scripts/preview/render.sh`: the SVG asks for Geist, then system fonts; record which font the shipped PNG
     was rendered with, or render with one open-licence font (SIL OFL fonts need no attribution inside an image) so the
     claim "third-party assets: none" is exact. The mock also draws macOS window dots; move them out of the frame so
     the illustration is not macOS-specific. Light-theme variant: skip (the real screenshot replaces it).
  4. Checklist: add "run `node scripts/privacy-scan.mjs` after dropping in the screenshot; open it and read every word
     in it", and "the screenshot must come from a Herdr home with invented space and agent names".
- **Verify.** Script tests (HC-2-4): a PNG with a text chunk holding a home path fails; the shipped PNG passes.

### HC-2-9 (medium): the publish checklist needs the round-2 reality

- **Evidence.** `.github/PUBLISH-CHECKLIST.md`: step 0 depends on a local-only branch (HC-2-2). Not mentioned anywhere:
  - 22 commits carry `Claude-Session: https://...` trailers and `plans/` holds round logs: both become public with the
    repo. Neither contains personal data (the scan passes) but the owner should choose: keep, or publish from a
    squashed fresh repository (the checklist already offers that for the author-name question).
  - The checklist says "Pages" without noting that Pages on a private repository needs a paid plan.
  - There is no step for opening `herdr-app check` and `verify-install` on a second OS.
  - `PRIVACY_EXTRA` is a repository secret but the scan prints `not set` and still exits 0: an owner who forgets the secret
    gets a green check that means less. The workflow should print a `::notice::` when the secret is empty on `push`.
- **Change (HC).** Update the checklist (step 0 per HC-2-2; add the session-trailer and `plans/` decision, the Pages plan note,
  the second-OS install test with `verify-install.mjs`, the `PRIVACY_EXTRA` notice step). Add `.github/ISSUE_TEMPLATE/bug_report.yml`
  (fields: OS, Herdr version from `herdr-app --version`, what happened, "no terminal text of real agents, please";
  README and docs already ask users for OS and version) and `.github/PULL_REQUEST_TEMPLATE.md` (the `node scripts/check-local.mjs`
  line). Both are pushable (not workflows). No labels or settings touched.
- **Verify.** `check-docs` link rule still passes (the checklist links nothing outside the repo); issue form is valid
  YAML by eye (no parser installed; stated).

### HC-2-10 (medium): numbers quoted in README, docs and AGENTS.md are not tied to `main.js`

- **Evidence.** `README.md:113-114` ("every 3 seconds", "--lines 60", "60 lines of history"), `docs/how-it-works.html:37,42`,
  `docs/usage.html:72`, `docs/index.html:54`, `AGENTS.md:36-37`. `validate.mjs:204-212` and `check-docs.mjs` check none of them.
  They are right today; the next constant change makes them wrong silently.
- **Change (HC).** `check-docs.mjs`: extract `--lines <n>`, `<n> seconds`/`<n> s`, `at most <n>` and `<n> lines of
  history` from README, docs/*.html, AGENTS.md, llms.txt and compare them with `READ_LINES` (60), `POLL_MS / 1000` (3),
  `READ_CONCURRENCY` (4). The files stay DOC's: a mismatch is posted to DOC, never edited by me.
- **Verify.** Script test: change "3 seconds" to "2 seconds" in a copy of README: check-docs fails.

### HC-2-11 (medium): the licence does not travel with a copied mod folder

- **Evidence.** Installers and the portrait layout copy only `mods/attention-picker/`. Apache-2.0 section 4 asks a
  redistributor to give recipients a copy of the licence and to keep notices; the three `.js` files carry no licence or
  copyright notice, and the portrait repo bundles them. No `license` in `package.json`.
- **Change.** CR (owns `.js` and `package.json`): add two comment lines at the top of `main.js`, `logic.js`, `ask.js`:
  `// SPDX-License-Identifier: Apache-2.0` and `// Copyright 2026 the herdr-agents-waiting authors; licence: LICENSE in the
  repository` (no personal name: the privacy scan forbids the holder's name outside LICENSE). Add `"license": "Apache-2.0"` and
  `"engines": { "node": ">=22" }` to `package.json`. HC adds a validate rule (each mod `.js` starts, within 3 lines, with the
  SPDX line) and a NOTICE sentence ("copies of the mod folder keep the SPDX header; ship LICENSE with a bundled copy").
  Portrait repo: when it bundles the mod it also carries `LICENSE` (post this on that repo's board).
- **Verify.** validate rule fails on a copy where a header is removed; `npm test` and `herdr-app check` still pass (a comment
  changes nothing at run time).

### HC-2-12 (low): `check-local.mjs` and the workflow do not protect Windows-only differences

- **Evidence.** Nothing has run on Windows. Likely places: `check-local.mjs:34` spawns `herdr-app` by bare name (fine
  for an `.exe`, wrong for a `.cmd` shim); `privacy-scan.mjs:84,101` parse `git log` output of a long history in one string
  (`maxBuffer` 256 MB is set in `lib.mjs:15`, fine); `check-docs.mjs` uses `posix` paths on repo-relative names (correct);
  CRLF is neutralised by `.gitattributes` (`* text=auto eol=lf`) but only if the checkout honours it, which `actions/checkout`
  does.
- **Change (HC).** In `check-local.mjs` use `shell: process.platform === "win32"` for `herdr-app` only. In the workflow add
  a first step on all OS: `git config core.autocrlf` and `node -e "console.log(process.platform, process.version)"` so a
  failing Windows run explains itself. No further change until a real run exists.
- **Verify.** First three-OS run (owner step); I read `gh run view --log-failed` if I am given a run.

### HC-2-13 (low): small gaps in the tooling that are cheap to close

- `.github/dependabot.yml` covers actions only; correct, there are no dependencies. Add a comment saying so (so nobody adds an
  npm block that would pull Dependabot into `package.json`).
- `scripts/preview/render.sh` needs POSIX `sh`; on Windows use Git Bash or WSL. Say so in its header (author-only tool).
- `validate.mjs` allows `place` values and `overlay.kind` that Herdr documents; it does not know `"focusable"` beyond a
  type check. Fine; no change.
- `.gitignore` already blocks `gpui-kit.d.ts` and `jsconfig.json`, which `herdr-app check` writes into the mod folder (it did
  so again during this audit; both are ignored and untracked). `verify-install.mjs` (HC-2-7) refuses to treat them as part of
  the mod.

---

## Requests to the other roles (also posted on the board)

- **CR.** (1) HC-2-11 headers and `package.json` fields. (2) Any new import from `herdr`, any new `run()` command or `hc`
  call must be added to the allow-list in `scripts/validate.mjs` in the same change (HC-2-3), and to RECIPE "What it
  reaches": post it before you merge. (3) The Node 22.14 run is green; `engines >=22` is therefore safe. (4) The header of
  `logic.js` still says `node --test tests/` (fails on 22 and 26).
- **DOC.** (1) After HC-2-2: the CI sentences in README:107, docs/install.html:34, AGENTS.md:74/156, CONTRIBUTING:28,
  CHANGELOG:28/57 must say "defined in `scripts/ci.workflow.yml`, enabled by the owner" until a green run exists. (2) HC-2-7
  install wording and `HERDR_APP_HOME`. (3) HC-2-10: I will check the numbers; fix any mismatch I post. (4) The Pages
  address is allowed by the scan; add it if the owner enables Pages.

## Planned work order for the implementation step

1. HC-2-1, HC-2-2 (scripts, workflow file, checklist).  2. HC-2-3, HC-2-4 (allow-list, script tests).
3. HC-2-5, HC-2-10 (claims tables).  4. HC-2-6 (RECIPE) after CR lands code.  5. HC-2-7, HC-2-8, HC-2-9, HC-2-11 (CR
header lines), HC-2-12, HC-2-13.

## Not verifiable here (needs the owner or a real app)

Three-OS CI result; the dialog on Linux and Windows; real `hc read` output; whether Tab inside the focused search box reaches
the key handler (not checked in any shipped mod; CR owns it); contrast of the theme's
dim text on a light theme; herdr.dev rendering the listing; the real screenshot; whether Herdr's default keys on Linux or
Windows already use `ctrl-shift-a` (Herdr documents no default list; RECIPE already tells the person how to rebind).

## Verification method of this audit

All reproductions ran in copies under the session scratch folder (never in the repo, never in the live Herdr home):
validate with an aliased `exec` / `readTextFile` import and `run("space.new")` / `hc(["send"])`; privacy-scan on a scratch
git repo with a web-flow committer and a Dependabot-style trailer; privacy-scan and validate on a PNG with a text chunk;
`herdr-app check` on scratch copies of the mod with a broken `mod.json`, unknown fields and another folder name;
`node --test` under Node 22.14 and 26.5; the LICENSE text diffed against GitHub's canonical Apache-2.0 body (only the
copyright line and edge blank lines differ); the action tags `actions/checkout@v7` and `actions/setup-node@v7` listed through
the GitHub API; the herdrdev example repo and five community mod repos listed for structure and topics.
