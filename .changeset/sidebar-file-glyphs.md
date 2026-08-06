---
'lynxtron-go': patch
---

One icon language for files: the sidebar wears the glyphs Quick Open already
uses.

The app had two file lists speaking two different languages about the same
files. Quick Open (⌘P) showed 📘 for TypeScript, 🎨 for CSS, ⚛️ for a component;
the sidebar showed the same monochrome document outline for all of them, tinted
by extension in a colour code nothing taught you. The list you reach for by
keyboard and the list you reach for by eye disagreed, so the mismatch showed up
every time you used both.

`fileIcon` is now the single map, and the tint classes are gone — the glyph is
the type, so the ink has nothing left to say.

The rename and new-file rows take the glyph of the name **being typed**, not of
the file as it stands: rename `main.js` to `main.css` and the icon turns over
before you commit, which is the cheapest confirmation that the extension landed
the way you meant it to.
