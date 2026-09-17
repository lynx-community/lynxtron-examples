import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveMaterializedShowcasePath } from './showcase-cache';

export function compatibleOfflineWorkspace(root: string, selected: string): string | null {
  const match = /^https:\/\/github\.com\/lynx-community\/lynxtron-examples\/releases\/download\/lynxtron-showcases-go-v(\d+\.\d+\.\d+)-[a-f0-9]{40}\/lynxtron-examples-([a-z0-9-]+)-(mac-(?:arm64|x64)|win-x64)\.tgz$/.exec(selected);
  if (!match) return null;
  const [, version, name, slug] = match;
  const prefix = 'https://github.com/lynx-community/lynxtron-examples/releases/download/';
  const baked = `${prefix}lynxtron-go-v${version}/lynxtron-examples-${name}-${slug}.tgz`;
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'showcases', name, '.lynxtron-go-cache.json'), 'utf8'));
    const old = metadata.sourceUrl ?? baked;
    if (typeof old !== 'string') return null;
    const oldTag = old.slice(prefix.length).split('/')[0];
    if (!old.startsWith(prefix) || (oldTag !== `lynxtron-go-v${version}`
      && !new RegExp(`^lynxtron-showcases-go-v${version.replaceAll('.', '\\.')}-[a-f0-9]{40}$`).test(oldTag))
      || old !== `${prefix}${oldTag}/lynxtron-examples-${name}-${slug}.tgz`) return null;
    return resolveMaterializedShowcasePath(root, name, old);
  } catch { return null; }
}

/** Channel refreshes must not destroy a user's edited workspace. Keep the old
 * tree recoverable; if fetching fails, restore it before surfacing the error.
 */
export async function preserveShowcaseUpdate<T>(root: string, url: string, fetch: () => Promise<T>): Promise<T> {
  const name = /^https:\/\/github\.com\/lynx-community\/lynxtron-examples\/releases\/download\/lynxtron-showcases-go-v\d+\.\d+\.\d+-[a-f0-9]{40}\/lynxtron-examples-([a-z0-9-]+)-(?:mac-(?:arm64|x64)|win-x64)\.tgz$/.exec(url)?.[1];
  if (!name) return fetch();
  const destination = path.join(root, 'showcases', name);
  if (!fs.existsSync(destination)) return fetch();
  const backup = path.join(root, 'showcase-backups', `${name}-${Date.now()}-${randomUUID()}`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.renameSync(destination, backup);
  try { return await fetch(); } catch (error) {
    if (fs.existsSync(destination)) fs.renameSync(destination, `${backup}.failed-download`);
    fs.renameSync(backup, destination);
    throw error;
  }
}
