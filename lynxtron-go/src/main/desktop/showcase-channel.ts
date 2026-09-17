import fs from 'node:fs';
import path from 'node:path';

const REPO = 'https://github.com/lynx-community/lynxtron-examples';
const VERSION = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)';
export interface ChannelEntry {
  name: string;
  version: string;
  description: string;
  tags: string[];
  targets: Array<'desktop' | 'web'>;
  url: string;
  distribution: 'release';
}

/** The baked stable URL is the authority for the Go compatibility lane.
 * Preview, builtin, local and arbitrary external URLs never join a stable lane.
 */
export function channelVersion(url: string): string | null {
  const prefix = `${REPO}/releases/download/lynxtron-go-v`;
  if (!url.startsWith(prefix)) return null;
  return new RegExp(`^(${VERSION})/lynxtron-examples-[a-z0-9-]+-(?:mac-(?:arm64|x64)|win-x64)\\.tgz$`)
    .exec(url.slice(prefix.length))?.[1] ?? null;
}

export function parseChannel(value: any, version: string, runtime: string, platform: string, arch: string): ChannelEntry[] {
  if (value?.schemaVersion !== 1 || value.goVersion !== version || value.runtimeVersion !== runtime
    || ![undefined, 'go', 'showcases'].includes(value.artifactRelease)
    || !/^[a-f0-9]{40}$/.test(value.revision ?? '') || !Array.isArray(value.showcases)
    || value.showcases.length > 200) throw new Error('Incompatible showcase channel');
  const slug = platform === 'darwin' && ['arm64', 'x64'].includes(arch) ? `mac-${arch}`
    : platform === 'win32' && arch === 'x64' ? 'win-x64' : null;
  if (!slug) throw new Error('Unsupported showcase architecture');
  const names = new Set<string>();
  return value.showcases.map((entry: any) => {
    if (!/^@lynxtron-examples\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.name ?? '')
      || names.has(entry.name) || !new RegExp(`^${VERSION}$`).test(entry.version ?? '')
      || typeof entry.description !== 'string' || entry.description.length > 2000
      || !Array.isArray(entry.tags) || entry.tags.some((t: unknown) => typeof t !== 'string')
      || !Array.isArray(entry.targets) || entry.targets.some((t: unknown) => t !== 'desktop' && t !== 'web')) {
      throw new Error('Invalid showcase channel entry');
    }
    names.add(entry.name);
    const asset = `lynxtron-examples-${entry.name.split('/')[1]}-${slug}.tgz`;
    // Construct, never execute an arbitrary URL supplied by the index.
    return { name: entry.name, version: entry.version, description: entry.description,
      tags: entry.tags, targets: entry.targets, distribution: 'release' as const,
      url: `${REPO}/releases/download/${value.artifactRelease === 'go'
        ? `lynxtron-go-v${version}` : `lynxtron-showcases-go-v${version}-${value.revision}`}/${asset}` };
  });
}

export function createShowcaseChannel(options: {
  runtimeVersion: string; cacheDir: string; platform?: string; arch?: string;
  request?: typeof fetch; now?: () => number; log?: (message: string) => void;
}) {
  const request = options.request ?? fetch;
  const now = options.now ?? Date.now;
  const pending = new Map<string, { until: number; result: Promise<ChannelEntry[]> }>();
  async function load(version: string): Promise<ChannelEntry[]> {
    const file = path.join(options.cacheDir, `${version}.json`);
    const parse = (value: unknown) => parseChannel(value, version, options.runtimeVersion,
      options.platform ?? process.platform, options.arch ?? process.arch);
    try {
      const response = await request(`${REPO}/releases/download/lynxtron-showcases-go-v${version}/showcase-index.json`,
        { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`Channel HTTP ${response.status}`);
      // Bound the response even if Content-Length is absent or untrusted.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty channel response');
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > 512 * 1024) throw new Error('Showcase channel too large');
          chunks.push(part.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const raw = Buffer.concat(chunks).toString('utf8');
      const entries = parse(JSON.parse(raw));
      try {
        fs.mkdirSync(options.cacheDir, { recursive: true });
        const temporary = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, raw);
        fs.renameSync(temporary, file);
      } catch (error) { options.log?.(`Channel cache write failed: ${String(error)}`); }
      return entries;
    } catch (error) {
      options.log?.(`Showcase channel fallback: ${String(error)}`);
      try { return parse(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return []; }
    }
  }
  return {
    async entries(bakedUrl: string): Promise<ChannelEntry[]> {
      const version = channelVersion(bakedUrl);
      if (!version) return [];
      let cached = pending.get(version);
      if (!cached || cached.until < now()) {
        cached = { until: now() + 60_000, result: load(version) };
        pending.set(version, cached);
      }
      return cached.result;
    },
  };
}
