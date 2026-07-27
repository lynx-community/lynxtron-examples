import { Menu, Tray, nativeImage, type MenuItem, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles menus/tray-menu.
// A Tray icon with a context Menu built from a template. The template mirrors
// the upstream: Open App (focus window), Set Green Icon (checkbox → red/green),
// Set Title (checkbox → tray title), Quit.
//
// Keep a reference to the Tray globally so it is not garbage collected.
let tray: Tray | null = null;

// Same red / green 16×16 icons the Electron fiddle ships (base64 data URLs).
const RED_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACTSURBVHgBpZKBCYAgEEV/TeAIjuIIbdQIuUGt0CS1gW1iZ2jIVaTnhw+Cvs8/OYDJA4Y8kR3ZR2/kmazxJbpUEfQ/Dm/UG7wVwHkjlQdMFfDdJMFaACebnjJGyDWgcnZu1/lrCrl6NCoEHJBrDwEr5NrT6ko/UV8xdLAC2N49mlc5CylpYh8wCwqrvbBGLoKGvz8Bfq0QPWEUo/EAAAAASUVORK5CYII=';
const GREEN_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACOSURBVHgBpZLRDYAgEEOrEzgCozCCGzkCbKArOIlugJvgoRAUNcLRpvGH19TkgFQWkqIohhK8UEaKwKcsOg/+WR1vX+AlA74u6q4FqgCOSzwsGHCwbKliAF89Cv89tWmOT4VaVMoVbOBrdQUz+FrD6XItzh4LzYB1HFJ9yrEkZ4l+wvcid9pTssh4UKbPd+4vED2Nd54iAAAAAElFTkSuQmCC';

export const registerMain: RegisterMain = (win: LynxWindow) => {
  const red = nativeImage.createFromDataURL(RED_URL);
  const green = nativeImage.createFromDataURL(GREEN_URL);

  // Track checkbox state so the UI can reflect it.
  let isGreen = false;
  let hasTitle = false;

  const applyIcon = () => tray?.setImage(isGreen ? green : red);
  const applyTitle = () => tray?.setTitle(hasTitle ? 'Title' : '');
  const pushState = () =>
    win.sendGlobalEvent('tray-state', { isGreen, hasTitle });

  try {
    tray = new Tray(red);
    tray.setToolTip('Tray Icon Demo');
  } catch {
    // Tray creation is best-effort; the in-UI buttons still drive the demo.
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open App',
      click: () => win.focus(),
    },
    {
      label: 'Set Green Icon',
      type: 'checkbox',
      click: (item: MenuItem) => {
        isGreen = !!item.checked;
        applyIcon();
        pushState();
      },
    },
    {
      label: 'Set Title',
      type: 'checkbox',
      click: (item: MenuItem) => {
        hasTitle = !!item.checked;
        applyTitle();
        pushState();
      },
    },
    { role: 'quit' },
  ]);

  tray?.setContextMenu(contextMenu);

  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'tray:popup') {
      // Pop the same context menu at the window so the demo is reachable
      // without a physical tray click.
      try {
        contextMenu.popup({ window: win });
      } catch {
        // popup is best-effort.
      }
      callback.sendReply({ isGreen, hasTitle });
    } else if (name === 'tray:state') {
      callback.sendReply({ isGreen, hasTitle });
    }
  });

  win.on('-lynx-message', (name) => {
    // Mirror each context-menu item so the UI buttons drive the real Tray.
    if (name === 'tray:openApp') {
      win.focus();
    } else if (name === 'tray:toggleIcon') {
      isGreen = !isGreen;
      applyIcon();
      pushState();
    } else if (name === 'tray:toggleTitle') {
      hasTitle = !hasTitle;
      applyTitle();
      pushState();
    }
  });
};
