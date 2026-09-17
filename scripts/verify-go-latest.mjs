import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const installers = [
  'lynxtron-go-darwin-arm64.dmg',
  'lynxtron-go-darwin-x64.dmg',
  'LynxtronGo-win-x64-Setup.exe',
];

export function verifyLatest(release, expectedTag) {
  if (!/^lynxtron-go-v\d+\.\d+\.\d+$/.test(release?.tag_name ?? '')
    || release.draft !== false || release.prerelease !== false) {
    throw Error('Latest must be a published stable Go release');
  }
  if (expectedTag && release.tag_name !== expectedTag) throw Error('Latest Go release changed unexpectedly');
  for (const name of installers) {
    if (!release.assets?.some(asset => asset.name === name && asset.state === 'uploaded' && asset.size > 0)) {
      throw Error(`Latest Go release is missing installer: ${name}`);
    }
  }
  return release.tag_name;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, value] = process.argv.slice(2);
  if (!['snapshot', 'unchanged', 'expected'].includes(mode) || !value) throw Error('Expected snapshot/unchanged <file> or expected <tag>');
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw Error('GITHUB_REPOSITORY is required');
  const release = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/releases/latest`], { encoding: 'utf8' }));
  const expected = mode === 'unchanged' ? fs.readFileSync(value, 'utf8').trim() : mode === 'expected' ? value : undefined;
  const tag = verifyLatest(release, expected);
  if (mode === 'snapshot') fs.writeFileSync(value, `${tag}\n`, { flag: 'wx' });
  console.log(`Latest verified: ${tag}; all three installers present.`);
}
