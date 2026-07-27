// App-side (Lynx UI) helpers over the built-in Lynxtron bridge. Every fiddle
// uses these instead of touching NativeModules / GlobalEventEmitter directly.
//
// The native bridge API is callback-style:
//   NativeModules.bridge.call(method, params, (reply) => { ... })
//   NativeModules.bridge.send(method, params)
// and main pushes events that arrive on the GlobalEventEmitter JS module.

/**
 * Request/response call into the main process. Wraps the native callback-style
 * `bridge.call(method, params, cb)` in a Promise so callers can `await` it.
 * Resolves with the value main passed to `callback.sendReply(...)`.
 */
export function bridgeCall<T = any>(method: string, data?: unknown): Promise<T> {
  return new Promise<T>((resolve) => {
    NativeModules.bridge.call(method, data ?? {}, (reply: T) => resolve(reply));
  });
}

/** Fire-and-forget message into the main process (`win.on('-lynx-message')`). */
export function bridgeSend(method: string, data?: unknown): void {
  NativeModules.bridge.send(method, data ?? {});
}

/**
 * Subscribe to an event pushed from main (`win.sendGlobalEvent`). Returns an
 * unsubscribe function — call it in cleanup.
 *
 * The receiving side is the GlobalEventEmitter JS module, obtained via the
 * `lynx` runtime global (there is no bare `GlobalEventEmitter` global here).
 */
export function onGlobalEvent(event: string, cb: (data: any) => void): () => void {
  const emitter = lynx.getJSModule('GlobalEventEmitter');
  emitter.addListener(event, cb);
  return () => {
    try {
      emitter.removeListener(event, cb);
    } catch {
      // removeListener may be unavailable on some runtimes; safe to ignore.
    }
  };
}

/** A value exposed from preload via `contextBridge.exposeInLynxBTS`. */
export function exposed<T = any>(key: string): T {
  return NativeModules.nodejs.exposed[key] as T;
}
