# Agents waiting

A [Herdr](https://herdr.dev) mod: one dialog that answers "which of my agents needs me?"

It lists the agents that are blocked on you, then the ones that have finished, each with a one-line preview of what
it asked and how long it has waited. Under a rule it lists every other agent, grouped by space. You search, sort,
pick one with the keyboard or the mouse, and Herdr takes you to it.

![Illustration of the Agents waiting dialog](preview.png)

*An illustration drawn with made-up data, not a screenshot.*

- **Needs you first.** Blocked agents, then finished ones, longest-waiting first, with a preview of the question.
- **Everyone else below a rule**, grouped by space, with the space's colour. Agents idle for over a day fold into an
  "earlier" line.
- **Search** across name, program, space, tab and title. Every word must match.
- **Three sorts** for the lower list: Recent, Oldest, Space order. `Tab` cycles them (`Shift+Tab` goes back) and the
  choice is remembered.
- **Standalone.** One folder and one key. No other mod is needed.

Status: round 1 of a hardening pass (see [CHANGELOG.md](CHANGELOG.md)). It has been run in Herdr on macOS only.

## Install

### With a Herdr agent

Paste this into an agent that works in your Herdr home:

```text
Add the Herdr mod from https://github.com/miguelalexanderdiaz/herdr-agents-waiting
(the folder mods/attention-picker). Read RECIPE.md and AGENTS.md in that repo first and
tell me what the mod reaches before you copy anything. Merge its keys.json into mine and
ask me before replacing any key I already use. Then run herdr-app check on the mod folder.
```

When the repository is public and listed, `herdr.dev/mods/miguelalexanderdiaz/herdr-agents-waiting` works the same
way. Agents: read [AGENTS.md](AGENTS.md).

### By hand

1. Get the files: `git clone https://github.com/miguelalexanderdiaz/herdr-agents-waiting.git`, or download the zip.
2. Copy the `mods/attention-picker` folder into the `mods` folder of your Herdr app home (Herdr's documentation
   gives `~/.config/herdr-app`; use the folder your install says). Copy it whole: the icons load from
   `mods/attention-picker/`.
3. Add the key to your `keys.json`, in both the `global` and `terminal` sections. If you already use that key, choose
   another; do not overwrite yours.

   ```json
   {
     "global":   { "ctrl-shift-a": "mod.open:attention-picker" },
     "terminal": { "ctrl-shift-a": "mod.open:attention-picker" }
   }
   ```

4. Check it: `herdr-app check ~/.config/herdr-app/mods/attention-picker`. Herdr loads mods and keys live, so there
   is no restart.
5. Press `Ctrl`+`Shift`+`A`.

`herdr-app check` renders the mod once. It does not run the timers or screen reads that start later, so also open the
dialog in the app.

**Name clash.** If you already have a mod called `attention-picker`, do not overwrite it. Install this one under
another name and change three places: the folder, the `HOME` constant at the top of `main.js`, and the name in your
`keys.json` line (`mod.open:<new name>`).

## Open it

| Way | How |
|---|---|
| Key | `Ctrl`+`Shift`+`A` (the key in this repo's `keys.json`). The same key closes it. |
| Another key | Put `"<key>": "mod.open:attention-picker"` in the `global` and `terminal` sections of `keys.json`. |
| Command palette | Run the `mod.open` command from `app.palette`. |
| A terminal | `herdr-app do mod.open '{"name":"attention-picker"}'` (again: closes it). |
| Another mod | `openOverlay({ mod: "attention-picker", kind: "dialog", width: 640 })`. Pass `props: { search: false }` for the keys-only variant. |

## Use it

| Key | Does |
|---|---|
| Typing | Filters the list (the search box is on by default). |
| `Up` / `Down` | Move the selection (wraps). It stays on the same agent when the list reorders. |
| `Enter`, click | Go to the agent: Herdr focuses it and the dialog closes. On the "earlier" line it folds or unfolds. |
| `Tab` / `Shift+Tab` | Next / previous sort: Recent, Oldest, Space order. |
| `Esc` | Close. |
| `1`-`9` | Jump to a numbered agent, only in the keys-only variant (`search: false`). |

The time beside a status is how long the agent has been in it. The mod takes the start from, in order: the shared
`agents.since` value if another mod publishes it, the agent's tab `changed_at` from Herdr, or the first time the
dialog saw the agent in that status. The dialog only exists while it is open, so it cannot see changes that happen
while it is closed: with only the third source, an agent that went idle yesterday counts from your next open.

Previews are best effort. They are tuned to Claude Code style screens (question boxes, numbered choices, `(y/n)`
hints, bullet message lines). Other agents may show a blank second line; the row still works.

More in the [documentation site](docs/index.html): [install](docs/install.html), [usage](docs/usage.html),
[configuration](docs/configuration.html), [how it works](docs/how-it-works.html),
[troubleshooting](docs/troubleshooting.html).

## Requirements

| | Needs |
|---|---|
| Herdr app | Checked against 0.1.12. The mod uses only Herdr's documented mod API. |
| Other mods | None. |
| Node, npm, network | None to run it. Node 22 or newer only to run this repo's tests. |
| macOS | Run in Herdr by the author. |
| Linux, Windows | The mod is plain JavaScript with no operating-system calls, and CI runs its pure-logic tests on macOS, Linux and Windows. It has not been run in Herdr on Linux or Windows yet. |

## Privacy and permissions

What this mod does on your machine, so you can decide before installing:

- **Reads other terminals' screen text.** While the dialog is open, every 3 seconds it runs
  `hc read <address> --lines 60` (Herdr's own tool; the screen plus up to 60 lines of history above it; at most 4
  at a time) for agents that are blocked or finished, and shows one line of it. That line lives in memory and goes away when the dialog closes.
  It is never written to disk or sent anywhere.
- **Stores two small things.** A map from agent address to the time it was first seen in its current status, in the
  mod's own `localStorage` (key `attention.seen`, no screen text), and your sort choice in Herdr's shared state (`attention.sort`).
- **Reads shared values** `agents.since` and `space.colors` if present. It never writes them.
- **No network, no `exec`, no file access.** The only program it runs is `hc read`. Choosing a row calls Herdr's
  `agent.focus`; it sends no input to any terminal.

Herdr's instructions ask an installing agent to tell you this before it adds a mod. [AGENTS.md](AGENTS.md) and
[RECIPE.md](RECIPE.md) say the same.

## Troubleshooting

| Symptom | Try |
|---|---|
| The key does nothing | Check both `global` and `terminal` sections and that `keys.json` is valid JSON. Another program may use the key: bind a different one. Test with `herdr-app do mod.open '{"name":"attention-picker"}'`. |
| No spinner or search icon | The icons load from `mods/attention-picker/`. After renaming the folder, change `HOME` in `main.js`. |
| No search box | It was opened with `search: false`. Open it with its own key. |
| No time on a row | No source has a start for that agent yet; it appears once the dialog has seen it. See "Use it". |
| Blank second line | Nothing recognisable on that terminal's screen. Other agents than Claude Code style ones may show nothing. |

Longer answers: [docs/troubleshooting.html](docs/troubleshooting.html). Report problems on the repository's issue
tracker with your Herdr version (`herdr-app --version`) and OS.

## Uninstall

Delete the `mods/attention-picker` folder from your Herdr home and remove the `mod.open:attention-picker` lines from
`keys.json`. The shared value `attention.sort` and the mod's stored first-seen times are left behind; nothing reads
them once the mod is gone.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Tests: `npm test` (which runs `node --test`, Node 22 or newer).
Agents editing this repo: [AGENTS.md](AGENTS.md).

## Licence

Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
