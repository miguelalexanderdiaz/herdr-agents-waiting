# Agents waiting

A dialog that answers one question: which of my agents need me? Press one key and a centered list opens with the agents that are blocked on a question first, then the ones that finished, each with the question or last message it left and how long it has waited. Under a rule come all the other agents, grouped by space. A search box on top finds any of them; Enter jumps to the one you picked. This is a piece you add to your current layout, not a whole window, and it needs no other mod.

![Agents waiting](preview.png)

This file is the brief: enough to build Agents waiting from an empty folder. The files next to it are one build of it. If they don't work on your Herdr, or you want it different, build it again from here. `preview.png` is an illustration drawn with invented data, not a screenshot.

## What you see

- A dialog, 640px wide, opened over the layout. Height follows the content (at most about 440px with a full list). Nothing is added to the layout itself.
- The dialog uses the theme's `popover` background, 18px padding, 10px between its parts, 13px text.
- **Header row.** On the left the title, 15px semibold: "N agents need you" ("1 agent needs you"), else "N finished", else "Nothing needs you right now" (or "No agents running" when there are none at all). On the right a **Sort** pill, 22px high, 6px radius, `raised` background, 11.5px: the word "Sort" in `dim` and the current order in `muted` ("Recent", "Oldest" or "Space order"); then a key hint in 11px `dim`: "↑↓ choose · Enter go · Tab sort · Esc".
- **Search box.** 36px high, 9px radius, 1px `accent` border, `background` fill, a 15px magnifier icon in `dim`, 12.8px text, placeholder "Search agents, spaces, programs…". It has focus when the dialog opens.
- **List**, at most 320px high, every row at a fixed height, scrolled when it does not fit. From top to bottom:
  - **Waiting rows**, 46px: first the agents that need you (blocked), then the finished ones (done), the longest-waiting first. Line one (20px): a 12px status mark, the agent's name in `foreground`, the status word and the time waited (11px), and on the right the space and tab ("space · tab", 11px `dim`, at most 200px). Line two, 11.5px `muted`: the question or last message the agent left, one line, cut with an ellipsis. It shows "…" until the first read returns.
  - A **rule**, 17px: a 1px `border` line, only when there are rows above and below it.
  - **Space heads**, 29px: an 18px tile with 5px radius in the space's color and its first letter in 10.5px bold (near-black or white, whichever reads better on that color), then the space name in 11px semibold `dim`.
  - **Agent rows**, 32px: one line, as line one above, with "program · tab" on the right.
  - An **earlier line**, 35px, last: "earlier: N agents idle for over a day ▾" (▴ when open), 12px `dim`, with a top border.
- The selected row has a `hover` background and 7px radius; rows have 4px side margins and 10px padding. The mouse hover shows the same background.

## How it behaves

Every status, as the status mark and word show it:

| Status | Mark | Word | Where it sits |
| --- | --- | --- | --- |
| blocked | `●` in `blocked` color | "needs you" in `blocked` color | top, with its question on line two |
| done | `●` in `done` color | "finished" in `done` color | top, after the blocked ones |
| working | a 12px spinner ring turning every 900ms, `working` color | "working" in `working` color | under the rule, grouped by space |
| idle | `○` in `dim` | "idle" in `dim` | under the rule, grouped by space |

After the word comes the time since that status began ("<1m", "5m", "3h", "2d"). Under the rule the agents are ordered by the Sort pill: **Recent** (latest status change first), **Oldest** (longest idle first) or **Space order** (as the space tree lists them); spaces follow their first agent. The choice is shared (`attention.sort`) so every copy of the mod, and the portrait layout, agree. Agents that are not working, not focused and idle for over 24 hours fold into the earlier line; searching opens the fold. Clicking that line, or choosing it and pressing Enter, opens or closes it.

Where the time comes from, best first: the shared `agents.since` map when a layout publishes one; else the tab's own `working_since` (working) or `changed_at`; else the time this mod first saw that status, which it keeps itself. The dialog only exists while open, so a change that happens while it is closed is dated by the tab time, or by the next time you open it. Times are approximate.

Keys and mouse:

