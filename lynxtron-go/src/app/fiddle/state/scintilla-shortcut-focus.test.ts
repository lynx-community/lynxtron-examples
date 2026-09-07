import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Scintilla shortcut ownership', () => {
  it('forwards focused Lynx text before rejecting non-focused native panes', () => {
    const source = fs.readFileSync(new URL('../../../../scintilla-extension/module/scintilla_view.mm', import.meta.url), 'utf8');
    const method = source.slice(source.indexOf('- (BOOL)performKeyEquivalent:'));
    const guard = method.indexOf('if (self.window.firstResponder != self) return NO;');
    const prefix = method.slice(0, guard);
    expect(prefix).toContain('shortcutModifiers == NSEventModifierFlagCommand');
    expect(prefix).toContain('[characters isEqualToString:@"c"]');
    expect(prefix).toContain('self.window.firstResponder == ancestor');
    expect(prefix).toContain('[ancestor keyDown:event];');
    expect(prefix).toContain('return YES;');
    expect(prefix).not.toContain('validateUserInterfaceItem');
  });
  it('rejects non-focused panes before selection validation or menu dispatch', () => {
    const source = fs.readFileSync(new URL('../../../../scintilla-extension/module/scintilla_view.mm', import.meta.url), 'utf8');
    const method = source.slice(source.indexOf('- (BOOL)performKeyEquivalent:'), source.indexOf('\n@end', source.indexOf('- (BOOL)performKeyEquivalent:')));
    const guard = method.indexOf('if (self.window.firstResponder != self) return NO;');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(method.indexOf('[self validateUserInterfaceItem:item]'));
    expect(guard).toBeLessThan(method.indexOf('[[NSApp mainMenu] performKeyEquivalent:event]'));
    // Preserve the focused, empty-selection fallback for selectable Lynx text.
    expect(method).toContain('[ancestor keyDown:event]');
  });
});
