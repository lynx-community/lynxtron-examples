---
"lynxtron-go": patch
---

Bump `@lynx-js/lynxtron` and its sibling packages (`lynxtron-builder`, `lynxtron-dev-plugins`, `lynx-library-headers`, `lynxtron-rebuild`) in the workspace catalog to `0.0.20`, and adapt the host runtime resolver to the new install layout (`dist/<variant>/lynxtron.app/Contents/MacOS/lynxtron` on macOS, `dist/<variant>/lynxtron.exe` on Windows, where variant is `devtool` or `release`) which replaces the old `dist/<platform>/<arch>/` layout. Route platform overlay input through the aggregated `eventThrough` so toaster/dialog/alert close buttons can be tapped again, enable the DevTool on app ready, and switch the `build:cli` / `build:scintilla-extension` scripts to `npm --prefix` so they run from the packed tarball where pnpm is not present.
