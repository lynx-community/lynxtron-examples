export type EditCommand = 'undo' | 'redo' | 'selectAll';

export function createEditMenuItem(
  command: EditCommand,
  executeFocused: (command: EditCommand) => void,
  platform: NodeJS.Platform = process.platform,
) {
  if (platform !== 'win32') return { role: command };
  const items = {
    undo: { label: 'Undo', accelerator: 'Ctrl+Z' },
    redo: { label: 'Redo', accelerator: 'Ctrl+Y' },
    selectAll: { label: 'Select All', accelerator: 'Ctrl+A' },
  };
  return {
    ...items[command],
    // Let the focused native control handle keys. The menu role otherwise
    // consumes them without performing an edit on Windows.
    registerAccelerator: false,
    click: () => executeFocused(command),
  };
}
