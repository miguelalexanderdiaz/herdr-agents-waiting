// Stand-in for Herdr's "gpui-kit" module, just enough to run the real main.js.
// Every element is a chainable proxy that records what was called on it and
// what was put inside it; `.when(cond, fn)` applies `fn` like the real one.

const NODE = Symbol("node");

export function element(kind = "div") {
  const n = { kind, calls: [], kids: [] };
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(add); return; }
    n.kids.push(c?.[NODE] ?? c);
  };
  const proxy = new Proxy(function element() {}, {
    get(_t, prop) {
      if (prop === NODE) return n;
      if (prop === "when") return (cond, fn) => (cond ? (fn(proxy) ?? proxy) : proxy);
      if (prop === "child" || prop === "children") return (c) => { add(c); return proxy; };
      return (...args) => { n.calls.push([prop, args]); return proxy; };
    },
  });
  return proxy;
}

export const div = () => element("div");
export const svg = (path) => { const e = element("svg"); e[NODE].path = path; return e; };

export class View {
  constructor(props) { this.props = props; }
}

// ---- helpers for tests (not part of gpui-kit) -------------------------------

export const nodeOf = (e) => e?.[NODE];
// Every call named `name` on `node`, as an array of argument lists.
export const callsOf = (node, name) => node.calls.filter(([c]) => c === name).map(([, args]) => args);
// Walk a node tree depth-first.
export function* walk(node) {
  yield node;
  for (const k of node.kids) if (k && typeof k === "object") yield* walk(k);
}
// All text inside, in order.
export const textOf = (node) => [...walk(node)].flatMap((n) => n.kids.filter((k) => typeof k === "string" || typeof k === "number").map(String));
export const find = (node, pred) => [...walk(node)].find(pred);
export const findAll = (node, pred) => [...walk(node)].filter(pred);
