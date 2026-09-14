---
'@lynxtron-examples/system-monitor': patch
'lynxtron-go': patch
---

Fix System Monitor's initial data request to use the callback-based native bridge, so the first reading does not depend on the periodic update event.
