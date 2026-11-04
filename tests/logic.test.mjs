import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY, pickSearch, duration, clean, nameOf, normalizeSort, nextSort, statusGroup, statusSince,
  parseSeen, trackSeen, matchesQuery, buildRows, emptyState, resolveSelection, moveSelection,
  createPreviewReader, isPick, contrast, inkOn,
} from "../mods/attention-picker/logic.js";

const NOW = 1_800_000_000_000;
const MIN = 60_000;

let seq = 0;
const agent = (over = {}) => ({
  address: `t${++seq}`, pane: "p", space: "s1", space_name: "api", tab: "tab1", tab_index: 1, tab_name: "1",
  status: "idle", app: null, program: { key: "claude", name: "Claude Code" }, title: "", seq: seq,
  pinned: false, focused: false, ...over,
});
const tab = (over = {}) => ({ id: "tab1", changed_at: null, working_since: null, ...over });
const space = (id, name, tabs = []) => ({ id, name, tabs });

// ---- props ----
test("pickSearch: on unless search is false", () => {
  assert.equal(pickSearch(undefined), true);
  assert.equal(pickSearch(null), true);
  assert.equal(pickSearch({}), true);
  assert.equal(pickSearch({ search: true }), true);
  assert.equal(pickSearch({ search: false }), false);
  assert.equal(pickSearch({ overlay: "o1" }), true);
});

// ---- duration ----
test("duration boundaries", () => {
  assert.equal(duration(0), "<1m");
  assert.equal(duration(59_000), "<1m");
  assert.equal(duration(60_000), "1m");
  assert.equal(duration(59 * MIN), "59m");
  assert.equal(duration(60 * MIN), "1h");
  assert.equal(duration(23 * 60 * MIN + 59 * MIN), "23h");
  assert.equal(duration(DAY), "1d");
  assert.equal(duration(3 * DAY + 5 * 3600_000), "3d");
  assert.equal(duration(-5000), "<1m");
  assert.equal(duration(NaN), "<1m");
});

// ---- names ----
test("clean strips leading symbols", () => {
  assert.equal(clean("✳ Fix login bug"), "Fix login bug");
  assert.equal(clean(undefined), "");
  assert.equal(clean("  plain  "), "plain");
});

test("nameOf: title, tab name, program", () => {
  assert.equal(nameOf(agent({ title: "✳ Fix login bug" })), "Fix login bug");
  assert.equal(nameOf(agent({ title: "", tab_name: "backend" })), "backend");
  assert.equal(nameOf(agent({ title: "", tab_name: "2" })), "Claude Code");
  assert.equal(nameOf(agent({ title: "", tab_name: "2", program: { name: "" }, app: "pi" })), "pi");
  assert.equal(nameOf(agent({ title: "", tab_name: "2", program: undefined, app: null })), "agent");
});

test("nameOf: path and host titles are not names", () => {
  assert.equal(nameOf(agent({ title: "~/code/app", tab_name: "web" })), "web");
  assert.equal(nameOf(agent({ title: "/srv/app", tab_name: "web" })), "web");
  assert.equal(nameOf(agent({ title: "user@host: ~/x", tab_name: "web" })), "web");
  assert.equal(nameOf(agent({ title: "C:\\Users\\dev\\app", tab_name: "web" })), "web");
  assert.equal(nameOf(agent({ title: "\\\\server\\share", tab_name: "web" })), "web");
});

test("nameOf: a title equal to the program name is not a name", () => {
  assert.equal(nameOf(agent({ title: "Claude Code", tab_name: "docs" })), "docs");
});

// ---- sort ----
test("normalizeSort and nextSort cycle both ways", () => {
  assert.equal(normalizeSort("bogus"), "recent");
  assert.equal(normalizeSort(undefined), "recent");
  assert.equal(normalizeSort("space"), "space");
  assert.equal(nextSort("recent"), "oldest");
  assert.equal(nextSort("oldest"), "space");
  assert.equal(nextSort("space"), "recent");
  assert.equal(nextSort("recent", -1), "space");
  assert.equal(nextSort("space", -1), "oldest");
  assert.equal(nextSort("oldest", -1), "recent");
  assert.equal(nextSort("bogus"), "oldest");
});

// ---- status times ----
test("statusGroup: done and idle are one", () => {
  assert.equal(statusGroup("done"), statusGroup("idle"));
  assert.notEqual(statusGroup("working"), statusGroup("blocked"));
});

