---
"@lynxtron-examples/cli": patch
"lynxtron-go": patch
---

Workspace `package.json` now sets `pnpm.onlyBuiltDependencies` for `@lynx-js/lynxtron`, `@lynx-js/lynxtron-builder`, `@lynx-js/lynxtron-rebuild`, `better-sqlite3`, and `sqlite3`. Without this, pnpm 10 silently skips the Lynxtron postinstall, `@lynx-js/lynxtron/dist` never lands, and downstream showcase builds fail with LNK1104 (`node.lib` missing, todolist/sqlite3) or CMake `Lynxtron Windows import library not found` (native-texture-canvas).
