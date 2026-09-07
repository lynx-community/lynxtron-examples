import { describe, expect, it, vi } from 'vitest';
import { createEditMenuItem, type EditCommand } from './menu-edit';

describe('native edit menu routing', () => {
  it.each<EditCommand>(['undo', 'redo', 'selectAll'])('preserves macOS %s responder role', command => {
    expect(createEditMenuItem(command, vi.fn(), 'darwin')).toEqual({ role: command });
  });
  it.each<EditCommand>(['undo', 'redo', 'selectAll'])('leaves Windows %s keys native and routes menu clicks', command => {
    const execute = vi.fn();
    const item = createEditMenuItem(command, execute, 'win32');
    if (!('click' in item)) throw new Error('Expected a Windows menu callback');
    expect(item.registerAccelerator).toBe(false);
    expect(item.role).toBeUndefined();
    item.click?.();
    expect(execute).toHaveBeenCalledExactlyOnceWith(command);
  });
});
