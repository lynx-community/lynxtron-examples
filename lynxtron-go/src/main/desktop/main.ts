import fs from 'fs';
import os from 'os';
import { spawn, execFileSync } from 'child_process';
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
// The foundation-service thread's `process.versions` has no `lynxtron` key —
// only the main process sees it. Hand it over via env for the UI's version
// button (preload-foundation-service reads it as a fallback).
if (process.versions.lynxtron && !process.env.LYNXTRON_RUNTIME_VERSION) {
  process.env.LYNXTRON_RUNTIME_VERSION = process.versions.lynxtron;
}
// GUI-launched apps on macOS/Linux inherit a stripped PATH (launchd/Finder only
// hand out /usr/bin:/bin:/usr/sbin:/sbin), so pnpm/node installed via nvm,
// homebrew, corepack, etc. are invisible to child processes. Ask the user's
// login shell what its PATH looks like and merge it in.
function inheritShellPath(): void {
  if (process.platform === 'win32') return;
  if (process.env.LYNXTRON_SHELL_PATH_FIXED === '1') return;
  const shell = process.env.SHELL || '/bin/bash';
  const query = 'echo __PATH_START__:$PATH:__PATH_END__';
  const shellEnv = {
    ...process.env,
    DISABLE_AUTO_UPDATE: 'true',
    ZSH_TMUX_AUTOSTARTED: 'true',
    ZSH_TMUX_AUTOSTART: 'false',
  };
  const tryShell = (args: string[]): string | null => {
    try {
      const out = execFileSync(shell, args, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: shellEnv,
      });
      const match = out.match(/__PATH_START__:(.*?):__PATH_END__/);
      return match?.[1] || null;
    } catch {
      return null;
    }
  };
  // Prefer -ilc (interactive login) so nvm/rc-based tools are visible; fall
  // back to -lc if the interactive init hangs or bails.
  const shellPath = tryShell(['-ilc', query]) ?? tryShell(['-lc', query]);
  if (!shellPath) {
    console.warn('[PC_Host] Could not read login shell PATH; PATH stays as launched');
    return;
  }
  const existing = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const additions = shellPath.split(path.delimiter).filter(Boolean);
  process.env.PATH = Array.from(new Set([...existing, ...additions])).join(path.delimiter);
  process.env.LYNXTRON_SHELL_PATH_FIXED = '1';
}
inheritShellPath();

