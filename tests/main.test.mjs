// Runs the real mods/attention-picker/main.js under node, with the three
// Herdr-only modules replaced by the stubs in tests/helpers/stubs.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadMain } from "./helpers/loader.mjs";
import { STUBS } from "./helpers/stub-urls.mjs";
import * as herdr from "./helpers/stubs/herdr.mjs";
import { nodeOf, callsOf, textOf, find, findAll } from "./helpers/stubs/gpui-kit.mjs";
import { agent, tab, space, memoryStorage } from "./helpers/fixtures.mjs";

const AttentionPicker = await loadMain();
const MAIN_URL = new URL("../mods/attention-picker/main.js", import.meta.url);

const MIN = 60_000;
const HOUR = 60 * MIN;
const KEY = (key, modifiers = {}) => ({ key, modifiers: { shift: false, alt: false, control: false, platform: false, ...modifiers } });

function setStorage(s) {
  Object.defineProperty(globalThis, "localStorage", { value: s, configurable: true, writable: true });
}

// A context like the one a View's init gets: timers and tasks are recorded, never run.
function makeCx() {
  const cx = {
    everys: [], afters: [], spawns: [], notifies: 0, stops: 0,
    timer: { every: (ms, fn) => cx.everys.push([ms, fn]), after: (ms, fn) => cx.afters.push([ms, fn]) },
    spawn: (fn) => cx.spawns.push(fn),
    focus_handle: () => ({ focus() {} }),
    notify: () => { cx.notifies += 1; },
    stop_propagation: () => { cx.stops += 1; },
  };
  return cx;
}

function open(setup = {}) {
  herdr.reset();
  Object.assign(herdr.state, setup);
  setStorage(setup.storage ?? memoryStorage());
  const cx = makeCx();
  const view = new AttentionPicker();
  view.init(herdr.state.props, cx);
  const render = () => nodeOf(view.render());
  const key = (k, modifiers) => {
    const root = render();
    const [handler] = callsOf(root, "on_key_down")[0];
    handler(KEY(k, modifiers), cx);
  };
  return { view, cx, render, key };
}

const titleOf = (root) => textOf(find(root, (n) => callsOf(n, "font_semibold").length && callsOf(n, "text_size").some(([s]) => s === 15))).join("");
const rowIds = (root) => findAll(root, (n) => callsOf(n, "id").some(([id]) => String(id).startsWith("ap-") && id !== "ap-list" && id !== "ap-sort"))
  .map((n) => callsOf(n, "id")[0][0].slice(3));
const rowText = (root, address) => textOf(find(root, (n) => callsOf(n, "id").some(([id]) => id === `ap-${address}`))).join(" | ");

const mixed = () => ({
  agents: [
    agent(1, { status: "blocked", space: "s1", space_name: "api" }),
    agent(2, { status: "working", space: "s1", space_name: "api" }),
    agent(3, { status: "done", space: "s2", space_name: "web", tab: "tab3" }),
    agent(4, { status: "idle", space: "s2", space_name: "web", tab: "tab4" }),
  ],
  spaces: [
    space("s1", "api", [tab("tab1"), tab("tab2")]),
    space("s2", "web", [tab("tab3"), tab("tab4")]),
  ],
});

beforeEach(() => herdr.reset());

// ---- imports ----------------------------------------------------------------

function importedNames(source) {
  const out = {};
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    out[m[2]] = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  }
  return out;
}

test("every name main.js imports from a Herdr module exists in the stub", async () => {
  const imports = importedNames(readFileSync(MAIN_URL, "utf8"));
  for (const spec of ["gpui-kit", "gpui-base", "herdr"]) {
    assert.ok(imports[spec]?.length, `main.js imports from ${spec}`);
    const mod = await import(STUBS[spec]);
    for (const name of imports[spec]) assert.ok(name in mod, `${spec} stub exports ${name}`);
  }
});

test("herdr names main.js imports exist in the app's herdr.d.ts when it is readable", (t) => {
  const home = process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app");
  const file = join(home, "herdr.d.ts");
  if (!existsSync(file)) return t.skip("herdr.d.ts not found (set HERDR_APP_HOME to check against it)");
  const dts = readFileSync(file, "utf8");
  for (const name of importedNames(readFileSync(MAIN_URL, "utf8")).herdr) {
    assert.match(dts, new RegExp(`export (?:declare )?(?:function|const|class|let) ${name}\\b`), `herdr.d.ts exports ${name}`);
  }
});

// ---- render -----------------------------------------------------------------

test("renders mixed statuses over two spaces, with and without the search box", () => {
  for (const props of [{}, { search: false }]) {
    const { render } = open({ ...mixed(), props });
    const root = render();
    assert.deepEqual(rowIds(root).slice(0, 2), ["t1", "t3"], "blocked then done on top");
    assert.equal(findAll(root, (n) => n.kind === "input").length, props.search === false ? 0 : 1);
  }
});

