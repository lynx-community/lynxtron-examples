# lynxtron-go

## 0.0.8

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.
- Updated dependencies [9f330d3]
  - @lynxtron-examples/cli@0.0.4

## 0.0.7

### Patch Changes

- 9bf366a: Workspace `package.json` now sets `pnpm.onlyBuiltDependencies` for `@lynx-js/lynxtron`, `@lynx-js/lynxtron-builder`, `@lynx-js/lynxtron-rebuild`, `better-sqlite3`, and `sqlite3`. Without this, pnpm 10 silently skips the Lynxtron postinstall, `@lynx-js/lynxtron/dist` never lands, and downstream showcase builds fail with LNK1104 (`node.lib` missing, todolist/sqlite3) or CMake `Lynxtron Windows import library not found` (native-texture-canvas).
- Updated dependencies [9bf366a]
  - @lynxtron-examples/cli@0.0.3

## 0.0.6

Direct version bump from 0.0.3 to align the release-installers tag naming
scheme (`lynxtron-go-v<version>`) with the intended installer track;
0.0.4 and 0.0.5 are intentionally skipped and will not be released.

## 0.0.3

### Patch Changes

- a3096be: - Move `@lynx-js/lynxtron` from `devDependencies` to `dependencies` so `electron-builder` (via the `lynxtron-builder` patch that uses the app's own `package.json#dependencies` as the app.asar allowlist) actually includes it in the packaged app. Fixes `Cannot find module '@lynx-js/lynxtron'` at showcase-run time.
  - Rename the deep link URL scheme from `lynxtron://` to `lynxtron-go://` to avoid overlapping with the underlying `@lynx-js/lynxtron` runtime namespace. Covers the shared scheme constant, macOS `CFBundleURLSchemes`, in-app help page, and tests.
  - Add `lynxtron-go://open?url=<bundle-url>` as a short alias for `lynxtron-go://lynxview_page?bundle=<bundle-url>` so external tools can hand out a shorter deep link when previewing a hosted `.lynx.bundle`. Both hosts accept `url=` and `bundle=` interchangeably and enforce the same http(s)-only guard.

## 0.0.2

### Patch Changes

- c2fc749: Bump `@lynx-js/lynxtron` toolchain (lynxtron, lynxtron-builder, lynxtron-dev-plugins, lynx-library-headers, lynxtron-rebuild) from 0.0.5 to 0.0.7. No showcase runtime behavior changes; toolchain-only update to unblock native rebuilds on Python 3.13+.
- Updated dependencies [c2fc749]
  - @lynxtron-examples/cli@0.0.2
