import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseEntry } from '../store';
import {
  findShowcaseEntryForWorkspace,
  resolveCurrentShowcaseWorkspacePath,
} from './showcase-workspace';

const canvas: ShowcaseEntry = {
  name: '@lynxtron-examples/native-texture-canvas',
  description: '',
  tags: [],
  url: 'https://example.com/releases/v2/native-texture-canvas.tgz',
};

afterEach(() => {
  delete (globalThis as any).NativeModules;
});

describe('current showcase workspace resolution', () => {
  it('resolves the standard workspace directory to its registry entry', () => {
    expect(findShowcaseEntryForWorkspace('/cache/native-texture-canvas', [canvas])).toBe(canvas);
  });

  it('uses the registry URL cache check before reusing a current workspace', async () => {
    const materializedPath = vi.fn(() => '/cache/native-texture-canvas');
    const fetch = vi.fn();
    (globalThis as any).NativeModules = {
      nodejs: { exposed: { showcase: { materializedPath, fetch } } },
    };

    await expect(resolveCurrentShowcaseWorkspacePath(
      '/cache/native-texture-canvas',
      [canvas],
    )).resolves.toBe('/cache/native-texture-canvas');
    expect(materializedPath).toHaveBeenCalledWith(canvas.name, canvas.url);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches the current registry artifact when the cached URL is stale', async () => {
    const materializedPath = vi.fn(() => null);
    const fetch = vi.fn(async () => '/cache/native-texture-canvas');
    const onFetchStart = vi.fn();
    (globalThis as any).NativeModules = {
      nodejs: { exposed: { showcase: { materializedPath, fetch } } },
    };

    await expect(resolveCurrentShowcaseWorkspacePath(
      '/cache/native-texture-canvas',
      [canvas],
      { onFetchStart },
    )).resolves.toBe('/cache/native-texture-canvas');
    expect(onFetchStart).toHaveBeenCalledWith(canvas);
    expect(fetch).toHaveBeenCalledWith(canvas.url);
  });

  it('leaves an unregistered local showcase workspace untouched', async () => {
    await expect(resolveCurrentShowcaseWorkspacePath(
      '/projects/my-demo',
      [canvas],
    )).resolves.toBe('/projects/my-demo');
  });
});
