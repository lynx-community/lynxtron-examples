import { describe, expect, it } from 'vitest';
import { createLatestOpenRequestGate } from './latest-open-request';

describe('latest project open request', () => {
  it('rejects an older async open after a later selection starts', () => {
    const gate = createLatestOpenRequestGate();
    const hello = gate.begin();
    const blank = gate.begin();

    expect(gate.isCurrent(hello)).toBe(false);
    expect(gate.isCurrent(blank)).toBe(true);
  });
});
