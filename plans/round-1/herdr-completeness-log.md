# Round 1 log: herdr-completeness

Branch `feat/round-1-standalone-picker--herdr-completeness` (pushed), based on `feat/round-1-standalone-picker`.
Tasks are the R1-HC ids of `PLAN.md`. Written after the other two roles had landed, so RECIPE.md reflects the final code.

## What landed

| Task | Result | Files |
| --- | --- | --- |
| R1-HC-1 keys | `ctrl-shift-a` in `global` and `terminal` -> `mod.open:attention-picker`; no `cmd-`, no `ctrl-alt-` | `keys.json` |
| R1-HC-2 licence | Apache-2.0 text with the copyright line filled in (the only place the holder's name appears); NOTICE says no third-party code or assets, names the two icons and the preview as made for this project | `LICENSE`, `NOTICE` |
| R1-HC-3 validate | JSON parse, `mod.json` shape, `keys.json` sections and portability, `mod.open` targets exist, licence/NOTICE, size limits, CRLF check, preview.png signature and 1100x705, RECIPE heading order and image line, CONTRACT (props `search`, shared `agents.since` / `space.colors` / `attention.sort`, command `agent.focus`; `agents.since` must never be written), foreign mod names allowed on comment lines only, one `HOME` constant, capability report with network / exec / file access refused and `hc` / `localStorage` accepted only when RECIPE and README say so, RECIPE numbers (`POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, `LIST_H`) equal to `main.js`, SVG rules, no Herdr-written files committed. `check-local.mjs` runs every CI step plus `herdr-app check` per mod when the binary exists. | `scripts/validate.mjs`, `scripts/check-local.mjs`, `scripts/lib.mjs` |
| R1-HC-4 privacy | `privacy-scan.mjs`: home paths (macOS, Linux, Windows; generic names such as `runner`, `user`, `dev` allowed), e-mails (GitHub no-reply and the Claude co-author address allowed), `.local` / `.lan` hostnames, tokens, the owner handle outside the allowed strings, the LICENSE holder's name outside LICENSE, `PRIVACY_EXTRA`; over the tree AND `git log --all` (metadata, messages, every added line); allow-list = `<owner>/herdr-agents-waiting` and the Pages address. `.gitattributes` (LF, png binary), `.gitignore` extended. | `scripts/privacy-scan.mjs`, `.gitattributes`, `.gitignore` |
| R1-HC-5 CI | Written (`ubuntu`, `windows`, `macos`, Node 22, `contents: read`, concurrency, 10 min, `PRIVACY_EXTRA` secret, steps validate / privacy-scan / check-docs / `node --test`). Dependabot for actions landed. **The workflow file could not be pushed, see Denied.** | `.github/dependabot.yml`; `.github/workflows/ci.yml` only on the local branch `feat/round-1-standalone-picker--herdr-completeness-ci` |
| R1-HC-6 preview | 1100x705 illustration from `scripts/preview/preview.svg` via `render.sh` (rsvg-convert, Inkscape or ImageMagick), invented data, real row heights; image opened and checked for clipping | `preview.png`, `scripts/preview/` |
| R1-HC-7 check-docs | links and anchors in the Markdown files and `docs/*.html`, no external origin loaded by a page or the CSS, no `<script>`, `lang` / `<title>` / viewport / charset, `<img alt>`, `.nojekyll`, `docs/assets/preview.png` byte-equal to `preview.png`, the key in README and RECIPE equals `keys.json` | `scripts/check-docs.mjs` |
| R1-HC-8 RECIPE | six parts in order, written from the final `main.js`, `logic.js`, `ask.js`; "What it reaches" disclosure; rename spots; key note; platform honesty | `RECIPE.md` |
| R1-HC-9 checklist | author-only steps with commands and URLs, plus a step 0 for landing the workflow | `.github/PUBLISH-CHECKLIST.md` |

`mod.json` unchanged: `herdr-app check` passes and Herdr documents no further fields (D9: no `version`).

## Denied

- `git push` of `.github/workflows/ci.yml` was refused by GitHub: "refusing to allow an OAuth App to create or update workflow ... without `workflow` scope". Not worked around (no other account, no token change). The branch was pushed without that one file; `dependabot.yml` was accepted. The finished workflow is one commit on the local branch `feat/round-1-standalone-picker--herdr-completeness-ci` in the shared working copy; step 0 of `.github/PUBLISH-CHECKLIST.md` tells the owner how to push it (`gh auth refresh -s workflow`). Because of this, `validate.mjs` only warns about a missing `ci.yml` locally and fails under `CI=true`.
- Consequence: no three-OS run exists. Linux and Windows are unproven except by reading and by writing the scripts with `node:path`, `git ls-files -z` and no shell-only syntax.

## Checks run (macOS, Node 26.5, herdr-app 0.1.12)

Run on a scratch clone with the three role branches and the CI commit merged (18 commits), so history was scanned too:

- `CI=true node scripts/validate.mjs`: ok (capabilities: network 0, exec 0, hc 1, localStorage 2, file access 0).
- `node scripts/privacy-scan.mjs`: ok (tree and history; `PRIVACY_EXTRA` not set, so only built-in rules).
- `node scripts/check-docs.mjs`: ok.
- `node --test` and `npm test`: 61 pass.
- `herdr-app check <abs>/mods/attention-picker`: passed; `node scripts/check-local.mjs`: all steps passed.
- Negative tests (scratch copies, never in the repo): home paths of all three OS, e-mail, hostname, token, owner handle, holder name and `PRIVACY_EXTRA` word each fail the scan; a leak added and removed in history, a human author e-mail and a human `Co-Authored-By` fail the history scan; removing `agents.since` fails validate with the compatibility message; `fetch(`, a second hard-coded folder name, a foreign mod name in code, `cmd-k`, `ctrl-alt-x`, an unknown key section, a missing mod target, CRLF and a RECIPE value that differs from `main.js` each fail validate; a broken link, a bad anchor, an external `<link>` and a stale `docs/assets/preview.png` fail check-docs.
- Found on the way: `node --test tests/` fails on Node 22+ and 26 (a directory is loaded as a module). CI and `check-local.mjs` use plain `node --test`; code-review had already set `package.json` to that.
- Every `run:` line of the workflow was executed locally in the scratch clone and exits 0. The YAML was read by eye (no parser installed); no tabs.

## Not done / deferred

- Real screenshot (author), `PRIVACY_EXTRA` secret, visibility, topic `herdr-mod`, Pages, install test on an empty Herdr home, portrait resync: author-only, all in the checklist.
- Windows and Linux runs of the dialog itself: nothing here can drive the app. Only the pure parts are covered, by CI once the workflow is pushed.
- Contrast of dim 11px text on light themes: theme-dependent, left for round 2 (D10); RECIPE says so.
- `mod.json` `version` field (D9).
- Pages address in the docs: now allowed by the scan (`<owner>.github.io/herdr-agents-waiting`); documentation may add it.

## Handoffs for round 2

- Push the CI branch, read the first `gh run list` result, fix Windows/Linux surprises (most likely places: path separators in `check-docs.mjs`, line endings, `git log` size on a long history).
- code-review: the header of `logic.js` still says `node --test tests/`; use plain `node --test`.
- Re-read RECIPE.md against `main.js` after any code change; `validate.mjs` guards only the four constants, `HOME`, the contract and the disclosure words.
- If the author adds `PRIVACY_EXTRA`, re-run the scan locally first (history is permanent once public).
- When the real screenshot replaces `preview.png`, copy it to `docs/assets/preview.png` and drop the word "illustration" from README, RECIPE and docs.
