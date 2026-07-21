# Lynxtron Go

A code editor built on Lynxtron (Lynx + Node.js), using Scintilla as the native editor engine.

## Tech Stack

- **Runtime**: Lynxtron (Lynx renderer + Node.js)
- **UI**: ReactLynx (`@lynx-js/react`) + CSS Flexbox
- **Editor Engine**: Scintilla 5.x (C++, embedded as native NSView)
- **Build**: Rspack + RSpeedy (frontend), CMake (native extension)
- **Language**: TypeScript (UI/main), C++/Objective-C (native)

## Implemented Features

| Feature | Status |
|---------|--------|
| Scintilla native editor | ✅ |
| Open folder (sidebar + ⌘⇧O) | ✅ |
| Persistent workspace (auto-restore last folder) | ✅ |
| File tree with expand/collapse | ✅ |
| File icons by extension | ✅ |
| Multi-tab editing | ✅ |
| File open / switch / close | ✅ |
| Save file (⌘S) | ✅ |
| Syntax highlighting via Prism.js (TS/TSX/JS/JSX/CSS/SCSS/Less/JSON/Python/C++) | ✅ |
| Real-time syntax highlighting while typing (SCN_MODIFIED + 50ms debounce) | ✅ |
| Extension Host process (TypeScript + CSS/SCSS/Less language services) | ✅ |
| Language services: TS/JS/JSX/TSX diagnostics via TypeScript Compiler API | ✅ |
| Language services: CSS/SCSS/Less diagnostics via vscode-css-languageservice | ✅ (⚠️ ICU issue) |
| Diagnostic squiggle indicators (error/warning/info) via Scintilla Indicator API | 🔧 (implemented, E2E pending) |
| App menu (File / Edit / View) | ✅ |
| Quick file picker (⌘P) | ✅ (under test) |
| Status bar (language, save state) | ✅ |
| Window screenshot API (includes native NSView) | ✅ |

## Prerequisites

- NodeJS >= 22
- [LynxDevTool](https://github.com/lynx-family/lynx-devtool/releases/) >= 0.1.1
- pnpm 10.x

## Usage Guide

### Install Dependencies

```bash
pnpm install
```

If pnpm reports ignored build scripts for `@lynx-js/lynxtron` or `@lynx-js/lynxtron-builder`, run `pnpm approve-builds` and allow both packages before launching the app.

### Development

- **Desktop (Lynxtron)**
  ```bash
  npm run dev
  ```

### Build & Start

- **Build for Production**
  ```bash
  npm run build
  ```

- **Start Desktop**
  ```bash
  npm start
  ```

- **Start Web**
  ```bash
  npm run start:web
  ```

### Application Packaging

- **Package for macOS (x64)**
  ```bash
  npm run pack:mac:x64
  ```

- **Package for macOS (arm64)**
  ```bash
  npm run pack:mac:arm64
  ```

- **Package for macOS (Universal)**
  ```bash
  npm run pack:mac:universal
  ```

- **Package for Windows (ia32)**
  ```bash
  npm run pack:win
  ```

## Debugging

For detailed debugging strategies, including how to debug the Renderer, Main Process, and Native Modules, please refer to [Debug Strategy](docs/DEBUG_STRATEGY.md).

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
