import { describe, expect, it, vi } from 'vitest';
import { createPasteMenuItem } from './menu-paste';

describe('createPasteMenuItem', () => {
  it('lets a focused Windows native control receive Ctrl+V directly', () => {
    expect(createPasteMenuItem(false, vi.fn(), 'win32')).toEqual({
      role: 'paste',
      registerAccelerator: false,
    });
  });

  it('keeps native responder-chain paste on macOS', () => {
    expect(createPasteMenuItem(false, vi.fn(), 'darwin')).toEqual({ role: 'paste' });
  });

  it('routes Cmd+V to Quick Open only while it is open', () => {
    const paste = vi.fn();
    const item = createPasteMenuItem(true, paste, 'win32');

    expect(item).toMatchObject({
      label: 'Paste',
      accelerator: 'CmdOrCtrl+V',
      registerAccelerator: true,
    });
    item.click?.();
    expect(paste).toHaveBeenCalledOnce();
  });
});
