/**
 * Diagnostic position conversion utilities.
 *
 * TypeScript Compiler API and vscode-css-languageservice return positions as
 * (line, character) pairs where `character` is a UTF-16 code-unit index (same
 * as VS Code / LSP convention).
 *
 * Scintilla expects byte offsets into the UTF-8 document.
 *
 * This module converts between the two coordinate systems.
 */

import type { DiagnosticMarker } from '../extension-host/types';

// ---------------------------------------------------------------------------
// UTF-8 byte length of a JS string (UTF-16 string → UTF-8 byte count)
// ---------------------------------------------------------------------------

function utf8ByteLength(s: string): number {
  let len = 0;
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i)!;
    if (cp < 0x80) len += 1;
    else if (cp < 0x800) len += 2;
    else if (cp < 0x10000) len += 3;
    else { len += 4; i++; } // surrogate pair — skip second unit
  }
  return len;
}

// ---------------------------------------------------------------------------
// Convert (line, charUTF16) → UTF-8 byte offset in the document
// ---------------------------------------------------------------------------

/**
 * Convert a (line, character) position (0-based, UTF-16 char units) to a
 * UTF-8 byte offset from the beginning of `text`.
 *
 * Lines are split on '\n'. The function clamps gracefully when the position
 * is out of range (returns document length).
 */
export function lineCharToByteOffset(text: string, line: number, char: number): number {
  const lines = text.split('\n');
  let byteOffset = 0;

  // Accumulate bytes for preceding lines (including their '\n').
  for (let i = 0; i < line && i < lines.length; i++) {
    byteOffset += utf8ByteLength(lines[i]) + 1; // +1 for \n
  }

  // Accumulate bytes within the target line up to char (UTF-16 units).
  const lineText = lines[line] ?? '';
  // char may be measured in UTF-16 code units (surrogate pairs count as 2).
  // We walk code units directly so surrogate pairs are handled correctly.
  const clampedChar = Math.min(char, lineText.length);
  byteOffset += utf8ByteLength(lineText.slice(0, clampedChar));

  return byteOffset;
}

// ---------------------------------------------------------------------------
// Convert a DiagnosticMarker to a Scintilla indicator range
// ---------------------------------------------------------------------------

export interface IndicatorRange {
  start: number;   // UTF-8 byte offset
  length: number;  // UTF-8 byte length (minimum 1)
  style: number;   // 0=error, 1=warning, 2=info/hint
}

/**
 * Scintilla reports dwell positions at character boundaries. Accept the end
 * boundary as well as the covered bytes so a one-character/EOF squiggle is
 * hoverable across its full painted width.
 */
export function indicatorContainsBytePosition(
  indicator: IndicatorRange,
  bytePosition: number,
): boolean {
  return bytePosition >= indicator.start
    && bytePosition <= indicator.start + indicator.length;
}

function severityToStyle(sev: DiagnosticMarker['severity']): number {
  if (sev === 'error')   return 0;
  if (sev === 'warning') return 1;
  return 2; // info or hint
}

export function markerToIndicator(text: string, marker: DiagnosticMarker): IndicatorRange {
  const documentLength = utf8ByteLength(text);
  let start = Math.min(documentLength, lineCharToByteOffset(text, marker.startLine, marker.startChar));
  const end = Math.min(documentLength, lineCharToByteOffset(text, marker.endLine, marker.endChar));
  let length = Math.max(0, end - start);

  // Parser diagnostics are often zero-width at EOF (for example "'('
  // expected"). Scintilla cannot paint or dwell over a byte that is outside
  // the document, so anchor the indicator to the final UTF-8 code point.
  if (length === 0 && start === documentLength && documentLength > 0) {
    const lastCodePoint = Array.from(text).pop()!;
    length = utf8ByteLength(lastCodePoint);
    start -= length;
  }

  return {
    start,
    length: Math.max(1, length),
    style:  severityToStyle(marker.severity),
  };
}

/**
 * Pack IndicatorRange[] into an Int32Array buffer for the N-API
 * `setIndicators(editorId, buffer)` call.
 * Layout: [start, length, style,  start, length, style, ...]
 */
export function packIndicators(ranges: IndicatorRange[]): ArrayBuffer {
  const buf = new Int32Array(ranges.length * 3);
  for (let i = 0; i < ranges.length; i++) {
    buf[i * 3 + 0] = ranges[i].start;
    buf[i * 3 + 1] = ranges[i].length;
    buf[i * 3 + 2] = ranges[i].style;
  }
  return buf.buffer;
}
