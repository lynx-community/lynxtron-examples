# @lynxtron-examples/config

## 0.0.9

### Patch Changes

- eae08c1: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.

## 0.0.8

### Patch Changes

- ce7af8c: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.

## 0.0.7

### Patch Changes

- a83210a: Allow trusted remote showcase bundles to declare, verify, and load native extensions after user confirmation.

## 0.0.6

### Patch Changes

- 4c524f4: Enable CSS inline variables in the shared Lynx showcase configuration so complex desktop showcases can use runtime style variables consistently.

## 0.0.5

### Patch Changes

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

## 0.0.4

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.

## 0.0.3

### Patch Changes

- a3096be: Republish so `package.json` `dependencies` carry real version specifiers instead of the `catalog:` protocol. The previously published `0.0.1` tarball still contained `catalog:` refs, which caused `pnpm install` to fail with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` when the Lynxtron GO app tried to install a fetched showcase.

## 0.0.2-alpha.0

### Patch Changes

- 0068442: Set up the release pipeline: publish the shared build config and the public
  showcases (benchmark, file-explorer, floating-clock, system-monitor) to npm
  via Changesets + npm OIDC trusted publishing, and build Lynxtron GO installers
  and showcase tarballs as GitHub Release assets.
