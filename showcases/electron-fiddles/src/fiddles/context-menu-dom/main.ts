import { Menu, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles menus/context-menu/dom.
// Upstream: the renderer listens for the DOM `contextmenu` (right-click) event
// on a specific element, calls `event.preventDefault()`, and sends a
// `context-menu` IPC message. Main pops up a native Menu (copy/cut/paste/
// selectall) anchored to the window.
//
// Lynxtron adaptation: Lynx has no `contextmenu` event, so the UI long-presses
// a specific element (`bindlongpress`) and fires `bridgeSend('context-menu')`.
// Main builds the same role-based Menu and pops it up at the window.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const menu = Menu.buildFromTemplate([
    { role: 'copy' },
    { role: 'cut' },
    { role: 'paste' },
    { role: 'selectall' },
  ]);

  const popup = () => {
    try {
      menu.popup({ window: win });
    } catch {
      // popup is best-effort — nothing to surface if the platform declines it.
    }
  };

  // Long-press the target element → open the native context menu for it.
  win.on('-lynx-message', (name) => {
    if (name === 'context-menu') popup();
  });

  // Same handler as an invoke so the UI can confirm the popup fired.
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'context-menu') {
      popup();
      callback.sendReply(true);
    }
  });
};
