// Off-thread resolve hook for Node versions without module.registerHooks.
import { STUBS } from "./stub-urls.mjs";

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
