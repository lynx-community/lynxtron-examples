---
"@lynxtron-examples/benchmark": patch
---

Replace the misleading installed app size metric with the latest stable Lynxtron release ZIP download size for the current platform and architecture, fetched from GitHub asset metadata without downloading the archive or scanning disk. Exclude devtool, debug symbols and CEF; label the compressed runtime metric separately from installed app size.

Measure Lynx FCP from OS process creation to the initial main window's loadFile return. In the Lynx architecture, loadFile synchronously executes both frontend code and on-screen rendering operations on the main thread, so its return marks completion of those operations rather than merely scheduling an asynchronous render. No separate on-first-screen callback is used.

Defer memory sampling until one second after the UI receives the loadFile-completion result so synchronous OS sampling does not delay startup.
