import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export const SHOWCASE_CACHE_METADATA_FILE = '.lynxtron-go-cache.json';

export interface ShowcaseCacheMetadata {
  schemaVersion: 1;
  cacheKey: string;
}

export function createShowcaseCacheKey(sourceUrl: string): string {
  return createHash('sha256').update(sourceUrl).digest('hex');
}

export function readShowcaseCacheMetadata(showcasePath: string): ShowcaseCacheMetadata | null {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(showcasePath, SHOWCASE_CACHE_METADATA_FILE), 'utf-8'),
    );
    if (value?.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(value?.cacheKey ?? '')) {
      return null;
    }
    return value as ShowcaseCacheMetadata;
  } catch {
    return null;
  }
}

export function writeShowcaseCacheMetadata(showcasePath: string, sourceUrl: string): void {
  const metadataPath = path.join(showcasePath, SHOWCASE_CACHE_METADATA_FILE);
  const temporaryPath = `${metadataPath}.${process.pid}.tmp`;
  const metadata: ShowcaseCacheMetadata = {
    schemaVersion: 1,
    cacheKey: createShowcaseCacheKey(sourceUrl),
  };
  fs.writeFileSync(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');
  fs.renameSync(temporaryPath, metadataPath);
}
