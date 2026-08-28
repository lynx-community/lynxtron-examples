import { describe, it, expect } from 'vitest';
import {
  toPersisted,
  fromPersisted,
  visibleEditorIds, isSafeRelativePath,
  languageForId,
  type FiddleSnapshot,
} from './FiddleState';
import { DEFAULT_EDITORS } from '../types';
import { diagnosticUriForFiddleFile } from './fiddleDiagnostics';

function projectSnapshot(): FiddleSnapshot {
  const contents: Record<string, string> = {
    [DEFAULT_EDITORS.MAIN]: '// main',
    [DEFAULT_EDITORS.RENDERER]: '// renderer',
    [DEFAULT_EDITORS.PRELOAD]: '',
    [DEFAULT_EDITORS.CSS]: '',
    [DEFAULT_EDITORS.PACKAGE]: '{"scripts":{"build":"build"}}',
  };
  return {
    source: { kind: 'local', ref: '/workspace/project' },
    title: 'Project',
    activeEditorId: DEFAULT_EDITORS.MAIN,
    files: new Map(Object.entries(contents).map(([id, content]) => [id, {
      id,
      savedContent: content,
      currentText: content,
      language: languageForId(id),
      isDirty: false,
      visible: id === DEFAULT_EDITORS.MAIN || id === DEFAULT_EDITORS.RENDERER,
    }])),
  };
}

describe('fiddle session persistence', () => {
  it('round-trips a project session', () => {
    const snap = projectSnapshot();
    const restored = fromPersisted(JSON.parse(JSON.stringify(toPersisted(snap))));
    expect(restored).not.toBeNull();
    expect(restored!.title).toBe(snap.title);
    expect(restored!.activeEditorId).toBe(snap.activeEditorId);
    expect([...restored!.files.keys()]).toEqual([...snap.files.keys()]);
    for (const [id, f] of snap.files.entries()) {
      const r = restored!.files.get(id)!;
      expect(r.currentText).toBe(f.currentText);
      expect(r.savedContent).toBe(f.savedContent);
      expect(r.visible).toBe(f.visible);
      expect(r.isDirty).toBe(false);
    }
  });

  it('preserves visibility and unsaved edits', () => {
    const snap = projectSnapshot();
    const main = snap.files.get(DEFAULT_EDITORS.MAIN)!;
    snap.files.set(DEFAULT_EDITORS.MAIN, { ...main, currentText: main.currentText + '\n// edited', visible: false });
    const restored = fromPersisted(toPersisted(snap))!;
    const r = restored.files.get(DEFAULT_EDITORS.MAIN)!;
    expect(r.isDirty).toBe(true);
    expect(r.visible).toBe(false);
    expect(r.currentText.endsWith('// edited')).toBe(true);
    expect(visibleEditorIds(restored)).not.toContain(DEFAULT_EDITORS.MAIN);
  });

  it('rejects corrupt payloads instead of crashing boot', () => {
    expect(fromPersisted(null as any)).toBeNull();
    expect(fromPersisted({} as any)).toBeNull();
    expect(fromPersisted({ title: 'x', source: { kind: 'blank' }, activeEditorId: null, files: [] } as any)).toBeNull();
    expect(fromPersisted({ title: 'x', source: { kind: 'blank' }, activeEditorId: null, files: [{ bogus: true }] } as any)).toBeNull();
  });

  it('keeps default hidden files hidden (styles.css / package.json)', () => {
    const snap = projectSnapshot();
    expect(visibleEditorIds(snap)).not.toContain(DEFAULT_EDITORS.CSS);
    expect(visibleEditorIds(snap)).not.toContain(DEFAULT_EDITORS.PACKAGE);
    expect(visibleEditorIds(snap)).toContain(DEFAULT_EDITORS.MAIN);
  });
});

describe('isSafeRelativePath', () => {
  it('accepts normal relative paths', () => {
    expect(isSafeRelativePath('main.js')).toBe(true);
    expect(isSafeRelativePath('src/app/App.tsx')).toBe(true);
  });
  it('rejects traversal and absolute paths', () => {
    expect(isSafeRelativePath('../outside.js')).toBe(false);
    expect(isSafeRelativePath('foo/../../bar.js')).toBe(false);
    expect(isSafeRelativePath('/etc/passwd')).toBe(false);
    expect(isSafeRelativePath('a//b.js')).toBe(false);
    expect(isSafeRelativePath('./x.js')).toBe(false);
    expect(isSafeRelativePath('')).toBe(false);
  });
});

describe('diagnosticUriForFiddleFile', () => {
  const pathApi = {
    tmpdir: () => '/tmp',
    join: (...parts: string[]) => parts.join('/').replace(/\/{2,}/g, '/'),
  };

  it('uses the real workspace path for showcases', () => {
    const snap = projectSnapshot();
    snap.source = { kind: 'showcase', ref: '/workspace/example' };
    expect(diagnosticUriForFiddleFile(snap, 'src/app/App.tsx', pathApi))
      .toBe('/workspace/example/src/app/App.tsx');
  });

  it('uses a stable virtual path for a legacy in-memory session', () => {
    const snap = projectSnapshot();
    snap.source = { kind: 'blank' };
    expect(diagnosticUriForFiddleFile(snap, 'renderer.js', pathApi))
      .toBe('/tmp/lynxtron-fiddle-diagnostics/blank-Project/renderer.js');
  });

  it('rejects paths that could escape the diagnostics root', () => {
    const snap = projectSnapshot();
    expect(diagnosticUriForFiddleFile(snap, '../outside.ts', pathApi)).toBeNull();
    expect(diagnosticUriForFiddleFile(snap, '/absolute.ts', pathApi)).toBeNull();
  });
});
