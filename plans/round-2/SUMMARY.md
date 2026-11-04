# Round 2 summary: verify and harden

Branch: feat/round-2-verify-harden, stacked on feat/round-1-standalone-picker (round 1's PRs are still open). Goal: prove what round 1 claimed, fix what an adversarial review found, and word everything the live app has not confirmed as unconfirmed.

## What changed

### Code review (mods/attention-picker, tests)
- `main.js` runs under a test for the first time: a harness stubs `gpui-kit`, `gpui-base` and `herdr`, then checks imports (also against `herdr.d.ts` when readable), render states, the RECIPE key table, dismiss, the shared-key contract and storage that throws.
- Fixes: the title no longer follows the search filter (`headline()`); odd `space.colors` values no longer blank the dialog (`resolveSpaceColor`, `normalizeHex`); `inkOn` accepts `#rgb` and `#rrggbbaa`; `ask.js` markers only count in the first column, and a blocked question loses its marker.
- Stale `agents.since` guard (10 s slack, lone blocked or working agent in a tab), first-seen record `{ s, at, q, sp }` with reuse detection, unknown times sort last, Tab and the Sort pill use the live sort, a 30 s redraw timer, and settled screens are not re-read on every poll (re-read about every 30 s).
- SPDX headers; `package.json` license and `engines.node >=22`.

### Documentation
- README, docs site, AGENTS.md and CHANGELOG: two-tier verification wording and a Verification status table (each row has a 30-second check); every CI claim says "defined in scripts/ci.workflow.yml, enabled by the owner, not yet run"; privacy is this mod's policy checked by a script, not a Herdr sandbox; new configuration rows, "For layout authors" section, troubleshooting entries.
- Pages address everywhere, `docs/404.html`, inline icon, accessibility fixes (scroll regions, th scope, focus outlines), American spelling, CHANGELOG with Round 1 and Round 2 entries, no task ids.

### Herdr completeness
- `scripts/ci.workflow.yml` (OS x Node 22/24, read-only permissions, manual trigger); nothing under `.github/workflows/`.
- Privacy scan: accepts GitHub's web-merge committer and Dependabot by pattern, `PRIVACY_AUTHORS=skip` on pull requests, PNG text chunks scanned, `.gitignore` additions.
- `scripts/modrules.mjs` allow-lists (imports, ten `herdr` names, `run()`/`hc()` arguments, no dynamic import or eval), `scripts/verify-install.mjs`, `scripts/checks.test.mjs` (102 cases testing the scripts themselves), check-docs ties code constants and quoted numbers to the docs.
- Issue form, PR template, SECURITY.md, NOTICE font note. RECIPE.md rewritten from the final code with a 12-row CLAIMS table checked by validate.

## Check results (merged tree, macOS, Node 26.5, herdr-app 0.1.12)
- `npm test`: 225 pass, 0 fail (123 mod + 102 script tests). Role runs also passed on Node 22.14 (module.register fallback).
- `herdr-app check /abs/path/mods/attention-picker`: passed.
- `scripts/validate.mjs`, `privacy-scan.mjs` (tree, PNG chunks, history), `check-docs.mjs`, `verify-install.mjs mods/attention-picker`: all ok.
- All .json files parse. RECIPE.md has its six parts. Docs links resolve (check-docs). rg for home paths, names and non-noreply emails: only the allowed repo string, the LICENSE line and prose mentions.
- The three role merges had no conflicts.

## Not verified or deferred
- Nothing was run in the live app. Unverified: Tab reaching the key handler while the search box has focus, the open key closing the dialog, the 30 s repaint, `hc read --lines` semantics, `changed_at` unit, SVG rendering, localStorage persistence.
- No CI run has ever happened (token lacks `workflow` scope). Linux and Windows are unproven. The workflow definition is not yet validated by a YAML parser.
- Contrast guard for dim 11px text on light themes (needs the author), real screenshot instead of the illustrated preview.png, heartbeat key in the portrait layout for a complete stale-time fix, drift test of element method names against gpui-kit.d.ts, unit tests for scroll-follow maths, CLAIMS rows for TICK_MS, STALE_SLACK, RECHECK.
- docs/404.html only serves one level of wrong paths; AGENTS.md is 213 lines (target ~200).

## Round 3, in priority order
1. Author: install the CI workflow (publish checklist step 0), read the first three-OS run, fix what fails, update the Requirements rows.
2. Author: observe the picker in the live app, working through the Verification status table; flip rows to observed or fix the code. Includes Tab with focused search, key toggle, 30 s repaint, `hc read` output, `changed_at` unit.
3. Contrast options note for dim text on light themes (schematic, before and after), then wire the guard if approved.
4. Post the heartbeat-key request on the portrait layout repo's board and resync that repo's copy from this repo.
5. Real preview.png (open font, no window dots) replacing the illustration in both places.
6. Test-gap work: element method drift test against gpui-kit.d.ts, move scroll-follow maths into logic.js and test it, extend CLAIMS to the remaining constants, a real YAML parse of the workflow and issue form.
7. Revisit sort order of the top list (seq versus displayed time) once the live app shows whether they disagree.
8. Windows-only hardening after the first real Windows run.

## Author actions by hand
- Review and merge round 1 PRs, then this stacked PR (retarget to main after round 1 merges).
- Install the CI file: `gh auth refresh -s workflow`, copy scripts/ci.workflow.yml to .github/workflows/ci.yml (checklist step 0).
- Live-app observation pass and the real screenshot.
