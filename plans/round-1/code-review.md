# Round 1 - code-review audit

Scope: `mods/attention-picker/main.js` (270 lines), `ask.js` (24 lines), plus a read of
`keys.json`, `mod.json`, `.gitignore`. Checked against `herdr.d.ts`, `gpui-kit.d.ts` and
`AGENTS.md` in the Herdr app home (read-only). `herdr-app check` on the mod passes today.
There are no tests and no `package.json`. Nothing was run against the live app.

## Summary

The mod works in the author's setup but is not standalone yet. Three things block a
stranger: (1) opening it by key gives no search box, because `mod.open` passes no props;
(2) with no portrait layout there is no `agents.since`, so the "waited" times, the Recent
and Oldest sorts and the "earlier" fold all silently do nothing; (3) the spinner and
search icons are loaded from another mod (`mods/workspace-chrome/`). Beyond that:
the 2 s preview poll can stack, a failed `hc read` leaves "..." forever, the selection
is an index so it jumps when the list reorders, and `ask.js` shows tool-call lines
as "the last message" and misses `(y/n)` prompts. All pure logic is untested; most of it
lives in `main.js` next to `gpui-kit` imports, so it cannot be tested until extracted.

Compatibility contract kept by every proposal below: `props.search`, shared
`attention.sort`, shared `agents.since` (read only, never written by this mod), shared
`space.colors`.

Plan for round 2 (code-review): CR-1-1 to CR-1-8 are the ones to land; the rest are
low-cost riders. Every change keeps `herdr-app check` green.

## Findings

### CR-1-1 (high) Search box missing when opened with its own key
- Evidence: `main.js:57` `this.search = Boolean(props()?.search)`. `mod.open:attention-picker`
  opens the overlay described by `mod.json` and passes no props (herdr.d.ts `run` doc,
  AGENTS.md line 577; `mod.json` overlay accepts size/kind/at/offset only, not props).
  So a stranger's key gives the no-search variant (1-9 jump only).
- Change: `const p = _props ?? props() ?? {}; this.search = p.search !== false;`
  Search becomes the default; an explicit `search: false` (what the portrait layout's
  bell click sends) still gives the keys-only variant. Backward compatible: today's callers
  always pass an explicit boolean through bar-strip (`picker(true)`).
- Owner of files: code-review (`main.js`). Needs: herdr-completeness changes `keys.json` to
  `"ctrl-b a": "mod.open:attention-picker"` (and documents it); documentation notes the default.
- Verify: `herdr-app check`; node test on a small `searchEnabled(props)` helper
  (undefined, `{}`, `{search:false}`, `{search:true}`).

### CR-1-2 (high) Track status times when `agents.since` is absent
- Evidence: `main.js:86,90` `since = shared("agents.since") ?? {}` then `since[a.address] ?? null`.
  Without portrait-tree `since` is always null, so `ago` (line 212) is blank, "recent"/"oldest"
  sort collapse to tree order (line 97), and `old()` (line 100) is never true, so the "earlier"
  fold never appears.
