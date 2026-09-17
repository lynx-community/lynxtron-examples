import { expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  entries: [
    { name: 'builtin', distribution: 'builtin', url: 'builtin:hello' },
    { name: 'browser', url: 'baked', thumbnail: 'image.png' },
  ] as any[],
  catalog: vi.fn(),
}));
vi.mock('@lynx-js/react', () => ({ useEffect: vi.fn(), useState: vi.fn() }));
vi.mock('../store', () => ({ SHOWCASE_REGISTRY: fixture.entries,
  showcaseApi: () => ({ catalog: fixture.catalog }) }));
import { refreshShowcaseCatalog } from './showcase-catalog';

it('merges new showcases, retains baked metadata and protects builtins; failures retain the catalog', async () => {
  fixture.catalog.mockResolvedValue([
    { name: 'builtin', url: 'replacement' },
    { name: 'browser', url: 'immutable-revision' },
    { name: 'new-demo', url: 'new-revision' },
  ]);
  await Promise.all([refreshShowcaseCatalog(), refreshShowcaseCatalog()]);
  expect(fixture.catalog).toHaveBeenCalledTimes(1);
  expect(fixture.entries).toEqual([
    { name: 'builtin', distribution: 'builtin', url: 'builtin:hello' },
    { name: 'browser', url: 'immutable-revision', thumbnail: 'image.png' },
    { name: 'new-demo', url: 'new-revision' },
  ]);
  fixture.catalog.mockRejectedValue(new Error('offline'));
  await refreshShowcaseCatalog();
  expect(fixture.entries[2].name).toBe('new-demo');
});
