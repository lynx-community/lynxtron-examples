import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { compatibleOfflineWorkspace, preserveShowcaseUpdate } from './showcase-update';
const roots: string[] = [];
const url = `https://github.com/lynx-community/lynxtron-examples/releases/download/lynxtron-showcases-go-v0.1.13-${'a'.repeat(40)}/lynxtron-examples-browser-mac-${process.arch}.tgz`;
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-update-test-')); roots.push(root);
  const destination = path.join(root, 'showcases', 'browser');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'edited.txt'), 'user edits');
  fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({ showcase: {} }));
  return { root, destination };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
it('keeps edits recoverable after a successful update', async () => {
  const { root, destination } = fixture();
  await preserveShowcaseUpdate(root, url, async () => { fs.mkdirSync(destination); return 'ok'; });
  const backups = fs.readdirSync(path.join(root, 'showcase-backups'));
  expect(backups).toHaveLength(1);
  expect(fs.readFileSync(path.join(root, 'showcase-backups', backups[0], 'edited.txt'), 'utf8')).toBe('user edits');
});
it('restores the original workspace on failed downloads', async () => {
  const { root, destination } = fixture();
  await expect(preserveShowcaseUpdate(root, url, async () => {
    fs.mkdirSync(destination); throw new Error('network');
  })).rejects.toThrow('network');
  expect(fs.readFileSync(path.join(destination, 'edited.txt'), 'utf8')).toBe('user edits');
});
it('offline fallback only accepts the same Go lane and running architecture cache key', () => {
  const { root, destination } = fixture();
  const old = url.replace('a'.repeat(40), 'b'.repeat(40));
  const put = (sourceUrl: string, arch = process.arch) => fs.writeFileSync(path.join(destination, '.lynxtron-go-cache.json'), JSON.stringify({
    schemaVersion: 1, sourceUrl, cacheKey: createHash('sha256').update(`${process.platform}\0${arch}\0${sourceUrl}`).digest('hex'),
  }));
  put(old);
  expect(compatibleOfflineWorkspace(root, url)).toBe(destination);
  put(old.replace('0.1.13', '0.1.12'));
  expect(compatibleOfflineWorkspace(root, url)).toBeNull();
  put(old, process.arch === 'arm64' ? 'x64' : 'arm64');
  expect(compatibleOfflineWorkspace(root, url)).toBeNull();
});
