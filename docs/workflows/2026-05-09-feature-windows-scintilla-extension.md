# Workflow: Windows Scintilla Extension

## Goal

Enable the Lynxtron GO Scintilla native editor extension on Windows instead of treating it as a macOS-only optional capability.

## Artifact / Distribution / Runtime

- Artifact type: Lynxtron GO showcase with native Scintilla extension runtime files.
- Distribution type: source build and preview build consume `dist/desktop` plus the copied `lynxtron-scintilla-editor` runtime closure.
- Runtime path: `lynxtron-go/dist/desktop` launched by `@lynx-js/lynxtron@4.0.0-alpha.2-oss` on Windows.

## Plan

1. Split Scintilla CMake inputs by platform so Windows compiles the Win32 backend and macOS keeps Cocoa.
2. Add a Win32 `ScintillaView` backend that registers the Scintilla window class, creates a child HWND, mirrors Lynx layout, and maps existing N-API editor methods to Scintilla messages.
3. Link the Windows addon against Node and Lynxtron import libraries.
4. Keep runtime setup resilient: if native addon loading fails, Lynxtron GO should skip registration rather than crash.
5. Verify native build, GO build, runtime registration, and follow-up tests/preview build.

## Status

- Implemented.
- Native Windows addon build passes and produces `build/Release/lynx_scintilla_module.node`.
- Lynxtron GO build passes and copies the addon into `dist/desktop`.
- Lynxtron GO tests pass on Windows.
- `pnpm preview:build` passes and rebuilds the Windows native addon as part of the preview flow.
- Runtime launch smoke after preview build starts Lynxtron GO and logs `ScintillaEditor extension registered`.
- Open-file crash reproduced on Windows preview runtime and fixed:
  - N-API string reads now allocate room for the trailing null byte.
  - Win32 Scintilla content now queues safely until the child HWND exists.
  - Windows skips native ArrayBuffer style/indicator uploads because the PrimJS NativeModules bridge currently crashes on ArrayBuffer arguments.
- Deep-link preview smoke passed: `benchmark/lynx.config.ts` opened, `getText` returned 152 bytes, and `gotoLine` / `setSelection` / `scrollCaret` returned success.
- Windows editor black-screen repaint issue fixed by hosting Scintilla as an owned popup overlay, using conservative GDI/one-phase drawing settings, and forcing host/editor invalidation on size, show, focus, and content changes.
- User hands-on preview smoke passed after the repaint fix.
- Windows syntax highlighting and diagnostic indicators now avoid the PrimJS ArrayBuffer bridge crash by sending packed style/range bytes as base64 strings and decoding them in the native addon.
- Window drag/resize tracking is handled by hooking the owner HWND and repositioning the Scintilla overlay from the last Lynx layout rect whenever the main window moves, resizes, shows, or exits move/size.
- Remaining follow-up: keep an eye on very large-file highlight payload size on Windows; base64 is stable but larger than the original ArrayBuffer transport.
