# Clip Scintilla margin painting to the editor viewport

## Product intent

Keep the existing pixel-smooth macOS editor scrolling while preventing line
numbers from being painted below the editor into the bottom panel.

## Scope

- Artifact type: Lynxtron GO showcase with a macOS native Scintilla extension.
- Distribution type: workspace source build used by `pnpm preview`.
- Runtime path: `lynxtron-go/scintilla-extension` on macOS Cocoa.
- Restrict the Scintilla margin dirty rectangle and graphics context to the
  visible content viewport before painting line numbers.
- Preserve partially visible first and last lines introduced by the existing
  Lynxtron-owned smooth-scroll content view.
- Do not alter the Windows implementation.
- Preserve all unrelated user changes in the dirty worktree.

## Root cause

`SCIMarginView` is a separate `NSRulerView`. Its Cocoa drawing path expands a
partial invalidation to the full ruler bounds when the ruler is taller than the
content viewport. Scintilla then paints the last partial line with an unclipped
text operation, so its line number can cross the editor's lower boundary.

## Acceptance criteria

1. Margin painting cannot draw below `scrollView.contentView.bounds`.
2. Pixel-level vertical scrolling remains enabled and partial lines remain
   supported.
3. The legacy oversized ruler invalidation cannot expand the Scintilla margin
   paint rectangle beyond the visible content viewport.
4. The macOS Scintilla extension builds successfully.
5. A running Lynxtron GO editor is smoke-tested by scrolling a long file near
   the editor's lower edge; no line-number glyph appears in the bottom panel.
6. Windows code and unrelated worktree changes remain untouched.

## Verification notes

- Run `pnpm --dir lynxtron-go run build:scintilla-extension`.
- Relaunch the preview so it loads the rebuilt native extension.
- Capture or inspect the editor after a partial-line vertical scroll.
- Record any runtime automation limitation explicitly.

## Verification result

- `pnpm --dir lynxtron-go run build:scintilla-extension` passed and rebuilt
  `ScintillaView.mm`, `libscintilla.a`, and `lynx_scintilla_module.node`.
- `pnpm --dir lynxtron-go run build` passed; Rspeedy reported only the
  pre-existing unsupported-CSS warnings and Rspack reported the two existing
  dynamic-require warnings.
- Relaunched `dist/desktop` after quitting the stale singleton instance, so the
  running app loaded the rebuilt native module.
- Scrolled the long `src/app/App.css` editor and inspected the native macOS
  window: line numbers stayed inside the editor boundary and no glyph appeared
  in the Console panel.
- Lynx DevTool remained useful for session discovery, while Computer Use was
  required for the final visual check because DevTool screenshots do not
  reliably include native Scintilla subviews.
- `pnpm --dir lynxtron-go test` completed with 183/184 tests passing. The one
  failure is the unrelated, repeatable
  `TypeScriptLanguageService > treats lynxtron-go desktop host sources as a
  Node environment` assertion, which currently receives three diagnostics at
  `src/extension-host/__tests__/typescript.test.ts:393`.
