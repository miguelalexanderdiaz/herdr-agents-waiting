# Round 1 audit: documentation

Role: documentation. Owns README.md, docs/**, AGENTS.md, llms.txt, CHANGELOG.md, CONTRIBUTING.md.
Audited at commit 207ebe6 (main). Files read: mods/attention-picker/{main.js,ask.js,mod.json}, keys.json,
.gitignore, the Herdr references (~/.config/herdr-app AGENTS.md, herdr.d.ts, `herdr-app commands`/`--help`),
the shipped mods that interact with this one (bar-strip, portrait-tree, workspace-chrome, help).
Ran only: `herdr-app check` on the mod (passes), and `node` on ask.js with sample screens.

## Summary

The repo has no documentation at all: no README, docs/, AGENTS.md, llms.txt, CHANGELOG or CONTRIBUTING, and no
screenshot. Everything I would document is verified against the source below. Three facts shape what the docs can
honestly say today and need decisions from the other roles before I write them:

1. The only way in is `keys.json` -> `bar-strip.attention`, a command of a mod that a stranger does not have.
2. Without portrait-tree's shared "agents.since" the mod shows no durations, never folds "earlier", and its
   Recent/Oldest sorts collapse into Space order (main.js:86,90,97,100,212).
3. The mod draws two icons from `mods/workspace-chrome/` (main.js:154,254), a different mod.

Plan for this round: write all six deliverables for the behavior that exists after the other two roles' round-1
changes (I will read their branches/board posts and re-verify every claim before finishing), keep a "Known
limitations" list for whatever does not land, and add a docs-vs-code check list (DOC-1-12) so the second round can
re-verify cheaply.

Verified behavior (the facts the docs will be built from):
- Dialog, 640 px wide, `place: none` (mod.json). List area max 320 px high, scrolls (main.js:24,178-188).
- Top block: agents with status `blocked` ("needs you") then `done` ("finished"), longest waiting first
  (`seq` ascending, main.js:92), each with a 2-line row: name, status word, time waited (only if a start time is
  known), space and tab; second line = preview of what the agent asks (main.js:221-228).
- Rule, then every other agent (working, idle, unknown) grouped under space heads with the space's colour
  (shared "space.colors", default teal `ansi6`, a space named "~" is dim, main.js:46-50), ordered by the sort.
- "earlier: N agents idle for over a day": non-working, non-focused agents whose known start time is older than 24 h,
  folded; Enter or click toggles; a non-empty search opens it (main.js:100,114-118,148).
- Sort: Recent (latest activity first), Oldest (longest idle first), Space order (tree order); Tab or the Sort button
  cycles; persisted in shared "attention.sort"; any other value reads as "recent" (main.js:19-22,140-144).
- Search (only with `props.search` truthy): matches name, program, space name, tab name, case-insensitive
  (main.js:91). Without it: keys only, with 1-9 jump badges (1-9 skip the "earlier" row, main.js:214,239).
- Keys: Up/Down (wrap), Enter, Tab, Esc, 1-9 (no search box only; ignored with ctrl/cmd held) (main.js:232-243).
- Pick = `run("agent.focus", { terminal: address })` then close (main.js:149-151).
- Title: "N agents need you" / "N finished" / "Nothing needs you right now" (main.js:167-168); "No match" when a search
  finds nothing (main.js:257).
- Preview: every 2 s while open, `hc read <address>` for each blocked/done agent; the visible screen only (hc read
  default `--lines 0`); last 40 non-empty lines; box-drawing characters stripped; blocked -> last line ending in "?"
  (optionally prefixed by a selector arrow or "1.") else the last "●/⏺/•" line; done -> the last "●/⏺/•" line;
  otherwise empty (ask.js:6-24, main.js:62,124-135). "…" shows until the first read returns (main.js:228).
  Checked with node: a Claude-Code-style question screen -> "Do you want to proceed?"; "● ok" -> "" (too short).
- Network/exec/files: none. No `fetch`, `exec`, `readTextFile`, `fs`, `localStorage`. The only external effects are
  `hc read`, `run("agent.focus")`, `closeOverlay`, `setShared("attention.sort")`. Screen text stays in memory.
- Name shown for an agent: its title unless it looks like a path, contains "@" or equals the program name; else a named
  tab; else the program (main.js:38-43).

## Findings

### DOC-1-1 (high) Entry point is another mod's command; install docs cannot be written truthfully
- Evidence: keys.json:1 `"ctrl-b a": "bar-strip.attention"`; the command is handled by bar-strip
  (bar-strip/main.js:22-27,44), absent for a stranger. `mod.open` exists and toggles a mod "as the overlay its
  mod.json describes" (`herdr-app commands`, AGENTS.md "App").
- Change: keys.json -> `"ctrl-b a": "mod.open:attention-picker"` (or another key, see below). In docs I will show
  three ways to open it: the key, the command palette (`app.palette`, "mod.open attention-picker"), and
  `herdr-app do mod.open '{"name":"attention-picker"}'`. Bar-strip must keep working: it opens the overlay itself with
  props `{search:true}` (bar-strip/main.js:44), unaffected.
- Open question for herdr-completeness: `ctrl-b` is a tmux-style prefix in the author's keys.json (38 `ctrl-b ...`
  entries, and the help mod calls it "Herdr's prefix"). I could not prove it is a Herdr default for every user.
  Please decide: keep `ctrl-b a` (docs will say "needs the ctrl-b prefix chord, which Herdr's default keys use; if
  yours differs, bind any key to mod.open:attention-picker") or ship a prefix-free key. I will document whatever
  keys.json says and the merge rule from Herdr's AGENTS.md ("merge it into the person's keys, ask before replacing").
- Owner: herdr-completeness (keys.json). Docs: README "Open it", docs/install, AGENTS.md install steps.
- Verify: `node -e 'JSON.parse(require("fs").readFileSync("keys.json"))'`; grep that the key named in README equals keys.json.

### DOC-1-2 (high) Standalone behavior must be stated honestly; the time tracker design needs a decision
- Evidence: main.js:86 reads only shared "agents.since"; main.js:90 `since: ... ?? null`; :97 sorts by `since ?? 0`
  (all equal -> tree order); :100 `old` needs `r.since`; :212 hides the duration when null. portrait-tree is the only
  writer (portrait-tree/main.js:107).
- Important constraint for the code fix: this mod is an overlay, alive only while open, so it cannot observe state
  changes while closed. Options for code-review: (a) first-seen = time the dialog opened (cheap, wrong for old
  agents), (b) derive from `TabInfo.changed_at` / `working_since` in herdr.d.ts (per tab, real timestamps, no
  background process), (c) a tiny second hidden mod that tracks and publishes agents.since (changes the install:
  two mods). I recommend (b) with first-seen fallback, persisted in `localStorage`; whichever is chosen, I document it
  in docs/how-it-works and the Known limitations.
- Change (docs): until the tracker lands, README/docs state: "times, the earlier fold and Recent/Oldest need
  shared agents.since (the portrait layout provides it)". After it lands, describe the source, and say exactly what
  "recent" means.
- Owner: code-review (main.js). Docs: usage, configuration, how-it-works, AGENTS.md compatibility contract.
- Verify: with shared "agents.since" absent, rows show a duration (or the documented absence), and Sort order
  differs between Recent and Oldest; a unit-level check of the pure sort/fold function if code-review extracts one.

### DOC-1-3 (high) Hidden dependency on workspace-chrome's icons
- Evidence: main.js:154 `svg("mods/workspace-chrome/spinner.svg")`, main.js:254 `svg("mods/workspace-chrome/search.svg")`.
  Those files exist in Herdr's shipped mod (read-only, replaced on start), not in this repo. `herdr-app check` passes
  because it only renders eagerly; a missing svg is silent.
- Change: ship `spinner.svg` and `search.svg` inside `mods/attention-picker/` and reference
  `mods/attention-picker/<file>.svg` (Herdr rewrites a clone's own `mods/<name>/` paths on mod.clone). Until then docs
  list "Herdr's shipped workspace-chrome mod present" as a requirement.
- Owner: code-review (main.js edit + two svg assets). herdr-completeness: confirm licence/NOTICE if the svg
  are copied from Herdr's set (they ship from Herdr; draw fresh ones if the licence is unclear).
- Verify: `rg 'workspace-chrome' mods` returns nothing; `herdr-app check` passes.

### DOC-1-4 (medium) Default input mode differs between the two ways of opening it
- Evidence: main.js:57 `this.search = Boolean(props()?.search)`; opened by mod.open there are no props, so there is
  no search box and typing does nothing (keys only, with 1-9). Bar-strip always passes `search: true`.
- Change: for standalone use the search box is the better default: `props()?.search !== false`; keep `search:false`
  as the way to ask for the keys-only list (backward compatible: bar-strip passes true). Docs then describe both
  modes and the prop. If code-review keeps the current default, docs say so and README leads with that.
- Owner: code-review. Docs: usage, configuration (props table).
- Verify: open via mod.open; the search box is focused (main.js:68-69 retries focus after 300 ms).

### DOC-1-5 (medium) Header comment and strings describe the author's setup, not the mod
- Evidence: main.js:1-6 "Opened by ctrl-b a and by shift-clicking the bell in the bar strip"; main.js:169 hint text.
  Code comments are read by agents adapting the mod (AGENTS.md will point at them).
- Change: rewrite the header comment: what it is, props (`search`), shared keys read/written, how it is opened
  generically; keep one line noting the portrait layout's bar-strip as a known caller.
- Owner: code-review. Docs: AGENTS.md links to the header as the contract.
- Verify: `rg -n 'bar strip|ctrl-b' mods` only in the "known callers" line.

### DOC-1-6 (medium) No tests, so "how to test" in CONTRIBUTING/AGENTS.md has nothing to point at
- Evidence: `git ls-files` shows no tests; ask.js is pure (ask.js:4 "Pure: node can run it"), and imports fine in
  Node 26. No package.json, so `.js` with `export` relies on Node's module-syntax detection (on by default from
  Node 22.7 / 20.19; older Node throws "Unexpected token 'export'" (not verified here, only Node 26 available)).
- Change: code-review adds `tests/ask.test.mjs` using `node:test` with fixtures (question screen, selector list,
  done message, too-short, no match, box characters, Windows CRLF screens: ask.js splits on "\n" only, a trailing
  "\r" survives the trim? `.trim()` strips it, so fine, but cover it), plus a root `package.json`
  `{"private":true,"type":"module","scripts":{"test":"node --test tests/"}}`. I document `node --test`, and
  `herdr-app check <abs path to mods/attention-picker>` as the second gate; a CI job (completeness) can run both.
- Owner: code-review (tests/, package.json); herdr-completeness (CI wiring in .github/).
- Verify: `node --test tests/` green on Node 22 and 26; CONTRIBUTING's command pastes and works.

### DOC-1-7 (medium) Preview extraction only fits agents that draw "●" lines; docs must set expectations
- Evidence: ask.js:19-22 matches only `●`, `⏺`, `•` at the start of a line; blocked questions need a trailing "?"
  (ask.js:16). Other agents' screens (codex, pi, plain shells) will show an empty second line.
- Change: docs/usage and README say "preview is best effort: tested with Claude Code style screens; other agents may
  show a blank line, the row still works". Ask code-review whether to extend patterns (e.g. "> " prompts,
  numbered "Allow?" selectors without "?") and to keep the list of recognised markers in one const that
  AGENTS.md can name. I will not claim support for any agent I cannot show a fixture for.
- Owner: code-review (ask.js + fixtures), documentation (claims).
- Verify: each agent named in the docs has a fixture in tests/.

### DOC-1-8 (medium) Privacy/safety disclosure Herdr asks installers to give
- Evidence: Herdr's AGENTS.md "Layouts and mods other people made" step 1: "tell the person if a mod reaches the
  network, runs programs (exec, hc) or reads files outside its own folder." This mod runs `hc read` (main.js:129),
  nothing else (verified by `rg -n "exec|fetch|readTextFile|writeTextFile|fs/|localStorage|process" mods`: no hits
  except `hc` and a regex).
- Change: README "Privacy" section and AGENTS.md "Tell the person first" block with this exact disclosure; RECIPE.md
  (completeness) should repeat it in "Watch out". Re-verify with the same rg before finishing, because
  DOC-1-2 (localStorage or a tracker) may change the answer.
- Owner: documentation (README, AGENTS.md); herdr-completeness (RECIPE.md).
- Verify: the rg command above matches the disclosure after every code change.

### DOC-1-9 (medium) Screenshot and the Pages site: assets and enabling steps
- Evidence: no preview.png in the repo (herdr-completeness owns it). GitHub Pages serving from `main /docs` cannot see
  files outside docs/, so the site needs its own copy, `docs/assets/preview.png`. Enabling Pages is a repo setting I
  must not change (hard rule 4), and the repo is private (Pages on private repos needs a paid plan).
- Change: docs/ gets a copy of preview.png (I copy it once it exists); a `scripts/check-docs.mjs` (completeness owns
  scripts/) verifies `cmp preview.png docs/assets/preview.png`, that no docs page references an external origin, and
  that every relative link resolves. README "Publishing" note for the author: Settings -> Pages -> Deploy from a
  branch -> main /docs. The site is plain HTML+CSS, `.nojekyll`, no JS needed, light/dark via `prefers-color-scheme`,
  mobile width, skip link, `lang`, headings in order, contrast checked.
- Owner: documentation (docs/); herdr-completeness (preview.png, scripts/check-docs.mjs).
- Verify: open docs/index.html via file:// and at 360 px width; the check script exits 0.

### DOC-1-10 (medium) Compatibility contract with the portrait layout must be written down
- Evidence: this repo is canonical; ../herdr-portrait-layout/mods/attention-picker is currently byte-identical
  (`diff -rq` clean). Shared surfaces: prop `search`; shared "attention.sort" (recent|oldest|space; invalid reads as
  recent, main.js:22); shared "agents.since" (map address -> epoch ms, read only); shared "space.colors" (map space id ->
  ansi name or #hex, read only, main.js:46-50); the mod folder name `attention-picker` (bar-strip opens it by name).
- Change: AGENTS.md section "Do not break (the portrait layout depends on it)" with that table and the sync
  procedure (copy `mods/attention-picker/*.js`, `mod.json` and assets; never the Herdr-written gpui-kit.d.ts and
  jsconfig.json), docs/configuration lists them as "shared keys". Asking round-lead/code-review to state if round
  sync adds fields (e.g. a new prop) so docs list them.
- Owner: documentation (AGENTS.md, docs); code-review (must not rename these).
- Verify: `rg -n 'shared\("|setShared\("|props\(\)' mods` lists exactly the documented keys.

### DOC-1-11 (low) Real name in git history and the owner name in links
- Evidence: commit 207ebe6 author is the owner's real name plus a GitHub noreply email (`git log -1 --format=%an%n%ae`).
  Hard rule 3 allows a real name only in the LICENSE copyright line. History cannot be rewritten on main (no force
  push), and the owner/repo string `miguelalexanderdiaz/herdr-agents-waiting` is unavoidable in clone URLs,
  `herdr.dev/mods/<owner>/<name>` links and llms.txt (Pages URL).
- Decision (documentation): I use that exact owner/repo string only where a working URL needs it, in README, docs and
  llms.txt, and nowhere else. herdr-completeness's leak scan should allow-list exactly that string and flag the
  rest; commit-author metadata is theirs to judge.
- Owner: herdr-completeness.
- Verify: `rg -n "miguelalexanderdiaz" .` only returns lines containing `miguelalexanderdiaz/herdr-agents-waiting`
  (plus the LICENSE line if the copyright uses the handle).

### DOC-1-12 (low) Make the docs verifiable, and what "cross-OS" can honestly claim
- Evidence: the mod is pure JavaScript with no OS API; the only OS-dependent bits are keys (cmd vs ctrl) and Windows
  path handling in nameOf (main.js:40, `^[A-Za-z]:\\`). Herdr itself: macOS needs Apple Silicon for releases (Intel
  builds from source); Linux and Windows are supported (Herdr AGENTS.md "Updates"). Only macOS was run by the author.
- Change: README "Requirements" table (OS / what is needed) states: Herdr app >= the version checked (0.1.12 here),
  `hc` on PATH (Herdr's own core, used by `hc read`), no Node, no network; claims "tested on macOS" and "no
  OS-specific code" only, never "tested on Windows/Linux". docs gets `docs/checklist.md`-style source map (claim ->
  file:line) in AGENTS.md so round 2 can re-verify quickly; line numbers are listed per claim.
- Owner: documentation. herdr-completeness: confirm the minimum Herdr version in mod.json/RECIPE.md, if
  mod.json can carry one (not shown in the types).
- Verify: every number or key quoted in the docs matches a grep of the source (listed in AGENTS.md).

### DOC-1-13 (low) Herdr gotchas worth putting in AGENTS.md (all from Herdr's own docs, verified)
- Saving any file in a mod folder hot-reloads it; editing the live folder under ~/.config/herdr-app changes the
  user's screen at once, so agents work in a clone/copy and install last.
- `herdr-app check` does not lay out the mod nor run deferred rows or later async states; also try it in the app.
- Never keep a `cx` for later; no setTimeout/setInterval (the mod uses `cx.timer`); no top-level await; no Node APIs.
- svg/image paths are relative to the Herdr home (`mods/<name>/x.svg`), so installing under another folder name breaks
  assets and bar-strip's `openOverlay({mod:"attention-picker"})`; `mod.clone` rewrites own paths and self-opening names.
- `herdr-app check` and the app write `gpui-kit.d.ts` and `jsconfig.json` into the mod folder: they are gitignored
  and not part of the mod; (the check I ran just created them locally in mods/attention-picker/, ignored by git).
- Mod `localStorage` is per mod copy; shared keys persist in shared.json; unknown shared values must degrade.
- If a mod name already exists, rename; never overwrite; merge keys.json, ask before replacing a key.
- Owner: documentation (AGENTS.md).

### DOC-1-14 (low) CHANGELOG and versioning
- Evidence: mod.json has no version; installed.json tracks hashes, and `cloned_from` records `{name, version}`, so a
  version helps people who clone. Herdr's own changelog format is `### New` / `### Fixed`.
- Change: CHANGELOG.md in Keep-a-Changelog style with `## [Unreleased]` for round work and `## [0.1.0]` for the
  imported baseline, using Herdr's New/Fixed headings so the same text can be pasted into a herdr.dev listing.
  Ask herdr-completeness whether mod.json may carry `"version"` (unverified: not in herdr.d.ts, check by running
  `herdr-app check` on a mod.json with the field).
- Owner: documentation (CHANGELOG); herdr-completeness (mod.json).
- Verify: every Unreleased bullet maps to a commit in the round.

## Deliverables I will write (order)
1. README.md (what, screenshot, install by agent and by hand, keys, requirements per OS, privacy, troubleshooting, uninstall)
2. AGENTS.md (install/adapt/test/edit safely, disclosure, compatibility contract, gotchas, claim -> source map)
3. docs/ site: index (overview), install, usage, configuration, troubleshooting, how-it-works, style.css, .nojekyll
4. llms.txt, CHANGELOG.md, CONTRIBUTING.md

## Notes
- `git pull --ff-only` printed "fatal: Cannot fast-forward to multiple branches" (the local clone's fetch config has more
  than one ref; `git status` says main is up to date with origin/main). Not changed, since I must not touch git state.
- Permission checks: nothing denied so far.
