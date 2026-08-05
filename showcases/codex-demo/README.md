# Codex Demo

A Lynxtron desktop client with a Codex-style UI and an agent-neutral runtime.
The first production adapter runs [OpenCode](https://opencode.ai) through the
Agent Client Protocol (ACP); a credential-free Mock backend keeps UI and
transport development testable without an agent account.

## What works

- OpenCode discovery through `OPENCODE_BIN`, `PATH`, `~/.opencode/bin`, or
  common Homebrew locations;
- ACP initialization, session create/load/close, streaming assistant and
  reasoning updates, plans, tools, usage, cancellation, config options, and
  permission decisions;
- persisted task metadata and replayable host events;
- workspace selection, task sidebar, conversation composer, live status, and
  permission bar;
- repository-backed Review with changed-file counts, line-level diffs, and a
  multi-tab preview workspace whose typed slots can also host files, terminals,
  browsers, images, or custom preview providers;
- native desktop text selection and clipboard copy for user, assistant,
  reasoning, plan, tool-output, and error text in the conversation stream;
- a versioned Open Computer Use MCP helper archive plus an OpenCode
  `computer-use` skill for screenshot and accessibility-driven macOS app
  control. The helper is installed atomically and never overwritten in place;
- a Mock backend using the same normalized event contract as OpenCode.

Model credentials stay in OpenCode. They are not copied into the preload
bridge or Lynx state.

## Run

Install OpenCode with its official installer, or point the app at an existing
binary:

```bash
export OPENCODE_BIN=/absolute/path/to/opencode
export CODEX_DEMO_WORKSPACE=/absolute/path/to/a/workspace
pnpm --dir showcases/codex-demo build
pnpm --dir showcases/codex-demo start
```

The build embeds OpenCode as a versioned ZIP. On a clean build machine, provide
the official macOS archive explicitly:

```bash
CODEX_DEMO_OPENCODE_ARCHIVE=/absolute/path/opencode-darwin-arm64.zip \
  pnpm --dir showcases/codex-demo build
```

At runtime the archive is checksum-verified and installed atomically under the
Codex Demo application-support directory, so `OPENCODE_BIN` is not required by
end users.

If OpenCode is unavailable, the app automatically selects the Mock backend.
On the first Computer Use action, grant Accessibility and Screen Recording to
**Open Computer Use** when macOS asks.

Local builds preserve the upstream Developer ID signature and extended
attributes so the helper keeps one stable macOS permission identity. Release
builds must provide a notarized helper and set
`CODEX_DEMO_REQUIRE_NOTARIZED_HELPER=1`; the build then requires `codesign`,
Gatekeeper, and stapler validation to pass.

## Verify

```bash
pnpm --dir showcases/codex-demo typecheck
pnpm --dir showcases/codex-demo test

# Real Computer Use protocol smoke test after launching the demo once.
CODEX_DEMO_COMPUTER_USE_BIN="$HOME/Library/Application Support/@lynxtron-examples/codex-demo/codex-demo/runtime/<version-hash>/Open Computer Use.app/Contents/MacOS/OpenComputerUse" \
  pnpm --dir showcases/codex-demo smoke:computer-use

# Optional real-agent smoke test
OPENCODE_BIN=/absolute/path/to/opencode \
  pnpm --dir showcases/codex-demo test -- opencode.e2e.test.ts
```

The real-agent test creates a temporary OpenCode session, asks the configured
model for a fixed response, verifies the streamed ACP result, closes the
session, and never reads model credentials itself.

## Release helper

Prepare a separately signed and notarized helper before building the showcase:

```bash
sh scripts/notarize-computer-use-runtime.sh "/path/to/Open Computer Use.app"

CODEX_DEMO_HELPER_APP="/path/to/Open Computer Use.app" \
CODEX_DEMO_REQUIRE_NOTARIZED_HELPER=1 \
  pnpm build
```

`CODEX_DEMO_HELPER_SIGNING_IDENTITY`, `APPLE_API_KEY_PATH`,
`APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` must be supplied to the notarization
script. The final build fails if `spctl` does not report a notarized Developer
ID artifact.

## Architecture

The process boundary and migration rules are documented in
[ARCHITECTURE.md](./ARCHITECTURE.md).

```text
Lynx UI
  -> Lynx BTS conversation buffer exposed by preload
    -> callback-only Lynx bridge
      -> main-process RPC transport + service lifecycle
        -> Codex Service Host
          -> AgentRuntime + TaskStore + Workspace/Review services
            -> Mock backend
            -> AcpClient (one stdout reader)
              -> opencode acp --pure
```

New ACP-capable agents can reuse `AcpClient` and the normalized event contract.
Agents with another machine protocol can be added behind `AgentRuntime` without
changing the UI data model.