- Change, one pure function `statusSince({ shared, tab, seen, status, now })` with this order:
  1. `shared["agents.since"][address]` when present (portrait compatibility, unchanged);
  2. the agent's tab `changed_at` from `spaces()[].tabs[]` (herdr.d.ts `TabInfo.changed_at`,
     "when something in it last changed state"; exact for a one-agent tab, approximate for
     several, null before the first change);
  3. a local first-seen record `{ [address]: { s, at } }` in `localStorage` (try/catch around
     every access, as the shipped `agents` mod does at `mods/agents/main.js:76`): record `at = now`
     the first time an address is seen with a status, reset when the status changes
     (done and idle count as one, like portrait-tree's `track`), prune addresses no longer
     in `agents()` on each open.
  Never write `agents.since` (a stranger's other mods and the portrait layout own it).
  Known limit to document: the overlay only lives while open, so a transition that happens
  while it is closed is dated by (2) or by the next open. Note a staleness risk: shared values
  persist across layouts, so after leaving the portrait layout `agents.since` is frozen;
  mitigation is `since = (shared value) if it is >= tab.changed_at else tab.changed_at`
  only when the tab holds a single agent. Decide in round 2 after testing; keep it simple
  (precedence above) if the guard adds more than ~10 lines.
- Owner: code-review (`main.js`, new `logic.js`); documentation explains the limit.
- Verify: node tests for each precedence branch and for prune/reset; with the shared key
  removed the "earlier" fold and "Oldest" sort still work in `herdr-app check` render.

### CR-1-3 (high) Spinner and search icon come from another mod
- Evidence: `main.js:154` `svg("mods/workspace-chrome/spinner.svg")`, `main.js:254`
  `svg("mods/workspace-chrome/search.svg")`. If the stranger's Herdr does not ship
  `workspace-chrome` (it is a shipped mod in this install, `installed.json`, but shipped mods
  are Herdr's and can change) or the layout renames/removes it, both icons break. Also breaks
  `mod.clone`'s asset-prefix rewrite promise for this mod.
- Change: add `mods/attention-picker/spinner.svg` and `search.svg` (copy the two small shipped
  files, 269 B and 222 B; both are plain stroke icons, check they contain nothing but path data)
  and reference `mods/attention-picker/<name>.svg`. The portrait layout's bundled copy must
  carry them too (board note to the portrait repo).
- Owner: code-review (assets). completeness: keep them out of `.gitignore`, mention in RECIPE "Built from".
- Verify: `rg workspace-chrome mods/` is empty; `herdr-app check`.

### CR-1-4 (medium) Preview polling can stack, fails silently, reads too much
- Evidence: `main.js:62` `cx.timer.every(2000, ...)` calls `readPreviews`, which only does
  `cx.spawn(...)` and returns at once, so the "interval measured from the end of one call"
  guarantee (gpui-kit.d.ts `Timer.every`) does not cover the spawned work. If `hc` is slow
  (a remote machine, a busy core) every 2 s adds N more parallel `hc read`s, and each task can
  call `this.previews.set`/`cx.notify` out of order.
  `main.js:129` `hc(["read", address])` has no `--lines`, so it pulls the whole screen and
  scrollback; `ask.js:12` only needs the last 40 non-empty lines (`hc read t3 --lines 50` exists,
  AGENTS.md "herdr-core").
  `main.js:130-132` on a failed read nothing is stored, so `said || (ask ? "" : "...")` (line 228)
  shows "..." forever.
  `this.previews` is never pruned (small leak per session, one entry per address ever waiting).
- Change: put the whole loop inside one `cx.spawn` guarded by `this.reading`
  (skip the tick while a pass runs); pass `["read", address, "--lines", "60"]`; on failure store
  `{ status, text: "" }` so the placeholder goes away; delete entries whose address is no
  longer waiting; poll every 3000 ms; limit concurrency to 4 reads per pass; skip the pass when
  nothing is blocked or done.
- Owner: code-review. Verify: add a test seam (`readPreviews` takes `readFn`) or review by
  reading; manual: kill `hc` path in a scratch env is not allowed, so rely on the guard test
  with a fake slow `readFn`.

### CR-1-5 (medium) Selection is an index, so it jumps when the list reorders
- Evidence: `main.js:55,163-164,235-236` `this.at` indexes `picks`. Agents change state while
  the dialog is open (that is its whole job); an agent becoming blocked is inserted above and
  the highlighted row slides to a different agent, then Enter focuses the wrong one.
  `main.js:67` (`submit`) also recomputes `agentRows()` with an unclamped `this.at`.
- Change: keep `this.selected` (agent address, or `"earlier"`); derive the index in render
  (`picks.findIndex`), fall back to 0 when it is gone; ArrowUp/Down move by index then store the
  address; `submit` uses the same derived row. Reset to first row only on search change and sort
  change (as now).
- Owner: code-review. Verify: unit test of `moveSelection(picks, selectedKey, delta)` and
  `resolveSelection`.

### CR-1-6 (medium) "Finished" preview shows tool-call lines
- Evidence: `ask.js:19-22`. Verified with node: `askOf("● Fixed it.\n● Bash(npm test)\n", "done")`
  returns `"Bash(npm test)"`; Claude Code and similar draw every tool call with the same `●`.
  The done row should say what the agent concluded, not the last command it ran.
- Change: in the message loop skip lines whose body looks like a call (`/^[A-Z][A-Za-z]*\(.*\)?$/`,
  also the `Bash(`/`Read(`/`Update(` family and `⎿` continuation lines already removed by BOX
  cleaning only if prefixed; add `⎿` to the strip set); fall back to the last call line only if
  no prose line exists.
- Owner: code-review (`ask.js`). Verify: unit tests (fixtures below in CR-1-8).

### CR-1-7 (medium) `ask.js` misses common blocked prompts and ANSI
- Evidence: `ask.js:16` requires the line to end in `?`. Verified: `"Apply these changes? [y/N]"`,
  `"Continue? (y/n)"` return the previous `●` line (or ""), and a line wrapped in SGR codes
  (`"\x1b[1mProceed with install?\x1b[0m"`) returns "".
- Change: strip `\x1b\[[0-9;?]*[ -/]*[@-~]` first; treat a trailing option hint
  (`\s*[\[(][yYnN](?:\/[yYnN])?[\])]\s*$`) as part of a question ending in `?`; keep the
  `l.length > 4` and `^\?` guards. Also cap the returned text at ~200 chars (the row truncates, but
  the Map holds whatever the screen had).
- Owner: code-review. Verify: unit tests.

### CR-1-8 (medium) Extract pure logic and add `node --test` tests
- Evidence: `duration`, `clean`, `nameOf`, `spaceColor`, the row builder (`rows()` lines 84-120),
  sort comparators and the planned `statusSince`/selection helpers are all in `main.js`, which
  imports `gpui-kit`/`herdr` and cannot load in node. `ask.js` can, but needs ESM detection:
  `.js` with `export` fails on Node < 22.7 without `"type": "module"`.
- Change: new `mods/attention-picker/logic.js` (pure: `duration`, `nameOf`, `statusSince`,
  `buildRows({agents, spaces, since, query, sort, showEarlier, now})`, `nextSort`, `pickSearch`,
  `moveSelection`), `main.js` imports it (the mod loader accepts sibling modules, as it does
  `./ask.js`). `tests/ask.test.mjs`, `tests/logic.test.mjs` using `node:test` + `node:assert`,
  no dependencies. Add a root `package.json` (`"private": true, "type": "module",
  "scripts": {"test": "node --test tests/"}`; no dependencies, no personal data). `package.json`
  is not on anyone's list; code-review will add it in round 2 and tells completeness on the board.
  Cases to cover: duration boundaries (59s, 60s, 59m, 24h); `nameOf` (path titles, `@` titles,
  numeric tab names, Windows `C:\` titles, title equal to program name); sorts and the "earlier"
  fold at exactly 24 h; search opening "earlier"; stable order for equal `since`; `askOf`
  (question box, numbered options, `(y/n)`, ANSI, CRLF, tool-call lines, empty/undefined input).
- Owner: code-review; completeness: CI (`.github/`) should run `node --test tests/` and
  `herdr-app check` if available; documentation: CONTRIBUTING gets `npm test`.
- Verify: `node --test tests/` exits 0.

### CR-1-9 (low) Search matches one literal substring only
- Evidence: `main.js:91` joins name/program/space/tab and checks `includes(q)`: "claude api"
  does not match name "api" + program "claude" in a different order; the agent's raw `title`
  is not searched when `nameOf` picked the tab name.
- Change: split the query on whitespace, require every token (AND), add `a.title` and status
  words (`needs you`, `finished`) to the haystack.
- Owner: code-review. Verify: unit tests in `buildRows`.

### CR-1-10 (low) `close()` shadows the View cleanup hook; unguarded `props().overlay`
- Evidence: `main.js:138` defines `close()`; `gpui-kit.d.ts:558` reserves `close?(cx)` as the
  host's final cleanup call. It currently works only because the second `closeOverlay` is a
  no-op (the shipped `picker` does the same), but `props()` may be empty then.
- Change: rename to `dismiss()`; `const id = props()?.overlay; if (id) closeOverlay(id);`.
- Owner: code-review. Verify: `herdr-app check`.

### CR-1-11 (low) Render does repeated work; small keyboard gaps
- Evidence: `main.js:160-161,122,67` `rows()` runs once per render plus once per submit;
  `main.js:210` `picks.filter(...).indexOf(r)` runs per row (O(n^2)); lines 214 and 239
  recompute the same non-"earlier" list. Tab only cycles forward (`main.js:238`).
- Change: compute rows once per render and keep it in `this.cache` for the key handlers;
  precompute the 1-9 number per pick in one pass; Shift+Tab goes back through `SORTS`.
- Owner: code-review. Verify: tests for `nextSort(current, dir)`.

### CR-1-12 (low) Empty state wording
- Evidence: `main.js:167-168,257` with no agents at all the title and body both read
  "Nothing needs you right now"; in a fresh standalone setup that reads like a bug.
- Change: no agents: title "No agents running", body "Start one and it will show here";
  agents but none waiting: keep today's wording. Ask documentation to mirror in README/docs.
- Owner: code-review (strings).

## Not proposed (checked, fine)
- Zoom division in `on_size_change` (`main.js:259`): AGENTS.md says the reported size is
  unzoomed, same pattern as shipped `picker`. Keep.
- All gpui-kit calls used (`tooltip`, `border_t`, `spin`, `on_scroll_wheel`, `on_size_change`,
  `cx.timer.after/every`, `focus_handle`) exist in `gpui-kit.d.ts`; timers are owned by the view,
  so they end with the overlay. No `setTimeout`/`setInterval` anywhere. No exec besides `hc read`.
- No personal data found in the repo files (no paths, names or emails in the three code files).

## Cross-role hand-offs (also posted on the board)
- herdr-completeness: `keys.json` -> `mod.open:attention-picker`; `.gitignore` already fine;
  CI to run `node --test tests/`; new files `spinner.svg`, `search.svg`, `logic.js`, `package.json`,
  `tests/` appear in round 2; RECIPE "Built from" must list them and the `localStorage` use.
- documentation: search is on by default, status-time precedence (CR-1-2), `localStorage` and
  `hc read` usage disclosure, test command.
- portrait repo: when syncing the bundled copy, take the two svg files and `logic.js` too.
