import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  echo: (message: string) => `Echo from Counter: ${message}`,
});
