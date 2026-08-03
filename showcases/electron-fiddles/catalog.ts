// Single source of truth for all ported fiddles.
//
// Read by: src/home (the gallery UI), src/main/desktop/main.ts (launch
// validation), scripts/assemble.mjs (which fiddles to assemble), and
// lynxtron-go's gallery section (parsed at build time).
//
// `status`:
//   'working' — ported and expected to fully work on Lynxtron
//   'partial' — ported with a documented gap (see `notes`)
//   'na'      — not portable (Chromium/web-platform only); `notes` says why.
//              'na' rows have no source folder and are shown disabled.
//
// `id` is a short, unique, kebab-case handle used for the assembled project
// directory. `upstream` is the fiddle's path under electron/docs/fiddles and is
// ALSO where its source lives here (fiddles/<upstream>/) — the catalog is kept
// 1:1 with upstream, so every row has exactly one upstream directory.

export type FiddleStatus = 'working' | 'partial' | 'na';

export interface FiddleWindowOptions {
  width?: number;
  height?: number;
  frame?: boolean;
  transparent?: boolean;
  titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover';
  resizable?: boolean;
  alwaysOnTop?: boolean;
  backgroundColor?: string;
}

export interface FiddleMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  status: FiddleStatus;
  notes?: string;
  upstream: string;
  window?: FiddleWindowOptions;
}

export const CATEGORY_ORDER = [
  'Tutorial',
  'IPC',
  'Dialogs',
  'Notifications',
  'Menus',
  'System',
  'Windows',
  'Window Customization',
  'Screen',
  'Features',
  'Web Platform',
] as const;

