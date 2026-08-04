---
'lynxtron-go': patch
---

Three fixes found while testing the IDE surface.

**The palette opened behind the code.** Native Scintilla views paint above all
Lynx UI whatever the z-index says, so an overlay does not cover the editor — the
editor covers the overlay. The palette, gallery, dialogs, loading state, and
toasts now register with one shared `cover-view` host, which composites their
children into a platform overlay slice above native views without creating a
second macOS overlay surface during rapid modal transitions. The Scintilla extension now keeps the
originating `lynx_view_t`, mounts its NSView/HWND under that view's native
parent, and keeps the editor below Clay's overlay host instead of guessing the
key window and floating above the entire Lynx surface. Editors stay attached
while overlays are open, preserving focus, selection, scroll position, and
paint state.

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
