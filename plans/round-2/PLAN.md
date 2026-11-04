# Round 2 plan: prove what round 1 claimed, then harden it

Branch: `feat/round-2-verify-harden` (from `feat/round-1-standalone-picker` at b7fcb3f; round 1's PRs are still open, so this work stacks on them).
Written by the round-lead after reading the three round-2 audits in this folder (`code-review.md`, `documentation.md`,
`herdr-completeness.md`), `plans/round-1/` (PLAN, SUMMARY, logs) and the board.
Round 2 of at least 2. Nothing here is built yet: this file is the contract for the implementation step.

## Goal

Round 1 made the picker standalone. Round 2 makes round 1 trustworthy:

1. Every claim in the docs and RECIPE is either backed by a test or script that runs, or is worded as unverified.
2. `main.js` is executed by a test for the first time (key handling, dismiss, shared-key contract).
3. The two real faults the audit found are fixed (title counts follow the search filter; odd shared `space.colors`
   blanks the dialog).
4. The safety net (privacy scan, validate, check-docs, CI definition) stops being bypassable or red on the first GitHub
   web merge, and is itself tested.
5. The prioritized list in `plans/round-1/SUMMARY.md` is worked through as far as it can be without the live app.

The folder name, props and shared keys stay exactly as in round 1 (`attention-picker`; `props.search`; shared
`attention.sort`, `agents.since`, `space.colors`; command `agent.focus`). The portrait sync file list does not change:
`mod.json`, `main.js`, `logic.js`, `ask.js`, `spinner.svg`, `search.svg`.

## Scope and non-goals

In scope: the 9 code-review findings (except CR-2-9), the herdr-completeness findings (all 13, HC-2-5 and HC-2-8
reduced, see decisions), the documentation findings (all 15).

Non-goals this round (also listed in "Deferred to round 3"):
- Nothing is run in the live app; nothing under `~/.config/herdr-app` is written; no second app.
- No change to the portrait layout repo. Cross-repo needs go on that repo's board (the round-lead posts them).
- No `.github/workflows/` file (token has no `workflow` scope). CI ships as `scripts/ci.workflow.yml`.
- No merging of PRs, no branch or worktree deletion, no history rewrite, no force-push, no visibility, settings, topics
  or Pages changes.
- No new shared key, no new prop, no new `herdr` import, no new `run()` command, no new exec, fetch or file access in the mod.

## Decisions where the audits disagreed or left a question open

| # | Question | Decision and reason |
|---|----------|---------------------|
| D16 | CR-2-9: guard the 11px dim/muted text against low contrast on light themes (option A) or leave it (B) | Deferred to round 3, option A recorded as the recommendation. It is invisible on themes that already pass, but nobody can say what the author's theme computes to, and the author's design notes say options and schematics first, restraint, no unrequested visual change. Round 3 starts with an options note (what `contrast(dim, popover)` is for each shipped theme, a before/after schematic) for the author. Nothing is wired this round; no dead `readable()` helper is added. |
| D17 | CR-2-3 stale `agents.since`: ship the partial guard, or wait for a heartbeat key | Ship the partial guard (conservative: only blocked/working, only a lone agent in its tab, tab time more than 10 s newer; never lengthens a wait). It cannot break the portrait layout: that layout rewrites the value within moments of a tab change, so the guard stays quiet. The complete fix (a heartbeat key written by portrait-tree) is a portrait-repo change: the round-lead posts it on that repo's board; it is not a dependency. The docs state the limit. |
| D18 | CR-2-4 skip re-reading settled screens: round 1 said "once real screens can be observed" | Include, as the LAST code task and droppable. The guard is safe without observation: skip only when status and `seq` are unchanged, the last two successful reads were equal, the last read succeeded, and never more than 10 passes in a row (about 30 s), so a screen can be at most about 30 s stale. If it is not done and tested by the end of the round, it moves to round 3 and nothing else depends on it. RECIPE/README gain one clause only if it lands. |
| D19 | `engines.node`: code-review said `>=20.6`, herdr-completeness said `>=22` | `>=22`. Only 22.14 and 26.5 were ever run; docs already say "Node 22 or newer"; Node 20 is unverified. The harness must still pass on 22.14, where `module.registerHooks` does not exist (it arrives in 22.15), so the `module.register` fallback is exercised locally and `registerHooks` in CI (setup-node resolves `22` to the latest 22.x). Both paths are code-review's to run. `package.json` also gets `"license": "Apache-2.0"`. |
| D20 | CI matrix | `os` x `node: [22, 24]` as herdr-completeness proposed (satisfies code-review's "one old, one current"). Command is `npm test`. Delivered as `scripts/ci.workflow.yml`; step 0 of the publish checklist installs it. Until a run is green, every doc says "defined in `scripts/ci.workflow.yml`, enabled by the owner, not yet run". |
| D21 | validate.mjs "if docs mention CI and no workflow file exists, fail" (HC-2-2.4) | Replaced: the rule becomes "`scripts/ci.workflow.yml` exists and passes the lint". Once that file ships, the old rule is vacuous. The wording of the claims is documentation's (R2-DOC-2). |
| D22 | DOC-2-3 question: does validate fail on a `fs` import, or `exec`/`fetch` imported from `herdr`? | Yes, by R2-HC-3: the import allow-list covers every import specifier (only `./logic.js`, `./ask.js`, `gpui-kit`, `gpui-base`, `herdr`) and every name imported from `herdr` (only the ten in RECIPE). Documentation words the privacy statement as "this mod's policy, checked by `scripts/validate.mjs`, not a Herdr sandbox". |
| D23 | Top-list order: `seq` (code today) vs displayed time (documentation asked) | Keep the code. Changing order is a visible behavior change nobody can observe this round. Docs and RECIPE say "in the order Herdr last saw them change". Revisit in round 3 once the live app shows whether the two disagree. |
| D24 | DOC-2-5: soften "pressing the key again closes it" | Yes, in README, docs, RECIPE: "should close it (`mod.open` toggles); `Esc` always does", listed in the "not yet observed" table. code-review's question about the RECIPE "Done when" bullet is answered the same way: it moves to the observation table, it is not a builder check. |
| D25 | HC-2-8 part 3: re-render preview without the macOS dots / with an open font | Deferred. It rewrites `preview.png` (herdr-completeness) and its byte-identical copy `docs/assets/preview.png` (documentation) and the real screenshot replaces both at publish. This round herdr-completeness only makes NOTICE state which font the illustration used. |
| D26 | HC-2-5 CLAIMS table: about 20 rows | Reduced to the 12 that RECIPE actually quotes and a reader could get wrong: row heights, dialog width, spinner period, storage key, `MAX_LEN`, markers, key-hint string, search placeholder, sort labels, empty-state strings, 500 entries, 24 h fold. The rest wait. Lands after G1 because code-review moves some of these symbols. |
| D27 | `mod.json` `version` field (SUMMARY item 6) | Closed: no field. Herdr documents none, `herdr-app check` ignores it, a listed repo's version is its git tag. CHANGELOG stays "Unreleased" with no invented number. |
| D28 | `docs/404.html` (R2-DOC-6) vs the check "all six pages have the same nav set" | 404 is exempt from the nav-set rule, not from the link/origin/lang/title rules. Told to herdr-completeness on the board. |
| D29 | Privacy scan on pull requests (HC-2-1) | Adopt herdr-completeness's design: `PRIVACY_AUTHORS=skip` on `pull_request` events (outside contributors' author e-mails are theirs and public in git); every added line and every commit message is still scanned in all modes; the full author/committer check runs on `push` to `main`. GitHub's web-flow committer and Dependabot trailer are allowed by pattern. |
| D30 | Who writes the SPDX headers | code-review (they own the `.js` files and `package.json`), as the FIRST commit of its branch so herdr-completeness can test the validate rule against real files. Header text is exactly the two lines proposed in HC-2-11 (no personal name). |

## File ownership (each file has exactly one owner this round; no file moves from its round-1 owner)

| Owner | Files |
|-------|-------|
| code-review | `mods/attention-picker/main.js`, `logic.js`, `ask.js`; `tests/**` (existing and new: `tests/main.test.mjs`, `tests/helpers/**`); `package.json` |
| herdr-completeness | `RECIPE.md`, `keys.json`, `mods/attention-picker/mod.json` and the two SVGs (no change planned), `LICENSE`, `NOTICE`, `preview.png` (no change), `.gitignore`, `.gitattributes`, `.github/**` (never `.github/workflows/`; new: `ISSUE_TEMPLATE/bug_report.yml`, `PULL_REQUEST_TEMPLATE.md`, `SECURITY.md`), `scripts/**` (new: `ci.workflow.yml`, `verify-install.mjs`, `checks.test.mjs`) |
| documentation | `README.md`, `AGENTS.md`, `llms.txt`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/**` (new: `docs/404.html`; `docs/assets/preview.png` copy untouched) |
| round-lead | `plans/round-2/PLAN.md`, the three audit files (frozen by the plan commit), `plans/round-2/SUMMARY.md`, `plans/round-2/board.md` (copy of the board at the end) |
| each role | its own `plans/round-2/<role>-log.md` (what landed, what did not, denials, checks run) |

Never committed by anyone: `mods/attention-picker/gpui-kit.d.ts` and `jsconfig.json` (Herdr writes them; git-ignored),
anything under `.github/workflows/`, `herdr-shot*.png`.
Role branches are `feat/round-2-verify-harden--<role>`; each stages only its own paths. A need in another role's file goes on the board.
Test files that import `main.js` build the Herdr home path with `os.homedir()` or `HERDR_APP_HOME` and only read; no path literal.

## Tasks

Acceptance checks run from the repo root. `<abs>` = absolute path of the checkout being tested. Every check must also hold on the merged tree.

### code-review (order matters: CR-1 first, CR-2 second)

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R2-CR-1 | First commit, posted at once (gate C0): SPDX + copyright lines at the top of `main.js`, `logic.js`, `ask.js` (HC-2-11, D30); `package.json` gets `"license": "Apache-2.0"` and `"engines": {"node": ">=22"}` (D19); `logic.js` header says `npm test`; one-line comment that `dead` only guards `cx.notify()` because tasks end with the view (CR-2-8, DOC-2-12) | `main.js`, `logic.js`, `ask.js`, `package.json` | `rg -n "node --test tests" mods tests` finds nothing; `head -3` of each `.js` shows the SPDX line; `npm test` green; `herdr-app check <abs>/mods/attention-picker` passes |
| R2-CR-2 | Stub-module harness that runs the real `main.js` under node (CR-2-1): `tests/helpers/loader.mjs` (uses `module.registerHooks` when present, else `module.register`), `tests/helpers/stubs/{gpui-kit,gpui-base,herdr}.mjs`, `tests/main.test.mjs` covering: import drift (every imported name exists in the stub and, when readable, in the app's `herdr.d.ts`; skipped with a message otherwise), render for mixed/no/filtered/40 agents, the RECIPE key table row by row, dismiss with and without `props().overlay`, the shared-key contract (`attention.sort` is the only key written, `agents.since` wins, `attention.seen` written, storage that throws does not stop `init` or `render`) | `tests/main.test.mjs`, `tests/helpers/**` | `npm test` passes on Node 22.14 (fallback path) and 26.5; by-hand mutation, not committed and logged: rename `closeOverlay` import, change the `"tab"` branch, change `SEEN_KEY`: each turns a test red |
| R2-CR-3 | Title counts come from `agents()`, not from the filtered rows; new `headline({ agents })` in `logic.js` (CR-2-2) | `main.js`, `logic.js`, `tests/logic.test.mjs`, `tests/main.test.mjs` | unit tests for singular/plural, blocked beats done, zero agents, agents but none waiting; harness test sets the input to `zzz` and the title is unchanged |
| R2-CR-4 | `resolveSpaceColor({ raw, mark, theme, dim, isHome })` in `logic.js`, `MARK` moves with it; `inkOn` accepts `#rgb`, `#rrggbb`, `#rrggbbaa`; a non-string or unknown value never throws and never reaches the host as `undefined` (CR-2-6) | `main.js`, `logic.js`, `tests/logic.test.mjs`, `tests/main.test.mjs` | tests for number, null, array, unknown name, `#abc`, `#AABBCCDD`, home space; harness renders with `space.colors = { s1: 5 }` and `{ s1: "teal" }` without throwing |
| R2-CR-5 | `ask.js`: accept a marker line only at indent <= 2, strip the marker from a blocked question, fixtures for list bullets (`•`, `-`) inside a message, message then tool call then prose, a boxed question with `1. Yes / 2. No`, trailing `(y/n)`, lone "? for shortcuts" footer. No invented marker glyphs for other agents (CR-2-5) | `ask.js`, `tests/ask.test.mjs` | `askOf("● Done. I changed:\n  • fixed a\n  • fixed b\n\n> ","done")` returns the message line, not `fixed b`; `askOf("● Why?\n\n● Thinking","blocked")` returns `Why?`; the existing ask tests stay green |
| R2-CR-6 | `statusSince` ignores a shared `agents.since` for a blocked or working agent that is alone in its tab when the tab proves a newer change by more than `STALE_SLACK` (10 000 ms); `buildRows` passes `tabAgents` (CR-2-3, D17) | `logic.js`, `tests/logic.test.mjs` | tests: fresh shared kept, stale shared dropped for blocked and working, kept for done/idle, kept for a multi-agent tab, kept inside the slack, `tabAgents` missing = round-1 behavior; a `buildRows` test with a stale map |
| R2-CR-7 | First-seen record becomes `{ s, at, q, sp }`; a record is new when `seq` went down or the space changed; `parseSeen` still reads old records; unknown `since` sorts last under both Recent and Oldest (CR-2-7) | `logic.js`, `tests/logic.test.mjs` | `trackSeen` tests for decreased seq, changed space, legacy record; `buildRows` tests for `since === null` in both orders |
| R2-CR-8 | `nextSort(sortNow(), dir)` for Tab and the Sort pill; `cx.timer.every(30_000, ...)` notifies a quiet dialog so "5m" advances, skipped when `dead` (CR-2-8) | `main.js`, `tests/main.test.mjs` | harness test: pressing `tab` twice without a render ends two steps along; harness test: the 30 s timer is registered once and calls notify |
| R2-CR-9 | Skip re-reading a settled screen in `createPreviewReader` (CR-2-4, D18). Droppable: if not finished and tested, leave `logic.js`/`main.js` as they are and say so in the log | `logic.js`, `main.js`, `tests/logic.test.mjs` | counting fake `read`: same seq/status twice then skipped; seq change reads again; failed read retried every pass; 10 skips then a read; text change after a re-read updates and resets the counter |

Constraints for all code-review tasks: no constant that RECIPE or `validate.mjs` quotes changes value (`POLL_MS`,
`READ_LINES`, `READ_CONCURRENCY`, `LIST_H`, `HOME`, `SEEN_KEY`); no new `herdr` import, no new `run()` command, no new
exec/fetch/file access; if one is truly needed, post it BEFORE merging (herdr-completeness updates validate and RECIPE in
the same round). New constants (`STALE_SLACK`, `RECHECK`, the tick period) are named at the top of their file.
Gate G1 post lists: new exported names of `logic.js`, symbols that moved (`spaceColor`/`MARK`, the title rule), the record
shape, new constants with values, the new `rg` targets for the AGENTS.md claim map, and whether R2-CR-9 landed.

### herdr-completeness

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R2-HC-1 | CI definition and its install step, posted first (gate H1): `scripts/ci.workflow.yml` (matrix `os` x node 22, 24; `permissions: contents: read`; `persist-credentials: false`; `workflow_dispatch`; a first diagnostic step printing platform, Node and `core.autocrlf`; `node scripts/validate.mjs` early; `npm test`; `PRIVACY_AUTHORS=skip` on `pull_request`; a notice when `PRIVACY_EXTRA` is empty on `push`), checklist step 0 rewritten (copy to `.github/workflows/ci.yml` with the `workflow` scope or paste it in the web UI; no reference to a local-only branch); validate lints the file (HC-2-2, HC-2-12 workflow half, HC-2-9) | `scripts/ci.workflow.yml`, `scripts/validate.mjs`, `.github/PUBLISH-CHECKLIST.md` | validate fails on a scratch copy with `windows-latest` removed, with `permissions: write-all`, with an unpinned `uses:`, with a `run:` pointing at a missing script; passes on the real file; `git ls-files .github/workflows` is empty |
| R2-HC-2 | Privacy scan: allow GitHub web-flow committer and Dependabot trailer by pattern; `PRIVACY_AUTHORS=skip` mode (D29); scan PNG text chunks (`tEXt`, `zTXt`, `iTXt`, `eXIf`) and fail on any chunk other than `Software`; `.gitignore` gains `herdr-shot*.png` and `.claude/` (HC-2-1, HC-2-8) | `scripts/privacy-scan.mjs`, `.gitignore` | cases in R2-HC-4: web-flow committer passes, Dependabot trailer passes, a real address in a message or file fails, a real author address fails under `all` and passes under `skip`, a PNG with a home path in a text chunk fails, the shipped PNG passes |
| R2-HC-3 | validate: replace name regexes by allow-lists (HC-2-3, D22): import specifiers; names from `herdr` (the ten in RECIPE); `run(` only with literal `agent.focus` or `overlay.close`; `hc(` only with an array literal starting `"read"`; fail on dynamic `import(`, `eval(`, `new Function`, `globalThis[`; keep the old regexes as a second line; capability report printed from the import list. After R2-CR-1 lands: rule that each mod `.js` starts, within 3 lines, with the SPDX line (HC-2-11) | `scripts/validate.mjs` | the aliasing mutation from the audit (`exec as sh`, `readTextFile as rd`, `run("space.new")`, `hc(["send"])`, `import "fs"`) each fail; the real tree passes; removing a header fails |
| R2-HC-4 | Tests for the checks themselves: `scripts/checks.test.mjs`, about 25 cases, one per rule, each in a temp copy via `--root`, `process.execPath`, no shell, git cases with `-c user.name -c user.email=<id>+dev@users.noreply.github.com` (HC-2-4) | `scripts/checks.test.mjs` | `npm test` runs them on the three OS; disabling any rule in a script by hand makes its case fail (three rules done by hand and logged); cases total a few seconds |
| R2-HC-5 | check-docs extensions: constants `HOME`, `POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, `SEEN_KEY`, `HOME_SPACE_NAME`, `LIST_H` appear with their values in `docs/configuration.html`; quoted numbers (`--lines N`, `every N seconds`, `at most N`, `N lines of history`, 320) in README, `docs/*.html`, AGENTS.md, llms.txt equal the code; all six pages share the nav `<li>` set with one `aria-current` on themselves (404 exempt, D28); every `.table-wrap` and long `<pre>` has `tabindex`, every `<th>` has `scope` (DOC-2-6, DOC-2-10, HC-2-10) | `scripts/check-docs.mjs` | change `POLL_MS` or a quoted number in a scratch copy: check-docs fails naming the file; real tree passes after documentation's pages land |
| R2-HC-6 | `scripts/verify-install.mjs <installed mod folder> [--home <dir>]`: folder name equals the basename in `HOME`; every `svg(`${HOME}/...`)` target exists; `mod.json` valid by validate's rules; no foreign `mods/<other>/` reference; when a home is known (`--home` or `HERDR_APP_HOME`) its `keys.json` has a key whose action is `mod.open:<folder>`; prints the disclosure lines; ignores `gpui-kit.d.ts` and `jsconfig.json`. `check-local.mjs` spawns `herdr-app` with `shell: process.platform === "win32"`. `render.sh` header says POSIX sh; `dependabot.yml` gets the "actions only" comment (HC-2-7, HC-2-12, HC-2-13) | `scripts/verify-install.mjs`, `scripts/check-local.mjs`, `scripts/preview/render.sh`, `.github/dependabot.yml` | cases in R2-HC-4: renamed folder fails, missing icon fails, key to another mod fails, clean install passes; `node scripts/verify-install.mjs mods/attention-picker` passes on the repo |
| R2-HC-7 | RECIPE.md, LAST, after gate G1 (HC-2-6, HC-2-5 reduced per D26, DOC asks): "Built from" gains the data fields read, the name rule, the `1e11` seconds rule, the order of the waiting rows (by `seq`, D23), the fold condition (needs a known time), the search fields, the preview limits, the 500-entry cap; "What it reaches" becomes a six-row table; "Platforms" and "Built and checked" use two-tier wording (baseline ran on macOS; round-1 code passed `herdr-app check` and unit tests, not yet watched live; CI "defined in `scripts/ci.workflow.yml`, enabled by the owner"); "Done when" softened per D24 and the last bullet reworded; "Storage" shows the new record shape if R2-CR-7 landed; "Programs" gets the 30 s clause only if R2-CR-9 landed; `validate.mjs` gets the 12-row CLAIMS table | `RECIPE.md`, `scripts/validate.mjs` | `node scripts/validate.mjs` passes and fails when `H.waiting` or the key-hint string is changed in a scratch copy; RECIPE has no sentence claiming a live observation that is not in the observation table |
| R2-HC-8 | Publish checklist and community files: session trailers and `plans/` become public (keep or publish from a fresh squashed repo); Pages on a private repo needs a paid plan; second-OS install test with `verify-install.mjs`; read every word of the real screenshot and take it from a Home with invented names; open the Pages URL and click all pages; `ISSUE_TEMPLATE/bug_report.yml`, `PULL_REQUEST_TEMPLATE.md`, `SECURITY.md` (private reporting through GitHub, no address); NOTICE sentence on SPDX headers and which font the illustration used (HC-2-9, HC-2-11, HC-2-8, DOC-2-15) | `.github/PUBLISH-CHECKLIST.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/SECURITY.md`, `NOTICE` | files exist; `node scripts/check-docs.mjs` and `privacy-scan` pass; no e-mail address anywhere |

### documentation

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R2-DOC-1 | Two-tier verification wording everywhere and a "Verification status" table of what has NOT been observed, each row with "how to check in 30 seconds": the key closing the dialog while the search box has focus, Tab/Shift+Tab inside the search box, `localStorage` surviving a reload, `hc read` output and `changed_at` unit, polling stopping on close, the palette entry for `mod.open`. Replace the "newer versions should work" forecast with "tested on 0.1.12 only". Soften "the same key closes it" to "should close it; Esc always does" (DOC-2-1, DOC-2-5, DOC-2-14 part) | `README.md`, `docs/install.html`, `docs/troubleshooting.html`, `docs/usage.html`, `docs/how-it-works.html`, `AGENTS.md` | `rg -n "run in Herdr|been run|only system|the same key closes" README.md docs AGENTS.md CHANGELOG.md` shows only the two-tier or conditional wording |
| R2-DOC-2 | CI wording, after gate H1: "A CI definition for macOS, Linux and Windows is in `scripts/ci.workflow.yml`; it is not enabled until the owner installs it. Until a run is green treat Linux and Windows as unchecked." The CHANGELOG line moves out of "New" into "Known limits" (DOC-2-2) | `README.md`, `docs/install.html`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md` | `rg -n -i "CI (runs|on)\|by CI\|CI covers\|tested by CI" --glob '!plans/**' .` returns only conditional wording |
| R2-DOC-3 | Policy, not sandbox: "Herdr gives mods exec, fetch and file access and does not sandbox them; this mod uses none of them besides one `hc read` call, checked by `scripts/validate.mjs`"; "What it lists" section (README, `docs/usage.html#what`) and a troubleshooting entry "It says No agents running"; "a finished agent leaves the top list once looked at" (DOC-2-3, DOC-2-4) | `AGENTS.md`, `docs/how-it-works.html`, `README.md`, `docs/usage.html`, `docs/troubleshooting.html` | `rg -n "no Node\|no network inside\|no .fetch., no Node" AGENTS.md docs README.md` shows policy wording only; `node scripts/check-docs.mjs` (anchors) passes |
| R2-DOC-4 | After G1: configuration page rows for `SEEN_KEY`, `HOME_SPACE_NAME`, `LIST_H`; "For layout authors" with the value shapes, a 6-line `agents.since` example marked "only if you track times yourself", persistence and staleness, the time-source sentence from R2-CR-6 ("ignored when the tab shows a newer change for a blocked or working agent alone in its tab"), a "Home space" paragraph in usage, `props.overlay` listed as supplied by Herdr; one clause on the about-30 s re-read only if R2-CR-9 landed (DOC-2-7) | `docs/configuration.html`, `docs/usage.html`, `docs/how-it-works.html`, `README.md` | the constants rows are checked by R2-HC-5; the sentences match the gate G1 post |
| R2-DOC-5 | CHANGELOG without task ids or the herdr.dev claim, "Unreleased", round-2 entries from the roles' board posts; README status line replaced by the verification status; American spelling and the search-scope wording everywhere; order of the top list worded per D23 (DOC-2-8, DOC-2-14) | `CHANGELOG.md`, `README.md`, `docs/*.html`, `CONTRIBUTING.md`, `llms.txt` | `rg -n "R1-\|R2-\|code-review log" CHANGELOG.md README.md docs` empty; `rg -n -i "colour\|licence\|recognis\|behaviour" README.md CHANGELOG.md CONTRIBUTING.md docs` empty (the LICENSE file name excepted: it is "LICENSE") |
| R2-DOC-6 | Pages address (the exact allowed string, https) in README ("once the repository is public and Pages is on"), llms.txt and the docs footer; `docs/404.html`; inline icon `<link rel="icon" href="data:,">`-style in all pages; one line in llms.txt that the raw links resolve after publication (DOC-2-9) | `README.md`, `llms.txt`, `docs/404.html`, `docs/*.html` | `node scripts/check-docs.mjs` and `privacy-scan` pass |
| R2-DOC-7 | Accessibility: `tabindex="0" role="region" aria-label` on every `.table-wrap` and long `<pre>`, `scope="col"` on `<th>`, `:focus-visible` for those regions, first table column wraps under 480 px (DOC-2-10) | `docs/style.css`, `docs/*.html` | R2-HC-5's checks pass; open a page at 320 px: no page-level horizontal scroll (by CSS reading and a width check, not the live app) |
| R2-DOC-8 | AGENTS.md first-day gotchas (read `plans/round-*/SUMMARY.md` and the board first; copy the whole folder including `logic.js`; `terminal` vs `global` and `layout:<name>` key sections; hidden copies keep timers, this poll is overlay-only; a broken save shows only in `herdr-app status`; shared state persists in `shared.json`; `check-local.mjs` in the Testing block; `props().overlay` in "Do not break"); `engines` and `npm test`; the claim map re-run against the G1 post (spaceColor/MARK and headline moved to `logic.js`); file kept under about 200 lines (DOC-2-11, DOC-2-12) | `AGENTS.md` | every row of the claim map prints what its claim says on the merged tree |
| R2-DOC-9 | After gates H2/H3: troubleshooting entries for a small window clipping the dialog, the `layout:<name>` key override, the `terminal` section, and the `herdr-app do` quoting (POSIX shown, PowerShell marked "not tried on Windows"); CONTRIBUTING and troubleshooting link the issue template, PR template and SECURITY.md by relative path; install steps name `verify-install.mjs` after the `herdr-app check` line and mention `HERDR_APP_HOME` (DOC-2-13, DOC-2-15, HC-2-7 follow-up) | `docs/troubleshooting.html`, `docs/install.html`, `README.md`, `CONTRIBUTING.md` | links resolve (`check-docs`); each entry names the file or section it points to |

## Cross-role dependencies and the order they land

Roles work in parallel on their own branches; the gates below are board posts ("### [round 2] <role> -> all: <gate>").

1. **C0 (code-review, first hour):** R2-CR-1 committed and pushed on its branch and posted. Unblocks R2-HC-3's SPDX rule and the docs' `npm test`/engines wording. Also posts "no new imports/commands" or the exact additions.
2. **H1 (herdr-completeness):** R2-HC-1 posted with the file name and the exact sentence for CI claims. Unblocks R2-DOC-2.
3. **G1 (code-review):** R2-CR-2 to R2-CR-8 landed (R2-CR-9 landed or declared dropped), with the post described under the code-review table. Unblocks R2-HC-7 (RECIPE, CLAIMS), R2-DOC-4, R2-DOC-8's claim map, and the CHANGELOG entries.
4. **H2 (herdr-completeness):** R2-HC-8's templates and SECURITY.md exist. Unblocks the links in R2-DOC-9. **H3:** R2-HC-6 posted. Unblocks the install wording in R2-DOC-9.
5. **D1 (documentation):** the pages carry `tabindex`, `scope` and the nav set; R2-HC-5's new rules are tested against them on a scratch overlay of the two branches before herdr-completeness pushes, because the rules go red on the round-1 pages. If a rule trips on a documentation file, herdr-completeness posts it; documentation fixes it (never the reverse).
6. **G2 (everyone):** "done" posts with the log file name. Then the round-lead integrates (merge order: code-review, herdr-completeness, documentation; no conflicts expected because ownership is disjoint), runs the verification below and writes SUMMARY.md.

Phase 3 (after G2) is a cross-read: each role reads the other two roles' diffs for contradictions (numbers, strings, claims) and posts what it finds; the owner fixes it.

## How the round is verified

On the merged tree (a scratch clone with the three role branches merged, never the live Herdr home):

```bash
npm test                                           # Node 26.5 and Node 22.14: unit, main.js harness, script mutation cases
node scripts/validate.mjs                          # structure, contract, allow-lists, CI lint, SPDX, CLAIMS
node scripts/privacy-scan.mjs                      # tree and full history
node scripts/check-docs.mjs                        # links, anchors, constants, quoted numbers, nav set, a11y attributes
node scripts/verify-install.mjs mods/attention-picker
herdr-app check <abs>/mods/attention-picker        # the allowed app command; not herdr-app do/shot/status
node scripts/check-local.mjs                       # the one-shot gate
rg -n "node --test tests" mods tests               # nothing
git ls-files .github/workflows                     # nothing (rule 9)
git log --format=%B main..HEAD | rg -n "Co-Authored-By|Claude-Session"   # trailers on every commit
```

Plus the by-hand mutation checks named in R2-CR-2, R2-HC-3 and R2-HC-4 (logged in each role's log), and the `rg` claims in
the documentation table. Anything the audits listed as "not verifiable here" stays in the observation table of the docs
and in SUMMARY.md.

## Risks

- **Harness fragility.** `module.registerHooks` (22.15+) vs `module.register` (20.6+, deprecation notice on Node 26) differ; a Herdr stub that drifts from the real runtime makes the tests pass without testing the real thing. Mitigation: the import-drift test reads the app's `herdr.d.ts` when present; stubs are documented as stubs; AGENTS.md says the harness proves wiring, not rendering.
- **Mutual breakage between roles.** New check-docs rules go red on unfixed pages; new validate rules go red on unfinished code. Mitigation: the gate order above and scratch overlays; the integration run is the arbiter.
- **Line numbers in the audits move.** Roles re-find text with `rg`, not by line number.
- **Wording races.** Documentation and RECIPE must say the same thing about CI, the key toggle and `--lines 60`. Mitigation: the exact sentences come from board posts (H1, G1); R2-HC-5 and the claim map catch numeric drift only.
- **R2-CR-9 changes a visible latency** (a changed question can take up to about 30 s to appear when `seq` does not move). If a role doubts it, drop it (D18).
- **R2-CR-6 could hide a correct portrait time** if `changed_at` meant something other than "last status change". It then falls back to the tab time, which is the second source anyway; it never lengthens a wait. Listed in the observation table.
- **Scope.** herdr-completeness has the longest list; the order is R2-HC-1, 2, 3, 4 first, then 5, 6, 8, then 7 (needs G1). If time runs out, R2-HC-6 and the CLAIMS table are the first to move to round 3.
- **Unattended run.** No one answers questions; a denied tool call is written down in the role's log and the round continues.

## Deferred to round 3 (and why)

| Item | Reason |
|------|--------|
| CR-2-9 contrast guard for dim text on light themes (D16) | Needs the author's go-ahead; options note first. |
| Complete D11 fix (a heartbeat key written by portrait-tree) | Change lives in the portrait repo; the round-lead routes it by board post. |
| Observing the picker in the live app (SUMMARY items 1 and 2: `localStorage`, `hc read`, key toggle, Tab in the search box, `changed_at` unit) and then reading the first three-OS CI run | Not allowed to drive the app; CI needs the owner's `workflow` scope. The docs carry the observation table so the first observer can close the loop. |
| ask.js fixtures and markers for agents other than Claude Code style screens | Needs real screens; invented fixtures would test nothing. R2-CR-5 only fixes what the audit reproduced. |
| Ordering the top list by the displayed time (D23) | Needs observation of whether the sources disagree in practice. |
| Re-render `preview.png` without macOS window dots, with an open-licence font; real screenshot (D25) | Touches two files with two owners; the real screenshot replaces it. |
| The remaining CLAIMS rows beyond the 12 (D26) | Diminishing return this round. |
| Resync of the portrait layout's copy (SUMMARY item 9) | Cross-repo; after this round merges the round-lead posts the file list and the PR/commit reference on that repo's board. |
| Windows-only hardening beyond `shell` for `herdr-app` and the diagnostic step (HC-2-12) | Needs a first real Windows run. |
| mod.json `version` | Closed, not deferred (D27). |
