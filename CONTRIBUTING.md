# Contributing

Thanks for helping. This repository is one small Herdr mod, so the rules are short.

## Before you start

- Read [README.md](README.md) for what the mod does, and [AGENTS.md](AGENTS.md) for the compatibility contract
  ("Do not break") and the Herdr gotchas. AGENTS.md is written for AI agents but is the shortest accurate guide for
  people too.
- Herdr's own reference lives in your Herdr app home: its `AGENTS.md`, `herdr.d.ts` and `gpui-kit.d.ts`.

## Work on a copy, never the live folder

Herdr reloads a mod the instant a file in its folder is saved. If you edit `mods/attention-picker` inside your own
Herdr home, your screen changes while you type, including half-finished code. Clone this repository somewhere else,
edit there, and copy the finished folder into your Herdr home last. A symlink from your Herdr home to your working tree has the same effect, so avoid it.

## How it works

Herdr mods are JavaScript run by Herdr's native interface toolkit: no browser, no DOM. The mod is a view that Herdr
redraws when its inputs change.

| File | Role |
|---|---|
| `mod.json` | Names the mod and its overlay: a dialog 640 px wide. |
| `main.js` | The view: reads agents and spaces, builds and draws the rows, handles keys and clicks, polls previews. |
| `logic.js` | Pure helpers, no Herdr imports (durations, names, sorting, the status-time rule, selection). The tests load it under Node. |
| `ask.js` | Pure: turns a terminal screen's text into the one preview line. |
| `spinner.svg`, `search.svg` | The two icons, drawn with `currentColor`. |

- **Data.** `agents()` lists terminals whose program reports a status (`blocked`, `done`, `working`, `idle`) with
  address, program, title, space and tab; `spaces()` gives the tree; `theme()` the colors. Shared `space.colors` may
  hold anything other mods wrote: a `#rgb`, `#rrggbb`, `#rrggbbaa` or known color name is used, anything else falls
  back to teal and never stops the draw.
- **Polling.** On open and then every 3000 ms the mod reads the screens of blocked and done agents with
  `hc read <address> --lines 60`, at most 4 at a time, one pass at once (a tick during a running pass is skipped). A
  failed read stores an empty line and is retried next pass. A screen is skipped while its agent keeps the same status
  and sequence number, its last read succeeded and the last two reads matched, for at most `RECHECK` (10) passes.
  Previews for agents no longer waiting are dropped. A separate 30-second tick redraws so times advance. Polling lives
  only in the dialog's view.
- **Status times.** First source wins: shared `agents.since`; then the tab's `working_since` (working) or
  `changed_at` (others); then the mod's own record. A shared value is skipped for a blocked or working agent alone in
  its tab when the tab shows a change more than `STALE_SLACK` (10 s) newer. The record (local storage key
  `attention.seen`) maps address to `{ s, at, q, sp }` (status group, time, Herdr's sequence number, space id; older
  `{ s, at }` entries still read). An entry is replaced when the status group changes (done and idle are one group),
  the sequence number goes down or the space changes (a reused address); entries for gone addresses are pruned only
  while some agents exist. It is written only on change, at most 500 entries are read back, and every storage access
  is wrapped in `try`.
- **Selection and sorting.** The selection is kept by address, so a reorder does not move it; if the agent goes it
  falls back to the first row, as it does on a new search or sort. An agent with no start time sorts last under
  Recent and Oldest. Needs-you and finished rows follow Herdr's sequence number, which can differ from the times
  shown.
- **Preview line (`ask.js`).** Strips color codes and box-drawing characters, drops empty lines, looks at the last
  40. For a blocked agent it walks up for a line ending in `?` or a yes/no hint after one, ignoring a leading message
  marker, selector arrow or number. Otherwise it takes the last message line (a bullet in the first column; indented
  bullets are skipped), skipping tool-call lines such as `Bash(...)`. Capped at 200 characters; the markers are one
  constant at the top of the file.

## Run the checks

