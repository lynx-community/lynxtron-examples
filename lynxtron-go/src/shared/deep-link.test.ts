import { describe, expect, it } from 'vitest';
import { extractDeepLinkUrlFromArgv, parseDeepLinkUrl } from './deep-link';

describe('parseDeepLinkUrl', () => {
  it('parses home deep link', () => {
    const result = parseDeepLinkUrl('lynxtron://home');
    expect(result).toEqual({
      ok: true,
      intent: { kind: 'home' },
    });
  });

  it('parses showcase deep link', () => {
    const result = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark');
    expect(result).toEqual({
      ok: true,
      intent: { kind: 'showcase-open', showcaseId: 'benchmark' },
    });
  });

  it('parses example deep link and normalizes path', () => {
    const result = parseDeepLinkUrl('lynxtron://example/open?path=/view/');
    expect(result).toEqual({
      ok: true,
      intent: { kind: 'example-open', examplePath: 'view' },
    });
  });

  it('parses optional file navigation for showcase and normalizes the relative path', () => {
    const result = parseDeepLinkUrl(
      'lynxtron://showcase/open?id=benchmark&file=src/./app/../app/App.tsx&line=42&column=7',
    );
    expect(result).toEqual({
      ok: true,
      intent: {
        kind: 'showcase-open',
        showcaseId: 'benchmark',
        navigation: {
          filePath: 'src/app/App.tsx',
          line: 42,
          column: 7,
        },
      },
    });
  });

  it('parses file-only navigation for example deep link', () => {
    const result = parseDeepLinkUrl('lynxtron://example/open?path=view&file=src/App.tsx');
    expect(result).toEqual({
      ok: true,
      intent: {
        kind: 'example-open',
        examplePath: 'view',
        navigation: {
          filePath: 'src/App.tsx',
        },
      },
    });
  });

  it('rejects unsupported routes', () => {
    const result = parseDeepLinkUrl('lynxtron://folder/open?path=/tmp/demo');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNSUPPORTED_ROUTE');
  });

  it('rejects missing required parameters', () => {
    const result = parseDeepLinkUrl('lynxtron://showcase/open');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_PARAM');
  });

  it('rejects absolute and escaping file paths', () => {
    const absolute = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark&file=/tmp/App.tsx');
    expect(absolute.ok).toBe(false);
    if (absolute.ok) return;
    expect(absolute.error.code).toBe('INVALID_PARAM');

    const escaping = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark&file=../../App.tsx');
    expect(escaping.ok).toBe(false);
    if (escaping.ok) return;
    expect(escaping.error.code).toBe('INVALID_PARAM');
  });

  it('rejects line and column without file', () => {
    const lineOnly = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark&line=9');
    expect(lineOnly.ok).toBe(false);
    if (lineOnly.ok) return;
    expect(lineOnly.error.code).toBe('INVALID_PARAM');

    const columnOnly = parseDeepLinkUrl('lynxtron://example/open?path=view&column=3');
    expect(columnOnly.ok).toBe(false);
    if (columnOnly.ok) return;
    expect(columnOnly.error.code).toBe('INVALID_PARAM');
  });

  it('rejects column without line and non-positive coordinates', () => {
    const missingLine = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark&file=src/App.tsx&column=3');
    expect(missingLine.ok).toBe(false);
    if (missingLine.ok) return;
    expect(missingLine.error.code).toBe('INVALID_PARAM');

    const invalidLine = parseDeepLinkUrl('lynxtron://showcase/open?id=benchmark&file=src/App.tsx&line=0');
    expect(invalidLine.ok).toBe(false);
    if (invalidLine.ok) return;
    expect(invalidLine.error.code).toBe('INVALID_PARAM');
  });

  it('parses bundle URL deep link', () => {
    const result = parseDeepLinkUrl('lynxtron://lynxview_page?bundle=https://example.com/bundle.lynx');
    expect(result).toEqual({
      ok: true,
      intent: { kind: 'bundle-url-open', url: 'https://example.com/bundle.lynx' },
    });
  });

  it('parses bundle URL deep link with title', () => {
    const result = parseDeepLinkUrl('lynxtron://lynxview_page?bundle=https://example.com/bundle.lynx&title=My%20App');
    expect(result).toEqual({
      ok: true,
      intent: { kind: 'bundle-url-open', url: 'https://example.com/bundle.lynx', title: 'My App' },
    });
  });

  it('rejects bundle URL deep link with missing URL', () => {
    const result = parseDeepLinkUrl('lynxtron://lynxview_page');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MISSING_PARAM');
  });

  it('rejects bundle URL deep link with invalid URL', () => {
    const result = parseDeepLinkUrl('lynxtron://lynxview_page?bundle=not-a-valid-url');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_PARAM');
  });
});

describe('extractDeepLinkUrlFromArgv', () => {
  it('returns the first deep link argument', () => {
    const result = extractDeepLinkUrlFromArgv([
      '/Applications/Lynxtron GO.app/Contents/MacOS/lynxtron-go',
      '--inspect=9222',
      'lynxtron://example/open?path=view',
    ]);
    expect(result).toBe('lynxtron://example/open?path=view');
  });

  it('returns null when argv has no deep link', () => {
    const result = extractDeepLinkUrlFromArgv(['lynxtron-go', '--help']);
    expect(result).toBeNull();
  });
});
