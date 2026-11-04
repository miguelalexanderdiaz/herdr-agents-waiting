# Round 2 audit: code-review

Base: feat/round-1-standalone-picker at b7fcb3f. Read: every file under mods/, tests/, package.json, scripts/validate.mjs, RECIPE.md, plans/round-1/*, plus herdr.d.ts, gpui-kit.d.ts and AGENTS.md of the Herdr app (read only).

## Summary

Round 1 left the pure logic well covered (61 tests, all green on Node 26.5) and the mod is clean against the Herdr rules I could check: no setTimeout/setInterval, no stored `cx`, no polling of live data, `close()` not shadowed, every `herdr` call exists in herdr.d.ts, `localStorage` is a documented built-in. Two things stand out.

1. **`main.js` is never executed by any test.** All 61 tests load `logic.js` and `ask.js` only. Everything round 1 claimed about keys (Tab / Shift+Tab, 1-9, Enter, Esc, dismiss fallback), the search default, the empty states and the shared-key contract is backed by code reading and `herdr-app check` (which does not run `render`). I built a throwaway stub harness in a scratch folder and ran main.js under node: render works with mixed, empty and keys-only inputs, and the key flows behave as RECIPE says. So the claims hold today, but nothing keeps them true. The same run found two real faults (CR-2-2, CR-2-6).
2. **The header counts and the stale-`agents.since` case are the user-visible bugs.** The title ("2 agents need you") is computed from the *filtered* rows, so typing in the search box changes it; and a persisted `agents.since` left behind by a previous portrait layout beats every other time source forever (D11, deferred from round 1).

Everything below is sized for one round. All code changes stay in `mods/attention-picker/{main.js,logic.js,ask.js}`, `tests/**` and `package.json`, which code-review owns. No constant that RECIPE / validate.mjs quotes (`POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, `LIST_H`, `HOME`, `SEEN_KEY`) changes value. No new shared key, no new exec, no new file access. The portrait sync file list does not change (main.js, ask.js, logic.js, the two SVGs, mod.json).

## Findings

### CR-2-1 (high) main.js has no test; add a stub harness that runs it

- Evidence: `tests/` imports only `logic.js` and `ask.js` (tests/logic.test.mjs:3-8, tests/ask.test.mjs:3). `main.js` (271 lines: key handler 231-242, `dismiss` 130-135, `go` 143-148, title 161-164, scroll maths 169-189, `init` 59-88) is untested. validate.mjs checks main.js by regex on its text only (scripts/validate.mjs "contract" block), so renaming `setShared("attention.sort", ...)` into a variable would pass tests and break differently.
- Verified feasible: in a scratch folder I registered a resolve hook that maps `gpui-kit`, `gpui-base` and `herdr` to stub modules (a chainable Proxy element whose `.when(c, f)` applies `f`, whose `.child/.children` record), then `import()`ed the real main.js, called `init({}, cx)`, `render()`, and drove the root `on_key_down` handler. It ran on Node 26.5 with `module.register`. It exercised: search mode and `{ search: false }`, empty agent list, down/up, Tab and Shift+Tab (`attention.sort` cycles both ways), `2` jumping to the second pick, Enter, fallback `overlay.close` plus `agent.focus`.
- Change:
  - `tests/helpers/loader.mjs`: resolve hook for the three module names, installed with `module.registerHooks` when present (Node 22.15+/23.5+) else `module.register` (20.6+; prints a deprecation notice on Node 26, harmless).
  - `tests/helpers/stubs/{gpui-kit,gpui-base,herdr}.mjs`: the chainable element (it records text children and the calls made on it), `View`, `InputState`/`Input` that record `on(...)` handlers, and a `herdr` stub with a mutable `state` (agents, spaces, shared, theme, props, `runs`, `closed`).
  - `tests/main.test.mjs`, tests (each builds a fresh View, no timers fire because `cx.timer.*` and `cx.spawn` are no-ops):
    1. Import drift: every name main.js imports from `herdr`, `gpui-kit`, `gpui-base` is exported by the stub; and, when `<home>/.config/herdr-app/herdr.d.ts` (or `$HERDR_APP_HOME`) is readable, by that file too (skip with a message otherwise; build the path from `os.homedir()`, never write one).
    2. Renders without throwing for: mixed statuses over two spaces (both modes), no agents, a filter with no match, 40 agents (scroll path, `fixed` true).
    3. Keys: the table in RECIPE "Keys and mouse" row by row (down/up wrap, Tab/Shift+Tab call `setShared("attention.sort", ...)` in order, Enter, Esc, `1`-`9` only when `search: false`, Ctrl+1 ignored).
    4. Dismiss: with `props().overlay = "o1"` it calls `closeOverlay("o1")` and not `run("overlay.close")`; without, the reverse; in both cases `run("agent.focus", { terminal })` follows.
    5. Contract: with `shared("agents.since")` set the row time comes from it; the only `setShared` key ever written is `attention.sort`; `localStorage.setItem` is called with key `attention.seen`; a `localStorage` that throws on get and set does not stop `init` or `render`.
  - `package.json`: add `"engines": { "node": ">=20.6" }`. `npm test` stays `node --test`.
- Owner: code-review (tests/**, package.json). Heads-up to herdr-completeness: CI matrix should include one old Node (20 or 22) and one current (see board post); scripts/validate.mjs only scans `mods/`, so `localStorage` in the test stub does not trip its capability report.
- Verify: `npm test` (now ~75 tests); mutation check, by hand, not committed: rename an import in main.js (`closeOverlay` to `closeOverlays`), change the `"tab"` branch, change `SEEN_KEY`; each must turn a test red.

### CR-2-2 (medium) the title counts the filtered rows, and says "Nothing needs you" while agents are hidden by the search

- Evidence: main.js:159-164. `asking` and `done` are counted from `picks`, which come from `rows` built with `query: this.filter` (main.js:102-105). Type "api" and "3 agents need you" becomes "1 agent needs you". Type something that matches nothing and the title reads "Nothing needs you right now" with a "No match" body, while blocked agents exist.
- Change: count from `agents()` directly (`list.filter(a => a.status === "blocked").length`, same for done). Keep `emptyState({ anyAgents })` only for the zero-agent title. Put the count/title rule in logic.js as `headline({ agents })` returning the string, so it is unit-tested (singular/plural, blocked beats done, zero agents, agents but none waiting).
- Owner: code-review (main.js, logic.js, tests). RECIPE "What you see" already describes the title as a state of the agents, not of the search, so no doc change; documentation: nothing to do.
- Verify: unit tests for `headline`; in the CR-2-1 harness set the input handler's value to "zzz" and assert the title is unchanged.

### CR-2-3 (medium) stale shared `agents.since` always wins (D11)

- Evidence: logic.js:97-99 `if (okTime(shared)) return cap(shared)` is the first rule, with no sanity check. `shared()` is persisted (herdr.d.ts: "Reads a value every mod can see (persisted)"). Someone who tried the portrait layout and left it keeps its last `agents.since` map; every agent whose address is in it keeps showing that old time ("waiting 3d") even after its status changed, while the tab times and the local record that would be correct are ignored.
- Change (conservative, never lengthens a wait, never applies to the idle/done group so portrait users see no change for finished agents): in `statusSince`, ignore `shared` when the status is `blocked` or `working` and the tab proves it newer: `tab.changed_at` (blocked) or `tab.working_since` (working) is more than `STALE_SLACK = 10_000` ms later than `shared`, **and** that tab holds exactly one agent (otherwise another agent's change explains the newer tab time). `buildRows` computes the per-tab agent count from `agents` (a Map) and passes `tabAgents` in. With the portrait tree running, its value is written within moments of the tab change, so the guard stays quiet.
- Limits to state, not hide: it cannot catch a stale entry for an agent whose tab time did not move (app restarted, `changed_at` null) nor a multi-agent tab. A heartbeat key from portrait-tree would be the complete fix; that belongs to the portrait repo, noted on the board for the round lead.
- Owner: code-review (logic.js, tests). documentation: one sentence in "How it works" / README time sources: "a shared agents.since is ignored when the tab shows a newer change for a blocked or working agent alone in its tab".
- Verify: new `statusSince` tests (fresh shared kept, stale shared dropped for blocked/working, kept for done/idle, kept for multi-agent tab, kept inside the 10 s slack, `tabAgents` missing = old behaviour); `buildRows` test with a stale map.

### CR-2-4 (medium) skip re-reading a screen that has settled

- Evidence: main.js:118-127 + logic.js:250-285. Every 3 s, each blocked or done agent (up to all of them, 4 at a time) costs one `hc read` process whose output is almost always byte-identical: a blocked agent's question and a finished agent's last message do not change until its status does. Round 1 listed it as item 5 "once real screens can be observed"; the safe version does not need observation.
- Change: in `createPreviewReader`, keep `{ status, text, seq, ok, same, skips }` per address. `want` items gain `seq` (from `agents()`). Skip the read when the entry exists, `status` and `seq` are unchanged, the last read succeeded (`ok`), the last two successful reads gave the same text (`same >= 2`, which covers a question that is drawn a moment after the status flips) and fewer than `RECHECK = 10` passes were skipped in a row (a full re-read about every 30 s as a safety net). A failed read (non-zero code, throw) is retried every pass as now. Pass `pass()`'s return value unchanged (whether `previews` changed).
- Effect: steady-state process spawns fall from N per 3 s to about N per 30 s. No constant changes; RECIPE's "every `POLL_MS` = 3000 ms ... one pass at a time" stays true as a statement about passes; herdr-completeness / documentation should add "unchanged screens are re-read about every 30 s" next time they touch the sentence (not blocking).
- Owner: code-review (logic.js, main.js `want`, tests); RECIPE.md "Programs" bullet and README "Privacy" are the places that would mention it (herdr-completeness, documentation), optional.
- Verify: tests with a counting fake `read`: same seq/status twice then skipped; seq change reads again; failed read retried every pass; 10 skips then a read; text change after a re-read updates and resets `same`.

### CR-2-5 (medium) ask.js picks a bullet inside a message as the message start; keeps the marker on questions

- Evidence, run on the base: `askOf("● Done. I changed:\n  • fixed a\n  • fixed b\n\n> ", "done")` returns `"fixed b"` (ask.js:23-27 trim every line, so an indented `•` list item looks like a message line, and the scan goes bottom-up). `askOf("● Why?\n\n● Thinking", "blocked")` returns `"● Why?"` with the marker still on (ask.js:31-33 return `l` of the unstripped line). `READ_LINES` 60 (main.js:32) vs the 40 non-empty lines ask.js looks at (ask.js:28) means about 20+ history lines are fetched and dropped; harmless, noted.
- Change: collapse spaces but remember the indent: `const indent = raw.replace(BOX," ").match(/^ */)[0].length`, and accept a marker line only when `indent <= 2` (a box border `│ ` becomes one space, Claude-style message lines start at column 0). Strip a leading marker (`MARKER_LINE`) from a blocked question. Do not add new marker glyphs: without real screens from other agents I would be guessing; add `MARKERS` entries only with a fixture copied from a real screen (invented ones would test nothing). Add fixtures for: list bullets inside a message (both `•` and `-`), a message followed by a tool call and a final prose line, a question inside a box with the `1. Yes / 2. No` options, a trailing `(y/n)`, and a lone "? for shortcuts" footer.
- Owner: code-review (ask.js, tests/ask.test.mjs). RECIPE "Watch out: The question preview is a guess" stays accurate.
- Verify: new ask tests; existing 20+ ask tests stay green.

### CR-2-6 (low-medium) `spaceColor` trusts shared data; `inkOn` ignores short hex

- Evidence: main.js:52-56. `shared("space.colors")` is written by other mods. If a value is not a string (I ran `{ s1: 5 }` through the real main.js) `c.startsWith` throws `TypeError` inside `render`, which blanks the whole dialog. An unknown name (`"teal"`) makes `t[c]` undefined and `.bg(undefined)` is passed to the host (unverified what it does; do not rely on it). `inkOn` (logic.js:65-68) returns white for anything but `#rrggbb`, so `#fa0` or `#rrggbbaa` get the wrong ink.
- Change: move the colour choice into logic.js as `resolveSpaceColor({ raw, mark, theme, dim, isHome })`: home space gives `theme.dim`; a string that is `#rgb`, `#rrggbb` or `#rrggbbaa` is normalised to `#rrggbb` (alpha dropped); a string naming a `MARK` or theme key gives that colour; anything else gives the default (`ansi6`), then `theme.dim`. `MARK` moves with it (the tile colours are data). `inkOn` accepts the same forms. `main.js` keeps only `const tile = resolveSpaceColor(...)`.
- Owner: code-review (main.js, logic.js, tests).
- Verify: unit tests for number, null, array, unknown name, `#abc`, `#AABBCCDD`, home space; the harness test sets `space.colors` to `{ s1: 5 }` and `{ s1: "teal" }` and asserts render does not throw.

