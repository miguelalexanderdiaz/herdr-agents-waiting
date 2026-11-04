# Round 2 - documentation audit

Scope: README.md, AGENTS.md, llms.txt, CHANGELOG.md, CONTRIBUTING.md, docs/** (6 pages + style.css), read against
mods/attention-picker/{main,logic,ask}.js, tests/, scripts/, RECIPE.md, keys.json, and Herdr's AGENTS.md, herdr.d.ts and
`hc read --help` (read only). Branch feat/round-1-standalone-picker at b7fcb3f. Nothing was run in the live app.

## Summary

The round-1 docs are accurate on mechanics: I re-ran every row of the AGENTS.md claim map and all 15 still print what the
claim says (constants, one `hc(` hit, two `localStorage.` hits, shared keys, `search !== false`, `${HOME}/` icons,
`agent.focus`). `scripts/validate.mjs`, `check-docs.mjs` and `privacy-scan.mjs` pass. `node --test` gives 61 pass on
Node 22.14.0 and 26.5.0, and `node --test tests/` fails on both, so the "Node 22 or newer / do not pass the folder" text is
verified. Contrast of the site's colour tokens is fine (text 5.7 to 16:1 light, 7 to 14.8:1 dark; computed).

What is wrong is mostly **claims the code or the repo cannot back yet**:

1. "Run in Herdr on macOS" is true only of the baseline; none of the round-1 behavior (logic.js, localStorage tracking,
   `ctrl-shift-a`, Shift+Tab, `--lines 60`) has been observed in a live window (SUMMARY.md says so). The docs, RECIPE and
   CHANGELOG say or imply it has.
2. "CI runs on macOS, Linux and Windows" appears in eight places, but there is no workflow on the branch or on main.
3. "No network / no Node inside a mod" is written as a Herdr rule; Herdr's own docs say mods CAN `fetch`, `exec` and read
   files. The privacy promise is this mod's choice, enforced only by our scripts.
4. Docs never say what Herdr counts as an "agent" or that a finished agent leaves the top list once you look at it.
5. Docs-to-code drift is enforced by a manual grep table; `check-docs.mjs` checks only the key name.

Findings are ordered by impact. DOC = documentation owns the files; HC = herdr-completeness; CR = code-review.

---

## DOC-2-1 (high) "Run in Herdr on macOS" overstates what was observed

- Evidence: README.md:21 ("It has been run in Herdr on macOS only") and :106; docs/install.html:33 ("the only system where
  the mod has been run in Herdr"); docs/troubleshooting.html:53; CHANGELOG.md:57; AGENTS.md:156; RECIPE.md:86 (HC) and
  "Done when" (HC). plans/round-1/SUMMARY.md "Not done": "Nothing was run in the live app. Run-time behaviour of
  localStorage, `hc read`, key events and the unit of `TabInfo.changed_at` is unverified." Only `herdr-app check`
  (renders once) and unit tests ran on the round-1 code.
- Change (DOC): state it in two tiers everywhere: "The original mod ran in the author's Herdr on macOS. The round-1 changes
  pass `herdr-app check` (it renders once) and 61 unit tests; they have not been watched in a live window yet." Add a
  "Verification status" table to AGENTS.md "Known limits" and docs/install.html listing what is NOT yet observed: the key
  closing the dialog while the search box has focus; `Tab`/`Shift+Tab` inside the search box; `localStorage` surviving a
  reload; `hc read` output and the `changed_at` unit/meaning on real tabs; the poll timer stopping on close. Each row gets
  "how to check it in 30 seconds" so the first stranger (or the author) can close the loop.
- Also (HC): same two-tier wording in RECIPE.md:86 and soften "Done when" to what `herdr-app check` or a person can see.
- Verify: `rg -n "run in Herdr|been run|only system" README.md docs AGENTS.md CHANGELOG.md RECIPE.md` shows only the two-tier
  wording. After someone observes the app, flip rows to "observed on <OS>, Herdr <version>" and update the date.
- Owner: documentation (README, docs, AGENTS, CHANGELOG); herdr-completeness (RECIPE).

## DOC-2-2 (high) CI is documented as running, but no workflow exists

- Evidence: `ls .github` has only dependabot.yml and PUBLISH-CHECKLIST.md; no `scripts/ci.workflow.yml` either. Claims:
  README.md:107, AGENTS.md:74 and :156, CONTRIBUTING.md:28, CHANGELOG.md:28 (under "New") and :57, docs/install.html:34,
  RECIPE.md:86 (HC), PUBLISH-CHECKLIST table (HC). `validate.mjs` itself warns "no .github/workflows/ci.yml".
- Change (HC first): per hard rule 9 keep the CI definition pushable as `scripts/ci.workflow.yml`, with the install step
  (`mkdir -p .github/workflows && cp scripts/ci.workflow.yml .github/workflows/ci.yml`, needs the `workflow` scope) in the
  checklist. Then (DOC): replace "CI runs ..." with "A CI definition for macOS, Linux and Windows ships in
  `scripts/ci.workflow.yml`; it is not enabled until the owner installs it. Until a run is green, treat Linux and Windows
  as unchecked." Move the CHANGELOG line out of "New" into "Known limits". Switch the wording back only after a green run
  (log the run URL in plans/).
- Verify: `rg -n -i "CI (runs|on)|by CI|CI covers|tested by CI" --glob '!plans/**' .` returns only conditional wording;
  `git ls-files scripts/ci.workflow.yml` exists (HC).
- Owner: herdr-completeness (file, RECIPE, checklist), documentation (rest).

## DOC-2-3 (high) "No network, no Node inside a mod" is presented as a Herdr rule

- Evidence: AGENTS.md:9 ("no DOM, no Node APIs, no network inside a mod"), :86 ("no `fetch`, no Node modules"),
  docs/how-it-works.html:20 ("no Node inside a mod"). Herdr's AGENTS.md says the opposite for network and files: "Mods are
  trusted code: commands and network access (including `fetch`) are unrestricted. Other built-ins: `localStorage`, `fetch`,
  `import * as fs from "fs/promises"`" (Herdr AGENTS.md:963-965) and "run programs (`exec`) and fetch URLs" (:32). Line 35
  of the same file says "can't use ... Node APIs", so Herdr is itself loose here. Nothing sandboxes this mod.
- Change (DOC): say "Herdr gives mods `exec`, `fetch` and file access and does not sandbox them. This mod uses none of
  them, apart from the one `hc read` call; `scripts/validate.mjs` and the rg commands in AGENTS.md check that." Reword the
  three lines as "this mod's policy, enforced by validate.mjs", not as a platform limit. Put one sentence in README
  "Privacy and permissions" and the privacy table of how-it-works: "You are trusting this code, not a sandbox: read
  `main.js` (270 lines) or run the three commands below." followed by the claim-map rows for exec/fetch/files/localStorage.
- Ask (HC): confirm `validate.mjs` also fails on `import ... from "fs"`/`"fs/promises"` and on `exec`/`fetch` imported from
  "herdr" (the claim map's `exec\(` grep misses a bare `import { exec }` that is never called; fine today, cheap to guard).
- Verify: `rg -n "no Node|no network inside|no .fetch., no Node" AGENTS.md docs README.md` shows policy wording only.
- Owner: documentation (+ HC question).

## DOC-2-4 (medium) Docs never say what counts as an agent, or when "finished" ends

- Evidence: herdr.d.ts `agents()`: "Terminals whose program reports a status (agents)"; AgentInfo.status: "'done' means it
  finished while you weren't looking; it becomes 'idle' once you look (here or on another Herdr client)". README/docs say
  "agents" without defining it and docs/troubleshooting.html has no entry for "No agents running" while terminals are open.
  A user with only plain shells gets the empty state and will think the mod is broken. Also, choosing a finished agent
  turns it idle, so it drops from the top list; nothing says so.
- Change (DOC): add a short "What it lists" section to README, docs/usage.html (new `#what` heading) and a troubleshooting
  entry "It says No agents running": only terminals whose program reports a status appear (the same list Herdr's agent
  panels use); a plain shell does not. Add: "A finished agent leaves the top list once you have looked at it, because Herdr
  then calls it idle; it then sits under the rule."
- Verify: heading ids exist (`node scripts/check-docs.mjs`); sentence matches herdr.d.ts wording (rg "finished while you").
- Owner: documentation.

## DOC-2-5 (medium) Claims about Herdr behavior that Herdr's docs do not back

- Evidence:
  - README.md:70, docs/usage.html:22, docs/install.html:67, RECIPE "Done when": "The same key closes it". The dialog's search
    box has focus; whether a `global`/`terminal` key reaches the command while an overlay input is focused is not in Herdr's
    docs. `Esc` is certain (Herdr AGENTS.md:925: "Esc closes the top dialog or popup").
  - README.md:72, docs/install.html:61: "The command palette lists `mod.open`". `mod.open` has a required `name` argument
    (`herdr-app commands`, "Toggle a mod ... calling again closes it"); how the palette collects it is not documented.
  - docs/how-it-works.html:42: "The timer belongs to the dialog and stops when it closes." Herdr documents only that
    timers of an old build stop on reload and that hidden copies keep polling (Herdr AGENTS.md:756-766).
- Change (DOC): write "Pressing the key again should close it (`mod.open` toggles); `Esc` always does." Drop the palette row
  or say "Run `Open mod` from the palette and give the name `attention-picker` (not confirmed on every version)". Replace the
  timer sentence with "the polling runs only inside the dialog's own view" and list it in the DOC-2-1 verification table.
- Verify: rg for the three phrases; each remaining claim either has a Herdr doc line cited in AGENTS.md or sits in the
  "not yet observed" table.
- Owner: documentation (RECIPE.md "Done when" line 92 is HC's: ask for the same softening).

## DOC-2-6 (medium) Docs-to-code drift is only enforced by hand

- Evidence: AGENTS.md "Claim to source map" is a manual table; `scripts/check-docs.mjs` (read in full) checks links,
  external origins, the preview copy and the key name in README/RECIPE only. Numbers repeated in docs: 3000, 60, 4 (README,
  configuration, how-it-works, RECIPE, AGENTS), 320 (usage, RECIPE), 640 (mod.json; README, install, configuration, RECIPE),
  200 and 40 (ask.js; usage, how-it-works), 24 hours and 500 entries (logic.js). validate.mjs pins only the RECIPE side.
  Also the six site pages copy the same `<nav>` and footer by hand with a per-page `aria-current`; nothing compares them.
- Change (HC, `scripts/check-docs.mjs`): (a) read `const NAME = <number|string>` for HOME, POLL_MS, READ_LINES,
  READ_CONCURRENCY, SEEN_KEY, HOME_SPACE_NAME, LIST_H from main.js and `MAX_LEN`, `slice(-40)`, `DAY`, `MAX_SEEN` from ask.js
  and logic.js, and fail when docs/configuration.html lacks a row with that name and value; (b) fail when a docs page
  mentions `3000`/`--lines 60`/`320` and the code constant differs (a small regex list is enough); (c) assert all six pages
  have the same nav `<li>` set and exactly one `aria-current="page"` pointing at themselves. DOC provides the list of
  strings to look for (this file) and updates the pages if the check finds drift.
- Verify: change POLL_MS to 5000 in a scratch copy; `node scripts/check-docs.mjs --root <copy>` must fail naming the page.
- Owner: herdr-completeness (script); documentation (pages).

## DOC-2-7 (medium) Configuration page omits constants and the layout-author side

- Evidence: docs/configuration.html:49-58 lists HOME, POLL_MS, READ_LINES, READ_CONCURRENCY. main.js:34-35,42 also names
  `SEEN_KEY` ("attention.seen"), `HOME_SPACE_NAME` ("~") and `LIST_H` (320); AGENTS.md:17 names six constants, the page
  four. The `~` tile rule is not explained for users anywhere except RECIPE:85. The page documents how to call the mod
  but not how a layout can feed it: the `agents.since` and `space.colors` value shapes are in the table, but there is no
  example of publishing them, and no statement that `agents.since` persists in Herdr's shared state across restarts
  (Herdr stores shared state in `shared.json`, AGENTS.md:86-90) so a stale entry keeps winning (the known D11 limit).
- Change (DOC): add the three rows; add "For layout authors": the exact value shapes, a 6-line `setShared("agents.since",
  { [address]: epochMs })` example marked "only if you track status times yourself", and one sentence on persistence and
  staleness ("write the key every time an agent changes status, and delete entries for agents that are gone"). Add a
  "Home space" paragraph to usage ("a space named `~` gets a dim tile").
- Verify: after DOC-2-6(a) the constants rows are machine-checked.
- Owner: documentation.

## DOC-2-8 (medium) CHANGELOG and README status text are internal and stale

- Evidence: CHANGELOG.md:7-8 and every bullet carry task ids ([R1-CR-2], "[code-review log]") that mean nothing to a reader
  outside this process; :3-5 claims the New/Fixed headings let "an entry be pasted into a herdr.dev listing", but Herdr
  documents `### New` / `### Fixed` for its own app update notes (Herdr AGENTS.md:651-653), not for mod listings; :28 lists
  CI under "New" (see DOC-2-2); the `[0.1.0] - baseline` version number is invented and no entry has a date. README.md:21
  says "Status: round 1 of a hardening pass", which will be wrong the moment round 2 lands and means nothing to a
  stranger. There is no round-2 section.
- Change (DOC): drop the ids from the bullets (keep one footer link to `plans/` for the curious); delete the "paste into
  herdr.dev" claim; keep the Keep a Changelog structure; add round-2 entries as the other roles land (the lists the
  roles post on the board are the source); date the entry at publish. Replace the README status line with the verification
  status from DOC-2-1. Decide the version label with HC's answer on a `mod.json` version field; until then keep
  "Unreleased" and do not invent numbers.
- Verify: `rg -n "R1-|R2-|code-review log" CHANGELOG.md README.md docs` returns nothing.
- Owner: documentation.

## DOC-2-9 (medium) The Pages address is nowhere, README sends readers to raw HTML, llms.txt links are dead until publish

- Evidence: README.md:95-97 links `docs/*.html`, which GitHub shows as source, not as a page. Round-1 board: the privacy scan
  now allows the exact string `<owner>.github.io/herdr-agents-waiting`; no file uses it. llms.txt links go to
  raw.githubusercontent.com/.../main/..., which 404 while the repo is private and until the PRs reach main. There is no
  `docs/404.html`, no favicon (browsers request `/favicon.ico` and get a 404 on every page), no `<link rel="canonical">`,
  no `theme-color`.
- Change (DOC): add the Pages address (that exact allowed string, https) to README ("Documentation site"), llms.txt
  ("Optional") and the docs footer, phrased "once the repository is public and Pages is on" in the README. Add
  `docs/404.html` (same shell, links to the pages) and `<link rel="icon" href="data:,">`-style inline icon in the six
  pages (check-docs skips non-network schemes, so it passes). Keep the raw GitHub links in llms.txt but add one line saying
  they resolve after publication. Add a PUBLISH-CHECKLIST item (HC) "open the Pages URL and click all six pages".
- Verify: `node scripts/check-docs.mjs`; `node scripts/privacy-scan.mjs` (the allowed string only).
- Owner: documentation; herdr-completeness for the checklist item.

## DOC-2-10 (medium) Site accessibility gaps that no script catches

- Evidence: docs/style.css:74 `.table-wrap { overflow-x: auto }` and :68 `pre { overflow-x: auto }` create scroll regions a
  keyboard user cannot focus, and the tables' first column is `white-space: nowrap` (style.css:92), so on a 360 px phone the
  Requirements and Configuration tables do scroll sideways. The `<th>` cells have no `scope`. No `prefers-contrast`/forced
  colours handling for `kbd`/`.note` borders. check-docs.mjs checks lang, title, viewport, charset, alt and no script,
  nothing more. (Colour contrast itself is fine, computed above.)
- Change (DOC): `tabindex="0" role="region" aria-label="..."` on each `.table-wrap` and long `<pre>`; `scope="col"` on
  `<th>`; a `:focus-visible` outline for those regions (the rule exists for links; extend its selector); on narrow screens
  let the first column wrap (`@media (max-width: 480px) { td:first-child code { white-space: normal } }`). Keep it plain
  CSS. HC adds to check-docs: every `.table-wrap` has `tabindex`, every `<th>` has `scope`.
- Verify: open a page at 320 px width and with keyboard only: Tab reaches each table, arrows scroll it; no page-level
  horizontal scroll. Optional: `design:accessibility-review` pass on the six pages.
- Owner: documentation (pages, CSS); herdr-completeness (check).

## DOC-2-11 (medium) AGENTS.md misses gotchas an agent hits on the first day

- Evidence and additions, each from Herdr's own docs unless noted:
  - Start of file: tell round agents to read `plans/round-*/SUMMARY.md` and the board first (AGENTS.md:26 lists the folder
    only).
  - Install step 3: say "copy the whole folder, including `logic.js` (main.js imports it) and both SVGs"; today it only says
    copy the folder.
  - Why `keys.json` has two sections: the more specific `terminal` section wins over `global` (Herdr AGENTS.md:479-480), and
    a `layout:<name>` section can override both, so a conflict may sit there (RECIPE has this, AGENTS does not).
  - Hidden copies keep their timers running; a mod that polls should poll gently (Herdr AGENTS.md:764-766). This mod's poll
    is overlay-only; say so, so nobody adds a background poll.
  - A broken save keeps the old build running and shows only in `herdr-app status` (Herdr AGENTS.md:756-760), which agents
    here may not run: after any edit, the only gate is `herdr-app check` plus reading the diff.
  - Shared state is saved to `shared.json` and persists, so `attention.sort` survives restarts and an `agents.since` left
    by a layout can be stale (feeds DOC-2-7).
  - `node scripts/check-local.mjs` (the one-shot gate: validate, privacy, docs, tests, `herdr-app check`) is not in the
    Testing block (it is in the table at AGENTS.md:24).
  - Under "Do not break": add that the mod reads `props().overlay` and the `closeOverlay` call, because a host that does
    not pass `overlay` falls back to `overlay.close`.
- Change (DOC): add these as bullets in the existing sections; keep the file under ~200 lines.
- Verify: each bullet cites the Herdr line or repo file it comes from; `node scripts/check-docs.mjs`.
- Owner: documentation.

## DOC-2-12 (low) Test-command text still wrong in a code file; engines not declared

- Evidence: mods/attention-picker/logic.js:3 says "`node --test tests/` can load it". I ran both on Node 22.14.0 and 26.5.0:
  `node --test` -> 61 pass; `node --test tests/` -> fails (the directory is loaded as a module). This was already on the
  board in round 1 and is still in the file. package.json has no `engines`, so the docs' "Node 22 or newer" is only a
  statement; Node 20 was never tried.
- Change (CR): reword the logic.js:3 comment to "`npm test`". (HC/CR) optional `"engines": { "node": ">=22" }` in package.json,
  or run `node --test` on Node 20 and state the real minimum. (DOC) once decided, keep README.md:105/147, AGENTS.md:66-75,
  CONTRIBUTING.md:21, llms.txt:29 in step.
- Verify: `rg -n "node --test tests" mods docs *.md` finds only the "do not" sentence in AGENTS.md.
- Owner: code-review (logic.js, package.json); documentation follows.

## DOC-2-13 (low) Troubleshooting and platform notes miss real cases

- Evidence: RECIPE.md:82 ("Fixed size: needs a window about 440px tall") has no counterpart in README or docs, so a small
  window clipping the dialog has no entry. `herdr-app do mod.open '{"name":"attention-picker"}'` (README.md:73,
  docs/troubleshooting.html:25) uses POSIX single quotes; on Windows PowerShell 5 and cmd.exe the JSON needs different
  quoting, and the docs make a point of Windows support. No entry for a `layout:<name>` section overriding the key
  (RECIPE:80). No entry for "I pressed the key inside a terminal program and it reached the program" (the `terminal`
  section is missing).
- Change (DOC): add the four entries; show the command once for POSIX shells and once for PowerShell
  (`herdr-app do mod.open '{\"name\":\"attention-picker\"}'` style, marked "not tried on Windows"), or tell Windows users to
  use the key or the palette. Keep the "not yet tried on Linux/Windows" label on anything OS-specific.
- Verify: anchors exist; each entry names the section/file it points to.
- Owner: documentation.

## DOC-2-14 (low) Small accuracy and consistency fixes

- Search wording: README.md:16 and docs/index.html:31 say search covers "name, program, space, tab and title"; the code
  (logic.js:173) also matches the status words and raw status ("needs you", "finished", "working", "idle"), as usage.html:49
  and RECIPE say. Make the three the same.
- Order of the top list: docs/usage.html:27,52 and RECIPE:16 say "longest-waiting first". buildRows (logic.js:177) orders
  by Herdr's `seq` (lower = changed longer ago), not by the displayed time, which may come from `agents.since`, the tab or
  the first-seen record; the two can disagree. Say "ordered by when Herdr last saw the agent change".
- Install claim: docs/install.html:26 "newer versions should work; an older one may not" is a forecast; replace with "Tested
  on 0.1.12 only."
- Spelling: README/docs/CHANGELOG/CONTRIBUTING use British (colour, licence, recognised: 17 hits); AGENTS.md, RECIPE, the code
  and Herdr use American. Pick American, including the `Licence` heading and the nav text.
- `docs/configuration.html` title says "Props": `props` also carries `overlay`; fine, but list it in the table as
  "supplied by Herdr, read-only".
- Change (DOC) for all; RECIPE:16 is HC's one-line change.
- Verify: `rg -n -i "colour|licence|recognis|behaviour" README.md CHANGELOG.md CONTRIBUTING.md docs` is empty.
- Owner: documentation (HC for RECIPE:16).

## DOC-2-15 (low) Community files for a public repo

- Evidence: no `.github/ISSUE_TEMPLATE/`, no SECURITY.md, no PR template. README and docs ask for the Herdr version and OS in
  issues; a template makes that automatic and keeps terminal text out. The mod reads other terminals' screen text, so a
  security contact is more than decoration.
- Change (HC, `.github/**`): ISSUE_TEMPLATE/bug_report.yml (Herdr version from `herdr-app --version`, OS, steps, "do not paste
  terminal contents"), a PR template with the CONTRIBUTING checklist, and `.github/SECURITY.md` ("report privately through
  GitHub's private vulnerability reporting"; no email address, the privacy scan forbids one). DOC then links them from
  CONTRIBUTING and the troubleshooting "Reporting" section.
- Verify: files exist; check-docs link check passes after DOC links them.
- Owner: herdr-completeness; documentation links.

---

## Handoffs

- To code-review: DOC-2-12 (logic.js:3 comment). Question: does `statusSince`'s seconds-to-ms heuristic (`toMs`, values
  under 1e11) deserve a line in docs? I will not document it unless you want it. Please say if the selection/`seq` ordering
  in DOC-2-14 is intended or if the top list should order by the displayed time.
- To herdr-completeness: DOC-2-2 (workflow file, RECIPE:86, checklist), DOC-2-1 (RECIPE:86 and "Done when"), DOC-2-5
  (RECIPE:92), DOC-2-6 (check-docs additions), DOC-2-9 (checklist item), DOC-2-10 (check), DOC-2-15 (.github files).
- What I will do in the next step, in this order: DOC-2-1, 2-2 (after HC posts the file name), 2-3, 2-4, 2-5, 2-8, 2-11, then
  2-7, 2-9, 2-10, 2-13, 2-14. DOC-2-6 and 2-15 wait for HC.
