---
"@lynxtron-examples/todolist": patch
---

Wrap the todolist `postinstall` in a small `scripts/rebuild-native.js` that runs `lynxtron-rebuild` and, on Windows only, seeds `<headersDir>/Release/node.lib` and `Debug/node.lib` from `@lynx-js/lynxtron`'s `dist/release/lynxtron.dll.lib` before retrying. `@lynx-js/lynxtron@0.0.19-alpha.1` moved the runtime import library into per-variant sub-directories, but `@lynx-js/lynxtron-rebuild@0.0.19-alpha.1` still reads the legacy `dist/lynxtron.dll.lib` path and silently no-ops when it is missing, so node-gyp linking sqlite3 failed on Windows with `LNK1181: cannot open input file ... node.lib`. macOS and Linux paths are unchanged.
