export interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
}

/**
 * Search the npm registry (upstream Fiddle uses Algolia; the registry's own
 * search endpoint needs no credentials and returns the same shape we need).
 */
export async function searchNpm(query: string, size = 6): Promise<NpmSearchResult[]> {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`npm search failed: ${res.status}`);
  const json: any = await res.json();
  return (json.objects ?? []).map((o: any) => ({
    name: o.package?.name ?? '',
    version: o.package?.version ?? '',
    description: o.package?.description ?? '',
  })).filter((r: NpmSearchResult) => r.name);
}

/** Parse dependencies out of a package.json source string. */
export function parseDependencies(packageJson: string): Record<string, string> {
  try {
    const parsed = JSON.parse(packageJson);
    return parsed?.dependencies && typeof parsed.dependencies === 'object' ? parsed.dependencies : {};
  } catch (_) {
    return {};
  }
}

/** Return package.json source with a dependency added (2-space indent). */
export function addDependency(packageJson: string, name: string, version: string): string | null {
  try {
    const parsed = JSON.parse(packageJson || '{}');
    if (!parsed.dependencies || typeof parsed.dependencies !== 'object') parsed.dependencies = {};
    parsed.dependencies[name] = `^${version}`;
    return JSON.stringify(parsed, null, 2) + '\n';
  } catch (_) {
    return null;
  }
}

/** Return package.json source with a dependency removed. */
export function removeDependency(packageJson: string, name: string): string | null {
  try {
    const parsed = JSON.parse(packageJson || '{}');
    if (parsed.dependencies && typeof parsed.dependencies === 'object') delete parsed.dependencies[name];
    return JSON.stringify(parsed, null, 2) + '\n';
  } catch (_) {
    return null;
  }
}