test("renders with no agents, and with a filter that matches nothing", () => {
  const empty = open({ agents: [], spaces: [] });
  assert.match(titleOf(empty.render()), /No agents running/);
  const some = open(mixed());
  some.view.input.type("zzz", some.cx);
  const root = some.render();
  assert.deepEqual(rowIds(root), []);
  assert.ok(textOf(root).includes("No match"));
});

test("the title is a state of the agents: typing in the search box does not change it", () => {
  const { view, cx, render } = open(mixed());
  const before = titleOf(render());
  assert.equal(before, "1 agent needs you");
  view.input.type("web", cx);
  assert.equal(titleOf(render()), before);
  view.input.type("zzz", cx);
  assert.equal(titleOf(render()), before, "no match still says what the agents need");
  assert.deepEqual(rowIds(render()), []);
});

test("odd shared space.colors values never blank the dialog", () => {
  for (const colors of [{ s1: 5 }, { s1: "teal" }, { s1: null }, { s1: ["#fff"] }, "junk", 7, null]) {
    const { render } = open({ ...mixed(), shared: { "space.colors": colors } });
    assert.ok(rowIds(render()).length > 0, JSON.stringify(colors));
  }
});

test("a space's tile uses its shared color and a readable ink", () => {
  const { render } = open({ ...mixed(), shared: { "space.colors": { s1: "#fa0", s2: "ansi5" } } });
  const tiles = findAll(render(), (n) => callsOf(n, "rounded").some(([r]) => r === 5)).map((n) => callsOf(n, "bg")[0][0]);
  assert.deepEqual(tiles, ["#ffaa00", "#8b7cf6"]);
});

test("renders 40 agents with a fixed, scrolling list", () => {
  const agents = Array.from({ length: 40 }, (_, i) => agent(i + 1, { status: i % 3 === 0 ? "blocked" : "idle" }));
  const { render } = open({ agents, spaces: [space("s1", "api", agents.map((a) => tab(a.tab)))] });
  const root = render();
  const list = find(root, (n) => callsOf(n, "id").some(([id]) => id === "ap-list"));
  assert.ok(callsOf(list, "overflow_hidden").length, "list clips when it does not fit");
  assert.ok(rowIds(root).length < 40, "only the rows in view are built");
});

// ---- keys (RECIPE "Keys and mouse") ------------------------------------------

test("down and up move the selection and wrap", () => {
  const { view, key } = open(mixed());
  key("down"); assert.equal(view.selected, "t3");
  key("down"); assert.equal(view.selected, "t2", "third pick is the working agent");
  key("up"); assert.equal(view.selected, "t3");
  key("up"); key("up");
  assert.equal(view.selected, "t4", "wraps to the last pick");
});

test("Tab and Shift+Tab cycle attention.sort forward and back", () => {
  const { key } = open(mixed());
  key("tab"); key("tab"); key("tab");
  key("tab", { shift: true });
  const sets = herdr.log.sets.filter(([k]) => k === "attention.sort").map(([, v]) => v);
  assert.deepEqual(sets, ["oldest", "space", "recent", "space"]);
});

test("pressing Tab twice before a render still takes two steps", () => {
  const { view, cx } = open(mixed());
  const root = nodeOf(view.render());
  const [handler] = callsOf(root, "on_key_down")[0];
  handler(KEY("tab"), cx);
  handler(KEY("tab"), cx);
  assert.deepEqual(herdr.log.sets.map(([, v]) => v), ["oldest", "space"]);
});

test("the Sort pill steps from the current sort, not the one drawn", () => {
  const { render, cx } = open(mixed());
  const pill = find(render(), (n) => callsOf(n, "id").some(([id]) => id === "ap-sort"));
  const [click] = callsOf(pill, "on_click")[0];
  click({}, cx);
  click({}, cx);
  assert.deepEqual(herdr.log.sets.map(([, v]) => v), ["oldest", "space"]);
});

test("a 30 s timer redraws a quiet dialog, and stops after the dialog is dismissed", () => {
  const { cx, key } = open(mixed());
  const ticks = cx.everys.filter(([ms]) => ms === 30_000);
  assert.equal(ticks.length, 1);
  const before = cx.notifies;
  ticks[0][1](cx);
  assert.equal(cx.notifies, before + 1);
  key("escape");
  ticks[0][1](cx);
  assert.equal(cx.notifies, before + 1, "no redraw once dismissed");
});

test("Escape closes the dialog without picking", () => {
  const { key } = open(mixed());
  key("escape");
  assert.deepEqual(herdr.log.runs, [["overlay.close", undefined]]);
});

test("Enter in the search box picks the selected row (the input submits)", () => {
  const { view, cx } = open(mixed());
  view.input.submit(cx);
  assert.deepEqual(herdr.log.runs.at(-1), ["agent.focus", { terminal: "t1" }]);
});

test("keys-only mode: Enter picks, 1-9 jump, Ctrl+1 is ignored; with search on, digits are not shortcuts", () => {
  const keys = open({ ...mixed(), props: { search: false } });
  keys.key("1", { control: true });
  keys.key("1", { platform: true });
  assert.deepEqual(herdr.log.runs, []);
  keys.key("2");
  assert.deepEqual(herdr.log.runs.at(-1), ["agent.focus", { terminal: "t3" }]);
  herdr.log.runs.length = 0;
  keys.key("down"); keys.key("enter");
  assert.deepEqual(herdr.log.runs.at(-1), ["agent.focus", { terminal: "t3" }]);

  const search = open(mixed());
  search.key("2");
  assert.deepEqual(herdr.log.runs, [], "typing a digit belongs to the search box");
});

