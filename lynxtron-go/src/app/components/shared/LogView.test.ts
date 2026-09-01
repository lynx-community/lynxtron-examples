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

});