| Input | What it does |
| --- | --- |
| `Ctrl+Shift+A` | Opens the dialog; pressing it again closes it (`mod.open` toggles) |
| `↑` / `↓` | Move the selection through the rows you can pick, wrapping at both ends. The selection follows the agent, not the row, when the list reorders |
| `Enter` | Show the selected agent and close; on the earlier line it opens or closes the fold instead |
| Typing | Filters live. Every word you type must appear somewhere in the agent's name, program, space, tab, terminal title or status words ("needs you", "finished", "working"), in any order. No match shows "No match" |
| `Tab` / `Shift+Tab` | Next / previous sort order |
| Click the Sort pill | Next sort order; its tooltip names the current one and the next |
| Click a row | Show that agent and close |
| Mouse wheel | Scrolls the list; the selection follows |
| `Esc` | Closes without doing anything |
| `1`–`9` | Only when opened with `props.search` set to `false` (no search box): jump to the numbered row |

Showing an agent runs `agent.focus` with its terminal address. When nothing is running the list says "No agents running" and "Start one and it will show here"; when agents exist but none waits, the title is "Nothing needs you right now".

## Built from

- **One mod**, `mods/attention-picker/`: `main.js` (the view), `logic.js` (row building, sorting, search, selection, status times, the preview reader; no Herdr imports), `ask.js` (reads a question out of screen text; pure), `spinner.svg` and `search.svg` (24x24, `currentColor` strokes, drawn for this mod) and `mod.json`: `{ "place": "none", "title": "Agents waiting", "overlay": { "kind": "dialog", "width": 640 } }`. So it never docks into a layout; it only opens as an overlay. No `layouts/` folder.
- **A `keys.json` snippet**, merged into the person's keys, never replacing a key they use:

  ```json
  {
    "global": { "ctrl-shift-a": "mod.open:attention-picker" },
    "terminal": { "ctrl-shift-a": "mod.open:attention-picker" }
  }
  ```

  The `terminal` entry matters: a focused terminal uses the more specific section, so without it the key would reach the program instead.
