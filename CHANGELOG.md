# Changelog

All notable changes to the Agents waiting mod. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The mod does not carry a version number: Herdr defines no version field for mods and `herdr-app check` ignores one, so a
release number names the repository, not the mod. Releases are written here by [release-please](https://github.com/googleapis/release-please) from the titles of the pull requests merged since the last release (Conventional Commits, see CONTRIBUTING.md), newest first, and tagged `vX.Y.Z` on GitHub. Below them is the hand-written history from before the first release. The plans, audits and logs behind each round are in [plans/](plans/) for the curious.

## [Before the first release]

### Fixed

- The privacy scan no longer fails on GitHub's own merge message ("Merge pull request #N from <owner>/<branch>"): the owner there is the public handle already in the clone URL. It failed on `main` after every PR merge, never on the PR itself.

### Added

- One-line install: `install/install.sh` (macOS, Linux; `curl ... | sh`) and `install/install.ps1` (Windows; `irm ... | iex`). They say what the mods reach and ask first, copy the mods in (backing up what they replace), merge `keys.json` asking before replacing a key, run `herdr-app check`, and remove what they added with `--uninstall`. Tested on all three systems in CI (`tests/install.test.mjs`).

### Round 2: check what round 1 claimed, then harden it

#### New

- `scripts/verify-install.mjs` checks an installed copy of the mod, which `herdr-app check` does not: the folder name
  against `HOME`, the icons, `mod.json`, and (with a Herdr home) a key for `mod.open:attention-picker`.
- A quiet dialog redraws every 30 seconds, so a time such as "5m" becomes "6m" without a keypress.
- `main.js` is now run by a test under Node, against stand-in modules for `gpui-kit`, `gpui-base` and `herdr`
  (`tests/main.test.mjs`): imports, keys, closing, and what is written to shared state and storage. The repository's
  own checks have tests too. This proves the wiring, not how the dialog draws, and none of it is Herdr.
- The CI definition ships as `scripts/ci.workflow.yml` (Linux, Windows and macOS, each on Node 22 and 24). It is
  enabled when the owner installs it and has not run yet.
- A bug report form, a pull request template and `.github/SECURITY.md` (private reporting through GitHub).
- A 404 page, a "Verification status" table of what has not been observed, notes for layout authors on
  `agents.since` and `space.colors`, and a "What it lists" section.
- Source files carry an SPDX license header; `package.json` declares the license and Node `>=22`.

#### Fixed

- The title ("N agents need you") counts all your agents; it no longer changes while you type in the search box.
- A shared `space.colors` value the mod cannot read (a number, `null`, a list, an unknown name) no longer blanks the
  dialog; it falls back to teal. `#rgb` and `#rrggbbaa` colors are accepted.
- Previews: a bullet indented inside a message is no longer taken as the message; a message marker in front of a
  question is dropped from a blocked agent's preview.
- Pressing `Tab` twice quickly steps two sorts instead of one; the Sort pill and `Tab` share the same step.
- An agent with no known start time sorts last under Oldest as well as under Recent.
- The first-seen record starts a new time when an agent's sequence number goes down or its space changes (an address
  that was reused); it now stores `{ s, at, q, sp }` and still reads older records.
- A stale shared `agents.since` for a blocked or working agent alone in its tab is ignored when the tab shows a newer
  change by more than 10 seconds. This is a partial guard.
- Documentation: claims that need a live window are no longer stated as seen, the privacy statement says it is this mod's
  policy and not a Herdr sandbox, and the site gained keyboard-reachable tables and a phone-width layout.

#### Changed

- A preview screen that has not changed is read again about every 30 seconds instead of every 3; a change of the agent's
  status or Herdr sequence number reads it at once. A question that appears without either can show up to about
  30 seconds late.
- The repository's checks accept only the mod's known imports, `run()` commands and `hc` calls, the privacy scan
  accepts GitHub web-merge and Dependabot commits, and the docs check compares the constants and numbers the
  documents quote with the code.

