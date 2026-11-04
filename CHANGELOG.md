# Changelog

All notable changes to the Agents waiting mod. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
with Herdr's own `New` / `Fixed` headings, so an entry can be pasted into a herdr.dev listing. The mod does not carry
a version field in `mod.json` (Herdr's types do not define one), so versions here are this changelog's own.

Task ids in brackets (R1-CR-n code-review, R1-HC-n herdr-completeness, R1-DOC-n documentation) refer to
[plans/round-1/PLAN.md](plans/round-1/PLAN.md).

## [Unreleased]

Round 1: make the mod standalone and publishable.

### New

- Opens with its own key: `Ctrl+Shift+A` is bound to `mod.open:attention-picker` in `keys.json`. It no longer needs
  another mod's command. [R1-HC-1]
- The search box is on by default. `props.search === false` still gives the keys-only variant with 1-9 jump badges.
  [R1-CR-1]
- Waiting times, the Recent and Oldest sorts and the "earlier" fold now work without another mod. The start of a
  status comes from shared `agents.since` if present, else the tab's `changed_at`, else a first-seen time the mod
  keeps in its own local storage. [R1-CR-2]
- Search matches every word you type, in any order, across name, program, space, tab, title and status words. [R1-CR-8]
- `Shift+Tab` goes to the previous sort. [R1-CR-5]
- Its own spinner and search icons, drawn for this mod. [R1-CR-3]
- A clearer empty state: "No agents running / Start one and it will show here" when there are no agents. [R1-CR-8]
- Pure logic moved to `logic.js`, with `node --test` tests for it and for the preview parser. [R1-CR-2, R1-CR-7]
- Apache-2.0 licence and NOTICE; RECIPE.md and an illustration (`preview.png`) in Herdr's sharing format; CI on macOS,
  Linux and Windows running the validation, privacy scan, docs check and tests. [R1-HC-2 to R1-HC-8]
- Documentation: README, AGENTS.md for agents, `llms.txt`, CONTRIBUTING.md, this changelog and a static site under
  `docs/` for GitHub Pages. [R1-DOC-1 to R1-DOC-4]

### Fixed

- The selection stays on the same agent when the list reorders while the dialog is open; before, it followed the
  row position and could send you to a different agent. [R1-CR-5]
- Preview reading no longer stacks: one pass at a time, at most 4 screens read together, every 3 s
  instead of 2 s, skipped when nothing is blocked or done. A failed read no
  longer leaves an ellipsis forever. [R1-CR-4]
- The "finished" preview shows the agent's last message instead of its last tool call. [R1-CR-6]
- Blocked previews also recognise `(y/n)` and `[y/N]` hints and ignore terminal colour codes. [R1-CR-6]
- The mod no longer loads icons from another mod's folder. [R1-CR-3]
- Space initials are drawn in white or near-black, whichever reads better on the space colour (white had only 2.8 to
  3.4:1 contrast on the default colours). [R1-CR-9]
- A terminal title that is really a path (`~/code/app`, `/srv/app`) is no longer shown as the agent's name. [code-review log]
- The class no longer defines `close`, which Herdr reserves for its own cleanup call. [R1-CR-1]

### Changed

- Previews read the screen plus 60 lines of history above it (`hc read --lines 60`; before, the screen only), so a
  question that has scrolled up a little is still found. [R1-CR-4]
- The key shipped in `keys.json` is `ctrl-shift-a`; the `ctrl-b a` chord of the original setup is not shipped. [R1-HC-1]
- The header comment of `main.js` describes the mod's contract instead of one setup. [R1-CR-9]

### Known limits

- Run in Herdr on macOS only; Linux and Windows are covered by CI for the pure modules.
- Status times from the local record are estimates: the dialog cannot see changes while it is closed.
- A stale shared `agents.since` left by a layout you stopped using still wins (planned for round 2).

## [0.1.0] - baseline

The mod as imported from a working Herdr setup: opened by another mod's command, search box only when asked for,
status times only from shared `agents.since`, icons from the shipped `workspace-chrome` mod.
