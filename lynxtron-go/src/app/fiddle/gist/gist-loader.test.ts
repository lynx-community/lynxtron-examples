// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGistFiddle, publishGistFiddle } from './gist-loader';

afterEach(() => vi.unstubAllGlobals());

describe('project gist format', () => {
  it('stores nested project paths through an explicit manifest', async () => {
    let requestBody: any = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      requestBody = JSON.parse(init.body);
      return { ok: true, json: async () => ({ id: 'abc', html_url: 'https://gist.test/abc' }) };
    }));

    await publishGistFiddle('token', {
      'package.json': '{"name":"p"}',
      'src/app/App.tsx': 'export function App() {}',
    }, 'project', null);

    const manifest = JSON.parse(requestBody.files['.lynxtron-go-project.json'].content);
    const storageName = Object.keys(manifest.paths)[0];
    expect(manifest.paths[storageName]).toBe('src/app/App.tsx');
    expect(requestBody.files[storageName].content).toContain('function App');
  });

  it('restores nested paths before creating the editor snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: '01234567890123456789',
        description: 'project',
        files: {
          '.lynxtron-go-project.json': {
            filename: '.lynxtron-go-project.json', size: 1, truncated: false,
            content: JSON.stringify({ version: 1, paths: { 'lynxtron-000-App.tsx': 'src/app/App.tsx' } }),
          },
          'lynxtron-000-App.tsx': {
            filename: 'lynxtron-000-App.tsx', size: 3, truncated: false, content: 'app',
          },
          'package.json': {
            filename: 'package.json', size: 2, truncated: false, content: '{}',
          },
        },
      }),
    })));

    const snapshot = await loadGistFiddle('01234567890123456789');
    expect(snapshot.files.get('src/app/App.tsx')?.currentText).toBe('app');
    expect(snapshot.source).toEqual({ kind: 'gist', gistId: '01234567890123456789' });
  });
});
