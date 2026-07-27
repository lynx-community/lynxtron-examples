import { Menu, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles menus/context-menu/web-contents.
//
// Upstream built a Menu (copy / cut / paste / selectAll) and popped it up from
// `win.webContents.on('context-menu')` — but only when `params.isEditable` was
// true (i.e. the target was the <textarea>). Lynxtron has no `webContents`, so
// the "context-menu" gesture is raised from the Lynx UI (long-press / a button)
// which calls into main with an `isEditable` flag. Main keeps the exact same
// Menu and the same editable-only gate, then pops it with `Menu.popup`.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const menu = Menu.buildFromTemplate([
    { role: 'copy' },
    { role: 'cut' },
    { role: 'paste' },
    { role: 'selectAll' },
  ]);

  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'contextmenu:popup') {
      // Mirror upstream: only show the context menu if the element is editable.
      const isEditable = !!(data as { isEditable?: boolean } | undefined)?.isEditable;
      let shown = false;
      if (isEditable) {
        try {
          menu.popup({ window: win });
          shown = true;
        } catch {
          // popup is best-effort in headless / preview environments.
        }
      }
      callback.sendReply({ shown, isEditable });
    }
  });
};
