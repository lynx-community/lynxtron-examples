# Match Scintilla overscroll background to the editor

## Product intent

Keep the macOS editor visually continuous while the user pulls past the top edge. The temporary rubber-band area must use the active editor theme background instead of the native scroll view's default background.

## Scope

- Artifact type: Lynxtron GO showcase with a macOS native Scintilla extension.
- Distribution type: workspace source build used by `pnpm preview`.
- Runtime path: `lynxtron-go/scintilla-extension` on macOS Cocoa.
- Fix the background exposed by vertical elastic overscroll.
- Keep the color synchronized with both the compiled-in default theme and `ApplyTheme` dark/light changes.
- Implement in the Lynxtron-owned adapter; do not add this product-specific behavior to vendored Scintilla.
- Do not change Windows behavior or disable native rubber-band scrolling.

## Root cause

Scintilla paints the document background itself, but elastic overscroll temporarily exposes the enclosing `NSScrollView` / `NSClipView`. Those native views retain their default AppKit background instead of the Scintilla `STYLE_DEFAULT` color, so the pulled-open area does not match the editor.

## Acceptance criteria

1. Pulling down past the first line reveals the same color as the active editor content background.
2. The background follows both dark and light theme changes.
3. Continuous partial-line scrolling from the preceding fix remains enabled.
4. No vendored Scintilla or Windows source is changed by this task.
5. The native extension and Lynxtron GO desktop bundle build successfully.
6. A runtime smoke check confirms the Scintilla extension registers and the editor remains usable.

## Verification notes

- `pnpm --dir lynxtron-go run build:scintilla-extension` passed.
- `pnpm --dir lynxtron-go exec rspack build` passed with the two existing dynamic-`require` warnings.
- The built module contains `-[LynxtronScintillaView syncBounceBackgroundWithStyleDefault]`, and the build output matches the copy under `dist/desktop` by SHA-256.
- `run-dev` restarted successfully and registered the Scintilla editor extension.
- Switching Settings → Appearance from Dark to Light and back updated every native editor immediately, exercising both `ApplyTheme` background synchronization branches; the original Dark setting was restored afterwards.
- AppKit did not enter physical trackpad rubber-band state from synthesized `CGEvent` scroll phases, so the exact peak-frame visual assertion still requires a real trackpad gesture. The native container colors are nevertheless derived from the same live `STYLE_DEFAULT` value exposed during that state.
- For parallel GUI verification, launch with `LYNXTRON_ALLOW_MULTI=1` to skip the singleton lock and avoid interfering with another Lynxtron GO instance.
