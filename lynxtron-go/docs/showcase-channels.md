# Showcase releases by Go version

A stable Go build follows the latest showcase revision in its **exact Go-version
channel**, not the globally newest showcase release or a publication timestamp.
For example, Go 0.1.13 follows `lynxtron-showcases-go-v0.1.13`; it never switches
to the 0.1.14 channel. The previous channel stops advancing once main bumps Go.
Already-released Go builds without this resolver must upgrade once to enable it.

## Publishing

- Add a Changeset for the changed public showcase, without bumping Go when its
  runtime and host API requirements remain compatible.
- Merge the generated Version Packages PR. The Release workflow detects a
  showcase version change with no Go version change and invokes Release Showcases.
  Existing npm-environment approval requirements still apply.
- Release Showcases can also be dispatched manually on main. It requires an
  existing stable release for the current Go version and an unchanged pinned
  Lynxtron runtime. Runtime upgrades require a new Go release first.
- All public showcase archives are built for mac-arm64, mac-x64 and win-x64.
  Only after all builds succeed is the complete revision published. This does
  not rebuild Go installers or its bundled Scintilla extension.
- If Go itself bumps, the normal installer workflow publishes **all** public
  showcase archives and initializes its channel from those assets. No artificial
  version bump of every showcase is needed. Builtins are rebuilt inside Go.
  The seed step never overwrites an existing channel, including on workflow retry.

Revisions use immutable tags `lynxtron-showcases-go-v<VERSION>-<FULL_COMMIT_SHA>`.
The channel release contains a mutable `showcase-index.json` referencing that
revision. These releases do not replace Go as GitHub's latest release. Publication
is serialized with installer releases, and older reruns cannot roll back a newer
channel. An incomplete immutable draft requires inspection before retrying.

## Client behavior

The baked stable artifact URL identifies the channel. Alpha/dev, builtin, local
and arbitrary external artifacts do not join stable channels. The index must
match both Go and runtime versions; artifact URLs are constructed for the
current platform and process architecture. Remote indexes cannot inject URLs.

The catalog refreshes asynchronously every minute, including newly added
showcases; deep links refresh before looking up an ID. Requests have a four-second
timeout and a 512 KiB limit. A validated on-disk index is used offline, otherwise
Go keeps its baked catalog. The initial screen does not wait for the network.

Opening a showcase resolves its revision before checking the workspace cache.
Updating an existing workspace moves the old tree, including edits, to
`~/.lynxtron-go/showcase-backups/`. A failed download restores that tree and can
reuse a cached artifact from the same Go lane and architecture. Successful
updates retain the backup for manual recovery; edited files are not auto-merged.
Built-in showcases continue shipping with Go, not through this channel.

## Workflow acceptance

On a branch, dispatch Release Installers with `validate-showcases=true` to build
an isolated Go prerelease, then exercise the standalone showcase build workflow
in validation-only mode. Both paths download every produced tgz over local HTTP
on its native runner, check the release manifest without installing dependencies,
and inspect embedded native binaries. Validation never advances a stable channel.
An initial full index is attached to preview releases too, but alpha clients do
not consume stable channels. GUI acceptance and production publication are
separate from this archive-level acceptance.
