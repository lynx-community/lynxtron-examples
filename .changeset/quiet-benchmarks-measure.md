---
"@lynxtron-examples/benchmark": patch
---

Replace the misleading installed app size metric with the latest stable Lynxtron release ZIP download size for the current platform and architecture, fetched from GitHub asset metadata without downloading the archive or scanning disk. Exclude devtool, debug symbols and CEF; label the compressed runtime metric separately from installed app size.

Measure Lynx FCP from OS process creation to the initial main window's synchronous loadFile return on the main thread, not an on-first-screen callback or actual screen presentation.

Defer memory sampling until one second after the UI receives the loadFile-completion result so synchronous OS sampling does not delay startup.
