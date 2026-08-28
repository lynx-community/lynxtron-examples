---
'@lynxtron-examples/cli': patch
'lynxtron-go': patch
---

Key downloaded showcase caches by their baked source URL so a new installer refreshes stale workspaces, while preserving mismatched editable workspaces in a backup directory. Publish source-bound precompiled artifacts under `dist_precompiled`, verify their source and artifact tree hashes before use, and fall back to a local `dist` build when verification fails or the source was edited.
