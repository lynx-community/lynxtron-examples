# @lynxtron-examples/native-texture-canvas

## 0.0.6

### Patch Changes

- ebf8dee: Fix Windows release builds of the native texture canvas showcase by keeping CMake intermediates outside pnpm's deep package directory. Preserve the AutoLink artifact location and verify the staged binary matches the compiled dependency. Bump Go so the corrected Windows showcase artifacts are included in the next installer release.

## 0.0.5

### Patch Changes

- 9487e4a: Upgrade the shared Lynxtron toolchain to 0.0.22. Migrate Native Texture Canvas
  to target-based AutoLink registration and staging for development and release
  builds, while keeping the Go preview declaration aligned with staged artifacts.

## 0.0.4

### Patch Changes

- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.

## 0.0.3

### Patch Changes

- a83210a: Allow trusted remote showcase bundles to declare, verify, and load native extensions after user confirmation.

## 0.0.2

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.
