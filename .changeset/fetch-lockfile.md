---
'@lynxtron-examples/cli': patch
---

Make a fetched showcase actually install and build.

Two independent faults in the synthesized workspace under `~/.lynxtron-go`
stopped every remote showcase — in the Fiddle and the IDE alike — before it
could run.

**The lockfile was frozen against manifests that move.** Every install the CLI
spawns runs with `CI=true`, set so pnpm would not stop on an interactive purge
prompt with no TTY. That flag carries a second meaning: pnpm also defaults
`frozen-lockfile` to true in CI. The workspace's manifests are rewritten from
the current catalog on every fetch, while its lockfile is a cache left by the
previous one, so any catalog move made the next fetch die with
`ERR_PNPM_OUTDATED_LOCKFILE` before installing anything. That is the inverse of
a repo CI install — there the lockfile is the source of truth and must not
drift, here it is a cache that has to follow the manifests. All three install
sites now pass `--no-frozen-lockfile`. It has to be the flag: pnpm does not read
`npm_config_frozen_lockfile` from the environment (checked against pnpm
10.15.1).

**Two toolchains coexisted in one tree.** The root pins
`@lynxtron-examples/config` to `latest`, and a published config carries hard
dependency ranges frozen at whatever the catalog was when it shipped. With the
catalog ahead of the last publish, pnpm satisfied both: the new toolchain at the
root, a nested old one under config — and the showcase's build resolved its
plugin through config. Old plugin against new React is a crash, not a warning:

    TypeError: Cannot read properties of undefined (reading 'entries')
      at @lynx-js/react-rsbuild-plugin/dist/208.js

The synthesized workspace is ours end to end, so there is one right version of
each toolchain package — the one the showcase was built against. It is now
declared as `pnpm.overrides`, which holds however far behind the published
config drifts.
