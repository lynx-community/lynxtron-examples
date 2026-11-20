---
'lynxtron-go': patch
---

Keep the Run button in its loading state through the launch call. `runProject` builds the workspace before it returns a pid, so the header used to switch back to "Run" while a click was still ignored or would start a second launch. The button now stays "Loading…" and disabled until the run actually starts, and becomes clickable the moment "Run" appears.

This release also picks up `@lynxtron-examples/system-webview` in the showcase catalog, so `lynxtron-go://showcase/open?id=@lynxtron-examples/system-webview` resolves once the matching showcase artifacts are published.
