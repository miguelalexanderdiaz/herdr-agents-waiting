# AGENTS.md

For AI agents that install, adapt, test or edit this repository. Humans: start with [README.md](README.md).

If you are a round agent working on this repo: read `plans/round-*/SUMMARY.md` (what was decided and what is open) and
the shared board named in your task before you change anything.

## What this repo is

A single [Herdr](https://herdr.dev) app mod, `mods/attention-picker` ("Agents waiting"): a dialog overlay listing the
agents that need the person, then the finished ones, then every other agent grouped by space. Plain JavaScript run
by Herdr's native GPUI toolkit: no DOM. Herdr gives mods `exec`, `fetch` and file access and does not sandbox
them; this mod's own policy, checked by `scripts/validate.mjs`, is to use none of them besides one `hc read` call.

This repository is the canonical source of the mod. The portrait layout repository bundles a copy that is synced
from here after each round (see "Syncing the portrait layout").

| Path | What |
|---|---|
| `mods/attention-picker/mod.json` | name, title, overlay (dialog, width 640) |
| `mods/attention-picker/main.js` | the view; constants `HOME`, `POLL_MS`, `READ_LINES`, `READ_CONCURRENCY`, `SEEN_KEY`, `HOME_SPACE_NAME` at the top |
| `mods/attention-picker/logic.js` | pure helpers, no Herdr imports (what the tests load) |
| `mods/attention-picker/ask.js` | pure: screen text to the one-line preview |
| `mods/attention-picker/spinner.svg`, `search.svg` | the icons, loaded as `mods/attention-picker/<file>` |
| `keys.json` | the key the mod expects: `ctrl-shift-a` to `mod.open:attention-picker` |
| `RECIPE.md`, `preview.png` | the brief and illustration Herdr's sharing format asks for |
| `tests/` | `node:test` tests of the pure modules |
| `scripts/` | `validate.mjs`, `privacy-scan.mjs`, `check-docs.mjs`, `check-local.mjs` (the one-shot gate that runs all of them), `ci.workflow.yml` |
| `docs/` | the GitHub Pages site (plain HTML and CSS) |
| `plans/round-N/` | each improvement round's plan, role logs and summaries |

Herdr's own reference is in your Herdr app home (`~/.config/herdr-app`): its `AGENTS.md`, `herdr.d.ts` and
`gpui-kit.d.ts`. Read those before changing the mod.

## Installing it for a person

Follow Herdr's "Layouts and mods other people made" steps.

1. **Tell the person first**, before copying anything. This mod:
   - runs `hc read <address> --lines 60` for blocked and finished agents while its dialog is open (every
     3 s, at most 4 at a time). That reads other terminals' screen text (the screen plus up to 60 lines of history above it). One line per agent is
     kept in memory; nothing is stored or sent.
   - stores in its own local storage (key `attention.seen`) a map from agent address to the time it was first seen in its
     status. No screen text. It also writes the shared value `attention.sort`.
   - does not use the network, `exec`, or any file outside its folder, and sends no input to terminals. Say it as
     this mod's policy, not as a Herdr rule: Herdr would let a mod do all of that, and only `scripts/validate.mjs`
     and the `rg` commands in the claim map below hold this one to it.
2. Read `RECIPE.md` and every file in `mods/attention-picker/` before writing anything.
3. Copy the whole folder `mods/attention-picker/` (`main.js` imports `logic.js` and `ask.js`; both SVGs are
   loaded) to `<herdr home>/mods/attention-picker/`. **Never overwrite.** If that name is taken (theirs or Herdr's),
   copy it under another name and change three places: the folder, the `HOME` constant at the top of `main.js`, and
   the name in the `keys.json` entry. Do not copy `RECIPE.md` or `preview.png` into the home. Herdr's `mod.clone`
   rewrites a mod's own `mods/<name>/` paths when it duplicates an installed mod; after any rename check `HOME`
   yourself. The home is `~/.config/herdr-app` unless `HERDR_APP_HOME` says otherwise (`herdr-app --help`).
4. Merge `keys.json` into the person's: add `ctrl-shift-a` to `global` and `terminal`. Both are needed: a focused
   terminal uses the more specific `terminal` section (Herdr's AGENTS.md), and a `layout:<name>` section can
   override both, so a conflicting `ctrl-shift-a` may sit there. If they already use that key, ask which key to use.
   Never replace a key without asking.
5. Run `herdr-app check <absolute path of the installed mod folder>`. It must pass. It only renders once, does
   not run later timers or reads, and passes a renamed folder with a wrong `HOME`, so tell the person to press the
   key and look.
6. Do not edit the person's live Herdr home beyond steps 3 and 4: Herdr reloads on every save.

## Adapting it

- Work on a copy outside the Herdr home. Install last.
- Change the key: edit the left side of the `keys.json` entries. Any key Herdr accepts works; `ctrl-alt` and `cmd`
  keys are avoided here because AltGr and macOS conflicts are person-specific.
- Open it from another mod: `openOverlay({ mod: "attention-picker", kind: "dialog", width: 640, props: { search } })`.
- To tune behavior use the constants at the top of `main.js`; do not scatter new magic numbers.
- Keep personal data out: no real names, home paths (write `~`), emails or hostnames in any file or commit. The
  repository's `scripts/privacy-scan.mjs` fails on them.

## Testing

```bash
npm test                                            # node --test: logic.js and ask.js (Node 22+, no dependencies)
node scripts/validate.mjs                           # structure, JSON, contract, capabilities
node scripts/privacy-scan.mjs                       # no personal data in the tree or the history
node scripts/check-docs.mjs                         # docs links, Pages assets, no external origins
node scripts/check-local.mjs                        # the one-shot gate: all of the above plus herdr-app check
herdr-app check <absolute path to mods/attention-picker>   # Herdr validates the mod (needs the desktop app)
```

Use `npm test` or plain `node --test`. Do not pass the folder (`node --test tests/`): on Node 22.14 and 26.5 (the
versions it was run on) a directory argument is loaded as a module and fails. `package.json` declares Node `>=22`;
older Node was never tried. A CI definition for macOS, Linux and Windows is in `scripts/ci.workflow.yml`; it is not
enabled until the owner installs it (the token that pushes this repo cannot write `.github/workflows/`). Until a run
is green, treat Linux and Windows as unchecked. `herdr-app check` is a local gate because it is the desktop binary.

Do not drive the running app while testing: no `herdr-app do`, `shot` or `status`, and do not start a second app.
`herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folder; they are git-ignored. Never
commit them.

## Editing it safely

- Herdr reloads a mod the moment a file in its folder is saved. In the live home that shows on the person's screen
  immediately. Edit a copy.
- Mods are JavaScript on GPUI. Never keep a `cx` for later use; do not use `setTimeout` or `setInterval` (use
  `cx.timer`); no top-level `await`. This mod also does not use `fetch`, `exec` or file access (its policy;
  `scripts/validate.mjs` fails on them).
- Herdr keeps a hidden copy's timers running, so a poll must be gentle. This mod's poll starts in the dialog's
  `init` and nowhere else; do not add a background poll.
- A save that does not load keeps the old build running and shows only in `herdr-app status`, which you may not run
  here. After any edit, your gates are `herdr-app check` and reading your own diff.
- The view class must not define a `close` method: Herdr uses `close(cx)` as its cleanup hook. The mod closes itself
  with `dismiss()`, which calls `closeOverlay(props().overlay)` (or the `overlay.close` command when there is no id).
- `svg()` and image paths are relative to the Herdr home, so they are `mods/attention-picker/<file>`. Installing under
  another folder name breaks them unless `HOME` is changed.
- Keep pure logic in `logic.js` and `ask.js` so Node can test it. `main.js` imports `gpui-kit`, `gpui-base` and
  `herdr`, which only exist inside Herdr.
- Unknown shared values must degrade: `attention.sort` outside `recent|oldest|space` reads as `recent`; `agents.since`
  and `space.colors` may be missing or malformed.
- Mod `localStorage` is per mod copy. Wrap every access in `try/catch`; it can be absent or throw.
- Shared state is saved to `shared.json` by Herdr, so `attention.sort` survives restarts and an `agents.since` left by
  a layout can be stale and still win.
- `herdr-app check` does not run deferred rows or later async states. Review those by reading the code.

## Do not break (other setups depend on it)

The portrait layout bundles this mod and opens it from its own bar. Keep these exactly:

| Surface | Contract |
|---|---|
| Mod folder name | `attention-picker` (opened by name with `openOverlay({ mod: "attention-picker" })`) |
| Prop `search` | `false` gives the keys-only variant with 1-9 badges. Absent or anything else shows the search box |
| Shared `attention.sort` | read and written; `recent`, `oldest` or `space`; anything else reads as `recent` |
| Shared `agents.since` | read only; `{ [address]: epoch ms }`; wins over every other time source; never written by this mod |
| Shared `space.colors` | read only; `{ [space id]: "ansiN" or "#rrggbb" }` |
| Prop `overlay` | supplied by Herdr; the mod closes itself with `closeOverlay(props().overlay)` and falls back to the `overlay.close` command when it is missing |
| Command | `agent.focus` with `{ terminal: address }` (and `overlay.close`, only if `props().overlay` is missing) |

Adding a prop or shared key is a change to this table and needs a note in [CHANGELOG.md](CHANGELOG.md) and on the
board of every repository that bundles the mod.

## Syncing the portrait layout

After a round lands here, the portrait layout repository copies these files into its own `mods/attention-picker/`:
`mod.json`, `main.js`, `logic.js`, `ask.js`, `spinner.svg`, `search.svg`. Never copy `gpui-kit.d.ts` or
`jsconfig.json` (Herdr writes them), `RECIPE.md`, `preview.png`, `tests/` or `scripts/`. Then run `herdr-app check`
on the copy and `diff -r` the two mod folders: the only differences should be the two Herdr-written files.

## Docs rules

- Every number, key and behavior in README, `docs/` and `RECIPE.md` must come from the code. The map below says
  where; re-run each grep after changing the code.
- Call `preview.png` an illustration, never a screenshot, until the author replaces it with a real one.
- `docs/assets/preview.png` must be byte-identical to `preview.png` (`node scripts/check-docs.mjs` checks it).
- The site is plain HTML and CSS: no scripts, no external fonts, analytics or CDNs. Plain `<a href="https://...">`
  links are fine.
- The string `miguelalexanderdiaz/herdr-agents-waiting` is allowed (clone URLs). No other real name or username.

## Claim to source map

Run from the repository root. Each command should print what the claim says.

| Claim | Command | Expect |
|---|---|---|
| Named constants (folder, poll, lines, concurrency, storage key, home-space name) | `rg -n "^const (HOME\|POLL_MS\|READ_LINES\|READ_CONCURRENCY\|SEEN_KEY\|HOME_SPACE_NAME)" mods/attention-picker/main.js` | 6 lines: `mods/attention-picker`, 3000, 60, 4, `attention.seen`, `~` |
| The only program run is `hc read`, no network, no file access | `rg -n "hc\(\|exec\(\|fetch\(\|readTextFile\|writeTextFile" mods/` | one hit: `hc(["read", address, "--lines", ...` in `main.js` |
| Local storage holds only the first-seen map | `rg -n "localStorage\." mods/` | two hits in `main.js`, `getItem` and `setItem` of `SEEN_KEY`, both inside `try` |
| Shared keys and props used | `rg -n 'shared\("\|setShared\("\|props\(\)' mods/attention-picker/main.js` | `attention.sort` (read, write), `space.colors`, `agents.since` (read only), `props()` for `search` and `overlay` |
| Search is on unless `search: false` | `rg -n "search !== false" mods/attention-picker/logic.js` | `pickSearch` |
| Status time order: shared, tab, local record | `rg -n "export function statusSince" -B8 -A12 mods/attention-picker/logic.js` | shared `agents.since`, then `working_since` or `changed_at`, then the record |
| Local record shape and pruning | `rg -n "export function (parseSeen\|trackSeen)\|const MAX_SEEN" mods/attention-picker/logic.js` | `{ s, at }` per address, 500 entries read at most |
| 24 hour fold and its conditions | `rg -n "const DAY\|const old = " mods/attention-picker/logic.js` | not working, not focused, known start older than `DAY` |
| Sorts | `rg -n "SORTS =\|SORT_LABEL =" mods/attention-picker/` | recent, oldest, space; labels Recent, Oldest, Space order |
| Empty-state strings | `rg -n "No agents running\|Start one and it will show here\|No match\|Nothing needs you right now" mods/` | `emptyState()` in `logic.js`, the title fallback in `main.js` |
| Icons load from the mod's own folder | `rg -n "HOME\}/\|workspace-chrome" mods/` | two `${HOME}/...svg` lines; no `workspace-chrome` outside comments |
| Preview parsing limits | `rg -n "MAX_LEN =\|slice\(-40\)\|MARKERS =" mods/attention-picker/ask.js` | 200 characters, the last 40 non-empty lines of what `hc read` returned, markers `●` `⏺` `•` |
| Command run on pick | `rg -n 'run\("' mods/attention-picker/main.js` | `agent.focus` with `{ terminal }`; `overlay.close` only as a fallback when `props().overlay` is missing |
| Key shipped | `rg -n "ctrl-shift-a" keys.json` | two lines, `global` and `terminal`, both `mod.open:attention-picker` |
| Overlay | `cat mods/attention-picker/mod.json` | `"kind": "dialog"`, `"width": 640` |
| Tests | `npm test` | all pass (`package.json` runs `node --test`) |

## Known limits

- Not run in Herdr on Linux or Windows. The CI definition (`scripts/ci.workflow.yml`) is not enabled yet; unit tests
  of the pure modules are the only thing known to run there.
- Status times from the local first-seen record are estimates: the dialog cannot observe changes while closed.
- Previews are only tested on Claude Code style screens (see the fixtures in `tests/ask.test.mjs`).
- A shared `agents.since` left behind by a layout you stopped using can be stale and still win; only a partial guard
  exists (see the code-review notes in the latest `plans/round-*/`).

## Verification status

The original mod ran in the author's Herdr on macOS (0.1.12). Later changes passed `herdr-app check` and the unit
tests; none were watched in a live window. Do not write "works" or "run in Herdr" about them. Not yet observed
(the same table, with 30-second checks, is in [docs/install.html](docs/install.html#verification)):

- the key closes the dialog while the search box has focus (`Esc` always does);
- `Tab` / `Shift+Tab` reach the dialog while the search box has focus;
- `localStorage` survives a reload;
- `hc read --lines 60` returns the screen plus 60 lines of history; the unit and meaning of a tab's `changed_at`;
- polling stops when the dialog closes;
- the command palette entry for `mod.open`;
- anything on Linux or Windows.

When someone observes one, change the row to "observed on <OS>, Herdr <version>" in the README and the docs page.
