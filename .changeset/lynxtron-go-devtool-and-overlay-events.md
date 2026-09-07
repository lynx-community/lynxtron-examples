---
"lynxtron-go": patch
---

Enable Lynxtron devtool unconditionally on `whenReady` in the Lynxtron GO host so it no longer requires an env flag or a rebuild to inspect the running app.

Route the toast overlay through `PlatformOverlay` with `eventThrough={false}` and forward each overlay entry's `eventThrough` down to its wrapper `<view>`. Previously the shared platform overlay wrapper hardcoded `event-through={true}`, so toasts painted on top but pointer events fell through the toast card to the editors underneath.
