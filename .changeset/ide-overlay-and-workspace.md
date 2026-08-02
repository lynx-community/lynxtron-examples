---
'lynxtron-go': patch
---

Three fixes found while testing the IDE surface.

**The palette opened behind the code.** Native Scintilla views paint above all
Lynx UI whatever the z-index says, so an overlay does not cover the editor — the
editor covers the overlay. The Fiddle has handled this since it grew dialogs
(App passes `overlayActive` and it detaches its editors); the IDE's single
editor had no equivalent, so on that surface only the palette's footer showed
below the editor's bottom edge. It now detaches while the palette or gallery is
open, and re-attaches after — re-attach only, since re-pushing the text would
also jump the caret to line 0.

**One resolver, and reuse what is already on disk.** The Fiddle and the IDE are
two views of one workspace, but each carried its own copy of "local source tree,
else fetch" — two functions meaning the same thing, free to drift, sharing every
failure anyway. They now share one, which also gained the step both were
missing: `fetch` wipes and re-extracts its destination on every call, so opening
a showcase in the Fiddle and then in the IDE downloaded and installed the same
workspace twice, seconds apart. A materialized workspace is now reused, verified
by reading its manifest so a half-extracted directory from an interrupted fetch
is not mistaken for a usable one.

**A failed workspace says so.** A window opened to prepare a showcase that never
arrived showed the same "Open Folder" invitation as an idle one; the reason sat
in the Output panel, which is closed by default. The editor area now names the
failure and offers Try again.
