# Round 1 audit: herdr-completeness

Repo: miguelalexanderdiaz/herdr-agents-waiting (private for now). Audited at commit 207ebe6
(single "Import" commit). Checked against: AGENTS.md ("Layouts and mods other people made",
Mods, Keys), `herdr-app --skill`, herdr.d.ts, the official examples repo
(herdrdev/herdr-layout-examples, esp. `tmux-prefix/`, the one mod example), and
`herdr-app check` (passes today on the mod folder, herdr-app 0.1.12 / gpui-shell 0.7.1).

## Summary

The repo is a bare import: it has the mod folder and a `keys.json`, and nothing else a shared
mod needs (no RECIPE.md, preview.png, LICENSE, NOTICE, CI). It is also NOT standalone yet, for
four concrete reasons: the key is the author's tmux-style chord bound to another mod's command
(`bar-strip.attention`); opening it with `mod.open` passes no props, so the search box (props.search)
never appears; it draws two icons out of another mod's folder (`mods/workspace-chrome/`); and
it assumes a "~" home space and shared state only the portrait layout provides.
No personal data is in the tree (rg for /Users, home paths, emails: clean; commit author uses
the GitHub noreply address). The reference example (tmux-prefix) fixes the target shape:
`RECIPE.md`, `preview.png`, `keys.json`, `mods/<name>/`, repo root = the shared folder.

Target tree after round 1 (mine in bold ownership, others as stated):

```
RECIPE.md  preview.png  LICENSE  NOTICE  keys.json  .gitignore  .gitattributes
.github/workflows/ci.yml  .github/dependabot.yml  .github/PUBLISH-CHECKLIST.md
scripts/validate.mjs  scripts/privacy-scan.mjs  scripts/check-local.mjs  scripts/preview/{preview.svg,render.sh}
mods/attention-picker/{main.js,ask.js,mod.json,spinner.svg,search.svg}   (code-review: js + svg + tests)
README.md docs/ AGENTS.md llms.txt CHANGELOG.md CONTRIBUTING.md           (documentation)
```

Ordering constraint: RECIPE.md must be written LAST in the round, from the final code after
code-review's changes land (the recipe describes the real files). I will do it in the
implementation step and re-read main.js then.

## Findings (ordered by impact)

### HC-1-1  keys.json is the author's chord on another mod's command  [high]
- Evidence: `keys.json:1` = `{ "global": { "ctrl-b a": "bar-strip.attention" } }`. `ctrl-b` as a
  prefix is the author's tmux-style setup; `bar-strip.attention` only exists with the
  bar-strip mod (`~/.config/herdr-app/mods/bar-strip/main.js:27` handles it with
  `openOverlay({mod:"attention-picker", props:{search:true}})`). In a stranger's setup the key
  does nothing, or worse swallows ctrl-b.
