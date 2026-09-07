---
"@lynxtron-examples/todolist": patch
---

Patch `@lynx-js/lynxtron-rebuild@0.0.19-alpha.1` so its Windows `node.lib` seeding also looks under `dist/release/` and `dist/devtool/`. `@lynx-js/lynxtron@0.0.19-alpha.1` moved the runtime into per-variant sub-directories, but `lynxtron-rebuild` still read the legacy `dist/lynxtron.dll.lib` path. On Windows that silently skipped seeding, so `node-gyp` linking sqlite3 hit `LNK1181: cannot open input file ... node.lib` and the postinstall of every showcase with a native addon failed. The patch keeps the old path as a fallback for compatibility with older runtimes.
