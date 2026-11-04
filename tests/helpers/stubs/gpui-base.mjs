// Stand-in for Herdr's "gpui-base" module (see gpui-kit.mjs).
import { element, nodeOf } from "./gpui-kit.mjs";

export const v_flex = () => element("v_flex");
export const h_flex = () => element("h_flex");

// Records the handlers main.js registers so a test can fire them.
export class InputState {
  constructor(options = {}) {
    this.options = options;
    this.text = options.value ?? "";
    this.handlers = {};
    this.focused = 0;
  }
  static new(options) { return new InputState(options); }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); }
  value() { return this.text; }
  focus() { this.focused += 1; }
  // test helpers
  type(text, cx) { this.text = text; for (const fn of this.handlers.change ?? []) fn({}, cx); }
  submit(cx) { for (const fn of this.handlers.submit ?? []) fn({}, cx); }
}

export const Input = {
  new: (state) => { const e = element("input"); nodeOf(e).state = state; return e; },
};
