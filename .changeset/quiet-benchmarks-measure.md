---
"@lynxtron-examples/benchmark": patch
---

Remove the misleading app size metric and its filesystem scanning. A showcase running inside Lynxtron Go shares the host runtime and cannot report a standalone application size.

Measure startup from OS process creation to the main window's first-screen layout event instead of from preload execution to a UI bridge call.

Defer memory sampling until one second after the UI receives the first-screen result so synchronous OS sampling does not delay startup.
