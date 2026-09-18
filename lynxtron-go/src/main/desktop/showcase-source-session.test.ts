import { expect, it, vi } from 'vitest';
import { createSessionSourceResolver } from './showcase-source-session';

it('keeps Open, concurrent callers and Run on the same resolved source', async () => {
  const lookup = vi.fn().mockResolvedValueOnce('release.tgz').mockResolvedValue('snapshot.tgz');
  const resolve = createSessionSourceResolver(lookup);
  expect(await Promise.all([resolve('baked.tgz'), resolve('baked.tgz')]))
    .toEqual(['release.tgz', 'release.tgz']);
  expect(await resolve('release.tgz')).toBe('release.tgz');
  expect(await resolve('baked.tgz')).toBe('release.tgz');
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(await createSessionSourceResolver(lookup)('baked.tgz')).toBe('snapshot.tgz');
});

it('does not cache a failed lookup', async () => {
  const lookup = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('snapshot.tgz');
  const resolve = createSessionSourceResolver(lookup);
  await expect(resolve('baked.tgz')).rejects.toThrow('network');
  expect(await resolve('baked.tgz')).toBe('snapshot.tgz');
});
