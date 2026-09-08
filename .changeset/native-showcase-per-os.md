---
"@lynxtron-examples/cli": patch
"lynxtron-go": patch
---

Publish per-OS variants of native showcase tarballs (`-mac.tgz` / `-win.tgz`) and bake the matching platform URL into each installer, so Windows users get Windows `.node` builds and macOS users get macOS `.node` builds instead of sharing whichever runner packed first.
