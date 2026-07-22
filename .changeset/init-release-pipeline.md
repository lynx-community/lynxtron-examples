---
"@lynxtron-examples/config": patch
"@lynxtron-examples/benchmark": patch
"@lynxtron-examples/file-explorer": patch
"@lynxtron-examples/floating-clock": patch
"@lynxtron-examples/system-monitor": patch
---

Set up the release pipeline: publish the shared build config and the public
showcases (benchmark, file-explorer, floating-clock, system-monitor) to npm
via Changesets + npm OIDC trusted publishing, and build Lynxtron GO installers
and showcase tarballs as GitHub Release assets.
