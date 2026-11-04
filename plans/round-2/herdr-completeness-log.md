# Round 2 log: herdr-completeness

Branch `feat/round-2-verify-harden--herdr-completeness` (from `feat/round-2-verify-harden`). Tasks R2-HC-1 .. R2-HC-8 of
`plans/round-2/PLAN.md`; the audit is `plans/round-2/herdr-completeness.md`.

## What I did

| Task | Result |
| --- | --- |
| R2-HC-1 | `scripts/ci.workflow.yml`: `os` (ubuntu, windows, macos) x Node 22 and 24, `permissions: contents: read`, `persist-credentials: false`, `workflow_dispatch`, a platform step (OS, Node, `core.autocrlf`), a notice when `PRIVACY_EXTRA` is empty on push, `PRIVACY_AUTHORS=skip` on `pull_request`, `node scripts/validate.mjs`, privacy scan, check-docs, `npm test`. Checklist step 0 rewritten (copy or paste in the web UI; no local-only branch). `validate.mjs` lints the file and requires the installed copy, when present, to be byte-equal. Gate H1 posted with the exact CI sentence. Nothing under `.github/workflows/` (`git ls-files .github/workflows` is empty). `actions/checkout@v7` and `actions/setup-node@v7` tags exist (`gh api` matching-refs). |
| R2-HC-2 | `privacy-scan.mjs`: allows GitHub's web-merge committer and the Dependabot support signature by pattern; `PRIVACY_AUTHORS=skip` (empty means `all`, anything else exits 2) skips only the author/committer address check; PNG text chunks (`tEXt`, `zTXt`, `iTXt`) are read and scanned in the tree and in every revision in history, any keyword but `Software` fails, `eXIf` fails; `.gitignore` gains `herdr-shot*.png` and `.claude/`. |
| R2-HC-3 | `scripts/modrules.mjs` (shared by validate and verify-install): import specifier allow-list, ten names from `herdr`, `run(` only with `agent.focus` / `overlay.close` as a literal, `hc(` only with an array literal starting `"read"`, `run`/`hc` may not be used as values, no dynamic `import()`, `require`, `eval`, `Function`, computed `globalThis`; old regexes stay as a second line; capability report prints the import list. SPDX rule (first 3 lines of every mod `.js`), `package.json` license / engines / `test` script rule. |
| R2-HC-4 | `scripts/checks.test.mjs`: 102 cases (picked up by plain `node --test` / `npm test`): validate 50, privacy-scan 28, verify-install 13, check-docs 21 on a synthetic site (so they test the rules, not today's wording). Each case copies the repository to a temp folder, applies one mutation (`sub` throws if the target text is gone) and runs the script with `--root`; no shell; git cases use a throw-away repo. |
| R2-HC-5 | `check-docs.mjs`: the seven constants appear with their values in `docs/configuration.html`; `--lines N`, `N lines of history`, `every N seconds/ms` (allowed: any `*_MS` constant in the mod, `30_000` read correctly), `at most N at a time`, `at most/up to N px` equal the code in README, AGENTS.md, llms.txt, docs pages; one nav `<li>` set on every page with a single `aria-current` on itself (404 exempt, D28); `.table-wrap` and long `<pre>` need `tabindex`, `<th>` needs `scope`. Tested on a scratch overlay of the documentation branch + code-review G1 + my scripts: check-docs ok. On this branch alone, check-docs is RED on the round-1 pages (expected, D1: the documentation branch fixes them). |
| R2-HC-6 | `scripts/verify-install.mjs <folder> [--home <dir>]` (also `HERDR_APP_HOME`), gate H3 posted. `check-local.mjs` runs it for every mod, runs `node --test` always, and spawns `herdr-app` with a shell on win32 only. `render.sh` header says POSIX sh; `dependabot.yml` comment "actions only". |
| R2-HC-8 | `.github/ISSUE_TEMPLATE/bug_report.yml` (no labels), `PULL_REQUEST_TEMPLATE.md`, `SECURITY.md` (private reporting, no address); NOTICE: fonts the illustration may use (Segoe UI and Arial are system fonts only rendered into the picture) and that copies keep the SPDX header; checklist: session trailers and `plans/` decision, Pages on a private repo needs a paid plan, click all pages, read the screenshot and take it from an invented home, second-system install test with `verify-install`, private vulnerability reporting, table updated. Gate H2 posted. |
| R2-HC-7 | `RECIPE.md` rewritten from the G1 code (see the commit): data fields, name rule, 1e11 rule, `seq` order, fold condition, search fields, preview limits, record `{ s, at, q, sp }`, stale-`agents.since` guard, 30 s redraw, settled-screen skip, six-row "What it reaches" table, two-tier Platforms wording, a "Not yet observed" bullet (key toggle, Tab in the search box, `--lines`, 30 s repaint, late question, Linux/Windows), softened Done when. `validate.mjs` CLAIMS table with 12 rows (row heights, width, spinner period, storage key, preview length, markers, key hint, placeholder, sort labels, empty-state strings, stored entries, fold age), 8 mutation tests. |

I merged code-review's C0 commit (7feb8fd) into this branch so the SPDX rule and the `package.json` rule see real headers;
the same commit is on their branch, so merging their branch later adds nothing for those files.

## Decisions

- No `version` in `mod.json` (D27), topic stays `herdr-mod`, added by the owner at publish.
- The SPDX rule is a failure, not a warning: a copy of the mod folder must carry its licence.
- `verify-install` prints disclosure lines derived from the code (hc read, localStorage), not from the docs.
- check-docs does not scan RECIPE.md for quoted numbers: it legitimately says "at most 200px" (sub-line width) beside
  "at most 320px" (list); RECIPE is covered by validate's CLAIMS table instead.
- Windows: only `check-local.mjs` (shell for `herdr-app`) and the CI platform step were hardened; nothing else without a real run.

## Deferred

- D25: re-rendering `preview.png` (window dots, open font) and its copy: the real screenshot replaces it at publish.
- Light-theme preview; Windows-only hardening beyond the above (needs a real Windows run).
- A CLAIMS row for `TICK_MS`, `STALE_SLACK`, `RECHECK` (cap of 12 rows, D26); they are covered by check-docs for the docs only. Round 3 can add rows if RECIPE keeps quoting them.
- YAML is linted by line matching, not parsed (stated in the code); the issue form is valid by eye only (no parser installed).

## Checks run (macOS, Node 26.5.0 and 22.14.0)

- `node --test`: 163 pass, 0 fail on Node 26.5.0 and on 22.14.0 (61 existing + 102 in `scripts/checks.test.mjs`).
- `node scripts/validate.mjs`: ok. `node scripts/privacy-scan.mjs`: ok (tree, PNG chunks and full history).
- `node scripts/check-docs.mjs`: ok on the scratch overlay (documentation branch + code-review G1 + these scripts + this RECIPE); FAILS on this branch alone on `tabindex`/`scope` of the round-1 pages (documentation's fix; not edited by me).
- Scratch overlay of the three branches: `node --test` 217 pass (includes code-review's harness), validate ok, privacy-scan ok, check-docs ok.
- `node scripts/check-local.mjs` on this branch: validate, privacy-scan, tests, `verify-install`, `herdr-app check` passed (herdr-app 0.1.12); only check-docs red, as above.
- Mutation checks by hand (rule disabled in the script, its cases went red, then restored): the `hc(` allow-list (1 case red), the web-flow committer allow (1 red), the PNG chunk scan (4 red).
- JSON files parse (validate step 1). `git ls-files .github/workflows` is empty.

## Handoffs

- **round-lead (integration):** merge order code-review, herdr-completeness, documentation; after that run `npm test`, validate, privacy-scan, check-docs, verify-install, check-local. A run on Node 22.14 uses code-review's `module.register` fallback. Install `scripts/ci.workflow.yml` is the owner's step 0; nothing has ever run on Linux or Windows.
- **documentation:** CI wording from the H1 post; `verify-install` and `HERDR_APP_HOME` in the install steps; templates and SECURITY by relative path. check-docs now also guards the constants rows and nav (their branch passes on the overlay). The Pages address stays allowed by the scan.
- **code-review:** nothing blocking. If a constant or string quoted in RECIPE changes, `validate.mjs` fails with the claim's name; update RECIPE in the same change. Any new `herdr` import or `run()`/`hc()` form needs `modrules.mjs` and RECIPE "What it reaches" first.
- **owner:** checklist steps 0 to 3; set `PRIVACY_EXTRA`; take the real screenshot from an invented home and read every word; enable private vulnerability reporting; decide on `plans/` and session trailers; add the `herdr-mod` topic.
- **round 3:** first real CI run (read `gh run view --log-failed`, Windows first); a CLAIMS row for the 30 s tick; replace the illustration; consider a real YAML parse if the workflow grows.
