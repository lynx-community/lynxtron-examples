# Prevent Scintilla first-frame theme flash

## Scope

- Artifact type: Lynxtron GO showcase with a macOS native Scintilla extension.
- Distribution type: workspace source build consumed through `dist/desktop` / `pnpm preview`.
- Runtime path: `lynxtron-go/scintilla-extension/module/scintilla_view.mm` on macOS Cocoa.
- Keep the native editor on its configured background and font size from its first visible frame.
- Do not change Windows or vendored Scintilla sources.

## Reproduction

Hide a visible Fiddle editor pane, start a 60 fps screen recording, then reopen the same file from the sidebar. Before the fix, recorded frames show this sequence:

1. the pane toolbar appears over a black native canvas;
2. the first line number appears on the black canvas at the compiled default size;
3. the canvas switches to the Fiddle theme background and configured 13pt size.

## Root cause

The macOS constructor enqueues compiled default styling with `dispatch_async`. If properties arrive on the main thread, `ApplyTheme` runs first, then the queued constructor defaults overwrite it with the 14pt fallback. The editor can attach and paint that intermediate state until the JS post-mount theme call corrects it. Off-main `ApplyTheme` is also asynchronous, so layout attachment is not guaranteed to wait for theme application.

## Implementation

- Run the constructor's Scintilla default setup inline on the main thread, or synchronously dispatch it there when construction starts off-main.
- Apply `theme-dark` and `font-size` synchronously on the main thread before returning from `ApplyTheme`.
- Leave the existing palette, continuous scrolling, and overscroll background behavior unchanged.

## Verification

- Captured the failure before the change at 60 fps: the new Preload pane painted a black canvas, then a large line number, and only afterward changed to the configured background and font size.
- Rebuilt `lynxtron-scintilla-editor`, then rebuilt the desktop bundle. The source build and copied `dist/desktop` native modules both have SHA-256 `412e18115ea2cec90c88381aaeaad8301644aefd0cb7a134e4e13fee0a3d030f`.
- Restarted the source runtime with `LYNXTRON_ALLOW_MULTI=1` and captured the same close/reopen interaction at 120 fps. The Preload pane's first visible frame already has the configured background and 13pt text; subsequent frames show no background or font-size transition.

## Windows follow-up

Windows remains to be fixed and verified on a Windows runtime. Its implementation has a different ordering bug with the same likely visual result: `OnPropertiesChanged` may receive `theme-dark` and `font-size` before the Scintilla `HWND` exists, but `ApplyTheme` returns without caching them. `OnLayoutChanged` later creates a visible control with the hard-coded dark 14pt defaults, so a later JS theme call can still cause a background and font-size jump. The Windows fix should cache theme properties before the `HWND` exists, create the control hidden, apply the cached theme after `ConfigureScintilla`, and only then reveal it.

## Acceptance criteria

1. Constructor defaults are fully installed before the native element can receive theme properties.
2. `theme-dark` and `font-size` property application completes before `OnPropertiesChanged` returns.
3. Reopening a pane shows no black frame and no visible font-size jump.
4. Existing continuous scrolling and overscroll background synchronization remain unchanged.
5. The native extension and desktop bundle build successfully.
