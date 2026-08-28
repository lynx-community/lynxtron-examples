---
"lynxtron-go": patch
---

Fix View → Reload so it preserves editor content instead of coming back blank. The host now runs the persistNow → persistDone handshake and then triggers a UI-side remount (LynxWindow has no reload() and re-issuing loadFile is a no-op), so cold-start restoreLastSession picks up the flush that just landed. Editor mismatch error now correctly blames Lynxtron's embedded Node instead of the system install.