export const FIDDLES: FiddleMeta[] = [
  // ── Tutorial ──────────────────────────────────────────────────────────
  {
    id: 'quick-start',
    title: 'Quick Start',
    category: 'Tutorial',
    description: 'Minimal app: a window loading a Lynx UI, showing runtime versions from preload.',
    status: 'working',
    upstream: 'quick-start',
  },
  {
    id: 'first-app',
    title: 'First App',
    category: 'Tutorial',
    description: 'The "hello world" first app window.',
    status: 'working',
    upstream: 'tutorial-first-app',
  },
  {
    id: 'preload',
    title: 'Preload Script',
    category: 'Tutorial',
    description: 'Expose Node/runtime values to the UI via contextBridge (exposeInLynxBTS).',
    status: 'working',
    upstream: 'tutorial-preload',
  },

  // ── IPC ───────────────────────────────────────────────────────────────
  {
    id: 'ipc-pattern-1',
    title: 'IPC: Renderer → Main (one-way)',
    category: 'IPC',
    description: 'UI sends a message to main to set the window title (bridge.send → lynxBridge.on).',
    status: 'working',
    upstream: 'ipc/pattern-1',
  },
  {
    id: 'ipc-pattern-2',
    title: 'IPC: Renderer ↔ Main (two-way)',
    category: 'IPC',
    description: 'UI invokes main and awaits a result — opens a file dialog and shows the path.',
    status: 'working',
    upstream: 'ipc/pattern-2',
  },
  {
    id: 'ipc-pattern-3',
    title: 'IPC: Main → Renderer',
    category: 'IPC',
    description: 'Main pushes counter updates to the UI via sendGlobalEvent.',
    status: 'working',
    upstream: 'ipc/pattern-3',
  },
  {
    id: 'ipc-webview-new-window',
    title: 'IPC: webview new-window',
    category: 'IPC',
    description: 'Communicating with an embedded <webview> child window.',
    status: 'na',
    notes: 'Depends on the Chromium <webview> tag, which Lynxtron has no equivalent for.',
    upstream: 'ipc/webview-new-window',
  },

  // ── Dialogs ───────────────────────────────────────────────────────────
  {
    id: 'dialog-information',
    title: 'Information Dialog',
    category: 'Dialogs',
    description: 'Native message box with buttons; the chosen index is relayed back to the UI.',
    status: 'working',
    upstream: 'native-ui/dialogs/information-dialog',
  },
  {
    id: 'dialog-error',
    title: 'Error Dialog',
    category: 'Dialogs',
    description: 'Native error box via dialog.showErrorBox.',
    status: 'working',
    upstream: 'native-ui/dialogs/error-dialog',
  },
  {
    id: 'dialog-open-file',
    title: 'Open File or Directory',
    category: 'Dialogs',
    description: 'dialog.showOpenDialog for files/folders; shows the selected path.',
    status: 'working',
    upstream: 'native-ui/dialogs/open-file-or-directory',
  },
  {
    id: 'dialog-save',
    title: 'Save Dialog',
    category: 'Dialogs',
    description: 'dialog.showSaveDialog; shows the chosen save path.',
    status: 'working',
    upstream: 'native-ui/dialogs/save-dialog',
  },

  // ── Notifications ─────────────────────────────────────────────────────
  {
    id: 'notification-basic',
    title: 'Notifications',
    category: 'Notifications',
    description: 'Show a native OS notification triggered from the UI.',
    status: 'working',
    upstream: 'native-ui/notifications',
  },
  {
    id: 'notification-main',
    title: 'Notification (from Main)',
    category: 'Notifications',
    description: 'Create and show a Notification in the main process.',
    status: 'working',
    upstream: 'features/notifications/main',
  },
  {
    id: 'notification-renderer',
    title: 'Notification (from Renderer)',
    category: 'Notifications',
    description: 'Trigger a notification from the UI; the Web Notification API is bridged to the main-process Notification.',
    status: 'partial',
    notes: 'Electron uses the renderer Web Notification API; Lynx has no DOM Notification, so this bridges to the main-process Notification instead.',
    upstream: 'features/notifications/renderer',
  },

  // ── Menus ─────────────────────────────────────────────────────────────
  {
    id: 'tray-menu',
    title: 'Tray Menu',
    category: 'Menus',
    description: 'A Tray icon with a context Menu built from a template.',
    status: 'working',
    upstream: 'menus/tray-menu',
  },
  {
    id: 'dock-menu',
    title: 'Dock Menu (macOS)',
    category: 'Menus',
    description: 'Set a custom dock menu via app.dock.setMenu.',
    status: 'working',
    notes: 'macOS only — the dock is undefined on other platforms.',
    upstream: 'menus/dock-menu',
  },
  {
    id: 'context-menu-web-contents',
    title: 'Context Menu',
    category: 'Menus',
    description: 'Right-click / long-press to pop up a native Menu via Menu.popup.',
    status: 'working',
    upstream: 'menus/context-menu/web-contents',
  },
  {
    id: 'context-menu-dom',
    title: 'Context Menu (element-targeted)',
    category: 'Menus',
    description: 'Long-press a specific element to open a native context menu for it.',
    status: 'working',
    upstream: 'menus/context-menu/dom',
  },
  {
    id: 'menu-shortcuts',
    title: 'Menu Shortcuts',
    category: 'Menus',
    description: 'Application-menu items with keyboard accelerators.',
    status: 'partial',
    notes: 'Electron uses globalShortcut, which Lynxtron does not export. Ported as application-menu accelerators via Menu.setApplicationMenu.',
    upstream: 'menus/shortcuts',
  },

  // ── System ────────────────────────────────────────────────────────────
  {
    id: 'clipboard-copy',
    title: 'Clipboard: Copy',
    category: 'System',
    description: 'Copy text to the system clipboard via clipboard.writeText.',
    status: 'working',
    upstream: 'system/clipboard/copy',
  },
  {
    id: 'clipboard-paste',
    title: 'Clipboard: Paste',
    category: 'System',
    description: 'Read text from the system clipboard via clipboard.readText.',
    status: 'working',
    upstream: 'system/clipboard/paste',
  },
  {
    id: 'app-information',
    title: 'App Information',
    category: 'System',
    description: 'app.getName / getVersion / getPath for common app + user paths.',
    status: 'working',
    upstream: 'system/system-app-user-information/app-information',
  },
  {
    id: 'version-information',
    title: 'Version Information',
    category: 'System',
    description: 'process.versions (node / v8 / lynxtron) surfaced via preload.',
    status: 'working',
    upstream: 'system/system-information/get-version-information',
  },
  {
    id: 'protocol-handler',
    title: 'Protocol Handler (deep link)',
    category: 'System',
    description: 'Register a custom URL scheme; incoming deep links are pushed to the UI.',
    status: 'working',
    upstream: 'system/protocol-handler/launch-app-from-URL-in-another-app',
  },

  // ── Windows ───────────────────────────────────────────────────────────
  {
    id: 'window-new',
    title: 'New Window',
    category: 'Windows',
    description: 'Open a second top-level window from the UI.',
    status: 'working',
    upstream: 'windows/manage-windows/new-window',
  },
  {
    id: 'window-events',
    title: 'Window Events',
    category: 'Windows',
    description: 'Log focus / blur / maximize / minimize / move events pushed from main.',
    status: 'working',
    upstream: 'windows/manage-windows/window-events',
  },
  {
    id: 'window-state',
    title: 'Manage Window State',
    category: 'Windows',
    description: 'Live-read window bounds; move and resize the window from the UI.',
    status: 'working',
    upstream: 'windows/manage-windows/manage-window-state',
  },
  {
    id: 'window-frameless',
    title: 'Frameless Window',
    category: 'Windows',
    description: 'A window created with frame: false.',
    status: 'working',
    window: { frame: false },
    upstream: 'windows/manage-windows/frameless-window',
  },
  {
    id: 'crashes-and-hangs',
    title: 'Crashes and Hangs',
    category: 'Windows',
    description: 'Upstream placeholder — no fiddle code exists yet.',
    status: 'na',
    notes: 'Not a Lynxtron gap: the upstream docs/fiddles/windows/crashes-and-hangs directory contains only a .keep file, so there is nothing to port. Catalogued so this matrix is provably complete against upstream.',
    upstream: 'windows/crashes-and-hangs',
  },

  // ── Window Customization ──────────────────────────────────────────────
  {
    id: 'wc-remove-title-bar',
    title: 'Remove Title Bar',
    category: 'Window Customization',
    description: 'Hide the OS title bar with titleBarStyle: hidden.',
    status: 'working',
    window: { titleBarStyle: 'hidden' },
    upstream: 'features/window-customization/custom-title-bar/remove-title-bar',
  },
  {
    id: 'wc-starter-code',
    title: 'Starter Code (default chrome)',
    category: 'Window Customization',
    description: 'The unmodified baseline window the custom-title-bar series starts from.',
    status: 'working',
    notes: "Upstream's win.loadURL('https://example.com') is not portable — a LynxWindow renders Lynx bundles, not web pages — so the window loads its own bundle. The default-chrome behaviour being demonstrated is unaffected.",
    upstream: 'features/window-customization/custom-title-bar/starter-code',
  },
  {
    id: 'wc-native-window-controls',
    title: 'Native Window Controls',
    category: 'Window Customization',
    description: 'Hidden title bar that keeps native traffic-light / control buttons.',
    status: 'working',
    window: { titleBarStyle: 'hidden' },
    upstream: 'features/window-customization/custom-title-bar/native-window-controls',
  },
  {
    id: 'wc-custom-title-bar',
    title: 'Custom Title Bar',
    category: 'Window Customization',
    description: 'Draw a custom in-content title bar with a hidden native one.',
    status: 'working',
    window: { titleBarStyle: 'hidden' },
    upstream: 'features/window-customization/custom-title-bar/custom-title-bar',
  },
  {
    id: 'wc-custom-drag-region',
    title: 'Custom Drag Region',
    category: 'Window Customization',
    description: 'A custom title bar with a draggable region.',
    status: 'working',
    notes: "Electron's -webkit-app-region: drag maps to Lynx's -x-app-region: drag.",
    window: { titleBarStyle: 'hidden' },
    upstream: 'features/window-customization/custom-title-bar/custom-drag-region',
  },
  {
    id: 'wc-safe-area',
    title: 'Title Bar Safe Area',
    category: 'Window Customization',
    description: 'Lay out content around the title-bar overlay safe area.',
    status: 'partial',
    notes: 'Depends on titlebar-overlay env() safe-area insets; approximated with a fixed inset and noted in-app.',
    window: { titleBarStyle: 'hidden' },
    upstream: 'features/window-customization/custom-title-bar/safe-area',
  },
  {
    id: 'wc-frameless',
    title: 'Frameless Window',
    category: 'Window Customization',
    description: 'A borderless window (frame: false) with in-content controls.',
    status: 'working',
    window: { frame: false },
    upstream: 'features/window-customization/custom-window-styles/frameless-windows',
  },
  {
    id: 'wc-transparent',
    title: 'Transparent Window',
    category: 'Window Customization',
    description: 'A transparent, frameless window with a floating card.',
    status: 'working',
    window: { frame: false, transparent: true, backgroundColor: '#00000000' },
    upstream: 'features/window-customization/custom-window-styles/transparent-windows',
  },

  // ── Screen ────────────────────────────────────────────────────────────
  {
    id: 'fit-screen',
    title: 'Fit Window to Screen',
    category: 'Screen',
    description: 'Read the primary display work area and resize the window to fit.',
    status: 'working',
    upstream: 'screen/fit-screen',
  },

  // ── Features ──────────────────────────────────────────────────────────
  {
    id: 'progress-bar',
    title: 'Progress Bar',
    category: 'Features',
    description: 'Drive the taskbar/dock progress indicator via win.setProgressBar.',
    status: 'working',
    upstream: 'features/progress-bar',
  },
  {
    id: 'recent-documents',
    title: 'Recent Documents',
    category: 'Features',
    description: 'Add / clear entries in the OS recent-documents list.',
    status: 'working',
    upstream: 'features/recent-documents',
  },
  {
    id: 'represented-file',
    title: 'Represented File (macOS)',
    category: 'Features',
    description: 'Reflect a represented file + edited state in the window title.',
    status: 'partial',
    notes: 'Lynxtron does not export setRepresentedFilename / setDocumentEdited (the native proxy-icon affordance). Ported via the window title (setTitle) — the cross-platform "filename — Edited" fallback.',
    upstream: 'features/represented-file',
  },
  {
    id: 'dark-mode',
    title: 'Dark Mode',
    category: 'Features',
    description: 'Toggle light / dark / system theme.',
    status: 'partial',
    notes: 'Electron uses the nativeTheme module (not exported by Lynxtron). Ported as an in-app CSS theme toggle; system-theme following is not wired.',
    upstream: 'features/dark-mode',
  },
  {
    id: 'online-detection',
    title: 'Online / Offline Detection',
    category: 'Features',
    description: 'Report network connectivity, polled from the main process.',
    status: 'partial',
    notes: 'Electron uses the renderer navigator.onLine. Lynx has no navigator; connectivity is probed from main and pushed to the UI.',
    upstream: 'features/online-detection',
  },
  {
    id: 'keyboard-web-apis',
    title: 'Keyboard Shortcuts (in-app)',
    category: 'Features',
    description: 'Handle key events within the app.',
    status: 'working',
    notes: "Electron's window keyup listener maps to Lynx's global-bindkeyup; event.key is the same.",
    upstream: 'features/keyboard-shortcuts/web-apis',
  },
  {
    id: 'keyboard-interception',
    title: 'Keyboard Interception from Main',
    category: 'Features',
    description: 'Intercept key events before the page via before-input-event.',
    status: 'na',
    notes: 'Depends on webContents before-input-event, which has no Lynxtron equivalent.',
    upstream: 'features/keyboard-shortcuts/interception-from-main',
  },
  {
    id: 'dnd-files',
    title: 'Drag & Drop (files in)',
    category: 'Features',
    description: 'Show dropped file info and reveal in the file manager.',
    status: 'partial',
    notes: 'Electron uses the HTML5 drag-and-drop API. Lynx has no HTML5 DnD; ported as a file picker + shell.showItemInFolder as the nearest demo.',
    upstream: 'features/drag-and-drop',
  },
  {
    id: 'native-drag-drop',
    title: 'Native Drag & Drop (out)',
    category: 'Features',
    description: 'Drag a file out of the app to the desktop.',
    status: 'na',
    notes: 'Depends on webContents.startDrag, which Lynxtron does not export.',
    upstream: 'native-ui/drag-and-drop',
  },
  {
    id: 'external-links',
    title: 'External Links & File Manager',
    category: 'Features',
    description: 'Open URLs in the browser and reveal paths via the shell module.',
    status: 'working',
    upstream: 'native-ui/external-links-file-manager',
  },
  {
    id: 'navigation-history',
    title: 'Navigation History',
    category: 'Features',
    description: 'Back/forward over webContents navigation history.',
    status: 'na',
    notes: 'Depends on webContents navigation history; Lynxtron has no web navigation stack.',
    upstream: 'features/navigation-history',
  },
  {
    id: 'offscreen-rendering',
    title: 'Offscreen Rendering',
    category: 'Features',
    description: 'Render a page offscreen and capture paint events.',
    status: 'na',
    notes: 'Depends on Chromium offscreen rendering / paint events.',
    upstream: 'features/offscreen-rendering',
  },
  {
    id: 'screenshot',
    title: 'Take a Screenshot',
    category: 'Features',
    description: 'Capture the screen via desktopCapturer.',
    status: 'na',
    notes: 'Depends on desktopCapturer / getUserMedia, not exported by Lynxtron.',
    upstream: 'media/screenshot/take-screenshot',
  },

  // ── Web Platform (Chromium device APIs — not portable) ────────────────
  {
    id: 'web-bluetooth',
    title: 'Web Bluetooth',
    category: 'Web Platform',
    description: 'navigator.bluetooth device access.',
    status: 'na',
    notes: 'Chromium web-platform device API; no Lynxtron equivalent.',
    upstream: 'features/web-bluetooth',
  },
  {
    id: 'web-hid',
    title: 'WebHID',
    category: 'Web Platform',
    description: 'navigator.hid device access.',
    status: 'na',
    notes: 'Chromium web-platform device API; no Lynxtron equivalent.',
    upstream: 'features/web-hid',
  },
  {
    id: 'web-serial',
    title: 'Web Serial',
    category: 'Web Platform',
    description: 'navigator.serial device access.',
    status: 'na',
    notes: 'Chromium web-platform device API; no Lynxtron equivalent.',
    upstream: 'features/web-serial',
  },
  {
    id: 'web-usb',
    title: 'WebUSB',
    category: 'Web Platform',
    description: 'navigator.usb device access.',
    status: 'na',
    notes: 'Chromium web-platform device API; no Lynxtron equivalent.',
    upstream: 'features/web-usb',
  },
];
