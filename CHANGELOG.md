# Changelog

All notable changes to the Agents waiting mod. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The mod does not carry a version number: Herdr defines no version field for mods and `herdr-app check` ignores one, so
the entries below are grouped by when they landed. Nothing here has a release number or date until the repository is
published. The plans, audits and logs behind each round are in [plans/](plans/) for the curious.

## [Unreleased]

### Round 2: check what round 1 claimed, then harden it

Round 2 entries are added below as each part lands; the section is filled in at the end of the round.

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
- Not run in Herdr on Linux or Windows. A CI definition for macOS, Linux and Windows is in `scripts/ci.workflow.yml`;
  it is not enabled until the owner installs it, so treat those systems as unchecked.
- Status times from the local record are estimates: the dialog cannot see changes while it is closed.
- A stale shared `agents.since` left by a layout you stopped using can still win.

## Baseline

The mod as imported from a working Herdr setup: opened by another mod's command, search box only when asked for,
status times only from shared `agents.since`, icons from the shipped `workspace-chrome` mod.
