# @lynxtron-examples/cli

## 0.0.3

### Patch Changes

- 9bf366a: Workspace `package.json` now sets `pnpm.onlyBuiltDependencies` for `@lynx-js/lynxtron`, `@lynx-js/lynxtron-builder`, `@lynx-js/lynxtron-rebuild`, `better-sqlite3`, and `sqlite3`. Without this, pnpm 10 silently skips the Lynxtron postinstall, `@lynx-js/lynxtron/dist` never lands, and downstream showcase builds fail with LNK1104 (`node.lib` missing, todolist/sqlite3) or CMake `Lynxtron Windows import library not found` (native-texture-canvas).

## 0.0.2

### Patch Changes

- c2fc749: Bump `@lynx-js/lynxtron` toolchain (lynxtron, lynxtron-builder, lynxtron-dev-plugins, lynx-library-headers, lynxtron-rebuild) from 0.0.5 to 0.0.7. No showcase runtime behavior changes; toolchain-only update to unblock native rebuilds on Python 3.13+.
