import { describe, it, expect } from 'vitest';
import { lineCharToByteOffset, markerToIndicator, packIndicators } from './diagnostics';
import type { DiagnosticMarker } from '../extension-host/types';

// ---------------------------------------------------------------------------
// lineCharToByteOffset
// ---------------------------------------------------------------------------

describe('lineCharToByteOffset', () => {
  it('returns 0 for (0, 0) in any text', () => {
    expect(lineCharToByteOffset('hello', 0, 0)).toBe(0);
    expect(lineCharToByteOffset('', 0, 0)).toBe(0);
  });

  it('ASCII single line: char offset = byte offset', () => {
    const text = 'hello world';
    expect(lineCharToByteOffset(text, 0, 5)).toBe(5);
    expect(lineCharToByteOffset(text, 0, 11)).toBe(11);
  });

  it('multi-line ASCII: accounts for \\n bytes between lines', () => {
    const text = 'abc\ndef\nghi';
    // line 1 char 0 → skip 'abc\n' = 4 bytes
    expect(lineCharToByteOffset(text, 1, 0)).toBe(4);
    // line 1 char 3 → 4 + 3 = 7
    expect(lineCharToByteOffset(text, 1, 3)).toBe(7);
    // line 2 char 0 → 'abc\n' + 'def\n' = 8 bytes
    expect(lineCharToByteOffset(text, 2, 0)).toBe(8);
  });

  it('2-byte UTF-8 characters (é = U+00E9)', () => {
    // 'café' = c(1) a(1) f(1) é(2) = 5 bytes, but 4 chars
    const text = 'café';
    // char 0 → 0 bytes
    expect(lineCharToByteOffset(text, 0, 0)).toBe(0);
    // char 3 → c+a+f = 3 bytes
    expect(lineCharToByteOffset(text, 0, 3)).toBe(3);
    // char 4 → c+a+f+é = 3+2 = 5 bytes
    expect(lineCharToByteOffset(text, 0, 4)).toBe(5);
  });

  it('3-byte UTF-8 characters (中 = U+4E2D)', () => {
    // '中文' = 中(3) 文(3) = 6 bytes, 2 chars
    const text = '中文';
    expect(lineCharToByteOffset(text, 0, 0)).toBe(0);
    expect(lineCharToByteOffset(text, 0, 1)).toBe(3);
    expect(lineCharToByteOffset(text, 0, 2)).toBe(6);
  });

  it('4-byte UTF-8 surrogate pairs (🎉 = U+1F389)', () => {
    // '🎉' takes 2 UTF-16 code units but 4 UTF-8 bytes
    const text = '🎉';
    expect(lineCharToByteOffset(text, 0, 0)).toBe(0);
    // After the full emoji (2 UTF-16 units consumed)
    expect(lineCharToByteOffset(text, 0, 2)).toBe(4);
  });

  it('mixed: ASCII + multibyte on separate lines', () => {
    const text = 'hi\n中文\nbye';
    // line 0: 'hi' = 2 bytes + '\n' = 3
    // line 1 char 0 → 3
    expect(lineCharToByteOffset(text, 1, 0)).toBe(3);
    // line 1 char 1 → 3 + 3 (中) = 6
    expect(lineCharToByteOffset(text, 1, 1)).toBe(6);
    // line 2 char 0 → 3 + 6 + 1 (newline) = 10
    expect(lineCharToByteOffset(text, 2, 0)).toBe(10);
  });

  it('clamps char to line length when char is too large', () => {
    const text = 'abc';
    // char 100 should clamp to end of 'abc' = 3 bytes
    expect(lineCharToByteOffset(text, 0, 100)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// markerToIndicator
// ---------------------------------------------------------------------------

describe('markerToIndicator', () => {
  const makeMarker = (
    sl: number, sc: number, el: number, ec: number,
    sev: DiagnosticMarker['severity'] = 'error',
  ): DiagnosticMarker => ({
    startLine: sl, startChar: sc, endLine: el, endChar: ec,
    severity: sev, message: 'test', source: 'typescript',
  });

  it('converts severity to indicator style', () => {
    const text = 'const x = 1;';
    expect(markerToIndicator(text, makeMarker(0, 0, 0, 5, 'error')).style).toBe(0);
    expect(markerToIndicator(text, makeMarker(0, 0, 0, 5, 'warning')).style).toBe(1);
    expect(markerToIndicator(text, makeMarker(0, 0, 0, 5, 'info')).style).toBe(2);
    expect(markerToIndicator(text, makeMarker(0, 0, 0, 5, 'hint')).style).toBe(2);
  });

  it('start position is correct byte offset', () => {
    const text = 'hello world';
    const ind = markerToIndicator(text, makeMarker(0, 6, 0, 11));
    expect(ind.start).toBe(6);
    expect(ind.length).toBe(5);
  });

  it('length is at least 1 (for zero-length markers)', () => {
    const text = 'abc';
    const ind = markerToIndicator(text, makeMarker(0, 2, 0, 2));
    expect(ind.length).toBeGreaterThanOrEqual(1);
  });

  it('multi-line marker: length spans across bytes', () => {
    // 'abc\ndef' — marker from (0,3) to (1,3)
    const text = 'abc\ndef';
    const ind = markerToIndicator(text, makeMarker(0, 3, 1, 3));
    const startByte = 3; // end of 'abc'
    const endByte   = 7; // 'abc\n' + 'def' = 7
    expect(ind.start).toBe(startByte);
    expect(ind.length).toBe(endByte - startByte);
  });

  it('handles UTF-8 multi-byte correctly in byte offsets', () => {
    // 'café error' — error starts at char 5 ('e'), which is byte 6 (é is 2 bytes)
    const text = 'café error';
    const ind = markerToIndicator(text, makeMarker(0, 5, 0, 10));
    expect(ind.start).toBe(6);  // 'c'(1)+'a'(1)+'f'(1)+'é'(2)+' '(1) = 6
    expect(ind.length).toBe(5); // 'error' = 5 ASCII bytes
  });
});

// ---------------------------------------------------------------------------
// packIndicators
// ---------------------------------------------------------------------------

describe('packIndicators', () => {
  it('returns an ArrayBuffer', () => {
    const buf = packIndicators([{ start: 0, length: 5, style: 0 }]);
    expect(buf).toBeInstanceOf(ArrayBuffer);
  });

  it('packs single indicator as 3 int32s (12 bytes)', () => {
    const buf = packIndicators([{ start: 10, length: 5, style: 2 }]);
    expect(buf.byteLength).toBe(12);
    const view = new Int32Array(buf);
    expect(view[0]).toBe(10); // start
    expect(view[1]).toBe(5);  // length
    expect(view[2]).toBe(2);  // style
  });

  it('packs multiple indicators', () => {
    const ranges = [
      { start: 0,  length: 3, style: 0 },
      { start: 10, length: 5, style: 1 },
    ];
    const buf = packIndicators(ranges);
    expect(buf.byteLength).toBe(24); // 2 × 12 bytes
    const view = new Int32Array(buf);
    expect(view[0]).toBe(0);  expect(view[1]).toBe(3);  expect(view[2]).toBe(0);
    expect(view[3]).toBe(10); expect(view[4]).toBe(5);  expect(view[5]).toBe(1);
  });

  it('returns empty ArrayBuffer for empty input', () => {
    const buf = packIndicators([]);
    expect(buf.byteLength).toBe(0);
  });
});
