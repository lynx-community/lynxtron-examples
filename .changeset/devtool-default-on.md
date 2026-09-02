---
"lynxtron-go": patch
"@lynxtron-examples/benchmark": patch
"@lynxtron-examples/codex-demo": patch
"@lynxtron-examples/counter": patch
"@lynxtron-examples/cross-platform-notes": patch
"@lynxtron-examples/electron-fiddles": patch
"@lynxtron-examples/file-explorer": patch
"@lynxtron-examples/floating-clock": patch
"@lynxtron-examples/hello-lynxtron": patch
"@lynxtron-examples/native-texture-canvas": patch
"@lynxtron-examples/pc-mouse-cursor": patch
"@lynxtron-examples/system-monitor": patch
"@lynxtron-examples/todolist": patch
---

Enable Lynxtron devtool by default in every showcase host and in Lynxtron GO. Previously only codex-demo turned it on and only behind an env flag, so debugging any other showcase required rebuilding after flipping a manual switch. Now `devtool.setDevToolEnabled(true)` runs on `whenReady` in every host; failure is caught and logged so a runtime without devtool support still boots.