test("statusSince: shared agents.since wins", () => {
  const since = statusSince({ shared: NOW - 5 * MIN, tab: tab({ changed_at: NOW - MIN }), seen: { s: "rest", at: NOW - 2 * MIN }, status: "idle", now: NOW });
  assert.equal(since, NOW - 5 * MIN);
});

test("statusSince: tab changed_at next, working_since for working", () => {
  const t = tab({ changed_at: NOW - 3 * MIN, working_since: NOW - 10 * MIN });
  assert.equal(statusSince({ tab: t, status: "idle", now: NOW }), NOW - 3 * MIN);
  assert.equal(statusSince({ tab: t, status: "blocked", now: NOW }), NOW - 3 * MIN);
  assert.equal(statusSince({ tab: t, status: "working", now: NOW }), NOW - 10 * MIN);
  assert.equal(statusSince({ tab: tab({ changed_at: NOW - MIN }), status: "working", now: NOW }), NOW - MIN);
});

test("statusSince: tab times in seconds are scaled", () => {
  assert.equal(statusSince({ tab: tab({ changed_at: 1_799_999_000 }), status: "idle", now: NOW }), 1_799_999_000_000);
});

test("statusSince: falls back to the seen record when the group matches", () => {
  const seen = { s: "rest", at: NOW - 7 * MIN };
  assert.equal(statusSince({ tab: tab(), seen, status: "done", now: NOW }), NOW - 7 * MIN);
  assert.equal(statusSince({ seen, status: "idle", now: NOW }), NOW - 7 * MIN);
  assert.equal(statusSince({ seen, status: "blocked", now: NOW }), null);
});

test("statusSince: nothing known gives null; bad values are ignored; the future is capped", () => {
  assert.equal(statusSince({ status: "idle", now: NOW }), null);
  assert.equal(statusSince({ shared: "x", tab: tab({ changed_at: 0 }), seen: { s: "rest", at: "y" }, status: "idle", now: NOW }), null);
  assert.equal(statusSince({ shared: NOW + 10 * MIN, status: "idle", now: NOW }), NOW);
});

test("parseSeen: defensive", () => {
  assert.deepEqual(parseSeen(null), {});
  assert.deepEqual(parseSeen("not json"), {});
  assert.deepEqual(parseSeen("[1,2]"), {});
  assert.deepEqual(parseSeen('{"t1":{"s":"rest","at":5},"t2":{"s":1},"t3":null}'), { t1: { s: "rest", at: 5 } });
});

test("trackSeen: new addresses start now, same group keeps its time", () => {
  const a = trackSeen({}, [{ address: "t1", status: "idle" }], NOW);
  assert.equal(a.changed, true);
  assert.deepEqual(a.seen, { t1: { s: "rest", at: NOW } });
  const b = trackSeen(a.seen, [{ address: "t1", status: "done" }], NOW + MIN);
  assert.equal(b.changed, false);
  assert.equal(b.seen.t1.at, NOW);
});

test("trackSeen: a status change resets the time", () => {
  const a = trackSeen({ t1: { s: "working", at: NOW - 10 * MIN } }, [{ address: "t1", status: "blocked" }], NOW);
  assert.equal(a.changed, true);
  assert.deepEqual(a.seen.t1, { s: "blocked", at: NOW });
});

test("trackSeen: gone addresses are pruned, an empty list wipes nothing", () => {
  const seen = { t1: { s: "rest", at: 1 }, t2: { s: "rest", at: 2 } };
  const a = trackSeen(seen, [{ address: "t1", status: "idle" }], NOW);
  assert.deepEqual(Object.keys(a.seen), ["t1"]);
  assert.equal(a.changed, true);
  const b = trackSeen(seen, [], NOW);
  assert.deepEqual(b.seen, seen);
  assert.equal(b.changed, false);
  assert.notEqual(b.seen, seen);
});

test("storage that throws is the caller's job: parseSeen of a throwing source is {}", () => {
  const read = () => { try { return parseSeen((() => { throw new Error("denied"); })()); } catch { return {}; } };
  assert.deepEqual(read(), {});
});

// ---- search ----
test("matchesQuery: every word, any order, case-insensitive", () => {
  assert.equal(matchesQuery("Claude Code api backend", "api claude"), true);
  assert.equal(matchesQuery("Claude Code api backend", "CLAUDE  Api "), true);
  assert.equal(matchesQuery("Claude Code api", "claude web"), false);
  assert.equal(matchesQuery("anything", ""), true);
  assert.equal(matchesQuery("anything", "   "), true);
});

// ---- rows ----
const kinds = (rows) => rows.map((r) => r.kind);
const keys = (rows) => rows.map((r) => r.key);

