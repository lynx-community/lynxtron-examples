---
"lynxtron-go": patch
---

- Move `@lynx-js/lynxtron` from `devDependencies` to `dependencies` so `electron-builder` (via the `lynxtron-builder` patch that uses the app's own `package.json#dependencies` as the app.asar allowlist) actually includes it in the packaged app. Fixes `Cannot find module '@lynx-js/lynxtron'` at showcase-run time.
- Rename the deep link URL scheme from `lynxtron://` to `lynxtron-go://` to avoid overlapping with the underlying `@lynx-js/lynxtron` runtime namespace. Covers the shared scheme constant, macOS `CFBundleURLSchemes`, in-app help page, and tests.
- Add `lynxtron-go://open?url=<bundle-url>` as a short alias for `lynxtron-go://lynxview_page?bundle=<bundle-url>` so external tools can hand out a shorter deep link when previewing a hosted `.lynx.bundle`. Both hosts accept `url=` and `bundle=` interchangeably and enforce the same http(s)-only guard.