#### Known limits

- Not yet observed in a live window: the key closing the dialog while the search box has focus, `Tab` reaching the
  dialog from the search box, `localStorage` surviving a reload, `hc read --lines 60` output and the unit of a tab's
  `changed_at`, polling stopping on close, the palette entry for `mod.open`, the 30-second redraw. The table with a
  30-second check for each is under "Verification status" in the README and `docs/install.html`.
- Tested on Herdr 0.1.12 only; nothing run on Linux or Windows.
- The stale-time guard does not cover finished or idle agents or tabs with several agents; a full fix needs a
  heartbeat key from the layout that writes `agents.since`.
- Dim 11 px text may be hard to read on a light theme; a change is waiting for the author's decision.

### Round 1: make the mod standalone and publishable

#### New

- Opens with its own key: `Ctrl+Shift+A` is bound to `mod.open:attention-picker` in `keys.json`. It no longer needs
  another mod's command.
- The search box is on by default. `props.search === false` still gives the keys-only variant with 1-9 jump badges.
- Waiting times, the Recent and Oldest sorts and the "earlier" fold now work without another mod. The start of a
  status comes from shared `agents.since` if present, else the tab's `changed_at`, else a first-seen time the mod
  keeps in its own local storage.
- Search matches every word you type, in any order, across name, program, space, tab, title and status words.
- `Shift+Tab` goes to the previous sort.
- Its own spinner and search icons, drawn for this mod.
- A clearer empty state: "No agents running / Start one and it will show here" when there are no agents.
- Pure logic moved to `logic.js`, with `node --test` tests for it and for the preview parser.
- Apache-2.0 license and NOTICE; RECIPE.md and an illustration (`preview.png`) in Herdr's sharing format; scripts that
  validate the mod, scan for personal data and check the docs.
- Documentation: README, AGENTS.md for agents, `llms.txt`, CONTRIBUTING.md, this changelog and a static site under
  `docs/` for GitHub Pages.

#### Fixed

- The selection stays on the same agent when the list reorders while the dialog is open; before, it followed the
  row position and could send you to a different agent.
- Preview reading no longer stacks: one pass at a time, at most 4 screens read together, every 3 s
  instead of 2 s, skipped when nothing is blocked or done. A failed read no
  longer leaves an ellipsis forever.
- The "finished" preview shows the agent's last message instead of its last tool call.
- Blocked previews also recognize `(y/n)` and `[y/N]` hints and ignore terminal color codes.
- The mod no longer loads icons from another mod's folder.
- Space initials are drawn in white or near-black, whichever reads better on the space color (white had only 2.8 to
  3.4:1 contrast on the default colors).
- A terminal title that is really a path (`~/code/app`, `/srv/app`) is no longer shown as the agent's name.
- The class no longer defines `close`, which Herdr reserves for its own cleanup call.

#### Changed

- Previews read the screen plus 60 lines of history above it (`hc read --lines 60`; before, the screen only), so a
  question that has scrolled up a little is still found.
- The key shipped in `keys.json` is `ctrl-shift-a`; the `ctrl-b a` chord of the original setup is not shipped.
- The header comment of `main.js` describes the mod's contract instead of one setup.

#### Known limits

- The original mod ran in the author's Herdr on macOS. The round 1 changes passed `herdr-app check` and the unit tests
  only; they have not been watched in a live window.
- Not run in Herdr on Linux or Windows. CI is defined in `scripts/ci.workflow.yml` (Linux, Windows and macOS, each on Node 22 and 24);
  it is enabled when the owner installs it and has not run yet, so treat those systems as unchecked.
- Status times from the local record are estimates: the dialog cannot see changes while it is closed.
- A stale shared `agents.since` left by a layout you stopped using can still win.

## Baseline

The mod as imported from a working Herdr setup: opened by another mod's command, search box only when asked for,
status times only from shared `agents.since`, icons from the shipped `workspace-chrome` mod.
