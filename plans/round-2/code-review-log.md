# Round 2 log: code-review

Branch `feat/round-2-verify-harden--code-review`, from `feat/round-2-verify-harden`. Files touched: `mods/attention-picker/{main,logic,ask}.js`, `tests/**`, `package.json`.

## Done

| Task | Result |
|---|---|
| R2-CR-1 | SPDX and copyright lines at the top of `main.js`, `logic.js`, `ask.js`; `package.json` has `license` Apache-2.0 and `engines.node` `>=22`; `logic.js` header says `npm test`; comment that `dead` only guards `cx.notify()`. Posted as gate C0. |
| R2-CR-2 | `tests/helpers/{loader,hooks,stub-urls,fixtures}.mjs`, `tests/helpers/stubs/{gpui-kit,gpui-base,herdr}.mjs`, `tests/main.test.mjs`. The real `main.js` runs under node: import drift (stub always, `herdr.d.ts` of the app home when readable, `HERDR_APP_HOME` or `~/.config/herdr-app`, skipped otherwise), render for mixed, empty, filtered and 40 agents, the RECIPE key table, dismiss with and without `props().overlay`, the shared-key contract, storage that throws. |
| R2-CR-3 | `headline({ agents })` in `logic.js`; the title no longer follows the search filter. Unit tests plus a harness test (typing `zzz` leaves the title). |
| R2-CR-4 | `resolveSpaceColor`, `normalizeHex`, `MARK` in `logic.js`; `inkOn` takes `#rgb`, `#rrggbb`, `#rrggbbaa`. `main.js` reads `shared("space.colors")` once per render. Own-property lookups only (`"toString"`, `"__proto__"` are junk). |
| R2-CR-5 | `ask.js`: a marker line must start in the first column (one more inside a box border; the border is stripped before the column is counted), a blocked question loses its marker, the question length floor is 4 characters (was more than 4, so `Why?` is now a question). No new glyphs. |
| R2-CR-6 | `statusSince` takes `tabAgents`; `STALE_SLACK = 10000`. Guard as in the plan; `buildRows` counts agents per tab before the search filter. |
| R2-CR-7 | Record `{ s, at, q, sp }`; new record when seq went down or the space changed; old records gain `q`/`sp` and keep `at`; `null` since sorts last in Recent and Oldest. |
| R2-CR-8 | Tab and the Sort pill use `nextSort(sortNow(), ...)`; `TICK_MS = 30000` timer notifies unless dismissed. |
| R2-CR-9 | Landed. `createPreviewReader` skips a settled screen; `RECHECK = 10`; `want` items carry `seq`. |

## Behavior changes a reader of the docs may notice

- The title counts agents (blocked, then finished), never the filtered rows.
- Under Oldest an agent with an unknown time is last, not first.
- A blocked or working agent alone in its tab shows the tab's time when a stale `agents.since` is more than 10 s older than the tab's change.
- A steady blocked/finished screen is re-read about every 30 s (11th pass) instead of every 3 s; any seq or status change reads at once. A question that appears without Herdr changing seq can take up to about 30 s to show.
- A boxed or indented bullet under a message is not shown as the message.

## Constants

No constant that RECIPE or `validate.mjs` quotes changed: `HOME`, `POLL_MS` 3000, `READ_LINES` 60, `READ_CONCURRENCY` 4, `SEEN_KEY` attention.seen, `HOME_SPACE_NAME`, `LIST_H` 320, `MAX_LEN` 200, `slice(-40)`. New: `TICK_MS` 30000 (main.js), `STALE_SLACK` 10000 and `RECHECK` 10 (logic.js, exported). Imports from `herdr` are the same ten names; no new `run()` command, exec, fetch or file access.

## Checks run

| Check | Result |
|---|---|
| `npm test` on Node 26.5.0 (`module.registerHooks` path) | 123 pass, 0 fail |
| `node --test` on Node 22.14.0 (`module.register` fallback path) | 123 pass, 0 fail |
| `herdr-app check <abs>/mods/attention-picker` | passed (after every code commit) |
| `node scripts/validate.mjs`, `node scripts/privacy-scan.mjs` (as on the base branch) | ok |
| `rg -n "node --test tests" mods tests` | empty |
| Mutation checks by hand (not committed): rename `closeOverlay` import; change the `"tab"` branch to `"tabx"`; change `SEEN_KEY`; change the `attention.sort` key written; compute the title from the filtered picks; Tab from the captured `sort` | each turned at least one test red; sources restored (`git diff` clean) |

## Not verified (cannot be without the live app)

- That Tab and Shift+Tab reach the root `on_key_down` while the search `Input` has focus. The binding is the same as in the author's running baseline mod, but nothing here observed it. Same for "pressing the open key again closes it".
- `hc read --lines 60` meaning, `TabInfo.changed_at` unit in practice (the 1e11 rule is a unit-tested guess), SVG rendering, three-OS behavior.
- The 30 s tick: that `cx.notify()` from a timer repaints a dialog in the live host (documented in gpui-kit.d.ts, not seen).
- The stub elements only record calls: they prove main.js's logic and wiring, not that a method name exists on a real GPUI element. The import drift test covers imports, not element methods; `herdr-app check` (one render) covers those.

## Deferred

- CR-2-9 contrast guard: round 3 (D16), needs the author's call.
- Complete D11 fix: heartbeat key in the portrait repo (routed by the round-lead).
- Methods used on elements (`on_scroll_wheel`, `on_size_change`, `track_focus`...) are not checked against `gpui-kit.d.ts` by a test; a drift test over `.d.ts` method names would need a parser for a 770 KB file.
- Scroll maths (`tops`, `place`, `visible`) is only exercised for "renders", not asserted; the scroll-follow-selection rule could move to `logic.js` and be unit-tested in round 3.
- `matchesQuery` on `a.title` can match a path-like title that is not shown; left as is.

## Handoffs for the next round

- Portrait sync list is unchanged: `mod.json`, `main.js`, `logic.js`, `ask.js`, `spinner.svg`, `search.svg`. The portrait copy gains the new constants and the record shape; props and shared keys are as before.
- First live run: watch for `hc read` count after closing the dialog (see CR-2-8 note: if processes linger, add `async close() { this.dead = true; }` is NOT allowed to shadow `close`; the host calls `close(cx)` as cleanup, so adding it would be the intended hook), the Tab key with the search box focused, the 30 s redraw, and whether a boxed question still previews.
