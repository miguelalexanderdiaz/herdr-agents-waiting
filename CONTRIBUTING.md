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

## Run the checks

```bash
npm test                          # same as: node --test   (Node 22 or newer, no dependencies)
node scripts/validate.mjs         # structure, JSON, compatibility contract, capability report
node scripts/privacy-scan.mjs     # personal data in the tree and in the history
node scripts/check-docs.mjs       # docs links, Pages assets, no external origins
node scripts/check-local.mjs      # all of the above in one go, then herdr-app check if it is installed
herdr-app check /absolute/path/to/your/clone/mods/attention-picker
```

Run `npm test`, never `node --test tests/` (a folder argument fails on Node 22 and later). CI is defined in
`scripts/ci.workflow.yml` (Linux, Windows and macOS, each on Node 22 and 24); it is enabled when the owner installs
it and has not run yet, so until a run is green treat Linux and Windows as unchecked. `herdr-app check` needs the desktop app,
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
3. **Docs in the same change.** Behavior changes update README, `docs/`, `RECIPE.md` and `CHANGELOG.md`. Numbers and
   keys must come from the code (the claim map at the end of AGENTS.md lists where).
4. **No personal data.** No real names, usernames, home paths (write `~`), emails, hostnames, or content from your own
   terminals or windows in any file, screenshot, fixture or commit message. `node scripts/privacy-scan.mjs` catches the
   common cases but not all of them.
5. **The privacy statement stays true.** The mod reads screen text with `hc read`, keeps nothing of it, uses no network
   and no `exec`. Herdr itself would allow all of that and more, so this is the mod's own policy, held by
   `scripts/validate.mjs`. A change that alters it must update the Privacy sections of README, AGENTS.md and RECIPE.md.
6. **Keep it small.** No dependencies, no build step. The mod is plain JavaScript.

## Commits and pull requests

- The [pull request template](.github/PULL_REQUEST_TEMPLATE.md) lists what a reviewer will check.
- In the CI definition, pull requests skip the check of commit author e-mail addresses (they are yours and public in
  git); the content of every added line and every commit message is still scanned. Do not put an address in either.
- A clear subject line and a body that says why.
- One logical change per commit.
- Do not rewrite shared history or force-push `main`.

## Reporting a problem

Open an issue with the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml): your Herdr version
(`herdr-app --version`), your OS, what you pressed and what you saw. Do not paste terminal contents you would not want
public. For a security problem, such as the mod reaching something it says it does not, follow
[.github/SECURITY.md](.github/SECURITY.md) and report it privately.

## License

By contributing you agree your work is licensed under Apache-2.0 (see [LICENSE](LICENSE)).