### CR-2-7 (low) first-seen record: address reuse and unknown times sort first

- Evidence: logic.js:126-141 keys the record by address only. An address pruned only while the dialog is open with a non-empty list can survive a long gap and a restart; if herdr-core reuses `t7` for a new agent in the same status group, `statusSince` hands out the dead agent's time (round 1 item 8). Separately, logic.js:183-184: an agent with `since === null` becomes `0`, so under "Oldest" it sorts as the *longest* idle. It cannot happen while `trackSeen` fills the record on every render, but it is wrong if that ever fails (storage broken and tab times missing).
- Change: store `{ s, at, q, sp }` (`q` = agent `seq`, `sp` = space id). In `trackSeen`, treat a record as new when `seq < q` (a counter that went back is a different run) or `sp` differs. `parseSeen` accepts old records without `q`/`sp` (they are filled in on the next track, no reset). In the comparators put `null` last in both Recent and Oldest.
- Owner: code-review (logic.js, tests). RECIPE "Storage" bullet shows the record shape `{ s, at }`: herdr-completeness updates it to `{ s, at, q, sp }` if this lands (I will post when it does).
- Verify: trackSeen tests for decreased seq, changed space, legacy record; buildRows test for null since in both orders.

### CR-2-8 (low) small interaction faults and housekeeping

