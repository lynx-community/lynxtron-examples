# Electron Fiddles on Lynxtron

A single multi-entry showcase that ports the [Electron `docs/fiddles`](https://github.com/electron/electron/tree/main/docs/fiddles)
example snippets to **Lynxtron** — proving Lynxtron's Electron-compatible
main-process API while replacing the Chromium renderer with Lynx (ReactLynx).

Launch the showcase and you get a **gallery home screen**: tap any card to open
that fiddle in its own window. Each card shows a status badge:

- ✅ **working** — ported and runs on Lynxtron.
- 🟡 **partial** — ported with a documented gap (renderer-only web API adapted to Lynx).
- ⛔ **N/A** — depends on a Chromium/web-platform capability Lynxtron has no equivalent for.

**55 fiddles · 37 working · 7 partial · 11 N/A** — the complete upstream set.
The catalog is checked 1:1 against `electron/electron@main`'s `docs/fiddles`
tree: every upstream directory has exactly one row below, and there are no rows
that upstream does not have.

Verified against the Lynxtron toolchain pinned in `pnpm-workspace.yaml`
(**0.0.7**). Where a status says "N/A", it means the capability is absent from
that version's API surface (`@lynx-js/lynxtron/apis`), not merely unimplemented
in the port.

## Architecture

One rspeedy project with **multiple entries** (one Lynx bundle per fiddle, plus
a `main` bundle for the gallery) and one rspack `electron-main` build for the
shared main process.

```
src/
  home/                 gallery UI (the `main` entry)
  fiddles/<id>/         one folder per fiddle: index.tsx + App.tsx (+ App.css, main.ts)
  main/desktop/
    main.ts             opens the gallery; on launch, opens a LynxWindow per fiddle
    registry.ts         fiddle id -> registerMain(win, ctx) (generated from fiddles/*/main.ts)
    preload.ts          shared contextBridge exposures
    lynx-native.ts      runtime access to native classes the ESM shim omits (Notification)
  shared/
    manifest.ts         single source of truth: id, category, status, notes, window opts
    bridge.ts           the app-side IPC helpers every fiddle uses
    ui/Demo.tsx         shared Lynx UI kit (DemoPage, Section, ActionButton, Field, KV…)
```

The gallery (`main` entry) is positioned to become the repo's future landing
screen, with other showcases loadable as templates.

## IPC mapping (Electron → Lynxtron)

Lynxtron's UI↔main bridge is **callback-style**, wrapped by `src/shared/bridge.ts`
so fiddles use ergonomic helpers:

| Electron | Lynxtron (native) | Shared helper |
|---|---|---|
| `ipcRenderer.send` / `ipcMain.on` | `NativeModules.bridge.send(m, p)` → `win.on('-lynx-message')` | `bridgeSend(m, p)` |
| `ipcRenderer.invoke` / `ipcMain.handle` | `NativeModules.bridge.call(m, p, cb)` → `win.on('-lynx-invoke')` + `callback.sendReply()` | `await bridgeCall(m, p)` |
| `webContents.send` / `ipcRenderer.on` | `win.sendGlobalEvent(e, d)` → `lynx.getJSModule('GlobalEventEmitter')` | `onGlobalEvent(e, cb)` |
| `contextBridge.exposeInMainWorld` | `contextBridge.exposeInLynxBTS` → `NativeModules.nodejs.exposed` | `exposed(key)` |

### Runtime notes discovered while porting

- `bridge.call` is **callback-style**, not promise-based — `bridgeCall` wraps it in a Promise.
- Main→UI events arrive via `lynx.getJSModule('GlobalEventEmitter')`; there is **no** bare `GlobalEventEmitter` global.
- `Notification` exists on the native `require('lynxtron')` object but is **not** re-exported by the package's ESM shim — accessed via `src/main/desktop/lynx-native.ts`.
- Use the lowercase `nativeImage` namespace, not a `NativeImage` class.
- Not available in 0.0.7: `globalShortcut`, `nativeTheme`, `desktopCapturer`, `webContents`, `BaseWindow.setRepresentedFilename` / `setDocumentEdited`, `webContents.startDrag`, `titleBarOverlay` / safe-area insets.
- **`-x-app-region: drag`** is Lynx's spelling of Chromium's `-webkit-app-region: drag`; it is what makes a custom title bar in a frameless window a window-move handle (documented on `BaseWindow`'s `system-context-menu` event).
- **Keyboard events exist**: `bindkeydown` / `bindkeyup`, plus `global-bindkeydown` / `global-bindkeyup` which fire regardless of focused node — the analogue of a `window` listener. The event carries `key`.
- New in 0.0.7 and unused by upstream fiddles: `powerMonitor`, `lynxBridge`.
- Also missing from the ESM shim (reachable the same way as `Notification`): `TouchBar*`, `UtilityProcess`, `Task`, `JumpListItem`.

## Develop

```bash
pnpm --filter electron-fiddles build           # rspeedy (UI bundles) + rspack (main)
pnpm --filter electron-fiddles start           # build + launch the gallery

# Open specific fiddles directly (skips the gallery), comma-separated:
LYNXTRON_FIDDLE=app-information,window-state ./node_modules/.bin/lynxtron ./dist/desktop
```

## Port matrix

### Tutorial

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Quick Start | ✅ working | `quick-start` |  |
| First App | ✅ working | `tutorial-first-app` |  |
| Preload Script | ✅ working | `tutorial-preload` |  |

### IPC

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| IPC: Renderer → Main (one-way) | ✅ working | `ipc/pattern-1` |  |
| IPC: Renderer ↔ Main (two-way) | ✅ working | `ipc/pattern-2` |  |
| IPC: Main → Renderer | ✅ working | `ipc/pattern-3` |  |
| IPC: webview new-window | ⛔ N/A | `ipc/webview-new-window` | Depends on the Chromium <webview> tag, which Lynxtron has no equivalent for. |

### Dialogs

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Information Dialog | ✅ working | `native-ui/dialogs/information-dialog` |  |
| Error Dialog | ✅ working | `native-ui/dialogs/error-dialog` |  |
| Open File or Directory | ✅ working | `native-ui/dialogs/open-file-or-directory` |  |
| Save Dialog | ✅ working | `native-ui/dialogs/save-dialog` |  |

### Notifications

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Notifications | ✅ working | `native-ui/notifications` |  |
| Notification (from Main) | ✅ working | `features/notifications/main` |  |
| Notification (from Renderer) | 🟡 partial | `features/notifications/renderer` | Electron uses the renderer Web Notification API; Lynx has no DOM Notification, so this bridges to the main-process Notification instead. |

### Menus

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Tray Menu | ✅ working | `menus/tray-menu` |  |
| Dock Menu (macOS) | ✅ working | `menus/dock-menu` | macOS only — the dock is undefined on other platforms. |
| Context Menu | ✅ working | `menus/context-menu/web-contents` |  |
| Context Menu (element-targeted) | ✅ working | `menus/context-menu/dom` |  |
| Menu Shortcuts | 🟡 partial | `menus/shortcuts` | Electron uses globalShortcut, which Lynxtron does not export. Ported as application-menu accelerators via Menu.setApplicationMenu. |

### System

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Clipboard: Copy | ✅ working | `system/clipboard/copy` |  |
| Clipboard: Paste | ✅ working | `system/clipboard/paste` |  |
| App Information | ✅ working | `system/system-app-user-information/app-information` |  |
| Version Information | ✅ working | `system/system-information/get-version-information` |  |
| Protocol Handler (deep link) | ✅ working | `system/protocol-handler/launch-app-from-URL-in-another-app` |  |

### Windows

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| New Window | ✅ working | `windows/manage-windows/new-window` |  |
| Window Events | ✅ working | `windows/manage-windows/window-events` |  |
| Manage Window State | ✅ working | `windows/manage-windows/manage-window-state` |  |
| Frameless Window | ✅ working | `windows/manage-windows/frameless-window` |  |
| Crashes and Hangs | ⛔ N/A | `windows/crashes-and-hangs` | Not a Lynxtron gap: the upstream directory contains only a `.keep` file, so there is no fiddle to port. Listed so this matrix is provably complete against upstream. |

### Window Customization

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Remove Title Bar | ✅ working | `features/window-customization/custom-title-bar/remove-title-bar` |  |
| Native Window Controls | ✅ working | `features/window-customization/custom-title-bar/native-window-controls` |  |
| Custom Title Bar | ✅ working | `features/window-customization/custom-title-bar/custom-title-bar` |  |
| Starter Code (default chrome) | ✅ working | `features/window-customization/custom-title-bar/starter-code` | The baseline window the series starts from. Upstream's `loadURL('https://example.com')` is not portable — a LynxWindow renders Lynx bundles, not web pages — so it loads its own bundle; the default-chrome behaviour being demonstrated is unaffected. |
| Custom Drag Region | ✅ working | `features/window-customization/custom-title-bar/custom-drag-region` | Chromium's `-webkit-app-region: drag` maps to Lynx's `-x-app-region: drag`. |
| Title Bar Safe Area | 🟡 partial | `features/window-customization/custom-title-bar/safe-area` | Depends on titlebar-overlay env() safe-area insets; approximated with a fixed inset and noted in-app. |
| Frameless Window | ✅ working | `features/window-customization/custom-window-styles/frameless-windows` |  |
| Transparent Window | ✅ working | `features/window-customization/custom-window-styles/transparent-windows` |  |

### Screen

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Fit Window to Screen | ✅ working | `screen/fit-screen` |  |

### Features

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Progress Bar | ✅ working | `features/progress-bar` |  |
| Recent Documents | ✅ working | `features/recent-documents` |  |
| Represented File (macOS) | 🟡 partial | `features/represented-file` | Lynxtron does not export setRepresentedFilename / setDocumentEdited (the native proxy-icon affordance). Ported via the window title (setTitle) — the cross-platform "filename — Edited" fallback. |
| Dark Mode | 🟡 partial | `features/dark-mode` | Electron uses the nativeTheme module (not exported by Lynxtron). Ported as an in-app CSS theme toggle; system-theme following is not wired. |
| Online / Offline Detection | 🟡 partial | `features/online-detection` | Electron uses the renderer navigator.onLine. Lynx has no navigator; connectivity is probed from main and pushed to the UI. |
| Keyboard Shortcuts (in-app) | ✅ working | `features/keyboard-shortcuts/web-apis` | Electron's `window.addEventListener('keyup')` maps to Lynx's `global-bindkeyup`; `event.key` is the same field. |
| Keyboard Interception from Main | ⛔ N/A | `features/keyboard-shortcuts/interception-from-main` | Depends on webContents before-input-event, which has no Lynxtron equivalent. |
| Drag & Drop (files in) | 🟡 partial | `features/drag-and-drop` | Electron uses the HTML5 drag-and-drop API. Lynx has no HTML5 DnD; ported as a file picker + shell.showItemInFolder as the nearest demo. |
| Native Drag & Drop (out) | ⛔ N/A | `native-ui/drag-and-drop` | Depends on webContents.startDrag, which Lynxtron does not export. |
| External Links & File Manager | ✅ working | `native-ui/external-links-file-manager` |  |
| Navigation History | ⛔ N/A | `features/navigation-history` | Depends on webContents navigation history; Lynxtron has no web navigation stack. |
| Offscreen Rendering | ⛔ N/A | `features/offscreen-rendering` | Depends on Chromium offscreen rendering / paint events. |
| Take a Screenshot | ⛔ N/A | `media/screenshot/take-screenshot` | Depends on desktopCapturer / getUserMedia, not exported by Lynxtron. |

### Web Platform

| Fiddle | Status | Upstream | Notes |
|---|---|---|---|
| Web Bluetooth | ⛔ N/A | `features/web-bluetooth` | Chromium web-platform device API; no Lynxtron equivalent. |
| WebHID | ⛔ N/A | `features/web-hid` | Chromium web-platform device API; no Lynxtron equivalent. |
| Web Serial | ⛔ N/A | `features/web-serial` | Chromium web-platform device API; no Lynxtron equivalent. |
| WebUSB | ⛔ N/A | `features/web-usb` | Chromium web-platform device API; no Lynxtron equivalent. |

