import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCINTILLA_MODULE = path.resolve(
  TEST_DIR,
  '../../../scintilla-extension/module',
);

describe('Scintilla host content replacement', () => {
  it('starts loaded documents with an empty native undo history', () => {
    // Both adapters must use the shared load boundary. The native
    // document_load_test covers real Scintilla undo/redo behaviour.
    for (const adapter of ['scintilla_view.mm', 'scintilla_view_win.cc']) {
      const source = fs.readFileSync(path.join(SCINTILLA_MODULE, adapter), 'utf8');
      const setContent = source.slice(
        source.indexOf('void ScintillaView::SetContent'),
        source.indexOf('std::string ScintillaView::GetContent'),
      );
      expect(setContent).toContain('LoadEditorDocument(');
    }
    const setContent = fs.readFileSync(path.join(SCINTILLA_MODULE, 'document_load.h'), 'utf8');

    const setText = setContent.indexOf('send(SCI_SETTEXT');
    const emptyUndo = setContent.indexOf('send(SCI_EMPTYUNDOBUFFER', setText);
    const savePoint = setContent.indexOf('send(SCI_SETSAVEPOINT', emptyUndo);

    expect(setText).toBeGreaterThanOrEqual(0);
    expect(emptyUndo).toBeGreaterThan(setText);
    expect(savePoint).toBeGreaterThan(emptyUndo);
  });
});
