import { describe, expect, it } from 'vitest';
import { createNativeEditRoleMenuItem } from './menu-edit';

describe('createNativeEditRoleMenuItem', () => {
  it.each(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'] as const)(
    'does not consume the %s accelerator before a focused Windows child HWND',
    role => {
      expect(createNativeEditRoleMenuItem(role, 'win32')).toEqual({
        role,
        registerAccelerator: false,
      });
    },
  );

  it('retains native responder-chain accelerators on macOS', () => {
    expect(createNativeEditRoleMenuItem('undo', 'darwin')).toEqual({ role: 'undo' });
  });
});
