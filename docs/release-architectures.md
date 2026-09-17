# Native release architectures

Go installers and all showcase archives are built on native runners:

| Target | Runner | Showcase suffix |
| --- | --- | --- |
| macOS Apple silicon | macos-15 | -mac-arm64.tgz |
| macOS Intel | macos-15-intel | -mac-x64.tgz |
| Windows x64 | windows-2022 | -win-x64.tgz |

macOS installers are `lynxtron-go-darwin-arm64.dmg` and
`lynxtron-go-darwin-x64.dmg`. Scintilla is compiled and bundled with Go;
it is not a separate download. Every remote showcase follows the same naming
contract, including CEF Browser, Canvas and SQLite demos. Any Go showcase tgz
must follow the same contract; this workflow does not introduce a new Go tgz
distribution. Installer-bundled showcase tgz names also include the architecture.

The download boundary selects `process.platform` and `process.arch`, not the
physical CPU: an x64 Go running under Rosetta needs x64 extensions. Cache keys
include both values. Release manifests record them and prevent using a foreign
precompiled artifact. Generic third-party URLs are not rewritten.

Legacy unsuffixed `-mac.tgz` assets are arm64, and `-win.tgz` assets are x64.
An Intel Go rejects legacy mac assets with an upgrade message instead of loading
arm64 code. Use the new release gallery for architecture-specific downloads.

Before archiving, the packer checks embedded Mach-O/PE headers, including
extensionless CEF executables. The macOS app is checked again before upload.
The release is published only after all three builds pass and matching tgz
variants are present. This applies to stable and manual prerelease builds.

Local tests do not constitute Intel UI acceptance: validate the x64 DMG and
native showcases on the corresponding runtime before declaring that verified.
