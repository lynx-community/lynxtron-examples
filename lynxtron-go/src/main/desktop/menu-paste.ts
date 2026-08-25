import {
  createNativeEditRoleMenuItem,
} from './menu-edit';

export interface PasteMenuItem {
  role?: 'paste';
  label?: string;
  accelerator?: string;
  registerAccelerator?: boolean;
  click?: () => void;
}

/**
 * Lynxtron 0.0.8 sends the native paste action to Cocoa's responder chain,
 * but a Lynx <input> is not an NSTextInputClient and never receives it. Route
 * Cmd+V to the app only while Quick Open owns focus; everywhere else retain
 * the native paste role used by Scintilla and other platform controls.
 */
export function createPasteMenuItem(
  quickPickerOpen: boolean,
  pasteIntoQuickPicker: () => void,
  platform = process.platform,
): PasteMenuItem {
  if (!quickPickerOpen) {
    return createNativeEditRoleMenuItem('paste', platform);
  }
  return {
    label: 'Paste',
    accelerator: 'CmdOrCtrl+V',
    registerAccelerator: true,
    click: pasteIntoQuickPicker,
  };
}
