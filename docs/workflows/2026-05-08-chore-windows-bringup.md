# Windows Bring-Up Workflow

## Product Intent

Bring the existing Lynxtron Showcases preview path closer to first-class Windows support by running the repository on Windows, recording each blocker, and fixing scoped repo-side portability gaps as they are discovered.

This is infrastructure bring-up for the product plan's "Cross platforms" story. It does not change showcase product UI or the core showcase distribution model.

## Artifact / Distribution / Runtime

- Artifact type: full Lynxtron showcases, including Lynx UI bundles plus `dist/desktop` host artifacts.
- Distribution type: local preview distribution, using packed showcase tarballs and the local registry path used by `pnpm preview`.
- Runtime path: `dist/desktop` launched through the `@lynx-js/lynxtron` runtime binary.

## Initial Windows Findings

- `pnpm preview:build` invokes `bash scripts/preview.sh --no-launch`; on this Windows machine `bash` resolves to WSL's `C:\Windows\System32\bash.exe`, and no WSL distro is installed.
- Running the preview script with Git Bash gets past the shell entrypoint and successfully builds/packs the individual showcases.
- `@lynx-js/lynxtron@3.9.1-alpha.0-oss` postinstall fails on Windows because the runtime binary URL returns `404 Not Found`.
- No existing `lynxtron.exe` or runtime zip was found in the repo, PATH, pnpm store, or common user install locations during the initial bring-up attempt.
- `lynxtron-go/scintilla-extension` currently compiles Cocoa Objective-C++ files on Windows and fails under MSVC. This blocks the Lynxtron GO preview build before launch.

## Scope

1. Make the preview/build entrypoints usable on Windows without depending on WSL-specific `bash`.
2. Add Windows-safe handling for Lynxtron GO's native Scintilla extension so the GO app can build far enough to validate the desktop host path.
3. Keep runtime binary acquisition explicit. If the official runtime URL remains unavailable, record the blocker and support a documented local/custom runtime input rather than hiding the failure.

## Non-Goals

- Do not rewrite the preview distribution model.
- Do not replace Lynxtron runtime with Electron or a browser runtime.
- Do not implement a full Windows native Scintilla view in this step unless the current build path requires it.
- Do not commit `node_modules`, generated tarballs, build output, or vendored artifacts.

## Verification Plan

- `pnpm --filter @lynxtron-showcases/config --filter @lynxtron-showcases/cli run build`
- Windows preview build entrypoint, without WSL.
- `pnpm --dir lynxtron-go run build` or the preview build step that covers Lynxtron GO.
- If a valid Windows runtime binary is available: launch `lynxtron-go/dist/desktop` through the runtime and record smoke results.
- If runtime acquisition remains blocked: record the exact URL/configuration blocker and keep the task open rather than marking Windows launch complete.

## Status

- In progress.
- Initial blockers reproduced on Windows on 2026-05-08.
- `pnpm preview:build` now passes on Windows without WSL after switching the preview entrypoint to the Node runner.
- Lynxtron GO build now passes on Windows by treating the Scintilla native editor extension as a macOS-only optional native capability.
- Lynxtron runtime baseline was moved to `4.0.0-alpha.2-oss` after confirming the `4.0.0-alpha.3.oss` Windows runtime artifact was missing.
- `pnpm install` now downloads and extracts `lynxtron-v4.0.0-alpha.2-oss-win32-x64.zip` successfully.
- Direct launch after preview build now starts Lynxtron GO on Windows; runtime logs include `LynxWindow created`.
- Windows Scintilla native editor support remains intentionally skipped; GO starts with the native editor extension disabled on Windows.
