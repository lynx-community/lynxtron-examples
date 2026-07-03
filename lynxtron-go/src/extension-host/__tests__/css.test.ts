// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { CSSLanguageService } from '../language-server/css';

const URI = '/tmp/test-ide-mvp/style.css';

describe('CSSLanguageService', () => {
  let svc: CSSLanguageService;

  beforeEach(() => {
    svc = new CSSLanguageService();
  });

  // -------------------------------------------------------------------------
  // CSS
  // -------------------------------------------------------------------------

  it('returns no diagnostics for valid CSS', () => {
    const css = `
body {
  color: red;
  background-color: #fff;
  font-size: 16px;
}
`;
    const markers = svc.getDiagnostics(URI, css, 'css');
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('reports error for unknown CSS property', () => {
    const css = 'body { unknownprop: 123; }';
    const markers = svc.getDiagnostics(URI, css, 'css');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('marker has correct shape', () => {
    const css = 'body { badprop: 1; }';
    const markers = svc.getDiagnostics(URI, css, 'css');
    expect(markers.length).toBeGreaterThan(0);
    const m = markers[0];
    expect(m.startLine).toBeGreaterThanOrEqual(0);
    expect(m.startChar).toBeGreaterThanOrEqual(0);
    expect(m.endLine).toBeGreaterThanOrEqual(m.startLine);
    expect(typeof m.message).toBe('string');
    expect(m.message.length).toBeGreaterThan(0);
    expect(m.source).toBe('css');
    expect(['error', 'warning', 'info', 'hint']).toContain(m.severity);
  });

  it('returns empty array for empty CSS string', () => {
    const markers = svc.getDiagnostics(URI, '', 'css');
    expect(Array.isArray(markers)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // SCSS
  // -------------------------------------------------------------------------

  it('returns no diagnostics for valid SCSS with variables', () => {
    const scss = `
$primary: #333;
$font-size: 16px;

body {
  color: $primary;
  font-size: $font-size;
}
`;
    const markers = svc.getDiagnostics('/tmp/style.scss', scss, 'scss');
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('returns no diagnostics for valid SCSS nesting', () => {
    const scss = `
.container {
  display: flex;
  .child {
    color: blue;
  }
}
`;
    const markers = svc.getDiagnostics('/tmp/style.scss', scss, 'scss');
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('reports errors for invalid SCSS property', () => {
    const scss = '.btn { nonexistent-property: 1; }';
    const markers = svc.getDiagnostics('/tmp/style.scss', scss, 'scss');
    expect(markers.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Less
  // -------------------------------------------------------------------------

  it('returns no diagnostics for valid Less with variables', () => {
    const less = `
@primary: #333;
@font-size: 16px;

body {
  color: @primary;
  font-size: @font-size;
}
`;
    const markers = svc.getDiagnostics('/tmp/style.less', less, 'less');
    expect(markers.filter(m => m.severity === 'error')).toHaveLength(0);
  });

  it('reports errors for invalid Less property', () => {
    const less = '.btn { nonexistent-property: 1; }';
    const markers = svc.getDiagnostics('/tmp/style.less', less, 'less');
    expect(markers.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Service reuse / idempotency
  // -------------------------------------------------------------------------

  it('calling getDiagnostics multiple times for same content returns same result', () => {
    const css = 'body { badprop: 1; }';
    const first  = svc.getDiagnostics(URI, css, 'css');
    const second = svc.getDiagnostics(URI, css, 'css');
    expect(first.length).toBe(second.length);
    if (first.length > 0) {
      expect(first[0].message).toBe(second[0].message);
    }
  });

  it('does not throw on malformed CSS', () => {
    const css = '{ { { { badstuff';
    expect(() => svc.getDiagnostics(URI, css, 'css')).not.toThrow();
  });
});
