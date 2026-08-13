import { describe, expect, it, vi } from 'vitest';
import { readClipboardText } from './preload-foundation-service';

describe('readClipboardText', () => {
  it('uses pbpaste on macOS', () => {
    const run = vi.fn(() => 'renderer.js');

    expect(readClipboardText('darwin', run as never)).toBe('renderer.js');
    expect(run).toHaveBeenCalledWith('pbpaste', [], { encoding: 'utf8' });
  });

  it('uses the platform clipboard command on Windows and Linux', () => {
    const windowsRun = vi.fn(() => 'win');
    const linuxRun = vi.fn(() => 'linux');

    expect(readClipboardText('win32', windowsRun as never)).toBe('win');
    expect(windowsRun).toHaveBeenCalledWith(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
      { encoding: 'utf8' },
    );
    expect(readClipboardText('linux', linuxRun as never)).toBe('linux');
    expect(linuxRun).toHaveBeenCalledWith(
      'xclip',
      ['-selection', 'clipboard', '-o'],
      { encoding: 'utf8' },
    );
  });

  it('returns null when the clipboard command is unavailable', () => {
    const run = vi.fn(() => { throw new Error('missing'); });
    expect(readClipboardText('darwin', run as never)).toBeNull();
  });
});
