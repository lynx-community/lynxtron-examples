import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

contextBridge.exposeInLynxBTS({
  hello: {
    greet: (name: string) => `Hello, World! from ${name}`,
  },
});
