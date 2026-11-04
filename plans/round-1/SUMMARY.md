# Round 1 summary: a standalone Agents waiting picker

Branch: feat/round-1-standalone-picker. Goal: make attention-picker work in anyone's Herdr layout, not only the author's, and make the repo ready to publish.

## What changed

### Code review
- Search is on by default (props.search stays an opt-out). The dialog dismisses through its own overlay, with a fallback to the overlay.close command.
- New `logic.js`: status time is read from shared `agents.since`, then the tab's own timestamps, then a local first-seen record kept in `localStorage` under `attention.seen`. `agents.since` is never written, so the portrait layout keeps working.
- Own `spinner.svg` and `search.svg`; no reference to another mod's assets remains.
- One guarded preview pass (3000 ms poll, 60 lines, 4 concurrent `hc read` calls). Failed reads store empty text.
- Selection is kept by key. Shift+Tab reverses the sort. Search is multi-word AND and also matches title and status words.
- `ask.js` strips ANSI, accepts (y/n) hints, skips tool-call lines for finished agents and caps output at 200 chars.
- 61 `node:test` tests (`npm test`). Space-tile initials now meet contrast (6.2:1 or better).

### Documentation
- README (install by agent and by hand, key, usage, per-OS requirements, privacy, troubleshooting, uninstall), AGENTS.md (with a claim-to-source map and a do-not-break table), a six-page static `docs/` site for GitHub Pages, `llms.txt`, CHANGELOG, CONTRIBUTING.

### Herdr completeness
- `keys.json` binds ctrl-shift-a to `mod.open:attention-picker` (global and terminal), so the mod opens by its own key.
- Apache-2.0 LICENSE and a truthful NOTICE, RECIPE.md with the six Herdr sections, an illustrative preview.png, PUBLISH-CHECKLIST, dependabot config.
- Scripts: `validate.mjs`, `privacy-scan.mjs` (tree and history), `check-docs.mjs`, `check-local.mjs`.

## Check results (on the merged tree, macOS, Node 26.5, herdr-app 0.1.12)
- `herdr-app check` on mods/attention-picker: passed
- `npm test`: 61 pass, 0 fail
- All .json files parse (keys.json, mod.json, package.json)
- `scripts/validate.mjs`, `privacy-scan.mjs`, `check-docs.mjs`, `check-local.mjs`: all ok
- rg for home paths and emails across the tree: only prose mentions inside logs, no real data
- RECIPE.md has its required sections; docs links resolve (check-docs)
- The three role merges had no conflicts.

## Not done or not verified
- The CI workflow is not on this branch. GitHub refused the push because the OAuth token lacks the `workflow` scope. It exists as local commit f6c961d on branch feat/round-1-standalone-picker--herdr-completeness-ci. The owner runs `gh auth refresh -s workflow` and lands it (see .github/PUBLISH-CHECKLIST.md). So Linux and Windows are unproven beyond cross-platform script design.
- Nothing was run in the live app (not allowed). Run-time behaviour of localStorage, `hc read`, key events and the unit of `TabInfo.changed_at` is unverified.
- Node 22 and 20 not tried. `node --test tests/` fails on Node 22+, so `npm test` uses plain `node --test`.
- The preview image is an illustration; a real screenshot is an author step.

## Round 2, in priority order
1. Land the CI workflow (author step) and read the first three-OS run; update the Requirements rows in README and docs from it.
2. Observe the picker in a real Herdr app: localStorage persistence, `hc read` output, Tab and Shift+Tab, the `changed_at` unit. Fix what differs.
3. Test fixtures for agents other than Claude Code style screens, so ask.js preview claims cover more agents.
4. Stale shared `agents.since` guard (D11).
5. Skip preview re-reads when the screen sequence is unchanged, once real screens can be observed.
6. Contrast of theme-supplied dim text on light themes; the mod.json version field.
7. Re-verify the docs claim map against the final tree; add the Pages URL; swap in a real preview.png.
8. Address reuse across restarts with an empty agent list (low impact).
9. Resync the portrait layout repo's copy from this repo.

## Integration note
The first summary commit copied the board with a literal "/Users/..." example sentence, which the history scan flagged. Force-pushing was not permitted in this run, so instead the board copy was reworded and the privacy scan now treats a bare ellipsis as a placeholder, not a person. No real path or name was ever in the history.
