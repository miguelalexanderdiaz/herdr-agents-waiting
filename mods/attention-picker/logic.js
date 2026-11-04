// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 the herdr-agents-waiting authors; licence: LICENSE in the repository
// The pure part of "Agents waiting": row building, sorting, search, selection,
// status times and the preview reader. No Herdr or gpui-kit imports, so
// `npm test` can load it. main.js owns everything that draws or talks
// to Herdr.

export const DAY = 24 * 3600 * 1000;
export const ORDER = { blocked: 0, done: 1, working: 2 };
export const WORD = { blocked: "needs you", done: "finished", working: "working" };

// How the agents under the rule are ordered (kept in shared "attention.sort").
export const SORTS = ["recent", "oldest", "space"];

// Rows that arrow keys and Enter reach.
const PICK_KINDS = new Set(["agent", "waiting", "earlier"]);
export const isPick = (r) => PICK_KINDS.has(r.kind);

// ---- props ----------------------------------------------------------------

// The search box is on unless the caller says `search: false` (opened by its
// own key there are no props at all, and then search is what people expect).
export function pickSearch(props) {
  return props?.search !== false;
}

// ---- formatting and naming ------------------------------------------------

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (!(m >= 1)) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export const clean = (s) => String(s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// The agent's own name, as the space tree shows it: its title (a Claude
// session's name), else a named tab, else its program. Titles that are really
// a path (/..., ~/..., C:\..., \\server) or user@host are not names.
export function nameOf(a) {
  // Judge the raw title: clean() would strip the "~" or "/" that marks a path.
  const raw = String(a.title ?? "").trim();
  const title = clean(raw);
  if (title && !/^[~/]|^[A-Za-z]:\\|^\\\\/.test(raw) && !raw.includes("@") && title !== a.program?.name) return title;
  if (a.tab_name && !/^\d+$/.test(a.tab_name)) return a.tab_name;
  return a.program?.name || a.app || "agent";
}

// ---- color ----------------------------------------------------------------

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// WCAG contrast ratio of two #rrggbb colors (1 to 21).
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// #rgb, #rrggbb or #rrggbbaa (any case) as lowercase #rrggbb, else null. The
// alpha of an 8-digit value is dropped: a tile is drawn opaque.
export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  const h = m[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6)}`;
}

// Text color for a letter drawn on a tile: whichever of white and near-black
// reads better. White on the mid-tone space colors is only ~3:1. Anything that
// is not a hex color gets white.
export function inkOn(bg) {
  const hex = normalizeHex(bg);
  if (!hex) return "#ffffff";
  return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
}

// The tile colors of the ansi names a layout may put in shared "space.colors".
export const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

const own = (obj, key) => obj != null && Object.hasOwn(obj, key);

// The color of a space's tile. `raw` is whatever shared "space.colors" holds
// for it, written by other mods, so it can be anything: a hex string, a name
// from `mark` or the theme, or junk (number, null, array, unknown name), which
// falls back to the default ansi6 and then to `dim`. The home space is always
// `dim`. Never throws and never returns undefined while `dim` is given.
export function resolveSpaceColor({ raw, mark = MARK, theme = {}, dim, isHome = false } = {}) {
  const quiet = dim ?? theme.dim;
  if (isHome) return quiet;
  const hex = normalizeHex(raw);
  if (hex) return hex;
  for (const name of [raw, "ansi6"]) {
    if (typeof name !== "string") continue;
    if (own(mark, name)) return mark[name];
    if (own(theme, name) && typeof theme[name] === "string") return theme[name];
  }
  return quiet;
}

// ---- sort -----------------------------------------------------------------

export function normalizeSort(value) {
  return SORTS.includes(value) ? value : "recent";
}

// The sort after `current`; dir -1 goes back (Shift+Tab).
export function nextSort(current, dir = 1) {
  const i = SORTS.indexOf(normalizeSort(current));
  return SORTS[(i + (dir < 0 ? -1 : 1) + SORTS.length) % SORTS.length];
}

// ---- status times ---------------------------------------------------------

// The seen-record groups statuses the way "waiting since" thinks of them:
// done turns into idle once looked at, and that is not a new wait.
export const statusGroup = (status) => (status === "done" || status === "idle" ? "rest" : status);

const okTime = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
// Tab times should be ms since the epoch; a value that looks like seconds is scaled.
const toMs = (v) => (okTime(v) ? (v < 1e11 ? v * 1000 : v) : null);

// A shared time is ignored when the tab shows a change this much newer (ms).
export const STALE_SLACK = 10_000;

// When this agent's current status began, best source first:
//   shared  - the shared "agents.since" value for its address (the portrait layout's tracker)
//   tab     - the tab's working_since (working) or changed_at (anything else)
//   seen    - this mod's own first-seen record { s: statusGroup, at } (only if the group still matches)
// Returns ms since the epoch (never in the future), or null.
//
// A shared map is persisted, so one left behind by a layout that is no longer
// running can name an old time for an agent that has changed state since. It is
// ignored for a blocked or working agent that is alone in its tab (`tabAgents`
// is 1) when the tab proves a newer change (changed_at for blocked,
// working_since for working) by more than STALE_SLACK: then no other agent
// explains the tab's time. With `tabAgents` missing the shared value always
// wins, as before. This never lengthens a wait and does not apply to the
// finished or idle agents.
export function statusSince({ shared, tab, seen, status, now, tabAgents }) {
  const cap = (v) => Math.min(v, now);
  if (okTime(shared) && !(tabAgents === 1 && tabProvesNewer(tab, status, shared))) return cap(shared);
  if (tab) {
    const v = toMs(status === "working" && okTime(tab.working_since) ? tab.working_since : tab.changed_at);
    if (v) return cap(v);
  }
  if (seen && seen.s === statusGroup(status) && okTime(seen.at)) return cap(seen.at);
  return null;
}

function tabProvesNewer(tab, status, shared) {
  if (!tab) return false;
  const at = status === "blocked" ? toMs(tab.changed_at) : status === "working" ? toMs(tab.working_since) : null;
  return at !== null && at - shared > STALE_SLACK;
}

const MAX_SEEN = 500;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isStr = (v) => typeof v === "string";

// Reads the stored first-seen map defensively: anything odd gives {}.
// A record is { s: status group, at: ms, q: the agent's seq then, sp: its space id };
// q and sp are optional (records from older versions have only s and at).
export function parseSeen(raw) {
  let obj;
  try { obj = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return {}; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out = {};
  for (const [address, e] of Object.entries(obj).slice(0, MAX_SEEN)) {
    if (!e || typeof e.s !== "string" || !okTime(e.at)) continue;
    out[address] = { s: e.s, at: e.at };
    if (isNum(e.q)) out[address].q = e.q;
    if (isStr(e.sp)) out[address].sp = e.sp;
  }
  return out;
}

const record = (g, at, a) => ({ s: g, at, ...(isNum(a.seq) ? { q: a.seq } : {}), ...(isStr(a.space) ? { sp: a.space } : {}) });

// Brings the first-seen map up to date with the agents now running:
// a new address, a changed status group, a seq that went down (a counter that
// restarted means a different run behind a reused address) or a different space
// starts a record at `now`; an address that is gone is dropped (only while some
// agents exist, so an empty list during a reload does not wipe the record).
// An older record without q or sp keeps its time and gains them. Returns
// { seen, changed }; `seen` is a new object.
export function trackSeen(seen, list, now) {
  const next = {};
  let changed = false;
  for (const a of list) {
    const g = statusGroup(a.status);
    const e = seen[a.address];
    const same = e && e.s === g && okTime(e.at)
      && !(isNum(e.q) && isNum(a.seq) && a.seq < e.q)
      && !(isStr(e.sp) && isStr(a.space) && a.space !== e.sp);
    if (!same) { next[a.address] = record(g, now, a); changed = true; continue; }
    const fill = { ...(e.q === undefined && isNum(a.seq) ? { q: a.seq } : {}), ...(e.sp === undefined && isStr(a.space) ? { sp: a.space } : {}) };
    if (Object.keys(fill).length) { next[a.address] = { ...e, ...fill }; changed = true; } else next[a.address] = e;
  }
  if (list.length === 0) {
    for (const [address, e] of Object.entries(seen)) next[address] = e;
  } else if (Object.keys(seen).some((address) => !(address in next))) {
    changed = true;
  }
  return { seen: next, changed };
}

// ---- rows -----------------------------------------------------------------

// Orders two rows by the time their status began (dir 1: oldest first, -1: newest
// first). A row whose time is unknown goes last either way.
function bySince(x, y, dir) {
  if (x.since === y.since) return 0;
  if (x.since == null) return 1;
  if (y.since == null) return -1;
  return dir * (x.since - y.since);
}

// All words of the query must appear somewhere in the haystack (order free).
export function matchesQuery(haystack, query) {
  const tokens = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

// On top, a plain list: the agents that need you, then the finished ones
// (longest-waiting first: lower seq = changed longer ago), each with what it
// is asking. Under a rule, every other agent grouped by space in the chosen
// order (spaces follow their first agent); the ones idle for over a day fold
// into an "earlier" line. Filtered by the query (which also opens "earlier").
// Rows: { kind: "waiting"|"agent", key: address, a, idx, name, program, since, sub },
//       { kind: "head", key, s }, { kind: "sep", key }, { kind: "earlier", key, count, open }.
export function buildRows({ agents, spaces = [], sharedSince = {}, seen = {}, query = "", sort = "recent", showEarlier = false, now }) {
  const tabs = new Map();
  for (const s of spaces) for (const t of s.tabs ?? []) tabs.set(t.id, t);
  const since = sharedSince && typeof sharedSince === "object" ? sharedSince : {};
  const rank = (a) => ORDER[a.status] ?? 3;
  const hasQuery = String(query ?? "").trim() !== "";
  const perTab = new Map(); // tab id -> how many agents it holds (all of them, not only the matches)
  for (const a of agents) perTab.set(a.tab, (perTab.get(a.tab) ?? 0) + 1);

  const all = agents
    .map((a, idx) => {
      const name = nameOf(a);
      const program = a.program?.name || a.app || "";
      return {
        a, idx, name, program, key: a.address,
        since: statusSince({ shared: since[a.address], tab: tabs.get(a.tab), seen: seen[a.address], status: a.status, now, tabAgents: perTab.get(a.tab) }),
        hay: [name, program, a.space_name, a.tab_name, a.title, WORD[a.status], a.status].filter(Boolean).join(" "),
      };
    })
    .filter((r) => !hasQuery || matchesQuery(r.hay, query))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.a.seq - y.a.seq || x.idx - y.idx);

  const waiting = (r) => r.a.status === "blocked" || r.a.status === "done";
  const top = all.filter(waiting)
    .map((r) => ({ ...r, kind: "waiting", sub: [r.a.space_name, r.a.tab_name].filter(Boolean).join(" · ") }));
  const by = {
    recent: (x, y) => bySince(x, y, -1),
    oldest: (x, y) => bySince(x, y, 1),
    space: (x, y) => x.idx - y.idx,
  }[normalizeSort(sort)];
  const rest = all.filter((r) => !waiting(r)).sort((x, y) => by(x, y) || x.idx - y.idx)
    .map((r) => ({ ...r, kind: "agent", sub: [r.program, r.a.tab_name].filter(Boolean).join(" · ") }));
  const old = (r) => r.a.status !== "working" && !r.a.focused && r.since && now - r.since > DAY;
  const recent = rest.filter((r) => !old(r));
  const earlier = rest.filter(old);

  const byId = new Map(spaces.map((s) => [s.id, s]));
  const grouped = (list) => {
    const groups = new Map();
    for (const r of list) {
      if (!groups.has(r.a.space)) groups.set(r.a.space, []);
      groups.get(r.a.space).push(r);
    }
    return [...groups].flatMap(([id, rs]) => [
      { kind: "head", key: `head:${id}`, s: byId.get(id) ?? { id, name: rs[0].a.space_name || "space" } },
      ...rs,
    ]);
  };

  const out = [...top];
  if (top.length && rest.length) out.push({ kind: "sep", key: "sep" });
  out.push(...grouped(recent));
  if (earlier.length) {
    const open = showEarlier || hasQuery;
    out.push({ kind: "earlier", key: "earlier", count: earlier.length, open });
    if (open) out.push(...grouped(earlier));
  }
  return out;
}

// The text for the empty list. `anyAgents`: whether Herdr reports any agent at all.
export function emptyState({ anyAgents, filter }) {
  if (filter && String(filter).trim()) return { title: null, body: "No match" };
  if (!anyAgents) return { title: "No agents running", body: "Start one and it will show here" };
  return { title: null, body: "Nothing needs you right now" };
}

// The dialog's title: a state of the agents, never of the search box. Blocked
// agents beat finished ones; with none waiting it is the empty-state title or
// "Nothing needs you right now".
export function headline({ agents = [] } = {}) {
  const asking = agents.filter((a) => a.status === "blocked").length;
  if (asking) return `${asking} agent${asking === 1 ? "" : "s"} need${asking === 1 ? "s" : ""} you`;
  const done = agents.filter((a) => a.status === "done").length;
  if (done) return `${done} finished`;
  return emptyState({ anyAgents: agents.length > 0 }).title ?? "Nothing needs you right now";
}

// ---- selection (by key, so it survives the list reordering) -----------------

// Index of the selected pick; the first one when the key is gone or unset; -1 when there are none.
export function resolveSelection(picks, key) {
  if (!picks.length) return -1;
  const i = key == null ? -1 : picks.findIndex((r) => r.key === key);
  return i < 0 ? 0 : i;
}

// The key `delta` rows away from the selection, wrapping at both ends; null when there are no picks.
export function moveSelection(picks, key, delta) {
  if (!picks.length) return null;
  const i = resolveSelection(picks, key);
  const n = picks.length;
  return picks[(((i + delta) % n) + n) % n].key;
}

// ---- previews ---------------------------------------------------------------

// Reads what each waiting agent says, one pass at a time and at most
// `concurrency` reads in flight. `read(address)` resolves to { code, stdout }
// (or rejects); `parse(stdout, status)` gives the text to show. A failed read
// stores empty text, so a placeholder never stays forever. `previews` is a
// Map address -> { status, text}; entries for agents no longer waiting are
// dropped. pass() resolves to whether `previews` changed, or null when a pass
// was already running.
export function createPreviewReader({ read, parse, concurrency = 4 }) {
  let busy = false;
  return {
    get busy() { return busy; },
    async pass(want, previews) {
      if (busy) return null;
      busy = true;
      try {
        let changed = false;
        const live = new Set(want.map((w) => w.address));
        for (const address of [...previews.keys()]) {
          if (!live.has(address)) { previews.delete(address); changed = true; }
        }
        const queue = [...want];
        const worker = async () => {
          for (let w = queue.shift(); w; w = queue.shift()) {
            let text = "";
            try {
              const r = await read(w.address);
              if (r && r.code === 0) text = parse(r.stdout, w.status);
            } catch { /* leave text empty */ }
            const old = previews.get(w.address);
            if (old?.text !== text || old?.status !== w.status) {
              previews.set(w.address, { status: w.status, text });
              changed = true;
            }
          }
        };
        const n = Math.max(1, Math.min(concurrency, queue.length));
        await Promise.all(Array.from({ length: queue.length ? n : 0 }, worker));
        return changed;
      } finally {
        busy = false;
      }
    },
  };
}
