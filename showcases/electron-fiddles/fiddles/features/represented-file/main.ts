import { LynxWindow, app, lynxBridge } from '@lynx-js/lynxtron';
import { attachDocsLinks } from '@lynxtron-examples/fiddle-kit/docs-main';
import path from 'node:path';

// Partial port of features/represented-file: since setRepresentedFilename /
// setDocumentEdited are not exported, we reflect the represented file + edited
// state in the window title via setTitle() — the cross-platform fallback.
function basename(p: string): string {
  const cleaned = p.replace(/[\\/]+$/, '');
  const idx = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'));
  return idx >= 0 ? cleaned.slice(idx + 1) || cleaned : cleaned;
}

let mainWin: LynxWindow | null = null;
let file = '';
let edited = false;

const apply = () => {
  const name = file ? basename(file) : 'Untitled';
  const title = edited ? `${name} — Edited` : name;
  mainWin?.setTitle(title);
  return { file, edited, title };
};

function registerBridgeHandlers() {
  lynxBridge.handle('repfile:get', () => {
    return { file, edited, title: mainWin?.getTitle?.() ?? '' };
  });
  lynxBridge.handle('repfile:setFile', (_event, data) => {
    file = String((data as Record<string, unknown>)?.file ?? '');
    return apply();
  });
  lynxBridge.handle('repfile:toggleEdited', () => {
    edited = !edited;
    return apply();
  });
}

const WINDOW_OPTIONS = {
  width: 720,
  height: 560,
  title: "Represented File (macOS)",
};

/**
 * Create this fiddle's window. Exposed as a function rather than inlined
 * because several fiddles open additional windows of themselves (new-window,
 * dock menu), the same way upstream calls `new BrowserWindow()` again.
 */
function createWindow(): LynxWindow {
  const win = new LynxWindow({
    ...WINDOW_OPTIONS,
  } as any);
  mainWin = win;
  attachDocsLinks(win);
  win.show();
  win.loadFile(path.join(__dirname, 'main.lynx.bundle'));
  return win;
}

app.whenReady().then(() => {
  registerBridgeHandlers();
  createWindow();
});