// pnpm's shebang is `#!/usr/bin/env node`, so subprocess `pnpm install` calls
// (spawned by the CLI when fetching a showcase) need to find a `node` on PATH.
// Packaged apps launched from Finder rarely have one. Ship a shim that
// re-executes the current lynxtron binary in Node mode (LYNXTRON_RUN_AS_NODE=1)
// and prepend it to PATH so any child looking for `node` finds ours. Also
// prepend the bundled pnpm's bin dir so plain `pnpm` resolves.
function installBundledNodeShim(): void {
  try {
    const shimDir = path.join(os.homedir(), '.lynxtron-go', 'bin');
    fs.mkdirSync(shimDir, { recursive: true });

    const isWindows = process.platform === 'win32';
    const execPath = process.execPath;

    // Locate bundled pnpm shipped next to app.asar.unpacked/node_modules/pnpm.
    const resourcesDir = isWindows
      ? path.join(path.dirname(execPath), 'resources')
      : path.join(path.dirname(path.dirname(execPath)), 'Resources');
    const pnpmCandidates = [
      path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
      path.join(resourcesDir, 'app', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    ];
    const pnpmCjs = pnpmCandidates.find((p) => fs.existsSync(p));
    const pnpmBinDirs = pnpmCandidates
      .map((p) => path.dirname(p))
      .filter((dir) => fs.existsSync(dir));

    if (isWindows) {
      const nodeCmd = path.join(shimDir, 'node.cmd');
      // Set LYNXTRON_RUN_AS_NODE only for the child so we don't recurse in on ourselves.
      const cmdBody = `@echo off\r\nset "LYNXTRON_RUN_AS_NODE=1"\r\n"${execPath}" %*\r\n`;
      fs.writeFileSync(nodeCmd, cmdBody);
      // Third-party postinstall scripts (e.g. older lynxtron-rebuild) invoke
      // `npx node-gyp rebuild`, but packaged apps ship neither npm nor npx.
      // Fall back to bundled pnpm's `exec`, which resolves binaries the same
      // way (node_modules/.bin lookup) using our node shim as the runtime.
      if (pnpmCjs) {
        const npxCmd = path.join(shimDir, 'npx.cmd');
        const npxBody = `@echo off\r\nset "LYNXTRON_RUN_AS_NODE=1"\r\n"${execPath}" "${pnpmCjs}" exec %*\r\n`;
        fs.writeFileSync(npxCmd, npxBody);
      }
    } else {
      const nodeShim = path.join(shimDir, 'node');
      const shBody = `#!/bin/sh\nexec env LYNXTRON_RUN_AS_NODE=1 "${execPath}" "$@"\n`;
      fs.writeFileSync(nodeShim, shBody);
      fs.chmodSync(nodeShim, 0o755);
      if (pnpmCjs) {
        const npxShim = path.join(shimDir, 'npx');
        const npxBody = `#!/bin/sh\nexec env LYNXTRON_RUN_AS_NODE=1 "${execPath}" "${pnpmCjs}" exec "$@"\n`;
        fs.writeFileSync(npxShim, npxBody);
        fs.chmodSync(npxShim, 0o755);
      }
    }

    const existing = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    process.env.PATH = Array.from(
      new Set([shimDir, ...pnpmBinDirs, ...existing]),
    ).join(path.delimiter);
  } catch (err) {
    console.warn('[PC_Host] installBundledNodeShim failed:', err);
  }
}
installBundledNodeShim();
const isDev = process.env.NODE_ENV === 'development';
// Bundle preview windows (from deep links / bridge calls) — one list, they
// share a lifecycle and the tracking only exists to keep them alive.
const previewWindows: LynxWindowInstance[] = [];
let mainWindow: LynxWindowInstance | null = null;
let mainWindowUiReady = false;
// Depth-1 on purpose: rapid successive deep links keep only the newest —
// replaying a backlog of stale navigations would be worse than dropping them.
let pendingDeepLinkPayload: HostDeepLinkPayload | null = null;
// Pending ⌘Q: armed by the Quit menu item, disarmed by the UI's persistDone
// ack (which quits immediately) or by its own dead-man expiry.
let quitFlushTimer: ReturnType<typeof setTimeout> | null = null;
// Which product the menu is currently built for, and the window it belongs to.
// The UI is the only thing that knows which surface it is showing, so it
// reports through the setSurface bridge call and the menu is rebuilt to match.
let menuSurface: MenuSurface = 'fiddle';
let menuWindow: LynxWindowInstance | null = null;

// Register native extensions
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

// The runtime's built-in generic-resource fetcher only speaks http(s):
// file:// assets (fonts, images emitted by rspeedy with a file:// assetPrefix)
// get an empty "Unsupported protocol" reply. Replace the built-in listener
// with one that serves file:// from disk and keeps http(s) working.
// Must be installed on EVERY LynxWindow — secondary bundle-preview windows
// hit the same built-in limitation.
// allowedFileRoots scopes what file:// may serve: the fetcher otherwise
// hands ANY on-disk path to whatever bundle runs in the window — remote
// bundle-URL previews must pass [] (no disk access at all).
function installFileResourceFetcher(win: LynxWindowInstance, allowedFileRoots: string[]) {
  const roots = allowedFileRoots.map((r) => path.resolve(r) + path.sep);
  const isAllowedFilePath = (p: string) => {
    const resolved = path.resolve(p);
    return roots.some((root) => resolved.startsWith(root));
  };
  try {
    (win as any).removeAllListeners?.('-on-fetch-resource');
    (win as any).on(
      '-on-fetch-resource',
      async (
        event: { sendReply: (r: { url: string; statusCode: number; data: Buffer }) => void },
        resourceType: string,
        url: string,
      ) => {
        const urlString = String(url ?? '');
        const fail = () =>
          event.sendReply({ url: urlString, statusCode: 1, data: Buffer.alloc(0) });
        try {
          const parsed = new URL(urlString);
          if (parsed.protocol === 'file:') {
            const filePath = decodeURIComponent(parsed.pathname);
            if (!isAllowedFilePath(filePath)) {
              console.log('[PC_Host] fetch-resource: file:// path outside allowed roots:', filePath);
              fail();
              return;
            }
            const data = await fs.promises.readFile(filePath);
            event.sendReply({ url: urlString, statusCode: 0, data });
            console.log(
              `[PC_Host] fetch-resource(${resourceType}) file:// served ${data.length}B: ${filePath}`,
            );
            return;
          }
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            const res = (await fetch(parsed.href)) as unknown as {
              status: number;
              arrayBuffer(): Promise<ArrayBuffer>;
            };
            const buf = Buffer.from(await res.arrayBuffer());
            event.sendReply({
              url: parsed.href,
              statusCode: res.status === 200 ? 0 : res.status || 1,
              data: buf,
            });
            return;
          }
          console.log('[PC_Host] fetch-resource: unsupported protocol', parsed.protocol);
          fail();
        } catch (e) {
          console.log('[PC_Host] fetch-resource error:', e);
          fail();
        }
      },
    );
  } catch (e) {
    console.warn('[PC_Host] failed to install file:// resource fetcher:', e);
  }
}

