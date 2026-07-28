# @lynxtron-examples/benchmark

## 0.0.2

### Patch Changes

- e4baab9: Add `repository.directory` to each showcase's `package.json` so tools that resolve source URLs from published packages (e.g. the `<Go>` component in the docs site) can link back to the correct subdirectory in the monorepo.

## 0.0.2-alpha.0

### Patch Changes

- 0068442: Set up the release pipeline: publish the shared build config and the public
  showcases (benchmark, file-explorer, floating-clock, system-monitor) to npm
  via Changesets + npm OIDC trusted publishing, and build Lynxtron GO installers
  and showcase tarballs as GitHub Release assets.
