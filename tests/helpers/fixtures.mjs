// Builders for the data main.js reads from Herdr (shapes follow herdr.d.ts).

export const agent = (n, o = {}) => ({
  address: `t${n}`, pane: `p${n}`, space: "s1", space_name: "api", tab: `tab${n}`, tab_index: 1, tab_name: `work${n}`,
  status: "idle", app: "claude-code",
  program: { key: "claude", name: "Claude Code", icon: null, tint: false, tile: null, color: null, shell: false, agent: true },
  title: `Agent ${n}`, seq: n, pinned: false, focused: false, ...o,
});

export const tab = (id, o = {}) => ({
  id, index: 1, name: id, named: false, active: false, status: null, panes: 1, zoomed: false,
  settled: false, settled_at: null, changed_at: null, working_since: null, ...o,
});

export const space = (id, name, tabs = [], o = {}) => ({
  id, index: 1, name, named: true, folder: "", machine: null, branch: null, active: false, status: null, tabs, ...o,
});

// A storage like the browser's, optionally broken.
export function memoryStorage({ broken = false } = {}) {
  const m = new Map();
  const boom = () => { throw new Error("storage unavailable"); };
  return {
    data: m,
    getItem: broken ? boom : (k) => (m.has(k) ? m.get(k) : null),
    setItem: broken ? boom : (k, v) => { m.set(k, String(v)); },
    removeItem: broken ? boom : (k) => { m.delete(k); },
  };
}
