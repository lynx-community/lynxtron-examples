---
"lynxtron-go": patch
---

Recognise the upstream `@lynx-js/lynxtron-builder@0.0.19-alpha.1` layout in `scripts/ensure-builder-patches.js`. The new `cli.js` already resolves `@lynx-js/lynxtron` from the project root inside `getLynxtronPackage()` and no longer contains the single-line `require.resolve('@lynx-js/lynxtron', ...)` the patcher was matching against, so the script was throwing "Unable to patch lynxtron-builder package resolution" during pack. Skip that patch when the new helper is present.
