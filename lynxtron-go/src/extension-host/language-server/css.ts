// NOTE: Do NOT use top-level static imports for vscode-css-languageservice here.
// The library calls Intl APIs in its module-level initialization code
// (languageFacts/entry.js), which crashes on Lynxtron's small-icu Node.js build.
// All requires are deferred inside ensureCSSServices() so they run only on first
// CSS file request, not at bundle load time.

import type { LanguageService } from 'vscode-css-languageservice';
import type { DiagnosticMarker } from '../types';

let cssLS: LanguageService | null = null;
let scssLS: LanguageService | null = null;
let lessLS: LanguageService | null = null;
let initError: string | null = null;

function ensureCSSServices(): boolean {
  if (initError) return false;
  if (cssLS) return true;
  try {
    // Lazy require — executed only when the first CSS/SCSS/Less file is analyzed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cssLib = require('vscode-css-languageservice') as typeof import('vscode-css-languageservice');
    cssLS  = cssLib.getCSSLanguageService();
    scssLS = cssLib.getSCSSLanguageService();
    lessLS = cssLib.getLESSLanguageService();
    return true;
  } catch (e) {
    initError = String(e);
    console.error('[CSSLanguageService] init failed (ICU?):', e);
    return false;
  }
}

function getLS(languageId: string): LanguageService {
  if (languageId === 'scss') return scssLS!;
  if (languageId === 'less') return lessLS!;
  return cssLS!;
}

// LSP DiagnosticSeverity numeric values (avoids runtime import of vscode-languageserver-types)
const LSP_ERROR = 1, LSP_WARNING = 2, LSP_INFO = 3;

function lspSeverityToIde(sev?: number): DiagnosticMarker['severity'] {
  if (sev === LSP_ERROR)   return 'error';
  if (sev === LSP_WARNING) return 'warning';
  if (sev === LSP_INFO)    return 'info';
  return 'hint';
}

export class CSSLanguageService {
  getDiagnostics(uri: string, text: string, languageId: string): DiagnosticMarker[] {
    if (!ensureCSSServices()) return []; // CSS service unavailable (ICU error)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TextDocument } = require('vscode-languageserver-textdocument') as typeof import('vscode-languageserver-textdocument');
      const ls = getLS(languageId);
      const doc = TextDocument.create(`file://${uri}`, languageId, 1, text);
      const stylesheet = ls.parseStylesheet(doc);
      const diags = ls.doValidation(doc, stylesheet);

      return diags.map(d => ({
        startLine: d.range.start.line,
        startChar: d.range.start.character,
        endLine: d.range.end.line,
        endChar: d.range.end.character,
        severity: lspSeverityToIde(d.severity),
        message: d.message,
        source: languageId,
        code: d.code as string | undefined,
      }));
    } catch (_) {
      return [];
    }
  }
}
