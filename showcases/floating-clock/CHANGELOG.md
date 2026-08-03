# @lynxtron-examples/floating-clock

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
