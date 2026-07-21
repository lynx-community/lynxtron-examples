# Disable Scintilla vertical line scroll snapping

## Product intent

Make trackpad and mouse-wheel scrolling in Lynxtron GO code editors feel continuous. A partially visible first or last line is acceptable; the viewport must not jump to the nearest whole line.

## Scope

- Artifact type: Lynxtron GO showcase with a macOS native Scintilla extension.
- Distribution type: workspace source build used by `pnpm preview`.
- Runtime path: `lynxtron-go/scintilla-extension` on macOS Cocoa.
- Disable only vertical whole-line snapping performed by `SCIContentView.adjustScroll:`.
- Preserve horizontal whole-point rounding used to avoid Retina drawing debris.
- Prefer a Lynxtron-owned subclass/adapter in `module/scintilla_view.mm`; do not modify vendored files under `scintilla-extension/scintilla/` when the existing `contentViewClass` extension point is sufficient.
- Do not change Windows behavior.

## Root cause

Vendored Cocoa `SCIContentView.adjustScroll:` rounds `proposedVisibleRect.origin.y` to the nearest multiple of `TextHeight`. This converts smooth pixel scrolling into line-sized jumps and feels sticky.

## Acceptance criteria

1. macOS vertical scrolling accepts fractional/partial-line `origin.y` values without rounding to line height.
2. Horizontal scrolling retains whole-point rounding for interior document positions.
3. Existing Scintilla content, styling, selection, and editor registration behavior remains unchanged.
4. No generated output, build directory, or `node_modules` change is committed.
5. `pnpm --dir lynxtron-go run build:scintilla-extension` succeeds.
6. The narrowest practical Lynxtron GO build or runtime smoke check succeeds and is reported.

## Verification notes

- `pnpm --dir lynxtron-go run build:scintilla-extension` passed.
- `pnpm --dir lynxtron-go exec rspack build` passed with the two existing dynamic-`require` warnings.
- `pnpm preview` rebuilt the native module and launched Lynxtron GO successfully; the host registered the Scintilla editor extension.
- The built module contains `LynxtronSCIContentView` / `LynxtronScintillaView`, and the build output matches the copy under `dist/desktop` by SHA-256.
- Runtime smoke test used 5-pixel scroll-wheel events on a file longer than one viewport. The viewport retained partial-line offsets instead of snapping to a whole line.
