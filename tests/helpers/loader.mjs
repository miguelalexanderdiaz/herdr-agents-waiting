// Lets node load the real mods/attention-picker/main.js: the three modules that
// only exist inside Herdr ("gpui-kit", "gpui-base", "herdr") resolve to the
// stubs next to this file. Import this file first (side effect), then import
// main.js dynamically.
//
// module.registerHooks (Node 22.15+, 23.5+) runs in-thread; older Node falls back
// to module.register (an off-thread hooks file, which prints a deprecation
// notice on the newest Node, harmless).
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";

import { STUBS } from "./stub-urls.mjs";

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
} else {
  nodeModule.register(new URL("./hooks.mjs", import.meta.url), pathToFileURL("./"));
}

export const loadMain = async () => (await import("../../mods/attention-picker/main.js")).default;
