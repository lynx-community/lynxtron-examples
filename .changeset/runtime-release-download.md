---
"lynxtron-go": patch
---

Download selectable Lynxtron runtimes directly as the platform release archive
(`lynxtron-v<version>-<platform>-<arch>-devtool.zip` from GitHub releases) and
unpack it flat into `<versionDir>/runtime/`, instead of fetching the
`@lynx-js/lynxtron` npm launcher package and reproducing its postinstall
download. The launch resolver now looks for the executable at that flat root
first (`lynxtron.exe` on Windows, `lynxtron.app/Contents/MacOS/lynxtron` on
macOS), keeping the older `dist/<variant>/` layout as a fallback. Run child
processes through `cross-spawn` so `npm`/`curl` resolve on Windows and a spawn
failure surfaces as an error instead of crashing. The top-bar version chip now
reflects the runtime that will actually launch (the selected local runtime,
falling back to bundled), and catalog rows for versions already present show a
passive `bundled`/`downloaded` status rather than an actionable Download button.