test("typing in the search box changes the rows and resets the selection", () => {
  const { view, cx, render, key } = open(mixed());
  key("down");
  view.input.type("web", cx);
  assert.equal(view.selected, null);
  assert.deepEqual(rowIds(render()).sort(), ["t3", "t4"]);
});

// ---- dismiss ----------------------------------------------------------------

test("picking closes through closeOverlay(props().overlay) when Herdr supplied the id", () => {
  const { view, cx } = open({ ...mixed(), props: { overlay: "o1" } });
  view.input.submit(cx);
  assert.deepEqual(herdr.log.closed, ["o1"]);
  assert.ok(!herdr.log.runs.some(([n]) => n === "overlay.close"));
  assert.deepEqual(herdr.log.runs.at(-1), ["agent.focus", { terminal: "t1" }]);
});

test("without an overlay id it falls back to the overlay.close command, before agent.focus", () => {
  const { view, cx } = open(mixed());
  view.input.submit(cx);
  assert.deepEqual(herdr.log.closed, []);
  assert.deepEqual(herdr.log.runs.map(([n]) => n), ["overlay.close", "agent.focus"]);
});

// ---- the shared-key and storage contract --------------------------------------

test("a shared agents.since time wins over the tab's when the tab does not show a newer change", () => {
  const data = mixed();
  data.spaces[0].tabs[0] = tab("tab1", { changed_at: Date.now() - 3 * HOUR - MIN });
  const { render } = open({ ...data, shared: { "agents.since": { t1: Date.now() - 3 * HOUR } } });
  assert.match(rowText(render(), "t1"), /\b3h\b/);
});

test("a stale agents.since is ignored for a lone blocked agent whose tab changed since", () => {
  const data = mixed();
  data.spaces[0].tabs[0] = tab("tab1", { changed_at: Date.now() - 5 * MIN });
  const { render } = open({ ...data, shared: { "agents.since": { t1: Date.now() - 3 * 24 * HOUR } } });
  assert.match(rowText(render(), "t1"), /\b5m\b/);
});

test("the only shared key written is attention.sort, and agents.since is never written", () => {
  const { key } = open({ ...mixed(), shared: { "agents.since": { t1: Date.now() - HOUR } } });
  key("tab"); key("tab", { shift: true }); key("down"); key("escape");
  assert.ok(herdr.log.sets.length >= 2);
  assert.ok(herdr.log.sets.every(([k]) => k === "attention.sort"));
});

test("the first-seen record is saved under attention.seen, without screen text", () => {
  const storage = memoryStorage();
  open({ ...mixed(), storage });
  assert.deepEqual([...storage.data.keys()], ["attention.seen"]);
  const record = JSON.parse(storage.data.get("attention.seen"));
  assert.deepEqual(Object.keys(record).sort(), ["t1", "t2", "t3", "t4"]);
  for (const e of Object.values(record)) assert.deepEqual(Object.keys(e).sort(), ["at", "q", "s", "sp"]);
});

test("storage that throws on get and set does not stop init or render", () => {
  const { render, key } = open({ ...mixed(), storage: memoryStorage({ broken: true }) });
  assert.ok(rowIds(render()).length > 0);
  key("down");
});

test("screens are read with hc read --lines 60 for blocked and done agents only", async () => {
  const { cx } = open(mixed());
  assert.equal(cx.spawns.length, 1, "one pass starts at init");
  herdr.state.hc = async () => ({ code: 0, stdout: "● Why?\n" });
  await cx.spawns[0](cx);
  const addresses = herdr.log.hcs.map((a) => a[1]).sort();
  assert.deepEqual(addresses, ["t1", "t3"]);
  for (const args of herdr.log.hcs) assert.deepEqual([args[0], args[2], args[3]], ["read", "--lines", "60"]);
  assert.equal(cx.everys[0][0], 3000, "re-read every 3 s");
});

test("a settled screen is not read again on the next polls, but a changed seq is", async () => {
  const { cx, view } = open(mixed());
  herdr.state.hc = async () => ({ code: 0, stdout: "● Why?\n" });
  const poll = async () => { const [, tick] = cx.everys.find(([ms]) => ms === 3000); tick(cx); await cx.spawns.at(-1)(cx); };
  await cx.spawns[0](cx);
  for (let i = 0; i < 4; i++) await poll();
  assert.equal(herdr.log.hcs.length, 4, "two blocked/done agents, two reads each, then skipped");
  herdr.state.agents = herdr.state.agents.map((a) => (a.address === "t1" ? { ...a, seq: 99 } : a));
  await poll();
  assert.equal(herdr.log.hcs.length, 5, "only the agent whose seq moved");
  assert.equal(view.previews.get("t1").text, "Why?");
});
