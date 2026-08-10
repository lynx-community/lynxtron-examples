---
'lynxtron-go': patch
---

**Bundled `pnpm` was invisible on PATH: fetched showcases died with
`spawn pnpm ENOENT`.** The packaged app writes shell shims to
`~/.lynxtron-go/bin` and prepends them to `PATH`, but the shim installer only
emitted `node`/`npx` — never `pnpm` itself. The other half of the fix
prepended the bundled pnpm package's own `bin/` directory to `PATH`, but that
directory contains just `pnpm.cjs`; there is no file literally named `pnpm`,
because `npm`/`pnpm` normally creates that alias as a `node_modules/.bin`
symlink at install time, and `copyPackage('pnpm')` in prepare-runtime-deps
skips the `.bin` layer. On a user's machine without a global pnpm,
`spawn('pnpm', …)` therefore hit `ENOENT` at the very first step of any
Run — after we already claimed the previous fix landed pnpm on PATH.

Now the shim installer also writes `pnpm` (macOS/Linux) and `pnpm.cmd`
(Windows) alongside the `node` shim, both re-executing the current lynxtron
binary in Node mode against `pnpm.cjs`. `spawn('pnpm', …)` from any showcase
subprocess finds it immediately, no matter what the user's shell PATH looks
like.
