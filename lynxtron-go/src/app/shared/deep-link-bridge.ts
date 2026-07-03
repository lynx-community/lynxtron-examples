export interface HostBridge {
  call?: (name: string, data: any, callback: (payload: any) => void) => void;
}

declare const NativeModules: {
  bridge?: HostBridge;
} | undefined;

interface NativeModulesLike {
  NativeModules?: {
    bridge?: HostBridge;
  };
}

export function getDeepLinkBridgeFromGlobal(target: unknown): HostBridge | null {
  if (!target || typeof target !== 'object') return null;
  const globalLike = target as NativeModulesLike;
  return globalLike.NativeModules?.bridge ?? null;
}

export function getDeepLinkBridge(): HostBridge | null {
  // In Lynx runtime, NativeModules can be injected as a global identifier
  // without being attached to globalThis.
  if (typeof NativeModules !== 'undefined' && NativeModules?.bridge) {
    return NativeModules.bridge;
  }
  return getDeepLinkBridgeFromGlobal(globalThis);
}
