---
'@lynxtron-examples/cli': patch
---

Stop showcase fetches dying on a stale cached lockfile.

Every install the CLI spawns runs with `CI=true`, set so pnpm would not stop on
an interactive purge prompt. That flag carries a second meaning: pnpm also
defaults `frozen-lockfile` to true in CI.

The workspace being installed into is synthesized under `~/.lynxtron-go`. Its
manifests are rewritten from the current catalog on every fetch, while its
lockfile is a cache left by whatever was fetched last. As soon as the catalog
moves the two disagree, and every fetch dies with `ERR_PNPM_OUTDATED_LOCKFILE`
before installing anything — so a window that asked for a showcase never gets
one and sits on the Fiddle indefinitely.

That is the inverse of a repo CI install, where the lockfile is the source of
truth and must not drift; here it is a cache that has to follow the manifests.
All three install sites now pass `--no-frozen-lockfile` explicitly. It has to
be the flag: pnpm does not read `npm_config_frozen_lockfile` from the
environment (verified against pnpm 10.15.1).
