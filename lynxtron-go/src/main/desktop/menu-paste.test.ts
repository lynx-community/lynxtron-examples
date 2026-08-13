import { describe, expect, it, vi } from 'vitest';
import { createPasteMenuItem } from './menu-paste';

describe('createPasteMenuItem', () => {
  it('keeps native paste outside Quick Open', () => {
    expect(createPasteMenuItem(false, vi.fn())).toEqual({ role: 'paste' });
  });

  it('routes Cmd+V to Quick Open only while it is open', () => {
    const paste = vi.fn();
    const item = createPasteMenuItem(true, paste);

    expect(item).toMatchObject({
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      registerAccelerator: true,
    });
    item.click?.();
    expect(paste).toHaveBeenCalledOnce();
  });
});