test("buildRows: waiting first (blocked, then done, longest waiting first), a rule, then spaces", () => {
  const b1 = agent({ status: "blocked", seq: 5 });
  const b2 = agent({ status: "blocked", seq: 3 });
  const d1 = agent({ status: "done", seq: 1 });
  const w1 = agent({ status: "working", seq: 9 });
  const rows = buildRows({ agents: [w1, d1, b1, b2], spaces: [space("s1", "api")], now: NOW });
  assert.deepEqual(kinds(rows), ["waiting", "waiting", "waiting", "sep", "head", "agent"]);
  assert.deepEqual(keys(rows).slice(0, 3), [b2.address, b1.address, d1.address]);
});

test("buildRows: no rule when only one side exists", () => {
  const rows = buildRows({ agents: [agent({ status: "blocked" })], spaces: [space("s1", "api")], now: NOW });
  assert.deepEqual(kinds(rows), ["waiting"]);
  const rows2 = buildRows({ agents: [agent({ status: "working" })], spaces: [space("s1", "api")], now: NOW });
  assert.deepEqual(kinds(rows2), ["head", "agent"]);
});

test("buildRows: sorts recent, oldest, space", () => {
  const a = agent({ status: "working", space: "s1" });
  const b = agent({ status: "working", space: "s1" });
  const c = agent({ status: "working", space: "s1" });
  const sharedSince = { [a.address]: NOW - 30 * MIN, [b.address]: NOW - 5 * MIN, [c.address]: NOW - 60 * MIN };
  const sp = [space("s1", "api")];
  const order = (sort) => keys(buildRows({ agents: [a, b, c], spaces: sp, sharedSince, sort, now: NOW })).slice(1);
  assert.deepEqual(order("recent"), [b.address, a.address, c.address]);
  assert.deepEqual(order("oldest"), [c.address, a.address, b.address]);
  assert.deepEqual(order("space"), [a.address, b.address, c.address]);
  assert.deepEqual(order("bogus"), order("recent"));
});

test("buildRows: equal times keep tree order (stable)", () => {
  const list = [agent({ status: "working" }), agent({ status: "working" }), agent({ status: "working" })];
  const rows = buildRows({ agents: list, spaces: [space("s1", "api")], sort: "recent", now: NOW });
  assert.deepEqual(keys(rows).slice(1), list.map((a) => a.address));
  const rows2 = buildRows({ agents: list, spaces: [space("s1", "api")], sort: "oldest", now: NOW });
  assert.deepEqual(keys(rows2).slice(1), list.map((a) => a.address));
});

test("buildRows: spaces follow their first agent in the chosen order", () => {
  const a = agent({ status: "working", space: "s1", space_name: "api" });
  const b = agent({ status: "working", space: "s2", space_name: "web" });
  const sharedSince = { [a.address]: NOW - 60 * MIN, [b.address]: NOW - MIN };
  const sp = [space("s1", "api"), space("s2", "web")];
  const rows = buildRows({ agents: [a, b], spaces: sp, sharedSince, sort: "recent", now: NOW });
  assert.deepEqual(rows.filter((r) => r.kind === "head").map((r) => r.s.name), ["web", "api"]);
});

test("buildRows: a head for a space Herdr does not list falls back to the agent's space_name", () => {
  const a = agent({ status: "working", space: "gone", space_name: "old" });
  const rows = buildRows({ agents: [a], spaces: [], now: NOW });
  assert.equal(rows[0].s.name, "old");
});

test("buildRows: the earlier fold starts after 24 h, not at 24 h", () => {
  const exactly = agent({ status: "idle" });
  const over = agent({ status: "idle" });
  const sharedSince = { [exactly.address]: NOW - DAY, [over.address]: NOW - DAY - 1 };
  const rows = buildRows({ agents: [exactly, over], spaces: [space("s1", "api")], sharedSince, now: NOW });
  const earlier = rows.find((r) => r.kind === "earlier");
  assert.equal(earlier.count, 1);
  assert.equal(earlier.open, false);
  assert.ok(!keys(rows).includes(over.address));
  assert.ok(keys(rows).includes(exactly.address));
});

test("buildRows: working and focused agents are never folded", () => {
  const w = agent({ status: "working" });
  const f = agent({ status: "idle", focused: true });
  const sharedSince = { [w.address]: NOW - 3 * DAY, [f.address]: NOW - 3 * DAY };
  const rows = buildRows({ agents: [w, f], spaces: [space("s1", "api")], sharedSince, now: NOW });
  assert.ok(!rows.some((r) => r.kind === "earlier"));
});

