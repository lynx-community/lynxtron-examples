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
- workspace selection, task sidebar, conversation composer, live status,
  permission bar, and changed-file review summary;
- native desktop text selection and clipboard copy for user, assistant,
  reasoning, plan, tool-output, and error text in the conversation stream;
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

If OpenCode is unavailable, the app automatically selects the Mock backend.

## Verify

```bash
pnpm --dir showcases/codex-demo typecheck
pnpm --dir showcases/codex-demo test

# Optional real-agent smoke test
OPENCODE_BIN=/absolute/path/to/opencode \
  pnpm --dir showcases/codex-demo test -- opencode.e2e.test.ts
```

The real-agent test creates a temporary OpenCode session, asks the configured
model for a fixed response, verifies the streamed ACP result, closes the
session, and never reads model credentials itself.

## Architecture

```text
Lynx UI
  -> callback-only Lynx bridge
    -> AgentRuntime + TaskStore
      -> Mock backend
      -> AcpClient (one stdout reader)
        -> opencode acp --pure
```

New ACP-capable agents can reuse `AcpClient` and the normalized event contract.
Agents with another machine protocol can be added behind `AgentRuntime` without
changing the UI data model.
