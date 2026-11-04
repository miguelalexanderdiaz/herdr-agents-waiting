# Round 1 - code-review log

Branch: `feat/round-1-standalone-picker--code-review` (from `feat/round-1-standalone-picker`).
Commits: `228c030` (logic.js, ask.js, icons, package.json, tests), `81f2c7d` (main.js).
Files touched: `mods/attention-picker/{main.js,ask.js,logic.js,spinner.svg,search.svg}`, `package.json`, `tests/*.test.mjs`, this log.

## Done (task ids)

- R1-CR-1 search default and dismiss: `pickSearch(props)` in logic.js (`props?.search !== false`); `close()` is now `dismiss()`, guarded
  (`props()?.overlay`, falling back to the `overlay.close` command, which exists in `herdr-app commands`). Tested for undefined, null, {}, true, false.
- R1-CR-2 status times: `statusSince` (shared agents.since > tab working_since/changed_at > local first-seen), `parseSeen`, `trackSeen`
  (reset on group change, done and idle are one group, prune only while agents exist). localStorage key `attention.seen`, every access in try/catch,
  written only when changed. Tab times that look like seconds (< 1e11) are scaled to ms (unit of `changed_at` is not documented; defensive).
  agents.since is never written.
- R1-CR-3 icons and HOME: own `spinner.svg` and `search.svg` (24x24, currentColor, circle/path only), loaded via `${HOME}/...`; `workspace-chrome` appears nowhere in mods/.
- R1-CR-4 polling: `createPreviewReader` (one pass at a time, concurrency 4, failed or throwing read stores empty text, entries pruned, nothing read when nothing waits).
  `POLL_MS=3000`, `READ_LINES=60`, `READ_CONCURRENCY=4`; the timer handler returns early while a pass runs or after dismiss.
- R1-CR-5 selection by key (`resolveSelection`, `moveSelection`), rows built once per render (`view()`), 1-9 numbers precomputed in one pass, Shift+Tab reverses the sort (`nextSort(current, dir)`), mouse wheel follows by key.
- R1-CR-6 ask.js: ANSI (CSI and OSC) stripped, CR/CRLF, `(y/n)` `[y/N]` `(yes/no)` hints accepted, tool-call lines skipped for the message preview (fallback to the last call only if no prose), 200-char cap, `MARKERS` const.
- R1-CR-7 tests: 61 tests, `tests/ask.test.mjs` and `tests/logic.test.mjs`, `package.json` (`{"private":true,"type":"module","scripts":{"test":"node --test"}}`).
- R1-CR-8 multi-word AND search over name, program, space, tab, terminal title and status words; empty-state strings ("No agents running" / "Start one and it will show here").
- R1-CR-9 header comment rewritten as a contract (props, shared keys, command, how it is opened, where times come from, one "known callers" comment line); `HOME_SPACE_NAME`; contrast.

## Deviations from the plan

- Test command: the plan says `node --test tests/`. On Node 22+ (checked on Node 26.5) a directory argument is loaded as a module and fails
  ("Cannot find module .../tests"). `package.json` uses `node --test` with no argument (auto-discovers `tests/*.test.mjs`); `node --test tests/*.test.mjs` also works.
  Posted on the board; docs, CI and RECIPE must not say `node --test tests/`.
- Contrast fix (cheap, so done now): initials on space tiles used white, 2.8-3.4:1 on the six MARK colours. `inkOn(bg)` picks white or #111111 by contrast (>= 6.2:1 on all six).
- Extra bug fixed (not in the audit): `nameOf` tested the path rule on the title after `clean()` had removed the leading `~` or `/`, so path titles passed as names.

## Deferred

- Contrast of the 11px `dim` text and `muted` preview text on light themes: those colours come from `theme()` at run time; they cannot be computed without driving the app. Round 2 idea: compute from `themes()` in a unit test (pass in the theme map) or fall back to `muted` when `contrast(dim, popover) < 4.5`.
- Skipping a re-read when an agent's `seq` did not change (suggested by the portrait repo reviewer): a blocked agent can show a new question without a status change, so a stale preview is possible; not done without a real-screen observation.
- D11 `agents.since` staleness guard (per the plan).
- Address reuse: if Herdr reuses an address (e.g. after a restart) while the list is momentarily empty, an old first-seen record could be reused; records are pruned only while some agent exists. Low impact, listed for round 2.
- Row building runs on every render (cheap, O(n log n)); no memoization across renders because agents()/spaces() are live and cheap to compare is not worth the staleness risk.

## Checks run

| Check | Result |
|-------|--------|
| `node --test` (61 tests) | pass 61, fail 0 (Node 26.5, macOS) |
| `node --test tests/` | FAILS on this Node (see deviation) |
| `herdr-app check <abs>/mods/attention-picker` | check passed (after both commits) |
| `rg workspace-chrome mods/` | no hits |
| `rg "bar strip|ctrl-b|bar-strip|portrait" mods/attention-picker/*.js` | hits only on `//` comment lines |
| folder name `mods/attention-picker` in main.js | once, in `HOME` |
| `rg "fetch\(|exec\(|readTextFile|writeTextFile" mods/` | no hits |
| personal data scan (`/Users`, emails, names) in changed files | none (the `@` in the code is the user@host title rule and an ANSI regex) |
| Not run: anything against the live app (not allowed); real `localStorage`, `hc read` and key events are therefore unverified at run time; `herdr-app check` renders the first frame only. |

## Handoffs for round 2

- Someone with a running Herdr and no portrait layout should open the picker with the bound key and confirm: search box focused, waiting times appear after a status change, Shift+Tab, Esc closes (the `overlay.close` fallback is only used if `props().overlay` is missing).
- Confirm `TabInfo.changed_at` unit (ms vs s) and whether it moves for unrelated tab events; adjust `statusSince` if it lies.
- Portrait repo: sync `main.js, ask.js, logic.js, spinner.svg, search.svg, mod.json`; add a test that compares its `nameOf`/`duration` with `logic.js`.
- completeness: validate.mjs can treat `localStorage` and `hc(` as allowed only in main.js; CI must run `npm test` / `node --test`, not `node --test tests/`.
- documentation: quote constants from the board message "G1 code landed"; empty-state strings are in `emptyState()`.
