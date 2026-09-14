---
"@lynxtron-examples/native-texture-canvas": patch
"lynxtron-go": patch
---

Fix Windows release builds of the native texture canvas showcase by keeping CMake intermediates outside pnpm's deep package directory. Preserve the AutoLink artifact location and verify the staged binary matches the compiled dependency. Bump Go so the corrected Windows showcase artifacts are included in the next installer release.
