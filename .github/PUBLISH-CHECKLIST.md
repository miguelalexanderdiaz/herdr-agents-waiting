# Publish checklist

What only the repository owner can do. Nothing here is done by the round agents: they may not change
visibility, settings, topics or Pages, and they do not drive the running app. Installers copy only
`mods/attention-picker/` (and merge `keys.json`), so this file never reaches a user's Herdr folder.

Work through it top to bottom. Each item is a command or a URL.

## 0. Install the CI workflow (the definition ships in `scripts/ci.workflow.yml`)

- [ ] The tool that prepared this repository had a GitHub token without the `workflow` scope, and GitHub refuses any
  push that touches `.github/workflows/`. So the CI definition is a normal file, `scripts/ci.workflow.yml`, and it does
  nothing until you install it. Either:
  - with your own login: `gh auth refresh -s workflow`, then copy the file byte for byte
    (`mkdir -p .github/workflows && cp scripts/ci.workflow.yml .github/workflows/ci.yml`; on Windows PowerShell
    `New-Item -Force -ItemType Directory .github/workflows; Copy-Item scripts/ci.workflow.yml .github/workflows/ci.yml`),
    commit and push; or
  - in the GitHub web UI: Add file, Create new file, name it `.github/workflows/ci.yml`, paste the content of
    `scripts/ci.workflow.yml`, commit (no token scope needed).
- [ ] Check that the copy is identical: `node scripts/validate.mjs` fails when the two files differ.
- [ ] Start a run and read it: `gh workflow run ci` (the workflow has a manual trigger), then `gh run list`.
  Expected: six green jobs (Linux, Windows and macOS, each on Node 22 and 24). Until a run is green, every claim
  that CI covers three operating systems is "defined, not yet run".
- [ ] On the first Windows job, read the "Platform" step output: it prints the OS, the Node version and
  `core.autocrlf`, which is where a line-ending problem would show first.
- [ ] Optional but recommended: set the repository secret `PRIVACY_EXTRA` (step 1). Without it a push to `main`
  prints a notice and the privacy scan runs its built-in rules only.

## 1. Before the repository goes public

- [ ] **Replace `preview.png` with a real screenshot.** The file in the repo is an illustration drawn from
  `scripts/preview/preview.svg` with invented data. Open the dialog in your own Herdr on sample data
  (made-up space and agent names, no real terminal text behind it), take a 1100x705 screenshot, save it as
  `preview.png`, then copy it to `docs/assets/preview.png` (`node scripts/check-docs.mjs` fails until both match).
  Do not paste your real window: it holds real names.
- [ ] **Give the privacy scan your own words.** Locally:
  `PRIVACY_EXTRA="yourusername,youremployer,yourhostname" node scripts/privacy-scan.mjs`.
  For CI: repository Settings, Secrets and variables, Actions, new secret `PRIVACY_EXTRA` (comma-separated).
  Never commit that list.
- [ ] **Run the whole local gate:** `node scripts/check-local.mjs` (validate, privacy scan, docs check, tests,
  and `herdr-app check` on the mod when Herdr is installed).
- [ ] **Read the first three-OS CI result:** `gh run list --branch main` (Linux, Windows and macOS must be green).
  If Actions are unavailable on the private repository, run the checks on a second machine instead.
- [ ] **Author metadata.** The first commit (`Import from a working Herdr setup`) carries the author's real name
  in its metadata, and the LICENSE has the copyright line with it. That is intended. History is not rewritten.
  If you want the name out of history, squash into a fresh repository before publishing. No e-mail is exposed:
  commits use a GitHub no-reply address (`node scripts/privacy-scan.mjs` checks that).
- [ ] **Licence:** after the first push to the public repo, `gh repo view --json licenseInfo` must say Apache-2.0.

## 2. Publish

- [ ] Make the repository public: Settings, General, Danger Zone, Change visibility (or
  `gh repo edit miguelalexanderdiaz/herdr-agents-waiting --visibility public --accept-visibility-change-consequences`).
- [ ] **Add the topic `herdr-mod`** (not `herdr-layout`: there is no layout in this repo):
  `gh repo edit miguelalexanderdiaz/herdr-agents-waiting --add-topic herdr-mod`.
- [ ] Set the description: `Herdr mod: a searchable dialog of the agents that need you`
  (`gh repo edit miguelalexanderdiaz/herdr-agents-waiting --description "..."`).
- [ ] Documentation site: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/docs`.
  Then open the site and click through it (`docs/.nojekyll` is already there).
- [ ] Wait up to one hour, then open `https://herdr.dev/mods/miguelalexanderdiaz/herdr-agents-waiting` and check the
  preview, the title and the text.

## 3. After it is listed

- [ ] **Install test into an empty Herdr home** (a second machine or another OS if you can: Linux and Windows are only
  proven by CI for the pure code, not by running the app). Follow the install steps in `README.md`:
  copy `mods/attention-picker/` to the app's `mods/` folder, merge `keys.json`, run
  `herdr-app check <that folder>`, press Ctrl+Shift+A. Expected: the dialog opens with the search box on.
- [ ] **Portrait layout resync.** The portrait layout repository bundles a copy of this mod. Copy
  `mods/attention-picker/*.js`, `*.svg` and `mod.json` (never `gpui-kit.d.ts` or `jsconfig.json`, which Herdr writes),
  then run `herdr-app check` there. The compatibility contract is in `scripts/validate.mjs` (`CONTRACT`).
- [ ] Tell the Herdr community where it is, if you want to (no step above needs it).

## What is already checked for you

| Check | Command | Where it runs |
| --- | --- | --- |
| Structure, `mod.json`, `keys.json`, licence, RECIPE headings, compatibility contract, capability report | `node scripts/validate.mjs` | CI on Linux, Windows, macOS; local |
| No home paths, e-mails, hostnames, tokens, extra private words, in files and in git history | `node scripts/privacy-scan.mjs` | CI; local |
| Documentation links, no external origin on the Pages site, `preview.png` copy | `node scripts/check-docs.mjs` | CI; local |
| Unit tests of the pure code | `node --test` (or `npm test`) | CI; local |
| The mod loads in Herdr | `herdr-app check <abs path>/mods/attention-picker` | local only (the desktop app's binary) |
