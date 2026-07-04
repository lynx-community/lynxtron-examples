import fs from 'fs';
import type { LynxWindow as LynxWindowInstance } from '@lynx-js/lynxtron';
import { LYNX_BUNDLE_PATH } from './vendorPaths';
import path from 'path';
import { fetchExampleArtifact } from './example-artifact';
import {
  PUBLIC_DEEP_LINK_SCHEME,
  extractDeepLinkUrlFromArgv,
  parseDeepLinkUrl,
  type HostDeepLinkPayload,
} from '../../shared/deep-link';

const { app, LynxWindow, dialog, Menu } =
  require('lynxtron') as typeof import('@lynx-js/lynxtron');
const isDev = process.env.NODE_ENV === 'development';
const bundleUrlWindows: LynxWindowInstance[] = [];
const bundleFileWindows: LynxWindowInstance[] = [];
let mainWindow: LynxWindowInstance | null = null;
let mainWindowUiReady = false;
let pendingDeepLinkPayload: HostDeepLinkPayload | null = null;

// Register native extensions
// HTTP service first: it backs the standard Lynx Fetch API for every
// LynxView in the process (the desktop host ships no HTTP service of its
// own — without this, UI-side fetch() fails with
// "request_func is unimplemented").
try {
  const registered = require('lynxtron-http-service').setUp();
  if (registered) {
    console.log('[PC_Host] HttpService extension registered');
  } else {
    console.warn('[PC_Host] HttpService extension skipped');
  }
} catch (e) {
  console.error('[PC_Host] Failed to register lynxtron-http-service:', e);
}
try {
  const registered = require('lynxtron-scintilla-editor').setUp();
  if (registered) {
    console.log('[PC_Host] ScintillaEditor extension registered');
  } else {
    console.warn('[PC_Host] ScintillaEditor extension skipped');
  }
} catch (e) {
  console.error('[PC_Host] Failed to register lynxtron-scintilla-editor:', e);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringParam(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value.trim() : '';
}

function focusMainWindow() {
  if (!mainWindow) return;
  try {
    mainWindow.show();
  } catch (e) {
    console.warn('[PC_Host] Failed to focus main window:', e);
  }
}

function notifyUiDeepLinkPending() {
  if (!mainWindow || !mainWindowUiReady || !pendingDeepLinkPayload) return;
  try {
    const ok = mainWindow.sendGlobalEvent('ide:deepLinkPending', {});
    console.log('[PC_Host] sendGlobalEvent(ide:deepLinkPending) returned:', ok);
  } catch (e) {
    console.error('[PC_Host] Failed to notify ide:deepLinkPending:', e);
  }
}

function queueDeepLink(rawUrl: string, source: string) {
  const parsed = parseDeepLinkUrl(rawUrl);
  if (parsed.ok) {
    pendingDeepLinkPayload = {
      kind: 'intent',
      intent: parsed.intent,
      rawUrl,
      source,
    };
    console.log('[PC_Host] queued deep link intent:', pendingDeepLinkPayload);
  } else {
    pendingDeepLinkPayload = {
      kind: 'error',
      error: parsed.error,
      rawUrl,
      source,
    };
    console.warn(
      '[PC_Host] queued deep link parse error:',
      pendingDeepLinkPayload,
    );
  }
  notifyUiDeepLinkPending();
}

function consumePendingDeepLink(): HostDeepLinkPayload | null {
  const payload = pendingDeepLinkPayload;
  pendingDeepLinkPayload = null;
  return payload;
}

function handleIncomingDeepLink(rawUrl: string, source: string) {
  if (!rawUrl?.trim()) return;
  queueDeepLink(rawUrl.trim(), source);
  focusMainWindow();
}

function handleDeepLinkFromArgv(argv: string[], source: string) {
  const rawUrl = extractDeepLinkUrlFromArgv(argv);
  if (!rawUrl) return;
  handleIncomingDeepLink(rawUrl, source);
}

function registerDeepLinkLifecycle() {
  app.on('open-url', (event: any, rawUrl: string) => {
    try {
      event?.preventDefault?.();
    } catch (_) {}
    console.log('[PC_Host] open-url received:', rawUrl);
    handleIncomingDeepLink(rawUrl, 'open-url');
  });

  app.on('second-instance', (_event: any, argv: string[], cwd: string) => {
    console.log('[PC_Host] second-instance received:', { argv, cwd });
    handleDeepLinkFromArgv(Array.isArray(argv) ? argv : [], 'second-instance');
    focusMainWindow();
  });

  handleDeepLinkFromArgv(process.argv, 'process-argv');
}

function registerDeepLinkProtocolClient() {
  try {
    if (process.platform === 'win32' && !app.isPackaged) {
      // Preview runs through the shared lynxtron.exe, so include the app path before "%1".
      const runtimePath = process.execPath;
      const appPath = path.resolve(__dirname);
      const launchArgs = [appPath];
      const registered = app.setAsDefaultProtocolClient(
        PUBLIC_DEEP_LINK_SCHEME,
        runtimePath,
        launchArgs,
      );
      const isDefault = app.isDefaultProtocolClient(
        PUBLIC_DEEP_LINK_SCHEME,
        runtimePath,
        launchArgs,
      );
      console.log(
        `[PC_Host] setAsDefaultProtocolClient(${PUBLIC_DEEP_LINK_SCHEME}, preview) returned:`,
        {
          registered,
          isDefault,
          runtimePath,
          appPath,
        },
      );
      return;
    }

    if (!app.isPackaged) {
      console.log(
        `[PC_Host] skip setAsDefaultProtocolClient(${PUBLIC_DEEP_LINK_SCHEME}) in dev runtime`,
      );
      return;
    }

    const registered = app.setAsDefaultProtocolClient(PUBLIC_DEEP_LINK_SCHEME);
    const isDefault = app.isDefaultProtocolClient(PUBLIC_DEEP_LINK_SCHEME);
    console.log(
      `[PC_Host] setAsDefaultProtocolClient(${PUBLIC_DEEP_LINK_SCHEME}) returned:`,
      {
        registered,
        isDefault,
      },
    );
  } catch (e) {
    console.warn('[PC_Host] Failed to register default protocol client:', e);
  }
}

// Build application menu with IDE keyboard shortcuts.
// Shortcuts send global events to the Lynx UI via w.sendGlobalEvent().
function buildAppMenu(w: LynxWindowInstance) {
  const sendCmd = (cmd: string) => {
    console.log(`[PC_Host] sendCmd: ${cmd}`);
    try {
      // Use per-command event names since GlobalEventEmitter.emit drops the data payload
      const ok = w.sendGlobalEvent(`ide:${cmd}`, {});
      console.log(`[PC_Host] sendGlobalEvent('ide:${cmd}') returned:`, ok);
    } catch (e) {
      console.error(`[PC_Host] sendGlobalEvent error:`, e);
    }
  };

  const template: any[] = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const fileSubmenu: any[] = [
    {
      id: 'openFolder',
      label: 'Open Folder...',
      accelerator: 'CmdOrCtrl+Shift+O',
      registerAccelerator: true,
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          try {
            w.sendGlobalEvent('folderOpened', { path: result.filePaths[0] });
          } catch (_) {}
        }
      },
    },
    {
      id: 'quickOpen',
      label: 'Quick Open...',
      accelerator: 'CmdOrCtrl+P',
      registerAccelerator: true,
      click: () => sendCmd('quickOpen'),
    },
    { type: 'separator' },
    {
      id: 'save',
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      registerAccelerator: true,
      click: () => sendCmd('save'),
    },
    { type: 'separator' },
    {
      id: 'closeTab',
      label: 'Close Tab',
      accelerator: 'CmdOrCtrl+W',
      registerAccelerator: true,
      click: () => sendCmd('closeTab'),
    },
  ];

  if (process.platform !== 'darwin') {
    fileSubmenu.push({ type: 'separator' }, { label: 'Exit', role: 'quit' });
  }

  template.push({
    label: 'File',
    submenu: fileSubmenu,
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        id: 'findInFile',
        label: 'Find',
        accelerator: 'CmdOrCtrl+F',
        registerAccelerator: true,
        click: () => sendCmd('findInFile'),
      },
      {
        id: 'findInFiles',
        label: 'Find in Files',
        accelerator: 'CmdOrCtrl+Shift+F',
        registerAccelerator: true,
        click: () => sendCmd('findInFiles'),
      },
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      {
        id: 'togglePanel',
        label: 'Toggle Panel',
        accelerator: 'CmdOrCtrl+J',
        registerAccelerator: true,
        click: () => sendCmd('togglePanel'),
      },
      { type: 'separator' },
      { role: 'reload' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });

  template.push({
    label: 'Run',
    submenu: [
      {
        id: 'runShowcase',
        label: 'Run',
        accelerator: 'CmdOrCtrl+R',
        registerAccelerator: true,
        click: () => sendCmd('runShowcase'),
      },
      {
        label: 'Run on Web',
        click: () => sendCmd('runShowcaseWeb'),
      },
      {
        label: 'Debug',
        click: () => sendCmd('devShowcase'),
      },
      {
        label: 'Debug on Web',
        click: () => sendCmd('devShowcaseWeb'),
      },
      {
        label: 'Install Dependencies',
        click: () => sendCmd('installShowcaseDependencies'),
      },
      { type: 'separator' },
      {
        id: 'stopShowcase',
        label: 'Stop Showcase',
        accelerator: 'CmdOrCtrl+Shift+R',
        registerAccelerator: true,
        click: () => sendCmd('stopShowcase'),
      },
    ],
  });

  if (process.platform !== 'darwin') {
    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'About Lynxtron Go',
          click: () =>
            dialog.showMessageBox({
              message: 'Lynxtron Go',
              detail: `Version ${app.getVersion()}`,
            }),
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (process.platform === 'win32') {
    try {
      w.setAutoHideMenuBar(false);
    } catch (e) {
      console.warn('[PC_Host] setAutoHideMenuBar(false) failed:', e);
    }
  }
}

