# @lynxtron-examples/cross-platform-notes

## 0.0.3

### Patch Changes

- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.

## 0.0.2

### Patch Changes

- 59c13fe: Fix the Web Notes host bridge so the Lynx BTS worker persists notes through the browser main thread, and publish its real preview capture for documentation consumers.
