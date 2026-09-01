# @lynxtron-examples/counter

## 0.0.3

### Patch Changes

- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.

## 0.0.2

### Patch Changes

- 28c3775: Migrate every showcase from the deprecated per-window `win.on('-lynx-invoke')`
  and `win.on('-lynx-message')` listeners to the process-global `lynxBridge.handle()`
  and `lynxBridge.on()` API.

  Each showcase's dispatch switch is split into per-method handlers, and
  registration is hoisted to `app.whenReady()` so windows that reopen (e.g. the
  gallery's `activate` handler, the benchmark's second window) do not
  re-register the same handler.
