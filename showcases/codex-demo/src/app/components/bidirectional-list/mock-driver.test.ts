import { describe, expect, it } from 'vitest';
import { firstStableAnchor } from './model';
import { MockBidirectionalListDriver } from './mock-driver';

describe('MockBidirectionalListDriver', () => {
  it('models variable-height visible cells deterministically', async () => {
    const driver = new MockBidirectionalListDriver({
      viewportHeight: 200,
      items: [
        { key: 'a', height: 80 },
        { key: 'b', height: 140 },
        { key: 'c', height: 60 },
      ],
      scrollTop: 50,
    });
    expect(await driver.getVisibleCells()).toEqual([
      { key: 'a', index: 0, top: -50, bottom: 30 },
      { key: 'b', index: 1, top: 30, bottom: 170 },
      { key: 'c', index: 2, top: 170, bottom: 230 },
    ]);
  });

  it('can reproduce prepend anchor preservation without timing', async () => {
    const original = [
      { key: 'a', height: 80 },
      { key: 'b', height: 140 },
      { key: 'c', height: 60 },
      { key: 'd', height: 120 },
    ];
    const driver = new MockBidirectionalListDriver({ viewportHeight: 200, items: original, scrollTop: 100 });
    const anchor = firstStableAnchor(await driver.getVisibleCells(), 0)!;
    expect(anchor.key).toBe('c');
    expect(anchor.top).toBe(120);

    const prepended = [{ key: 'older', height: 90 }, ...original];
    driver.setItems(prepended);
    await driver.scrollTo({ key: anchor.key, align: 'start', offset: anchor.top });
    const restored = (await driver.getVisibleCells()).find((cell) => cell.key === anchor.key);
    expect(restored?.top).toBe(anchor.top);
  });

  it('aligns followed insertions at start, center, and end', async () => {
    const driver = new MockBidirectionalListDriver({
      viewportHeight: 300,
      items: Array.from({ length: 6 }, (_, index) => ({ key: String(index), height: 100 })),
    });
    await driver.scrollTo({ key: '3', align: 'start' });
    expect((await driver.getVisibleCells()).find((cell) => cell.key === '3')?.top).toBe(0);
    await driver.scrollTo({ key: '3', align: 'center' });
    expect((await driver.getVisibleCells()).find((cell) => cell.key === '3')?.top).toBe(100);
    await driver.scrollTo({ key: '3', align: 'end' });
    expect((await driver.getVisibleCells()).find((cell) => cell.key === '3')?.bottom).toBe(300);
  });
});