// Launch the platform opener with a URL or file path (Lynxtron has no CEF
// webview — pages open outside the app, in the default browser).
function spawnPlatformOpener(target: string): boolean {
  try {
    // Absolute paths on purpose: a PATH-shimmed `open` (terminal
    // multiplexers install one) would swallow the file instead of handing
    // it to the default browser.
    const opener = process.platform === 'darwin' ? '/usr/bin/open'
      : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
    spawn(opener, args, { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch (e) {
    console.warn('[PC_Host] platform opener failed:', e);
    return false;
  }
}

// http(s) links: prefer the runtime's shell.openExternal when this build
// ships it; fall back to the platform opener.
function openExternalUrl(url: string): boolean {
  try {
    const { shell } = require('lynxtron');
    if (shell?.openExternal) {
      shell.openExternal(url);
      return true;
    }
  } catch (_) { /* runtime without shell — use the platform opener */ }
  return spawnPlatformOpener(url);
}

// The help page ships next to main.js (rspack copies src/main/desktop/
// help.html). LOCAL FILE deliberately goes through the platform opener, not
// shell.openExternal — the runtime's openExternal focuses the browser but
// silently drops file:// URLs (verified live).
function openHelpPage(): boolean {
  const helpPath = path.join(__dirname, 'help.html');
  if (!fs.existsSync(helpPath)) {
    console.warn('[PC_Host] help.html missing at', helpPath);
    return false;
  }
  return spawnPlatformOpener(helpPath);
}

// One shape for all bundle preview windows: create, scope file:// access,
// track for lifetime, show. The caller only decides what to load.
function openPreviewWindow(title: string, fileRoots: string[]): LynxWindowInstance {
  const win = new LynxWindow({ width: 1120, height: 780, title });
  installFileResourceFetcher(win, fileRoots);
  previewWindows.push(win);
  win.on('closed', () => {
    const idx = previewWindows.indexOf(win);
    if (idx >= 0) previewWindows.splice(idx, 1);
  });
  win.show();
  return win;
}

// Build application menu with IDE keyboard shortcuts.
// The app menu mirrors upstream Electron Fiddle's menu (src/main/menu.ts):
// File (New Fiddle / Open / Save / Publish to Gist), Edit roles, View, Tasks
// (Run / Stop), Help. Items send `fiddle:*` global events consumed by
// Fiddle.tsx via GlobalEventEmitter.
/**
 * Which product the window is currently showing. The two surfaces listen on
 * two different channels — `fiddle:*` is handled by Fiddle.tsx, `ide:*` by
 * App.tsx — and only one of them is mounted at a time (App.tsx renders either
 * the Fiddle or the IDE, never both). So a menu that always sends `fiddle:*`
 * is silently dead on the workspace surface, which is exactly how Cmd+S,
 * Cmd+O, Cmd+W, Cmd+J and Cmd+R came to do nothing in the IDE: the Fiddle port
 * rewrote the menu around `fiddle:*` and left App.tsx's `ide:*` listeners with
 * no sender at all.
 *
 * The renderer reports its surface through the `setSurface` bridge call, and
 * the menu is rebuilt so every accelerator reaches the surface that is
 * actually mounted — and so items belonging to the other product are absent
 * rather than present-but-inert.
 */
type MenuSurface = 'fiddle' | 'workspace';

/**
 * Re-issue whichever load brought this window up. The same two branches as the
 * initial load, deliberately: a dev window points at the rspeedy server and a
 * packaged one at the bundle on disk, and a reload that swapped between them
 * would be a different window, not the same one again.
 */
function reloadWindow(w: LynxWindowInstance) {
  try {
    if (isDev) {
      w.loadURL('http://localhost:3000/main.lynx.bundle');
    } else {
      w.loadFile(LYNX_BUNDLE_PATH);
    }
    console.log('[PC_Host] menu: reload');
  } catch (e: any) {
    console.error('[PC_Host] reload failed:', e?.message ?? String(e));
  }
}

function buildAppMenu(w: LynxWindowInstance, surface: MenuSurface) {
  const isWorkspace = surface === 'workspace';
  /** Fiddle surface only — Fiddle.tsx is unmounted on the workspace surface. */
  const sendCmd = (cmd: string, data: Record<string, unknown> = {}) => {
    console.log(`[PC_Host] menu: fiddle:${cmd}`);
    try {
      w.sendGlobalEvent(`fiddle:${cmd}`, data);
    } catch (e) {
      console.error(`[PC_Host] sendGlobalEvent error:`, e);
    }
  };
  /** Workspace surface only — handled by App.tsx's ide:* listeners. */
  const sendIde = (cmd: string, data: Record<string, unknown> = {}) => {
    console.log(`[PC_Host] menu: ide:${cmd}`);
    try {
      w.sendGlobalEvent(`ide:${cmd}`, data);
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
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          registerAccelerator: true,
          // The settings dialog is a Fiddle component. Disabled rather than
          // silently inert on the workspace surface; giving the IDE its own
          // settings surface is a separate piece of work.
          enabled: !isWorkspace,
          click: () => sendCmd('openSettings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        {
          label: 'Quit ' + app.name,
          accelerator: 'CmdOrCtrl+Q',
          registerAccelerator: true,
          // Session persistence runs on a 1.5s interval — an instant ⌘Q could
          // drop the last keystrokes. Ask the UI to flush and quit on its
          // persistDone ack; the timeout is only a dead-man fallback for a
          // hung/absent UI (a fixed sleep alone both raced busy UIs and made
          // idle quits pointlessly slow).
          click: () => {
            sendCmd('persistNow');
            quitFlushTimer = setTimeout(() => {
              quitFlushTimer = null;
              try { app.quit(); } catch (_) {}
            }, 1000);
          },
        },
      ],
    });
  }

  // Cmd+P and Cmd+K exist on BOTH surfaces, and are the one pair that must NOT
  // be routed by surface: the palette is a single App-level component that
  // floats over whichever product is mounted, so App.tsx owns both events
  // regardless. Fiddle.tsx has no quickOpen/commandPalette handler at all —
  // sending it fiddle:* here silently killed Cmd+P and Cmd+K on the home
  // surface. The ide: prefix is legacy naming for "App-level", not "IDE-only".
  const paletteItems: any[] = [
    {
      id: 'quickOpen',
      label: 'Quick Open…',
      accelerator: 'CmdOrCtrl+P',
      registerAccelerator: true,
      click: () => sendIde('quickOpen'),
    },
    {
      id: 'commandPalette',
      label: 'Command Palette…',
      accelerator: 'CmdOrCtrl+K',
      registerAccelerator: true,
      // The same palette Cmd+P opens, pre-filled with '>' — i.e. exactly
      // "Cmd+P then type >". Like every other shortcut here it round-trips
      // through the main process: these are menu accelerators, not Lynx key
      // handlers, which Lynx has no way to register for arrow/Escape keys.
      click: () => sendIde('commandPalette'),
    },
  ];

  const fileSubmenu: any[] = isWorkspace
    ? [
        {
          id: 'openFolder',
          // Says where it goes. The IDE is always its own window now, so this
          // no longer replaces whatever you were working in.
          label: 'Open Folder in IDE…',
          accelerator: 'CmdOrCtrl+O',
          registerAccelerator: true,
          // App.tsx runs the native dialog itself through the openFolder
          // bridge call. The Fiddle surface's Open… cannot stand in here: it
          // feeds the path to loadLocalFiddle, which rejects any folder that
          // is not already fiddle-shaped.
          click: () => sendIde('openFolder'),
        },
        { type: 'separator' },
        ...paletteItems,
        { type: 'separator' },
        {
          id: 'save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          registerAccelerator: true,
          click: () => sendIde('save'),
        },
        {
          id: 'closeTab',
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          registerAccelerator: true,
          click: () => sendIde('closeTab'),
        },
      ]
    : [
        {
          id: 'newFiddle',
          label: 'New Fiddle',
          accelerator: 'CmdOrCtrl+N',
          registerAccelerator: true,
          click: () => sendCmd('newFiddle'),
        },
        { type: 'separator' },
        {
          id: 'open',
          // Loads a folder's fiddle files into THIS Fiddle (fiddle:openFolder
          // → loadLocalFiddle). Distinct from "Open Folder in IDE…" below,
          // which opens a workspace in its own window — the two used to be
          // "Open..." and "Open Folder…", which said nothing about either.
          label: 'Open Fiddle Folder…',
          accelerator: 'CmdOrCtrl+O',
          registerAccelerator: true,
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              sendCmd('openFolder', { path: result.filePaths[0] });
            }
          },
        },
        ...paletteItems,
        { type: 'separator' },
        {
          id: 'save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          registerAccelerator: true,
          click: () => sendCmd('save'),
        },
        {
          id: 'publish',
          label: 'Publish to Gist',
          click: () => sendCmd('publish'),
        },
      ];

  if (process.platform !== 'darwin') {
    fileSubmenu.push(
      { type: 'separator' },
      {
        label: 'Preferences',
        accelerator: 'CmdOrCtrl+,',
        registerAccelerator: true,
        click: () => sendCmd('openSettings'),
      },
      { type: 'separator' },
      { label: 'Exit', role: 'quit' },
    );
  }

  template.push({ label: 'File', submenu: fileSubmenu });

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
      // Find belongs to the IDE's file tree and editor tabs; the Fiddle has no
      // corresponding surface, so these appear only where they work.
      ...(isWorkspace
        ? [
            { type: 'separator' },
            {
              id: 'findInFile',
              label: 'Find',
              accelerator: 'CmdOrCtrl+F',
              registerAccelerator: true,
              click: () => sendIde('findInFile'),
            },
            {
              id: 'findInFiles',
              label: 'Find in Files',
              accelerator: 'CmdOrCtrl+Shift+F',
              registerAccelerator: true,
              click: () => sendIde('findInFiles'),
            },
          ]
        : []),
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      isWorkspace
        ? {
            id: 'togglePanel',
            label: 'Toggle Panel',
            accelerator: 'CmdOrCtrl+J',
            registerAccelerator: true,
            click: () => sendIde('togglePanel'),
          }
        : {
            id: 'toggleConsole',
            label: 'Toggle Console',
            accelerator: 'CmdOrCtrl+J',
            registerAccelerator: true,
            click: () => sendCmd('toggleConsole'),
          },
      ...(isWorkspace
        ? []
        : [{
            id: 'resetLayout',
            label: 'Reset Editor Layout',
            click: () => sendCmd('resetLayout'),
          }]),
      { type: 'separator' },
      /**
       * Reload has to be spelled out. `{ role: 'reload' }` is an Electron role
       * and Lynxtron has no web contents to reload — LynxWindow offers
       * loadFile/loadURL/loadBundle and no reload() — so the item drew a label
       * and did nothing. Its default accelerator also collided with ⌘R, which
       * this app spends on Run; Run keeps it, and reloading takes ⇧⌘R.
       */
      {
        id: 'reloadBundle',
        label: 'Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        registerAccelerator: true,
        click: () => reloadWindow(w),
      },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });

  if (!isWorkspace) template.push({
    label: 'Tasks',
    submenu: [
      {
        id: 'run',
        label: 'Run Fiddle',
        accelerator: 'CmdOrCtrl+R',
        registerAccelerator: true,
        click: () => sendCmd('run'),
      },
      {
        id: 'stop',
        label: 'Stop Fiddle',
        accelerator: 'CmdOrCtrl+Shift+R',
        registerAccelerator: true,
        click: () => sendCmd('stop'),
      },
    ],
  });

  const helpSubmenu: any[] = [
    {
      label: 'Lynxtron Fiddle Help',
      click: () => { openHelpPage(); },
    },
    {
      label: 'Show Welcome Tour',
      click: () => sendCmd('showTour'),
    },
    { type: 'separator' },
    {
      label: 'Open Fiddle Repository...',
      // Our repo — the old link pointed at upstream electron/fiddle.
      click: () => { openExternalUrl('https://github.com/lynx-community/lynxtron-examples'); },
    },
  ];
  if (process.platform !== 'darwin') {
    helpSubmenu.push(
      { type: 'separator' },
      {
        label: 'About Lynxtron Fiddle',
        click: () =>
          dialog.showMessageBox({
            message: 'Lynxtron Fiddle',
            detail: `Version ${app.getVersion()}`,
          }),
      },
    );
  }
  template.push({ label: 'Help', submenu: helpSubmenu });

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
// Self-hosted children (Fiddle launched from a Fiddle) share this app's name
// and config store — badge the window so instances are distinguishable, and
// let them run alongside the parent without the singleton lock.
const isSelfHostChild = process.env.LYNXTRON_FIDDLE_SELF_HOST === '1';
// Windows spawned BY this app (Gallery IDE action) offset themselves so they
// don't cover the parent exactly — same reasoning as self-host children.
const isCascadeChild = process.env.LYNXTRON_WINDOW_CASCADE === '1';
// Dedicated IDE windows keep a REAL title bar: hiddenInset exists for the
// Fiddle's commands-bar drag region, which the legacy IDE doesn't have —
// floating traffic lights over the explorer read as broken chrome.
const isIdeBootTarget = process.env.LYNXTRON_BOOT_TARGET === 'ide';
const appTitle = isSelfHostChild
  ? 'Lynxtron Fiddle · self-host'
  : 'Lynxtron Fiddle';
