import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const SHOWCASE_CACHE_METADATA_FILE = '.lynxtron-go-cache.json';

function createShowcaseCacheKey(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('hex');
}

export function resolveMaterializedShowcasePath(
  workspaceRoot: string,
  name: string,
  expectedSourceUrl?: string,
): string | null {
  try {
    if (!name) return null;
    const bare = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
    const showcasePath = path.join(workspaceRoot, 'showcases', bare);
    const pkg = JSON.parse(fs.readFileSync(path.join(showcasePath, 'package.json'), 'utf-8'));
    if (!pkg?.showcase) return null;

    // Callers without a registry URL retain the old lookup semantics. The Go
    // UI always supplies it, so legacy caches and caches from another Release
    // become misses and are refreshed by the CLI.
    if (!expectedSourceUrl) return showcasePath;
    const metadata = JSON.parse(
      fs.readFileSync(path.join(showcasePath, SHOWCASE_CACHE_METADATA_FILE), 'utf-8'),
    );
    return metadata?.schemaVersion === 1
      && metadata?.cacheKey === createShowcaseCacheKey(expectedSourceUrl)
      ? showcasePath
      : null;
  } catch {
    return null;
  }
}