- Tab uses a stale closure value: main.js:237 computes `nextSort(sort, ...)` from `sort` captured at render. Two key presses before the re-render (key repeat) apply the same step twice, so one cycle is lost. Use `nextSort(sortNow(), dir)`. The Sort pill click (247) has the same shape; use `sortNow()` there too.
- Times freeze while the dialog stays open: nothing re-renders a quiet dialog, so "5m" stays "5m". Add `cx.timer.every(30_000, (cx) => cx.notify())` (the doc allows timers for data shown, minute resolution; it is not an animation timer). Skip while `this.dead`.
- `logic.js:3` still says `node --test tests/`, which fails on Node 22+ (round 1 board post). Say `npm test`.
- `dead` (main.js:65, 119, 131) is only set by `dismiss()`; a click beside the dialog (it is not modal) closes it without that. Tasks are owned by the view (gpui-kit.d.ts `TaskOptions.owner` defaults to the running view), so the timer and the in-flight read end with the view, and `dead` only guards `cx.notify()`. Keep as is; add a one-line comment saying so, so nobody adds a manual cancel. If the author sees `hc read` processes after closing the dialog (cannot be checked without driving the app), add `async close() { this.dead = true; }` as the host's cleanup hook.
- Owner: code-review (main.js, logic.js comments, tests).
- Verify: harness test pressing "tab" twice without a render ends two steps along; `rg -n "node --test tests/" mods tests` finds nothing.

