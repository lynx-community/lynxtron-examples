---
"@lynxtron-examples/benchmark": patch
"@lynxtron-examples/file-explorer": patch
"@lynxtron-examples/floating-clock": patch
"@lynxtron-examples/system-monitor": patch
"@lynxtron-examples/todolist": patch
---

Add `repository.directory` to each showcase's `package.json` so tools that resolve source URLs from published packages (e.g. the `<Go>` component in the docs site) can link back to the correct subdirectory in the monorepo.
