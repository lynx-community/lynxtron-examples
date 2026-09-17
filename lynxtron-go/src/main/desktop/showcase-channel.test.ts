import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { channelVersion, createShowcaseChannel, parseChannel } from './showcase-channel';

const base = 'https://github.com/lynx-community/lynxtron-examples/releases/download/';
const baked = `${base}lynxtron-go-v0.1.13/lynxtron-examples-browser-mac-arm64.tgz`;
const manifest = { schemaVersion: 1, goVersion: '0.1.13', runtimeVersion: '0.0.23', revision: 'a'.repeat(40),
  showcases: [{ name: '@lynxtron-examples/browser', version: '0.1.1', description: 'Browser', tags: [], targets: ['desktop'] }] };
const roots: string[] = [];
const temp = () => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'go-channel-test-')); roots.push(p); return p; };
afterEach(() => { for (const p of roots.splice(0)) fs.rmSync(p, { recursive: true, force: true }); });

describe('showcase compatibility lanes', () => {
  it('initializes from the complete Go release without requiring showcase version bumps', () => {
    const entries = parseChannel({ ...manifest, artifactRelease: 'go' }, '0.1.13', '0.0.23', 'darwin', 'arm64');
    expect(entries[0].url).toBe(baked);
    expect(() => parseChannel({ ...manifest, artifactRelease: 'external' }, '0.1.13', '0.0.23', 'darwin', 'arm64')).toThrow();
  });
  it('only joins an exact baked stable Go release', () => {
    expect(channelVersion(baked)).toBe('0.1.13');
    for (const url of [baked.replace('0.1.13/', '0.1.13-dev.abc123/'), baked.replace('github.com', 'evil.example'),
      'builtin-showcase://hello-lynxtron', 'file:///tmp/demo.tgz', baked.replace('lynxtron-go-v', 'lynxtron-showcases-go-v')]) {
      expect(channelVersion(url)).toBeNull();
    }
  });
  it('chooses immutable native archives for all supported architectures', () => {
    for (const [platform, arch, slug] of [['darwin','arm64','mac-arm64'],['darwin','x64','mac-x64'],['win32','x64','win-x64']]) {
      const entries = parseChannel(manifest, '0.1.13', '0.0.23', platform, arch);
      expect(entries[0].url).toBe(`${base}lynxtron-showcases-go-v0.1.13-${'a'.repeat(40)}/lynxtron-examples-browser-${slug}.tgz`);
    }
  });
  it('rejects another Go version, runtime, malformed names, duplicate names and prereleases', () => {
    for (const bad of [
      { ...manifest, goVersion: '0.1.14' }, { ...manifest, runtimeVersion: '0.0.24' },
      { ...manifest, revision: 'main' }, { ...manifest, showcases: [...manifest.showcases, ...manifest.showcases] },
      { ...manifest, showcases: [{ ...manifest.showcases[0], name: '../escape' }] },
      { ...manifest, showcases: [{ ...manifest.showcases[0], version: '0.1.1-dev' }] },
    ]) expect(() => parseChannel(bad, '0.1.13', '0.0.23', 'darwin', 'arm64')).toThrow();
  });
  it('deduplicates queries, refreshes on TTL and never queries for alpha', async () => {
    let now = 1;
    const request = vi.fn(async () => new Response(JSON.stringify(manifest)));
    const channel = createShowcaseChannel({ cacheDir: temp(), runtimeVersion: '0.0.23', request, now: () => now });
    await Promise.all([channel.entries(baked), channel.entries(baked)]);
    expect(request).toHaveBeenCalledTimes(1);
    await channel.entries(baked.replace('0.1.13/', '0.1.13-dev.abc123/'));
    expect(request).toHaveBeenCalledTimes(1);
    now += 60_001;
    await channel.entries(baked);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('uses a validated persisted index offline; incompatible network data cannot poison it', async () => {
    const cacheDir = temp();
    const request = vi.fn(async () => new Response(JSON.stringify(manifest)));
    const setup = () => createShowcaseChannel({ cacheDir, runtimeVersion: '0.0.23', request, platform: 'darwin', arch: 'arm64' });
    const first = await setup().entries(baked);
    request.mockResolvedValueOnce(new Response(JSON.stringify({ ...manifest, goVersion: '0.1.14' })));
    expect(await setup().entries(baked)).toEqual(first);
    request.mockRejectedValueOnce(new Error('offline'));
    expect(await setup().entries(baked)).toEqual(first);
    expect(await createShowcaseChannel({ cacheDir: temp(), runtimeVersion: '0.0.23',
      request: async () => new Response('', { status: 404 }) }).entries(baked)).toEqual([]);
  });
  it('limits index response size', async () => {
    const channel = createShowcaseChannel({ cacheDir: temp(), runtimeVersion: '0.0.23',
      request: async () => new Response('x'.repeat(512 * 1024 + 1)) });
    expect(await channel.entries(baked)).toEqual([]);
  });
});
