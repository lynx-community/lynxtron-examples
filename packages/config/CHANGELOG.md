# @lynxtron-examples/config

## 0.0.4

### Patch Changes

- 9f330d3: Refresh the Lynx toolchain used by the showcases and publish real preview
  captures for documentation consumers. The native texture canvas artifact now
  includes its application and extension source files.

## 0.0.3

### Patch Changes

- a3096be: Republish so `package.json` `dependencies` carry real version specifiers instead of the `catalog:` protocol. The previously published `0.0.1` tarball still contained `catalog:` refs, which caused `pnpm install` to fail with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` when the Lynxtron GO app tried to install a fetched showcase.

## 0.0.2-alpha.0

### Patch Changes

- 0068442: Set up the release pipeline: publish the shared build config and the public
  showcases (benchmark, file-explorer, floating-clock, system-monitor) to npm
  via Changesets + npm OIDC trusted publishing, and build Lynxtron GO installers
  and showcase tarballs as GitHub Release assets.
