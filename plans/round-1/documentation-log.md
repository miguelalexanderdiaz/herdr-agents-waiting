# Round 1 - documentation log

Branch: `feat/round-1-standalone-picker--documentation` (from `feat/round-1-standalone-picker`).
Files written: `README.md`, `AGENTS.md`, `llms.txt`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/` (6 pages, `style.css`,
`.nojekyll`, `assets/preview.png`), this log. No other role's file was edited.

Behavior text was written after gate G1 ("code landed" on the board, code-review commits 228c030 and 81f2c7d) and
checked against those files; keys against herdr-completeness's `keys.json`; `preview.png` copied from its branch.

## Done

- R1-DOC-1 `README.md`: what and why with the illustration (called an illustration), install by agent and by hand, name
  clash, how to open (key, palette, terminal, another mod), keys, waiting-time sources and their limit, requirements
  table (macOS run; Linux and Windows not run, CI covers the pure parts), Privacy and permissions (hc read with
  `--lines 60`, localStorage `attention.seen`, `attention.sort`, shared reads, no network/exec/files), troubleshooting,
  uninstall, contribute, licence.
- R1-DOC-2 `AGENTS.md`: layout table, install steps with the "tell the person first" disclosure, adapting, testing,
  editing safely and Herdr gotchas, "Do not break" table, portrait sync file list (`mod.json main.js logic.js ask.js
  spinner.svg search.svg`), docs rules, a 16-row claim-to-source map (command plus expected result), known limits.
- R1-DOC-3 `docs/`: index, install, usage, configuration, how-it-works, troubleshooting. Plain HTML and CSS, no JS,
  no external origin, `.nojekyll`, light and dark by `prefers-color-scheme`, skip link, `lang`, ordered headings,
  `assets/preview.png` byte-equal to `preview.png`. Contrast computed: body 16.2 / 14.8, muted 6.4 / 7.7, links 6.8 /
  8.7 (light / dark), all above 4.5. Looked at in headless Chrome: dark at 1100 px, and install and how-it-works inside
  360 px frames (fixed a mid-word wrap in the file-name column). Light mode seen only as numbers.
- R1-DOC-4 `llms.txt`, `CHANGELOG.md` (Unreleased in New / Fixed / Changed, baseline 0.1.0; bullets carry task ids, not
  commit hashes, because hashes are not known until merge), `CONTRIBUTING.md`.

## Corrections made against the code (differences from my audit)

- Test command is `npm test` / `node --test`, not `node --test tests/` (code-review found the directory form fails on
  Node 26.5). Used everywhere.
- `hc read --lines N` means N lines of history above the screen (checked with `hc read --help`), so the old call read the
  screen only and the new one reads screen plus 60 lines. The CHANGELOG says that, not "fewer lines".
- Poll is 3000 ms, concurrency 4, local record in localStorage key `attention.seen` (not "no localStorage").
- Waiting-time precedence is shared `agents.since`, then tab `working_since` (working) or `changed_at`, then local record.
- The key is `ctrl-shift-a` (D1), the search box is on by default, `Shift+Tab` reverses the sort.
- `overlay.close` is a fallback command when `props().overlay` is missing; listed in the contract table.

## Deferred

- Real screenshot (author step, in PUBLISH-CHECKLIST); docs say "illustration".
- The Pages URL is not written anywhere: it would contain the owner name outside the allowed `owner/repo` string.
  llms.txt links raw files by the allowed string; they work once the repo is public.
- A claim for any agent other than Claude Code style screens: no fixture, so none made.
- Linux and Windows run claims: none made beyond "no OS-specific code, CI runs the pure tests".
- The Herdr home path on Linux and Windows: docs quote `~/.config/herdr-app` as Herdr's documentation gives it and tell
  the reader to use the folder their install says.
- Docs wording on the stale shared `agents.since` (D11) is in AGENTS.md "Known limits" and CHANGELOG only.

## Checks run

Run on a scratch merge of the three role branches (the three worktrees overlaid in a scratch folder, since I may not
merge); not on a real checkout, so the git-history part of the privacy scan did not run.

| Check | Result |
|---|---|
| `node scripts/check-docs.mjs` | ok |
| `node scripts/validate.mjs` | ok (capabilities: hc 1 place, localStorage 2 places, none else) |
| `node scripts/privacy-scan.mjs` | ok on the tree; history not scanned (not a git checkout) |
| `npm test` | pass 61, fail 0 (Node 26.5) |
| `herdr-app check <scratch>/mods/attention-picker` | check passed |
| JSON parse of `keys.json`, `mod.json`, `package.json` | ok |
| grep for real names, `/Users/`, `/home/`, emails in my files | none; only the allowed owner/repo string |
| the key in README equals `keys.json` | `ctrl-shift-a` in both |
| claim map greps | each one run in the code-review checkout and returned the stated hits |
| Not run | anything against the live app; Node 22 and 20 (only Node 26.5 here); Windows and Linux; light mode rendering; Pages itself |

## Handoffs for round 2

- Re-run the AGENTS.md claim map against the merged tree; update `docs/` and README if constants or strings changed.
- After the first CI run on three OSes, update the Requirements rows in README and `docs/install.html`.
- When the author replaces `preview.png`, copy it to `docs/assets/preview.png` and drop the word "illustration".
- When the repo is public and Pages is on, add the Pages URL to README and `llms.txt` if the privacy rule allows it.
- Once someone runs the mod without the portrait layout, confirm the "Waiting times" and "Previews" wording
  (`changed_at` unit and behavior are unverified; code-review flagged it).
- Contrast of the theme's dim 11px text on light themes is code-review's deferred item; the docs do not claim it.
