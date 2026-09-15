---
"@lynxtron-examples/benchmark": patch
---

Replace the misleading installed app size metric with the latest stable Lynxtron release ZIP download size for the current platform and architecture, fetched from GitHub asset metadata without downloading the archive or scanning disk. Exclude devtool, debug symbols and CEF; label the compressed runtime metric separately from installed app size.

Measure startup from OS process creation to the main window's first-screen layout event instead of from preload execution to a UI bridge call.

Defer memory sampling until one second after the UI receives the first-screen result so synchronous OS sampling does not delay startup.
