import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Fiddle Console auto-scroll', () => {
  it('scrolls to the latest output after content layout and console updates', () => {
    const source = fs.readFileSync(path.join(__dirname, 'Outputs.tsx'), 'utf-8');

    expect(source).toContain("const OUTPUTS_SCROLL_ID = 'fiddle-console-scroll'");
    expect(source).toContain('const AUTO_SCROLL_DELAYS_MS = [0, 80]');
    expect(source).toContain('bindcontentsizechanged={scrollToBottom}');
    expect(source).toContain('AUTO_SCROLL_DELAYS_MS.map(delay');
    expect(source).toContain('setTimeout(scrollToBottom, delay)');
    expect(source).toContain("method: 'scrollTo'");
    expect(source).toContain('params: { offset: 999999, smooth: false }');
    expect(source).toContain('return () => timers.forEach(timer => clearTimeout(timer))');
  });
});
