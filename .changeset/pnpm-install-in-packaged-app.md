---
'lynxtron-go': patch
'@lynxtron-examples/benchmark': patch
'@lynxtron-examples/counter': patch
'@lynxtron-examples/cross-platform-notes': patch
'@lynxtron-examples/electron-fiddles': patch
'@lynxtron-examples/file-explorer': patch
'@lynxtron-examples/floating-clock': patch
'@lynxtron-examples/native-texture-canvas': patch
'@lynxtron-examples/pc-mouse-cursor': patch
'@lynxtron-examples/system-monitor': patch
'@lynxtron-examples/todolist': patch
---

**Packaged Lynxtron GO could not build a fetched showcase.** Running a
not-yet-built showcase from an installed build failed with `spawn npm ENOENT`:
the packaged app ships `node`/`pnpm` on PATH via its own shim, but never `npm`,
and Finder-launched apps inherit only launchd's minimal PATH so any `npm` is
invisible to child processes. `pnpm preview` masked this because a shell-run
parent process already has `npm` on PATH.

Standalone showcase installs now use `pnpm install` too (workspace showcases
were already on pnpm), and every showcase's own `start` / `start:web` /
`build:web` script — plus lynxtron-go's `build` / `pack` — chains through
`pnpm run` rather than `npm run`, so a showcase that spawns build steps from
inside a packaged parent finds a working package manager.
