---
'lynxtron-go': patch
---

Make Cmd+P actually search the workspace, add Cmd+K, and restyle the palette to
the app's own design language with keyboard navigation.

**Cmd+P could not really search files.** Its pool was the *sidebar's* model:
`openFolder` loads the root's direct children, and a directory's contents load
only when the user expands it. A showcase keeps its source under `src/`, which
is collapsed on open — so `App.tsx`, `index.tsx` and everything else real was
invisible, and only the handful of root-level files were findable. The palette
now indexes the workspace itself, walking it breadth-first a few directories per
tick so the synchronous filesystem bridge does not stall the UI. With a full
index, ordering matters: matches rank name-exact > name-prefix > name-substring
> path-substring, and the list is capped at 200 rows.

**Cmd+K** opens the same palette with `>` already typed — literally "Cmd+P then
type `>`". The mode still derives from the prefix, so backspacing the `>` falls
back to file search exactly as it does when typed by hand.

It was the last surface still painted in hardcoded VS Code greys (`#252526`,
`#3c3c3c`, `#007aff`), so it read as a different product from the Fiddle home
and the showcase gallery beside it. It now uses the theme variables the rest of
the app uses, which also means it follows the light theme instead of ignoring it.

- **Keyboard navigation**, modelled on cmdk: `↑`/`↓` move the selection and wrap
  at the ends, `Home`/`End` jump, `Enter` activates the *selected* row rather
  than always the first, and `Esc` closes. The selection is tracked by row key,
  not index, so narrowing the query keeps the same row selected instead of
  sliding the highlight onto whatever now sits in that position. Hover moves it
  too, so pointer and keyboard never disagree.
- **Layering.** The overlay had no `z-index` at all and could fall behind the
  gallery overlay (300) and the Fiddle's dialogs (100/200). It is now 400.
  z-index alone is not sufficient against the native Scintilla editors, which
  paint above all Lynx UI — that was already handled, since App.tsx passes
  `overlayActive` while the palette is open so the Fiddle detaches them.
- **Rows** are padded rather than a fixed 44px; a showcase row carries a name, a
  description and tags, and the fixed height clipped them.
- **Monospace only for data** — paths and accelerators, not showcase prose.
  Accelerators moved to a trailing key chip, the way a real menu shows them.
