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

## Architecture — loose source, assembled on demand

This follows upstream's model rather than inventing one. Upstream's
`docs/fiddles` holds **171 files and zero `package.json`s**: each fiddle is a
plain source folder, and Electron Fiddle synthesizes a throwaway project around
it at run time and spawns Electron on that. We do the same, plus the one step
Electron does not need — Lynx cannot load source at run time, so the renderer is
compiled to a `.lynx.bundle` before a window can load it.

```
fiddles/<upstream/path>/     loose source, mirroring electron/docs/fiddles 1:1
  main.ts                    a REAL main process: app.whenReady() + its own window
  renderer.tsx               the Lynx UI entry (upstream's renderer.js + index.html)
  preload.ts                 only where the fiddle needs one (upstream has 27)
  styles.css                 optional

kit/                         @lynxtron-examples/fiddle-kit — the small shared kit
  bridge.ts                  the app-side IPC helpers
  ui/Demo.tsx                the Lynx UI kit (DemoPage, Section, ActionButton…)
  lynx-native.ts             native classes the ESM shim omits (Notification)

scripts/assemble.mjs         folder -> complete project -> build -> run
catalog.ts                   id, category, status, notes, window options
src/home/                    the gallery UI
src/main/desktop/main.ts     the gallery's main process — spawns fiddles, nothing else
```

Assembling a fiddle produces a complete, standalone Lynxtron project under
`.assembled/<id>/`: the fiddle's own files, a copy of the kit, and generated
`package.json` / `lynx.config.ts` / `rspack.config.ts`. Everything there is
generated and gitignored, so it can be deleted at any time.

```bash
node scripts/assemble.mjs quick-start --build --run   # one fiddle, end to end
node scripts/assemble.mjs --all --build --jobs 6      # what `npm run build` does
```

### What a fiddle shows

One API, doing one thing, with its result visible. Nothing else.

Each screen is the working demo and — where the port has a real gap — a single
line naming it. The tutorial prose the fiddles used to carry ("How it works in
Electron", "Electron → Lynxtron") was removed: the mapping already lives in the
IPC table and port matrix below, and repeating it on every screen buried the
part that is actually evidence.

They share the repo's Fiddle Dark language with `showcases/counter` and
`showcases/system-monitor` — palette from `@lynxtron-examples/config/tokens.css`,
labelled panels, sans-serif labels, and `var(--font-mono)` reserved for data
(values, paths, versions, API identifiers). Colour carries meaning: the accent
marks the one primary action, `--ok` a live result. See `.impeccable.md` at the
repo root for the design context.

### Why each fiddle gets its own process

Launching a fiddle from the gallery spawns a **separate Lynxtron process** on
its assembled project (`spawn(process.execPath, [projectDist])`), which is the
same relationship Electron Fiddle has with the fiddles it runs.

That isolation is load-bearing, not cosmetic. While every fiddle shared one main
process, the ones that touch app-global state overwrote each other —
`ipc-pattern-3` and `menu-shortcuts` both call `Menu.setApplicationMenu`, so
whichever opened last won, and `app.dock.setMenu` (dock-menu) and
`app.setAsDefaultProtocolClient` (protocol-handler) had the same problem. Each
fiddle now gets its own application menu, dock menu and protocol registration,
exactly like upstream.

## IPC mapping (Electron → Lynxtron)

Lynxtron's UI↔main bridge is **callback-style**, wrapped by the kit's `bridge.ts`
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
pnpm --filter electron-fiddles build   # assemble + build all 44 fiddles, then the gallery
pnpm --filter electron-fiddles start   # build + launch the gallery
```

Working on a single fiddle is a single command — no need to build the rest:

```bash
node scripts/assemble.mjs window-state --build --run
```

A built fiddle is an ordinary Lynxtron app, so it also runs on its own:

```bash
./node_modules/.bin/lynxtron .assembled/window-state/dist/desktop
```

Launching straight from the gallery process (skips clicking, comma-separated):

```bash
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

