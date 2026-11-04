# Round 1 plan: make "Agents waiting" a standalone, publishable Herdr mod

Branch: `feat/round-1-standalone-picker` (from `main` at 207ebe6).
Written by the round-lead after reading the three role audits in this folder
(`code-review.md`, `documentation.md`, `herdr-completeness.md`) and the board.
Round 1 of at least 2. Nothing here is built yet: this file is the contract for the implementation step.

## Goal

A stranger with a bare Herdr install can copy `mods/attention-picker/`, merge `keys.json`, press one key and get the
full "Agents waiting" dialog: search box on, waiting times shown, icons drawn, no other mod needed. The repo carries
everything Herdr asks of a shared mod (RECIPE.md, preview.png, licence, CI, privacy scan) plus human and agent
documentation that can be served from GitHub Pages. The portrait layout keeps working unchanged against the same
folder (props.search, shared `attention.sort`, `agents.since`, `space.colors`, folder name `attention-picker`).

## Scope and non-goals

In scope: the 12 code-review findings, the standalone key and licence/CI/privacy work, and the documentation set
(README, AGENTS.md, docs site, llms.txt, CHANGELOG, CONTRIBUTING).

Non-goals this round:
- No change to the portrait layout repo or to anything under `~/.config/herdr-app` (the live app). The bundled copy
  there is synced by that repo's own round after this branch lands.
- No driving of the running app, no real screenshots, no repo visibility/settings/topics/Pages changes (author's job,
  see `.github/PUBLISH-CHECKLIST.md`).
