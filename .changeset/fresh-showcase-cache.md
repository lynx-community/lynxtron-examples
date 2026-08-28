---
'@lynxtron-examples/cli': patch
'lynxtron-go': patch
---

Key downloaded showcase caches by their baked source URL so a new installer refreshes stale workspaces, while preserving mismatched editable workspaces in a backup directory. Publish source-bound precompiled artifacts under `dist_precompiled`, verify their source and artifact tree hashes before use, and fall back to a local `dist` build when verification fails or the source was edited.

Package Hello Lynxtron as a standard source-bound showcase artifact inside the installer, route it through the same fetch/cache/verification/build fallback as every other showcase, and remove the separate in-memory Hello template without publishing an additional Release asset.
