---
"lynxtron-go": patch
---

Fix the Add-file row in the Fiddle sidebar silently failing when confirmed without typing. The `file.js` shown in the input was only a placeholder, so the value was empty and confirming (✓ / Enter) hit the empty-name guard that treats it as cancel. Prefill the default name into the input so confirming creates `file.js`, while typing still overrides it and the existing name validation applies live.