console.log('[PC_Host] Lynxtron Hello World');
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  console.log(
    '[PC_Host] another Lynxtron Go instance is running; forwarding command line and quitting',
  );
  app.quit();
} else {
  registerDeepLinkLifecycle();
  app.whenReady().then(() => {
    registerDeepLinkProtocolClient();

    const w = new LynxWindow({
      width: 1200,
      height: 800,
      title: 'Lynxtron Go',
      autoHideMenuBar: false,
      lynxPreference: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    mainWindow = w;
    console.log(
      '[PC_Host] LynxWindow created',
      path.join(__dirname, 'preload.js'),
    );
    try {
      buildAppMenu(w);
      console.log('[PC_Host] buildAppMenu completed successfully');
    } catch (e) {
      console.error('[PC_Host] buildAppMenu FAILED:', e);
    }

    // Handle fire-and-forget bridge messages from Lynx UI.
    w.on('-lynx-message', (name, data) => {
      const params = asRecord(data);
      console.log(`[PC_Host] NativeModule Message: bridge.${name}`, data);

      if (name === 'logFromUi') {
        const message =
          typeof params.message === 'string'
            ? params.message
            : String(params.message ?? '');
        console.log('[IDE]', message);
      }
    });

    // Handle bridge calls from Lynx UI
    w.on(
      '-lynx-invoke',
      async (callback, name, data) => {
        const params = asRecord(data);
        // In our architecture, UI calls NativeModules.bridge.request({ method, params })
        console.log(
          `[PC_Host] NativeModule Call: bridge.${name}`,
          data,
          callback,
          name,
        );

        if (name === 'getUserDataPath') {
          callback.sendReply(app.getPath('userData'));
          return;
        }

        if (name === 'showDialog') {
          dialog.showMessageBox({ message: String(params.message ?? '') });
          callback.sendReply();
        } else if (name === 'consumePendingDeepLink') {
          mainWindowUiReady = true;
          const payload = consumePendingDeepLink();
          callback.sendReply(payload);
          notifyUiDeepLinkPending();
        } else if (name === 'fetchExampleArtifact') {
          const relativePath = stringParam(params, 'relativePath');
          if (!relativePath) {
            callback.sendReply({
              ok: false,
              error: {
                code: 'INVALID_INPUT',
                message: 'Example id is required',
              },
            });
            return;
          }
          try {
            callback.sendReply(await fetchExampleArtifact(relativePath));
          } catch (e: any) {
            console.error('[PC_Host] fetchExampleArtifact FAILED:', e);
            callback.sendReply({
              ok: false,
              error: {
                code: 'NETWORK_ERROR',
                message: 'Example fetch failed',
                detail: e?.message || String(e),
              },
            });
          }
        } else if (name === 'getAppVersion') {
          callback.sendReply(app.getVersion());
        } else if (name === 'openFolder') {
          const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
          });
          if (!result.canceled && result.filePaths.length > 0) {
            const folderPath = result.filePaths[0];
            callback.sendReply({ path: folderPath });
            // Also send via global event as fallback (may fail on some Lynxtron versions)
            try {
              w.sendGlobalEvent('folderOpened', { path: folderPath });
            } catch (_) {}
          } else {
            callback.sendReply({});
          }
        } else if (name === 'openBundleUrl') {
          console.log('[PC_Host] start openBundleUrl');
          const url = stringParam(params, 'url');
          const title = stringParam(params, 'title') || 'Bundle URL Preview';
          if (!url) {
            console.log('[PC_Host] openBundleUrl invalid request: missing url');
            callback.sendReply({ ok: false, error: 'Missing bundle URL' });
            return;
          }
          try {
            console.log('[PC_Host] openBundleUrl creating LynxWindow', {
              url,
              title,
            });
            const bundleWin = new LynxWindow({
              width: 1120,
              height: 780,
              title,
            });
            console.log('[PC_Host] openBundleUrl LynxWindow created', {
              title,
              hasWindow: !!bundleWin,
            });
            bundleUrlWindows.push(bundleWin);
            bundleWin.on('closed', () => {
              const idx = bundleUrlWindows.indexOf(bundleWin);
              if (idx >= 0) bundleUrlWindows.splice(idx, 1);
            });
            bundleWin.show();
            const loaded = bundleWin.loadURL(url);
            console.log('[PC_Host] openBundleUrl loadURL result:', loaded, url);
            const reply = { ok: true, url, title };
            console.log('[PC_Host] openBundleUrl callback reply:', reply);
            callback.sendReply(reply);
          } catch (e: any) {
            console.error('[PC_Host] openBundleUrl FAILED:', e);
            const reply = { ok: false, error: e?.message || String(e) };
            console.error('[PC_Host] openBundleUrl callback reply:', reply);
            callback.sendReply(reply);
          }
        } else if (name === 'openBundleFile') {
          const requestedPath = stringParam(params, 'path');
          const title = stringParam(params, 'title') || 'Bundle File Preview';

          const openBundleFileWindow = (bundlePath: string) => {
            if (!bundlePath.endsWith('.lynx.bundle')) {
              callback.sendReply({
                ok: false,
                error: 'Expected a .lynx.bundle file',
              });
              return;
            }
            if (
              !fs.existsSync(bundlePath) ||
              !fs.statSync(bundlePath).isFile()
            ) {
              callback.sendReply({
                ok: false,
                error: `Bundle file not found: ${bundlePath}`,
              });
              return;
            }
            try {
              console.log('[PC_Host] openBundleFile creating LynxWindow', {
                bundlePath,
                title,
              });
              const bundleWin = new LynxWindow({
                width: 1120,
                height: 780,
                title,
              });
              console.log('[PC_Host] openBundleFile LynxWindow created', {
                title,
                hasWindow: !!bundleWin,
              });
              bundleFileWindows.push(bundleWin);
              bundleWin.on('closed', () => {
                const idx = bundleFileWindows.indexOf(bundleWin);
                if (idx >= 0) bundleFileWindows.splice(idx, 1);
              });
              bundleWin.show();
              const loaded = bundleWin.loadFile(bundlePath);
              console.log(
                '[PC_Host] openBundleFile loadFile result:',
                loaded,
                bundlePath,
              );
              callback.sendReply({ ok: !!loaded, path: bundlePath, title });
            } catch (e: any) {
              console.error('[PC_Host] openBundleFile FAILED:', e);
              callback.sendReply({ ok: false, error: e?.message || String(e) });
            }
          };

          if (requestedPath) {
            openBundleFileWindow(requestedPath);
            return;
          }

          try {
            const result = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [{ name: 'Lynx bundle', extensions: ['bundle'] }],
            });
            if (result.canceled || result.filePaths.length === 0) {
              callback.sendReply({ ok: false, canceled: true });
              return;
            }
            openBundleFileWindow(result.filePaths[0]);
          } catch (e: any) {
            console.error('[PC_Host] openBundleFile dialog FAILED:', e);
            callback.sendReply({ ok: false, error: e?.message || String(e) });
          }
        }
      },
    );

    w.show();
    if (isDev) {
      w.loadURL('http://localhost:3000/main.lynx.bundle');
    } else {
      console.log('[PC_Host] Loading bundle file:', LYNX_BUNDLE_PATH);
      w.loadFile(LYNX_BUNDLE_PATH);
    }
  });

}