- Change: replace with the standalone binding, shaped like the official tmux-prefix snippet
  (global + terminal, because a terminal with focus uses the more specific section):
  `{ "global": {"ctrl-shift-a": "mod.open:attention-picker"}, "terminal": {"ctrl-shift-a": "mod.open:attention-picker"} }`.
  Why ctrl-shift-a: no cmd (cmd does not exist on Linux/Windows), no ctrl+alt (AltGr on Windows),
  no option (types characters on Mac), not in the "programs rely on" list in AGENTS.md
  (ctrl+c/d/l/r/w/a/e/u/k/z/[ are plain ctrl, ours has shift), and unbound in the shipped keys.
  `mod.open` toggles, so the same key also closes it (Esc still works). RECIPE "Watch out" tells
  the person it takes ctrl-shift-a from terminal programs and how to rebind. The author's
  `ctrl-b a` stays in the author's own keys.json and in the portrait layout; not in this repo.
- Owner: herdr-completeness (keys.json). Depends on HC-1-2.
- Verify: `node scripts/validate.mjs` (check every `mod.open:<n>` target has `mods/<n>/main.js`,
  no cmd-/ctrl-alt- keys, section names legal); `herdr-app check <abs mods/attention-picker>`.

### HC-1-2  Opened by `mod.open`, the search box never shows (props.search is undefined)  [high]
- Evidence: `main.js:57` `this.search = Boolean(props()?.search);` and `main.js:3-5`. `mod.open
  {name}` takes only the name (AGENTS.md line 577), so props is empty and the dialog degrades to
  the keys-only mode (1-9 jump) with no search box and no typing. bar-strip passes
  `props:{search:true}` itself.
- Change (code-review): treat search as ON by default and let only an explicit `props.search === false`
  switch it off: `this.search = props()?.search !== false`. Keep `props.search` backward
  compatible (portrait/bar-strip pass true; nothing passes false today). Check the hint text and
  the `1-9` handling still branch on `this.search`.
- Owner: code-review (main.js). Posted on the board.
- Verify: a node test that stubs `props()` for `undefined`, `{}`, `{search:true}`, `{search:false}`
  (code-review owns tests); RECIPE "Done when": "opening with the key shows the search box".

### HC-1-3  The mod draws icons from another mod's folder  [high]
- Evidence: `main.js:154` `svg("mods/workspace-chrome/spinner.svg")`, `main.js:254`
  `svg("mods/workspace-chrome/search.svg")`. workspace-chrome is a Herdr-shipped mod
  (it is in installed.json), so it can be renamed, changed or absent in another version/layout;
  Herdr installers also warn about reads outside the mod's own folder.
- Change (code-review): add `mods/attention-picker/spinner.svg` and `search.svg` (own copies,
  drawn here, `currentColor` stroke, 24x24 viewBox; the spinner is the same ring + quarter arc,
  the search icon is circle + handle) and point both `svg()` calls at
  `mods/attention-picker/...`. I do NOT copy Herdr's files byte-for-byte: drawing them fresh keeps
  NOTICE clean ("no third-party assets"). If code-review prefers an existing icon set instead,
  it must tell me the name/license/source for NOTICE.
- Owner: code-review (main.js + svg assets); NOTICE line is mine.
- Verify: `rg "workspace-chrome|bar-strip|portrait" mods/` returns nothing (enforced in
  scripts/validate.mjs as a "no foreign mod references" rule, comments excepted); `herdr-app check`.

### HC-1-4  No LICENSE, no NOTICE  [high]
- Evidence: tree has neither; GitHub shows `licenseInfo: null`.
- Change: add `LICENSE` with the unmodified Apache-2.0 text (same licence as Herdr and the official
  examples repo) and the standard appendix filled in with
  `Copyright 2026 <owner real name, taken from the commit author>` (the only real name allowed in the repo); add `NOTICE`:
  project name + copyright line, "Herdr is a trademark/product of its authors; this mod only uses its
  public mod API", "No third-party code or assets are bundled; icons were drawn for this project".
  Keep NOTICE short so it stays true; update it if code-review adds any third-party asset.
- Owner: herdr-completeness.
- Verify: `scripts/validate.mjs` checks LICENSE starts with "Apache License" / contains
  "Version 2.0, January 2004" and NOTICE names the copyright holder; GitHub detects the licence
  after push (check `gh repo view --json licenseInfo` at publish).

### HC-1-5  RECIPE.md is missing (required by the sharing format)  [high]
- Evidence: no file. AGENTS.md "A RECIPE.md is a brief" fixes six parts in order.
- Change: write `RECIPE.md` from the real final files, following the tmux-prefix example's tone:
  1. `# Agents waiting`, paragraph, `![Agents waiting](preview.png)`, plus the "this file is the
     brief ... the files next to it are one build" paragraph.
  2. **What you see**: 640px dialog, 18px padding, `popover` background; heading (15px semibold,
     "N agents need you" / "N finished" / "Nothing needs you right now"), Sort pill, key hint;
     36px search box; list max 320px with fixed row heights (head 29, agent 32, waiting 46, rule 17,
     earlier 35); waiting rows with a one-line question preview in `muted` 11.5px; space heads with
     an 18px tile in the space's colour (fallback `ansi6`).
  3. **How it behaves**: every status (blocked "needs you", done "finished", working spinner, idle);
     the sort cycle Recent/Oldest/Space order (Tab or click, shared `attention.sort`); the "earlier"
     fold (idle >24h, auto-open while searching); up/down wrap, Enter, 1-9 jump (only without search),
     Esc, mouse wheel, click; picking runs `agent.focus` and closes. Standalone time tracking
     (what code-review builds) and the `agents.since` override.
  4. **Built from**: one mod, `mods/attention-picker/` (main.js, ask.js pure parser, mod.json
     `place:none` + dialog overlay 640, two SVGs); `keys.json` snippet; props (`search`, default on);
     shared keys read/written: `attention.sort` (rw), `agents.since` (r), `space.colors` (r);
     `herdr` functions: `agents spaces run hc theme settings shared setShared props closeOverlay`
     (+ whatever code-review adds); commands: `agent.focus`, `mod.open`; programs: `hc read <address>`
     every 2 s per blocked/done agent. No network, no `exec`.
  5. **Watch out**: the disclosures (HC-1-9); the ctrl-shift-a binding and what it takes;
     name clash (rename folder, the `mods/attention-picker/` svg paths in main.js and the
     `mod.open:` key); layout-agnostic height (320px list cap, needs a window >= ~560px tall);
     screen parsing (ask.js) is heuristic, tuned to Claude-Code-style "●" lines and "?" prompts;
     the portrait layout supplies `agents.since`/`space.colors`, elsewhere times start when the
     picker/mod first sees a status; tested on herdr-app 0.1.12.
  6. **Done when**: 8-10 observable checks (see HC-1-7 verification list; includes "no `Users`/home path in any file").
- Owner: herdr-completeness. Must run after code-review's code lands (see ordering above).
- Verify: `scripts/validate.mjs` checks the six headings exist, in order, with the image line;
  manual read-through against the code; all numbers in RECIPE grep-able in main.js.

### HC-1-6  No preview.png  [high]
- Evidence: no file. The format wants a screenshot as `preview.png`; official ones are 1100x705.
- Constraint: I may not drive or screenshot the running app (and its windows hold real
  names). So this round I generate a faithful MOCK from the real layout metrics with generic
  data (agents "api-refactor", "docs-site", "tests-flaky" in spaces "web-app", "infra", "notes";
  invented questions), as `scripts/preview/preview.svg` -> `preview.png` via
  `scripts/preview/render.sh` (rsvg-convert, or any SVG rasteriser; fonts: Geist if installed,
  falling back to system sans: no macOS-only font name, no personal text). Dark theme, 1100x705,
  dialog 640px centred over a dimmed generic backdrop.
- Honesty: the mock is a stand-in. The publish checklist (HC-1-13) says to replace it with a real
  screenshot taken with sample data before making the repo public; RECIPE does not claim it is a
  screenshot of anything but "what you see".
- Owner: herdr-completeness (png, scripts/preview/).
- Verify: `scripts/validate.mjs` checks PNG signature and 1100x705 IHDR size; privacy scan covers
  the SVG source; open the PNG once (Read) to check contrast and clipping.

### HC-1-7  No CI: tests, JSON validation, privacy scan on 3 OSes  [high]
- Evidence: no `.github/`.
- Change: `.github/workflows/ci.yml`: triggers push to main + pull_request; `permissions:
  contents: read`; matrix `os: [ubuntu-latest, windows-latest, macos-latest]`, `fail-fast: false`;
  `actions/checkout@v4` with `fetch-depth: 0` (history scan), `actions/setup-node@v4` node 22;
  steps: `node scripts/validate.mjs` (JSON + structure), `node scripts/privacy-scan.mjs`,
  `node --test` (auto-discovers `*.test.mjs` that code-review writes; I am proposing on the board that they live at
  `tests/*.test.mjs`; CI runs `node --test tests/` and treats a missing folder as a failure only after code-review confirms). No npm install: zero
  dependencies, so Windows runners behave. Shell steps use `shell: bash` or plain `node` only.
  `herdr-app check` cannot run on a hosted runner (it is the desktop app's binary), so
  `scripts/check-local.mjs` runs it for contributors when `herdr-app` is on PATH and exits 0 with
  a notice otherwise.
- `scripts/validate.mjs` (pure node, path-safe with `node:path`): parse every `*.json` (mod.json,
  keys.json, `layouts/*.json` when present); mod.json has `place` in the allowed set and an `overlay`
  with `kind` and a numeric `width`; each mod has `main.js`; keys sections limited to
  `global|terminal|layout:*|mod:*`, `mod.open:<x>` targets exist, no `cmd-` keys; `RECIPE.md`
  headings in order; LICENSE/NOTICE/preview.png present; no `layouts/` dir while this is a mod
  repo (a layout repo needs different checks); no file over 1 MiB except preview.png (<= 600 KiB);
  `git ls-files` contains no `gpui-kit.d.ts`/`jsconfig.json`/`node_modules`; contract check that
  main.js still mentions `attention.sort`, `agents.since`, `space.colors`, `props` (guards the
  backward-compat rule; failure message says "keep portrait layout compatible").
- Owner: herdr-completeness.
- Verify: run all three scripts locally on macOS exactly as the workflow lists them (no YAML
  parser is installed, so I check the workflow by eye and by running each `run:` line; the first real
  run happens on push). Windows/Linux safety: paths via `node:path`, `git ls-files -z`, no bash-only syntax.

### HC-1-8  Privacy scan (files AND history)  [medium]
- Evidence: rule 3; a leak is permanent once public. The tree is clean now; nothing enforces it.
- Change: `scripts/privacy-scan.mjs` scans `git ls-files` content and `git log --format`
  author/committer/message for: macOS, Linux and Windows home-directory paths, a `Library` path under home, email
  addresses (allow `@users.noreply.github.com`, `noreply@anthropic.com`), `.local`/`.lan` hostnames,
  `Co-Authored-By` lines naming anyone except the Claude one, and tokens (`ghp_`, `github_pat_`,
  `sk-`). Allowlist file for deliberate generic examples is inside the script (no names!).
  Extra private deny words (the author's username, employer) must NOT live in the repo: the script
  also reads `PRIVACY_EXTRA` (comma list) from the environment, set as a GitHub Actions secret
  `PRIVACY_EXTRA` by the author at publish time (Settings are off-limits to me, so this is a
  documented step in HC-1-13); locally the author can export it. The LICENSE copyright line is
  allowed by exact match only.
  Also add `.gitattributes` (`* text=auto eol=lf`, `*.png binary`) so Windows checkouts and the
  scan see LF, and extend `.gitignore` with `Thumbs.db`, `desktop.ini`, `*.log`, `.env*`, `*.reset-*`,
  `.idea/`, `.vscode/`, `/.wt/`, `*.bak*`; keep `gpui-kit.d.ts`, `jsconfig.json`, `node_modules/`, `.DS_Store`.
- Owner: herdr-completeness.
- Verify: scan passes on the tree; negative test: a scratch copy with a macOS-style home path and a
  fake email fails with non-zero exit (I run this in the scratchpad, not in the repo).

### HC-1-9  Disclosures Herdr installers warn about are undocumented  [medium]
- Evidence: AGENTS.md line 424: tell the person if a mod reaches the network, runs programs (`exec`,
  `hc`) or reads outside its folder. This mod: `hc(["read", address])` every 2 s per blocked/done
  agent (`main.js:129`, timer `main.js:62`) = it reads other terminals' visible screen text, keeps
  only a one-line excerpt in memory, never writes it, never sends it; reads shared `agents.since`,
  `space.colors`, `attention.sort`, writes `attention.sort`; (today) loads two SVGs from another
  mod's folder (HC-1-3 fixes). No `fetch`, no `exec`, no file writes, no `localStorage`.
- Change: state this in RECIPE "Built from"/"Watch out" in one explicit "What it reaches" list;
  mirror it for documentation (README "Privacy and permissions" section) via the board. After
  code-review's change, re-verify with `rg "fetch\(|exec\(|readTextFile|writeTextFile|localStorage" mods/`
  (scripts/validate.mjs prints this "capability report" and fails if `fetch`/`exec` appear without the
  RECIPE mentioning them).
- Owner: herdr-completeness (RECIPE, validate); documentation (README section).
- Verify: capability report matches the RECIPE list; reviewer reads both.

### HC-1-10  Cross-platform and "any user" assumptions in the code  [medium]
- Evidence: `main.js:47` `if (s.name === "~") return t.dim;` assumes Herdr names the home space "~"
  (only the author's convention is verified; do not assume it on Windows/Linux). `main.js:3,24,77`
  comments/hints mention "ctrl-b a", "bar strip". Hard-coded `MARK` palette (`main.js:14`) is fine
  (theme-independent hexes with white initials) but contrast on light themes is unchecked.
  `nameOf` already handles Windows paths (`^[A-Za-z]:\\`). Shortcuts use `e.modifiers.control/platform`
  (`main.js:228`) so cmd/ctrl is handled. No fonts named, nothing macOS-only: good.
- Change (code-review): derive the "home space" dim style from data (e.g. the space whose folder is the
  home directory, if `spaces()` exposes it; else drop the special case and colour it like any other);
  reword comments to name no other mod/key; confirm text on `popover`
  background meets contrast in the shipped light and dark themes (`themes()`), esp. the `dim` 11px text and
  the white-on-`MARK` initials (use `accent_foreground`-style dark ink on light colours).
- Owner: code-review (.js). My part: the CI matrix proves the pure parts (`ask.js`) run on all three OSes
  and `.gitattributes` removes CRLF drift.
- Verify: tests on Windows/macOS/Ubuntu in CI; manual contrast calc by code-review.

### HC-1-11  Compatibility contract with the portrait layout, enforced  [medium]
- Evidence: this repo is canonical; the portrait repo bundles a copy and passes `props.search`, and
  publishes `agents.since`/`space.colors`; its sort is stored in `attention.sort`.
- Change: encode the contract once: `scripts/validate.mjs` has a `CONTRACT` object
  (`props: ["search"]`, `shared-read: ["agents.since","space.colors"]`, `shared-readwrite:
  ["attention.sort"]`, `commands: ["agent.focus"]`) that is checked against main.js text, and
  RECIPE "Built from" lists the same. If code-review adds a new shared key for its own time tracking
  (e.g. `attention.since`), that is additive and must not be named `agents.since` (that key belongs
  to the portrait layout; when present it wins). Ask code-review to say its key name on the board so
  I can add it to CONTRACT.
- Owner: herdr-completeness (script); code-review (implementation).
- Verify: remove one key from a scratch copy -> validate fails with the compat message.

### HC-1-12  Name clash and rename-safety  [low]
- Evidence: AGENTS.md install step 2: on a clash the installer renames the folder and the mod's own
  `mods/<name>/` paths. After HC-1-3 the svg paths are `mods/attention-picker/...`; the key is
  `mod.open:attention-picker`.
- Change: keep exactly one place per file where the folder name appears (a `const HOME = "mods/attention-picker"`
  in main.js, code-review) so the rename is mechanical; RECIPE "Watch out" names the three spots
  (folder, `HOME`, keys.json). No other file may hard-code it (validate rule).
- Owner: code-review (const); herdr-completeness (RECIPE, rule).
- Verify: scratch rename of the folder + the three spots -> `herdr-app check` passes.

### HC-1-13  Publish checklist (what only the author can do)  [low]
- Change: `.github/PUBLISH-CHECKLIST.md` (not copied by installers): replace preview.png with a real
  screenshot on sample data (recipe in `scripts/preview/README` lines inside the checklist); set secret
  `PRIVACY_EXTRA`; run `node scripts/privacy-scan.mjs`; make the repo public (the author, never an agent);
  add topic `herdr-mod` (NOT `herdr-layout`: this repo has no layout); GitHub description "Herdr mod: a
  searchable dialog of the agents that need you"; confirm licence detected as Apache-2.0; wait <= 1 hour
  for herdr.dev/mods; then test an install into an empty `HERDR_APP_HOME`; tell the portrait repo to resync its bundled copy.
  Round 1 does NOT add the topic or change visibility.
- Owner: herdr-completeness. Verify: checklist items map 1:1 to commands/URLs; read once.

### HC-1-14  CI hygiene: pinned actions, dependabot, concurrency  [low]
- Change: `.github/dependabot.yml` for `github-actions` weekly; workflow `concurrency` group cancelling
  superseded runs; `timeout-minutes: 10`; no secrets exposure to PR forks (the privacy secret is read only
  on push to main and same-repo PRs: `if: env.PRIVACY_EXTRA != ''` style guard so forks still pass).
- Owner: herdr-completeness. Verify: read the YAML; `node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')"`
  tab/indent sanity check since no YAML parser is installed.

## Open questions I decided (unattended)

- Binding: ctrl-shift-a (above). Alternative considered: keep a chord `ctrl-b a`: rejected, it assumes a tmux prefix.
- mod.json: leave as is (`place: none`, dialog, width 640): `herdr-app check` passes and it matches the
  tmux-prefix example's shape; I verified an unknown extra key does not fail the check, but I add none (no documented fields to add).
- One mod only, so no `layouts/` and no `herdr-layout` topic.
- Node 22 in CI; `ask.js` is ESM without `"type": "module"`: Node 22.12+ detects it, and
  code-review should name test files `.mjs` to be safe on 22.0-22.11 and keep imports relative with extension.

## Board posts (made with this audit)

- to code-review: HC-1-2, HC-1-3, HC-1-10, HC-1-11, HC-1-12 and the test-file convention (tests/*.test.mjs).
- to documentation: HC-1-9 privacy/permissions section, install steps and keys, no personal names in docs.
- portrait repo board: key changed to ctrl-shift-a in the standalone repo; the portrait layout keeps `ctrl-b a`.
