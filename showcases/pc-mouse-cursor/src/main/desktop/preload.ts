import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  getShowcaseTitle: () => 'PC Mouse Cursor Showcase',
});
