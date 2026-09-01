---
"lynxtron-go": patch
"@lynxtron-examples/codex-demo": patch
---

Fix cover-view overlays so they composite above the native surface and stop blocking input. QuickPicker, dialogs, toaster, tooltips and loading overlays now route through the single platform overlay host above the native cover-view, and an event-through path lets purely visual overlays pass input through to the layers beneath them. Bumps lynxtron and related packages to 0.0.17-dev, including the lynxtron-rebuild headers patch the version needs on Windows.