- No history rewrite (commit 207ebe6 carries the author's name in its metadata; accepted, noted in the checklist).
- No new shared keys, no new props, no layout.

## Decisions where the audits disagreed or were incomplete

| # | Question | Decision and reason |
|---|----------|---------------------|
| D1 | Entry key: keep `ctrl-b a` (documentation asked) or change | `ctrl-shift-a`, global + terminal, bound to `mod.open:attention-picker` (herdr-completeness HC-1-1). `ctrl-b` is a tmux-style prefix of the author's setup, not a proven Herdr default. The author's own chord stays in their keys and in the portrait layout. Documentation writes whatever `keys.json` says. |
| D2 | Code-review wrote "round 2 lands CR-1-1..8" | Overruled: all code changes land in round 1. Without them the mod is not standalone and the other two roles cannot write true docs or RECIPE. Round 2 is for review of the result. |
| D3 | Standalone status times: new shared key (completeness) or localStorage (code-review) | localStorage only, per mod copy, and the mod never writes a shared key. Reason: `agents.since` belongs to the portrait layout and must win when present; a new shared key adds a public surface and a second writer for no gain. The contract in `validate.mjs` stays exactly: props `search`; shared read `agents.since`, `space.colors`; read/write `attention.sort`; command `agent.focus`. Precedence: shared `agents.since` > tab `changed_at` > local first-seen record. |
| D4 | Disclosure said "no localStorage" (documentation, completeness) | Now false by D3. README, AGENTS.md and RECIPE "Watch out" must say: reads other terminals' screen text with `hc read` while open, keeps one line in memory, stores nothing of it; stores only a map address -> first-seen time (no screen text) in the mod's localStorage; no network, no exec, no file access. `validate.mjs` capability report may accept `localStorage` only when RECIPE.md and README.md mention it. |
| D5 | Preview poll: docs and board said every 2 s | Code-review's CR-1-4 wins: 3000 ms, `hc read <address> --lines 60`, max 4 reads per pass, one pass at a time. Docs and RECIPE quote the constants from the final code (`POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, exported/named at the top of `main.js`), not from the audits. |
| D6 | Icons: copy Herdr's two shipped SVGs (code-review) or draw fresh (completeness) | Draw fresh, 24x24, `currentColor` stroke, plain path data only. Keeps NOTICE truthful ("no third-party assets"); Herdr's licence for its shipped files is unverified. |
| D7 | Who owns `package.json`, `tests/**`, `logic.js` | code-review (nobody listed them). `package.json` = `{"private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. Test files are `tests/*.test.mjs`, relative imports with extension, `node:test` only, zero dependencies. |
| D8 | `validate.mjs` rule "no foreign mod names in mods/" vs documentation wanting a "known callers" line in the main.js header | Rule applies to code, not comments: `workspace-chrome`, `bar-strip`, `portrait` may appear only on `//` or `/* */` comment lines. |
| D9 | `mod.json` "version" field | Not added: not in `herdr.d.ts`, unverified. CHANGELOG carries its own version headings. Revisit in round 2 if Herdr documents a field. |
| D10 | Home space named "~" (HC-1-10) | Harmless cosmetic rule (a space literally named "~" is drawn dim). Keep it behind a named constant with a comment; do not extend it. Contrast of the 11px dim text and white-on-MARK initials on light themes is checked by calculation in round 1; any fix that does not fit goes to round 2. |
| D11 | `agents.since` staleness after leaving the portrait layout (CR-1-2 guard) | Deferred to round 2: keep the plain precedence now. The guard only matters when a stale shared value exists and costs more than the ~10 lines code-review budgeted. |
| D12 | Owner/repo string vs "no usernames" rule | The exact string `miguelalexanderdiaz/herdr-agents-waiting` is allowed in README, docs, llms.txt, CHANGELOG, RECIPE and the PUBLISH-CHECKLIST (clone URLs and herdr.dev links need it). `privacy-scan.mjs` allow-lists exactly that string. The real name is allowed only on the LICENSE copyright line. Audit files in `plans/` were redacted to meet this. |
| D13 | `preview.png` | A generated mock (generic data) from `scripts/preview/`, 1100x705. Every doc calls it an illustration, never a screenshot. The author replaces it before publishing. |
| D14 | CI cannot run `herdr-app check` | Correct: it is the desktop binary. CI runs `validate`, `privacy-scan`, `check-docs` and `node --test tests/` on ubuntu, windows and macos (Node 22). `herdr-app check` is a local gate (`scripts/check-local.mjs`). |
| D15 | CI trigger | `push` on `main` and `feat/**`, plus `pull_request`, so this branch gets a three-OS result without opening a PR. If Actions are unavailable on the private repo, that is recorded, not worked around. |

## File ownership (each file has exactly one owner this round)

| Owner | Files |
|-------|-------|
| code-review | `mods/attention-picker/main.js`, `ask.js`, `logic.js` (new), `spinner.svg` (new), `search.svg` (new), `tests/**` (new), `package.json` (new) |
| herdr-completeness | `keys.json`, `mods/attention-picker/mod.json` (no change planned), `LICENSE`, `NOTICE`, `RECIPE.md`, `preview.png`, `scripts/**` (validate, privacy-scan, check-local, check-docs, preview/), `.github/**` (ci.yml, dependabot.yml, PUBLISH-CHECKLIST.md), `.gitignore`, `.gitattributes` |
| documentation | `README.md`, `AGENTS.md`, `llms.txt`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/**` (index, install, usage, configuration, how-it-works, troubleshooting, `style.css`, `.nojekyll`, `assets/preview.png` copy) |
| round-lead | `plans/round-1/PLAN.md`, the three audit files (frozen after this commit) |
| each role | its own `plans/round-1/<role>-summary.md` at the end of the round (what landed, what did not, denials) |

Never committed by anyone: `mods/attention-picker/gpui-kit.d.ts` and `jsconfig.json` (Herdr writes them; git-ignored).
Nobody edits another role's file. A need in someone else's file goes on the board.

## Tasks

Acceptance checks run from the repo root. `<abs>` = absolute path of the checkout being tested.

### code-review

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R1-CR-1 | Search on by default (`props()?.search !== false`), rename `close()` to `dismiss()`, guard `props()?.overlay` (CR-1-1, CR-1-10, HC-1-2, DOC-1-4) | `main.js` | helper `pickSearch(props)` tested for `undefined`, `{}`, `{search:true}`, `{search:false}`; `rg -n "close\(" mods/attention-picker/main.js` shows no View method named `close`; `herdr-app check <abs>/mods/attention-picker` passes |
| R1-CR-2 | `logic.js` with pure helpers; `statusSince({shared, tab, seen, status, now})` with the D3 precedence, localStorage first-seen map (try/catch on every access, reset on status change, done and idle count as one, prune on open) (CR-1-2, CR-1-8) | `logic.js`, `main.js` | tests cover each precedence branch, reset, prune, and storage-throws; with `agents.since` absent, "waited" times, Recent/Oldest and the "earlier" fold work in the mod; `agents.since` is never written |
| R1-CR-3 | Bundle `spinner.svg` and `search.svg` (drawn fresh, D6), point `svg()` at `mods/attention-picker/...` through one `HOME` constant (CR-1-3, HC-1-3, HC-1-12, DOC-1-3) | `main.js`, `spinner.svg`, `search.svg` | `rg -n "workspace-chrome" mods/` empty outside comments; the folder name appears once in `main.js` (`HOME`); SVGs contain only path/circle data and `currentColor` |
| R1-CR-4 | Preview polling: single guarded pass, `POLL_MS=3000`, `READ_LINES=60`, `READ_CONCURRENCY=4`, skip when nothing is blocked/done, prune entries, failed read stores empty text instead of "..." forever (CR-1-4) | `main.js` | test with a fake slow `readFn` proves no overlapping passes and concurrency cap; constants named at top of file for docs to quote |
| R1-CR-5 | Selection by address (`resolveSelection`, `moveSelection`), rows computed once per render and cached, Shift+Tab reverses sort (`nextSort(current, dir)`) (CR-1-5, CR-1-11) | `main.js`, `logic.js` | unit tests for reorder-while-open, selected agent vanishing, wrap, sort cycle both directions |
| R1-CR-6 | `ask.js`: strip ANSI, accept trailing `(y/n)` / `[y/N]` hints, skip tool-call lines for done agents (fallback to last call only if no prose), 200-char cap, named `MARKERS` const (CR-1-6, CR-1-7, DOC-1-7) | `ask.js` | `askOf("● Fixed it.\n● Bash(npm test)\n","done")` returns `Fixed it.`; fixtures for question box, numbered options, `(y/n)`, ANSI, CRLF, empty/undefined |
| R1-CR-7 | `tests/ask.test.mjs`, `tests/logic.test.mjs`, root `package.json` (D7); cases listed in CR-1-8 (duration boundaries, `nameOf` variants incl. Windows `C:\` titles, sorts, 24 h fold boundary, search opening "earlier", stable order) (CR-1-8, DOC-1-6) | `tests/**`, `package.json` | `node --test tests/` exits 0 on Node 22+ |
| R1-CR-8 | Multi-token AND search over name, program, space, tab, title and status words; empty-state wording ("No agents running" / "Start one and it will show here") (CR-1-9, CR-1-12) | `main.js`, `logic.js` | unit tests for token order independence and `title` match; strings quoted on the board for docs |
| R1-CR-9 | Header comment rewritten as a generic contract (what, props, shared keys read/written, how opened, one "known callers" comment line); `HOME_SPACE_NAME` constant for the "~" dim rule; contrast check of dim text and initials on light and dark themes, fix if cheap (DOC-1-5, HC-1-10, D10) | `main.js` | `rg -n "bar strip|ctrl-b|bar-strip|portrait" mods/attention-picker/*.js` only hits comment lines; contrast numbers recorded in `code-review-summary.md` |

### herdr-completeness

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R1-HC-1 | `keys.json`: `ctrl-shift-a` in `global` and `terminal` -> `mod.open:attention-picker` (HC-1-1, DOC-1-1, D1) | `keys.json` | JSON parses; `validate.mjs` finds `mods/attention-picker/main.js` for the target and no `cmd-` / `ctrl-alt-` keys |
| R1-HC-2 | Apache-2.0 `LICENSE` (owner name from the commit author, only place a real name appears) and short truthful `NOTICE` (no third-party code or assets) (HC-1-4) | `LICENSE`, `NOTICE` | `validate.mjs` checks "Apache License" and "Version 2.0, January 2004" and the NOTICE holder line |
| R1-HC-3 | `scripts/validate.mjs`: JSON, mod.json shape, structure, CONTRACT (D3), capability report (D4), foreign-mod-name rule (D8), file size limits, no tracked `gpui-kit.d.ts`/`jsconfig.json`/`node_modules`, RECIPE heading order; `scripts/check-local.mjs` runs `herdr-app check` when on PATH (HC-1-7, HC-1-9, HC-1-11) | `scripts/validate.mjs`, `scripts/check-local.mjs` | `node scripts/validate.mjs` exits 0; removing `agents.since` from a scratch copy of `main.js` makes it exit non-zero with the compatibility message |
| R1-HC-4 | `scripts/privacy-scan.mjs` over tracked files and `git log` (paths, emails, hostnames, tokens, wrong co-author lines, `PRIVACY_EXTRA` env), allow-list per D12; `.gitattributes` (`* text=auto eol=lf`, `*.png binary`); extended `.gitignore` (HC-1-8) | `scripts/privacy-scan.mjs`, `.gitattributes`, `.gitignore` | passes on the tree; scratch-copy negative test (home path, fake email) exits non-zero; `gpui-kit.d.ts` and `jsconfig.json` stay ignored |
| R1-HC-5 | CI: matrix ubuntu/windows/macos, Node 22, `contents: read`, concurrency, timeout 10, fork-safe `PRIVACY_EXTRA` guard, triggers per D15, steps validate, privacy-scan, check-docs, `node --test tests/`; `dependabot.yml` for actions (HC-1-7, HC-1-14) | `.github/workflows/ci.yml`, `.github/dependabot.yml` | every `run:` line executed locally on macOS and exits 0; YAML read by eye (no parser installed); first three-OS run read with `gh run list` after push if Actions are enabled |
| R1-HC-6 | `scripts/preview/preview.svg`, `render.sh`, `preview.png` mock, 1100x705, generic data (D13) (HC-1-6) | `preview.png`, `scripts/preview/**` | PNG signature and IHDR 1100x705 checked by `validate.mjs`; image opened once and checked for clipping and contrast; privacy scan covers the SVG |
| R1-HC-7 | `scripts/check-docs.mjs`: every relative link in README and `docs/*.html` resolves, no external origin loaded by a docs page (plain `<a href>` to https is allowed), `docs/assets/preview.png` byte-equals `preview.png`, `docs/.nojekyll` exists, each page has `lang`, `<title>`, viewport meta (DOC-1-9) | `scripts/check-docs.mjs` | exits 0 on documentation's output; fails on a scratch copy with a broken link |
| R1-HC-8 | `RECIPE.md`, written last from the final code: six required sections in order, "What it reaches" list per D4/D5, rename spots (folder, `HOME`, keys.json), ctrl-shift-a note, tested only on `herdr-app` version found by `herdr-app --version` (HC-1-5, HC-1-9, HC-1-12) | `RECIPE.md` | `validate.mjs` heading-order check; every number in it greps in `main.js`; read once against the code |
| R1-HC-9 | `.github/PUBLISH-CHECKLIST.md`: what only the author can do (real screenshot, `PRIVACY_EXTRA` secret, make public, `herdr-mod` topic, enable Pages from `main /docs`, licence detection, install test into an empty Herdr home, portrait resync, author-metadata note) (HC-1-13, DOC-1-9) | `.github/PUBLISH-CHECKLIST.md` | each item maps to a command or URL; round 1 performs none of them |

### documentation

| Id | Title | Files | Acceptance check |
|----|-------|-------|------------------|
| R1-DOC-1 | `README.md`: what/why with the preview (relative `preview.png`, called an illustration), install by agent and by hand, the key from `keys.json` and how to rebind, requirements table (honest per OS: pure JS, tested on macOS only, CI proves the pure parts on three), Privacy and permissions (D4), troubleshooting, uninstall, link to the Pages site (DOC-1-1, 1-8, 1-12) | `README.md` | `check-docs.mjs` passes; the key named in README equals `keys.json`; privacy text matches `rg -n "localStorage|fetch\(|exec\(|hc\(" mods/` |
| R1-DOC-2 | `AGENTS.md`: install/adapt/test/edit-safely for agents, "tell the person first" disclosure, "Do not break" compatibility table and portrait sync procedure (copy `*.js`, `*.svg`, `mod.json`; never the Herdr-written d.ts/jsconfig), Herdr gotchas (DOC-1-13), claim-to-source map for round 2 (DOC-1-10, 1-13, 1-12) | `AGENTS.md` | each claim in the map names a file and a grep; the grep returns it |
| R1-DOC-3 | Pages site `docs/`: index, install, usage (keys, search, sorts, fold, previews are best effort and only for agents with a fixture), configuration (props, shared keys, tracker precedence and its limit that the overlay lives only while open), how-it-works, troubleshooting; plain HTML+CSS, no JS, light/dark via `prefers-color-scheme`, 360 px width, skip link, ordered headings, `.nojekyll`, `assets/preview.png` copied from `preview.png` (DOC-1-2, 1-4, 1-7, 1-9) | `docs/**` | `node scripts/check-docs.mjs` exits 0; pages open from `file://`; no external origin |
| R1-DOC-4 | `llms.txt`, `CHANGELOG.md` (Unreleased in Herdr's New/Fixed style, baseline 0.1.0; every bullet maps to a round commit), `CONTRIBUTING.md` (`npm test` / `node --test tests/`, `herdr-app check <abs>` as the local gate, never edit the live Herdr folder, no personal data) (DOC-1-6, 1-14) | `llms.txt`, `CHANGELOG.md`, `CONTRIBUTING.md` | test and check commands paste and work; links resolve |

## Order and cross-role dependencies

Phase 1 (parallel, no waiting): CR-1..CR-9 on code; HC-1, HC-2, HC-4, HC-6, HC-9, HC-3/HC-5/HC-7 first versions;
DOC-1..DOC-4 everything that does not describe behavior (structure, install steps from `keys.json`, site shell and
style, CONTRIBUTING skeleton, requirements, uninstall).

Gate G1: code-review commits and posts on the board "code landed" with: final constants (`POLL_MS`, `READ_LINES`,
`READ_CONCURRENCY`, `HOME`), localStorage key name, empty-state strings, and the list of files for the portrait sync.
Documentation and herdr-completeness do not state a behavior number before G1.

Phase 2 (after G1): documentation fills behavior text (usage, configuration, how-it-works, privacy, claim map) and
re-verifies each claim by grep; herdr-completeness finishes `validate.mjs` against the final main.js, then writes
`RECIPE.md` last (HC-8); documentation copies the final `preview.png` into `docs/assets/` once HC-6 has it
(available in Phase 1, so this can be done early).

Gate G2: all three have committed; each posts "done" on the board with open items.

Phase 3: every role reads the board and the other roles' files for contradictions (numbers, key, disclosure wording)
and reports on the board; owners fix their own files only. Then each role writes its `<role>-summary.md`.

Integration: file ownership is disjoint, so merging per-role work into the round branch is conflict-free; the order
CR, HC, DOC is used for pushes. Each role stages only its own paths (`git add <paths>`, never `git add -A`),
rebases before pushing, never force-pushes.

## How the round is verified (macOS, local; Windows and Linux only through CI)

```
node --test tests/
node scripts/validate.mjs
node scripts/privacy-scan.mjs
node scripts/check-docs.mjs
herdr-app check <abs>/mods/attention-picker
node -e 'for (const f of ["keys.json","mods/attention-picker/mod.json","package.json"]) JSON.parse(require("fs").readFileSync(f,"utf8"))'
rg -n "workspace-chrome" mods/                      # nothing outside comments
rg -n "fetch\(|exec\(|readTextFile|writeTextFile" mods/   # nothing
git ls-files | rg "gpui-kit.d.ts|jsconfig.json|node_modules"   # nothing
node scripts/privacy-scan.mjs                      # no home paths anywhere (tree and history)
gh run list --branch feat/round-1-standalone-picker  # three-OS result, if Actions are enabled
```

Manual: open `docs/index.html` via `file://` at 360 px and desktop width; read `preview.png`; read RECIPE.md
against `main.js`. The final round summary lists which of these ran, which were denied, and what stayed unproven.

## Risks

- No real runtime test: the app may not be driven, so behavior in the live overlay is proven only by `herdr-app check`
  (renders eagerly, not deferred rows or later async states), by unit tests of pure logic, and by reading.
  Mitigation: keep UI changes in `main.js` small and shaped like the shipped `picker` mod; round 2 re-reads them.
- Changing the localStorage and `changed_at` time source can show wrong "waited" times in tabs holding several
  agents. Accepted and documented as approximate; shared `agents.since` still wins.
- Search-on-by-default changes behavior only for callers passing no props; every known caller passes a value, so the
  portrait layout is unaffected. The `hint` text must still branch on `this.search`.
- `ctrl-shift-a` may collide with a stranger's terminal program or key; documented with the rebind line.
- CI cannot be exercised before push and may be unavailable on a private repo; then the three-OS claim stays
  "unverified" in README and the summary.
- Concurrent role edits to the board: append-only heredoc, so safe. Concurrent git on one working tree is not; the
  implementation step must give each role its own worktree or serialize commits.

## Deferred to round 2

- `agents.since` staleness guard (D11): needs observation of real behavior first.
- Any contrast fix larger than a constant change (D10).
- Fixtures and claims for agents other than Claude-Code-style screens (only add with a real sample screen).
- Reading the first three-OS CI result and fixing Windows/Linux surprises.
- Replacing the preview mock with a real screenshot, enabling Pages, making the repo public, the `herdr-mod` topic,
  the `PRIVACY_EXTRA` secret: author-only, in the publish checklist.
- Install test into an empty Herdr home on a second machine/OS, and the portrait layout resync (that repo's round).
- `mod.json` version field (D9).
- Docs-vs-code re-verification pass using the claim map, and a review of the first complete tree by a fresh reader.
