# @lynxtron-examples/electron-fiddles

## 0.1.1

### Patch Changes

- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.

## 0.1.0

### Minor Changes

- dd950b6: Add the `electron-fiddles` showcase — the complete Electron `docs/fiddles` set
  ported to Lynxtron (55 fiddles: 37 working, 7 partial, 11 N/A) — and surface it
  as a dedicated "Electron Fiddles" section in the Lynxtron GO gallery.

  It follows upstream's own model rather than inventing one. Upstream's
  `docs/fiddles` holds 171 files and zero `package.json`s: each fiddle is a plain
  source folder, and Electron Fiddle synthesizes a throwaway project around it at
  run time and spawns Electron on that. Here each fiddle is likewise a loose
  source folder laid out at its upstream path, and `scripts/assemble.mjs` turns one
  into a complete standalone Lynxtron project, compiles it, and runs it — with the
  one extra step Electron does not need, since Lynx cannot load source at run time.

  Because every fiddle is its own project, launching one from the gallery spawns
  its own Lynxtron process. That isolation is load-bearing: while all fiddles
  shared a single main process, the ones touching app-global state
  (`Menu.setApplicationMenu`, `app.dock.setMenu`,
  `app.setAsDefaultProtocolClient`) silently overwrote each other.

  - `kit/` (`@lynxtron-examples/fiddle-kit`): the shared bridge helpers, Lynx UI
    kit, and runtime access to native classes the ESM shim omits. It ships inside
    the showcase as a `file:` dependency rather than as an independently released
    workspace package — a fetched showcase has no monorepo to resolve
    `workspace:*` against, and the kit is private so it cannot be published.
  - `config`: `createShowcaseConfig` gains `server` (and `entries`, for multi-entry
    showcases).
  - `lynxtron-go`: the gallery bakes in the fiddle catalog and lists all 55 fiddles
    grouped by upstream category with status badges, separate from the
    featured-showcase grid.

  The fiddles are pared back to the API demonstration itself and share the repo's
  Fiddle Dark language with `showcases/counter` and `showcases/system-monitor` —
  palette from `@lynxtron-examples/config/tokens.css`, labelled panels, and
  `var(--font-mono)` reserved for data. `partial` fiddles keep one plain line
  naming the gap; the tutorial prose that repeated the port matrix is gone.

  Each fiddle also lists the Lynxtron APIs it calls, in monospace, and tapping one
  opens its page in the published API reference. The lists are derived from each
  fiddle's own source rather than hand-written.

### Patch Changes

- 28c3775: Migrate every showcase from the deprecated per-window `win.on('-lynx-invoke')`
  and `win.on('-lynx-message')` listeners to the process-global `lynxBridge.handle()`
  and `lynxBridge.on()` API.

  Each showcase's dispatch switch is split into per-method handlers, and
  registration is hoisted to `app.whenReady()` so windows that reopen (e.g. the
  gallery's `activate` handler, the benchmark's second window) do not
  re-register the same handler.
