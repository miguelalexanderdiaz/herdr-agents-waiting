import { test } from "node:test";
import assert from "node:assert/strict";
import { askOf, MAX_LEN } from "../mods/attention-picker/ask.js";

test("empty and missing input give an empty string", () => {
  assert.equal(askOf(undefined, "blocked"), "");
  assert.equal(askOf(null, "done"), "");
  assert.equal(askOf("", "blocked"), "");
  assert.equal(askOf("\n\n  \n", "done"), "");
});

test("blocked: the question inside a box", () => {
  const screen = [
    "╭──────────────────────────────────────╮",
    "│ Bash command                         │",
    "│   npm test                           │",
    "│ Do you want to proceed?              │",
    "│ ❯ 1. Yes                             │",
    "│   2. No                              │",
    "╰──────────────────────────────────────╯",
  ].join("\n");
  assert.equal(askOf(screen, "blocked"), "Do you want to proceed?");
});

test("blocked: the last question wins over earlier ones and over options", () => {
  const screen = "Are you sure?\nDo you want to overwrite foo.txt?\n❯ 1. Yes\n  2. No, keep it";
  assert.equal(askOf(screen, "blocked"), "Do you want to overwrite foo.txt?");
});

test("blocked: a numbered question loses its number", () => {
  assert.equal(askOf("❯ 1. Which database should I use?", "blocked"), "Which database should I use?");
});

test("blocked: (y/n) and [y/N] hints are accepted", () => {
  assert.equal(askOf("Continue? (y/n)", "blocked"), "Continue? (y/n)");
  assert.equal(askOf("Apply these changes? [y/N]", "blocked"), "Apply these changes? [y/N]");
  assert.equal(askOf("Overwrite? (yes/no) ", "blocked"), "Overwrite? (yes/no)");
});

test("blocked: ANSI escapes are removed", () => {
  assert.equal(askOf("\x1b[1mProceed with install?\x1b[0m", "blocked"), "Proceed with install?");
  assert.equal(askOf("\x1b]0;title\x07Run it? \x1b[32m[y/N]\x1b[0m", "blocked"), "Run it? [y/N]");
});

test("blocked: CRLF screens work", () => {
  assert.equal(askOf("Output\r\nShall I continue?\r\n", "blocked"), "Shall I continue?");
});

test("blocked: help hints starting with ? and short lines are not questions", () => {
  assert.equal(askOf("? for shortcuts", "blocked"), "");
  assert.equal(askOf("Ok?", "blocked"), "");
});

test("blocked without a question falls back to the last message", () => {
  assert.equal(askOf("● Waiting on you to pick a file\n> ", "blocked"), "Waiting on you to pick a file");
});

test("done: the last message", () => {
  assert.equal(askOf("● First thing\n\n● All tests pass now.\n", "done"), "All tests pass now.");
  assert.equal(askOf("⏺ Done with the refactor", "done"), "Done with the refactor");
  assert.equal(askOf("• Finished", "done"), "Finished");
});

test("done: tool-call lines are skipped in favour of prose", () => {
  assert.equal(askOf("● Fixed it.\n● Bash(npm test)\n", "done"), "Fixed it.");
  assert.equal(askOf("● Fixed it.\n● Update(src/a.js)\n● Read(README.md)\n", "done"), "Fixed it.");
  assert.equal(askOf("● Fixed it.\n● mcp__github__create_issue(title: x)\n", "done"), "Fixed it.");
});

test("done: with only tool calls, the last call is shown", () => {
  assert.equal(askOf("● Read(a.js)\n● Bash(npm test)\n", "done"), "Bash(npm test)");
});

test("done: a question mark does not matter", () => {
  assert.equal(askOf("● Want me to continue?", "done"), "Want me to continue?");
});

test("conventional-commit style prose is not a tool call", () => {
  assert.equal(askOf("● fix(parser): handle empty input", "done"), "fix(parser): handle empty input");
});

test("a bare marker or a tiny message is ignored", () => {
  assert.equal(askOf("●\n● ok", "done"), "");
});

test("results are capped", () => {
  const out = askOf(`● ${"x".repeat(500)}`, "done");
  assert.equal(out.length, MAX_LEN);
  assert.ok(out.endsWith("…"));
});

test("only the last 40 lines are considered", () => {
  const screen = `● old message\n${"filler\n".repeat(50)}`;
  assert.equal(askOf(screen, "done"), "");
});
