import { describe, it, expect } from 'vitest';
import { detectLanguage, computeStyles, LANG_TO_LSP_ID, type Language } from './syntax';

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------

describe('detectLanguage', () => {
  it.each([
    ['index.ts',   'TypeScript'],
    ['App.tsx',    'TSX'],
    ['util.js',    'JavaScript'],
    ['comp.jsx',   'JSX'],
    ['style.css',  'CSS'],
    ['theme.scss', 'SCSS'],
    ['vars.less',  'Less'],
    ['data.json',  'JSON'],
    ['script.py',  'Python'],
    ['main.cc',    'C++'],
    ['main.cpp',   'C++'],
    ['header.h',   'C++'],
    ['view.mm',    'ObjC++'],
    ['README.md',  'Markdown'],
    ['Makefile',   'Plain Text'],
    ['noext',      'Plain Text'],
  ] as [string, Language][])('"%s" -> %s', (filename, expected) => {
    expect(detectLanguage(filename)).toBe(expected);
  });

  it('is case-insensitive for extensions', () => {
    expect(detectLanguage('App.TSX')).toBe('TSX');
    expect(detectLanguage('style.CSS')).toBe('CSS');
  });
});

// ---------------------------------------------------------------------------
// LANG_TO_LSP_ID
// ---------------------------------------------------------------------------

