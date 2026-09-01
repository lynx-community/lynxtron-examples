import { describe, expect, it } from 'vitest';
import { resolveRunControlState } from './run-control';

describe('Run control state', () => {
  it('is idle before work starts', () => {
    expect(resolveRunControlState(false, false)).toBe('idle');
  });

  it('is loading throughout preparation', () => {
    expect(resolveRunControlState(false, true)).toBe('loading');
  });

  it('becomes running as soon as a pid exists', () => {
    expect(resolveRunControlState(true, false)).toBe('running');
    expect(resolveRunControlState(true, true)).toBe('running');
  });
});
