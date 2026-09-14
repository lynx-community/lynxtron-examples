import { foundationApi } from '../../store';

export interface CatalogVersion {
  version: string;
  publishedAt: string;
  tarballUrl: string;
  isPrerelease: boolean;
}

const REGISTRIES = [
  'https://registry.npmjs.org',
];

interface NpmPackage {
  versions: Record<string, { dist?: { tarball?: string } }>;
  time?: Record<string, string>;
  'dist-tags'?: Record<string, string>;
}

// Lynx's background-thread fetch has been observed to hang forever against
// registry.npmjs.org on macOS, while the host's Node fetch to the same URL
// completes in <1s. Route through the preload `net.fetchJson` bridge instead,
// falling back to Lynx fetch only when the bridge is absent (e.g. an older
// preload during a partial upgrade). The wrapper still races a timer so a
// hung fallback surfaces as an error instead of an infinite spinner.
const REGISTRY_TIMEOUT_MS = 15000;

async function fetchFromRegistry(registry: string, pkg: string): Promise<NpmPackage> {
  const url = `${registry}/${encodeURIComponent(pkg).replace('%40', '@')}`;
  const bridgeFetch = foundationApi()?.net?.fetchJson;
  if (typeof bridgeFetch === 'function') {
    return await bridgeFetch(url, { timeoutMs: REGISTRY_TIMEOUT_MS }) as NpmPackage;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${registry} timed out after ${REGISTRY_TIMEOUT_MS}ms`));
    }, REGISTRY_TIMEOUT_MS);
  });
  try {
    const r = await Promise.race([
      fetch(url, { headers: { 'Accept': 'application/json' } }),
      timeout,
    ]);
    if (!r.ok) throw new Error(`${registry} HTTP ${r.status}`);
    return await Promise.race([r.json() as Promise<NpmPackage>, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Fetch published Lynxtron versions from the public npm registry.
 * Returns newest-first.
 */
export async function fetchLynxtronVersions(pkg = '@lynx-js/lynxtron'): Promise<CatalogVersion[]> {
  let data: NpmPackage | null = null;
  const errors: string[] = [];
  for (const reg of REGISTRIES) {
    try { data = await fetchFromRegistry(reg, pkg); break; }
    catch (e: any) { errors.push(`${reg}: ${e?.message ?? String(e)}`); }
  }
  if (!data) throw new Error('All registries failed: ' + errors.join('; '));

  const versions = Object.keys(data.versions ?? {});
  const time = data.time ?? {};
  const results: CatalogVersion[] = versions.map(v => ({
    version: v,
    publishedAt: time[v] ?? '',
    tarballUrl: data!.versions[v]?.dist?.tarball ?? '',
    isPrerelease: /-[a-z]/.test(v),
  }));
  results.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  return results;
}