- **View:** `View`, `div`, `svg` from `gpui-kit`; `v_flex`, `h_flex`, `InputState`, `Input` from `gpui-base`. The strip is laid out with absolute rows at fixed heights (head 29, agent 32, waiting 46, rule 17, earlier 35) inside a list capped at `LIST_H` = 320 (px), scrolled by hand.
- **`herdr` functions:** `agents`, `spaces`, `run`, `hc`, `theme`, `settings`, `shared`, `setShared`, `props`, `closeOverlay`. Theme colors used: `popover`, `background`, `foreground`, `muted`, `dim`, `accent`, `border`, `raised`, `hover`, `blocked`, `done`, `working`, and `ansi*` names for space colors.
- **Props:** `search`. Only `false` turns the search box off; anything else, including no props at all, shows it. The portrait layout's bar strip passes `true` or `false`.
- **Shared keys:** read `agents.since` (`{ address: ms }`, wins when present), read `space.colors` (`{ spaceId: theme color name or #rrggbb }`, default `ansi6`), read and write `attention.sort` (`"recent" | "oldest" | "space"`). This mod never writes `agents.since`.
- **Commands:** `agent.focus {terminal}` to show the agent; `mod.open` (from the key); `overlay.close` only as a fallback when the overlay id is missing. It closes itself with `closeOverlay(props().overlay)`.
- **Programs:** `hc read <address> --lines 60` (the terminal's screen plus 60 lines of history), for agents that are blocked or done, every `POLL_MS` = 3000 ms while the dialog is open, one pass at a time, at most `READ_CONCURRENCY` = 4 reads at once, and no pass when nothing is waiting (`READ_LINES` = 60). The result goes through `ask.js`: for a blocked agent the last line ending in `?` (a trailing `(y/n)` or `[y/N]` is allowed), else the last message line that starts with `●`, `⏺` or `•` and is not a tool call such as `Bash(npm test)`; at most 200 characters.
- **Storage:** `localStorage` key `attention.seen`: `{ address: { s: status group, at: ms } }`. No screen text. It is written only when it changes and pruned to the agents that exist.
- **Art:** the two SVGs and the colors above; nothing is fetched.

## Watch out

- **What it reaches. Tell the person before adding it.** It runs `hc read` on other terminals, so it reads the text on their screens (and 60 lines of history) while the dialog is open. It keeps one line per waiting agent in memory, shows it, and never writes it to disk or sends it anywhere. It stores only the `attention.seen` record (agent address, status group, time) in the mod's `localStorage`. It reads the shared keys `agents.since` and `space.colors` and reads and writes `attention.sort`. It uses no network, runs no program but `hc read`, and reads and writes no files, including outside its own folder. Its two icons load from its own folder.
- **`Ctrl+Shift+A` is taken from terminal programs.** Bind another key by editing `keys.json`: `"<key>": "mod.open:attention-picker"` in both sections. Avoid `cmd-` (not on Linux or Windows), `ctrl-alt-` (AltGr on Windows) and Option (types characters on a Mac). Existing key bindings can win over a new one; resolve a conflicting `ctrl-shift-a` in the active `layout:<name>` section.
- **Name clash.** If `mods/attention-picker` is taken, rename the folder and change the same name in two more places: `const HOME = "mods/attention-picker"` at the top of `main.js` (the only place the folder name is written in code), and the `mod.open:` value in `keys.json`. The shared key names (`attention.sort`, `agents.since`, `space.colors`) and the prop name `search` must not change: another layout may rely on them.
- **Fixed size.** The list is 320px high at most, so the dialog needs a window about 440px tall; the width is 640px. Check it fits.
- **The question preview is a guess.** `ask.js` reads plain screen text and is tuned to Claude Code style screens (a `●` message line, a `?` question). Other agents may show a different line or nothing; the row still works. Colors and fonts come from the theme, so contrast depends on it (the dim 11px text is the weakest part on a light theme).
- **Times.** They start counting when the status is first seen unless the tab or a layout supplies a time (see How it behaves), and they are not exact. Nothing records history while the dialog is closed.
- **The home space.** A space literally named `~` has its tile drawn in `dim` instead of a color. That is cosmetic; nothing else depends on the name.
- **Platforms.** Pure JavaScript, no OS-specific paths, fonts or programs besides Herdr's own `hc`, and keys without `cmd`. Built and checked with `herdr-app check` on herdr-app 0.1.12 on macOS. The pure parts (`logic.js`, `ask.js`) have unit tests that CI runs on Linux, Windows and macOS (`node --test`); the dialog itself has not been run on Linux or Windows.
- Follow the installed `herdr.d.ts` and `gpui-kit.d.ts`, never modify shipped mods, and do not commit the `gpui-kit.d.ts` and `jsconfig.json` files Herdr writes into the folder. `View.close()` is the host's cleanup hook, so the mod's own close method is named `dismiss`.

## Done when

- `herdr-app check mods/attention-picker` passes with the matching Herdr binary and home.
- With `keys.json` merged into an empty Herdr home, `Ctrl+Shift+A` opens a 640px dialog with the search box focused and no other mod installed; pressing it again, or `Esc`, closes it.
- With one blocked agent and one finished agent, the title reads "1 agent needs you", both sit above the rule with their status words, a time waited and a one-line preview of what they left (blocked first), and the key hint reads "↑↓ choose · Enter go · Tab sort · Esc".
- Typing two words that both appear in one agent's name or space leaves only that agent; typing nonsense shows "No match".
- `Tab` cycles Recent, Oldest, Space order and `Shift+Tab` goes back; the new order is still there after closing and reopening, and the Sort pill shows it.
- `↑`/`↓` wrap at both ends, and `Enter` or a click focuses that agent's terminal and closes the dialog.
- An agent idle for more than 24 hours is only listed inside the "earlier" line, which opens on click and while searching.
- With no agents running, the dialog says "No agents running" and "Start one and it will show here".
- No `fetch`, `exec` or file access in `mods/` (`rg "fetch\(|exec\(|readTextFile|writeTextFile" mods/` finds nothing), and no home path, e-mail or name in any file.
- Opened with `props.search` set to `false` (by a layout that passes it), there is no search box and `1`–`9` jump to the numbered rows.
