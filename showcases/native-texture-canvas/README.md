# Native Texture Canvas: AutoLink

Uses the Lynxtron 0.0.22 toolchain. Release notes:
https://github.com/lynx-family/lynxtron/releases/tag/v0.0.22
Development integration and packaging contracts:
https://github.com/lynx-family/lynxtron/pull/254
https://github.com/lynx-family/lynxtron/pull/256

The local `file:./native-texture-extension` dependency declares literal
package-relative artifacts in `lynx.lib.json` for macOS arm64 and Windows x64.
Its `/lynxtron` export registers on load. `pluginLynxtron` is enabled for both
development and production, stages the selected library under
`dist/desktop/.lynxtron/native/node_modules`, and injects registration before
the application entry. The application no longer copies or registers the
native module itself. The build script compiles the installed local dependency
(which pnpm may materialize separately from the source folder).

Go's bundle-preview declaration still contains hashes of the entry and binary,
but its URLs point to the AutoLink-staged directory. The exported `setUp` stays
idempotent for that preview loader. Missing native binaries fail loudly.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @lynxtron-examples/config build
pnpm --filter @lynxtron-examples/native-texture-canvas test:autolink
pnpm --filter @lynxtron-examples/native-texture-canvas exec lynxtron ./dist/desktop
```

## Upgrade verification (2026-09-14)

- macOS arm64: native compilation, production build and four AutoLink tests passed.
- Tools and host TypeScript checks passed. Host resolution matches Rspack's
  bundler mode; the shared resize interface matches 0.0.22's array return types.
- Real dist runtime: Native ready, blue brush selection and a drawn stroke verified.
- Packed tarball includes the staged entry, manifest, metadata and native binary.
  Extracted into a separate temporary directory, it starts with Native ready
  using the installed 0.0.22 runtime without source-directory module resolution.
- CLI: 31 tests passed; Codex demo: 120 passed, 1 skipped; Go: 297 passed,
  1 skipped after building CLI tooling. Initial Go tests without CLI dist failed
  to resolve that prerequisite; rerun passed.
- Frozen offline dependency resolution and `git diff --check` passed.
- Windows native execution, full installer creation/signing and website-to-Go
  end-to-end acceptance were not performed for this upgrade. No release published.
