# @lynxtron-examples/codex-demo

## 0.0.2

### Patch Changes

- c6e04b4: Fix cover-view overlays so they composite above the native surface and stop blocking input. QuickPicker, dialogs, toaster, tooltips and loading overlays now route through the single platform overlay host above the native cover-view, and an event-through path lets purely visual overlays pass input through to the layers beneath them. Bumps lynxtron and related packages to 0.0.17-dev, including the lynxtron-rebuild headers patch the version needs on Windows.
- c6e04b4: Stop baking the build machine's absolute `import.meta.url` into the packaged host bundle. The `@lynx-js/lynxtron` ESM shim calls `createRequire(import.meta.url)`, which rspack inlined as a build-time `file://` path (e.g. a macOS CI runner path) and crashed the app with `ERR_INVALID_ARG_VALUE` when the showcase was installed on another machine or OS. Define `import.meta.url` as `__filename` (desktop target only) so the require base resolves to the shipped `main.js` at runtime.
