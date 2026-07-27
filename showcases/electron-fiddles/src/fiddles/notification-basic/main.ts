import type { LynxWindow } from '@lynx-js/lynxtron';
import { Notification } from '../../main/desktop/lynx-native';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles native-ui/notifications. Upstream fired the
// HTML5 `window.Notification` from the renderer; Lynx has no such API, so the
// UI bridges into main, which shows a real OS notification via Lynxtron's
// `Notification` (Electron-compatible).
export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name, data) => {
    if (name === 'show-notification') {
      const kind = (data as { kind?: string } | undefined)?.kind;
      const opts =
        kind === 'advanced'
          ? {
              title: 'Notification with subtitle',
              subtitle: 'A custom subtitle',
              body: 'Short message plus a subtitle line',
            }
          : {
              title: 'Basic Notification',
              body: 'Short message part',
            };
      new Notification(opts).show();
      callback.sendReply(opts.title);
    }
  });
};
