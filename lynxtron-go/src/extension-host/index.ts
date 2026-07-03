/**
 * Extension Host — runs as a Node.js child process spawned by main.ts.
 * Communicates with the main process via Node.js built-in IPC (process.send /
 * process.on('message')).
 *
 * Responsibilities:
 *  - TypeScript / JavaScript / JSX / TSX diagnostics via ts.LanguageService
 *  - CSS / SCSS / Less diagnostics via vscode-css-languageservice
 */

import { TypeScriptLanguageService } from './language-server/typescript';
import { CSSLanguageService } from './language-server/css';
import type { HostInMessage, HostOutMessage, TextChangedMsg } from './types';

const tsService  = new TypeScriptLanguageService();
const cssService = new CSSLanguageService();

const TS_LANG_IDS  = new Set(['typescript', 'tsx', 'javascript', 'jsx']);
const CSS_LANG_IDS = new Set(['css', 'scss', 'less']);

function handleTextChanged(msg: TextChangedMsg): void {
  const { uri, text, version, languageId } = msg;

  let markers: HostOutMessage['markers'] = [];

  if (TS_LANG_IDS.has(languageId)) {
    tsService.updateFile(uri, text, version);
    markers = tsService.getDiagnostics(uri);
  } else if (CSS_LANG_IDS.has(languageId)) {
    markers = cssService.getDiagnostics(uri, text, languageId);
  }

  const out: HostOutMessage = { type: 'diagnostics', uri, markers };
  process.send!(out);
}

process.on('message', (msg: HostInMessage) => {
  if (msg.type === 'textChanged') handleTextChanged(msg);
});

// Exit when the parent process disconnects (window closed / app quit).
process.on('disconnect', () => {
  process.exit(0);
});

// Signal readiness to main process
process.send!({ type: 'ready' });
