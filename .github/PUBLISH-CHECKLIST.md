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
  `scripts/preview/preview.svg` with invented data. Open the dialog in a Herdr home that holds **invented**
  space and agent names (a throw-away home: `HERDR_APP_HOME=<empty folder> herdr-app`), with no real terminal text
  behind it. Take a 1100x705 screenshot, save it as `preview.png`, copy it to `docs/assets/preview.png`
  (`node scripts/check-docs.mjs` fails until both match), then run `node scripts/privacy-scan.mjs` (it reads the
  PNG's text chunks) and **open the picture and read every word in it**: window titles, tabs, paths and notifications
  count. Screenshot tools can also write a title or a source path into the file; the scan refuses any text chunk
  other than `Software`.
- [ ] **Give the privacy scan your own words.** Locally:
  `PRIVACY_EXTRA="yourusername,youremployer,yourhostname" node scripts/privacy-scan.mjs`.
  For CI: repository Settings, Secrets and variables, Actions, new secret `PRIVACY_EXTRA` (comma-separated).
  Never commit that list. Without the secret a push to `main` prints a notice and the scan runs its built-in rules only.
- [ ] **Run the whole local gate:** `node scripts/check-local.mjs` (validate, privacy scan, docs check, tests,
  `verify-install` on the mod, and `herdr-app check` when Herdr is installed).
- [ ] **Read the first CI result** (after step 0): `gh run list --branch main`. All six jobs (Linux, Windows and macOS,
  each on Node 22 and 24) must be green. If Actions are unavailable on the private repository, run
  `node scripts/check-local.mjs` on a Windows and a Linux machine instead. Nothing has ever run on Windows or Linux:
  if a job is red, read `gh run view --log-failed` and fix the script, not the check.
- [x] **Decide what becomes public with the history.** Done 2026-11-04: `plans/` (the round plans, audits and logs)
  is no longer tracked (`/plans/` is in `.gitignore`); earlier commits still hold it. Before that: `plans/` and the
  commit messages (more than twenty carry a `Claude-Session:` link trailer) are part of the repository. The privacy scan passes on them (no
  personal data), but they show how the repository was made. Keep them, or publish from a fresh squashed
  repository without `plans/`.
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
- [ ] Turn on private vulnerability reporting (Settings, Code security) so `.github/SECURITY.md` works as written.
- [ ] Documentation site: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/docs`. Pages on a
  **private** repository needs a paid GitHub plan; on a public one it is free. Then open the site and click every one of
  its pages (the docs have six, plus `404.html`): `node scripts/check-docs.mjs` proves the links resolve in the files,
  not that the site is served (`docs/.nojekyll` is already there). Once the address works, tell the documentation
  owner to put it in the README (the privacy scan allows exactly `<owner>.github.io/herdr-agents-waiting`).
- [ ] Wait up to one hour, then open `https://herdr.dev/mods/miguelalexanderdiaz/herdr-agents-waiting` and check the
  preview, the title and the text.

## 3. After it is listed

- [ ] **Install test into an empty Herdr home, on a second operating system if you can** (Linux and Windows have never run
  the app with this mod; CI only covers the scripts and the pure code). Follow the install steps in `README.md`:
  copy `mods/attention-picker/` to the app's `mods/` folder, merge `keys.json`, then
  `herdr-app check <that folder>` (proves the code loads) and
  `node scripts/verify-install.mjs <that folder> --home <the Herdr home>` (proves the folder name, icons, `mod.json`
  and the key; Herdr's home can be moved with `HERDR_APP_HOME`). Press Ctrl+Shift+A. Expected: the dialog opens with
  the search box on. Write down which system you tried, and the Herdr version.
- [ ] Tell the Herdr community where it is, if you want to (no step above needs it).

## What is already checked for you

| Check | Command | Where it runs |
| --- | --- | --- |
| Structure, `mod.json`, `keys.json`, licence and SPDX headers, RECIPE headings and the numbers it quotes, compatibility contract, import and call allow-lists, the CI definition | `node scripts/validate.mjs` | CI (once installed); local |
| No home paths, e-mails, hostnames, tokens, extra private words, in files, PNG text and git history | `node scripts/privacy-scan.mjs` | CI (once installed); local |
| Documentation links, no external origin on the Pages site, `preview.png` copy | `node scripts/check-docs.mjs` | CI (once installed); local |
| The checks themselves, and the unit tests of the pure code and of the mod | `npm test` (plain `node --test`) | CI (once installed); local |
| An installed copy: folder name, icons, `mod.json`, the key | `node scripts/verify-install.mjs <folder> [--home <dir>]` | local |
| The mod loads in Herdr | `herdr-app check <abs path>/mods/attention-picker` | local only (the desktop app's binary) |
