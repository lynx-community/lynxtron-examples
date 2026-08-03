---
'@lynxtron-examples/benchmark': patch
'@lynxtron-examples/counter': patch
'@lynxtron-examples/electron-fiddles': patch
'@lynxtron-examples/floating-clock': patch
'@lynxtron-examples/system-monitor': patch
'@lynxtron-examples/todolist': patch
---

Migrate every showcase from the deprecated per-window `win.on('-lynx-invoke')`
and `win.on('-lynx-message')` listeners to the process-global `lynxBridge.handle()`
and `lynxBridge.on()` API.

Each showcase's dispatch switch is split into per-method handlers, and
registration is hoisted to `app.whenReady()` so windows that reopen (e.g. the
gallery's `activate` handler, the benchmark's second window) do not
re-register the same handler.