### CR-2-9 (low, needs the author's call) dim and muted text on light themes

- Evidence: plans/round-1/code-review-log.md "Contrast of the 11px dim text ... round 2 idea". main.js draws 11px `t.dim` and `t.muted` text (rows 217-219, 226-227, hint 251) on `t.hover` and `t.popover`. Whether that reads is decided by the user's theme at run time; `themes()` in herdr.d.ts lists every theme's colours, so it is checkable *inside* the mod.
- Option A (my recommendation): leave the look alone and only guard: `readable(fg, bg, fallback, 4.5)` in logic.js (`contrast()` already exists); if `contrast(t.dim, t.popover) < 4.5` (and also against `t.hover` for the selected row) use `t.muted`, and if that fails too use `t.foreground`. Themes that already pass look exactly as today.
- Option B: do nothing, keep the RECIPE "Watch out" sentence.
- I will not implement A without a go-ahead because the author's design notes ask for options first and restraint; if a default theme has `dim` under 4.5:1 on `popover`, A changes what they see. Decision needed from the round lead or author; both options are cheap (about 15 lines + tests with sample light and dark palettes).

## Round 1 claims: executed, and not backed

Executed with the scratch harness on the merged tree (Node 26.5): search default on with no props and off with `{ search: false }`; `1`-`9` only in keys mode; Tab and Shift+Tab move `attention.sort` forward and back; Enter and 1-9 run `agent.focus` and close (`closeOverlay` id, else `overlay.close`); empty list renders; localStorage written under `attention.seen`; `agents.since` never written. `npm test`: 61 pass.

Not backed by any test or run, so stated as such in my findings and to be marked as unverified by documentation / herdr-completeness where they repeat them:
- "Pressing the key again closes it": `mod.open` toggling is documented by Herdr (`herdr-app commands`: "calling again closes it"), but whether the key reaches the host while the search box has focus is only observable in the live app.
- "`hc read --lines 60` is the screen plus 60 lines of history": from the documentation role's reading of `hc read --help`; I cannot run `hc` (not on this run's allowed list). Nothing in the code depends on the exact meaning.
- Three-OS behaviour: CI workflow still not pushed (round 1 summary item 1). `hc` on Windows is unverified.
- `TabInfo.changed_at` unit: `toMs` treats values under 1e11 as seconds, which hides a unit mistake rather than finding it; herdr.d.ts says ms since the epoch, so the scaling is harmless but is covered only by a unit test, not by a real value.
- Spinner and search SVG rendering via `svg("mods/attention-picker/...")` relative to the app home: same pattern as the shipped mods, not seen drawn.

## Order for the implementation round

CR-2-1 first (it protects the rest), then CR-2-2, CR-2-6, CR-2-5, CR-2-4, CR-2-3, CR-2-7, CR-2-8. CR-2-9 waits for the decision. About 150 lines of tests helpers, 120 lines of code changes, all in files code-review owns.
