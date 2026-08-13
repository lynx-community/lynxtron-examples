import { describe, expect, it } from 'vitest';
import { valueFromPasteEvent } from './paste';

describe('valueFromPasteEvent', () => {
  it('uses the complete value supplied by a native paste event', () => {
    expect(valueFromPasteEvent('main.js', {
      detail: { value: 'renderer.js' },
    })).toBe('renderer.js');
  });

  it('appends an inserted-text-only native paste payload', () => {
    expect(valueFromPasteEvent('renderer', {
      detail: { text: '.js' },
    })).toBe('renderer.js');
  });

  it('ignores malformed paste payloads', () => {
    expect(valueFromPasteEvent('main.js', { detail: {} })).toBeNull();
  });
});
