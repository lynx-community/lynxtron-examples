---
"lynxtron-go": patch
---

Fix a transparent tear over the editor when dragging a Windows window edge. The Scintilla host is a real child HWND under the WS_CLIPCHILDREN renderer, so the renderer never paints the region it occupies; during an interactive resize the child sat at its stale rect while Lynx delivered the grown geometry asynchronously, exposing the strip. Hide the editor host for the duration of the drag so the region falls back to the window ground, hiding synchronously on the first WM_SIZING to avoid a first-frame flicker, and reveal + reposition once the layout settles on WM_EXITSIZEMOVE.
