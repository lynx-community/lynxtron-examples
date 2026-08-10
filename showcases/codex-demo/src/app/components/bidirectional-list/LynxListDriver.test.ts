import { afterEach, describe, expect, it, vi } from 'vitest';
import { LynxListDriver, lynxListAlignment } from './LynxListDriver';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function createDriver(layoutTimeoutMs = 1_200) {
  return new LynxListDriver({
    id: 'test-list',
    getViewportHeight: () => 480,
    getMountedKeys: () => ['a', 'b', 'c'],
    layoutTimeoutMs,
  });
}

describe('LynxListDriver layout handshake', () => {
  it('maps platform-neutral alignment names to Lynx list vocabulary', () => {
    expect(['start', 'center', 'end'].map((align) => lynxListAlignment(align as any)))
      .toEqual(['top', 'middle', 'bottom']);
  });

  it('does not lose a synchronous layout completion that arrives before the waiter', async () => {
    const driver = createDriver();
    driver.notifyLayoutComplete(7);
    await expect(driver.waitForLayout(7)).resolves.toBeUndefined();
    driver.dispose();
  });

  it('fails deterministically instead of locking the transaction forever', async () => {
    vi.useFakeTimers();
    const driver = createDriver(500);
    const layout = driver.waitForLayout(8);
    const rejection = expect(layout).rejects.toThrow(/layout timed out/);
    await vi.advanceTimersByTimeAsync(501);
    await rejection;
    driver.dispose();
  });

  it('normalizes native cells and ignores unknown or stale item keys', () => {
    const driver = createDriver();
    expect(driver.normalizeCells([
      { itemKey: '__unknown-item', top: 0, bottom: 40 },
      { 'item-key': 'b', top: 80, bottom: 200 },
      { itemKey: 'a', top: -20, bottom: 80 },
      { itemKey: 'removed', top: 200, bottom: 260 },
    ])).toEqual([
      { key: 'a', index: 0, top: -20, bottom: 80 },
      { key: 'b', index: 1, top: 80, bottom: 200 },
    ]);
    driver.dispose();
  });

  it('actively reads normalized scroll geometry through getScrollInfo', async () => {
    let invocation: Record<string, any> | undefined;
    const query: Record<string, any> = {
      select: vi.fn(() => query),
      invoke: vi.fn((options: Record<string, any>) => {
        invocation = options;
        return query;
      }),
      exec: vi.fn(() => invocation?.success?.({
        scrollX: 0,
        scrollY: 125,
        maxScrollOffset: 800,
      })),
    };
    vi.stubGlobal('lynx', { createSelectorQuery: () => query });
    const driver = createDriver();

    await expect(driver.getScrollInfo()).resolves.toEqual({
      scrollTop: 125,
      scrollHeight: 1_280,
      listHeight: 480,
      maxScroll: 800,
    });
    expect(query.invoke).toHaveBeenCalledWith(expect.objectContaining({ method: 'getScrollInfo' }));
    driver.dispose();
  });

  it('resolves the native selector id for every invocation after a remount', async () => {
    let generation = 0;
    const query: Record<string, any> = {
      select: vi.fn(() => query),
      invoke: vi.fn((options: Record<string, any>) => {
        options.success({ scrollY: 0, maxScrollOffset: 0 });
        return query;
      }),
      exec: vi.fn(),
    };
    vi.stubGlobal('lynx', { createSelectorQuery: () => query });
    const driver = new LynxListDriver({
      getNativeId: () => `test-list--native-${generation}`,
      getViewportHeight: () => 480,
      getMountedKeys: () => ['a'],
    });

    await driver.getScrollInfo();
    generation = 1;
    await driver.getScrollInfo();

    expect(query.select).toHaveBeenNthCalledWith(1, '#test-list--native-0');
    expect(query.select).toHaveBeenNthCalledWith(2, '#test-list--native-1');
    driver.dispose();
  });
});
