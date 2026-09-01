# @lynxtron-examples/floating-clock

## 0.0.6

### Patch Changes

- eae08c1: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.
- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.

## 0.0.5

### Patch Changes

- ce7af8c: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.

## 0.0.4

### Patch Changes

- 28c3775: Migrate every showcase from the deprecated per-window `win.on('-lynx-invoke')`
  and `win.on('-lynx-message')` listeners to the process-global `lynxBridge.handle()`
  and `lynxBridge.on()` API.

  Each showcase's dispatch switch is split into per-method handlers, and
  registration is hoisted to `app.whenReady()` so windows that reopen (e.g. the
  gallery's `activate` handler, the benchmark's second window) do not
  re-register the same handler.

## 0.0.3

### Patch Changes

- e4baab9: Add `repository.directory` to each showcase's `package.json` so tools that resolve source URLs from published packages (e.g. the `<Go>` component in the docs site) can link back to the correct subdirectory in the monorepo.

## 0.0.2

### Patch Changes

- c770aa7: Release showcases with new todolist example

## 0.0.2-alpha.0

### Patch Changes

- 0068442: Set up the release pipeline: publish the shared build config and the public
  showcases (benchmark, file-explorer, floating-clock, system-monitor) to npm
  via Changesets + npm OIDC trusted publishing, and build Lynxtron GO installers
  and showcase tarballs as GitHub Release assets.
