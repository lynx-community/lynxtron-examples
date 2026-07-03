import { describe, expect, it } from 'vitest';
import { getDeepLinkBridge, getDeepLinkBridgeFromGlobal } from './deep-link-bridge';

describe('getDeepLinkBridgeFromGlobal', () => {
  it('returns null when NativeModules is absent', () => {
    expect(getDeepLinkBridgeFromGlobal({})).toBeNull();
  });

  it('returns bridge object when present', () => {
    const call = () => {};
    const bridge = getDeepLinkBridgeFromGlobal({
      NativeModules: {
        bridge: { call },
      },
    });
    expect(bridge?.call).toBe(call);
  });
});

describe('getDeepLinkBridge', () => {
  it('reads bridge from globalThis without throwing when missing', () => {
    const original = (globalThis as any).NativeModules;
    try {
      delete (globalThis as any).NativeModules;
      expect(() => getDeepLinkBridge()).not.toThrow();
      expect(getDeepLinkBridge()).toBeNull();
    } finally {
      (globalThis as any).NativeModules = original;
    }
  });
});
