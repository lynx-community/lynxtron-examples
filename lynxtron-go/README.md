# Lynxtron Go

A desktop project editor and showcase runner built on Lynxtron (Lynx + Node.js),
using Scintilla as the native editor engine.

## Tech Stack

- **Runtime**: Lynxtron (Lynx renderer + Node.js)
- **UI**: ReactLynx (`@lynx-js/react`) + CSS Flexbox
- **Editor Engine**: Scintilla 5.x (C++, embedded as native NSView)
- **Build**: Rspack + RSpeedy (frontend), CMake (native extension)
- **Language**: TypeScript (UI/main), C++/Objective-C (native)

## Highlights

- Create, edit, save, build, and run complete Lynxtron projects.
- Browse the baked-in showcase Gallery and open editable project sources.
- Edit multiple files in native Scintilla panes with a collapsible project tree.
- Use a folder-oriented workspace IDE with tabs, search, terminal, output, and
  problems panels.
- Get real-time syntax styling plus TypeScript/JavaScript and CSS-family
  diagnostics from the Extension Host.
- Import and publish complete projects through GitHub Gists.
- Choose Lynxtron runtimes, configure launch flags, and inspect process output.
- Build macOS and Windows installers with bundled runtime and starter assets.

## Prerequisites

- NodeJS >= 22
- pnpm 10.x

[LynxDevTool](https://github.com/lynx-family/lynx-devtool/releases/) is optional
and only required for runtime inspection and debugging.

## Usage Guide

Run commands from the monorepo root.

### Install Dependencies

```sh
pnpm install
```

If pnpm reports ignored build scripts for `@lynx-js/lynxtron` or `@lynx-js/lynxtron-builder`, run `pnpm approve-builds` and allow both packages before launching the app.

### Development

```sh
# Start the renderer and desktop host watchers
pnpm --dir lynxtron-go dev

# Launch the already-built desktop host with the inspector enabled
pnpm --dir lynxtron-go run run-dev
```

### Build & Start

```sh
# Build all Lynxtron Go assets
pnpm --dir lynxtron-go build

# Build and launch the desktop app
pnpm --dir lynxtron-go start

# Validate without launching
pnpm --dir lynxtron-go run typecheck
pnpm --dir lynxtron-go test
```

### Application Packaging

```sh
# Package for the current macOS architecture
pnpm --dir lynxtron-go pack

# Package the Windows x64 installer
pnpm --dir lynxtron-go run pack:win
```

## Debugging

Use `pnpm --dir lynxtron-go run debug:detached` for a detached native-debug
session. See the [documentation index](docs/README.md) for current architecture
and archived design documents.

## AI Assistant Integration (MCP)

This project supports **Model Context Protocol (MCP)** to help AI assistants (like Claude Desktop, Cursor, or VS Code AI plugins) inspect the running application.

### Configuration

You can find the MCP server configuration in `lynx-devtool-mcp.json`.

### Setup

#### VS Code / Cursor

Add the following to your MCP settings file (usually `~/.code/User/globalStorage/mcp-servers.json` or similar):

```json
{
  "mcpServers": {
    "lynx-devtool": {
      "command": "npx",
      "args": [
        "-y",
        "@lynx-js/devtool-mcp-server@latest"
      ]
    }
  }
}
```

Once configured, your AI assistant can use tools provided by the MCP server to inspect the Lynx runtime state.
