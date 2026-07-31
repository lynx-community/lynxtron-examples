---
'@lynxtron-examples/cli': patch
'lynxtron-go': patch
---

Fix the fetch → install → build → run chain for showcases opened from the
gallery, and make gallery thumbnails render again.

Four separate failures, each of which made a fetched showcase unrunnable:

- **pnpm aborted on a TTY prompt.** Installs are spawned by the app, never from
  a terminal, so pnpm's "remove node_modules?" confirmation had nothing to
  answer it and bailed with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The
  install environment now declares itself non-interactive.
- **The workspace ran whatever pnpm the machine had.** `~/.lynxtron-go` pinned
  no `packageManager`, so on a machine with pnpm 11 it used that — and pnpm 11
  no longer reads `pnpm.onlyBuiltDependencies` from package.json and turns
  ignored build scripts into a hard error. `@lynx-js/lynxtron`'s postinstall
  downloads the runtime binary, so the install "succeeded" with no runtime.
  The workspace now pins the same pnpm as the monorepo, and declares
  `onlyBuiltDependencies` in pnpm-workspace.yaml as well (here and in the
  monorepo) so either pnpm major works.
- **`@lynx-js/lynxtron-builder`'s postinstall patches `app-builder-lib` and
  `dmg-builder`**, which pnpm does not hoist. The monorepo carries both at its
  root for exactly this reason; the synthesized workspace now does too.
- **Gallery thumbnails were blank in remote mode.** Lynx's `<image>` loader
  reads the URL itself rather than going through the window's fetch handler, and
  does not load https at all — the URL answered 200 and the image still never
  appeared. Thumbnails are now staged into the app's own bundle and referenced
  as local files, which also leaves a packaged build self-contained.
