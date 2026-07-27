import { app, Menu, type LynxWindow } from '@lynx-js/lynxtron';
import type { RegisterMain } from '../../main/desktop/registry';

// electron ipc/pattern-3 main: application menu items send 'update-counter' to
// the renderer; renderer echoes the value back via 'counter-value'.
export const registerMain: RegisterMain = (win: LynxWindow) => {
  const push = (delta: number) => win.sendGlobalEvent('update-counter', delta);

  try {
    const menu = Menu.buildFromTemplate([
      {
        label: app.getName(),
        submenu: [
          { label: 'Increment', click: () => push(1) },
          { label: 'Decrement', click: () => push(-1) },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  } catch {
    // Application menu is best-effort; the in-UI buttons still drive the demo.
  }

  win.on('-lynx-message', (name, data) => {
    if (name === 'nudge') {
      push(Number((data as Record<string, unknown>)?.delta ?? 0));
    } else if (name === 'counter-value') {
      // Electron logs the echoed value to the Node console.
      // eslint-disable-next-line no-console
      console.log('[ipc-pattern-3] counter-value =', (data as Record<string, unknown>)?.value);
    }
  });
};
