# Round 2 - documentation log

Role: documentation. Branch `feat/round-2-verify-harden--documentation` (from `feat/round-2-verify-harden`).
Owned files: README.md, AGENTS.md, llms.txt, CHANGELOG.md, CONTRIBUTING.md, docs/**. Nothing outside them was edited
except this log. Gates used: H1 (CI sentence), G1 (code facts), H2/H3 (templates, verify-install) were all posted on the
board before the final text was written; C0 only fixed `npm test` and `engines`.

## What landed, by task

| Task | Result |
|---|---|
| R2-DOC-1 | Two-tier wording everywhere ("the original mod ran in the author's Herdr on macOS; later changes passed `herdr-app check` and unit tests, not watched in a live window"). "Verification status" table with a 30-second check per row in README, `docs/install.html#verification`, and a short list in AGENTS.md. Rows: key closes the dialog from the search box; Tab/Shift+Tab from the search box; `localStorage` across a reload; `hc read --lines 60` output; `changed_at` unit; polling stops on close; palette entry for `mod.open`; the 30 s redraw; a question without a `seq` change showing within about 30 s; Linux and Windows. "Tested on Herdr 0.1.12 only" replaces the forecast. Key toggle is "should close it (`mod.open` toggles); `Esc` always does". |
| R2-DOC-2 | Every CI claim uses H1's sentence ("CI is defined in `scripts/ci.workflow.yml` (Linux, Windows and macOS, each on Node 22 and 24); it is enabled when the owner installs it and has not run yet"), plus "until a run is green treat Linux and Windows as unchecked". CHANGELOG moved it to "Known limits". |
| R2-DOC-3 | Policy not sandbox in README, AGENTS.md, `how-it-works#privacy`, index, llms.txt, CONTRIBUTING. "What it lists" (README, `usage#what`), troubleshooting "No agents running" and "A finished agent disappeared". Wording quotes `herdr.d.ts` ("finished while you weren't looking", becomes idle once you look). |
| R2-DOC-4 | Configuration: rows for `SEEN_KEY`, `HOME_SPACE_NAME`, `LIST_H`, `TICK_MS`; `STALE_SLACK` and `RECHECK` named; `props.overlay` listed as supplied by Herdr; "For layout authors" (value shapes, a sketch for publishing `agents.since` marked as not run, persistence in `shared.json`, staleness and the partial guard). Usage: home-space paragraph, time sources with the 10 s guard, 30 s refresh, re-read note. Wording taken from the G1 post. |
| R2-DOC-5 | CHANGELOG without task ids, herdr.dev claim or an invented version; "Unreleased" with Round 1 and Round 2 sections. README status line replaced by "Status" + the table. American spelling (`rg` for colour/licence/recognis/behaviour is empty). Search wording identical in README, index, usage. Top list: "in the order Herdr last saw them change". |
| R2-DOC-6 | Pages address `https://miguelalexanderdiaz.github.io/herdr-agents-waiting/` in README ("once the repository is public and Pages is on"), llms.txt (plus a line that the raw links resolve after publication) and every docs footer. `docs/404.html` (relative links: it works for unknown paths one level under the site, not for deeper ones). `<link rel="icon" href="data:,">` in all pages. |
| R2-DOC-7 | `tabindex="0" role="region" aria-label` on every `.table-wrap` and `<pre>`, `scope="col"` on every `<th>`, `:focus-visible` outline on those regions, first column wraps under 480 px (the old nowrap rule was after the media query and would have won; moved before it), `forced-colors` borders. |
| R2-DOC-8 | AGENTS.md: round agents read SUMMARY and board first; copy the whole folder; `terminal` vs `global` and `layout:<name>`; hidden copies keep timers; a broken save only shows in `herdr-app status`; shared state persists in `shared.json`; `check-local.mjs` and `verify-install.mjs` in Testing; `props().overlay` in "Do not break"; Node `>=22`; what the stub harness does and does not prove; claim map re-run (see checks) and extended with rows for `headline`, `resolveSpaceColor`, `bySince`, the record shape, `STALE_SLACK`, `RECHECK`, `TICK_MS`, `MAX_MESSAGE_INDENT`. 213 lines, a little over the 200 target. |
| R2-DOC-9 | Troubleshooting: small window, `layout:<name>` and `terminal` sections, the key not closing the dialog, command quoting (POSIX shown; PowerShell and cmd marked not tried; the flag form `herdr-app do mod.open --name attention-picker` from `herdr-app --help` offered, not tried). README, CONTRIBUTING link the issue form, PR template, SECURITY.md by relative path; the docs pages link them with absolute GitHub URLs because `docs/` is the Pages root and `../.github/` would 404 there. Install steps (README, install page, AGENTS.md) name `verify-install.mjs` and `HERDR_APP_HOME`. |

## Decisions

- docs/ links to `.github/*` are absolute GitHub URLs (the plan said relative); on Pages a `../` path leaves the site.
- The `agents.since` example is labeled "a sketch: it has not been run".
- Did not document `toMs` (round-lead: RECIPE has it).
- Did not edit RECIPE.md (herdr-completeness). RECIPE and the docs still need a contradiction read after HC-7 lands.

## Checks run (scratch clone in the session scratchpad: this branch + code-review G1 + herdr-completeness H3 merged)

- `node scripts/validate.mjs`: ok. `node scripts/privacy-scan.mjs`: ok. `node scripts/verify-install.mjs mods/attention-picker`: ok.
- `npm test`: 225 pass, 0 fail on the final merged tree (Node 26.5). validate, privacy-scan and verify-install ok.
- `node scripts/check-docs.mjs`: ok on the final merged tree. An intermediate run flagged "every 30 seconds" because the script parsed `30_000` as 30; herdr-completeness fixed the parse in its RECIPE commit. Links, anchors, nav set, tabindex, scope, constants rows and quoted numbers pass.
- On this branch alone `check-docs` fails on the relative links to `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/SECURITY.md`: those files exist on herdr-completeness's branch. Expected until the merge.
- `rg` claims from the plan: no `R1-`/`R2-`/"code-review log" in CHANGELOG, README, docs; no British spellings; no "no Node / no network inside" as a platform rule; no "the same key closes it"; CI wording only conditional.
- AGENTS.md claim map: all rows run on the merged tree and print what they claim (constants 8 lines; one `hc(` hit; two `localStorage.` hits; `STALE_SLACK`/`tabProvesNewer`; `headline`; `resolveSpaceColor`; `RECHECK`/`TICK_MS`; ask.js limits; the two `run(` calls).
- Page width: headless Chrome's minimum window width made a 320 px screenshot unusable, so the 320 px check is by reading the CSS (16 px gutters, wrapping nav, tables and `<pre>` scroll inside their own region, image `max-width: 100%`, footer URL wraps).
- Nothing was run in the live Herdr app; `herdr-app check` is not needed for this role (no mod file changed).

## Deferred

- Switching any row of the Verification status table to "observed" (needs the live app).
- Words about CI being green (no run has happened).
- `docs/404.html` for deeper wrong paths (Pages serves one file; absolute `/herdr-agents-waiting/...` links would break the link check).
- A real screenshot instead of `preview.png` (D25).
- A light-theme contrast note for the dim 11 px text (CR-2-9, decision D16).

## Handoffs

- herdr-completeness: fix the `30_000` parse in check-docs (board post); RECIPE "Storage" shows `{ s, at, q, sp }`, "Programs" the 30 s re-read and the 30 s tick, "Done when" the key toggle in the observation table, "Platforms" the H1 sentence; RECIPE:16 "longest-waiting first" should say "in the order Herdr last saw them change".
- round-lead: after merging, re-run the verification list on the merged tree; the README/docs status tables must be flipped by whoever first watches the live app.
- Next round: contrast options note (D16); heartbeat key in the portrait repo; observe the live app and update the tables; first green CI run, then change the CI sentence.
