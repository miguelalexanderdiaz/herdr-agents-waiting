// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 the herdr-agents-waiting authors; licence: LICENSE in the repository
// What a waiting agent is saying, from its screen text (hc read): for one
// that needs you, the last question on screen ("Do you want to proceed?");
// else the start of its last message (a "●" line, as Claude Code and similar
// agents draw them), skipping the tool calls drawn the same way
// ("● Bash(npm test)") unless the screen holds nothing else.
// Pure: node can run it.

// Characters that start an agent's message line.
export const MARKERS = ["●", "⏺", "•"];
// Longest text returned; the row truncates anyway, this keeps the Map small.
export const MAX_LEN = 200;

const MARKER_LINE = new RegExp(`^[${MARKERS.join("")}]\\s+(.*)$`);
const BOX_CHARS = "│┃╭╮╰╯─━┌┐└┘├┤┬┴┼═║⧉";
const BOX = new RegExp(`[${BOX_CHARS}]+`, "g");
// Terminal escapes: CSI (colors, cursor) and OSC (titles, links).
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// "(y/n)", "[y/N]", "(yes/no)" at the end of a question.
const HINT = /\s*[[(](?:[yY](?:es)?(?:\/[nN]o?)?|[nN]o?)[\])]\s*$/;
// "Bash(npm test)", "Update(src/a.js)", "mcp__x__y(...)": a tool call, not prose.
const TOOL_CALL = /^(?:[A-Z][A-Za-z0-9]*|mcp__[\w-]+)\(.*$/;

const cap = (s) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s);
// A leading box border (and any blank space before it): the column a line really starts at is after it.
const BORDER = new RegExp(`^\\s*[${BOX_CHARS}]+`);
// The start of a blocked question: a message marker and/or a prompt arrow, then a list number.
const QUESTION_START = new RegExp(`^(?:[${MARKERS.join("")}]\\s+)?(?:[❯>›]\\s*)?(?:\\d+\\.\\s+)?`);
// A message starts in the first column (one more inside a box border). Deeper
// lines are list items or tool output inside a message, not its start.
const MAX_MESSAGE_INDENT = 1;

export function askOf(text, status) {
  const lines = String(text ?? "").replace(ANSI, "").split(/\r\n|\r|\n/)
    .map((raw) => {
      const body = raw.replace(BORDER, "");
      const t = body.replace(BOX, " ").replace(/\s+/g, " ").trim();
      return { t, indent: body.match(/^ */)[0].length };
    })
    .filter((l) => l.t)
    .slice(-40);
  if (status === "blocked") {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].t.replace(QUESTION_START, "");
      if (l.length >= 4 && /\?$/.test(l.replace(HINT, "")) && !/^\?/.test(l)) return cap(l);
    }
  }
  let call = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].indent <= MAX_MESSAGE_INDENT ? lines[i].t.match(MARKER_LINE) : null;
    if (!m || m[1].length <= 2) continue;
    if (!TOOL_CALL.test(m[1])) return cap(m[1]);
    if (!call) call = m[1];
  }
  return cap(call);
}