test("buildRows: showEarlier and a search open the fold", () => {
  const old = agent({ status: "idle", tab_name: "legacy" });
  const sharedSince = { [old.address]: NOW - 3 * DAY };
  const base = { agents: [old], spaces: [space("s1", "api")], sharedSince, now: NOW };
  assert.deepEqual(kinds(buildRows(base)), ["earlier"]);
  assert.deepEqual(kinds(buildRows({ ...base, showEarlier: true })), ["earlier", "head", "agent"]);
  const searched = buildRows({ ...base, query: "legacy" });
  assert.equal(searched[0].open, true);
  assert.ok(keys(searched).includes(old.address));
});

test("buildRows: without agents.since the fold works from the tab or the seen record", () => {
  const viaTab = agent({ status: "idle", tab: "tabA" });
  const viaSeen = agent({ status: "idle", tab: "tabB" });
  const rows = buildRows({
    agents: [viaTab, viaSeen],
    spaces: [space("s1", "api", [tab({ id: "tabA", changed_at: NOW - 2 * DAY }), tab({ id: "tabB" })])],
    sharedSince: undefined,
    seen: { [viaSeen.address]: { s: "rest", at: NOW - 5 * DAY } },
    now: NOW,
  });
  assert.equal(rows.find((r) => r.kind === "earlier").count, 2);
});

test("buildRows: search needs every word and also reads title and status words", () => {
  const a = agent({ status: "blocked", title: "Refactor billing", tab_name: "alpha" });
  const b = agent({ status: "working", title: "", tab_name: "beta", space_name: "api" });
  const sp = [space("s1", "api")];
  const find = (query) => keys(buildRows({ agents: [a, b], spaces: sp, query, now: NOW })).filter((k) => k === a.address || k === b.address);
  assert.deepEqual(find("billing"), [a.address]);
  assert.deepEqual(find("claude billing"), [a.address]);
  assert.deepEqual(find("billing claude"), [a.address]);
  assert.deepEqual(find("needs you"), [a.address]);
  assert.deepEqual(find("beta api"), [b.address]);
  assert.deepEqual(find("zzz"), []);
  assert.deepEqual(find("").sort(), [a.address, b.address].sort());
});

test("buildRows: sub lines", () => {
  const w = agent({ status: "blocked", space_name: "api", tab_name: "web" });
  const r = agent({ status: "working", tab_name: "web" });
  const rows = buildRows({ agents: [w, r], spaces: [space("s1", "api")], now: NOW });
  assert.equal(rows.find((x) => x.kind === "waiting").sub, "api · web");
  assert.equal(rows.find((x) => x.kind === "agent").sub, "Claude Code · web");
});

test("emptyState wording", () => {
  assert.deepEqual(emptyState({ anyAgents: false, filter: "" }), { title: "No agents running", body: "Start one and it will show here" });
  assert.equal(emptyState({ anyAgents: true, filter: "" }).body, "Nothing needs you right now");
  assert.equal(emptyState({ anyAgents: true, filter: "zz" }).body, "No match");
  assert.equal(emptyState({ anyAgents: false, filter: "zz" }).body, "No match");
  assert.equal(emptyState({ anyAgents: true }).title, null);
});

// ---- selection ----
const pick = (key, kind = "agent") => ({ key, kind });

test("resolveSelection: by key, first when missing, -1 when empty", () => {
  const picks = [pick("a"), pick("b"), pick("c")];
  assert.equal(resolveSelection(picks, "b"), 1);
  assert.equal(resolveSelection(picks, "zzz"), 0);
  assert.equal(resolveSelection(picks, null), 0);
  assert.equal(resolveSelection([], "a"), -1);
});

test("the selected agent stays selected when the list reorders", () => {
  assert.equal(resolveSelection([pick("a"), pick("b"), pick("c")], "c"), 2);
  assert.equal(resolveSelection([pick("new"), pick("a"), pick("b"), pick("c")], "c"), 3);
});

test("moveSelection wraps and handles a vanished key and no picks", () => {
  const picks = [pick("a"), pick("b"), pick("c")];
  assert.equal(moveSelection(picks, "a", 1), "b");
  assert.equal(moveSelection(picks, "c", 1), "a");
  assert.equal(moveSelection(picks, "a", -1), "c");
  assert.equal(moveSelection(picks, "gone", 1), "b");
  assert.equal(moveSelection(picks, null, -1), "c");
  assert.equal(moveSelection([], "a", 1), null);
});

