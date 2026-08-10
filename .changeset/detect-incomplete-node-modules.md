---
'lynxtron-go': patch
---

**Detect half-populated `node_modules` and reinstall on next Run.** A fetch
that installed workspace deps but was killed before the showcase's own
dependencies landed (network flake, 5 min timeout, user quit) left a
`node_modules` directory that passed `existsSync` while being a shell of
dangling symlinks. `getShowcaseDependencyStatus` treated that as "already
installed" and `showcase.start` went straight to `pnpm start`, which died on
`sh: cross-env: command not found` with no path back to a working state — the
directory was there, so no Run would ever re-install.

The status probe now walks the showcase's declared `dependencies` /
`devDependencies` and, for each one, confirms `node_modules/<name>/package.json`
resolves (following symlinks). Any miss classifies the tree as
`incomplete-node-modules` and forces a reinstall on the next Run. Users who
were stuck on a broken fetch no longer have to `rm -rf ~/.lynxtron-go/showcases/<name>`
by hand.
