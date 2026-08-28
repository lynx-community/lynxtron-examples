import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('LogView Lynx text structure', () => {
  it('renders the complete log in one selectable text node', () => {
    const source = fs.readFileSync(path.join(__dirname, 'LogView.tsx'), 'utf-8');
    expect(source.match(/<text\b/g)).toHaveLength(1);
    expect(source).toContain('<text className="LogViewText" text-selection={true} flatten={false}>');
    expect(source).toMatch(/<text[^>]*>\s*\{children\}\s*<\/text>/);
  });

  it('uses the text-editing cursor across the scrollable log surface', () => {
    const styles = fs.readFileSync(path.join(__dirname, 'LogView.css'), 'utf-8');
    expect(styles).toMatch(/\.LogViewScroll\s*\{[^}]*cursor:\s*text;/s);
    expect(styles).toMatch(/\.LogViewText\s*\{[^}]*cursor:\s*text;/s);
  });

  it('retries auto-scroll after Lynx commits the updated text layout', () => {
    const source = fs.readFileSync(path.join(__dirname, 'LogView.tsx'), 'utf-8');
    expect(source).toContain('bindcontentsizechanged={scrollToBottom}');
    expect(source).toContain('const AUTO_SCROLL_DELAYS_MS = [0, 80]');
    expect(source).toContain('AUTO_SCROLL_DELAYS_MS.map(delay => setTimeout(scrollToBottom, delay))');
    expect(source).toContain('return () => timers.forEach(timer => clearTimeout(timer))');
    expect(source).toContain("method: 'scrollTo'");
    expect(source).toContain('params: { offset: 999999, smooth: false }');
  });

});
