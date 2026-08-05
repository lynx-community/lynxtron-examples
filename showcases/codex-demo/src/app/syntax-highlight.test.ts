import { describe, expect, it } from 'vitest';
import { languageForPath, prismDiffLines, prismSyntaxLines } from './syntax-highlight';

describe('prismSyntaxLines', () => {
  it('preserves multiline grammar tokens while splitting code into renderable lines', () => {
    const lines = prismSyntaxLines('/* first\nsecond */\nconst view = <Button enabled={true}>Hi</Button>;', 'tsx');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContainEqual({ text: '/* first', kind: 'comment' });
    expect(lines[1]).toContainEqual({ text: 'second */', kind: 'comment' });
    expect(lines[2]).toEqual(expect.arrayContaining([
      { text: 'const', kind: 'keyword' },
      { text: 'true', kind: 'boolean' },
    ]));
  });

  it('falls back to plain text for unknown languages', () => {
    expect(prismSyntaxLines('alpha\nbeta', 'unknown')).toEqual([
      [{ text: 'alpha', kind: 'plain' }],
      [{ text: 'beta', kind: 'plain' }],
    ]);
  });

  it('detects the language for review files', () => {
    expect(languageForPath('src/components/Button.tsx')).toBe('tsx');
    expect(languageForPath('.changeset/config.json')).toBe('json');
    expect(languageForPath('LICENSE')).toBe('text');
  });

  it('highlights additions and deletions against their own diff streams', () => {
    const lines = prismDiffLines([
      { kind: 'context', text: 'const value = {' },
      { kind: 'deletion', text: '  enabled: false,' },
      { kind: 'addition', text: '  enabled: true,' },
      { kind: 'context', text: '};' },
    ], 'typescript');

    expect(lines[0]).toContainEqual({ text: 'const', kind: 'keyword' });
    expect(lines[1]).toContainEqual({ text: 'false', kind: 'boolean' });
    expect(lines[2]).toContainEqual({ text: 'true', kind: 'boolean' });
  });
});