```bash
npm test                          # same as: node --test   (Node 22 or newer, no dependencies)
node scripts/validate.mjs         # structure, JSON, compatibility contract, capability report
node scripts/privacy-scan.mjs     # personal data in the tree and in the history
node scripts/check-docs.mjs       # docs links, Pages assets, no external origins
node scripts/check-local.mjs      # all of the above in one go, then herdr-app check if it is installed
herdr-app check /absolute/path/to/your/clone/mods/attention-picker
```

Run `npm test`, never `node --test tests/` (a folder argument fails on Node 22 and later). CI
(`.github/workflows/ci.yml`, a copy of `scripts/ci.workflow.yml`) runs these on Linux, Windows and macOS, each on
Node 22 and 24. `herdr-app check` needs the desktop app,
so it is a local gate: run it on every change to `mods/attention-picker` and say so in your pull request. It validates the mod and
renders it once; it does not run later timers or screen reads, so try the dialog in the app too if you can. Do not
use `herdr-app do`, `shot` or `status` from scripts or automation, and never start a second app.

`herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder. They are git-ignored; do not commit
them.

## What a change needs

1. **Tests** for any change to `logic.js` or `ask.js`. For a new agent style in `ask.js`, add a fixture from a real
   sample screen (strip anything personal). The docs only claim styles that have a fixture.
2. **The contract kept.** Do not rename `props.search`, the shared keys `attention.sort`, `agents.since`,
   `space.colors`, the command `agent.focus` or the folder `attention-picker`. Say in the pull request if you add one.
3. **Docs in the same change.** Behavior changes update README, `docs/` and `RECIPE.md`. Numbers and
   keys must come from the code (the claim map at the end of AGENTS.md lists where).
4. **No personal data.** No real names, usernames, home paths (write `~`), emails, hostnames, or content from your own
   terminals or windows in any file, screenshot, fixture or commit message. `node scripts/privacy-scan.mjs` catches the
   common cases but not all of them.
5. **The privacy statement stays true.** The mod reads screen text with `hc read`, keeps nothing of it, uses no network
   and no `exec`. Herdr itself would allow all of that and more, so this is the mod's own policy, held by
   `scripts/validate.mjs`. A change that alters it must update the Privacy sections of README, AGENTS.md, RECIPE.md and the docs home page
   (`docs/index.html#privacy`).
6. **Keep it small.** No dependencies, no build step. The mod is plain JavaScript.

## Commits and pull requests

- The [pull request template](.github/PULL_REQUEST_TEMPLATE.md) lists what a reviewer will check.
- In the CI definition, pull requests skip the check of commit author e-mail addresses (they are yours and public in
  git); the content of every added line and every commit message is still scanned. Do not put an address in either.
- A clear subject line and a body that says why.
- The pull request title becomes the commit on `main` (pull requests are squash-merged) and the line in the changelog, so write it as a [Conventional Commit](https://github.com/conventional-commits/conventionalcommits.org): `feat: ...` for something new, `fix: ...` for a bug fix, `docs: ...` for documentation (all three are listed in the changelog); `ci:`, `test:`, `refactor:`, `build:`, `chore:` or `style:` for the rest, which the changelog leaves out. An optional scope goes in parentheses (`fix(privacy): ...`) and a `!` before the colon marks a breaking change. The `conventional title` check enforces it.
- Do not edit `CHANGELOG.md` by hand: after each merge, [release-please](https://github.com/googleapis/release-please) (`.github/workflows/release.yml`) updates one release pull request with the next version and its changelog lines. Merging that pull request tags `vX.Y.Z` and publishes the GitHub release.
- One logical change per commit.
- Do not rewrite shared history or force-push `main`.

## Reporting a problem

Open an issue with the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml): your Herdr version
(`herdr-app --version`), your OS, what you pressed and what you saw. Do not paste terminal contents you would not want
public. For a security problem, such as the mod reaching something it says it does not, follow
[.github/SECURITY.md](.github/SECURITY.md) and report it privately.

## License

By contributing you agree your work is licensed under Apache-2.0 (see [LICENSE](LICENSE)).
