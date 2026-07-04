# Lynxtron Framework Issues

Issues encountered during Lynxtron GO development that need to be addressed in the Lynxtron framework itself.

## JS Runtime

### mac app bundle shipped minimized ICU data, breaking `localeCompare` / `Intl.Collator` in run-as-node
- Symptom:
  - `String.prototype.localeCompare(...)` and `new Intl.Collator(...)` threw `RangeError: Internal error. Icu error.`
  - Lynxtron GO extension host could crash while opening desktop host files, because TypeScript project discovery used `localeCompare(..., { numeric: true })`
- Root cause:
  - mac app bundle packaged `third_party/icu/flutter/icudtl.dat` into `Contents/Resources`
  - framework bundle did not also carry `Resources/icudtl.dat`
  - runtime had ICU version metadata, but collation data was missing from the packaged data file
- Local framework fix:
  - repo: `/Users/bytedance/ws2/lynxtron_oss_ws/lynxtron`
  - commit: `c20cf1b`
  - change: bundle generated full `icudtl.dat` for mac app / framework resources and wire `//third_party/icu:icudata` as the dependency source
- Status:
  - resolved locally and verified by replacing the packaged binary in `node_modules`
  - still needs rollout into an official `@lynx-js/lynxtron` package version before downstream repos can stop manual binary replacement

### TDZ (Temporal Dead Zone) enforcement too strict
- `useCallback` declared after a `useEffect` that references it causes crash
- Browsers tolerate this (hoisting), Lynx engine does not
- Impact: silent crash with no useful error, hard to diagnose

### Preload runtime capability issues must be verified against a real Release binary
- `preload.ts` in current Lynxtron should be treated as standard Node.js plus Lynxtron bridge APIs
- Previous `TextEncoder` / `TextDecoder` failures observed during GO development are no longer tracked as confirmed framework gaps
- Before filing future runtime capability issues, verify with the local Release binary and the current built `dist/desktop` to avoid stale-build or mixed-runtime false positives

### Error messages not readable in production bundles
- `loadCard failed ReferenceError: Cannot access 'eu' before initialization`
- Minified variable names, no source map support in Lynx runtime
- Developers must disable minification and rebuild to diagnose
- Framework should support source map consumption for error reporting

## HMR / Dev Experience

### HMR not working
- `loadURL('http://localhost:3000/...')` dev server mode does not hot-reload on CSS/JS changes
- App must be fully restarted for any change
- Blocks fast iteration during UI development

### DevTool MCP instability
- `DOM_querySelector`, `Page_takeScreenshot` frequently timeout/abort
- Connection drops intermittently
- Limits ability to use MCP for automated testing and debugging

### No `Runtime.evaluate`
- Cannot execute arbitrary JS at runtime via DevTool protocol
- Only way to test is pre-embedding `globalThis.__xxx` functions
- Standard Chrome DevTools Protocol includes `Runtime.evaluate`

## Type System / Package Exports

### `@lynx-js/lynxtron` root export does not expose types under `exports`
- Package `package.json` contains `"types": "./apis/lynxtron.d.ts"`
- But root `exports` only maps `"."` to `"./lynxtron.js"` without a `types` condition
- Under `moduleResolution: bundler` or other export-aware resolution, TypeScript reports the root import as having no declaration file
- Impact:
  - desktop host files in Lynxtron GO / showcases can receive false-positive diagnostics for `import { app, LynxWindow } from '@lynx-js/lynxtron'`
  - IDE diagnostics cannot fully align with runtime semantics even when local tsconfig is otherwise correct
- Preferred framework fix:
  - add a typed root export for `"."`, or
  - expose subpath exports with proper `types` entries consistent with the runtime entry points

## Rendering

## Packaging / Distribution

### Framework binary duplicated 3x during zip extraction
- `Lynxtron Framework.framework` contains 3 copies of the same 58MB binary (different inodes, same md5)
- Should be symlinks per macOS framework convention: `Versions/Current → 1.0`, top-level `Lynxtron Framework → Versions/Current/...`
- `extract-zip` in `install.js` expands symlinks into real copies
- Impact: 176MB on disk instead of ~60MB (3x bloat)
- Fix: preserve symlinks during zip extraction, or use `tar.gz` instead of `.zip`

## Rendering

### Nested `<text>` character boundary offset
- Multi-level nested `<text>` elements have a 1-character rendering offset
- Example: `<text>abc<text className="highlight">def</text>ghi</text>` — "def" highlight shifts by 1 char
- Workaround: flatten text structure, use `<view>` layout instead of nested `<text>`

## Upgrade TODOs

### Upgrade Rspeedy / React Rsbuild Plugin for `alignMouseEventWithW3C`
- Current local toolchain does not officially expose `alignMouseEventWithW3C` in `pluginReactLynx` options
- During `pc-mouse-cursor` validation, the field only worked after a local `node_modules` patch to `@lynx-js/react-rsbuild-plugin` and `@lynx-js/template-webpack-plugin`
- TODO: upgrade to a published toolchain version that officially supports `alignMouseEventWithW3C`, then remove the local patch path and keep the showcase on standard config only

### Upgrade Lynxtron runtime to eliminate historical TextEncoder/TextDecoder confusion
- Example Artifact debugging previously encountered inconsistent `TextEncoder` / `TextDecoder` behavior across stale binaries and mixed build/runtime states
- Current project baseline treats `preload.ts` as standard Node.js plus Lynxtron APIs, but this should be reinforced by upgrading to a newer Lynxtron runtime and re-verifying the example artifact chain
- TODO: upgrade Lynxtron, then re-run the Example Artifact smoke path to confirm no lingering encoder/decoder regressions remain