test("isPick: rows arrows reach", () => {
  assert.equal(isPick({ kind: "agent" }), true);
  assert.equal(isPick({ kind: "waiting" }), true);
  assert.equal(isPick({ kind: "earlier" }), true);
  assert.equal(isPick({ kind: "head" }), false);
  assert.equal(isPick({ kind: "sep" }), false);
});

// ---- preview reader ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("createPreviewReader: caps concurrency and reads everyone", async () => {
  let inFlight = 0, peak = 0;
  const read = async (address) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await sleep(10);
    inFlight--;
    return { code: 0, stdout: `${address}?` };
  };
  const reader = createPreviewReader({ read, parse: (s) => s, concurrency: 4 });
  const previews = new Map();
  const want = Array.from({ length: 10 }, (_, i) => ({ address: `t${i}`, status: "blocked" }));
  assert.equal(await reader.pass(want, previews), true);
  assert.equal(peak, 4);
  assert.equal(previews.size, 10);
  assert.deepEqual(previews.get("t3"), { status: "blocked", text: "t3?" });
});

test("createPreviewReader: no overlapping passes", async () => {
  let calls = 0;
  const read = async () => { calls++; await sleep(30); return { code: 0, stdout: "x" }; };
  const reader = createPreviewReader({ read, parse: (s) => s });
  const previews = new Map();
  const want = [{ address: "t1", status: "done" }];
  const first = reader.pass(want, previews);
  assert.equal(reader.busy, true);
  assert.equal(await reader.pass(want, previews), null);
  assert.equal(await first, true);
  assert.equal(reader.busy, false);
  assert.equal(calls, 1);
  assert.equal(await reader.pass(want, previews), false);
  assert.equal(calls, 2);
});

test("createPreviewReader: failed or throwing reads store empty text; busy resets", async () => {
  const read = async (address) => {
    if (address === "t1") throw new Error("hc missing");
    if (address === "t2") return { code: 1, stdout: "ignored" };
    return { code: 0, stdout: "ok?" };
  };
  const reader = createPreviewReader({ read, parse: (s) => s });
  const previews = new Map();
  await reader.pass([{ address: "t1", status: "blocked" }, { address: "t2", status: "blocked" }, { address: "t3", status: "blocked" }], previews);
  assert.equal(previews.get("t1").text, "");
  assert.equal(previews.get("t2").text, "");
  assert.equal(previews.get("t3").text, "ok?");
  assert.equal(reader.busy, false);
});

test("createPreviewReader: a throwing parse does not wedge the reader", async () => {
  const reader = createPreviewReader({ read: async () => ({ code: 0, stdout: "x" }), parse: () => { throw new Error("bad"); } });
  const previews = new Map();
  await reader.pass([{ address: "t1", status: "done" }], previews);
  assert.equal(previews.get("t1").text, "");
  assert.equal(reader.busy, false);
});

test("createPreviewReader: prunes agents that stopped waiting, reads nothing when none wait", async () => {
  let calls = 0;
  const reader = createPreviewReader({ read: async () => { calls++; return { code: 0, stdout: "x" }; }, parse: (s) => s });
  const previews = new Map([["t9", { status: "done", text: "old" }]]);
  assert.equal(await reader.pass([], previews), true);
  assert.equal(previews.size, 0);
  assert.equal(calls, 0);
  assert.equal(await reader.pass([], previews), false);
});

test("createPreviewReader: a status change refreshes the entry", async () => {
  const reader = createPreviewReader({ read: async () => ({ code: 0, stdout: "same" }), parse: (s) => s });
  const previews = new Map();
  await reader.pass([{ address: "t1", status: "blocked" }], previews);
  assert.equal(await reader.pass([{ address: "t1", status: "blocked" }], previews), false);
  assert.equal(await reader.pass([{ address: "t1", status: "done" }], previews), true);
  assert.equal(previews.get("t1").status, "done");
});

// ---- color ----
test("contrast: known ratios", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.ok(Math.abs(contrast("#777777", "#777777") - 1) < 0.01);
});

test("inkOn: every space mark colour reads at 4.5:1 or better", () => {
  for (const bg of ["#22a99a", "#e3814f", "#5b8def", "#8b7cf6", "#3fae6a", "#d9649a", "#101010", "#f5f5f5"]) {
    assert.ok(contrast(bg, inkOn(bg)) >= 4.5, bg);
  }
  assert.equal(inkOn("#101010"), "#ffffff");
  assert.equal(inkOn("#f5f5f5"), "#111111");
  assert.equal(inkOn("not a color"), "#ffffff");
  assert.equal(inkOn(undefined), "#ffffff");
});
