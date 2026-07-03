# Lynxtron Application — Agent Guide

This document equips AI agents to author and modify code in this Lynxtron application quickly and safely. It explains the architecture, file layout, commands, and code patterns that work well with Lynx + NodeJS.

## Learning Resources

Read the docs below in advance to help you understand the library or frameworks this project depends on.

- Lynx: [llms.txt](https://lynxjs.org/llms.txt).
  While dealing with a Lynx task, an agent **MUST** read this doc because it is an entry point of all available docs about Lynx.
- Lynx DevTool MCP Server: [lynx-devtool-mcp.json](./lynx-devtool-mcp.json).
  This file contains the configuration for the Lynx DevTool MCP Server.
  For agents with MCP support (like Cursor or VS Code with plugins), you can use the MCP server to retrieve runtime info, logs, and element trees from the running Lynx app.

## Overview

- Lynxtron is an Electron-like runtime where `BrowserWindow` is replaced by `LynxWindow`.
- UI is built with Lynx via ReactLynx (`@byted-lynx/react`) using lowercase built-in elements such as `<view>`, `<text>`, `<image>`.
- **Symmetric Host Model**: Both Desktop and Web provide a consistent set of Native Modules to the UI.
  - `NativeModules.bridge`: Handles host-specific capabilities (dialogs, window control) via RPC.
  - `NativeModules.nodejs`: Provides a Node.js-like environment for background logic, injected directly into the Lynx Background Thread for maximum performance and object-level access.

## Project Layout

- `src/app`: Lynx UI layer built with ReactLynx
  - Entry: `src/app/index.tsx` renders `<App />` with `root.render`.
  - Layout shell: `src/app/App.tsx` — composes all UI components.
  - Shared types & native bridge: `src/app/store.ts` — `Tab`, `TreeNode`, `EDITOR_ID`, `getExposed()`, `scintillaApi()`.
  - Syntax: `src/app/syntax.ts` — Prism.js tokenization, language detection.
  - Diagnostics: `src/app/diagnostics.ts` — LSP marker → Scintilla indicator conversion.
  - Components (each has `.tsx` + `.css`):
    - `src/app/components/Sidebar/` — File explorer tree.
    - `src/app/components/TabBar/` — Horizontal scrollable tab bar.
    - `src/app/components/Editor/` — Scintilla editor wrapper + welcome screen.
    - `src/app/components/StatusBar/` — Language, status message, save button.
    - `src/app/components/QuickPicker/` — Cmd+P file search overlay.
- `src/main`: Host process logic
  - `src/main/desktop/`: Desktop (Node.js) host implementation.
    - `main.ts`: Main process entry (window management).
    - `preload.ts`: Logic injected into the Lynx thread (Node.js environment).
- Config: `lynx.config.ts` (RSpeedy) and `rspack.config.ts` (Host builder).

## Common Patterns

### Calling Native Capabilities
Always use the unified `NativeModules` API to ensure cross-platform compatibility.

```typescript
// Unified call for both Desktop and Web
NativeModules.bridge.request({ method: 'showDialog', params: { message: 'Hi' } });

// Background logic (runs in the same JS thread as Lynx logic)
// Use nodejs.exposed to access capabilities exported by host preload scripts
NativeModules.nodejs.exposed.echo('Hello', (res) => {
  console.log(res);
});
```

## Commands

Use NodeJS ≥ 22 and TypeScript.

- Install: `npm install`
- Dev (Desktop): `npm run dev`
- Dev (Web): `npm run dev:web`
- Build All: `npm run build`
- Start (Desktop): `npm start`
- Start (Web): `npm run start:web`
- Test: `npm run test`

## Authoring UI (ReactLynx)

UI code in `src/app` runs in the Lynx engine, which is **not a browser**.

- **React-like but different**: Use `@byted-lynx/react`.
- **Built-in Elements**: Use **lowercase** Lynx elements. DO NOT use HTML elements like `div`, `span`, `button`.
  - `<view>`: Container (like `div`).
  - `<text>`: Text (like `span`).
  - `<image>`: Image (like `img`).
  - `<scroll-view>`: Scrollable area.
  - `<list>`: High-performance list.
- **Event Model**: Standard Web events like `onClick` or `onChange` are NOT supported.
  - Use `bindtap` instead of `onClick`.
  - Use `bindinput` instead of `onChange`.
  - Events follow the pattern `bind<event_name>`.
- **CSS / Styling**:
  - Lynx uses a subset of CSS.
  - **Flexbox** is the primary layout engine (similar to React Native).
  - Use `className` for styling.
  - No CSS selectors like `:hover`, `nth-child`, or complex combinators.
- **No DOM/BOM APIs**: `window`, `document`, `location`, `localStorage` are NOT available.
  - Use `NativeModules.bridge` for host interactions.
  - Use `NativeModules.nodejs` for background logic and data persistence.
- **Main vs Background**: 
  - `src/app` runs in the Lynx Background thread (Main Thread in Lynx terminology).
  - It has direct access to `NativeModules.nodejs`.

### UI Example

```tsx
import { useState, useCallback } from '@byted-lynx/react';

export function MyComponent() {
  const [count, setCount] = useState(0);

  const handleTap = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return (
    <view className="container">
      <text className="title">Count: {count}</text>
      <view className="button" bindtap={handleTap}>
        <text className="button-text">Increment</text>
      </view>
    </view>
  );
}
```

## Local Type Definitions

Inspect local types for exact API surfaces:
- `node_modules/@lynx-js/lynxtron/apis/lynxtron.d.ts`
- `node_modules/@lynx-js/lynxtron/apis/web-host.d.ts`

## Debugging

### Starting the App

```bash
# Correct: launches in a new Terminal window (guarantees TTY + process isolation)
npm run debug:detached

# Wrong for native debugging: dev server only, no binary launched
npm run dev
```

> **Why a new terminal?** The C++ layer and some native modules require a TTY. Launching as a subprocess with redirected stdio causes SIGSEGV crashes.

### Connecting via MCP DevTool

Once the app is running, connect in order:

1. `Device_listClients` — get `clientId`
2. `Device_listSessions` — get `sessionId` (pass `clientId`)
3. Use any other DevTool tool with both IDs

### Useful DevTool Tools

| Tool | Purpose |
|---|---|
| `DOM_getDocument` | Inspect the full UI tree |
| `Runtime_listConsole` | Read JS console logs |
| `Page_takeScreenshot` | See what's on screen |
| `CSS_getComputedStyleForNode` | Inspect element styles |
| `Input_emulateTouchFromMouseEvent` | Simulate click/tap |

### Simulating Clicks (`Input_emulateTouchFromMouseEvent`)

The MCP tool sends logical coordinates. The C++ shell handles DPR scaling and hit-testing automatically. To simulate a click at `(x, y)`:

```json
// mousePressed
{ "type": "mousePressed", "x": 124, "y": 18, "button": "left", "timestamp": <now_ms> }
// mouseReleased
{ "type": "mouseReleased", "x": 124, "y": 18, "button": "left", "timestamp": <now_ms> }
```

**Why `bindtap` requires both events**: Lynxtron runs in embedded mode where the engine does not auto-synthesize `tap` from touch events. The shell's `EventSimulationProxyImpl` explicitly sends `touchstart → touchend → tap` on a `mouseReleased` event. Both `mousePressed` and `mouseReleased` calls are required.

### Log Files

- `debug_terminal.log` — redirected stdout/stderr from the app process (C++ `fprintf(stderr, ...)` and JS `console.log`)
- `/tmp/lynxtron_debug.log` — optional persistent C++ file log (written via `utils.log`)
