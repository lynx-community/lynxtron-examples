import { describe, expect, it, vi } from 'vitest';
import { BidirectionalListEngine } from './engine';
import { MockBidirectionalListDriver, type MockListItem } from './mock-driver';

function createHarness(input: {
  items: MockListItem[];
  viewportHeight?: number;
  scrollTop?: number;
}) {
  const driver = new MockBidirectionalListDriver({
    items: input.items,
    viewportHeight: input.viewportHeight ?? 200,
    scrollTop: input.scrollTop,
  });
  const commits: string[][] = [];
  const engine = new BidirectionalListEngine<MockListItem>({
    initialItems: input.items,
    getItemKey: (item) => item.key,
    driver,
    onCommit: ({ items }) => {
      commits.push(items.map((item) => item.key));
      driver.setItems(items);
    },
  });
  return { engine, driver, commits };
}

describe('BidirectionalListEngine deterministic integration', () => {
  it('preserves a variable-height anchor across prepend', async () => {
    const { engine, driver } = createHarness({
      items: [
        { key: 'a', height: 80 },
        { key: 'b', height: 140 },
        { key: 'c', height: 60 },
        { key: 'd', height: 120 },
      ],
      scrollTop: 100,
    });
    const before = (await driver.getVisibleCells()).find((cell) => cell.key === 'c')!.top;
    const result = await engine.prepend([
      { key: 'older-1', height: 90 },
      { key: 'older-2', height: 110 },
    ]);
    const after = (await driver.getVisibleCells()).find((cell) => cell.key === 'c')!.top;
    expect(result).toMatchObject({ outcome: 'settled', operation: 'prepend', anchorErrorPx: 0 });
    expect(after).toBe(before);
  });

  it('follows the requested inserted item and alignment', async () => {
    const { engine, driver } = createHarness({
      items: Array.from({ length: 4 }, (_, index) => ({ key: String(index), height: 100 })),
      scrollTop: 200,
    });
    await engine.append([
      { key: '4', height: 80 },
      { key: '5', height: 120 },
    ], {
      position: { type: 'follow-insert', target: 'last', align: 'end' },
    });
    const followed = (await driver.getVisibleCells()).find((cell) => cell.key === '5');
    expect(followed?.bottom).toBe(200);
  });

  it('does not settle append-follow when only the native scroll command has returned', async () => {
    let confirmGeometry: (() => void) | undefined;
    const begin = vi.fn(() => new Promise<void>((resolve) => { confirmGeometry = resolve; }));
    const driver = new MockBidirectionalListDriver({
      items: Array.from({ length: 4 }, (_, index) => ({ key: String(index), height: 100 })),
      viewportHeight: 200,
      scrollTop: 200,
    });
    const engine = new BidirectionalListEngine<MockListItem>({
      initialItems: Array.from({ length: 4 }, (_, index) => ({ key: String(index), height: 100 })),
      getItemKey: (item) => item.key,
      driver,
      onCommit: ({ items }) => driver.setItems(items),
      appendFollowSettlement: { begin, cancel: vi.fn() },
    });

    let transactionSettled = false;
    const result = engine.append([{ key: '4', height: 100 }], {
      position: { type: 'follow-insert', target: 'last', align: 'end' },
    }).then((value) => {
      transactionSettled = true;
      return value;
    });

    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(transactionSettled).toBe(false);
    expect(begin).toHaveBeenCalledWith({
      transactionId: 1,
      operation: 'append',
      edge: 'end',
      expectedBoundaryIndex: 4,
    });

    confirmGeometry?.();
    expect(await result).toMatchObject({ outcome: 'settled', operation: 'append' });
  });

  it('keeps every supplied item accessible across repeated prepend follow operations', async () => {
    const { engine, driver, commits } = createHarness({
      items: [
        { key: 'initial-1', height: 100 },
        { key: 'initial-2', height: 100 },
      ],
    });
    for (let batch = 0; batch < 3; batch += 1) {
      const start = batch * 3;
      await engine.prepend(
        Array.from({ length: 3 }, (_, index) => ({ key: `prepend-${start + index}`, height: 80 })),
        { position: { type: 'follow-insert', target: 'first', align: 'start' } },
      );
    }
    expect(engine.getItems().map((item) => item.key)).toContain('initial-1');
    expect(engine.getItems().map((item) => item.key)).toContain('initial-2');
    expect(commits.at(-1)).toHaveLength(11);
    await engine.navigateTo('initial-1', { align: 'center' });
    expect((await driver.getVisibleCells()).some((cell) => cell.key === 'initial-1')).toBe(true);
  });

  it('mounts every appended item while preserving the old viewport', async () => {
    const { engine, driver, commits } = createHarness({
      items: Array.from({ length: 8 }, (_, index) => ({ key: String(index + 1), height: 100 })),
      scrollTop: 0,
    });
    const before = (await driver.getVisibleCells()).find((cell) => cell.key === '1')!.top;
    const result = await engine.append([
      { key: 'new-a', height: 80 },
      { key: 'new-b', height: 120 },
    ]);
    expect(result.outcome).toBe('settled');
    expect(commits.at(-1)?.slice(-2)).toEqual(['new-a', 'new-b']);
    expect((await driver.getVisibleCells()).find((cell) => cell.key === '1')?.top).toBe(before);
  });

  it('serializes rapid mixed mutations without dropping any operation', async () => {
    const { engine, commits } = createHarness({ items: [{ key: 'a', height: 100 }] });
    const results = await Promise.all([
      engine.prepend([{ key: 'before', height: 100 }]),
      engine.append([{ key: 'after', height: 100 }]),
      engine.update('a', (item) => ({ ...item, height: 120 })),
    ]);
    expect(results.map((result) => result.operation)).toEqual(['prepend', 'append', 'update']);
    expect(results.every((result) => result.outcome === 'settled')).toBe(true);
    expect(engine.getItems().map((item) => item.key)).toEqual(['before', 'a', 'after']);
    expect(commits).toHaveLength(3);
  });

  it('fails duplicate keys without poisoning the following transaction', async () => {
    const { engine } = createHarness({ items: [{ key: 'a', height: 100 }] });
    const duplicate = engine.append([{ key: 'a', height: 80 }]);
    const valid = engine.append([{ key: 'b', height: 80 }]);
    expect(await duplicate).toMatchObject({ outcome: 'failed', operation: 'append' });
    expect(await valid).toMatchObject({ outcome: 'settled', operation: 'append' });
    expect(engine.getItems().map((item) => item.key)).toEqual(['a', 'b']);
  });

  it('resets a list around an explicit key without hiding any replacement item', async () => {
    const { engine, driver, commits } = createHarness({ items: [{ key: 'old', height: 100 }] });
    const replacement = Array.from({ length: 8 }, (_, index) => ({ key: `new-${index}`, height: 80 }));
    const result = await engine.reset(replacement, {
      position: { key: 'new-4', align: 'center' },
    });
    expect(result.outcome).toBe('settled');
    expect(commits.at(-1)).toHaveLength(8);
    const target = (await driver.getVisibleCells()).find((cell) => cell.key === 'new-4');
    expect(target?.top).toBe(60);
  });

  it('replaces a bounded window while preserving a surviving viewport anchor', async () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ key: String(index), height: 100 }));
    const { engine, driver } = createHarness({ items, scrollTop: 250 });
    const before = (await driver.getVisibleCells()).find((cell) => cell.key === '3')!.top;

    const replacement = [
      { key: 'older-a', height: 70 },
      { key: 'older-b', height: 130 },
      ...items.slice(2, 7),
    ];
    const result = await engine.replace(replacement, { position: 'preserve' });

    expect(result).toMatchObject({ outcome: 'settled', operation: 'replace', anchorErrorPx: 0 });
    expect((await driver.getVisibleCells()).find((cell) => cell.key === '3')?.top).toBe(before);
    expect(engine.getItems().map((item) => item.key)).toEqual(replacement.map((item) => item.key));
  });

  it('navigates to any supplied key', async () => {
    const { engine, driver } = createHarness({
      items: Array.from({ length: 20 }, (_, index) => ({ key: String(index), height: 100 })),
    });
    await engine.navigateTo('7', { align: 'center' });
    const target = (await driver.getVisibleCells()).find((cell) => cell.key === '7');
    expect(target?.top).toBe(50);
  });
});
