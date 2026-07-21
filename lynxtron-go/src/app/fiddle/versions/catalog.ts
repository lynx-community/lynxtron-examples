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

async function fetchFromRegistry(registry: string, pkg: string): Promise<NpmPackage> {
  const url = `${registry}/${encodeURIComponent(pkg).replace('%40', '@')}`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`${registry} HTTP ${r.status}`);
  return await r.json() as NpmPackage;
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
