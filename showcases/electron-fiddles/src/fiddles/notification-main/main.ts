import type { LynxWindow } from '@lynx-js/lynxtron';
import { Notification } from '../../main/desktop/lynx-native';
import type { RegisterMain } from '../../main/desktop/registry';

// Port of electron docs/fiddles features/notifications/main — the Notification is
// constructed and shown in the MAIN process. Upstream fires it automatically on
// app-ready; here the UI requests it via bridge so the interaction is repeatable.
const NOTIFICATION_TITLE = 'Basic Notification';
const NOTIFICATION_BODY = 'Notification from the Main process';

export const registerMain: RegisterMain = (win: LynxWindow) => {
  win.on('-lynx-invoke', async (callback, name) => {
    if (name === 'notification:show') {
      new Notification({
        title: NOTIFICATION_TITLE,
        body: NOTIFICATION_BODY,
      }).show();
      callback.sendReply(true);
    }
  });
};
