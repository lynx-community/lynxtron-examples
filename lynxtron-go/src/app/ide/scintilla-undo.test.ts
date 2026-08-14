import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCINTILLA_VIEW_SOURCE = path.resolve(
  TEST_DIR,
  '../../../scintilla-extension/module/scintilla_view.mm',
);

describe('Scintilla host content replacement', () => {
  it('starts loaded documents with an empty native undo history', () => {
    const source = fs.readFileSync(SCINTILLA_VIEW_SOURCE, 'utf8');
    const setContent = source.slice(
      source.indexOf('void ScintillaView::SetContent'),
      source.indexOf('std::string ScintillaView::GetContent'),
    );

    const setText = setContent.indexOf('message:SCI_SETTEXT');
    const emptyUndo = setContent.indexOf('message:SCI_EMPTYUNDOBUFFER', setText);
    const savePoint = setContent.indexOf('message:SCI_SETSAVEPOINT', emptyUndo);

    expect(setText).toBeGreaterThanOrEqual(0);
    expect(emptyUndo).toBeGreaterThan(setText);
    expect(savePoint).toBeGreaterThan(emptyUndo);
  });
});
