---
'@lynxtron-examples/electron-fiddles': minor
'@lynxtron-examples/fiddle-kit': minor
'@lynxtron-examples/config': patch
'lynxtron-go': minor
---

Add the `electron-fiddles` showcase — the complete Electron `docs/fiddles` set
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

- `fiddle-kit`: new package holding the shared bridge helpers, Lynx UI kit, and
  runtime access to native classes the ESM shim omits. A copy travels with every
  assembled project so the output stays runnable on its own.
- `config`: `createShowcaseConfig` gains `server` (and `entries`, for multi-entry
  showcases).
- `lynxtron-go`: the gallery bakes in the fiddle catalog and lists all 55 fiddles
  grouped by upstream category with status badges, separate from the
  featured-showcase grid.
