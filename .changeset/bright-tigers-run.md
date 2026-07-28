---
"@lynxtron-examples/config": patch
---

Republish so `package.json` `dependencies` carry real version specifiers instead of the `catalog:` protocol. The previously published `0.0.1` tarball still contained `catalog:` refs, which caused `pnpm install` to fail with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` when the Lynxtron GO app tried to install a fetched showcase.
