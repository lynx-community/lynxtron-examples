# @lynxtron-examples/todolist

## 0.0.5

### Patch Changes

- 28c3775: Migrate every showcase from the deprecated per-window `win.on('-lynx-invoke')`
  and `win.on('-lynx-message')` listeners to the process-global `lynxBridge.handle()`
  and `lynxBridge.on()` API.

  Each showcase's dispatch switch is split into per-method handlers, and
  registration is hoisted to `app.whenReady()` so windows that reopen (e.g. the
  gallery's `activate` handler, the benchmark's second window) do not
  re-register the same handler.

## 0.0.4

### Patch Changes

- e4baab9: Add `repository.directory` to each showcase's `package.json` so tools that resolve source URLs from published packages (e.g. the `<Go>` component in the docs site) can link back to the correct subdirectory in the monorepo.

## 0.0.3

### Patch Changes

- c2fc749: Bump `@lynx-js/lynxtron` toolchain (lynxtron, lynxtron-builder, lynxtron-dev-plugins, lynx-library-headers, lynxtron-rebuild) from 0.0.5 to 0.0.7. No showcase runtime behavior changes; toolchain-only update to unblock native rebuilds on Python 3.13+.

## 0.0.2

### Patch Changes

- c770aa7: Release showcases with new todolist example
