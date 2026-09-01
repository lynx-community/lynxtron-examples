# @lynxtron-examples/cli

## 0.0.8

### Patch Changes

- eae08c1: Build release installers with packed showcase asset URLs and the application version, and install source-only showcase fallbacks with npm including devDependencies so build commands can resolve executable dependencies such as cross-env.
- eae08c1: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.
- d8005ce: Key downloaded showcase caches by their baked source URL so a new installer refreshes stale workspaces, while preserving mismatched editable workspaces in a backup directory. Publish source-bound precompiled artifacts under `dist_precompiled`, verify their source and artifact tree hashes before use, and fall back to a local `dist` build when verification fails or the source was edited.

  Package Hello Lynxtron as a standard source-bound showcase artifact inside the installer, route it through the same fetch/cache/verification/build fallback as every other showcase, and remove the separate in-memory Hello template without publishing an additional Release asset.

## 0.0.7

### Patch Changes

- ce7af8c: Run release showcases from their prebuilt tarball artifacts, install build-time devDependencies when edited source must be rebuilt, explicitly enable selectable Terminal text, and disable desktop mouse-drag scrolling in shared Lynx page config.

## 0.0.6

### Patch Changes

- 4d8393b: Upgrade the Lynxtron runtime and companion toolchain to 0.0.10 to avoid shutdown task-runner teardown crashes, keep generated workspaces on the same runtime, and contain native Scintilla scroll views during split resizing.

## 0.0.5

### Patch Changes

- dd950b6: Fix the fetch → install → build → run chain for showcases opened from the
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

- 0e3d212: Make a fetched showcase actually install and build.

  Two independent faults in the synthesized workspace under `~/.lynxtron-go`
  stopped every remote showcase — in the Fiddle and the IDE alike — before it
  could run.

  **The lockfile was frozen against manifests that move.** Every install the CLI
  spawns runs with `CI=true`, set so pnpm would not stop on an interactive purge
  prompt with no TTY. That flag carries a second meaning: pnpm also defaults
  `frozen-lockfile` to true in CI. The workspace's manifests are rewritten from
  the current catalog on every fetch, while its lockfile is a cache left by the
  previous one, so any catalog move made the next fetch die with
  `ERR_PNPM_OUTDATED_LOCKFILE` before installing anything. That is the inverse of
  a repo CI install — there the lockfile is the source of truth and must not
  drift, here it is a cache that has to follow the manifests. All three install
  sites now pass `--no-frozen-lockfile`. It has to be the flag: pnpm does not read
  `npm_config_frozen_lockfile` from the environment (checked against pnpm
  10.15.1).

  **Two toolchains coexisted in one tree.** The root pins
  `@lynxtron-examples/config` to `latest`, and a published config carries hard
  dependency ranges frozen at whatever the catalog was when it shipped. With the
  catalog ahead of the last publish, pnpm satisfied both: the new toolchain at the
  root, a nested old one under config — and the showcase's build resolved its
  plugin through config. Old plugin against new React is a crash, not a warning:

      TypeError: Cannot read properties of undefined (reading 'entries')
        at @lynx-js/react-rsbuild-plugin/dist/208.js

  The synthesized workspace is ours end to end, so there is one right version of
  each toolchain package — the one the showcase was built against. It is now
  declared as `pnpm.overrides`, which holds however far behind the published
  config drifts.

## 0.0.4

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.

## 0.0.3

### Patch Changes

- 9bf366a: Workspace `package.json` now sets `pnpm.onlyBuiltDependencies` for `@lynx-js/lynxtron`, `@lynx-js/lynxtron-builder`, `@lynx-js/lynxtron-rebuild`, `better-sqlite3`, and `sqlite3`. Without this, pnpm 10 silently skips the Lynxtron postinstall, `@lynx-js/lynxtron/dist` never lands, and downstream showcase builds fail with LNK1104 (`node.lib` missing, todolist/sqlite3) or CMake `Lynxtron Windows import library not found` (native-texture-canvas).

## 0.0.2

### Patch Changes

- c2fc749: Bump `@lynx-js/lynxtron` toolchain (lynxtron, lynxtron-builder, lynxtron-dev-plugins, lynx-library-headers, lynxtron-rebuild) from 0.0.5 to 0.0.7. No showcase runtime behavior changes; toolchain-only update to unblock native rebuilds on Python 3.13+.
