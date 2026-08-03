// Ambient Lynx runtime globals used by fiddle UIs to talk to the main process.
// Mirrors the built-in Lynxtron bridge surface (see other showcases, e.g.
// system-monitor and file-explorer). Kept in one place so every fiddle shares
// one contract.

declare const NativeModules: {
  bridge: {
    /**
     * Request/response into main (`lynxBridge.handle(method, handler)` — the
     * handler's return value is delivered here).
     * Callback-style: the reply is delivered to the 3rd-arg callback.
     */
    call: (method: string, params: unknown, callback: (reply: any) => void) => void;
    /** Fire-and-forget into main (`lynxBridge.on(method, ...)`). */
    send: (method: string, data?: unknown) => void;
  };
  /** Values exposed from preload via `contextBridge.exposeInLynxBTS`. */
  nodejs: {
    exposed: Record<string, any>;
  };
};

/**
 * The Lynx runtime global. Events pushed from main via `win.sendGlobalEvent`
 * are received through the GlobalEventEmitter JS module obtained from here.
 */
declare const lynx: {
  getJSModule: (name: 'GlobalEventEmitter') => {
    addListener: (event: string, callback: (data: any) => void) => void;
    removeListener: (event: string, callback: (data: any) => void) => void;
  };
} & Record<string, any>;
