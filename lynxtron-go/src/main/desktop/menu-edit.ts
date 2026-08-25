export type NativeEditRole =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll';

export interface NativeEditRoleMenuItem<Role extends NativeEditRole = NativeEditRole> {
  role: Role;
  registerAccelerator?: boolean;
}

/**
 * On Windows the Scintilla editor is a native child HWND. Registering the
 * application menu's default Edit accelerators consumes Ctrl+A/Z/X/C/V/Y
 * before the focused child receives WM_KEYDOWN, then routes the role back to
 * LynxWindow where it cannot operate on Scintilla.
 *
 * Keep the menu roles (so menu clicks and labels remain native), but leave the
 * accelerators unregistered on Windows. The normal Win32 focus chain then
 * delivers the keys directly to Scintilla's built-in key map. Other platforms
 * retain their native responder-chain behaviour.
 */
export function createNativeEditRoleMenuItem<Role extends NativeEditRole>(
  role: Role,
  platform = process.platform,
): NativeEditRoleMenuItem<Role> {
  if (platform === 'win32') return { role, registerAccelerator: false };
  return { role };
}