try { app.setName?.(appTitle); } catch (_) {}
const allowMultiInstance = process.env.LYNXTRON_ALLOW_MULTI === '1' || isSelfHostChild;
const hasSingleInstanceLock = allowMultiInstance ? true : app.requestSingleInstanceLock();
if (allowMultiInstance) {
  console.log('[PC_Host] LYNXTRON_ALLOW_MULTI=1 set; skipping singleton lock');
}
if (!hasSingleInstanceLock) {
  console.log(
    '[PC_Host] another Lynxtron Fiddle instance is running; forwarding command line and quitting',
  );
  app.quit();
} else {
  registerDeepLinkLifecycle();
  app.whenReady().then(() => {
    registerDeepLinkProtocolClient();

    // Dev only: a fixed position keeps automated verification (screenshots/
    // clicks) stable, and self-hosted children cascade so they don't cover
    // the parent exactly. User builds get OS placement — a hardcoded x:1180
    // is off-screen on narrow displays.
    const devPosition = process.env.LYNXTRON_FIDDLE_DEV === '1'
      ? (isSelfHostChild || isCascadeChild
          ? { x: 1180 + 60, y: 200 + 60 }
          : { x: 1180, y: 200 })
      : {};
    const w = new LynxWindow({
      width: 1200,
      height: 800,
      // The ground under everything, including the native editors. Dark is the
      // boot default; the UI corrects it via setWindowBackground once it knows
      // which theme resolved. Without this the window comes up white and the
      // seams flash before the first report.
      backgroundColor: '#2d313f',
      ...devPosition,
      title: isIdeBootTarget ? 'Lynxtron IDE' : appTitle,
      // Upstream Fiddle: no visible titlebar — traffic lights float over the
      // 50px commands header (windows.ts: hiddenInset + trafficLightPosition).
      // IDE-target windows keep the standard title bar instead.
      ...(isIdeBootTarget
        ? {}
        : {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 20, y: 17 },
          }),
      autoHideMenuBar: false,
      lynxPreference: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    // Cascade children in user builds too: without an offset a child window
    // lands exactly on the parent and reads as "nothing happened". Dev builds
    // already bake the offset into the fixed coordinates above.
    if ((isSelfHostChild || isCascadeChild) && process.env.LYNXTRON_FIDDLE_DEV !== '1') {
      try {
        const [cx, cy] = w.getPosition();
        w.setPosition(cx + 60, cy + 60);
      } catch (_) { /* placement is cosmetic */ }
    }
    mainWindow = w;
    console.log(
      '[PC_Host] LynxWindow created',
      path.join(__dirname, 'preload.js'),
    );

    // The app's own UI bundle fetches assets from its dist dir; materialized
    // fiddle workspaces live under tmpdir.
    installFileResourceFetcher(w, [__dirname, os.tmpdir()]);
    // The traffic lights vanish in macOS fullscreen, and the space reserved for
    // them becomes dead width at the left of the commands bar. Only the main
    // process can see the transition, so it reports it and the UI lets the bar
    // reclaim the gap.
    try {
      const reportFullScreen = () => {
        try {
          const fullScreen = w.isFullScreen();
          console.log(`[PC_Host] full-screen: ${fullScreen}`);
          w.sendGlobalEvent('ide:fullScreen', { fullScreen });
        } catch (e) {
          console.warn('[PC_Host] full-screen report failed:', e);
        }
      };
      w.on('enter-full-screen', reportFullScreen);
      w.on('leave-full-screen', reportFullScreen);
      reportFullScreen();
    } catch (e) {
      console.warn('[PC_Host] full-screen reporting unavailable:', e);
    }

    try {
      // A window spawned as a dedicated IDE boots straight into the workspace
      // surface, so start with that menu rather than flashing the Fiddle's.
      // The UI confirms (and thereafter reports every change) via setSurface.
      menuSurface = isIdeBootTarget ? 'workspace' : 'fiddle';
      menuWindow = w;
      buildAppMenu(w, menuSurface);
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

      // UI finished the quit-path session flush — quit now instead of
      // waiting out the dead-man timer. Ignored unless a quit is pending
      // (persistNow also fires from dev commands).
      if (name === 'persistDone' && quitFlushTimer) {
        clearTimeout(quitFlushTimer);
        quitFlushTimer = null;
        try { app.quit(); } catch (_) {}
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
        } else if (name === 'setSurface') {
          const next = stringParam(params, 'surface') === 'workspace' ? 'workspace' : 'fiddle';
          if (next !== menuSurface && menuWindow) {
            menuSurface = next;
            try {
              buildAppMenu(menuWindow, next);
              console.log(`[PC_Host] menu rebuilt for surface: ${next}`);
            } catch (e) {
              console.error('[PC_Host] menu rebuild FAILED:', e);
            }
          }
          callback.sendReply({ ok: true, surface: menuSurface });
        } else if (name === 'setWindowBackground') {
          /**
           * The app's ground lives on the WINDOW, not on a Lynx element.
           * A native editor is a platform subview of the renderer host, so any
           * Lynx background above it paints over it — including the app root,
           * which is a `<view>` inside `<page>` and gets its own sublayer. The
           * window is the only surface strictly below both.
           * The UI owns the theme, so it reports the colour rather than main
           * re-deriving a palette it does not have.
           */
          const color = stringParam(params, 'color');
          if (color && menuWindow) {
            try {
              menuWindow.setBackgroundColor(color);
            } catch (e) {
              console.error('[PC_Host] setBackgroundColor FAILED:', e);
            }
          }
          callback.sendReply({ ok: true });
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
        } else if (name === 'openExternal') {
          const url = stringParam(params, 'url');
          if (url) {
            try {
              const { shell } = require('lynxtron');
              shell?.openExternal?.(url);
            } catch (e) {
              console.error('[PC_Host] openExternal error:', e);
            }
          }
          callback.sendReply({});
        } else if (name === 'saveFolder') {
          const result = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Save Fiddle to Folder',
            buttonLabel: 'Save Fiddle Here',
          });
          if (!result.canceled && result.filePaths.length > 0) {
            callback.sendReply({ path: result.filePaths[0] });
          } else {
            callback.sendReply({});
          }
        } else if (name === 'openHelp') {
          callback.sendReply({ ok: openHelpPage() });
        } else if (name === 'openBundleUrl') {
          const url = stringParam(params, 'url');
          const title = stringParam(params, 'title') || 'Bundle URL Preview';
          if (!url) {
            callback.sendReply({ ok: false, error: 'Missing bundle URL' });
            return;
          }
          try {
            // Remote content: NO file:// access from this window.
            const bundleWin = openPreviewWindow(title, []);
            const loaded = bundleWin.loadURL(url);
            console.log('[PC_Host] openBundleUrl loadURL result:', loaded, url);
            callback.sendReply({ ok: true, url, title });
          } catch (e: any) {
            console.error('[PC_Host] openBundleUrl FAILED:', e);
            callback.sendReply({ ok: false, error: e?.message || String(e) });
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
              // Local bundle: it may fetch siblings from its own directory.
              const bundleWin = openPreviewWindow(title, [path.dirname(bundlePath)]);
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
