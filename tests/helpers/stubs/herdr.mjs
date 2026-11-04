// Stand-in for Herdr's "herdr" module. `state` is what a test sets up before
// the view is built; `log` is what the view did. reset() between tests.

export const state = {};
export const log = {};

export function reset() {
  Object.assign(state, {
    agents: [], spaces: [], shared: {}, theme: THEME, props: {}, settings: {},
    hc: async () => ({ code: 0, stdout: "" }),
  });
  Object.assign(log, { runs: [], hcs: [], closed: [], sets: [] });
}

export const THEME = {
  foreground: "#e6e6e6", background: "#101014", popover: "#17171c", raised: "#22222a", hover: "#2b2b35",
  border: "#33333d", accent: "#5b8def", muted: "#a0a0ad", dim: "#808090",
  blocked: "#e3814f", done: "#3fae6a", working: "#5b8def", idle: "#808090",
  ansi1: "#d9649a", ansi2: "#3fae6a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi6: "#22a99a",
};

export const agents = () => state.agents;
export const spaces = () => state.spaces;
export const theme = () => state.theme;
export const settings = () => state.settings;
export const props = () => state.props;
export const shared = (key) => state.shared[key];
export const setShared = (key, value) => { log.sets.push([key, value]); state.shared[key] = value; return null; };
export const run = (name, args) => { log.runs.push([name, args]); return null; };
export const hc = (args) => { log.hcs.push(args); return state.hc(args); };
export const closeOverlay = (id) => { log.closed.push(id); return null; };

reset();
