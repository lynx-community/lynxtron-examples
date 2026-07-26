import { contextBridge } from '@lynx-js/lynxtron/context-bridge';

// SQLite lives in main.ts (host Node env) to avoid Environment mismatch on
// libuv async callbacks. Lynx UI talks to it via `NativeModules.bridge.call`.
contextBridge.exposeInLynxBTS({});
