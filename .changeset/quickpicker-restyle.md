---
'lynxtron-go': patch
---

Restyle the Cmd+P palette to the app's own design language and layer it on top.

It was the last surface still painted in hardcoded VS Code greys (`#252526`,
`#3c3c3c`, `#007aff`), so it read as a different product from the Fiddle home
and the showcase gallery beside it. It now uses the theme variables the rest of
the app uses, which also means it follows the light theme instead of ignoring it.

- **Layering.** The overlay had no `z-index` at all and could fall behind the
  gallery overlay (300) and the Fiddle's dialogs (100/200). It is now 400.
  z-index alone is not sufficient against the native Scintilla editors, which
  paint above all Lynx UI — that was already handled, since App.tsx passes
  `overlayActive` while the palette is open so the Fiddle detaches them.
- **Rows** are padded rather than a fixed 44px; a showcase row carries a name, a
  description and tags, and the fixed height clipped them.
- **Monospace only for data** — paths and accelerators, not showcase prose.
  Accelerators moved to a trailing key chip, the way a real menu shows them.
- **Enter's target is now visible.** `Enter` has always activated the first
  result; nothing said so. The first row is highlighted and a footer names the
  three behaviours (`Enter`, `>` for commands, `Esc`).