describe('LANG_TO_LSP_ID', () => {
  it('maps TS/JS/JSX/TSX/CSS/SCSS/Less to lowercase LSP IDs', () => {
    expect(LANG_TO_LSP_ID['TypeScript']).toBe('typescript');
    expect(LANG_TO_LSP_ID['TSX']).toBe('tsx');
    expect(LANG_TO_LSP_ID['JavaScript']).toBe('javascript');
    expect(LANG_TO_LSP_ID['JSX']).toBe('jsx');
    expect(LANG_TO_LSP_ID['CSS']).toBe('css');
    expect(LANG_TO_LSP_ID['SCSS']).toBe('scss');
    expect(LANG_TO_LSP_ID['Less']).toBe('less');
  });

  it('does not include non-LSP languages', () => {
    expect(LANG_TO_LSP_ID['JSON']).toBeUndefined();
    expect(LANG_TO_LSP_ID['Python']).toBeUndefined();
    expect(LANG_TO_LSP_ID['C++']).toBeUndefined();
    expect(LANG_TO_LSP_ID['Markdown']).toBeUndefined();
    expect(LANG_TO_LSP_ID['Plain Text']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computeStyles
// ---------------------------------------------------------------------------

describe('computeStyles', () => {
  it('returns Uint8Array with same byte length as ASCII text', () => {
    const text = 'const x = 1;';
    const styles = computeStyles(text, 'TypeScript');
    expect(styles).toBeInstanceOf(Uint8Array);
    expect(styles.length).toBe(text.length);
  });

  it('returns all zeros for Plain Text', () => {
    const text = 'hello world';
    const styles = computeStyles(text, 'Plain Text');
    expect([...styles].every(b => b === 0)).toBe(true);
  });

  it('marks TypeScript keyword "const" as style 1', () => {
    // "const x = 1;" — "const" occupies chars 0-4
    const styles = computeStyles('const x = 1;', 'TypeScript');
    // chars 0..4 are the keyword "const"
    for (let i = 0; i < 5; i++) {
      expect(styles[i]).toBe(1); // keyword style
    }
    // space after keyword is default (0)
    expect(styles[5]).toBe(0);
  });

  it('marks string literals as style 2', () => {
    // "const s = 'hi';" — 'hi' is chars 10-13
    const styles = computeStyles("const s = 'hi';", 'JavaScript');
    // Find the quote char positions (10='\'', 11='h', 12='i', 13='\'')
    expect(styles[10]).toBe(2); // string start
    expect(styles[11]).toBe(2);
    expect(styles[12]).toBe(2);
  });

  it('marks line comments as style 3', () => {
    const text = '// comment';
    const styles = computeStyles(text, 'TypeScript');
    // all chars are inside comment
    for (let i = 0; i < text.length; i++) {
      expect(styles[i]).toBe(3);
    }
  });

  it('marks numeric literals as style 4', () => {
    const text = 'let n = 42;';
    const styles = computeStyles(text, 'JavaScript');
    // "42" starts at char 8
    expect(styles[8]).toBe(4);
    expect(styles[9]).toBe(4);
  });

  it('handles multi-byte UTF-8 characters — byte array longer than char count', () => {
    // U+00E9 (é) is 2 bytes in UTF-8, 1 UTF-16 code unit
    const text = '// café';
    const styles = computeStyles(text, 'TypeScript');
    // "café" has 4 chars but the é becomes 2 bytes → total bytes > chars
    expect(styles.length).toBeGreaterThan(text.length);
  });

  it('highlights lowercase TSX intrinsic tags like <view>', () => {
    const text = 'const el = <view><text>hi</text></view>;';
    const styles = computeStyles(text, 'TSX');

    const openView = text.indexOf('<view>');
    const openText = text.indexOf('<text>');
    const contentStart = text.indexOf('hi');

    expect(openView).toBeGreaterThanOrEqual(0);
    expect(openText).toBeGreaterThanOrEqual(0);
    expect(contentStart).toBeGreaterThanOrEqual(0);
    expect(styles[openView]).toBe(5);
    expect(styles[openView + 1]).toBe(5);
    expect(styles[openText + 1]).toBe(5);
    expect(styles[contentStart]).toBe(0);
    expect(styles[contentStart + 1]).toBe(0);
  });

  it('highlights TSX attribute names on intrinsic tags', () => {
    const text = '<view className="card" data-id={1} />';
    const styles = computeStyles(text, 'TSX');

    const classNameStart = text.indexOf('className');
    const dataIdStart = text.indexOf('data-id');

    expect(classNameStart).toBeGreaterThanOrEqual(0);
    expect(dataIdStart).toBeGreaterThanOrEqual(0);
    expect(styles[classNameStart]).toBe(5);
    expect(styles[dataIdStart]).toBe(5);
  });

  it('highlights intrinsic tags that follow a JSX expression block on a new line', () => {
    const text = `{ready ? <text>ok</text> : null}

<view className="panel-grid" />`;
    const styles = computeStyles(text, 'TSX');
    const viewStart = text.indexOf('<view');
    const classNameStart = text.indexOf('className');

    expect(viewStart).toBeGreaterThanOrEqual(0);
    expect(classNameStart).toBeGreaterThanOrEqual(0);
    expect(styles[viewStart]).toBe(5);
    expect(styles[viewStart + 1]).toBe(5);
    expect(styles[classNameStart]).toBe(5);
  });

  it('handles emoji (4-byte surrogate pair) in Plain Text — no crash', () => {
    const text = 'hello 🎉';
    const styles = computeStyles(text, 'Plain Text');
    expect(styles).toBeInstanceOf(Uint8Array);
  });

  it('produces styles for CSS selectors', () => {
    const text = 'body { color: red; }';
    const styles = computeStyles(text, 'CSS');
    expect(styles).toBeInstanceOf(Uint8Array);
    expect(styles.length).toBe(text.length);
    // At least some non-zero styles expected for CSS
    expect([...styles].some(b => b !== 0)).toBe(true);
  });

  it('produces styles for SCSS variables', () => {
    const text = '$primary: #fff;';
    const styles = computeStyles(text, 'SCSS');
    expect(styles).toBeInstanceOf(Uint8Array);
    expect([...styles].some(b => b !== 0)).toBe(true);
  });

  it('produces styles for Less', () => {
    // Less variables (@var) are tokenized as "variable" which is not in TOKEN_STYLE,
    // but CSS property names like "color" are tokenized as "property" (style 1).
    const text = '.btn { color: red; }';
    const styles = computeStyles(text, 'Less');
    expect(styles).toBeInstanceOf(Uint8Array);
    expect([...styles].some(b => b !== 0)).toBe(true);
  });

  it('does not crash on empty string', () => {
    expect(() => computeStyles('', 'TypeScript')).not.toThrow();
    expect(computeStyles('', 'TypeScript').length).toBe(0);
  });
});
