// Syntax highlighting via Prism.js
// Style codes match scintilla_view.mm:
//   0 = Default, 1 = Keyword, 2 = String, 3 = Comment, 4 = Number, 5 = Type

import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-less';

export type Language =
  | 'TypeScript' | 'TSX'
  | 'JavaScript' | 'JSX'
  | 'CSS' | 'SCSS' | 'Less'
  | 'JSON' | 'Python'
  | 'C++' | 'ObjC++'
  | 'Markdown' | 'Plain Text';

// Maps file extension -> Language display name
const EXT_LANG: Record<string, Language> = {
  ts: 'TypeScript', tsx: 'TSX',
  js: 'JavaScript', jsx: 'JSX',
  css: 'CSS', scss: 'SCSS', less: 'Less',
  json: 'JSON', py: 'Python',
  cc: 'C++', cpp: 'C++', c: 'C++', h: 'C++', mm: 'ObjC++', m: 'ObjC++',
  md: 'Markdown', markdown: 'Markdown',
};

export function detectLanguage(filename: string): Language {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXT_LANG[ext] || 'Plain Text';
}

// Maps Language -> LSP language ID used by Extension Host for routing
export const LANG_TO_LSP_ID: Partial<Record<Language, string>> = {
  'TypeScript': 'typescript',
  'TSX':        'tsx',
  'JavaScript': 'javascript',
  'JSX':        'jsx',
  'CSS':        'css',
  'SCSS':       'scss',
  'Less':       'less',
};

// Prism grammar per language
function getGrammar(lang: Language): Prism.Grammar | null {
  switch (lang) {
    case 'JavaScript': return Prism.languages.javascript;
    case 'JSX':        return Prism.languages.jsx || Prism.languages.javascript;
    case 'TypeScript': return Prism.languages.typescript;
    case 'TSX':        return Prism.languages.tsx || Prism.languages.typescript;
    case 'CSS':        return Prism.languages.css;
    case 'SCSS':       return Prism.languages.scss;
    case 'Less':       return Prism.languages.less;
    case 'JSON':       return Prism.languages.json;
    case 'Python':     return Prism.languages.python;
    case 'C++':        return Prism.languages.cpp;
    case 'ObjC++':     return Prism.languages.objectivec || Prism.languages.cpp;
    case 'Markdown':   return Prism.languages.markdown;
    default:           return null;
  }
}

// Map Prism token types → Scintilla style codes
const TOKEN_STYLE: Record<string, number> = {
  // Comments (3)
  comment: 3,
  // Strings (2)
  string: 2, char: 2, regex: 2,
  'template-string': 2, 'template-literal': 2,
  'template-punctuation': 2, 'string-interpolation': 2,
  // Keywords (1)
  keyword: 1, boolean: 1, null: 1, 'nil-value': 1,
  important: 1, atrule: 1, directive: 1, property: 1,
  // Numbers (4)
  number: 4, constant: 4, unit: 4,
  // Types / functions (5)
  'class-name': 5, 'maybe-class-name': 5,
  function: 5, builtin: 5, selector: 5,
  'function-definition': 5, decorator: 5,
};

type TokenStream = Array<string | Prism.Token>;

function previousNonWhitespaceIndex(text: string, from: number): number {
  for (let i = from; i >= 0; i--) {
    if (!/\s/.test(text[i])) return i;
  }
  return -1;
}

function hasLineBreakBetween(text: string, start: number, end: number): boolean {
  return /[\r\n]/.test(text.slice(start, end));
}

function endsWithJsxKeywordContext(text: string, tagStart: number): boolean {
  return /\b(return|throw|case|yield|await)\s*$/.test(text.slice(0, tagStart));
}

function looksLikeJsxTagStart(text: string, index: number): boolean {
  if (text[index] !== '<') return false;

  let cursor = index + 1;
  const isClosingTag = text[cursor] === '/';
  if (isClosingTag) cursor++;

  const firstChar = text[cursor];
  if (!firstChar || !/[A-Za-z]/.test(firstChar)) return false;
  if (isClosingTag) return true;

  const prevIdx = previousNonWhitespaceIndex(text, index - 1);
  if (prevIdx < 0) return true;

  const prev = text[prevIdx];
  if ('=({[,>:;!?'.includes(prev)) return true;
  if ('})'.includes(prev) && hasLineBreakBetween(text, prevIdx + 1, index)) return true;
  return endsWithJsxKeywordContext(text, index);
}

function isJsxNameChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9._:-]/.test(ch);
}

function applyJsxTagStyles(text: string, styles: Uint8Array): void {
  for (let i = 0; i < text.length; i++) {
    if (!looksLikeJsxTagStart(text, i)) continue;

    let cursor = i + 1;
    if (text[cursor] === '/') cursor++;

    const nameStart = cursor;
    while (isJsxNameChar(text[cursor])) cursor++;
    if (cursor === nameStart) continue;

    styles.fill(5, i, cursor);

    let quote: '"' | "'" | null = null;
    let braceDepth = 0;

    while (cursor < text.length) {
      const ch = text[cursor];

      if (quote) {
        if (ch === quote && text[cursor - 1] !== '\\') quote = null;
        cursor++;
        continue;
      }

      if (braceDepth > 0) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        cursor++;
        continue;
      }

      if (ch === '"' || ch === "'") {
        quote = ch;
        cursor++;
        continue;
      }

      if (ch === '{') {
        braceDepth = 1;
        cursor++;
        continue;
      }

      if (ch === '>') {
        styles[cursor] = 5;
        break;
      }

      if (ch === '/' && text[cursor + 1] === '>') {
        styles[cursor] = 5;
        styles[cursor + 1] = 5;
        cursor++;
        break;
      }

      if (/[A-Za-z_]/.test(ch)) {
        const attrStart = cursor;
        while (isJsxNameChar(text[cursor])) cursor++;
        styles.fill(5, attrStart, cursor);
        continue;
      }

      cursor++;
    }

    i = cursor;
  }
}

// Recursively walk token tree, filling charStyles. Inherited style propagates
// from parent tokens into nested plain-text strings.
function fillTokens(
  tokens: TokenStream,
  styles: Uint8Array,
  offset: number,
  inherited: number,
): number {
  for (const tok of tokens) {
    if (typeof tok === 'string') {
      if (inherited !== 0) {
        const end = Math.min(offset + tok.length, styles.length);
        styles.fill(inherited, offset, end);
      }
      offset += tok.length;
    } else {
      const style = TOKEN_STYLE[tok.type] ?? inherited;
      const content = tok.content;
      if (typeof content === 'string') {
        if (style !== 0) {
          const end = Math.min(offset + content.length, styles.length);
          styles.fill(style, offset, end);
        }
        offset += content.length;
      } else {
        offset = fillTokens(content as TokenStream, styles, offset, style);
      }
    }
  }
  return offset;
}

// Convert character-indexed styles → UTF-8 byte-indexed styles (Scintilla
// operates on bytes; JS strings are UTF-16 code units).
function charToByteStyles(text: string, charStyles: Uint8Array): Uint8Array {
  let allAscii = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) { allAscii = false; break; }
  }
  if (allAscii) return charStyles;

  let byteCount = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    if (cp < 0x80) byteCount += 1;
    else if (cp < 0x800) byteCount += 2;
    else if (cp < 0x10000) byteCount += 3;
    else { byteCount += 4; i++; }
  }

  const byteStyles = new Uint8Array(byteCount);
  let byteIdx = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    let byteLen: number;
    if (cp < 0x80) byteLen = 1;
    else if (cp < 0x800) byteLen = 2;
    else if (cp < 0x10000) byteLen = 3;
    else { byteLen = 4; i++; }
    const style = charStyles[i] ?? 0;
    for (let b = 0; b < byteLen; b++) byteStyles[byteIdx++] = style;
  }
  return byteStyles;
}

export function computeStyles(text: string, lang: Language): Uint8Array {
  const charStyles = new Uint8Array(text.length); // default 0
  const grammar = getGrammar(lang);
  if (grammar) {
    try {
      fillTokens(Prism.tokenize(text, grammar), charStyles, 0, 0);
    } catch (_) { /* silent fallback to unstyled */ }
  }
  if (lang === 'TSX' || lang === 'JSX') {
    applyJsxTagStyles(text, charStyles);
  }
  return charToByteStyles(text, charStyles);
}
