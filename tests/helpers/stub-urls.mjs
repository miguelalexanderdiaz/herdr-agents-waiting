// Where each Herdr-only module resolves to under test.
const stub = (name) => new URL(`./stubs/${name}.mjs`, import.meta.url).href;
export const STUBS = {
  "gpui-kit": stub("gpui-kit"),
  "gpui-base": stub("gpui-base"),
  herdr: stub("herdr"),
};
